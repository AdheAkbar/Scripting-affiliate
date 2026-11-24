#!/usr/bin/env bash
# Membuat .env berisi secret acak untuk 9router. Tidak menimpa .env yang sudah ada.
# Pakai: ./setup.sh 203-0-113-5.sslip.io   (atau domain Anda sendiri yang A-record-nya ke IP VPS)
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  echo ".env sudah ada, tidak ditimpa. Hapus manual jika ingin membuat ulang (secret lama akan hilang)."
  exit 0
fi

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  read -rp "Domain untuk 9router (mis. 203-0-113-5.sslip.io): " DOMAIN
fi
if ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Domain tidak valid: '$DOMAIN'" >&2
  exit 1
fi

rand() { openssl rand -hex "$1"; }
PASSWORD="$(rand 12)"

umask 077
cat > .env <<EOF
DOMAIN=$DOMAIN
JWT_SECRET=$(rand 32)
INITIAL_PASSWORD=$PASSWORD
API_KEY_SECRET=$(rand 32)
MACHINE_ID_SALT=$(rand 16)
REQUIRE_API_KEY=true
ENABLE_REQUEST_LOGS=false
AUTH_COOKIE_SECURE=false
BASE_URL=http://localhost:20128
NEXT_PUBLIC_BASE_URL=http://localhost:20128
EOF

echo "OK: .env dibuat (izin 600)."
echo "Password login dashboard pertama: $PASSWORD"
echo "Simpan di password manager, lalu ganti setelah login pertama."
