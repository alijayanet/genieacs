# 🚀 Portal Manajemen ISP & Billing System (Node.js + GenieACS + MikroTik)

Portal manajemen ISP modern yang dirancang khusus untuk efisiensi operasional RTRW-Net atau ISP lokal. Sistem ini mengintegrasikan penagihan (billing), pemantauan perangkat ONU (GenieACS), manajemen bandwidth (MikroTik), dan sistem notifikasi WhatsApp secara otomatis.

---

## ✨ Fitur Utama (Highlight)

### 1. 💰 Billing & Penagihan Otomatis
*   **Generate Tagihan:** Pembuatan invoice otomatis setiap bulan.
*   **Isolir Otomatis:** Integrasi dengan MikroTik untuk memutus layanan pelanggan yang menunggak secara otomatis.
*   **Cetak Invoice:** Fitur print invoice profesional untuk penagihan manual.
*   **Multi-Role:** Akses terpisah untuk **Super Admin** dan **Kasir** dengan hak akses yang aman.

### 2. 📡 Monitoring ONU (GenieACS TR-069)
*   **Status Real-time:** Pantau status Online/Offline, Redaman (RX Power), dan Uptime perangkat pelanggan.
*   **Remote Management:** Ubah Nama WiFi (SSID), Ganti Password WiFi, dan Reboot ONU langsung dari portal tanpa perlu ke rumah pelanggan.
*   **Data Akurat:** Pemetaan data perangkat berdasarkan serial number dan PPPoE username.

### 3. 🛠️ Portal Teknisi (Mobile First)
*   **Optimasi Mobile:** Tampilan responsif yang ringan dibuka melalui smartphone teknisi di lapangan.
*   **Manajemen Tiket:** Teknisi dapat menerima dan menyelesaikan keluhan pelanggan langsung dari portal.
*   **Monitoring Mandiri:** Teknisi bisa membantu pelanggan setting WiFi (SSID/Password) dari HP mereka.

### 4. 📲 Integrasi WhatsApp (Baileys API)
*   **Notifikasi Tagihan:** Kirim pengingat tagihan otomatis ke WhatsApp pelanggan.
*   **Broadcast Massal:** Kirim pesan pengumuman (maintenance, promo, dll) ke seluruh pelanggan dengan satu klik.
*   **Progress Tracker:** Fitur counter real-time untuk memantau status pengiriman broadcast.
*   **Delay Aman:** Pengaturan jeda antar pesan untuk menghindari blokir (spam protection).

### 5. 📊 Dashboard & Laporan
*   **Statistik Keuangan:** Grafik pendapatan bulanan dan total tunggakan.
*   **Monitoring MikroTik:** Cek status interface, CPU load, dan user aktif langsung dari dashboard.

---

## 🛠️ Teknologi yang Digunakan
*   **Backend:** Node.js, Express.js
*   **Database:** SQLite (Better-SQLite3) - Ringan & Cepat
*   **Frontend:** EJS Templating, Vanilla CSS, Bootstrap Icons
*   **Integrasi:**
    *   **GenieACS API** (TR-069 Management)
    *   **MikroTik API** (Router Management)
    *   **Baileys** (WhatsApp Web API)

---

## 🧠 Catatan Teknis (Audit & Pegangan Pengembangan)

Bagian ini merangkum struktur kode, alur penting, dan catatan audit supaya pengembangan berikutnya lebih cepat dan konsisten.

### 1) Struktur Folder (High Level)
*   **Entry point:** [app-customer.js](file:///d:/app-customer/app-customer.js)
*   **Konfigurasi:** [config/settingsManager.js](file:///d:/app-customer/config/settingsManager.js), [settings.json](file:///d:/app-customer/settings.json), [config/logger.js](file:///d:/app-customer/config/logger.js), [config/database.js](file:///d:/app-customer/config/database.js)
*   **Routes:** [routes/adminPortal.js](file:///d:/app-customer/routes/adminPortal.js), [routes/customerPortal.js](file:///d:/app-customer/routes/customerPortal.js), [routes/techPortal.js](file:///d:/app-customer/routes/techPortal.js)
*   **Services utama:** billing, payment, cron, GenieACS device, MikroTik, WhatsApp/Telegram bot (folder [services](file:///d:/app-customer/services))
*   **Views (EJS):** folder [views](file:///d:/app-customer/views)

### 2) Cara Aplikasi Start
*   Express + session jalan dari [app-customer.js](file:///d:/app-customer/app-customer.js#L1-L165)
*   Bot WhatsApp dijalankan saat `whatsapp_enabled=true`: [app-customer.js](file:///d:/app-customer/app-customer.js#L149-L153)
*   Bot Telegram dijalankan saat `telegram_enabled=true`: [app-customer.js](file:///d:/app-customer/app-customer.js#L155-L158)
*   Cron job selalu start: [app-customer.js](file:///d:/app-customer/app-customer.js#L160-L162)

### 3) Konfigurasi & Settings
*   Settings dibaca dari `settings.json` dan bisa berubah tanpa restart (ada watcher + cache 2 detik): [settingsManager.js](file:///d:/app-customer/config/settingsManager.js#L5-L110)
*   Kunci yang krusial:
    *   **Session & keamanan:** `session_secret`, `cookie_secure`, `trust_proxy`
    *   **WhatsApp:** `whatsapp_enabled`, `whatsapp_auth_folder`, `whatsapp_lid_map_file`, `whatsapp_broadcast_delay`
    *   **GenieACS:** `genieacs_url`, `genieacs_username`, `genieacs_password`
    *   **MikroTik:** `mikrotik_host`, `mikrotik_port`, `mikrotik_user`, `mikrotik_password` + tabel `routers` untuk multi-router
    *   **Payment gateway:** `default_gateway` + kredensial gateway (Tripay/Midtrans/Xendit/Duitku)

### 4) Database (SQLite)
*   DB file default: `database/billing.db` (WAL mode): [database.js](file:///d:/app-customer/config/database.js#L8-L18)
*   Skema utama:
    *   **customers / packages / invoices** untuk billing: [database.js](file:///d:/app-customer/config/database.js#L24-L83)
    *   **routers / olts / odps** untuk perangkat/jaringan: [database.js](file:///d:/app-customer/config/database.js#L95-L129)
    *   **tickets / technicians / cashiers** untuk workflow operasional: [database.js](file:///d:/app-customer/config/database.js#L50-L94)
    *   **voucher_batches / vouchers** untuk hotspot voucher: [database.js](file:///d:/app-customer/config/database.js#L131-L168)
*   Migrasi dilakukan via `ALTER TABLE` dengan try/catch (idempotent tapi tidak “versioned”): [database.js](file:///d:/app-customer/config/database.js#L170-L220)

### 5) Alur Penting (Yang Paling Sering Disentuh Saat Dev)
*   **Generate invoice bulanan (cron):** [cronService.js](file:///d:/app-customer/services/cronService.js#L12-L26), logic billing: [billingService.js](file:///d:/app-customer/services/billingService.js#L6-L21)
*   **Isolir otomatis (cron):** cek `auto_isolate` + `isolate_day` per pelanggan: [cronService.js](file:///d:/app-customer/services/cronService.js#L28-L59)
*   **Isolir / buka isolir (core):** ubah status + ubah profile PPPoE: [customerService.js](file:///d:/app-customer/services/customerService.js#L158-L187) dan [mikrotikService.js](file:///d:/app-customer/services/mikrotikService.js#L86-L156)
*   **Payment link per invoice:** create link + simpan metadata pembayaran: [customerPortal.js](file:///d:/app-customer/routes/customerPortal.js#L499-L560), simpan ke DB: [billingService.js](file:///d:/app-customer/services/billingService.js#L167-L182)
*   **Webhook payment gateway:** verifikasi + tandai lunas + auto-aktivasi + notif WA: [customerPortal.js](file:///d:/app-customer/routes/customerPortal.js#L563-L665)
*   **GenieACS lookup & mapping:** [customerDeviceService.js](file:///d:/app-customer/services/customerDeviceService.js#L8-L204)
*   **WhatsApp broadcast:** route + tracker global: [adminPortal.js](file:///d:/app-customer/routes/adminPortal.js#L1499-L1614)

### 6) Catatan Audit (Risiko & Perbaikan yang Direkomendasikan)
*   **Kredensial & rahasia:** `settings.json` berisi banyak rahasia (session secret, API key, password). Idealnya pindah ke environment variable di server dan `settings.json` hanya untuk non-secret.
*   **Password user internal:** tabel `technicians` dan `cashiers` menyimpan password plaintext. Idealnya hashing (bcrypt/argon2) dan migrasi bertahap.
*   **Webhook Tripay (raw body):** verifikasi signature Tripay memakai `JSON.stringify(req.body)`. Secara umum signature webhook membutuhkan *raw request body* persis seperti diterima server; perlu middleware raw-body untuk akurasi.
*   **Webhook Xendit token:** kalau `xendit_callback_token` kosong, callback diterima tanpa token. Ini berisiko di server publik.
*   **Konsistensi admin WhatsApp:** nomor admin untuk “hak admin” di WA bot harus konsisten dengan nomor yang dipakai untuk notifikasi dari portal (saat ini portal memakai `settings.whatsapp_admin_numbers`, sedangkan WA bot bisa memiliki aturan sendiri).
*   **Ketahanan broadcast:** broadcast berjalan async di proses utama dan status disimpan di `global`. Jika app dijalankan multi-process/PM2 cluster, status bisa tidak konsisten.

### 7) Checklist Saat Mau Nambah Fitur
*   Tentukan titik masuk: route (admin/customer/tech) vs bot (WA/Telegram) vs cron.
*   Jika butuh data baru, cek schema di [database.js](file:///d:/app-customer/config/database.js) dan pertimbangkan migrasi yang aman (idempotent + fallback).
*   Jika fitur menyentuh notifikasi, pastikan ada jeda aman + logging error + tidak bikin request user hang.
*   Hindari menulis rahasia ke log (API key, token, password).

## 📸 Demo & Kontak
Tertarik dengan sistem ini atau ingin konsultasi seputar infrastruktur ISP?

*   **Demo Website:** Masukkan Link Demo Anda
*   **WhatsApp:** 081947215703
*   **Email:** alijayanet@gmail.com

---

> **Note:** Integrasi Payment Gateway (Tripay/Midtrans/Xendit/Duitku) dan Telegram Bot sudah tersedia dan teruji. Silakan aktifkan/konfigurasi lewat menu **Settings** (atau `settings.json`) sesuai kebutuhan server Anda.

#ISP #RTRWNet #BillingSystem #NodeJS #GenieACS #MikroTik #WhatsAppBot #SoftwareISP
