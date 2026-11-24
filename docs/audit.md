# Audit Kesiapan Build — Affiliate Script Studio V1

> **Perubahan 2026-11-23:** LLM diganti dari Anthropic API langsung ke **9router** (OpenAI-compatible). Riset web memakai Tavily. Baris yang menyebut Claude/Anthropic di bawah adalah catatan sejarah; acuan terbaru ada di `agent.md` §3–4 dan `fase-1.md`.

**Tanggal:** 2026-11-22 · **Cakupan:** `prd.md`, `erd.md`, `design.md`, `agent.md`
**Vonis:** **Siap mulai dibangun (Fase 0–1), belum "sempurna".** Spesifikasi konsisten dan bisa dikerjakan per fase di Google AI Studio. Ada 5 hal yang **wajib diverifikasi saat build** (tidak bisa dipastikan dari atas kertas) dan 5 pertanyaan terbuka untuk Anda.

## 1. Masalah di dokumen lama yang sudah diperbaiki
| # | Masalah lama | Dampak | Perbaikan |
| :--- | :--- | :--- | :--- |
| 1 | PRD tidak ada (dirujuk, file hilang) | Agent tidak punya kebutuhan fungsional | `prd.md` baru, lengkap dengan ID fitur & success criteria teruji |
| 2 | SQLite `better-sqlite3` + Next.js | **Tidak bisa jalan di Android**, tidak sinkron HP↔laptop, tidak cocok dengan AI Studio | Firestore + Firebase Auth (diprovisikan AI Studio), server Node bawaan AI Studio |
| 3 | Model `claude-sonnet-4-20250514` | Model lama | `claude-sonnet-5-5` ($2/$10 per 1M token) |
| 4 | Tavily/Brave/Serper terpisah | Vendor & API key tambahan | Tool `web_search_20260209` milik Claude (server-side) |
| 5 | Riset + JSON dalam satu panggilan (tersirat) | Structured output **tidak kompatibel** dengan citations hasil web search → error | Riset (web search, teks + sumber) dan ekstraksi JSON (`messages.parse`) dipisah |
| 6 | Desain desktop-first 3-pane | Tidak nyaman di HP | Wizard 6 langkah mobile-first; 3-pane tetap untuk laptop |
| 7 | Tombol biru `#3B82F6` + teks putih | Kontras 3.68:1, **gagal WCAG** | `#2563EB` (5.17:1); teks di atas amber wajib gelap |
| 8 | Tidak ada mekanisme "ikut tren" | Script statis/template | Trend Pulse (cache 24 jam, sumber wajib) + Viral References + momen kampanye |
| 9 | Tidak ada umpan balik penjualan | Tidak belajar dari yang laku | Performance Log → winning patterns masuk ke prompt |
| 10 | Tidak ada kontrol biaya | Tagihan bisa membengkak | Batas anggaran bulanan + pill biaya |
| 11 | Hanya link/deskripsi | Link marketplace sering diblokir | Foto produk dibaca Claude vision + Web Share Target dari app marketplace |
| 12 | Output hanya script | Masih harus menulis caption sendiri | Posting Pack: caption, hashtag, komentar tersemat, CTA per platform, shot list HP |

## 2. Inkonsistensi yang ditemukan & diperbaiki saat audit
- Rules `scripts` mengizinkan client mengubah status ke `ready` tanpa audit. Sekarang `ready` hanya bisa diset server; client hanya bisa `ready → recorded → posted`.
- `design.md` menulis brief langsung ke Firestore, bertentangan dengan rules. Sekarang lewat `PATCH /api/briefs/:id` agar kunci fakta ditegakkan server.
- `monthKey` anggaran memakai UTC → total bulan bisa meleset 7 jam. Sekarang Asia/Jakarta.

## 3. Wajib diverifikasi saat build (risiko teknis)
| # | Hal | Kenapa belum pasti | Cara cek | Jika gagal |
| :--- | :--- | :--- | :--- | :--- |
| V1 | AI Studio Build mau memakai SDK `openai` ke 9router dan membaca secret di server | Agent AI Studio cenderung memakai Gemini | Fase 1: 1 panggilan angle menulis `apiRuns.modelName` dari 9router | Ekspor ke GitHub, lanjutkan di editor lokal, deploy Cloud Run manual |
| V2 | 9router terjangkau dari Cloud Run | Default 9router hanya `localhost`; butuh VPS/Docker/tunnel HTTPS | `curl {LLM_BASE_URL}/models` dari luar jaringan rumah | Jalankan 9router di VPS (Docker `decolua/9router`) |
| V3 | Model 9router patuh JSON panjang + membaca gambar | Tanpa structured outputs native, JSON hanya dijaga prompt + Zod + 1 repair | Eval kecil Fase 4; pantau `status = repaired/failed` di `apiRuns` | Ganti `LLM_MODEL` ke model lebih kuat |
| V4 | Kualitas Trend Pulse | Tidak ada API tren resmi TikTok/Shopee; hasil Tavily bergantung pada artikel web publik | 5× Trend Pulse lintas kategori, cek tanggal sumber | Andalkan Viral References manual + winning patterns akun sendiri |
| V5 | `reasoning_effort` diteruskan 9router ke provider | Tidak terdokumentasi | Lihat error 400 di Fase 1 | Secret `LLM_SEND_EFFORT=off`; gate & eskalasi tetap jalan |

Risiko operasional lain:
- **Cold start Cloud Run:** request pertama setelah lama tidak dipakai bisa lambat beberapa detik. Pilihannya diterima, atau set min-instance 1 (berbayar).
- **Biaya Google Cloud:** Firestore/Storage/Cloud Run ditagih terpisah dari Anthropic. Untuk 1 pengguna biasanya kecil, tapi butuh billing account aktif bila melewati kuota gratis.
- **Kebijakan platform:** checklist audit kepatuhan adalah aturan internal, **bukan** salinan kebijakan resmi TikTok Shop/Shopee yang bisa berubah. Cek ulang secara berkala.

## 4. Estimasi biaya per script lengkap (Sonnet 5.5 effort `low` + eskalasi, perkiraan kasar)
Harga: input $2/1M, output $10/1M, cache read $0.10/1M. Effort `low` terutama memangkas token *thinking* (dibayar sebagai output).
| Tahap | Input token | Output token | Perkiraan |
| :--- | :--- | :--- | :--- |
| Trend Pulse (dibagi ~10 script karena cache 24 jam) | ~12k | ~2k | ≈ $0.044 ÷ 10 |
| Riset produk | ~12k | ~2k | ≈ $0.044 |
| Ekstraksi brief | ~6k | ~1.5k | ≈ $0.027 |
| Angles + Hooks | ~10k | ~2.5k | ≈ $0.045 |
| Script (2 varian CTA & caption) | ~8k | ~3k | ≈ $0.046 |
| Audit | ~5k | ~1k | ≈ $0.020 |
| Eskalasi `medium` (asumsi ~1 dari 4 script) | | | ≈ +$0.015 |
| **Total** | | | **≈ $0.15–0.20 + biaya web search** (≈ Rp2.500–3.300) |
Pembanding: konfigurasi semua `medium`/`high` ≈ $0.25. Dengan batas US$10/bulan → ± 50–60 script lengkap. Revisi parsial jauh lebih murah (± $0.02–0.03, tanpa riset ulang). **Angka ini tebakan terdidik**; konfirmasi dari `apiRuns` setelah Fase 1.

**Risiko effort `low`:** kualitas penulisan kreatif (hook, script) bisa turun dibanding `medium`. Mitigasi: quality gate + eskalasi otomatis (`agent.md` §3.4) dan eval perbandingan sebelum rilis (`agent.md` §6.7). Jika eval menunjukkan `low` kalah, hanya tahap yang kalah dinaikkan.

## 5. Keputusan owner & sisa pertanyaan
Sudah diputuskan (lihat `prd.md` §8):
- Platform: TikTok Shop + Shopee Video sama berat (dual CTA/caption).
- Kategori: skincare & beauty, gadget & elektronik, fashion.
- Gaya rekaman: campur.
- Effort: `low` + thinking adaptif + eskalasi otomatis; batas anggaran default US$10.

Masih terbuka:
1. Di mana 9router dijalankan (VPS/tunnel) dan model/combo apa yang dipakai? Sudah punya akun Google Cloud dengan billing?
2. Angka batas anggaran pasti per bulan (sementara US$10)?

## 6. Jalan terbaik membangun (rekomendasi)
1. **Siapkan:** 9router dengan URL publik HTTPS + key, (opsional) key Tavily, dan akun Google untuk AI Studio + Firebase.
2. **Fase 0 di AI Studio Build:** tempel prompt Fase 0 dari `agent.md` §5 dan lampirkan 4 dokumen. Uji gate: login, brand tersimpan, PWA bisa di-install di HP.
3. **Fase 1:** paling berisiko (V1–V3). Kerjakan dan verifikasi sebelum membangun UI script.
4. **Fase 2:** setelah ini aplikasi sudah **bisa dipakai harian** (share link → script → teleprompter → posting pack).
5. **Pakai 1–2 minggu**, isi Performance Log, baru kerjakan Fase 3 (belajar dari data).
6. **Rencana cadangan:** jika agent AI Studio terus mengganti Claude dengan Gemini atau gagal memasang SDK, ekspor proyek ke GitHub dan lanjutkan di Claude Code dengan dokumen yang sama. Spesifikasi ini tidak bergantung pada AI Studio.

## 7. Skills yang dipakai dalam penyusunan
- `superpowers:brainstorming` — pola tanya dulu sebelum mendesain: 4 keputusan arsitektur ditanyakan.
- `agent-skills:spec-driven-development` — struktur objective/boundaries/success criteria/out of scope.
- `claude-api` — model ID, harga, web search tool, structured outputs, fallback, caching yang terkini.
- `ui-ux-pro-max` — checklist mobile UX & aksesibilitas, verifikasi kontras.
- `ponytail` (lite) — scope dipangkas: 1 vendor AI, tanpa Tavily, Remotion & ide konten jadi P2, adegan disimpan di dokumen script.

**Skill untuk tahap berikutnya:**
- `superpowers:writing-plans` / `agent-skills:planning-and-task-breakdown` — memecah tiap fase menjadi tugas.
- `impeccable` + `agent-skills:accessibility-engineering` — audit UI setelah Fase 2.
- `superpowers:test-driven-development` — unit test di Definition of Done.
- `archify` — diagram arsitektur bila dibutuhkan.

> Belum dicek oleh reviewer independen. Disarankan meminta review ulang (mis. `agent-skills:doubt-driven-development`) sebelum Fase 1.
