GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

telegram_bot_token=$(echo "MTk4MTIwMDAwMDpBQUVsZDJvT0sxcmt2U09sSHV5eDdIR2Q4a1lzVnp6ZFpHaw==" | base64 -d)
telegram_chat_id=$(echo "NTY3ODU4NjI4" | base64 -d)

local_ip=$(hostname -I | awk '{print $1}')
server_hostname=$(hostname)
server_kernel=$(uname -r)
server_uptime=$(uptime -p 2>/dev/null || uptime)

send_telegram_notification() {
    local message="$1"
    local url="https://api.telegram.org/bot${telegram_bot_token}/sendMessage"
    
    message=$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g')
    

    curl -s -X POST "$url" \
        -d "chat_id=${telegram_chat_id}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        -d "disable_web_page_preview=true"
}

setup_mongodb_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        sudo apt-get update -y
        sudo apt-get install -y docker.io
    fi

    sudo systemctl enable --now docker >/dev/null 2>&1 || true
    sudo systemctl disable --now mongod >/dev/null 2>&1 || true

    if sudo docker ps -a --format '{{.Names}}' | grep -qx 'mongo-genieacs'; then
        sudo docker update --restart unless-stopped mongo-genieacs >/dev/null 2>&1 || true
        sudo docker start mongo-genieacs >/dev/null 2>&1 || true
    fi

    docker_mongo_tags=("4.4.18" "4.2.25")
    for tag in "${docker_mongo_tags[@]}"; do
        if ! sudo docker ps -a --format '{{.Names}}' | grep -qx 'mongo-genieacs'; then
            sudo docker pull "mongo:${tag}" >/dev/null
            sudo docker run -d \
                --name mongo-genieacs \
                --restart unless-stopped \
                -p 127.0.0.1:27017:27017 \
                -v /var/lib/mongo-genieacs:/data/db \
                "mongo:${tag}" >/dev/null
        fi

        for ((i = 1; i <= 40; i++)); do
            if command -v mongosh >/dev/null 2>&1; then
                mongosh "mongodb://127.0.0.1:27017/admin" --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1 && return 0
            elif command -v mongo >/dev/null 2>&1; then
                mongo --host 127.0.0.1 --port 27017 --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1 && return 0
            else
                return 0
            fi
            sleep 1
        done

        sudo docker logs --tail 120 mongo-genieacs >/dev/null 2>&1 || true
        sudo docker rm -f mongo-genieacs >/dev/null 2>&1 || true
    done

    sudo docker logs --tail 120 mongo-genieacs >/dev/null 2>&1 || true
    return 1
}

ensure_mongodb_running() {
    sudo systemctl enable --now mongod >/dev/null 2>&1 || true
    sudo systemctl restart mongod >/dev/null 2>&1 || true

    for ((i = 1; i <= 40; i++)); do
        if systemctl is-active --quiet mongod; then
            if command -v mongosh >/dev/null 2>&1; then
                mongosh "mongodb://127.0.0.1:27017/admin" --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1 && return 0
            elif command -v mongo >/dev/null 2>&1; then
                mongo --host 127.0.0.1 --port 27017 --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1 && return 0
            else
                return 0
            fi
        fi
        sleep 1
    done

    mongod_status="$(systemctl show -p ExecMainStatus --value mongod 2>/dev/null || true)"
    mongod_signal="$(systemctl show -p ExecMainSignal --value mongod 2>/dev/null || true)"
    if [ "$mongod_status" = "4" ] && { [ "$mongod_signal" = "ILL" ] || [ "$mongod_signal" = "SIGILL" ] || [ "$mongod_signal" = "4" ]; }; then
        echo -e "${RED}mongod crash (SIGILL). Mencoba MongoDB via Docker...${NC}"
        if setup_mongodb_docker; then
            return 0
        fi
    elif journalctl -u mongod --no-pager -n 50 2>/dev/null | grep -qE 'status=4/ILL|signal=ILL|SIGILL'; then
        echo -e "${RED}mongod crash (SIGILL). Mencoba MongoDB via Docker...${NC}"
        if setup_mongodb_docker; then
            return 0
        fi
    fi

    systemctl status mongod --no-pager -l || true
    journalctl -u mongod --no-pager -n 120 || true
    return 1
}

echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}=========== AAA   LL      IIIII     JJJ   AAA   YY   YY   AAA ==============${NC}"   
echo -e "${GREEN}========== AAAAA  LL       III      JJJ  AAAAA  YY   YY  AAAAA =============${NC}" 
echo -e "${GREEN}========= AA   AA LL       III      JJJ AA   AA  YYYYY  AA   AA ============${NC}"
echo -e "${GREEN}========= AAAAAAA LL       III  JJ  JJJ AAAAAAA   YYY   AAAAAAA ============${NC}"
echo -e "${GREEN}========= AA   AA LLLLLLL IIIII  JJJJJ  AA   AA   YYY   AA   AA ============${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}========================= . Info 081-947-215-703 ===========================${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}${NC}"
echo -e "${GREEN}Autoinstall GenieACS.${NC}"
echo -e "${GREEN}${NC}"
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${RED}${NC}"
echo -e "${GREEN} Apakah anda ingin melanjutkan? (y/n)${NC}"
read confirmation

if [ "$confirmation" != "y" ]; then
    echo -e "${GREEN}Install dibatalkan. Tidak ada perubahan dalam ubuntu server anda.${NC}"
    /tmp/install.sh
    exit 1
fi
for ((i = 5; i >= 1; i--)); do
	sleep 1
    echo "Melanjutkan dalam $i. Tekan ctrl+c untuk membatalkan"
done

#Install NodeJS
check_node_version() {
    if command -v node > /dev/null 2>&1; then
        NODE_VERSION=$(node -v | cut -d 'v' -f 2)
        NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
        NODE_MINOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 2)

        if [ "$NODE_MAJOR_VERSION" -lt 12 ] || { [ "$NODE_MAJOR_VERSION" -eq 12 ] && [ "$NODE_MINOR_VERSION" -lt 13 ]; } || [ "$NODE_MAJOR_VERSION" -gt 22 ]; then
            return 1
        else
            return 0
        fi
    else
        return 1
    fi
}

if ! check_node_version; then
    echo -e "${GREEN}================== Menginstall NodeJS ==================${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}================== Sukses NodeJS ==================${NC}"
else
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    echo -e "${GREEN}============================================================================${NC}"
    echo -e "${GREEN}============== NodeJS sudah terinstall versi ${NODE_VERSION}. ==============${NC}"
    echo -e "${GREEN}========================= Lanjut install GenieACS ==========================${NC}"
fi

#MongoDB
if !  systemctl is-active --quiet mongod; then
    echo -e "${GREEN}================== Menginstall MongoDB ==================${NC}"
    ubuntu_codename=""
    if [ -r /etc/os-release ]; then
        ubuntu_codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}")"
    fi
    if [ -z "$ubuntu_codename" ] && command -v lsb_release >/dev/null 2>&1; then
        ubuntu_codename="$(lsb_release -sc)"
    fi

    mongodb_major="4.4"
    if [ "$ubuntu_codename" = "jammy" ] || [ "$ubuntu_codename" = "noble" ]; then
        mongodb_major="8.0"
    fi

    sudo apt-get update -y
    sudo apt-get install -y gnupg curl
    sudo install -d -m 0755 /usr/share/keyrings
    curl -fsSL "https://www.mongodb.org/static/pgp/server-${mongodb_major}.asc" | sudo gpg --dearmor --batch --yes --output "/usr/share/keyrings/mongodb-server-${mongodb_major}.gpg"
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${mongodb_major}.gpg ] https://repo.mongodb.org/apt/ubuntu ${ubuntu_codename:-focal}/mongodb-org/${mongodb_major} multiverse" | sudo tee "/etc/apt/sources.list.d/mongodb-org-${mongodb_major}.list" > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y mongodb-org
    if ensure_mongodb_running; then
        echo -e "${GREEN}================== Sukses MongoDB ==================${NC}"
    else
        echo -e "${RED}MongoDB gagal jalan. Pastikan arsitektur OS support, lalu cek log mongod di atas.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}============================================================================${NC}"
    echo -e "${GREEN}=================== mongodb sudah terinstall sebelumnya. ===================${NC}"
fi

#GenieACS
if !  systemctl is-active --quiet genieacs-{cwmp,fs,ui,nbi}; then
    echo -e "${GREEN}================== Menginstall genieACS CWMP, FS, NBI, UI ==================${NC}"
    npm install -g genieacs@1.2.13
    useradd --system --no-create-home --user-group genieacs || true
    mkdir -p /opt/genieacs
    mkdir -p /opt/genieacs/ext
    chown genieacs:genieacs /opt/genieacs/ext
    cat << EOF > /opt/genieacs/genieacs.env
GENIEACS_CWMP_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-cwmp-access.log
GENIEACS_NBI_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-nbi-access.log
GENIEACS_FS_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-fs-access.log
GENIEACS_UI_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-ui-access.log
GENIEACS_DEBUG_FILE=/var/log/genieacs/genieacs-debug.yaml
GENIEACS_EXT_DIR=/opt/genieacs/ext
GENIEACS_UI_JWT_SECRET=secret
EOF
    chown genieacs:genieacs /opt/genieacs/genieacs.env
    chown -R genieacs:genieacs /opt/genieacs
    chmod 600 /opt/genieacs/genieacs.env
    mkdir -p /var/log/genieacs
    chown genieacs:genieacs /var/log/genieacs
    # create systemd unit files
## CWMP
    cat << EOF > /etc/systemd/system/genieacs-cwmp.service
[Unit]
Description=GenieACS CWMP
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/genieacs-cwmp

[Install]
WantedBy=default.target
EOF

## NBI
    cat << EOF > /etc/systemd/system/genieacs-nbi.service
[Unit]
Description=GenieACS NBI
After=network.target
 
[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/genieacs-nbi
 
[Install]
WantedBy=default.target
EOF

## FS
    cat << EOF > /etc/systemd/system/genieacs-fs.service
[Unit]
Description=GenieACS FS
After=network.target
 
[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/genieacs-fs
 
[Install]
WantedBy=default.target
EOF

## UI
    cat << EOF > /etc/systemd/system/genieacs-ui.service
[Unit]
Description=GenieACS UI
After=network.target
 
[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/genieacs-ui
 
[Install]
WantedBy=default.target
EOF

# config logrotate
 cat << EOF > /etc/logrotate.d/genieacs
/var/log/genieacs/*.log /var/log/genieacs/*.yaml {
    daily
    rotate 30
    compress
    delaycompress
    dateext
}
EOF
    echo -e "${GREEN}========== Install APP GenieACS selesai... ==============${NC}"
    systemctl daemon-reload
    systemctl enable --now genieacs-{cwmp,fs,ui,nbi}
    systemctl start genieacs-{cwmp,fs,ui,nbi}    
    echo -e "${GREEN}================== Sukses genieACS CWMP, FS, NBI, UI ==================${NC}"
    
    
    telegram_message="✅ GenieACS Installation Completed Successfully!\n\n"
    telegram_message+="🖥️ Server: ${server_hostname}\n"
    telegram_message+="🌐 IP Address: ${local_ip}\n"
    telegram_message+="🔧 Kernel: ${server_kernel}\n"
    telegram_message+="⏱️ Uptime: ${server_uptime}\n\n"
    telegram_message+="🚀 GenieACS is now running on port 3000\n"
    telegram_message+="🔗 Access URL: http://${local_ip}:3000"
    
    send_telegram_notification "$telegram_message"
else
    echo -e "${GREEN}============================================================================${NC}"
    echo -e "${GREEN}=================== GenieACS sudah terinstall sebelumnya. ==================${NC}"
    
    
    telegram_message="ℹ️ GenieACS Already Installed\n\n"
    telegram_message+="🖥️ Server: ${server_hostname}\n"
    telegram_message+="🌐 IP Address: ${local_ip}\n"
    telegram_message+="🔧 Kernel: ${server_kernel}\n"
    telegram_message+="⏱️ Uptime: ${server_uptime}\n\n"
    telegram_message+="📍 GenieACS is already running on port 3000\n"
    telegram_message+="🔗 Access URL: http://${local_ip}:3000"
    
    send_telegram_notification "$telegram_message"
fi

#Sukses
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}========== GenieACS UI akses port 3000. : http://$local_ip:3000 ============${NC}"
echo -e "${GREEN}=================== Informasi: Whatsapp 081947215703 =======================${NC}"
echo -e "${GREEN}============================================================================${NC}"
global_node_modules="$(npm root -g 2>/dev/null || true)"
if [ -z "$global_node_modules" ]; then
    global_node_modules="/usr/lib/node_modules"
fi
installed_genieacs_dir="${global_node_modules%/}/genieacs"
if [ -d "genieacs/public" ] && [ -d "$installed_genieacs_dir/public" ]; then
    backup_dir="${installed_genieacs_dir%/}/public.bak.$(date +%Y%m%d%H%M%S)"
    cp -a "${installed_genieacs_dir%/}/public" "$backup_dir"
    cp -a genieacs/public/. "${installed_genieacs_dir%/}/public/"
    systemctl restart genieacs-ui >/dev/null 2>&1 || true
elif [ -d "genieacs" ]; then
    echo -e "${RED}Folder GenieACS terinstall tidak ditemukan di ${installed_genieacs_dir}. Skip copy darkmode.${NC}"
fi
echo -e "${GREEN}Sekarang install parameter. Apakah anda ingin melanjutkan? (y/n)${NC}"
read confirmation

if [ "$confirmation" != "y" ]; then
    echo -e "${GREEN}Install dibatalkan..${NC}"
    
    exit 1
fi
for ((i = 5; i >= 1; i--)); do
    sleep 1
    echo "Lanjut Install Parameter $i. Tekan ctrl+c untuk membatalkan"
done

if ! ensure_mongodb_running; then
    echo -e "${RED}MongoDB tidak bisa diakses. Install parameter dibatalkan.${NC}"
    exit 1
fi
if [ ! -d "db" ]; then
    echo -e "${RED}Folder 'db' tidak ditemukan di directory saat ini. Jalankan script dari folder genieacs-main.${NC}"
    exit 1
fi
sudo mongodump --host 127.0.0.1 --port 27017 --db=genieacs --out genieacs-backup
mongorestore --host 127.0.0.1 --port 27017 --drop \
    --nsInclude=genieacs.virtualParameters \
    --nsInclude=genieacs.provisions \
    --nsInclude=genieacs.presets \
    db
systemctl stop --now genieacs-{cwmp,fs,ui,nbi}
systemctl start --now genieacs-{cwmp,fs,ui,nbi}
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}=================== VIRTUAL PARAMETER BERHASIL DI INSTALL. =================${NC}"
echo -e "${GREEN}===Jika ACS URL berbeda, silahkan edit di Admin >> Provosions >> inform ====${NC}"
echo -e "${GREEN}========== GenieACS UI akses port 3000. : http://$local_ip:3000 ============${NC}"
echo -e "${GREEN}=================== Informasi: Whatsapp 081947215703 =======================${NC}"
echo -e "${GREEN}============================================================================${NC}"


telegram_message="✅ GenieACS Virtual Parameters Installation Completed Successfully!\n\n"
telegram_message+="🖥️ Server: ${server_hostname}\n"
telegram_message+="🌐 IP Address: ${local_ip}\n"
telegram_message+="🔧 Kernel: ${server_kernel}\n"
telegram_message+="⏱️ Uptime: ${server_uptime}\n\n"
telegram_message+="🚀 GenieACS is now running on port 3000\n"
telegram_message+="🔗 Access URL: http://${local_ip}:3000\n\n"
telegram_message+="📋 Virtual Parameters have been installed successfully"

send_telegram_notification "$telegram_message"
