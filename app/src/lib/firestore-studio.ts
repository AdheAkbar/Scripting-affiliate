import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { z } from "zod";
import { AppConfig, Brand } from "../../shared/schemas";
import type { AppConfigDoc, BrandDoc } from "./api";
import { db, handleFirestoreError, OperationType } from "./firebase";

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === "string") return val;
  return new Date().toISOString();
}

export type BrandEditablePayload = Omit<
  Brand,
  "ownerUid" | "cachedSystemBlock" | "cachedSystemBlockTokens"
>;

export async function fetchOwnerBrands(ownerUid: string): Promise<BrandDoc[]> {
  const path = "brands";
  try {
    const q = query(collection(db, path), where("ownerUid", "==", ownerUid));
    const snap = await getDocs(q);
    const brands: BrandDoc[] = [];

    for (const docSnap of snap.docs) {
      const raw = docSnap.data();
      const parsed = Brand.safeParse(raw);
      if (parsed.success) {
        brands.push({
          ...parsed.data,
          id: docSnap.id,
          createdAt: toIsoString(raw.createdAt),
          updatedAt: toIsoString(raw.updatedAt),
        });
      }
    }
    return brands;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Validasi dengan skema Brand sebelum menulis ke Firestore.
 * Field cachedSystemBlock & cachedSystemBlockTokens sengaja tidak ditulis dari client
 * karena firestore.rules tidak mengizinkan field tersebut diubah dari client.
 */
export async function createSeedBrand(
  ownerUid: string,
  presetBrand: BrandEditablePayload,
): Promise<BrandDoc> {
  const path = "brands";
  const validated = Brand.parse({
    ...presetBrand,
    ownerUid,
  });

  const {
    cachedSystemBlock: _block,
    cachedSystemBlockTokens: _tokens,
    ...clientWritable
  } = validated;

  try {
    const ref = await addDoc(collection(db, path), {
      ...clientWritable,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const nowIso = new Date().toISOString();
    return {
      ...clientWritable,
      id: ref.id,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOwnerBrand(
  brandId: string,
  ownerUid: string,
  payload: BrandEditablePayload,
  existingCreatedAt?: string,
): Promise<BrandDoc> {
  const path = `brands/${brandId}`;
  const validated = Brand.parse({
    ...payload,
    ownerUid,
  });

  const {
    cachedSystemBlock: _block,
    cachedSystemBlockTokens: _tokens,
    ...clientWritable
  } = validated;

  try {
    await updateDoc(doc(db, "brands", brandId), {
      ...clientWritable,
      updatedAt: serverTimestamp(),
    });
    const nowIso = new Date().toISOString();
    return {
      ...clientWritable,
      id: brandId,
      createdAt: existingCreatedAt ?? nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchAppConfig(): Promise<AppConfigDoc | null> {
  const path = "appConfig/owner";
  try {
    const snap = await getDoc(doc(db, "appConfig", "owner"));
    if (!snap.exists()) return null;
    const raw = snap.data();
    const parsed = AppConfig.safeParse(raw);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      updatedAt: toIsoString(raw.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Validasi dengan skema AppConfig sebelum membuat atau memperbarui appConfig/owner di Firestore.
 */
export async function upsertAppConfig(
  payload: z.infer<typeof AppConfig>,
): Promise<AppConfigDoc> {
  const path = "appConfig/owner";
  const validated = AppConfig.parse(payload);
  const docData: Record<string, unknown> = {
    ownerEmail: validated.ownerEmail,
    monthlyBudgetUsd: validated.monthlyBudgetUsd,
    updatedAt: serverTimestamp(),
  };
  if (validated.activeBrandId) {
    docData.activeBrandId = validated.activeBrandId;
  }

  try {
    await setDoc(doc(db, "appConfig", "owner"), docData, { merge: true });
    return {
      ...validated,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
