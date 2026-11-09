// db/migrateCamposNota.js
// Campos de evaluación definidos por el docente para cada curso (asignatura).
// Fuente única de verdad: agregar/quitar es instantáneo y quitar borra en
// cascada todas las notas guardadas de ese campo.
const { pool } = require("../config/postgres");

async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campos_nota (
      id SERIAL PRIMARY KEY,
      asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON UPDATE CASCADE ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (asignatura_id, nombre)
    );
  `);
  console.log("✅ Tabla campos_nota lista");
  await pool.end();
}

migrar().catch((e) => {
  console.error("Error en migración campos_nota:", e.message);
  process.exit(1);
});
