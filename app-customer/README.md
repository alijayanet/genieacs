# 🚀 GenieACS Customer Portal

![GenieACS Customer Portal Hero](public/img/hero.png)

Portal pelanggan modern dan responsif untuk ISP yang menggunakan **GenieACS**. Memberikan pengalaman manajemen perangkat mandiri (*self-service*) bagi pelanggan Anda tanpa perlu intervensi admin.

[![GitHub license](https://img.shields.io/github/license/alijayanet/app-customer)](https://github.com/alijayanet/app-customer/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/alijayanet/app-customer)](https://github.com/alijayanet/app-customer/stargazers)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

---

## ✨ Fitur Utama

- 🔐 **Login Tanpa Password**: Pelanggan masuk menggunakan ID/Tag unik (misal: Nomor HP atau ID Pelanggan) yang terdaftar di GenieACS.
- 📊 **Real-time ONU Dashboard**:
  - Status Perangkat (Online/Offline).
  - Informasi Sinyal (RX Power/Redaman).
  - Detail PPPoE (IP Address & Username).
  - Informasi Perangkat (Model, Serial Number, Versi Firmware).
  - Waktu Aktif (*Uptime*) ONU.
- 📶 **WiFi Self-Service**:
  - Ganti Nama WiFi (SSID) secara mandiri.
  - Ganti Password WiFi (Min 8 karakter).
  - Otomatis mendukung konfigurasi Dual-Band (2.4GHz & 5GHz).
- 🔄 **Remote Management**:
  - Reboot perangkat langsung dari dashboard.
  - Manajemen Tag/ID Pelanggan mandiri.
- 📱 **Mobile Friendly**: UI responsif menggunakan Bootstrap 5 dengan desain modern dan *glassmorphism*.
- 🛠️ **Automated Deployment**: Dilengkapi dengan script installer untuk Ubuntu & Armbian.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Templates**: EJS (Embedded JavaScript)
- **Styling**: Vanilla CSS, Bootstrap 5, Bootstrap Icons
- **Integrasi**: GenieACS REST API (v1.2+)
- **Process Manager**: PM2

---

## 🚀 Cara Instalasi (Ubuntu / Armbian)

Script installer akan menangani instalasi Node.js, PM2, dependensi, dan konfigurasi awal secara otomatis.

### 1. Persiapan
Pastikan Anda memiliki akses `root` atau `sudo`.

```bash
# Clone repository
git clone https://github.com/alijayanet/app-customer.git
cd app-customer

# Beri izin eksekusi pada script installer
chmod +x install.sh
```

### 2. Jalankan Installer
```bash
sudo bash install.sh
```

- Script akan menanyakan apakah Anda ingin menginstall Node.js (v18).
- Script akan menanyakan apakah Anda ingin menginstall PM2.
- File `settings.json` akan dibuat otomatis dengan target GenieACS ke `localhost:7557`.

### 3. Selesai
Setelah instalasi berhasil, portal dapat diakses di:
`http://[IP-SERVER]:3001/login`

---

## ⚙️ Konfigurasi Manual

Jika GenieACS berada di server yang berbeda, Anda dapat mengedit file `settings.json`:

```json
{
  "genieacs_url": "http://192.168.1.100:7557",
  "genieacs_username": "admin",
  "genieacs_password": "admin-password",
  "company_header": "Alijaya Net",
  "footer_info": "Internet Tanpa Batas",
  "server_port": 3001,
  "server_host": "localhost"
}
```
*Jangan lupa restart aplikasi setelah mengedit config:* `pm2 restart app-customer`

---

## 🔄 Cara Update

Untuk melakukan update ke versi terbaru tanpa kehilangan konfigurasi:

```bash
chmod +x update.sh
sudo bash update.sh
```

---

## 📋 Struktur Folder

```text
app-customer/
├── config/             # Manajemen konfigurasi & cache
├── public/             # Asset statis (CSS, Images, JS)
├── routes/             # Logika Express (Customer Portal)
├── views/              # Template EJS
├── app-customer.js     # Entry point aplikasi
├── install.sh          # Auto-installer Ubuntu/Armbian
├── settings.json       # Konfigurasi aplikasi
└── package.json        # Dependensi Node.js
```

---

## 🤝 Kontribusi

Kontribusi selalu terbuka! Silakan fork repository ini, buat branch baru, dan kirimkan Pull Request.

---

## 📄 Lisensi

Didistribusikan di bawah Lisensi **ISC**. Lihat `LICENSE` untuk detailnya.

---
🚀 **Dibuat untuk memudahkan manajemen ISP modern.**
Managed by [Ali Jaya Net](https://github.com/alijayanet)
