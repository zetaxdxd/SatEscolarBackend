// models/postgres/verificationCodeModel.js - Reutilizado de OmniCash para SAT Escolar (PostgreSQL)
const { pool } = require("../../config/postgres");

async function insert({ email, purpose, codeHash, expiresAt }) {
  const result = await pool.query(
    `INSERT INTO verification_codes (email, purpose, code_hash, expires_at) VALUES ($1,$2,$3,$4) RETURNING *`,
    [email.toLowerCase(), purpose, codeHash, expiresAt]
  );
  return result.rows[0];
}

async function findLatest(email, purpose) {
  const result = await pool.query(
    `SELECT * FROM verification_codes WHERE LOWER(email)=LOWER($1) AND purpose=$2 ORDER BY id DESC LIMIT 1`,
    [email, purpose]
  );
  return result.rows[0] || null;
}

async function countActivos(email, purpose) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM verification_codes WHERE LOWER(email)=LOWER($1) AND purpose=$2 AND used_at IS NULL AND expires_at > NOW()`,
    [email, purpose]
  );
  return Number(result.rows[0].n);
}

async function registrarIntento(id) {
  await pool.query(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id=$1`, [id]);
}

async function marcarUsado(id) {
  await pool.query(`UPDATE verification_codes SET used_at = NOW() WHERE id=$1`, [id]);
}

async function invalidarActivos(email, purpose) {
  await pool.query(`UPDATE verification_codes SET used_at = NOW() WHERE LOWER(email)=LOWER($1) AND purpose=$2 AND used_at IS NULL`, [email, purpose]);
}

module.exports = { insert, findLatest, countActivos, registrarIntento, marcarUsado, invalidarActivos };
