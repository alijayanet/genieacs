/**
 * Service: Penjadwalan Tugas Otomatis (Cron)
 */
const cron = require('node-cron');
const billingSvc = require('./billingService');
const { logger } = require('../config/logger');

const customerSvc = require('./customerService');
const mikrotikService = require('./mikrotikService');
const { getSetting } = require('../config/settingsManager');

function startCronJobs() {
  // 1. Generate Tagihan Otomatis setiap tanggal 1 jam 00:01
  cron.schedule('1 0 1 * *', () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    logger.info(`[CRON] Menjalankan generate tagihan otomatis untuk ${month}/${year}`);
    try {
      const count = billingSvc.generateMonthlyInvoices(month, year);
      logger.info(`[CRON] Berhasil generate ${count} tagihan otomatis.`);
    } catch (error) {
      logger.error(`[CRON] Gagal generate tagihan otomatis: ${error.message}`);
    }
  });

  // 2. Isolir Otomatis setiap hari jam 02:00
  cron.schedule('0 2 * * *', async () => {
    const today = new Date().getDate();
    // Kita cek semua pelanggan setiap hari untuk isolir otomatis
    logger.info(`[CRON] Menjalankan pengecekan isolir otomatis harian (Tanggal ${today})`);
    
    const customers = customerSvc.getAllCustomers();
    let isolatedCount = 0;

    for (const c of customers) {
      // Cek apakah isolir otomatis aktif untuk user ini dan hari ini adalah tanggal isolirnya
      const customerIsolirDay = c.isolate_day || 10;
      const isAutoIsolateEnabled = c.auto_isolate !== 0; // default aktif jika null/1

      if (isAutoIsolateEnabled && today >= customerIsolirDay) {
        // Jika pelanggan aktif tapi punya tagihan belum bayar
        if (c.status === 'active' && c.unpaid_count > 0) {
          try {
            logger.info(`[CRON] Isolir otomatis pelanggan: ${c.name} (${c.pppoe_username}) - Tanggal Tagihan: ${customerIsolirDay}`);
            
            // Gunakan fungsi terpusat untuk isolir
            await customerSvc.suspendCustomer(c.id);
            
            isolatedCount++;
          } catch (err) {
            logger.error(`[CRON] Gagal isolir ${c.name}: ${err.message}`);
          }
        }
      }
    }
    logger.info(`[CRON] Selesai pengecekan isolir. Total ${isolatedCount} pelanggan baru di-isolir.`);
  });

  cron.schedule('0 9 * * *', async () => {
    const enabled = getSetting('whatsapp_auto_billing_enabled', false);
    const waEnabled = getSetting('whatsapp_enabled', false);
    if (!enabled || !waEnabled) return;

    let sendWA, whatsappStatus;
    try {
      const mod = await import('./whatsappBot.mjs');
      sendWA = mod.sendWA;
      whatsappStatus = mod.whatsappStatus;
    } catch (e) {
      logger.error(`[CRON] Gagal load WhatsApp bot: ${e.message || e}`);
      return;
    }

    if (!whatsappStatus || whatsappStatus.connection !== 'open') {
      logger.warn('[CRON] WhatsApp bot belum terhubung, pengingat tagihan otomatis dilewati.');
      return;
    }

    const resolveBaseUrl = () => {
      const explicit = String(getSetting('public_base_url', '') || '').trim();
      if (explicit) return explicit.replace(/\/+$/, '');

      const hostRaw = String(getSetting('server_host', 'localhost') || 'localhost').trim();
      const port = Number(getSetting('server_port', 3001) || 3001);
      const hasProto = /^https?:\/\//i.test(hostRaw);
      const proto = port === 443 ? 'https' : 'http';
      const host = hasProto ? hostRaw.replace(/\/+$/, '') : `${proto}://${hostRaw}`;
      const withPort = (port === 80 || port === 443) ? host : `${host}:${port}`;
      return withPort.replace(/\/+$/, '');
    };

    const loginLink = `${resolveBaseUrl()}/customer/login`;
    const delaySec = Number(getSetting('whatsapp_broadcast_delay', 2) || 2);
    const delayMs = Math.min(60, Math.max(1, Number.isFinite(delaySec) ? delaySec : 2)) * 1000;

    const today = new Date();
    const day = today.getDate();

    const customers = customerSvc.getAllCustomers();
    let targetCount = 0;
    let sent = 0;
    let failed = 0;

    const defaultTemplate =
      `Yth. Pelanggan {{nama}},\n\n` +
      `Ini adalah pengingat sebelum tanggal jatuh tempo/isolir.\n\n` +
      `📦 *Paket:* {{paket}}\n` +
      `💰 *Total Tagihan:* Rp {{tagihan}}\n` +
      `📅 *Periode:* {{rincian}}\n\n` +
      `Mohon segera melakukan pembayaran melalui portal pelanggan: {{link}}\n\n` +
      `Terima kasih atas kerja samanya.\n` +
      `Salam,\nAdmin ${getSetting('company_header', 'ISP')}`;
    const template = String(getSetting('whatsapp_auto_billing_message', defaultTemplate) || defaultTemplate);

    for (const c of customers) {
      try {
        const phone = c.phone ? String(c.phone).trim() : '';
        if (!phone || phone.length < 9) continue;
        const unpaidCount = Number(c.unpaid_count || 0) || 0;
        if (unpaidCount <= 0) continue;

        const dueDay = Number(c.isolate_day || 0) || Number(getSetting('isolir_day', 10) || 10) || 10;
        const remind1 = dueDay - 1;
        const shouldSend = remind1 >= 1 && day === remind1;
        if (!shouldSend) continue;

        const unpaidInvoices = billingSvc.getUnpaidInvoicesByCustomerId(c.id);
        const totalTagihan = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
        const rincianBulan = unpaidInvoices.map(inv => `${inv.period_month}/${inv.period_year}`).join(', ');

        targetCount++;
        if (targetCount > 1) await new Promise(r => setTimeout(r, delayMs));

        const formattedMsg = template
          .replace(/{{nama}}/gi, c.name || 'Pelanggan')
          .replace(/{{tagihan}}/gi, totalTagihan.toLocaleString('id-ID'))
          .replace(/{{rincian}}/gi, rincianBulan || '-')
          .replace(/{{paket}}/gi, c.package_name || '-')
          .replace(/{{link}}/gi, loginLink);

        const ok = await sendWA(phone, formattedMsg);
        if (ok) sent++;
        else failed++;
      } catch (e) {
        failed++;
        logger.error(`[CRON] Gagal kirim pengingat WA: ${e.message || e}`);
      }
    }

    if (targetCount > 0) {
      logger.info(`[CRON] Pengingat tagihan otomatis: target=${targetCount}, terkirim=${sent}, gagal=${failed}`);
    }
  });

  logger.info('[CRON] Semua tugas penjadwalan telah aktif.');
}

module.exports = { startCronJobs };
