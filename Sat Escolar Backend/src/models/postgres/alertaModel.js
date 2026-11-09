// models/postgres/alertaModel.js

const { query } = require("../../config/postgres");

async function listarAlertas({ estado, nivel, seccionId, limite = 100 } = {}) {
  const params = [];
  const where = [];

  if (estado) {
    params.push(estado);
    where.push(`a.estado = $${params.length}`);
  }
  if (nivel) {
    params.push(nivel);
    where.push(`a.nivel = $${params.length}`);
  }
  if (seccionId) {
    params.push(seccionId);
    where.push(`e.seccion_id = $${params.length}`);
  }

  const result = await query(
    `
      SELECT
        a.id,
        a.tipo,
        a.nivel,
        a.mensaje,
        a.estado,
        a.creada_en,
        a.atendida_en,
        ev.motivos,
        ev.puntaje_global,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        s.id AS seccion_id,
        s.nombre AS seccion,
        s.nivel AS nivel_educativo,
        s.grado,
        s.letra
      FROM alertas_riesgo a
      JOIN estudiantes e ON e.id = a.estudiante_id
      JOIN secciones s ON s.id = e.seccion_id
      LEFT JOIN evaluaciones_riesgo_estudiante ev ON ev.id = a.evaluacion_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.estado ASC, a.creada_en DESC, a.id DESC
      LIMIT $${params.length + 1}
    `,
    [...params, limite]
  );
  return result.rows;
}

async function contarPendientes() {
  const result = await query(
    `
      SELECT COUNT(*)::int AS pendientes
      FROM alertas_riesgo
      WHERE estado = 'pendiente'
    `
  );
  return result.rows[0].pendientes;
}

async function atenderAlerta(id, atendidaPor) {
  const result = await query(
    `
      UPDATE alertas_riesgo
      SET estado = 'atendida',
          atendida_en = CURRENT_TIMESTAMP,
          atendida_por = $2
      WHERE id = $1 AND estado = 'pendiente'
      RETURNING *
    `,
    [id, atendidaPor]
  );
  return result.rows[0] || null;
}

module.exports = {
  listarAlertas,
  contarPendientes,
  atenderAlerta
};