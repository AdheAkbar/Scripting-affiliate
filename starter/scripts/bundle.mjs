// Gabungkan file starter + 4 dokumen ke ../ai-studio-upload/ karena lampiran AI Studio menolak .ts.
// Format bundle: "## FILE: <path>" + blok kode 4-backtick. Self-check: isi tiap blok harus identik dengan file asli.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "..", "ai-studio-upload");
const docs = join(root, "..", "docs");

const FILES = [
  "shared/schemas/enums.ts",
  "shared/schemas/documents.ts",
  "shared/schemas/remotion.ts",
  "shared/schemas/ai-outputs.ts",
  "shared/schemas/index.ts",
  "shared/duration.ts",
  "shared/share-target.ts",
  "shared/quality-gates.ts",
  "shared/performance.ts",
  "server/ai/llm.ts",
  "server/ai/prompts.ts",
  "server/ai/pricing.ts",
  "server/research/link-extractor.ts",
  "server/research/web-search.ts",
  "tests/schemas.test.ts",
  "tests/pipeline.test.ts",
  "firestore.rules",
  "storage.rules",
  "firestore.indexes.json",
  "seed/brand-preset.json",
  "public/manifest.webmanifest",
];
const LANG = { ts: "ts", json: "json", webmanifest: "json", rules: "" };
const FENCE = "````";

const read = (p) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");

const header = `# Starter Bundle — Affiliate Script Studio

Berisi ${FILES.length} file referensi yang sudah diuji (typecheck bersih, semua test lulus).
INSTRUKSI UNTUK AGENT: buat setiap file di bawah pada path persis seperti judul "## FILE:", dengan isi persis seperti di dalam blok kode. JANGAN mengubah, merapikan, atau menulis ulang isinya.
`;
const body = FILES.map((p) => {
  const content = read(p);
  if (content.includes(FENCE)) throw new Error(`${p} berisi ${FENCE}; ganti fence di bundle.mjs`);
  const lang = LANG[p.split(".").pop()] ?? "";
  return `## FILE: ${p}\n\n${FENCE}${lang}\n${content.endsWith("\n") ? content : content + "\n"}${FENCE}\n`;
}).join("\n");
const bundle = `${header}\n${body}`;

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "starter-bundle.md"), bundle);
writeFileSync(join(out, "starter-bundle.txt"), bundle);
for (const d of ["prd.md", "erd.md", "design.md", "agent.md"]) copyFileSync(join(docs, d), join(out, d));

// Self-check round-trip
const re = new RegExp(`^## FILE: (.+)\\n\\n${FENCE}[a-z]*\\n([\\s\\S]*?)${FENCE}$`, "gm");
const parsed = new Map([...bundle.matchAll(re)].map((m) => [m[1], m[2]]));
const bad = FILES.filter((p) => {
  const c = read(p);
  return parsed.get(p) !== (c.endsWith("\n") ? c : c + "\n");
});
if (parsed.size !== FILES.length || bad.length) {
  console.error(`Self-check GAGAL: ${parsed.size}/${FILES.length} blok terbaca; tidak cocok: ${bad.join(", ")}`);
  process.exit(1);
}
console.log(`OK: ${FILES.length} file -> ai-studio-upload/starter-bundle.md (+ .txt) dan 4 dokumen disalin.`);
