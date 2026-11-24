# Affiliate Script Studio

Workspace internal 1-user untuk menyusun Brand DNA dan naskah video pendek affiliate (TikTok Shop & Shopee Video).

## Status Saat Ini: Fase 0 (Fondasi)

- **Autentikasi**: Firebase Auth (**Sign in with Google**) dengan allowlist 1 email (`OWNER_EMAIL`). Email selain owner langsung melihat layar **Akses ditolak** dan otomatis keluar (`signOut`).
- **Verifikasi Server**: Setiap route `/api/*` memverifikasi Firebase ID token dengan `firebase-admin/auth` (`verifyIdToken`) + status `email_verified` + kecocokan `OWNER_EMAIL`.
- **Database & Storage**: Cloud Firestore (database bernama dari `firebase-applet-config.json`) dan Firebase Storage (`products/{ownerUid}/{productId}/{filename}`).
- **Auto-seed Login Pertama**: Membuat dokumen `appConfig/owner` dan 1 profil `brands` dari `seed/brand-preset.json` (divalidasi dengan skema Zod `AppConfig` dan `Brand`).
- **Layar Brand**: Form lengkap Brand DNA, slider WPM 110–180 + dialog uji baca 30 detik, frasa terlarang, contoh gaya bicara (maks 5), batas anggaran bulanan (USD), dan pratinjau blok system prompt.
- **PWA**: Manifest, ikon `192/512/maskable`, service worker cache app shell, serta Share Target `/studio/new`.
- **AI / Riset Web (Fase 1+)**: Belum aktif di Fase 0. Kunci `LLM_*` (9router) dan `TAVILY_API_KEY` hanya dibaca di server; `TAVILY_API_KEY` bersifat opsional (jika kosong, riset web otomatis dilewati).

## Starter Tier

Proyek ini berjalan di **Firebase Starter Tier** buatan AI Studio (tanpa upgrade ke Cloud Billing / tanpa konfigurasi IAM untuk service account).

### Arsitektur Tanpa Admin SDK Firestore

1. **Verifikasi Token Tetap di Server**: `firebase-admin/auth` (`verifyIdToken(idToken)`) tidak membutuhkan peran IAM sehingga berjalan normal di Starter Tier untuk menjaga seluruh endpoint `/api/*`.
2. **Tanpa `firebase-admin/firestore`**: Server tidak memanggil Firestore melalui Admin SDK. Semua baca/tulis Firestore dilakukan lewat:
   - **Firebase Client SDK** di browser untuk data yang ditulis langsung oleh owner (`brands`, `appConfig/owner`, dst.), dan
   - **Firestore REST API** (`server/firestore-rest.ts`) dengan header `Authorization: Bearer <Firebase ID token owner>` untuk operasi dari server (Fase 1+). Dengan cara ini, `firestore.rules` **selalu berlaku penuh** pada setiap permintaan.
3. **Kunci Rahasia Tetap di Server**: `LLM_API_KEY` (9router) dan `TAVILY_API_KEY` (opsional) tidak pernah dikirim ke client maupun dibundel ke frontend.

### Perubahan Minimal pada `firestore.rules` & Konsekuensinya

Agar aplikasi dapat berjalan penuh di Starter Tier tanpa melemahkan proteksi multi-user, hanya 3 aturan khusus **owner terverifikasi** (`request.auth.token.email == 'akbarade68@gmail.com' && request.auth.token.email_verified == true`) yang ditambahkan di `firestore.rules`:

| Path | Perubahan di Starter Tier | Konsekuensi Keamanan |
| :--- | :--- | :--- |
| `appConfig/owner` | Owner boleh `create` dan `update` (dengan validasi `ownerEmail` tetap email owner & `monthlyBudgetUsd` antara `0 < x <= 10000`). `delete` tetap ditolak. | Owner dapat mengubah batas anggaran bulanan langsung dari browser (termasuk lewat DevTools jika sesi owner aktif). Email lain tetap ditolak total. |
| `apiRuns/{id}` | Owner boleh `create` saja dengan validasi seluruh field wajib (`ownerUid`, `stageName`, `estCostUsd >= 0`, `monthKey`, dll.). `update` dan `delete` tetap ditolak. | Catatan biaya bersifat *append-only* untuk sesi owner; tidak bisa diedit atau dihapus dari client, namun secara teori sesi owner sendiri dapat menulis entri baru melalui token miliknya. |
| `scripts/{id}` | Owner boleh mengubah status `draft` → `ready` **hanya** jika `audit.passed == true` dan hanya menyentuh field `status`, `audit`, `updatedAt`. | Menjaga syarat audit sebelum status `ready` langsung di rules, meski validasi tetap dijalankan menggunakan token sesi owner (bukan bypass Admin SDK). |

- **Semua koleksi lainnya tidak berubah** (`brands`, `products`, `viralReferences`, `performanceLogs`, `ideas`, serta koleksi server-only lainnya).
- **Email selain owner ditolak total** untuk seluruh operasi baca maupun tulis.
- Jika suatu saat Anda meng-upgrade proyek ke Google Cloud standar dan menambahkan IAM `roles/datastore.user`, aturan Starter Tier di atas dapat dikembalikan ke mode server-only Admin SDK.

### Deploy Rules & Indexes

- `firestore.rules` sudah di-deploy langsung melalui AI Studio.
- `storage.rules` dan `firestore.indexes.json` sudah tersedia apa adanya di root repositori; jika ingin men-deploy keduanya ke Firebase, jalankan via Firebase CLI:
  ```bash
  firebase deploy --only storage,firestore:indexes
  ```

## Pengujian

```bash
npm test                                    # 50/50 Vitest (schemas & pipeline)
npx tsx --test src/lib/wpm-test.test.ts     # Unit test kalkulasi WPM
npx tsx --test server/firestore-rest.test.ts # Unit test Firestore REST helper
npm run lint                                # TypeScript strict check
npm run build                               # Build produksi Vite
```
