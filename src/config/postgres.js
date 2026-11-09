// config/postgres.js
const { Pool } = require("pg");
require("dotenv").config();

// Soporta DATABASE_URL (Render/Neon/Supabase) - PRIORIDAD ALTA
// Si DATABASE_URL está definido, SIEMPRE se usa (para producción en Render, etc.)
let conexion;
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const necesitaSSL = url.includes("sslmode=require") || process.env.PGSSL === "true";
  conexion = {
    connectionString: url,
    ssl: necesitaSSL ? { rejectUnauthorized: false } : undefined
  };
} else {
  // Fallback a variables PG* individuales (solo desarrollo local)
  conexion = {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "sat_escolar",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || ""
  };
  if (process.env.PGSSL === "true") conexion.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(conexion);

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, closePool };