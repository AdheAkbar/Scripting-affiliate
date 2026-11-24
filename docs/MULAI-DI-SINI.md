# Mulai di Sini — Affiliate Script Studio

Aplikasi dibangun di **Google AI Studio** (aistudio.google.com → **Build**), bukan Android Studio. Hasilnya web app di Cloud Run yang di-install di HP Android sebagai aplikasi (PWA).

## Urutan
| Langkah | File panduan | Hasil | Perlu key 9router? |
| :--- | :--- | :--- | :--- |
| 1 | `fase-0.md` | Login, Brand, navigasi, bisa di-install & muncul di menu Share | Belum |
| 1b | `deploy-9router-vps.md` | 9router di VPS dengan HTTPS + key (sebelum Fase 1) | Membuat key baru |
| 2 | `fase-1.md` | Tren, riset produk, brief, angle, hook (LLM via 9router) | Ya |
| 3 | `fase-2.md` | Script streaming, audit, posting pack, teleprompter | Ya |
| 4 | `fase-3.md` | Revisi versi, riwayat, bank hook, belajar dari video laku, viral references | Ya |
| 5 | `fase-4.md` | Ide konten, ekspor Remotion, batch A/B, layout laptop, APK, uji rilis | Ya |

## Aturan main di AI Studio
1. **Satu fase per percakapan/pesan.** Jangan tempel semua prompt sekaligus; agent akan kewalahan dan memotong fitur.
2. Di Fase 0, lampirkan 5 file dari folder `ai-studio-upload/`: `prd.md`, `erd.md`, `design.md`, `agent.md`, `starter-bundle.md` (semua kode starter dalam satu file, karena `.ts` tidak bisa dilampirkan). Fase berikutnya cukup tempel prompt.
3. **Jangan lanjut sebelum checklist fase tercentang.** Bug yang dibawa ke fase berikutnya makin mahal.
4. Jika agent menulis ulang file `starter/`, menambah Gemini, atau mengubah nama field: tolak dan minta salin apa adanya.
5. Setelah tiap fase lulus, **Download ZIP / Export to GitHub** sebagai cadangan.

## Biaya perkiraan
- Google: Cloud Run + Firestore untuk 1 orang biasanya di dalam kuota gratis (perlu akun billing aktif).
- 9router gratis; tagihan nyata ada di provider/langganan yang Anda sambungkan. Aplikasi menghitung "biaya setara" ±US$0,15–0,20 per script dan memblokir generate jika lewat batas bulanan (default US$10, ubah di layar Brand).
