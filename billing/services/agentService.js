const db = require('../config/database');
const billingSvc = require('./billingService');
const customerSvc = require('./customerService');
const mikrotikSvc = require('./mikrotikService');

function authenticate(username, password) {
  return db
    .prepare('SELECT * FROM agents WHERE username = ? AND password = ? AND is_active = 1')
    .get(username, password);
}

function getAllAgents() {
  return db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
}

function getAgentById(id) {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
}

function createAgent(data) {
  return db
    .prepare(
      'INSERT INTO agents (username, password, name, phone, balance, billing_fee, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    )
    .run(
      String(data.username || '').trim(),
      String(data.password || ''),
      String(data.name || '').trim(),
      String(data.phone || '').trim(),
      Math.max(0, Number(data.balance || 0) || 0),
      Math.max(0, Number(data.billing_fee || 0) || 0)
    );
}

function updateAgent(id, data) {
  const existing = getAgentById(id);
  if (!existing) throw new Error('Agent tidak ditemukan');

  const next = {
    username: String(data.username ?? existing.username).trim(),
    password: String(data.password ?? existing.password),
    name: String(data.name ?? existing.name).trim(),
    phone: String(data.phone ?? existing.phone).trim(),
    billing_fee: Math.max(0, Number(data.billing_fee ?? existing.billing_fee) || 0),
    is_active: data.is_active !== undefined ? (String(data.is_active) === '1' ? 1 : 0) : existing.is_active
  };

  return db
    .prepare(
      'UPDATE agents SET username=?, password=?, name=?, phone=?, billing_fee=?, is_active=? WHERE id=?'
    )
    .run(next.username, next.password, next.name, next.phone, next.billing_fee, next.is_active, id);
}

function deleteAgent(id) {
  return db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

function getAgentPrices(agentId) {
  return db
    .prepare(
      `
      SELECT p.*, r.name AS router_name
      FROM agent_hotspot_prices p
      LEFT JOIN routers r ON r.id = p.router_id
      WHERE p.agent_id = ?
      ORDER BY p.is_active DESC, r.name ASC, p.profile_name ASC
    `
    )
    .all(agentId);
}

function upsertAgentHotspotPrice(agentId, data) {
  const routerId = data.router_id !== undefined && data.router_id !== null && String(data.router_id).trim() !== ''
    ? Number(data.router_id)
    : null;
  const profileName = String(data.profile_name || '').trim();
  if (!profileName) throw new Error('Profile hotspot wajib diisi');

  const buyPrice = Math.max(0, Number(data.buy_price || 0) || 0);
  const sellPrice = Math.max(0, Number(data.sell_price || 0) || 0);
  const validity = String(data.validity || '').trim();
  const isActive = data.is_active !== undefined ? (String(data.is_active) === '1' ? 1 : 0) : 1;

  const existing = db
    .prepare(
      'SELECT id FROM agent_hotspot_prices WHERE agent_id = ? AND router_id IS ? AND profile_name = ?'
    )
    .get(agentId, routerId, profileName);

  if (existing) {
    return db
      .prepare(
        'UPDATE agent_hotspot_prices SET validity=?, buy_price=?, sell_price=?, is_active=? WHERE id=?'
      )
      .run(validity, buyPrice, sellPrice, isActive, existing.id);
  }

  return db
    .prepare(
      'INSERT INTO agent_hotspot_prices (agent_id, router_id, profile_name, validity, buy_price, sell_price, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(agentId, routerId, profileName, validity, buyPrice, sellPrice, isActive);
}

function deleteAgentHotspotPrice(agentId, priceId) {
  return db
    .prepare('DELETE FROM agent_hotspot_prices WHERE id = ? AND agent_id = ?')
    .run(priceId, agentId);
}

function listAgentTransactions({ agentId = null, limit = 300 } = {}) {
  const aId = agentId !== null && agentId !== undefined && String(agentId).trim() !== '' ? Number(agentId) : null;
  return db
    .prepare(
      `
      SELECT t.*, a.name AS agent_name, c.name AS customer_name, c.phone AS customer_phone, r.name AS router_name
      FROM agent_transactions t
      JOIN agents a ON a.id = t.agent_id
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN routers r ON r.id = t.router_id
      WHERE (? IS NULL OR t.agent_id = ?)
      ORDER BY t.id DESC
      LIMIT ?
    `
    )
    .all(aId, aId, Math.max(1, Math.min(2000, Number(limit) || 300)));
}

function getAgentTransactionById(agentId, txId) {
  const aId = Number(agentId || 0);
  const tId = Number(txId || 0);
  if (!aId || !tId) return null;
  return db
    .prepare(
      `
      SELECT t.*, a.name AS agent_name, a.username AS agent_username, r.name AS router_name
      FROM agent_transactions t
      JOIN agents a ON a.id = t.agent_id
      LEFT JOIN routers r ON r.id = t.router_id
      WHERE t.id = ? AND t.agent_id = ?
    `
    )
    .get(tId, aId);
}

function topupAgent(agentId, amount, note, actorName = 'Admin') {
  const delta = Math.floor(Number(amount) || 0);
  if (!Number.isFinite(delta) || delta <= 0) throw new Error('Nominal topup tidak valid');

  const agent = getAgentById(agentId);
  if (!agent) throw new Error('Agent tidak ditemukan');

  const run = db.transaction(() => {
    const fresh = getAgentById(agentId);
    const before = Number(fresh.balance || 0);
    const after = before + delta;

    db.prepare('UPDATE agents SET balance = ? WHERE id = ?').run(after, agentId);
    db.prepare(
      `
      INSERT INTO agent_transactions (
        agent_id, type, amount_buy, amount_sell, fee, balance_before, balance_after, note
      ) VALUES (?, 'topup', ?, ?, 0, ?, ?, ?)
    `
    ).run(agentId, delta, delta, before, after, `${actorName}: ${note || 'Topup saldo'}`);

    return { before, after };
  });

  return run();
}

async function payInvoiceAsAgent(agentId, invoiceId, note = '') {
  const inv = billingSvc.getInvoiceById(invoiceId);
  if (!inv) throw new Error('Tagihan tidak ditemukan');
  if (inv.status === 'paid') throw new Error('Tagihan sudah lunas');

  const agent = getAgentById(agentId);
  if (!agent || !agent.is_active) throw new Error('Akun agent tidak aktif');

  const fee = Math.max(0, Number(agent.billing_fee || 0) || 0);
  const cost = Math.max(0, Number(inv.amount || 0) - fee);
  const safeNote = String(note || '').trim();

  const run = db.transaction(() => {
    const fresh = getAgentById(agentId);
    const before = Number(fresh.balance || 0);
    if (before < cost) throw new Error('Saldo agent tidak cukup');

    const after = before - cost;
    db.prepare('UPDATE agents SET balance = ? WHERE id = ?').run(after, agentId);

    db.prepare(
      `
      INSERT INTO agent_transactions (
        agent_id, type, invoice_id, customer_id,
        amount_invoice, amount_buy, amount_sell, fee,
        balance_before, balance_after, note
      ) VALUES (?, 'invoice_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    );
    const ins = insertTx.run(
      agentId,
      inv.id,
      inv.customer_id,
      inv.amount,
      cost,
      inv.amount,
      fee,
      before,
      after,
      safeNote
    );

    const paidByName = `Agent ${agent.name} (@${agent.username})`;
    const notesParts = [
      'Via Agent',
      `Fee: Rp ${fee.toLocaleString('id-ID')}`,
      `Potong saldo: Rp ${cost.toLocaleString('id-ID')}`
    ];
    if (safeNote) notesParts.push(safeNote);
    const notes = notesParts.join(' | ');

    billingSvc.markAsPaid(inv.id, paidByName, notes);

    return { id: Number(ins.lastInsertRowid), before, after, cost, fee };
  });

  const tx = run();

  const customer = customerSvc.getCustomerById(inv.customer_id);
  if (customer && customer.status === 'suspended') {
    const freshCustomer = customerSvc.getAllCustomers().find(c => c.id === inv.customer_id);
    if (freshCustomer && freshCustomer.unpaid_count === 0) {
      await customerSvc.activateCustomer(inv.customer_id);
    }
  }

  return { invoice: inv, agent: getAgentById(agentId), tx };
}

function parseMikhmonOnLogin(script) {
  if (!script) return null;
  const m = String(script).match(/",rem,.*?,(.*?),(.*?),.*?"/);
  if (!m) return null;
  const validity = String(m[1] || '').trim();
  const priceStr = String(m[2] || '').trim();
  const price = Number(String(priceStr).replace(/[^\d]/g, '')) || 0;
  return { validity, price };
}

function genCode(len, charset) {
  const n = Math.max(4, Math.min(16, Number(len) || 6));
  let chars = '0123456789';
  if (charset === 'letters') chars = 'abcdefghjkmnpqrstuvwxyz';
  else if (charset === 'mixed') chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < n; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  if (charset === 'numbers' && out[0] === '0') out = '1' + out.slice(1);
  return out;
}

async function sellVoucherAsAgent(agentId, priceId, opts = {}) {
  const agent = getAgentById(agentId);
  if (!agent || !agent.is_active) throw new Error('Akun agent tidak aktif');

  const price = db
    .prepare(
      `
      SELECT p.*, r.name AS router_name
      FROM agent_hotspot_prices p
      LEFT JOIN routers r ON r.id = p.router_id
      WHERE p.id = ? AND p.agent_id = ? AND p.is_active = 1
    `
    )
    .get(priceId, agentId);

  if (!price) throw new Error('Harga/profile voucher tidak ditemukan');

  const buyPrice = Math.max(0, Number(price.buy_price || 0) || 0);
  const sellPrice = Math.max(0, Number(price.sell_price || 0) || 0);
  if (buyPrice <= 0) throw new Error('Harga beli belum valid');

  const routerId = price.router_id ?? null;
  const profileName = String(price.profile_name || '').trim();

  let validity = String(price.validity || '').trim();
  let profileMeta = null;
  try {
    const profiles = await mikrotikSvc.getHotspotUserProfiles(routerId);
    const prof = (profiles || []).find(p => p && p.name === profileName);
    profileMeta = parseMikhmonOnLogin(prof?.onLogin || prof?.['on-login'] || '');
    if (profileMeta?.validity) validity = profileMeta.validity;
  } catch (e) {}

  const charset = opts.charset || 'numbers';
  const length = Math.max(4, Math.min(16, Number(opts.code_length) || 6));

  let created = null;
  let attempt = 0;
  while (attempt < 10) {
    attempt++;
    const code = genCode(length, charset);
    const password = opts.mode === 'member' ? genCode(length, charset) : code;
    const comment = `ag-${agent.username}-${code}-${profileName}`;
    const userData = { server: 'all', name: code, password, profile: profileName, comment };
    if (validity) userData['limit-uptime'] = validity;

    try {
      await mikrotikSvc.addHotspotUser(userData, routerId);
      created = { code, password, comment };
      break;
    } catch (e) {
      const msg = String(e?.message || e || '').toLowerCase();
      const isDup = msg.includes('already') || msg.includes('exist') || msg.includes('duplicate');
      if (isDup) continue;
      throw e;
    }
  }
  if (!created) throw new Error('Gagal membuat voucher (kode duplikat terlalu sering)');

  const run = db.transaction(() => {
    const fresh = getAgentById(agentId);
    const before = Number(fresh.balance || 0);
    if (before < buyPrice) throw new Error('Saldo agent tidak cukup');

    const after = before - buyPrice;
    db.prepare('UPDATE agents SET balance = ? WHERE id = ?').run(after, agentId);

    const insertTx = db.prepare(
      `
      INSERT INTO agent_transactions (
        agent_id, type, router_id, profile_name,
        voucher_code, voucher_password,
        amount_invoice, amount_buy, amount_sell, fee,
        balance_before, balance_after, note
      ) VALUES (?, 'voucher_sale', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `
    );
    const ins = insertTx.run(
      agentId,
      routerId,
      profileName,
      created.code,
      created.password,
      buyPrice,
      sellPrice,
      Math.max(0, sellPrice - buyPrice),
      before,
      after,
      `Voucher hotspot ${profileName} (${price.router_name || 'router'})`
    );

    return { id: Number(ins.lastInsertRowid), before, after };
  });

  const tx = run();

  return {
    agent: getAgentById(agentId),
    price: { ...price, validity },
    voucher: created,
    tx,
    receipt: {
      profile: profileName,
      router: price.router_name || '',
      code: created.code,
      password: created.password,
      validity,
      sell_price: sellPrice
    }
  };
}

module.exports = {
  authenticate,
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  topupAgent,
  getAgentPrices,
  upsertAgentHotspotPrice,
  deleteAgentHotspotPrice,
  listAgentTransactions,
  getAgentTransactionById,
  payInvoiceAsAgent,
  sellVoucherAsAgent
};
