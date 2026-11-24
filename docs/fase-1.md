# Fase 1 — Mesin AI & Riset

Tujuan: dari produk (link, foto, atau deskripsi) aplikasi menghasilkan **brief bersumber → 3–5 angle → 6 hook** yang mengikuti tren minggu ini. AI dipanggil lewat **9router**, dan setiap panggilan tercatat.

Syarat: gate Fase 0 sudah lulus.

## A. Persiapan (± 20 menit)

### 1. 9router harus bisa dijangkau dari internet
**Pilihan owner: VPS + Docker.** Ikuti `docs/deploy-9router-vps.md` (file siap pakai di `deploy/9router/`), lalu langsung ke langkah 2 di bawah.

Server aplikasi berjalan di Cloud Run (Google), bukan di laptop Anda. Cloud Run **tidak bisa** memanggil `http://localhost:20128` di laptop. Pilih salah satu:

| Opsi | Cocok jika | Catatan |
| :--- | :--- | :--- |
| **VPS / Docker** (image `decolua/9router`) | Ingin selalu online | Jalankan dengan `HOSTNAME=0.0.0.0`, pasang HTTPS (mis. Caddy/Nginx), aktifkan `REQUIRE_API_KEY` |
| **Tunnel dari laptop** (Cloudflare Tunnel / ngrok) | Uji coba cepat | Aplikasi hanya jalan saat laptop & 9router menyala |

Hasilnya satu URL publik HTTPS, mis. `https://9router.domainanda.com/v1`. Uji dari HP (data seluler, bukan Wi-Fi rumah):
```powershell
curl.exe https://ALAMAT-9ROUTER-ANDA/v1/models -H "Authorization: Bearer KEY-9ROUTER-ANDA"
```
Respons berisi daftar model. Pilih satu nama model atau combo (mis. `cc/claude-sonnet-4-6`). Model itu harus bisa membaca **gambar** (untuk foto produk) dan cukup pintar menulis JSON panjang.

### 2. Tavily (opsional, untuk tren & riset produk)
Daftar di **tavily.com**, ambil API key (ada kuota gratis bulanan). Tanpa key ini aplikasi tetap jalan, tapi layar Tren akan berkata "tidak ada tren terverifikasi" dan brief hanya dari input Anda + foto.

### 3. Secrets di AI Studio (ikon kunci). Jangan tulis nilai ini di prompt, dokumen, atau kode.
| Nama | Isi |
| :--- | :--- |
| `LLM_BASE_URL` | URL publik 9router, diakhiri `/v1` |
| `LLM_API_KEY` | key dari dashboard 9router |
| `LLM_MODEL` | nama model/combo dari langkah 1 (Anda: `AdheRouter`) |
| `LLM_VISION_MODEL` | combo yang semua modelnya bisa membaca gambar (mis. `AdheVision`) |
| `LLM_SEND_EFFORT` | `on` |
| `TAVILY_API_KEY` | key Tavily (opsional) |
| `OWNER_EMAIL` | sudah diisi di Fase 0 |

### 4. Lampiran
Tidak ada lampiran baru. Semua file (`llm.ts`, `prompts.ts`, `pricing.ts`, `link-extractor.ts`, `web-search.ts`, `quality-gates.ts`, `performance.ts`, dll.) sudah dibuat dari `starter-bundle.md` di Fase 0. Jika ternyata belum ada, lampirkan lagi `ai-studio-upload/starter-bundle.md`.

## B. Prompt untuk ditempel
```
Lanjutkan ke Fase 1 "Mesin AI & Riset" di agent.md §5. Fase 0 sudah selesai, jangan ubah yang sudah jalan.

AI WAJIB lewat 9router (API OpenAI-compatible) memakai SDK "openai". JANGAN memakai Gemini / @google/genai dalam bentuk apa pun.

1. Dependency server: "openai" ^7.62.0.
2. File server/ai/llm.ts, server/ai/prompts.ts, server/ai/pricing.ts, server/research/link-extractor.ts, server/research/web-search.ts, shared/quality-gates.ts, shared/performance.ts sudah ada dari starter-bundle.md (Fase 0). Pastikan isinya masih PERSIS sama dengan bundle; jika belum ada, buat dari bundle. Jangan menulis ulang isinya. Route tidak boleh memanggil SDK langsung; semua lewat createLlm() di llm.ts.
3. server/db/admin.ts: firebase-admin dengan db.settings({ ignoreUndefinedProperties: true }). Helper:
   - logRun(run): tulis koleksi apiRuns + createdAt serverTimestamp.
   - assertWithinBudget(ownerUid): jumlahkan estCostUsd apiRuns milik owner dengan monthKey = monthKeyJakarta(); jika >= appConfig/owner.monthlyBudgetUsd, lempar BudgetExceededError dari llm.ts.
   Buat satu instance:
   createLlm({
     client: new OpenAI({ baseURL: process.env.LLM_BASE_URL, apiKey: process.env.LLM_API_KEY }),
     model: process.env.LLM_MODEL,
     sendEffort: process.env.LLM_SEND_EFFORT !== "off",
     webSearch: process.env.TAVILY_API_KEY ? createTavilySearch(process.env.TAVILY_API_KEY) : undefined,
     logRun, assertWithinBudget })
   Saat server start, jika LLM_BASE_URL/LLM_API_KEY/LLM_MODEL kosong, log error jelas dan route AI membalas 503 "Konfigurasi 9router belum diisi".
4. System prompt = buildSystemPrompt(brand) dari prompts.ts, dibangun dari dokumen brand aktif setiap panggilan. Data per panggilan masuk ke content sebagai gabungan blok: productBlock, factsBlock, trendBlock, winningBlock (sementara string kosong), lalu tugas.
5. Route server (semua memverifikasi Firebase ID token + OWNER_EMAIL, semua menyimpan hasil ke Firestore sebelum merespons):
   a. POST /api/trends/pulse {category, platform, force?}: jika ada trendSnapshots < 24 jam untuk category+platform dan force bukan true, kembalikan itu tanpa memanggil AI. Jika tidak: llm.research({queries: trendQueries(category, platform, tanggal hari ini WIB), prompt: trendResearchTask(...)}) lalu llm.generate(schema TrendPulseOut, content trendExtractTask(hasil.text)). Jika research.text kosong (tanpa Tavily), simpan snapshot dengan items [] tanpa memanggil generate. Buang item tanpa sourceUrl. Jika item < 3 dan ada hasil search, ulangi research+extract SEKALI dengan effort "medium". Simpan trendSnapshots dengan observedAt dan expiresAt +24 jam.
   b. POST /api/products/:id/research: jika product.sourceUrl ada, jalankan extractProductPage(); simpan scrapeStatus (success/blocked) dan scrapedSpecs. Lalu llm.research({queries: productQueries(name, category), prompt: productResearchTask(...)}), lalu llm.generate(schema BriefOut, stageName "brief_extract", content = [{type:"text", text: productBlock + briefExtractTask(research.text, gabungan forbiddenClaimsPreset "all" + kategori dari seed)}, ...foto produk dari Storage sebagai {type:"image_url", image_url:{url:"data:<mime>;base64,..."}}], model: jika ada foto dan process.env.LLM_VISION_MODEL terisi, pakai LLM_VISION_MODEL). Simpan briefs dengan rawSources = research.sources, trendSnapshotId = snapshot terbaru kategori itu. Link diblokir TIDAK boleh menghentikan proses.
   c. PATCH /api/briefs/:id: owner mengedit brief; validasi skema Brief, set editedByOwner = true. Tolak jika factsLocked.
   d. POST /api/briefs/:id/angles: llm.generate(schema AnglesOut, stageName "angles", content = productBlock + factsBlock + trendBlock(item snapshot) + winningBlock + anglesTask(issues), gate = d => gateAngles(d, {faceMode: brand.faceMode, trendItemIds: item snapshot dipetakan ke "t1".."tn"})). Simpan setiap angle ke koleksi angles.
   e. POST /api/angles/:id/hooks: llm.generate(schema HooksOut, stageName "hooks", content = productBlock + factsBlock + trendBlock + angleBlock(angle) + hooksTask(hook favorit owner, issues), gate = d => gateHooks(d, {bannedPhrases: brand.bannedPhrases})). Simpan ke koleksi hooks.
   f. GET /api/usage/month: total estCostUsd bulan ini + monthlyBudgetUsd (untuk pill biaya di top bar).
   Pemetaan error: BudgetExceededError -> 402, RefusedError -> 422, InvalidOutputError -> 502 (UI tampilkan "Coba lagi"), OpenAI.RateLimitError -> 429, OpenAI.APIConnectionError -> 503 "9router tidak bisa dihubungi", OpenAI.APIError -> 502. Pesan error dalam Bahasa Indonesia. Jangan menelan error.
   Setiap respons menyertakan { escalated } dari generate() agar UI bisa menampilkan badge.
6. UI sesuai design.md:
   - Studio langkah 1 Produk: form input hybrid (link, foto ≤ 5 ke Storage, deskripsi, catatan pribadi WAJIB, harga, harga coret, komisi, promo). /studio/new yang menerima share link langsung mengisi field link.
   - Langkah 2 Brief: pain points, triggers, objections, verifiedFacts beserta badge sumber dan link; bisa diedit via PATCH. Banner kuning jika scrapeStatus = blocked.
   - Langkah 3 Angle: kartu angle dengan badge kebutuhan rekaman (wajah/faceless, butuh produk fisik) dan chip tren yang dipakai (klik membuka sumber).
   - Langkah 4 Hook Lab: 6 hook tiga lapis (ucapan, visual, teks layar), tombol favorit (isFavorite).
   - Layar Tren: tab 3 kategori (skincare_beauty, gadget_elektronik, fashion), toggle TikTok/Shopee, umur snapshot, tombol "Refresh tren", setiap item menampilkan link sumber; pesan jujur jika tidak ada tren.
   - Pill biaya di top bar membaca /api/usage/month. Badge kecil "dinaikkan ke medium" jika escalated.
   - Skeleton loading per langkah; tombol generate nonaktif dengan pesan jika anggaran habis (402) atau 9router tidak terjangkau (503).
7. Jalankan semua test vitest (tests/schemas.test.ts dan tests/pipeline.test.ts). Semua harus lulus.

JANGAN: memakai Gemini, menggabungkan riset+angle+hook dalam 1 panggilan, memakai response_format/tools OpenAI, menaruh key 9router/Tavily di client atau kode, mengubah nama field erd.md, atau membuat data mock di route.
```

## C. Cek Kelulusan
- [ ] Test vitest lulus semua (50 test: 16 skema + 34 pipeline).
- [ ] Produk dengan link Shopee/TikTok yang diblokir tetap menghasilkan brief, dengan banner kuning dan tanpa dialog error.
- [ ] Produk hanya dengan foto kemasan menghasilkan verifiedFacts bersumber `photo`.
- [ ] Setiap fakta `web` punya link sumber yang bisa diklik (butuh Tavily).
- [ ] Muncul 3–5 angle; minimal 1 bisa direkam faceless.
- [ ] Muncul 6 hook, ucapan ≤ 12 kata, tanpa frasa terlarang.
- [ ] Firebase Console → `apiRuns`: setiap panggilan tercatat (stageName, effort, modelName, estCostUsd).
- [ ] **Uji tren cache:** buka layar Tren dua kali → tidak ada `apiRuns` `trend_pulse` baru. Tombol Refresh membuat yang baru.
- [ ] **Uji anggaran:** ubah budget di Brand ke `0.01` → generate ditolak dengan pesan jelas. Kembalikan ke 10.
- [ ] **Uji 9router mati:** matikan 9router/tunnel sebentar → aplikasi menampilkan "9router tidak bisa dihubungi", bukan layar putih.

## D. Jika ada masalah
| Gejala | Penyebab | Tindakan |
| :--- | :--- | :--- |
| `APIConnectionError` / 503 | `LLM_BASE_URL` masih `localhost`, tunnel mati, atau tanpa `/v1` | Pakai URL publik HTTPS yang lolos tes `curl` di bagian A |
| 401 dari 9router | Key salah atau `REQUIRE_API_KEY` beda | Cek secret `LLM_API_KEY` vs dashboard 9router |
| 400 menyebut `reasoning_effort` | Provider di belakang 9router tidak mendukungnya | Ubah secret `LLM_SEND_EFFORT` ke `off` |
| `InvalidOutputError` berulang | Model terlalu kecil untuk JSON panjang | Ganti `LLM_MODEL` ke model yang lebih kuat |
| Foto tidak terbaca | Model tidak mendukung gambar | Pilih model vision di 9router |
| Tren selalu kosong | `TAVILY_API_KEY` kosong atau kuota habis | Isi/cek key Tavily |
| Firestore error "Cannot use undefined" | `ignoreUndefinedProperties` belum aktif | Minta agent menambah `db.settings({ ignoreUndefinedProperties: true })` |
| Agent memakai Gemini | Default AI Studio | Balas: "Hapus Gemini. Semua AI lewat server/ai/llm.ts (9router)." |

Setelah semua tercentang: buka `docs/fase-2.md`.
