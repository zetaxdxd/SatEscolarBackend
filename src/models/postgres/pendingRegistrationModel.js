// models/postgres/pendingRegistrationModel.js - Reutilizado de OmniCash para SAT Escolar (PostgreSQL)
const { pool } = require("../../config/postgres");

async function upsert({ email, data, expiresAt }) {
  const result = await pool.query(
    `INSERT INTO pending_registrations (email, data_json, expires_at) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET data_json=EXCLUDED.data_json, expires_at=EXCLUDED.expires_at, created_at=NOW()
     RETURNING *`,
    [email.toLowerCase(), JSON.stringify(data), expiresAt]
  );
  return result.rows[0];
}

async function findByEmail(email) {
  const result = await pool.query(`SELECT * FROM pending_registrations WHERE LOWER(email)=LOWER($1)`, [email]);
  const row = result.rows[0];
  if (!row) return null;
  return { email: row.email, data: typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json, expiresAt: row.expires_at, createdAt: row.created_at };
}

async function eliminar(email) {
  await pool.query(`DELETE FROM pending_registrations WHERE LOWER(email)=LOWER($1)`, [email]);
}

async function limpiarVencidos() {
  await pool.query(`DELETE FROM pending_registrations WHERE expires_at < NOW()`);
}

module.exports = { upsert, findByEmail, eliminar, limpiarVencidos };
