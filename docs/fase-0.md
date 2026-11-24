# Fase 0 — Fondasi (Panduan Langkah demi Langkah)

Tujuan: aplikasi bisa login (hanya email Anda), menyimpan Brand DNA yang tersinkron antara HP dan laptop, dan bisa di-install di Android serta muncul di menu **Share**. **Belum ada fitur AI di fase ini.**

## A. Persiapan (± 15 menit, dilakukan sendiri)
1. Buka **aistudio.google.com**, masuk dengan akun Google Anda, lalu pilih **Build**.
2. Lampirkan **5 file dari folder `ai-studio-upload/`**: `prd.md`, `erd.md`, `design.md`, `agent.md`, `starter-bundle.md`. File `.ts` tidak bisa dilampirkan langsung, jadi semua kode starter (21 file) sudah digabung ke dalam `starter-bundle.md`. Jika `.md` ditolak, pakai `starter-bundle.txt`.
   > Setelah ada perubahan di `starter/`, buat ulang bundle dengan `npm run bundle` di folder `starter`.
3. Email owner sudah terisi di `firestore.rules`, `storage.rules`, dan `brand-preset.json`. Isi juga secret `OWNER_EMAIL` di panel Secrets AI Studio dengan email yang sama.
4. **Key 9router belum diperlukan** di fase ini. Siapkan untuk Fase 1 (lihat `fase-1.md` bagian A).


## B. Prompt untuk ditempel ke AI Studio Build

```
Bangun aplikasi web full-stack bernama "Affiliate Script Studio": React + TypeScript (strict) + Tailwind + shadcn/ui + Lucide di frontend, dengan server Node. Ikuti dokumen terlampir (prd.md, erd.md, design.md, agent.md). Kerjakan HANYA "Fase 0 Fondasi" di agent.md §5.

Wajib:
1. Firebase Auth "Sign in with Google" + Cloud Firestore + Firebase Storage. Hanya email di secret OWNER_EMAIL yang boleh masuk. Email lain melihat layar "Akses ditolak" lalu otomatis logout. Server memverifikasi Firebase ID token + email di setiap route /api.
2. Buat SEMUA file dari starter-bundle.md terlampir: setiap judul "## FILE: <path>" adalah path file, dan isi blok kode di bawahnya adalah isi file PERSIS (jangan diubah, dirapikan, atau ditulis ulang). Dependency: zod ^4.6.7 dan openai ^7.62.0 (openai baru dipakai di Fase 1; file server/ai dan server/research cukup dibuat, belum dipanggil).
3. Pasang firestore.rules, storage.rules, firestore.indexes.json dari bundle apa adanya.
4. Saat owner pertama kali login: buat dokumen appConfig/owner dan 1 brand dari seed/brand-preset.json (ownerUid = uid login). Validasi dengan skema Brand sebelum menulis.
5. Layar Brand (design.md §6): form persona, tone, audiens, estetika, platform utama (default TikTok+Shopee), mode rekaman (Wajah/Faceless/Campur), slider WPM 110–180 + tombol "Uji baca 30 detik", tag input frasa terlarang, contoh gaya bicara (maks 5), batas anggaran bulanan (USD). Simpan langsung ke Firestore, validasi dengan skema Zod, tampilkan error di dekat field.
6. App shell mobile-first: top bar 48px (nama produk aktif + pill biaya "$0.00 / $10"), bottom navigation 4 tab: Studio, Tren, Riwayat, Brand. Tab Studio/Tren/Riwayat cukup berisi placeholder "Segera hadir (Fase 1–2)". Setiap layar punya URL sendiri. Tombol Back Android harus kembali ke layar sebelumnya.
7. Token warna & tipografi persis design.md §2 (dark default). Tombol utama #2563EB dengan teks putih, teks di atas amber berwarna gelap. Target sentuh ≥ 44px, safe-area bawah.
8. PWA: pakai manifest.webmanifest terlampir, buat ikon 192/512/maskable sederhana (huruf "S" di latar #0E1013), service worker yang meng-cache app shell saja. Halaman /studio/new membaca parameter share (url/text/title) dengan extractSharedUrl() lalu menampilkan link produk yang diterima.
9. Tambahkan vitest dan jalankan tests/schemas.test.ts dan tests/pipeline.test.ts dari bundle. Semua test harus lulus.

Larangan: JANGAN memakai Gemini API atau fitur AI apa pun di fase ini. JANGAN membuat registrasi, multi-user, billing, atau landing page. JANGAN mengubah nama field di erd.md.
```

## C. Cek Kelulusan (Milestone Gate)
Centang semua sebelum lanjut ke Fase 1:
- [ ] Login dengan email Anda berhasil; login dengan email lain ditolak.
- [ ] Ubah persona di laptop → muncul di HP setelah refresh (sinkron Firestore).
- [ ] Simpan WPM 200 → ditolak dengan pesan di dekat slider.
- [ ] Di Firebase Console → Firestore → Rules Playground: user lain tidak bisa membaca `brands`; owner tidak bisa menulis `apiRuns` dan tidak bisa mengubah status script ke `ready`.
- [ ] Test vitest 50/50 lulus (di AI Studio, atau unduh ZIP lalu `npm test` di laptop).
- [ ] Publish ke Cloud Run → buka URL di Chrome Android → **Install app** / "Tambahkan ke layar utama".
- [ ] Di app TikTok/Shopee: Share produk → pilih **Script Studio** → halaman /studio/new menampilkan link produk.
- [ ] Tombol Back Android kembali ke layar sebelumnya, tidak keluar aplikasi.
- [ ] Tidak ada error merah di konsol browser.

## D. Jika ada masalah
| Gejala | Kemungkinan penyebab | Tindakan |
| :--- | :--- | :--- |
| Agent menambah Gemini | Default AI Studio | Balas: "Hapus semua pemakaian Gemini, Fase 0 tanpa AI." |
| Error "expected object, received undefined" di `postingPacks`/`ctaVariants` | Skema ditulis ulang dengan `z.record` | Minta agent menyalin `documents.ts` apa adanya (`z.partialRecord`) |
| Tidak muncul di menu Share | PWA belum ter-install, atau dibuka di tab biasa | Install dulu via Chrome; share target hanya aktif untuk PWA terpasang |
| Login gagal di domain Cloud Run | Domain belum ada di Firebase Auth → Authorized domains | Tambahkan domain `*.run.app` milik Anda |
| Rules ditolak saat deploy | Email di rules beda dengan akun login | Samakan email di `firestore.rules`, `storage.rules`, dan secret `OWNER_EMAIL` |

Setelah semua centang, lanjut ke `docs/fase-1.md`.
