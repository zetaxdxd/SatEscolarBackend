// db/migrateNotasSimples.js
// Tabla para el registro simple de notas por campos (nombre + nota) del docente.
const { pool } = require("../config/postgres");

async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notas_simples (
      id SERIAL PRIMARY KEY,
      estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
      asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON UPDATE CASCADE ON DELETE CASCADE,
      trimestre_id INTEGER NOT NULL REFERENCES trimestres_academicos(id) ON UPDATE CASCADE ON DELETE CASCADE,
      campo TEXT NOT NULL,
      nota NUMERIC(5, 2) CHECK (nota >= 0 AND nota <= 20),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (estudiante_id, asignatura_id, trimestre_id, campo)
    );
  `);
  console.log("✅ Tabla notas_simples lista");
  await pool.end();
}

migrar().catch((e) => {
  console.error("Error en migración notas_simples:", e.message);
  process.exit(1);
});