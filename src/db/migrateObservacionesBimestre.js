// db/migrateObservacionesBimestre.js
// Observaciones libres del docente por estudiante y bimestre.
// Reemplaza al antiguo "comportamiento" como canal cualitativo: alimenta
// la detección de señales del motor de riesgo y el prompt de predicción IA.
const { pool } = require("../config/postgres");

async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS observaciones_bimestre (
      id SERIAL PRIMARY KEY,
      estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
      trimestre_id INTEGER NOT NULL REFERENCES trimestres_academicos(id) ON UPDATE CASCADE ON DELETE CASCADE,
      texto TEXT NOT NULL,
      creado_por INTEGER REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (estudiante_id, trimestre_id)
    );
  `);
  console.log("✅ Tabla observaciones_bimestre lista");
  await pool.end();
}

migrar().catch((e) => {
  console.error("Error en migración observaciones_bimestre:", e.message);
  process.exit(1);
});
