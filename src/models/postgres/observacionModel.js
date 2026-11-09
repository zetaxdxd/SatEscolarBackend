// models/postgres/observacionModel.js
// Observaciones libres del docente por estudiante y bimestre.

const { query } = require("../../config/postgres");

async function listarObservaciones({ trimestreId, estudianteIds }) {
  let sql = `SELECT estudiante_id, texto FROM observaciones_bimestre WHERE trimestre_id = $1`;
  const params = [trimestreId];
  if (estudianteIds && estudianteIds.length) {
    sql += ` AND estudiante_id = ANY($2::int[])`;
    params.push(estudianteIds);
  }
  const result = await query(sql, params);
  return result.rows;
}

async function guardarObservaciones({ trimestreId, observaciones, creadoPor }) {
  const guardadas = [];
  for (const o of observaciones || []) {
    const texto = String(o.texto || "").trim().slice(0, 1000);
    if (!o.estudianteId || !texto) continue;
    const result = await query(
      `
        INSERT INTO observaciones_bimestre (estudiante_id, trimestre_id, texto, creado_por)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (estudiante_id, trimestre_id)
        DO UPDATE SET
          texto = EXCLUDED.texto,
          creado_por = EXCLUDED.creado_por,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, estudiante_id, texto
      `,
      [o.estudianteId, trimestreId, texto, creadoPor || null]
    );
    guardadas.push(result.rows[0]);
  }
  return guardadas;
}

async function eliminarObservacionesVacias({ trimestreId, estudianteIds }) {
  if (!trimestreId || !estudianteIds || !estudianteIds.length) return 0;
  const result = await query(
    `DELETE FROM observaciones_bimestre WHERE trimestre_id = $1 AND estudiante_id = ANY($2::int[])`,
    [trimestreId, estudianteIds]
  );
  return result.rowCount || 0;
}

async function eliminarPorTrimestre({ trimestreId }) {
  const result = await query(`DELETE FROM observaciones_bimestre WHERE trimestre_id = $1`, [trimestreId]);
  return result.rowCount || 0;
}

module.exports = {
  listarObservaciones,
  guardarObservaciones,
  eliminarObservacionesVacias,
  eliminarPorTrimestre,
};
