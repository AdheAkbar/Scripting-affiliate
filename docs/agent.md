# Agent Operating Manual — Affiliate Script Studio — V1

Panduan kerja untuk AI coding agent (Google AI Studio Build agent, Cursor, dll.). **Baca bersama `prd.md`, `erd.md`, `design.md` sebelum menulis kode.** Jika ada konflik: `prd.md` > `erd.md` > `design.md` > dokumen ini; jika masih ragu, **tanya owner**, jangan menebak.

## 1. Batasan Mutlak
- **Internal, 1 pengguna.** Dilarang: registrasi publik, multi-user, organisasi/tenant, billing/Stripe, landing page marketing.
- **LLM = lewat 9router** (proxy OpenAI-compatible, `POST {LLM_BASE_URL}/chat/completions`), dipanggil dengan SDK `openai` dari server. Model dipilih lewat secret `LLM_MODEL` (nama model/combo di dashboard 9router). Meski AI Studio defaultnya Gemini, **jangan** memakai Gemini SDK atau `@google/genai` di runtime aplikasi.
- **API key hanya di server.** `LLM_API_KEY` (key 9router) dan `TAVILY_API_KEY` disimpan di panel *Secrets* AI Studio (lalu Cloud Run). Tidak boleh ada di kode, dokumen, client, bundle, `localStorage`, atau log.
- **9router harus bisa dijangkau dari internet.** Server Cloud Run tidak bisa memanggil `localhost` di laptop owner. `LLM_BASE_URL` harus URL publik HTTPS (VPS/Docker/tunnel) dengan `REQUIRE_API_KEY` aktif.
- **Dilarang** scraping agresif / bypass anti-bot / CAPTCHA marketplace.

## 2. Tech Stack
| Lapisan | Pilihan | Catatan |
| :--- | :--- | :--- |
| Frontend | React + TypeScript (`strict: true`) + Vite + Tailwind + shadcn/ui + Lucide | Struktur bawaan AI Studio Build |
| Server | Node.js server bawaan AI Studio Build (Express-style route handlers) | Semua panggilan LLM & tulisan hasil AI |
| AI | SDK `openai` (TypeScript) → 9router (`LLM_BASE_URL`) | Model dari secret `LLM_MODEL`, mis. `cc/claude-sonnet-4-6` atau nama combo |
| Validasi | `zod` 4 (dipakai bersama client & server) | Wajib untuk request API, output LLM, dokumen Firestore, ekspor JSON |
| Data | Firebase Auth (Google sign-in) + Cloud Firestore + Firebase Storage (foto) | Diprovisikan dari AI Studio; server memakai `firebase-admin` |
| Riset web | Tavily Search API (`server/research/web-search.ts`), lalu LLM merangkum hasilnya | 9router tidak punya web search untuk server. Tanpa `TAVILY_API_KEY`, riset dilewati dan tren ditandai "tidak ada" |
| Ekstraksi link | `fetch` + regex meta/JSON-LD (timeout 8 dtk), fallback ke foto / manual | `server/research/link-extractor.ts`, tanpa Cheerio |
| Deploy | Cloud Run (tombol Publish AI Studio) | |
| Android | PWA (manifest + service worker + share target), opsional APK via TWA | Mode "Android app" AI Studio **tidak dipakai**: client-only, tak bisa memakai secrets server |

### Struktur logis (sesuaikan dengan struktur yang dibuat AI Studio, tapi pertahankan pemisahan ini)
```text
src/                         # client React
  pages/                     # studio/[step], trends, history, brand, ideas, teleprompter
  components/{studio,script,teleprompter,trend,brand,ui}/
  lib/{firebase.ts, api.ts, duration.ts}
shared/schemas/              # Zod: brand, product, trend, brief, angle, hook, script, audit, perf, remotion, api
server/
  index.ts                   # router + verifikasi Firebase ID token + allowlist email
  routes/                    # trends, products, briefs, angles, scripts, viral-references, performance, ideas
  ai/
    llm.ts                   # SATU-SATUNYA tempat memanggil 9router (+ logging apiRuns, gate, eskalasi, repair)
    prompts.ts               # builder prompt per tahap
    pricing.ts               # tarif setara → estCostUsd
  research/link-extractor.ts, research/web-search.ts (Tavily)
  db/admin.ts                # firebase-admin + helper tulis tervalidasi Zod
  budget.ts                  # cek total apiRuns bulan ini vs monthlyBudgetUsd
public/manifest.webmanifest, sw.js, .well-known/assetlinks.json (jika TWA)
firestore.rules, firestore.indexes.json, storage.rules
```

## 3. Aturan Pemanggilan LLM via 9router (Non-Negotiable)

Kode referensi teruji: `starter/server/ai/llm.ts` (`createLlm`). Salin apa adanya; aturan di bawah menjelaskan isinya.

1. **Pipeline bertahap, bukan chat sekali tembak.** Ikuti urutan di `prd.md` §2: trend_pulse → product_research → brief_extract → angles → hooks → script_draft (+ self-critique) → audit → partial_revise. Simpan hasil setiap tahap ke Firestore sebelum lanjut.
2. **Format API = OpenAI Chat Completions** (`client.chat.completions.create`) ke `LLM_BASE_URL` 9router. Jangan memakai fitur khusus vendor (Anthropic `output_config`, `cache_control`, server tools) karena belum tentu diteruskan 9router.
3. **JSON terstruktur lewat prompt + Zod.** System prompt diakhiri `<response_format>` berisi JSON Schema dari `z.toJSONSchema(schema)`. Jawaban diambil dengan `extractJson()` (toleran ```json fence) lalu **divalidasi Zod**. Gagal → **maks 1 repair** dengan pesan error Zod. Masih gagal → `status = failed`, UI menampilkan Coba Lagi. Jangan memakai `response_format`/`tools` OpenAI (tidak semua provider di belakang 9router mendukungnya).
4. **Riset web = 2 langkah.** (a) Server mencari lewat `webSearch` (Tavily, `server/research/web-search.ts`) memakai `trendQueries()` / `productQueries()`, lalu LLM merangkum **hanya** dari hasil itu dengan URL sumber. (b) `generate()` mengubah ringkasan jadi JSON. Tanpa `TAVILY_API_KEY`, langkah (a) dilewati dan UI jujur menyatakan tidak ada tren terverifikasi.
5. **Effort: "low tapi tetap cerdas"** (keputusan owner, `prd.md` §8).
   - Semua tahap mulai dengan `reasoning_effort: "low"`. Provider yang tidak mendukung boleh dimatikan lewat secret `LLM_SEND_EFFORT=off`; logika gate & eskalasi tetap jalan.

   | Tahap | Effort awal | Eskalasi otomatis (maks 1x) | Batas pencarian |
   | :--- | :--- | :--- | :--- |
   | `brief_extract`, `viral_extract`, `audit` | `low` | tidak ada (repair 1x jika Zod gagal) | – |
   | `trend_pulse`, `product_research` | `low` | → `medium` jika < 3 item bersumber | 3 query |
   | `angles`, `hooks`, `script_draft`, `partial_revise` | `low` | → `medium` jika gate gagal | – |
   | `ideas` | `low` | tidak ada | – |

   **Quality gate** (kode deterministik `shared/quality-gates.ts`, **tanpa** panggilan AI tambahan, ditulis ke `apiRuns.qualityGate`):
   - **angles:** 3–5 angle, gaya jual tidak semua sama, minimal 1 angle `faceless` jika `faceMode = mixed`, setiap `trendItemRefs` ada di snapshot.
   - **hooks:** ≥ 5 hook, ≥ 3 tipe psikologi berbeda, `verbalHook` ≤ 12 kata, `textOnScreen` ≤ 6 kata, tidak ada frasa dari `bannedPhrases`.
   - **script_draft / partial_revise:** durasi dalam target ±15%; setiap adegan `proof`/`demo` punya `factIds` valid; adegan `cta` punya `ctaVariants` untuk semua platform; 0 frasa terlarang; hook ≤ 3,5 detik; caption TikTok ≤ 150 karakter.

   **Aturan eskalasi:**
   - Jika gate gagal, panggil ulang tahap yang sama **sekali** di effort `medium`, dengan alasan kegagalan sebagai `<previous_attempt_issues>`. Catat `escalatedFrom` di `apiRuns`. Masih gagal → simpan hasil terbaik, tampilkan temuan di Audit; jangan loop.
   - Effort `high` **tidak pernah** otomatis; hanya dari tombol manual "Tulis ulang lebih teliti".
   - **Bukti, bukan asumsi:** sebelum rilis, jalankan eval §6 butir 7 di `low`+eskalasi vs semua-`medium`. Jika `low` kalah > 0,5 poin, naikkan **hanya tahap yang kalah** ke `medium`.
6. **Urutan prompt stabil.** `system` = `buildSystemPrompt(brand)` (statis per brand, tanpa tanggal/ID) + `<response_format>`; `user` = `<product_input>`, `<verified_facts>`, `<trend_context>`, `<winning_patterns>`, `<task>`. Provider yang punya auto prompt-cache akan menghemat; `cached_tokens` dicatat ke `apiRuns.cacheReadTokens` bila dilaporkan.
7. **Streaming** untuk `script_draft`: `client.chat.completions.stream(...)` → event `content` diteruskan sebagai SSE, `finalChatCompletion()` untuk hasil akhir, lalu validasi Zod. `max_tokens` script ~16000.
8. **Refusal.** `message.refusal` terisi atau `finish_reason = "content_filter"` → status `refused` + pesan di UI. Model yang benar-benar menjawab (`response.model`, bisa model fallback 9router) dicatat di `apiRuns.modelName`.
9. **Logging wajib.** Setiap panggilan menulis 1 dokumen `apiRuns`, termasuk yang gagal: token prompt/cached/completion, jumlah pencarian web, latensi, status, `monthKey`.
10. **Anggaran.** Sebelum setiap panggilan, cek total `estCostUsd` bulan ini. Jika ≥ `monthlyBudgetUsd`, tolak dengan HTTP 402 dan pesan jelas.
11. **Error SDK.** Tangkap dari yang paling spesifik: `OpenAI.RateLimitError` → `OpenAI.APIError` → `OpenAI.APIConnectionError`. SDK sudah retry 2x. Jangan string-match pesan error.

### Biaya
9router sendiri gratis; tagihan nyata ada di provider/langganan yang Anda sambungkan ke 9router. `server/ai/pricing.ts` memakai **tarif setara** (input $2, output $10, cached $0,10 per 1 juta token; Tavily $0,008 per query) supaya batas anggaran bulanan tetap berfungsi sebagai pengaman. Ubah `DEFAULT_RATES` bila tarif provider Anda berbeda.

**Skema referensi sudah ada dan teruji** di `starter/shared/schemas` (Zod 4). Salin apa adanya, jangan ditulis ulang. Jebakan Zod 4: `z.record(EnumSchema, …)` mewajibkan **semua** key enum; untuk map per platform pakai `z.partialRecord`.

Konvensi: nama file `kebab-case`, komponen `PascalCase`, tanpa `any`, tanpa error yang ditelan diam-diam (`catch {}` dilarang). Komentar hanya untuk "kenapa".

## 4. Environment / Secrets
```env
# Secrets (server only) — isi di panel Secrets AI Studio, JANGAN di kode/dokumen
LLM_BASE_URL=https://<alamat-9router-publik-anda>/v1
LLM_API_KEY=<key dari dashboard 9router>
LLM_MODEL=<nama model/combo 9router, cek GET /v1/models>
LLM_VISION_MODEL=<combo yang semua modelnya bisa membaca gambar; dipakai brief_extract saat ada foto>
LLM_SEND_EFFORT=on
TAVILY_API_KEY=<opsional, untuk riset tren & produk>
OWNER_EMAIL=<email Google owner>
# Firebase (diprovisikan AI Studio; config web Firebase memang publik, keamanan ada di Rules)
FIREBASE_PROJECT_ID=...
```

## 5. Urutan Pembangunan (setiap fase bisa diuji end-to-end)

| Fase | Isi | Milestone Gate |
| :--- | :--- | :--- |
| **0 Fondasi** | Scaffold AI Studio full-stack; Firebase Auth Google + allowlist; Firestore rules & indexes (`erd.md` §5–6); skema Zod `shared/schemas`; layar Brand + seed 1 brand + preset frasa terlarang; bottom nav; PWA manifest + share target | Login hanya bisa dengan email owner; brand tersimpan & tersinkron HP↔laptop; app bisa di-install di Android dan muncul di menu Share |
| **1 Mesin AI & Riset** | `llm.ts` (9router, logging, budget, gate, eskalasi, repair); `link-extractor` + Tavily `web-search`; foto → vision; route trend pulse, research+brief, angles, hooks; layar Tren | Produk (termasuk link yang diblokir) menghasilkan brief bersumber, 3–5 angle, 5+ hook tervalidasi Zod; `apiRuns` terisi dengan token & model yang menjawab |
| **2 Script & Produksi** | `scripts/generate` streaming + self-critique + audit; wizard langkah 5–6; Duration Pill; Copy VO; Teleprompter (wake lock, cermin, offline); Posting Pack; Share | Dari share link di HP sampai teleprompter berjalan tanpa error; durasi sesuai WPM; audit fidelity menangkap fitur karangan |
| **3 Iterasi & Belajar** | Revise sheet + 1-klik fix (versi baru); re-audit setelah edit manual; Riwayat; Bank Hook; Performance Log + winning patterns ke prompt; Viral References | Revisi membuat v+1 tanpa `apiRuns` research baru; skor & winning dihitung; pola winning muncul di prompt angle berikutnya |
| **4 Pelengkap (P2)** | Ide Konten; ekspor JSON Remotion; batch 3 script; layout laptop 3-pane + shortcut; APK TWA | Unit test skema Remotion lolos/menolak sesuai `erd.md` §7 |

### Prompt siap tempel untuk Google AI Studio Build
**Versi lengkap dan terbaru ada di `docs/fase-0.md` s.d. `docs/fase-4.md`** (daftar lampiran, prompt, checklist gate, troubleshooting).

Kode referensi teruji untuk Fase 1+ ada di `starter/server/ai/` (`llm.ts`, `prompts.ts`, `pricing.ts`), `starter/server/research/` (`link-extractor.ts`, `web-search.ts`), `starter/shared/quality-gates.ts`, `starter/shared/performance.ts`. Salin apa adanya.

Tempel **satu fase per kali** dan lampirkan keempat dokumen (`prd.md`, `erd.md`, `design.md`, `agent.md`). Uji gate sebelum lanjut.

## 6. Definition of Done (wajib sebelum menyatakan fase selesai)
1. `npx tsc --noEmit` dan lint bersih. Jika AI Studio tidak bisa menjalankannya, ekspor ke GitHub/ZIP lalu jalankan di laptop.
2. **Unit test** (Vitest) untuk:
   - skema Zod (contoh valid lolos, contoh tanpa `voiceoverText`/`brollCue` ditolak);
   - `duration.ts` (kata ÷ WPM);
   - fungsi skor performa;
   - `link-extractor` dengan mock 403/429/timeout → `blocked` tanpa throw.
3. **Uji fidelity:** hapus 1 fakta dari brief, minta script yang menyebut fitur itu, lalu pastikan audit menandai merah.
4. **Uji koneksi 9router:** `GET {LLM_BASE_URL}/models` dengan key → daftar model memuat `LLM_MODEL`; satu panggilan angle menulis `apiRuns` dengan `modelName` terisi. (Cache: catat `cacheReadTokens` bila provider melaporkannya; tidak wajib > 0.)
5. **Uji anggaran:** set budget $0.01 → generate ditolak dengan pesan jelas.
6. **Uji Android:** install PWA di HP, share link dari app marketplace, teleprompter tidak membuat layar mati, Back Android kembali ke langkah sebelumnya, tidak ada error konsol.
7. **Eval kualitas kecil** (sebelum mengubah prompt/effort):
   - 9 produk contoh (3 skincare, 3 gadget, 3 fashion) × rubrik 5 poin: hook kuat ≤ 3 dtk, tidak klise, 0 klaim karangan, CTA benar untuk TikTok **dan** Shopee, durasi sesuai target.
   - Jalankan 2 konfigurasi (`low`+eskalasi vs semua `medium`), catat skor dan biaya per script. Biaya eval ± US$2–3, **minta izin owner dulu**.
   - Perubahan prompt tidak boleh menurunkan skor.
8. **Uji eskalasi:** paksa gate gagal (mis. target durasi 10 detik), lalu pastikan tepat 1 panggilan `medium` dengan `escalatedFrom` terisi dan tidak ada loop.

## 7. Larangan
- Mock data di route produksi sebagai pengganti LLM.
- Menggabungkan riset + angle + script dalam 1 panggilan.
- Mengubah nama field `erd.md` atau kontrak JSON Remotion tanpa memperbarui dokumen lebih dulu.
- `catch` yang menelan error; setiap kegagalan harus terlihat sesuai `design.md` §8.
- Menyalin kalimat dari video viral orang lain. Yang boleh diambil hanya pola/struktur.
- Klaim produk yang tidak ada di `verifiedFacts`, klaim medis, dan urgensi palsu.
- Menambah dependency berat tanpa alasan (ponytail: pakai yang sudah ada: Firebase, Zod, SDK openai).

## 8. Boundaries
- **Always:** validasi Zod, log `apiRuns`, cek budget, simpan per tahap, tampilkan sumber tren/fakta.
- **Ask first:** mengubah skema, menambah vendor/API baru, mengganti model, mengubah Security Rules.
- **Never:** API key di client, scraping bypass anti-bot, auto-posting, menghapus versi script tanpa konfirmasi.
