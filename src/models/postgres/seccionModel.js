// models/postgres/seccionModel.js

const { query } = require("../../config/postgres");

async function crearSeccion({ nivel, grado, letra }) {
  const result = await query(
    `
      INSERT INTO secciones (nivel, grado, letra)
      VALUES ($1, $2, $3)
      ON CONFLICT (nivel, grado, letra)
      DO UPDATE SET nivel = EXCLUDED.nivel
      RETURNING *
    `,
    [nivel, grado, letra]
  );
  return result.rows[0];
}

async function listarSecciones(filtros = {}) {
  const params = [];
  const where = [];

  if (filtros.nivel) {
    params.push(filtros.nivel);
    where.push(`nivel = $${params.length}`);
  }

  if (filtros.grado) {
    params.push(filtros.grado);
    where.push(`grado = $${params.length}`);
  }

  const result = await query(
    `
      SELECT *
      FROM secciones
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY nivel, grado, letra
    `,
    params
  );
  return result.rows;
}

async function obtenerSeccionPorId(id) {
  const result = await query("SELECT * FROM secciones WHERE id = $1", [id]);
  return result.rows[0] || null;
}

module.exports = {
  crearSeccion,
  listarSecciones,
  obtenerSeccionPorId
};
