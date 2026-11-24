# Fase 4 — Pelengkap & Rilis

Tujuan: Ide Konten mingguan, ekspor JSON Remotion, batch 3 script untuk A/B, layout laptop, APK Android (opsional), lalu uji rilis.

Syarat: gate Fase 3 lulus. Tidak ada file baru; `ideasTask`, `IdeasOut`, `toRemotionExport` sudah tersalin.

## A. Prompt untuk ditempel
```
Lanjutkan ke Fase 4 "Pelengkap" di agent.md §5 (P2 di prd.md §4: F-16, F-17, F-18). Fase 0–3 sudah jalan, jangan ubah.
Tetap: semua AI lewat createLlm() (9router), tanpa Gemini.

1. Ide Konten (F-16): POST /api/ideas/generate {count?: 7}: llm.generate({ stageName "ideas", schema IdeasOut, content: trendBlock(snapshot terbaru kategori utama) + ideasTask(minggu ini, count) }), TANPA gate/eskalasi. Simpan ke koleksi ideas (status "idea"). Halaman Ide: daftar per pilar, ubah status idea/scripted/published/archived, tombol "Jadikan script" membuka Studio dengan premise terisi di catatan.
2. Ekspor Remotion (F-17): di halaman Script, tombol "Ekspor JSON" per platform memakai toRemotionExport(script, {platform, productName, sellingStyle, brandAesthetic}) dari shared/schemas/remotion.ts, validasi RemotionExport, lalu unduh file <produk>-<platform>-v<versi>.json. Tanpa panggilan AI.
3. Batch A/B (F-18): di langkah Angle, mode "Buat 3 script" untuk 3 angle terpilih (masing-masing hook #1). Tampilkan estimasi biaya (3 x biaya rata-rata script_draft+audit dari apiRuns) dan minta konfirmasi. Jalankan BERURUTAN (bukan paralel) agar cek anggaran berlaku tiap script; berhenti dengan pesan jika anggaran habis. Hasil ditampilkan berdampingan.
4. Layout laptop (design.md): ≥ 1440px tampil 3 panel (daftar/riwayat | editor script | audit+posting pack). Shortcut: Ctrl+Enter generate, Ctrl+Shift+C copy VO, Alt+1..6 pindah langkah wizard, Esc tutup sheet. Tampilkan daftar shortcut di menu bantuan.
5. TWA (opsional): sajikan /.well-known/assetlinks.json dari file statis (isinya akan saya tempel setelah membuat APK); pastikan manifest dan service worker lolos audit Lighthouse PWA.
6. Test: tambahkan test vitest bahwa toRemotionExport untuk script contoh lolos skema RemotionExport dan payload tanpa voiceover_text ditolak (erd.md §7). Jalankan semua test.

JANGAN: menjalankan batch paralel, render video di server, auto-posting ke TikTok/Shopee.
```

## B. APK Android (opsional, ± 20 menit)
PWA terpasang sudah cukup untuk dipakai harian. APK hanya perlu jika ingin ikon dan nama tampil seperti aplikasi biasa tanpa bar Chrome.
1. Publish ke Cloud Run, catat URL `https://…run.app`.
2. Buka **pwabuilder.com** → masukkan URL → **Package for stores** → **Android** → Generate. Simpan file `.zip` (berisi APK, AAB, dan `assetlinks.json`) serta **signing key** di tempat aman.
3. Tempel isi `assetlinks.json` ke AI Studio: "Isi /.well-known/assetlinks.json dengan ini: …" lalu Publish ulang.
4. Salin APK ke HP → install (izinkan "Install unknown apps" untuk file manager). Tanpa bar alamat = assetlinks benar.

## C. Cek Kelulusan Fase 4
- [ ] Generate 7 ide → tersebar di beberapa pilar; status bisa diubah.
- [ ] Ekspor JSON TikTok dan Shopee → file berbeda hanya di adegan CTA; test Remotion lulus.
- [ ] Batch 3 script menampilkan estimasi biaya dan berhenti rapi jika anggaran habis.
- [ ] Di laptop ≥ 1440px tampil 3 panel; shortcut berfungsi.

## D. Uji Rilis (Definition of Done, agent.md §6)
- [ ] `npx tsc --noEmit` bersih dan semua test vitest lulus (atau unduh ZIP → `npm install` → `npm test` di laptop).
- [ ] Uji Android lengkap: install, share dari app TikTok & Shopee, teleprompter 2 menit tanpa layar mati, Back Android, 0 error konsol.
- [ ] Uji cache, anggaran, fidelity, eskalasi (dari Fase 1–2) diulang sekali di versi Cloud Run.
- [ ] **Eval kualitas (berbayar ±US$2–3, minta izin dulu ke diri sendiri):** 9 produk (3 skincare, 3 gadget, 3 fashion). Nilai tiap script 1–5 pada: hook kuat ≤ 3 dtk, tidak klise, 0 klaim karangan, CTA benar TikTok & Shopee, durasi sesuai. Ulangi dengan effort `medium` di semua tahap. Jika `low` kalah > 0,5 poin di suatu tahap, jadikan tahap itu `medium` sebagai effort awal.
- [ ] Rata-rata biaya per script di `apiRuns` ≤ US$0,20.
- [ ] Sesuaikan `DEFAULT_RATES` di `server/ai/pricing.ts` dengan tarif provider/langganan 9router Anda (atau biarkan sebagai tarif setara).

Selesai. Setelah ini aplikasi dipakai harian; perubahan berikutnya ditulis sebagai *delta spec* (lihat agent.md).
