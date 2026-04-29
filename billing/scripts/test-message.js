#!/usr/bin/env node

// Script untuk test pengiriman pesan ke admin
const fs = require('fs');
const path = require('path');

// Load settings
const settings = require('../settings.json');

console.log('=== Test Pengiriman Pesan WhatsApp ===\n');

// Cek konfigurasi admin
console.log('📋 Konfigurasi Admin:');
console.log(`Admin numbers: ${JSON.stringify(settings.admins)}`);
console.log(`WhatsApp timeout: ${settings.whatsapp_timeout}ms`);
console.log(`Notification timeout: ${settings.notification_timeout}ms`);
console.log('');

// Cek file superadmin.txt
try {
    const superAdminPath = path.join(__dirname, '../config/superadmin.txt');
    if (fs.existsSync(superAdminPath)) {
        const superAdmin = fs.readFileSync(superAdminPath, 'utf8').trim();
        console.log(`Super admin: ${superAdmin}`);
    } else {
        console.log('❌ File superadmin.txt tidak ditemukan');
    }
} catch (error) {
    console.log('❌ Error reading superadmin.txt:', error.message);
}

console.log('');

// Test message
const testMessage = `🧪 *TEST PESAN BOT*\n\n` +
    `✅ Ini adalah pesan test untuk memverifikasi koneksi WhatsApp\n` +
    `📅 Waktu: ${new Date().toLocaleString()}\n\n` +
    `🔧 Jika Anda menerima pesan ini, berarti:\n` +
    `• Koneksi WhatsApp berfungsi dengan baik\n` +
    `• Pengiriman pesan ke admin berhasil\n` +
    `• Bot siap digunakan\n\n` +
    `🏢 *ALIJAYA DIGITAL NETWORK*`;

console.log('📝 Pesan test yang akan dikirim:');
console.log(testMessage);
console.log('');

console.log('✅ Script test selesai. Jalankan aplikasi utama untuk test pengiriman pesan.');
console.log('💡 Tips: Gunakan "node scripts/restart-on-error.js" untuk menjalankan dengan auto-restart'); 