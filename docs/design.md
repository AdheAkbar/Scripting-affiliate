# Design Spec — Affiliate Script Studio — V1

**Target utama:** Android (PWA terpasang, layar 360–430px), lalu laptop (≥ 1200px).
**Stack UI:** React + TypeScript + Tailwind CSS + shadcn/ui + Lucide Icons (sesuai yang dihasilkan Google AI Studio Build).
**Dokumen pendamping:** `prd.md`, `erd.md`, `agent.md`

> Perubahan besar dari versi lama: versi lama **desktop-first 3-pane**. Karena aplikasi dipakai terutama di HP, V1 menjadi **mobile-first wizard**. Tata letak 3-pane tetap dipakai di layar ≥ 1200px.

## 1. Prinsip
1. **Phone-first, one-thumb:** aksi utama selalu di zona bawah layar, bisa dijangkau satu jempol.
2. **Transparan, bukan kotak hitam:** setiap angle/hook menunjukkan *kenapa* dipilih dan *tren mana* yang dipakai (dengan link sumber).
3. **Riset ke rekam dalam 1–2 tap:** Copy VO, Teleprompter, dan Share selalu terlihat di layar script.
4. **Iterasi non-destruktif:** setiap revisi = versi baru; pemilih versi selalu terlihat.
5. **Dark-first** (dipakai malam hari, selaras dengan CapCut), dengan light mode sebagai opsi.

## 2. Design Tokens (dark default)

Kontras sudah dihitung (WCAG 2.x). Dua token lama **diperbaiki** karena gagal 4.5:1.

| Token | Hex | Pakai untuk | Kontras |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#0E1013` | latar app | — |
| `--bg-surface` | `#15181E` | panel, layar | — |
| `--bg-elevated` | `#1D212A` | kartu adegan/angle/hook, sheet | — |
| `--border-subtle` | `#272C37` | pemisah dekoratif saja | 1.27:1 (dekoratif, OK) |
| `--border-control` | *(pilih, wajib ≥ 3:1 vs surface)* | border input, chip, toggle | WCAG 1.4.11 |
| `--text-primary` | `#F1F3F7` | judul, teks VO | 16.0:1 |
| `--text-secondary` | `#9CA3B4` | label, meta, durasi | 7.0:1 (surface), 6.4:1 (elevated) |
| `--accent-primary` | **`#2563EB`** (lama `#3B82F6`) | latar tombol utama, teks putih | putih: 5.17:1 ✅ (lama 3.68 ❌) |
| `--accent-link` | `#60A5FA` | link/teks aksen di atas gelap | 6.99:1 |
| `--accent-warm` | `#F59E0B` | cache hit, favorit, tren baru | **teks di atasnya wajib gelap `#0E1013`** (8.87:1); teks putih hanya 2.15 ❌ |
| `--status-pass` | `#10B981` | lolos audit, skema valid | 7.0:1 |
| `--status-warn` | `#F59E0B` | blocked, klise, durasi lebih | sama seperti warm |
| `--status-risk` | **`#F87171`** untuk teks, `#EF4444` untuk latar badge | risiko kebijakan, fidelity | teks 6.43:1 |

**Warna role adegan** (badge + garis kiri kartu; selalu disertai label teks, tidak mengandalkan warna saja):
`hook` amber · `agitate` rose `#F43F5E` · `proof` emerald · `demo` teal `#14B8A6` · `objection_handle` violet `#8B5CF6` · `offer` orange `#FB923C` · `cta` blue.

**Tipografi:** Inter (UI, 14px/1.5; judul 16–20px/1.3 semibold), teks VO **17px/1.7** di HP, Teleprompter 28–40px (bisa diatur), JetBrains Mono 13px untuk JSON/biaya. Body tidak pernah < 14px; label kecil minimal 12px.

**Spasi & bentuk:** skala 4/8/12/16/24/32; radius kartu 12px; target sentuh ≥ 44×44px dengan jarak ≥ 8px; animasi 150–200ms ease-out; hormati `prefers-reduced-motion`.

## 3. Navigasi (HP)

**Bottom navigation (4 tab, ≤ 5 sesuai pedoman):** `Studio` · `Tren` · `Riwayat` · `Brand`
**Top bar 48px:** nama produk aktif (tap = pindah produk), **pill biaya bulan ini** (`$3.40 / $10`), menu (Ide Konten, Pengaturan).
Tombol Back Android harus kembali ke langkah sebelumnya (pakai riwayat router, bukan `replace`). Setiap langkah punya URL sendiri agar bisa di-deep-link dan dilanjutkan.

## 4. Studio — Wizard 6 Langkah (HP)

Indikator langkah di atas: `1 Produk · 2 Brief · 3 Angle · 4 Hook · 5 Script · 6 Posting`, dengan langkah yang selesai bisa di-tap untuk kembali.

### Langkah 1 — Produk
- Field **Link produk**, terisi otomatis jika dibuka dari menu Share Android.
- **Tambah foto** (kamera/galeri, maks 5): foto kemasan, label komposisi, atau screenshot halaman produk.
- **Deskripsi**, lalu **Catatan pemakaian pribadi**: wajib, dengan helper *"Tulis 1–2 hal nyata yang kamu suka/kurang suka supaya script tidak generik"*.
- Bagian lipat **Info affiliate**: harga, harga coret, komisi %, promo/voucher, kategori, platform target.
- Tombol sticky bawah: **Riset & Buat Angle** (`Ctrl/Cmd+Enter` di laptop).
- Jika `scrapeStatus = blocked`: banner kuning lembut di atas form, *"Link marketplace membatasi akses otomatis. Data tetap diproses lewat foto, deskripsi, dan riset web."* Banner ini tidak memblokir apa pun.

### Langkah 2 — Brief
- Kartu yang bisa dilipat: *Pain Points*, *Pemicu Beli*, *Keberatan*, *Celah Kompetitor*, **Fakta Terverifikasi** (tiap fakta ada chip sumber `Kamu`/`Foto`/`Halaman`/`Web` + link), **Klaim yang Dilarang**.
- Semua item bisa diedit, dihapus, atau ditambah (inline). Item tren yang dipakai ditampilkan dengan tanggal dan link.
- CTA: **Pakai Brief Ini**. Setelah ditekan, fakta dikunci dan ikon gembok muncul.

### Langkah 3 — Angle
- 3–5 kartu. Tiap kartu berisi: judul, badge gaya jual, badge format video, label kebutuhan rekaman (ikon wajah/tangan/lokasi), *kenapa cocok*, dan chip tren.
- Tap kartu untuk memilih. Angle terpilih memicu Hook Lab.

### Langkah 4 — Hook Lab
- 5+ kartu, dikelompokkan per tipe psikologi. Tiap kartu menampilkan 3 baris: 🗣 Ucapan, 🎬 Visual, 🔤 Teks layar *(pakai ikon Lucide, bukan emoji)*.
- Aksi: **Pakai Hook Ini** (utama), ☆ Favorit, dan chip "terinspirasi dari: …".

### Langkah 5 — Script
- **Header:** pemilih versi (`v1 v2 v3`), pemilih platform pratinjau (`TikTok`/`Shopee`, mengganti isi kartu CTA), dan **Duration Pill** `28.5 dtk · 66 kata @140 WPM`. Pill jadi kuning jika melewati target.
- **Sub-tab:** `Script` | `Strategi` | `Audit (n)`. Di laptop, Strategi dan Audit pindah ke panel kanan.
- **Kartu adegan:**
  - Header: nomor, badge role, durasi, dan tombol ✨ Revisi.
  - Teks VO 17px, bisa diedit langsung selama status `draft`.
  - Bagian lipat **Shot list**: angle kamera, gerakan, properti, B-roll, SFX, transisi.
  - Ikon gembok kecil untuk kalimat yang tertaut ke Fakta Terverifikasi. Tap untuk melihat faktanya.
  - Badge kecil **"dinaikkan ke medium"** jika hasil ini berasal dari eskalasi otomatis (transparansi biaya).
- Menu ⋯ berisi **"Tulis ulang lebih teliti (effort high, ±$0.05)"**: satu-satunya jalan ke effort `high`.
- **Action bar sticky bawah:** **Copy VO** · **Teleprompter** · **Share** · ⋯ (JSON Remotion, Duplikat, Hapus versi).
- **Streaming:** selama generate, tampilkan *Vertical Progress Stepper* dengan teks yang mengalir langsung ke kartu adegan:
  1. Membaca tren minggu ini…
  2. Menganalisis produk & riset web…
  3. Menyusun angle…
  4. Menulis naskah per adegan…
  5. Audit anti-template, fidelity & kepatuhan…

  Jangan pakai spinner kosong.

### Langkah 6 — Posting Pack
- Segmented tab **TikTok | Shopee**. Tiap tab berisi caption, hashtag (chip, tap untuk copy), dan komentar tersemat, masing-masing dengan tombol copy.
- Kartu **"Klip CTA"**: teks VO & teks layar CTA untuk platform tab aktif. Rekam semua adegan sekali, lalu rekam 2 klip CTA saja.
- Tombol **Tandai Sudah Diposting**: membuka form singkat Performance Log (tanggal wajib, link & angka opsional, bisa diisi nanti dari Riwayat).

## 5. Teleprompter (fitur kunci untuk rekam di HP)
- Layar penuh, teks VO saja (tanpa metadata). Pemisah adegan berupa garis tipis dan label role kecil.
- Scroll otomatis dengan kecepatan = `voiceoverWpm`, bisa diatur ±10 WPM. Ada tombol Play/Pause besar dan tap layar untuk jeda.
- Ukuran font bisa diatur, ada **mode cermin** (untuk teleprompter fisik) dan **hitung mundur 3-2-1**.
- **Wake Lock API** menjaga layar tetap menyala, dengan fallback pesan jika tidak didukung.
- Bisa dipakai offline untuk script yang sudah dibuka (service worker menyimpan dokumen terakhir).
- Toggle **CTA: TikTok / Shopee / Dua-duanya** (mode dua-duanya menampilkan kedua klip CTA di akhir secara berurutan).

## 6. Layar Lain
- **Tren:**
  - Daftar `trendSnapshots` per kategori dengan label umur ("diperbarui 3 jam lalu") dan tombol **Refresh** (menampilkan estimasi biaya).
  - Tab **Referensi Viral**: tempel link/caption/transkrip, lalu lihat pola yang diekstrak.
  - **Momen Kampanye**: kalender ringkas (Payday, 11.11, 12.12, dll.).
- **Riwayat:**
  - Daftar produk, lalu script per produk dengan status (`draft/ready/recorded/posted`) dan skor performa.
  - Filter *Winning* dan halaman **Bank Hook** (favorit lintas produk).
- **Brand:**
  - Form persona, tone, audiens, estetika, platform utama (default TikTok + Shopee), mode rekaman (`Wajah`/`Faceless`/`Campur`, default Campur), slider WPM 110–180 dengan **tombol uji baca** (stopwatch 30 detik → hitung WPM asli).
  - Tag frasa terlarang (dengan preset), contoh gaya bicara, dan pratinjau blok cache beserta estimasi token.
  - **Batas anggaran bulanan.**
- **Ide Konten (P2):** kanban ringkas `Ide → Ditulis → Diposting`, filter pilar, dan tombol **Buat Script di Studio**.

## 7. Laptop (≥ 1200px)
- **≥ 1440px:** 3-pane `28% | 44% | 28%`.
  - Kiri: Produk + Brief + Angle.
  - Tengah: Script.
  - Kanan: Strategi / Hook Lab / Audit.
- **1200–1439px:** kiri 30% + tengah 70%, panel kanan menjadi drawer.
- **< 1200px:** wizard HP.
- **Shortcut** (laptop saja):

  | Shortcut | Aksi |
  | :--- | :--- |
  | `Ctrl/Cmd+K` | pindah produk |
  | `Ctrl/Cmd+Enter` | generate/submit |
  | `Ctrl/Cmd+Shift+C` | copy VO/JSON |
  | `Ctrl/Cmd+1/2` | tab Script/JSON |
  | `Ctrl/Cmd+.` | buka/tutup panel kanan |

## 8. Pola Interaksi & Kondisi Khusus
| Kondisi | Tampilan |
| :--- | :--- |
| Revisi parsial | Bottom sheet: chips (`Lebih santai`, `Lebih singkat -30%`, `Lebih hard-sell`, `Visual sinematik`, `Hapus kesan iklan`, `Jadikan faceless`) + 1 input bebas → versi baru, toast "v3 dibuat · lihat perbedaan" |
| JSON gagal validasi | Status "Memperbaiki struktur otomatis…"; tombol simpan/ekspor nonaktif sampai valid; jika perbaikan gagal → kartu error + tombol **Coba Lagi** |
| Timeout / rate limit / offline | Tombol **Lanjutkan dari Langkah Terakhir** (hasil tahap sebelumnya sudah tersimpan) |
| AI menolak (refusal) | Pesan netral + saran ubah deskripsi; tercatat `status = refused` |
| Anggaran habis | Banner di tombol generate: "Batas $10 bulan ini tercapai. Ubah di Brand → Anggaran." |
| Tren kedaluwarsa (> 24 jam) | Chip kuning "tren lama" + refresh otomatis saat generate berikutnya |
| Brief kosong / fakta 0 | Generate script diblokir: "Tambahkan minimal 1 fakta produk" |

## 9. PWA & Android
- `manifest.webmanifest`:
  - `display: standalone`, `theme_color` dan `background_color` `#0E1013`.
  - Ikon 192/512 + maskable.
  - **`share_target`** (`GET`, parameter `title`, `text`, `url`) → membuka `/studio/new?url=…`. Catatan: aplikasi marketplace sering mengirim link di dalam `text`, jadi ambil URL pertama dari `text` bila `url` kosong.
- Service worker: cache app shell + script terakhir dibuka (untuk teleprompter offline). Panggilan AI tidak pernah di-cache.
- Safe area: `env(safe-area-inset-bottom)` untuk bottom nav dan action bar.
- Web Share API untuk tombol Share (kirim teks VO/caption ke WhatsApp/CapCut/Notes).
- APK (opsional): bungkus URL Cloud Run dengan TWA (mis. PWABuilder). Butuh `assetlinks.json` di domain agar tidak muncul address bar.

## 10. Pemetaan Komponen ↔ Endpoint
| Komponen | Endpoint | Koleksi |
| :--- | :--- | :--- |
| `BrandForm`, `BudgetSetting` | `GET/PUT /api/brands/:id` | `brands`, `appConfig` |
| `TrendScreen` | `POST /api/trends/pulse` | `trendSnapshots`, `apiRuns` |
| `ViralReferenceForm` | `POST /api/viral-references` | `viralReferences`, `apiRuns` |
| `ProductForm` (+ share target) | `POST /api/products`, `POST /api/products/:id/research` | `products`, `briefs`, `apiRuns` |
| `BriefEditor` | `PATCH /api/briefs/:id` (server menolak edit fakta setelah dikunci) | `briefs` |
| `AngleList` | `POST /api/briefs/:id/angles` | `angles`, `apiRuns` |
| `HookLab` | `POST /api/angles/:id/hooks` | `hooks`, `apiRuns` |
| `ScriptEditor` (stream SSE) | `POST /api/scripts/generate` | `scripts`, `apiRuns` |
| `ReviseSheet`, `ApplyFixButton` | `POST /api/scripts/:id/revise` | `scripts`, `apiRuns` |
| `AuditTab` (re-audit setelah edit manual) | `POST /api/scripts/:id/audit` | `scripts`, `apiRuns` |
| `PerformanceForm` | Firestore langsung + `POST /api/performance/recompute` | `performanceLogs` |
| `IdeaBoard` | `POST /api/ideas` | `ideas`, `apiRuns` |
| `CostPill` | Firestore query `apiRuns` bulan ini | `apiRuns` |

## 11. Pre-Delivery Checklist UI
- [ ] Kontras teks ≥ 4.5:1; komponen interaktif & fokus ≥ 3:1 (token §2)
- [ ] Target sentuh ≥ 44px, jarak ≥ 8px; tidak ada aksi yang hanya muncul saat hover
- [ ] Tombol ikon punya `aria-label`; ikon dekoratif `aria-hidden`; tidak ada emoji sebagai ikon
- [ ] Label form terlihat (bukan placeholder saja); error tampil di dekat field
- [ ] Tidak ada scroll horizontal di 360px; zoom tidak dimatikan
- [ ] Back Android kembali ke langkah sebelumnya; setiap langkah punya URL
- [ ] `prefers-reduced-motion` dihormati (teleprompter tetap scroll, transisi dimatikan)
- [ ] Bottom nav & action bar aman dari gesture bar (safe area)
- [ ] Layout tidak bergeser saat streaming (ruang kartu dipesan, CLS < 0.1)
