import fs from "node:fs";
import path from "node:path";

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

export interface FirestoreRestTarget {
  projectId: string;
  databaseId: string;
}

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export interface FirestoreRestDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

let cachedTarget: FirestoreRestTarget | null = null;

export function getFirestoreRestTarget(): FirestoreRestTarget {
  if (cachedTarget) return cachedTarget;
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as FirebaseAppletConfig;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || raw.projectId;
  const databaseId = raw.firestoreDatabaseId?.trim() || "(default)";
  if (!projectId || projectId === "remixed-project-id") {
    throw new Error("Konfigurasi projectId Firebase belum valid.");
  }
  cachedTarget = { projectId, databaseId };
  return cachedTarget;
}

export function buildFirestoreDocumentUrl(
  target: FirestoreRestTarget,
  docPath: string,
): string {
  const cleanPath = docPath.replace(/^\/+/, "");
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId,
  )}/databases/${encodeURIComponent(target.databaseId)}/documents/${cleanPath}`;
}

export function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function fromFirestoreValue(value: FirestoreValue): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item) => fromFirestoreValue(item));
  }
  if ("mapValue" in value) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

export function toFirestoreFields(
  obj: Record<string, unknown>,
): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      fields[key] = toFirestoreValue(val);
    }
  }
  return fields;
}

export function fromFirestoreDocument(
  doc: FirestoreRestDocument,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(doc.fields ?? {})) {
    out[key] = fromFirestoreValue(val);
  }
  return out;
}

/**
 * Helper baca/tulis Firestore dari server menggunakan Firestore REST API
 * dengan header Authorization: Bearer <ID token owner>.
 * Tidak membutuhkan Firebase Admin SDK Firestore / IAM sehingga berjalan di Starter Tier
 * sambil tetap tunduk penuh pada firestore.rules.
 */
export async function firestoreRestGet(
  docPath: string,
  ownerIdToken: string,
): Promise<Record<string, unknown> | null> {
  const url = buildFirestoreDocumentUrl(getFirestoreRestTarget(), docPath);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${ownerIdToken}`,
      Accept: "application/json",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore REST GET ${docPath} gagal (${res.status}): ${text}`);
  }
  const doc = (await res.json()) as FirestoreRestDocument;
  return fromFirestoreDocument(doc);
}

export async function firestoreRestPatch(
  docPath: string,
  data: Record<string, unknown>,
  ownerIdToken: string,
): Promise<Record<string, unknown>> {
  const baseUrl = buildFirestoreDocumentUrl(getFirestoreRestTarget(), docPath);
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  const params = new URLSearchParams();
  for (const key of keys) {
    params.append("updateMask.fieldPaths", key);
  }
  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ownerIdToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore REST PATCH ${docPath} gagal (${res.status}): ${text}`);
  }
  const doc = (await res.json()) as FirestoreRestDocument;
  return fromFirestoreDocument(doc);
}

export async function firestoreRestCreate(
  collectionPath: string,
  data: Record<string, unknown>,
  ownerIdToken: string,
  documentId?: string,
): Promise<{ id: string; data: Record<string, unknown> }> {
  const baseUrl = buildFirestoreDocumentUrl(getFirestoreRestTarget(), collectionPath);
  const url = documentId
    ? `${baseUrl}?documentId=${encodeURIComponent(documentId)}`
    : baseUrl;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerIdToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore REST CREATE ${collectionPath} gagal (${res.status}): ${text}`);
  }
  const doc = (await res.json()) as FirestoreRestDocument;
  const id = doc.name?.split("/").pop() ?? documentId ?? "";
  return { id, data: fromFirestoreDocument(doc) };
}
