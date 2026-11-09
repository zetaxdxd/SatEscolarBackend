// db/migrateBimestres.js
// El colegio trabaja por bimestres (4 por año), no por trimestres.
// Convierte la tabla trimestres_academicos a 4 bimestres y limpia datos demo antiguos.
const { pool } = require("../config/postgres");

async function migrar() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM notas_simples");
    await client.query("DELETE FROM comportamientos");
    await client.query("DELETE FROM calificaciones_trimestrales_competencia");
    await client.query("DELETE FROM productos_evaluacion");
    await client.query("DELETE FROM evaluaciones_academicas");
    await client.query("DELETE FROM trimestres_academicos");

    await client.query("ALTER TABLE trimestres_academicos DROP CONSTRAINT IF EXISTS trimestres_academicos_orden_check");
    await client.query("ALTER TABLE trimestres_academicos ADD CONSTRAINT trimestres_academicos_orden_check CHECK (orden BETWEEN 1 AND 4)");

    await client.query(
      `
        INSERT INTO trimestres_academicos (nombre, anio, orden)
        VALUES
          ('I Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 1),
          ('II Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 2),
          ('III Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 3),
          ('IV Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 4)
      `
    );

    await client.query("COMMIT");
    console.log("✅ Periodos convertidos a 4 bimestres (I, II, III y IV Bimestre)");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrar().catch((e) => {
  console.error("Error en migración de bimestres:", e.message);
  process.exit(1);
});