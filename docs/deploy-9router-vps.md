# Pasang 9router di VPS (Docker)

Hasil akhir: `https://<domain>/v1` yang bisa dipanggil server aplikasi di Cloud Run, dengan key wajib. Dashboard 9router **tidak** dibuka ke internet; Anda membukanya lewat SSH tunnel.

## Server Anda sekarang (`3.26.235.167`): tambahkan HTTPS saja
Hasil cek 2026-11-23: `/v1/*` sudah wajib key (401 tanpa key) ✔. Tapi **dashboard terbuka ke internet lewat HTTP biasa** dan port 80/443 tertutup. Password dashboard dan key API lewat jalur tanpa enkripsi. Perbaiki dengan 4 langkah ini; 9router yang sudah jalan tidak disentuh.

1. **AWS Console → EC2 → Security Group** instance ini, Inbound rules:
   - tambah `HTTP 80` dan `HTTPS 443` dari `0.0.0.0/0`;
   - **hapus** aturan port `20128` (setelah langkah 3 berhasil).
2. Kirim file dari PowerShell laptop (ganti `kunci.pem` dan user, biasanya `ubuntu`):
```powershell
scp -i kunci.pem "deploy/9router/Caddyfile" "deploy/9router/docker-compose.caddy-only.yml" ubuntu@3.26.235.167:~/
```
3. Di server (`ssh -i kunci.pem ubuntu@3.26.235.167`):
```bash
command -v docker || curl -fsSL https://get.docker.com | sudo sh
cd ~ && sudo DOMAIN=3-26-235-167.sslip.io docker compose -f docker-compose.caddy-only.yml up -d
sudo docker logs -f caddy
```
   Tunggu log sertifikat berhasil, lalu `Ctrl+C`. Uji dari laptop: `curl.exe https://3-26-235-167.sslip.io/v1/models` harus **401**, dan `https://3-26-235-167.sslip.io/dashboard` harus **Not found**.
4. Mulai sekarang buka dashboard hanya lewat tunnel:
```powershell
ssh -i kunci.pem -N -L 20128:localhost:20128 -L 1455:localhost:1455 ubuntu@3.26.235.167
```
   lalu `http://localhost:20128/dashboard`. Ganti password dashboard, dan buat **API key baru** (key lama sempat tertulis di chat). Pastikan `REQUIRE_API_KEY` tetap aktif.

Secret AI Studio untuk server ini:
| Secret | Isi |
| :--- | :--- |
| `LLM_BASE_URL` | `https://3-26-235-167.sslip.io/v1` |
| `LLM_API_KEY` | key baru |
| `LLM_MODEL` | `AdheRouter` (persis, huruf besar-kecil sama) |
| `LLM_VISION_MODEL` | combo yang **semua** modelnya punya ikon mata (lihat catatan di bawah) |

**Catatan combo `AdheRouter`:** model pertamanya (`coarena/deepseek-v4-1-flash-1017`) tidak punya ikon mata (tidak bisa membaca gambar). Dengan mode *Fallback — try in order*, foto produk bisa ditolak atau diabaikan. Buat combo kedua, mis. `AdheVision`, berisi model bermata saja (`gemini/gemini-3.8-flash`, `zro/zro/deepseek-v4.1-flash`, dst.), lalu isi `LLM_VISION_MODEL=AdheVision`. Aplikasi memakainya hanya saat brief dibuat dari foto.

Bagian di bawah ini untuk **VPS baru** dari nol.

---

File siap pakai ada di `deploy/9router/`:
- `docker-compose.yml`: container 9router (hanya `127.0.0.1`) dan Caddy (HTTPS otomatis, port 80/443).
- `Caddyfile`: hanya meneruskan `/v1/*`; path lain dibalas 404.
- `setup.sh`: membuat `.env` berisi secret acak dan password dashboard.

Waktu: ± 30–45 menit. Biaya VPS: ± US$4–6/bulan.

## 1. Sewa VPS
- OS **Ubuntu 24.04**, minimal **1 vCPU, 1 GB RAM** (2 GB lebih lega), lokasi **Singapura/Jakarta** agar dekat dengan Cloud Run Asia.
- Contoh penyedia: DigitalOcean, Vultr, Hetzner, Linode, Biznet Gio, IDCloudHost.
- Saat membuat VPS, tambahkan **SSH key** dari laptop Anda (lebih aman daripada password). Buat key di PowerShell jika belum punya:
```powershell
ssh-keygen -t ed25519
```
  Tempel isi `C:\Users\<nama>\.ssh\id_ed25519.pub` ke form SSH key penyedia VPS.
- Catat **IP publik** VPS, mis. `203.0.113.5`.

## 2. Domain
Pilih salah satu:
- **Tanpa beli domain:** pakai `203-0-113-5.sslip.io` (ganti titik di IP dengan tanda minus). Otomatis mengarah ke IP Anda dan bisa dapat HTTPS.
- **Domain sendiri:** buat A-record, mis. `ai.domainanda.com` → IP VPS.

## 3. Siapkan VPS (sekali saja)
Masuk dari PowerShell:
```powershell
ssh root@203.0.113.5
```
Lalu di VPS jalankan baris per baris:
```bash
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
mkdir -p /opt/9router
```
Port 20128 sengaja **tidak** dibuka di firewall.

## 4. Kirim file & buat secret
Di PowerShell laptop (folder project):
```powershell
scp "deploy/9router/docker-compose.yml" "deploy/9router/Caddyfile" "deploy/9router/setup.sh" root@203.0.113.5:/opt/9router/
```
Di VPS:
```bash
cd /opt/9router && chmod +x setup.sh && ./setup.sh 203-0-113-5.sslip.io
```
Simpan **password dashboard** yang ditampilkan ke password manager. File `.env` (berisi semua secret) tetap di VPS dan jangan disalin ke mana pun.

## 5. Jalankan
```bash
cd /opt/9router && docker compose up -d && docker compose logs -f --tail=50
```
Tunggu sampai Caddy menulis bahwa sertifikat untuk domain Anda berhasil didapat, lalu tekan `Ctrl+C` (container tetap jalan).

## 6. Buka dashboard lewat SSH tunnel
Matikan dulu 9router di laptop jika sedang jalan (port-nya sama). Di PowerShell laptop:
```powershell
ssh -N -L 20128:localhost:20128 -L 1455:localhost:1455 root@203.0.113.5
```
Biarkan jendela itu terbuka, lalu buka `http://localhost:20128/dashboard` di browser laptop.
1. Login dengan password dari langkah 4, lalu **ganti password**.
2. **Hubungkan provider** (Claude Code, Codex, GLM, Kiro, dll.) seperti di 9router laptop Anda. Login OAuth berjalan di browser laptop; callback-nya diteruskan tunnel ke VPS.
3. Buat **API key baru** di dashboard. Key lama dari 9router laptop tidak berlaku di VPS (secret-nya berbeda).
4. Catat nama model/combo yang ingin dipakai aplikasi.

Tutup tunnel dengan `Ctrl+C` setelah selesai. Dashboard tidak bisa diakses dari internet.

## 7. Uji dari luar
Di PowerShell laptop (atau HP dengan data seluler):
```powershell
curl.exe https://203-0-113-5.sslip.io/v1/models -H "Authorization: Bearer KEY-BARU"
```
- Daftar model muncul → berhasil.
- Tanpa header `Authorization` harus ditolak (401). Jika tetap lolos, berarti `REQUIRE_API_KEY` belum aktif. Cek `.env`, lalu jalankan `docker compose up -d` lagi.
- `https://<domain>/dashboard` harus membalas `Not found`.

Uji satu chat singkat:
```powershell
curl.exe https://203-0-113-5.sslip.io/v1/chat/completions -H "Authorization: Bearer KEY-BARU" -H "Content-Type: application/json" -d '{\"model\":\"NAMA-MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Balas: ok\"}]}'
```

## 8. Isi Secrets di AI Studio
| Secret | Isi |
| :--- | :--- |
| `LLM_BASE_URL` | `https://203-0-113-5.sslip.io/v1` (domain Anda) |
| `LLM_API_KEY` | key baru dari langkah 6 |
| `LLM_MODEL` | nama model/combo dari langkah 6 |
| `LLM_SEND_EFFORT` | `on` |

Lanjut ke `fase-1.md` bagian A.2 (Tavily) dan B.

## Perawatan
| Tugas | Perintah (di VPS, folder `/opt/9router`) |
| :--- | :--- |
| Update 9router | `docker compose pull && docker compose up -d` |
| Lihat log | `docker compose logs -f --tail=100 9router` |
| Restart | `docker compose restart` |
| Backup data (provider, key, riwayat) | `docker run --rm -v 9router-data:/d -v /root:/b alpine tar czf /b/9router-backup.tgz -C /d .` |
| Ganti key bocor | Hapus key di dashboard (via tunnel), buat baru, perbarui secret `LLM_API_KEY` |

## Jika ada masalah
| Gejala | Tindakan |
| :--- | :--- |
| Caddy gagal mendapat sertifikat | Port 80/443 harus terbuka (`ufw status`) dan domain harus mengarah ke IP VPS; cek `docker compose logs caddy` |
| `curl` timeout | Firewall penyedia VPS (security group/cloud firewall) juga harus membuka 80 dan 443 |
| Tunnel: "address already in use" | 9router di laptop masih jalan; matikan dulu |
| Login OAuth provider gagal | Pastikan tunnel aktif dengan kedua port (20128 dan 1455) |
| Aplikasi menulis "9router tidak bisa dihubungi" | Jalankan `docker compose ps`; kedua container harus `running` |
