const db = require('../config/database');

function getAllTickets(status = null) {
  let query = `
    SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, tech.name as technician_name
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    LEFT JOIN technicians tech ON t.technician_id = tech.id
  `;
  
  if (status && status !== 'all') {
    query += ` WHERE t.status = ? ORDER BY t.created_at DESC`;
    return db.prepare(query).all(status);
  }
  
  query += ` ORDER BY CASE WHEN t.status = 'open' THEN 1 WHEN t.status = 'in_progress' THEN 2 ELSE 3 END, t.created_at DESC`;
  return db.prepare(query).all();
}

function getTicketsByCustomerId(customerId) {
  return db.prepare(`
    SELECT t.*, tech.name as technician_name
    FROM tickets t
    LEFT JOIN technicians tech ON t.technician_id = tech.id
    WHERE t.customer_id = ?
    ORDER BY t.created_at DESC
  `).all(customerId);
}

function getTicketById(id) {
  return db.prepare(`
    SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, tech.name as technician_name
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    LEFT JOIN technicians tech ON t.technician_id = tech.id
    WHERE t.id = ?
  `).get(id);
}

function createTicket(customerId, subject, message) {
  return db.prepare(`
    INSERT INTO tickets (customer_id, subject, message)
    VALUES (?, ?, ?)
  `).run(customerId, subject, message);
}

function updateTicketStatus(id, status, technicianId = null) {
  if (technicianId) {
    return db.prepare(`
      UPDATE tickets 
      SET status = ?, technician_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, technicianId, id);
  } else {
    return db.prepare(`
      UPDATE tickets 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);
  }
}

function deleteTicket(id) {
  return db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

function getTicketStats() {
  const open = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='open'").get().c;
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='in_progress'").get().c;
  const resolved = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='resolved'").get().c;
  return { open, inProgress, resolved, total: open + inProgress + resolved };
}

module.exports = {
  getAllTickets,
  getTicketsByCustomerId,
  getTicketById,
  createTicket,
  updateTicketStatus,
  deleteTicket,
  getTicketStats
};
