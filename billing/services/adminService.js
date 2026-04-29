const db = require('../config/database');

/**
 * TECHNICIANS
 */
function getAllTechnicians() {
  return db.prepare('SELECT * FROM technicians ORDER BY created_at DESC').all();
}

function createTechnician(data) {
  const stmt = db.prepare('INSERT INTO technicians (username, password, name, phone, area) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(data.username, data.password, data.name, data.phone || '', data.area || '');
}

function updateTechnician(id, data) {
  const stmt = db.prepare('UPDATE technicians SET username = ?, password = ?, name = ?, phone = ?, area = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, data.password, data.name, data.phone || '', data.area || '', data.is_active ? 1 : 0, id);
}

function deleteTechnician(id) {
  return db.prepare('DELETE FROM technicians WHERE id = ?').run(id);
}

/**
 * CASHIERS
 */
function getAllCashiers() {
  return db.prepare('SELECT * FROM cashiers ORDER BY created_at DESC').all();
}

function createCashier(data) {
  const stmt = db.prepare('INSERT INTO cashiers (username, password, name, phone) VALUES (?, ?, ?, ?)');
  return stmt.run(data.username, data.password, data.name, data.phone || '');
}

function updateCashier(id, data) {
  const stmt = db.prepare('UPDATE cashiers SET username = ?, password = ?, name = ?, phone = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, data.password, data.name, data.phone || '', data.is_active ? 1 : 0, id);
}

function deleteCashier(id) {
  return db.prepare('DELETE FROM cashiers WHERE id = ?').run(id);
}

function authenticateCashier(username, password) {
  return db.prepare('SELECT * FROM cashiers WHERE username = ? AND password = ? AND is_active = 1').get(username, password);
}

module.exports = {
  getAllTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  getAllCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
  authenticateCashier
};
