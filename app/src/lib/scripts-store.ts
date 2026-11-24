// Riwayat naskah di Firestore (koleksi `scripts`). Query hanya per ownerUid -> tanpa index komposit; urut di client.
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { SavedScript } from "../../shared/schemas";
import { db } from "./firebase";

export type ScriptDoc = SavedScript & { id: string; createdAt: string };

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : new Date().toISOString());

function fromSnap(id: string, raw: Record<string, unknown>): ScriptDoc | null {
  const parsed = SavedScript.safeParse(raw);
  return parsed.success ? { ...parsed.data, id, createdAt: iso(raw.createdAt) } : null;
}

/** Firestore menolak `undefined`; buang field kosong sebelum menulis. */
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export async function saveScript(data: SavedScript): Promise<string> {
  const valid = SavedScript.parse(data);
  const ref = await addDoc(collection(db, "scripts"), { ...clean(valid), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function listScripts(ownerUid: string): Promise<ScriptDoc[]> {
  const snap = await getDocs(query(collection(db, "scripts"), where("ownerUid", "==", ownerUid)));
  return snap.docs
    .map((d) => fromSnap(d.id, d.data()))
    .filter((s): s is ScriptDoc => s !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getScript(id: string): Promise<ScriptDoc | null> {
  const snap = await getDoc(doc(db, "scripts", id));
  return snap.exists() ? fromSnap(snap.id, snap.data()) : null;
}

export async function updateScript(id: string, patch: Partial<Pick<SavedScript, "status" | "result" | "scenes">>): Promise<void> {
  await updateDoc(doc(db, "scripts", id), { ...clean(patch), updatedAt: serverTimestamp() });
}

export async function deleteScript(id: string): Promise<void> {
  await deleteDoc(doc(db, "scripts", id));
}

/** Contoh naskah terbaik (terjual, lalu views) untuk dipelajari gaya & hook-nya. */
export function winningExamples(scripts: ScriptDoc[], max = 3): string[] {
  return scripts
    .filter((s) => s.status === "posted" && ((s.result?.unitsSold ?? 0) > 0 || (s.result?.views ?? 0) > 0))
    .sort((a, b) => (b.result?.unitsSold ?? 0) - (a.result?.unitsSold ?? 0) || (b.result?.views ?? 0) - (a.result?.views ?? 0))
    .slice(0, max)
    .map((s) => {
      const vo = s.scenes.map((sc) => sc.voiceoverText).join(" ");
      return `${s.product.name} (${s.result?.unitsSold ?? 0} terjual, ${s.result?.views ?? 0} views): ${vo}`.slice(0, 400);
    });
}
