#!/bin/bash
# ============================================================
#  INSTALLER - Portal Pelanggan GenieACS
#  Untuk Ubuntu / Armbian (ARM & x86)
#  Asumsi: GenieACS berjalan di server yang sama (localhost:7557)
# ============================================================

set -e  # Hentikan script jika ada error

# ─── Warna terminal ─────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Banner ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     INSTALLER PORTAL PELANGGAN GENIEACS          ║${NC}"
echo -e "${CYAN}${BOLD}║     Ubuntu / Armbian Auto Setup                  ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Deteksi direktori script ───────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
echo -e "${BLUE}[INFO]${NC} Direktori aplikasi: ${BOLD}$APP_DIR${NC}"

# ─── Cek root / sudo ────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[WARN]${NC} Script ini perlu sudo untuk install Node.js dan PM2."
  echo -e "       Jalankan ulang dengan: ${BOLD}sudo bash install.sh${NC}"
  exit 1
fi

# ─── STEP 1: Update sistem ───────────────────────────────────
echo ""
echo -e "${BLUE}[STEP 1/6]${NC} Update package list..."
apt-get update -qq

# ─── STEP 2: Install dependensi sistem ──────────────────────
echo -e "${BLUE}[STEP 2/6]${NC} Install dependensi sistem (curl, git)..."
apt-get install -y curl git ca-certificates gnupg -qq

# ─── STEP 3: Cek & Install Node.js ──────────────────────────
echo ""
echo -e "${BLUE}[STEP 3/6]${NC} Memeriksa Node.js..."

NODE_REQUIRED=18
NODE_INSTALLED=0

if command -v node &> /dev/null; then
  NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])")
  if [ "$NODE_VER" -ge "$NODE_REQUIRED" ]; then
    echo -e "${GREEN}[OK]${NC} Node.js v$(node -v) sudah terinstall. Melewati instalasi."
    NODE_INSTALLED=1
  else
    echo -e "${YELLOW}[WARN]${NC} Node.js v$(node -v) terlalu lama (butuh >= v${NODE_REQUIRED})."
  fi
fi

if [ "$NODE_INSTALLED" -eq 0 ]; then
  echo -e "${BLUE}[INFO]${NC} Menginstall Node.js v${NODE_REQUIRED} LTS via NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_REQUIRED}.x" | bash -
  apt-get install -y nodejs -qq
  echo -e "${GREEN}[OK]${NC} Node.js $(node -v) berhasil diinstall."
fi

# ─── STEP 4: Install PM2 ────────────────────────────────────
echo ""
echo -e "${BLUE}[STEP 4/6]${NC} Memeriksa PM2..."
if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}[OK]${NC} PM2 $(pm2 -v) sudah terinstall."
else
  echo -e "${BLUE}[INFO]${NC} Menginstall PM2..."
  npm install -g pm2 -q
  echo -e "${GREEN}[OK]${NC} PM2 $(pm2 -v) berhasil diinstall."
fi

# ─── STEP 5: Install dependensi Node.js aplikasi ────────────
echo ""
echo -e "${BLUE}[STEP 5/6]${NC} Install dependensi aplikasi..."
cd "$APP_DIR"
npm install --production --silent
echo -e "${GREEN}[OK]${NC} Dependensi berhasil diinstall."

# ─── Konfigurasi settings.json ──────────────────────────────
echo ""
echo -e "${BLUE}[INFO]${NC} Mengkonfigurasi settings.json..."

# Deteksi IP server (untuk info akses)
SERVER_IP=$(hostname -I | awk '{print $1}')

# Baca nilai yang sudah ada (jika ada)
CURRENT_PORT=$(node -e "try{const s=require('./settings.json');console.log(s.server_port||3001)}catch(e){console.log(3001)}" 2>/dev/null || echo "3001")
CURRENT_COMPANY=$(node -e "try{const s=require('./settings.json');console.log(s.company_header||'ISP Portal')}catch(e){console.log('ISP Portal')}" 2>/dev/null || echo "ISP Portal")

# Tulis ulang settings.json dengan GenieACS di localhost
cat > "$APP_DIR/settings.json" << EOF
{
  "genieacs_url": "http://localhost:7557",
  "genieacs_username": "admin",
  "genieacs_password": "admin",
  "company_header": "${CURRENT_COMPANY}",
  "footer_info": "Internet Tanpa Batas",
  "server_port": ${CURRENT_PORT},
  "server_host": "localhost",
  "session_secret": "$(openssl rand -hex 32)"
}
EOF

echo -e "${GREEN}[OK]${NC} settings.json dikonfigurasi (GenieACS: localhost:7557, Port: ${CURRENT_PORT})"
echo -e "${YELLOW}[INFO]${NC} Jika username/password GenieACS bukan 'admin', edit file: ${BOLD}$APP_DIR/settings.json${NC}"

# ─── STEP 6: Jalankan dengan PM2 ────────────────────────────
echo ""
echo -e "${BLUE}[STEP 6/6]${NC} Menjalankan aplikasi dengan PM2..."

# Hentikan instance lama jika ada
pm2 delete app-customer 2>/dev/null || true

# Jalankan aplikasi
pm2 start "$APP_DIR/app-customer.js" \
  --name "app-customer" \
  --log "$APP_DIR/logs/pm2.log" \
  --time \
  -- 

# Simpan konfigurasi PM2
pm2 save

# Setup agar PM2 auto-start saat reboot
pm2 startup systemd -u root --hp /root 2>/dev/null || \
  pm2 startup 2>/dev/null || true

# Buka port di firewall jika ufw aktif
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow ${CURRENT_PORT}/tcp -qq
  echo -e "${GREEN}[OK]${NC} Firewall port ${CURRENT_PORT} dibuka."
fi

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          INSTALASI BERHASIL! ✓                   ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Portal Pelanggan dapat diakses di:${NC}"
echo -e "  ${CYAN}➜  http://${SERVER_IP}:${CURRENT_PORT}/login${NC}"
echo -e "  ${CYAN}➜  http://localhost:${CURRENT_PORT}/login${NC}"
echo ""
echo -e "  ${BOLD}Shortcut URL yang tersedia:${NC}"
echo -e "  ${YELLOW}http://[IP]:${CURRENT_PORT}/login${NC}     → halaman login (pendek)"
echo -e "  ${YELLOW}http://[IP]:${CURRENT_PORT}${NC}          → redirect ke login otomatis"
echo ""
echo -e "  ${BOLD}Perintah PM2 berguna:${NC}"
echo -e "  ${YELLOW}pm2 status${NC}              → lihat status aplikasi"
echo -e "  ${YELLOW}pm2 logs app-customer${NC}   → lihat log realtime"
echo -e "  ${YELLOW}pm2 restart app-customer${NC} → restart aplikasi"
echo -e "  ${YELLOW}pm2 stop app-customer${NC}   → stop aplikasi"
echo ""
echo -e "  ${BOLD}Edit konfigurasi:${NC} ${YELLOW}nano $APP_DIR/settings.json${NC}"
echo -e "  ${BOLD}Setelah edit, restart:${NC} ${YELLOW}pm2 restart app-customer${NC}"
echo ""
