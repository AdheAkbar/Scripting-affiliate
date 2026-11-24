# Spec: Affiliate Script Studio — V1 (build lokal)

Status: menunggu persetujuan

## Tujuan
Satu orang (owner) mengubah link produk TikTok Shop / Shopee menjadi naskah video affiliate siap rekam dalam < 2 menit, langsung dari HP. Tanpa biaya: LLM lewat 9router (combo AdheRouter), riset web lewat Tavily free tier, data di Firebase Starter Tier.

## Hasil audit kode AI Studio (repo Scripting-affiliate)
| # | Temuan | Dampak | Tindakan |
| :- | :- | :- | :- |
| A1 | `esbuild ^0.25` bentrok peer `vite 8` → `npm install` gagal (ERESOLVE) | Build di luar bun gagal; kemungkinan penyebab publish macet | Sudah diperbaiki: `^0.28.0` |
| A2 | `server/firestore-rest.test.ts`, `src/lib/wpm-test.test.ts` memakai `node:test` | `vitest run` melaporkan 2 suite gagal | Ubah ke vitest |
| A3 | Rules hanya mengizinkan tulis ke brands/products/ideas/dll; `trendSnapshots`, `briefs`, `angles`, `hooks`, `scripts` (create) ditolak | Fase 1+ tidak bisa menyimpan hasil AI di Starter Tier | Rules disederhanakan: owner boleh tulis dokumen miliknya; `apiRuns` tetap append-only |
| A4 | Warna hex ditulis langsung di ratusan class (`bg-[#15181E]`) | Sulit dirawat, tampilan "dashboard generik" | Pindah ke token CSS + kelas Tailwind semantik |
| A5 | `BrandPage.tsx` 780 baris, banyak field jarang dipakai | Membebani pemakaian harian | Pecah & sederhanakan (lihat Scope) |
| A6 | Pill biaya "$0.00 / $10" di top bar | 9router gratis → angka ini tidak berguna dan membingungkan | Hapus dari top bar; log `apiRuns` tetap dicatat diam-diam |
| A7 | Belum ada satu pun alur AI (Studio/Tren/Riwayat placeholder) | Aplikasi belum berguna | Inti V1 di bawah |

## Scope V1 (yang benar-benar dipakai)
Alur utama, 1 layar wizard dengan langkah yang bisa dilewati:
1. **Produk** — tempel/share link (atau ketik nama produk). Server ambil data halaman + riset Tavily → ringkasan fakta (harga, keunggulan, keluhan pembeli) dengan sumber. Owner bisa koreksi fakta.
2. **Angle + Hook** — 3 angle, masing-masing 3 hook. Pilih 1 hook (atau "pilih terbaik otomatis").
3. **Naskah** — streaming, dipecah per adegan (hook → masalah → bukti/demo → penawaran → CTA), durasi estimasi dari WPM, CTA per platform ("keranjang kuning" TikTok, "klik tombol produk" Shopee). Quality gate otomatis + 1x perbaikan diam-diam. Tombol: **Salin**, **Teleprompter**, **Variasi hook lain**.
4. **Teleprompter** — layar penuh, auto-scroll sesuai WPM, tap untuk jeda, ukuran huruf bisa diatur.
5. **Paket posting** — caption + hashtag per platform, salin sekali tap.

Pendukung:
- **Riwayat** — daftar naskah (cari, buka lagi, tandai "sudah diposting", isi hasil singkat: views/terjual). Naskah dengan hasil terbaik otomatis jadi contoh gaya untuk generate berikutnya.
- **Tren** — tombol "Ide hari ini" per kategori: riset Tavily → 5 ide produk/angle yang sedang ramai, sekali tap jadi naskah.
- **Brand** — disederhanakan jadi: nama akun, gaya bicara (persona/tone), audiens, platform utama, WPM (+ uji baca), frasa terlarang, contoh kalimat. Field lain dipindah ke "Lanjutan" (tertutup).
- PWA + Share target tetap.

## Di luar scope (ditunda)
- Ekspor Remotion, batch A/B, layout laptop khusus, APK/TWA — tidak dibutuhkan untuk merekam dari HP.
- Viral references (upload video referensi) — berat, nilai rendah untuk V1; diganti "belajar dari naskah sendiri yang laku".
- Versi revisi bertingkat & audit fidelity terpisah — digabung ke quality gate otomatis.
- Upload foto produk ke Storage — Storage kemungkinan butuh Blaze; V1 tanpa foto.
- Anggaran bulanan & pill biaya — 9router gratis.

## Desain
- Dark-first, tapi tidak kaku: tipografi lebih tegas (judul besar, angka mono), kartu adegan berwarna sesuai peran, gerak halus (≤200 ms), satu aksi utama per layar, tanpa ikon/emoji dekoratif, tanpa gradien "AI".
- Skill: `ui-ux-pro-max` (sistem desain), `impeccable` (audit & polish), `frontend-ui-engineering`.

## Perintah
- Dev: `npm run dev` (port 3000) · Test: `npx vitest run` · Typecheck: `npx tsc --noEmit` · Build: `npm run build` · Start: `npm start`

## Batasan
- Selalu: Zod di setiap output AI, test untuk logika baru, key hanya di `.env`/Secrets.
- Tanya dulu: panggilan nyata ke 9router/Tavily (memakai kuota), perubahan rules yang melonggarkan, hosting.
- Jangan: Gemini API, commit/push tanpa izin, menulis key ke file.

## Kriteria sukses
- `npm install`, typecheck, semua test, dan build lulus bersih.
- Dari link produk sampai naskah siap rekam ≤ 3 tap + 1 pilihan hook, < 60 detik pada 9router.
- Naskah lolos gate: durasi ±15% target, hook ≤ 3,5 detik, ada CTA platform, nol frasa terlarang.
- Uji browser 390×844 tanpa error konsol, tanpa scroll horizontal.

## Pertanyaan terbuka
1. **Hosting agar bisa dibuka di HP** (wajib diputuskan):
   - (a) Push ke GitHub → AI Studio impor ulang → Publish (gratis, Firebase tetap jalan; perlu dicek apakah AI Studio bisa tarik dari GitHub).
   - (b) Jalankan di VPS 9router Anda (Docker + Caddy HTTPS sslip.io), gratis jika VPS sudah ada; domain baru harus ditambahkan ke Firebase Auth "Authorized domains" (perlu dicek izinnya di Starter Tier).
