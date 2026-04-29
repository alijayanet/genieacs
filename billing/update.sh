#!/bin/bash
# ============================================================
#  UPDATE - Portal Pelanggan GenieACS
#  Untuk Ubuntu / Armbian
#  Gunakan script ini untuk update aplikasi tanpa reset konfigurasi
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     UPDATE PORTAL PELANGGAN GENIEACS             ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Cek root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[WARN]${NC} Jalankan dengan: ${BOLD}sudo bash update.sh${NC}"
  exit 1
fi

cd "$SCRIPT_DIR"

# Backup settings.json sebelum update
echo -e "${BLUE}[INFO]${NC} Backup settings.json..."
cp settings.json settings.json.bak
echo -e "${GREEN}[OK]${NC} Backup tersimpan di settings.json.bak"

# Update dependensi
echo -e "${BLUE}[INFO]${NC} Update dependensi npm..."
npm install --production --silent
echo -e "${GREEN}[OK]${NC} Dependensi diperbarui."

# Restart aplikasi
echo -e "${BLUE}[INFO]${NC} Restart aplikasi..."
pm2 restart app-customer
echo -e "${GREEN}[OK]${NC} Aplikasi berhasil direstart."

# Tampilkan status
pm2 status app-customer

echo ""
echo -e "${GREEN}${BOLD}Update selesai!${NC}"
echo -e "Konfigurasi lama tersimpan di: ${YELLOW}settings.json.bak${NC}"
echo ""
