# PRD — Affiliate Script Studio (Internal) — V1

**Versi dokumen:** 1.0 (ditulis ulang 2026-11-22; PRD lama tidak tersedia)
**Dokumen pendamping:** `erd.md`, `design.md`, `agent.md`, `audit.md`
**Platform build:** Google AI Studio (Build mode, full-stack web: React + Node.js server) → deploy Cloud Run → dipasang di Android sebagai PWA (opsional dibungkus APK lewat TWA).
**Model AI:** lewat **9router** (proxy OpenAI-compatible) dengan model/combo pilihan owner (secret `LLM_MODEL`), **hanya dipanggil dari server**. 9router harus punya URL publik HTTPS agar bisa dipanggil dari Cloud Run.

---

## 1. Objective

Aplikasi pribadi untuk satu affiliate creator (Anda) yang mengubah **link/foto/deskripsi produk** menjadi **naskah video affiliate siap rekam** — lengkap dengan hook 3 detik, alur adegan, shot list yang bisa direkam pakai HP, caption, hashtag, dan komentar tersemat — dengan menyesuaikan **pola yang sedang viral minggu ini**, bukan template statis.

### Masalah yang diselesaikan
| Masalah affiliate sehari-hari | Solusi di aplikasi |
| :--- | :--- |
| Bingung mulai dari hook apa | Hook Lab: 5+ hook 3 lapis (ucapan, visual, teks layar) berbasis tren terbaru |
| Script terasa template / "kayak iklan" | Anti-template audit + catatan pemakaian pribadi wajib + frasa terlarang |
| Tidak tahu format yang lagi naik | Trend Pulse: riset web real-time (format, gaya hook, momen kampanye) setiap generate |
| AI ngarang fitur produk → komplain & risiko akun | Verified Facts dikunci; setiap klaim harus punya sumber |
| Link marketplace diblokir bot | Fallback: foto produk (dibaca AI), deskripsi manual, riset web |
| Tidak tahu script mana yang benar-benar menjual | Performance Log → pola pemenang dipakai lagi di script berikutnya |
| Ribet pindah ke CapCut | Copy VO bersih, Teleprompter di HP, shot list, share ke app lain |

### Pengguna
1 orang (owner). Login Google dengan **allowlist 1 email**. Tidak ada multi-user, organisasi, billing, atau landing page.

### Definisi sukses (V1)
- Dari produk baru → script siap rekam dalam **≤ 3 menit** waktu tunggu total dan **≤ 6 tap** di HP.
- **0 fitur produk karangan**: setiap klaim spek di script terhubung ke `verifiedFacts` (diuji di audit).
- Biaya setara rata-rata **≤ US$0,20 per script lengkap** (riset + angle + hook + script + audit, effort `low` + eskalasi otomatis bila perlu), tercatat di `apiRuns`, dengan skor eval kualitas tidak lebih rendah dari baseline effort `medium` (lihat `agent.md` §6).
- Script yang dibuat minggu ini memuat **minimal 1 referensi tren bertanggal ≤ 7 hari** (dari Trend Pulse), atau menyatakan tegas bahwa tidak ada tren relevan.
- Bisa dipakai penuh dari Android (PWA terpasang di layar utama), termasuk berbagi link produk langsung dari aplikasi TikTok/Shopee ke aplikasi ini.

---

## 2. Alur Kerja Inti (Pipeline 6 Tahap)

Setiap tahap = 1 endpoint server, hasil **langsung disimpan ke Firestore** sebelum tahap berikutnya (bisa dilanjutkan jika timeout/HP tertutup).

```
[0] Trend Pulse ──┐
                  ├─► [1] Product Research & Brief ─► [2a] Angles ─► [2b] Hook Lab ─► [3] Script + Self-Critique + Audit ─► [4] Partial Revise (versi baru)
 Viral References ┘                                                                                                        │
                                                                                                                           ▼
                                                                                                           [5] Performance Log → Winning Patterns
```

### [0] Trend Pulse — "apa yang lagi viral"
- Input: kategori produk (mis. `skincare`, `gadget`, `rumah_tangga`, `fashion`), platform target, tanggal hari ini.
- Proses: server mencari di web lewat **Tavily Search API** (opsional, `TAVILY_API_KEY`), lalu LLM merangkum hasilnya. Yang dicari: format video yang naik minggu ini, pola hook yang sering muncul, sound/tren audio (nama saja, bukan file), momen kampanye (Payday tgl 25, 11.11, 12.12, Harbolnas, Ramadan), keluhan/pertanyaan pembeli yang ramai.
- Output: `trendSnapshots` per kategori+platform, **berlaku 24 jam** (cache supaya hemat). Tombol "Refresh tren" untuk paksa riset ulang.
- Setiap item tren wajib menyertakan `sourceUrl` + `observedAt`. Item tanpa sumber dibuang.
- **Viral References (manual):** Anda bisa menempel link/caption/transkrip video viral yang Anda lihat sendiri. LLM mengekstrak *pola*-nya (struktur hook, durasi, gaya visual) — **tidak menyalin kalimatnya** — dan menyimpannya sebagai pola yang bisa dipakai ulang.
- Catatan jujur: TikTok/Shopee tidak menyediakan API tren publik untuk dipakai bebas; riset tren berasal dari web publik + referensi yang Anda tempel. Kualitas tren = kualitas sumber web saat itu.

### [1] Product Research & Brief
- Input hybrid (minimal salah satu):
  - **Link produk** (dibagikan langsung dari app TikTok/Shopee lewat Share → aplikasi ini).
  - **Foto produk/kemasan/halaman produk** (screenshot) → dibaca oleh LLM vision (model 9router yang dipilih harus mendukung gambar).
  - **Deskripsi manual**.
  - **Catatan pemakaian pribadi** (wajib minimal 1 hal nyata yang disukai/tidak disukai).
  - Info affiliate: harga, harga coret, komisi %, voucher/promo, periode kampanye, platform utama.
- Ekstraksi link memakai fetch ringan dengan batas 8 detik. Jika 403/429/CAPTCHA/timeout → `scrapeStatus = 'blocked'`, **proses tetap lanjut** dengan foto + deskripsi + riset web.
- Riset web produk: ulasan, keluhan umum, perbandingan dengan alternatif.
- Output `briefs`: pain points, buying triggers, objections, competitor gaps, **verifiedFacts** (tiap fakta punya `source: user | photo | page | web` + `sourceUrl` bila ada), daftar klaim yang **tidak boleh** dipakai (mis. klaim medis).
- Brief bisa diedit inline sebelum lanjut. Setelah lanjut, `verifiedFacts` dikunci untuk versi script tersebut.

### [2a] Angle Brainstorming (3–5 opsi)
- Menggabungkan brief + trend snapshot + **winning patterns** akun Anda.
- Tiap angle: judul, gaya jual (`soft_sell_cinematic`, `educational`, `problem_solution`, `storytelling`, `hard_sell`, `honest_review`, `comparison`), **format video** (lihat §3), tingkat awareness audiens, alasan cocok, **tren yang dipakai** (link ke item tren), dan **kebutuhan rekaman** (wajah tampil/tidak, butuh produk fisik, butuh lokasi).

### [2b] Hook Lab (5+ hook)
- Tiap hook 3 lapis sinkron: **ucapan** (≤ 12 kata), **visual 3 detik pertama**, **teks layar** (≤ 6 kata).
- Tipe psikologi: `pattern_interrupt`, `relatable_pain`, `contrarian`, `proof_first`, `curiosity_gap`, `price_shock`, `social_proof`, `pov`.
- Setiap hook menyebut pola tren yang menginspirasinya (jika ada). Hook bisa difavoritkan → masuk bank hook lintas produk.

### [3] Script + Self-Critique + Audit
- Output naskah per adegan (`scenes[]`): role (`hook`, `agitate`, `proof`, `demo`, `objection_handle`, `offer`, `cta`), durasi, teks VO, teks layar, **shot list yang bisa direkam pakai HP** (angle kamera, gerakan, properti), cue B-roll, SFX, transisi.
- Paket posting **per platform** (selalu dua: TikTok & Shopee): **caption** (TikTok ≤ 150 karakter; Shopee versi lebih panjang dengan info promo/voucher), **hashtag** (3–6, campuran niche + tren), **komentar tersemat**, dan **varian adegan CTA** (TikTok: keranjang kuning; Shopee Video: tombol produk). Adegan selain CTA sama untuk kedua platform, jadi cukup rekam sekali, lalu ganti klip CTA saja.
- Durasi dihitung dari jumlah kata VO ÷ `voiceoverWpm` brand. Target default 25–40 detik (bisa diubah per script).
- **Self-critique** (dalam pipeline, bukan ke pengguna): LLM menilai draft terhadap rubrik (hook kuat di 3 detik, tidak klise, semua klaim ada di verifiedFacts, CTA jelas, sesuai durasi) lalu memperbaiki sekali.
- **Audit** (tampil ke pengguna), 3 kategori:
  1. **Anti-template:** frasa terlarang + klise affiliate ("racun banget", "wajib checkout", "auto glowing", dst. — daftar dapat diedit).
  2. **Kepatuhan platform:** klaim berlebihan/absolut tanpa bukti, klaim medis/kesehatan, perbandingan merek yang menjatuhkan, urgensi palsu ("stok tinggal 1" tanpa data), produk yang butuh izin edar (kosmetik/suplemen/pangan: ingatkan cek nomor BPOM). *Daftar aturan adalah checklist internal; aturan resmi TikTok Shop/Shopee berubah — owner wajib cek ulang kebijakan terbaru.*
  3. **Product fidelity:** setiap klaim spek dicocokkan ke `verifiedFacts`; klaim tanpa pasangan = merah.
- Tiap temuan punya saran perbaikan + tombol **Terapkan (1 klik)** → membuat versi baru.

### [4] Partial Revise
- Revisi satu adegan / ganti hook / ubah tone / perpendek durasi → **versi baru** (`versionNo + 1`), versi lama tetap ada, **tanpa** mengulang riset.
- Quick chips: `Lebih santai`, `Lebih singkat (-30%)`, `Lebih hard-sell`, `Visual lebih sinematik`, `Hapus kesan iklan`, `Ganti ke faceless`, + 1 baris instruksi bebas.

### [5] Performance Log → Winning Patterns
- Setelah posting, Anda isi angka sederhana per script: link video, tanggal posting, views, likes, komentar, klik produk, jumlah terjual, komisi (Rp). Semua opsional kecuali tanggal.
- Sistem menghitung skor sederhana (mis. terjual per 1.000 views) dan menandai **top 20% script** sebagai *winning*.
- Pola dari script winning (tipe hook, format, durasi, gaya jual, kategori) diringkas dan **disuntikkan ke prompt Angle & Hook** berikutnya sebagai "yang terbukti berhasil di akun ini".

---

## 3. Format Video yang Didukung

| Kode | Format | Butuh wajah? | Cocok untuk |
| :--- | :--- | :--- | :--- |
| `talking_head` | Bicara ke kamera | Ya | Review jujur, edukasi |
| `faceless_vo` | Tangan + produk + voiceover | Tidak | Semua kategori, paling cepat diproduksi |
| `pov` | POV skenario sehari-hari | Opsional | Relatable pain |
| `before_after` | Sebelum vs sesudah | Opsional | Skincare, kebersihan, organizer (hanya jika hasil nyata) |
| `unboxing_first_impression` | Buka paket + kesan pertama | Opsional | Gadget, fashion |
| `comparison` | Bandingkan 2–3 opsi | Opsional | Gadget, rumah tangga (tanpa menjatuhkan merek) |
| `tutorial_demo` | Cara pakai langkah demi langkah | Tidak | Alat, dapur, beauty tools |
| `grwm_routine` | Get ready / rutinitas | Ya | Fashion, beauty |
| `listicle` | "3 barang yang…" | Tidak | Bundle beberapa produk affiliate |

---

## 4. Kebutuhan Fungsional (ringkas, dengan ID)

| ID | Kebutuhan | Prioritas |
| :--- | :--- | :--- |
| F-01 | Login Google + allowlist 1 email; semua data per owner | P0 |
| F-02 | CRUD Brand DNA (persona, tone, audiens, estetika visual, WPM 110–180, frasa terlarang, pilar konten, platform utama) | P0 |
| F-03 | Input produk hybrid (link, foto ≤ 5, deskripsi, catatan pribadi, harga, komisi, promo) | P0 |
| F-04 | Web Share Target: share link dari app lain langsung membuka form produk terisi | P0 |
| F-05 | Trend Pulse dengan cache 24 jam + refresh manual + sumber wajib | P0 |
| F-06 | Brief riset dengan verifiedFacts bersumber, bisa diedit | P0 |
| F-07 | 3–5 angle + 5+ hook tervalidasi skema | P0 |
| F-08 | Script per adegan + paket posting + durasi otomatis | P0 |
| F-09 | Audit 3 kategori + 1-klik perbaikan | P0 |
| F-10 | Versioning non-destruktif + pemilih versi | P0 |
| F-11 | Copy VO bersih, Teleprompter (layar tetap menyala, kecepatan sesuai WPM), Share (Web Share API) | P0 |
| F-12 | Log biaya per panggilan AI + total bulan ini + **batas anggaran bulanan** (blokir generate jika lewat) | P0 |
| F-13 | Viral References manual | P1 |
| F-14 | Performance Log + Winning Patterns | P1 |
| F-15 | Bank hook favorit lintas produk | P1 |
| F-16 | Content Ideas mingguan (pilar branding, tanpa harus terikat produk) | P2 |
| F-17 | Ekspor JSON Remotion v1.0 | P2 |
| F-18 | Batch: 3 script dari 3 angle sekaligus untuk A/B test | P2 |

## 5. Kebutuhan Non-Fungsional
- **Keamanan:** `LLM_API_KEY` (key 9router) dan `TAVILY_API_KEY` hanya di Secrets server AI Studio/Cloud Run. Firestore Security Rules: baca/tulis hanya jika `request.auth.token.email` = email owner. Server memverifikasi Firebase ID token di setiap request.
- **Kinerja:** halaman pertama terbuka < 2,5 detik di 4G; streaming teks script mulai < 5 detik setelah tombol ditekan.
- **Ketahanan:** setiap tahap idempoten dan bisa dilanjutkan; error tidak pernah ditelan diam-diam (status pemulihan terlihat di UI).
- **Biaya:** prompt caching pada blok statis; Trend Pulse di-cache 24 jam; batas `max_uses` web search per tahap.
- **Aksesibilitas:** kontras ≥ 4.5:1, target sentuh ≥ 44px, ukuran teks VO ≥ 16px.
- **Bahasa:** UI dan output Bahasa Indonesia (gaya santai sesuai persona); istilah teknis boleh Inggris.

## 6. Success Criteria (teruji)
1. Produk dengan link yang diblokir tetap menghasilkan brief lengkap dengan `scrapeStatus = 'blocked'` dan banner kuning, tanpa dialog error.
2. Script yang menyebut fitur yang tidak ada di `verifiedFacts` selalu memunculkan temuan merah di audit (uji dengan fakta sengaja dihapus).
3. Revisi 1 adegan membuat `versionNo + 1`, versi lama identik byte-per-byte, dan tidak ada panggilan tahap research baru di `apiRuns`.
4. Setiap panggilan LLM tercatat di `apiRuns` dengan token, `modelName` yang menjawab, dan estimasi biaya.
5. Trend snapshot berumur < 24 jam dipakai ulang (tidak ada `apiRuns` stage `trend_pulse` baru); tombol refresh membuat yang baru.
6. Saat total biaya bulan ini ≥ batas anggaran, tombol generate nonaktif dengan pesan jelas.
7. Di Android: PWA bisa di-install, muncul di menu Share, teleprompter tidak membuat layar mati.

## 7. Out of Scope (Deferred)
- Multi-user, tim, billing, landing page — aplikasi internal.
- Auto-posting ke TikTok/Shopee — butuh akses API resmi & berisiko akun.
- Scraping TikTok/Shopee skala besar atau melewati anti-bot — melanggar ToS; diganti riset web + referensi manual.
- Generate video/voice otomatis (TTS, render Remotion di server) — V2; V1 cukup ekspor JSON.
- Aplikasi Android native (Kotlin) — mode Android AI Studio tidak bisa memakai secrets server; V1 memakai PWA/TWA.
- Analitik otomatis dari TikTok/Shopee — V1 input manual.

## 8. Keputusan Owner (dijawab 2026-11-22)
| Topik | Keputusan | Dampak ke produk |
| :--- | :--- | :--- |
| Platform | **TikTok Shop & Shopee Video sama berat** | Satu naskah VO + **dua varian** adegan CTA, caption, hashtag, dan komentar tersemat (TikTok & Shopee). Durasi target default 25–40 detik (aman untuk keduanya), bisa diubah per script |
| Kategori | **Skincare & beauty, Gadget & elektronik, Fashion** | Preset Trend Pulse 3 kategori ini. Skincare otomatis mengaktifkan cek BPOM + larangan klaim medis/"menyembuhkan"/"permanen" yang lebih ketat |
| Gaya rekaman | **Campur (wajah & faceless)** | Tidak ada format default; AI memilih format per angle dan **wajib** menampilkan label kebutuhan rekaman. Minimal 1 dari angle yang ditawarkan selalu bisa direkam faceless |
| Anggaran | **Sehemat mungkin: effort `low` (reasoning tetap aktif bila model mendukung), tapi tetap cerdas** | Semua tahap mulai di effort `low`. Tahap dinaikkan otomatis 1 tingkat **hanya** jika pemeriksaan kualitas gagal (lihat `agent.md` §3.4). Batas anggaran bulanan tetap ada sebagai pengaman (default US$10, bisa diubah di Brand) |

## 9. Open Questions
1. Di mana 9router dijalankan agar punya URL publik HTTPS (VPS/Docker/tunnel)? Model/combo apa yang dipakai (`GET /v1/models`)? Sudah punya akun Google Cloud dengan billing?
2. Angka batas anggaran pasti per bulan? (default sementara US$10)
