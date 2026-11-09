// models/postgres/comportamientoModel.js

const { query } = require("../../config/postgres");

async function listarEstudiantesConComportamiento({ seccionId, trimestreId }) {
  const result = await query(
    `
      SELECT
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        s.id AS seccion_id,
        s.nombre AS seccion,
        c.id AS comportamiento_id,
        c.nivel,
        c.observacion,
        c.fecha_registro
      FROM estudiantes e
      JOIN secciones s ON s.id = e.seccion_id
      LEFT JOIN comportamientos c
        ON c.estudiante_id = e.id
       AND c.trimestre_id = $2
      WHERE e.seccion_id = $1
        AND e.activo = TRUE
      ORDER BY e.apellidos, e.nombres
    `,
    [seccionId, trimestreId]
  );
  return result.rows;
}

async function guardarComportamiento({ estudianteId, trimestreId, nivel, observacion, registradoPor }) {
  const result = await query(
    `
      INSERT INTO comportamientos (estudiante_id, trimestre_id, nivel, observacion, registrado_por)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (estudiante_id, trimestre_id) DO UPDATE SET
        nivel = EXCLUDED.nivel,
        observacion = EXCLUDED.observacion,
        registrado_por = EXCLUDED.registrado_por,
        fecha_registro = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [estudianteId, trimestreId, nivel, observacion || null, registradoPor]
  );
  return result.rows[0];
}

async function eliminarComportamientos({ trimestreId, estudianteIds }) {
  if (estudianteIds && estudianteIds.length) {
    const r = await query(`DELETE FROM comportamientos WHERE trimestre_id=$1 AND estudiante_id = ANY($2) RETURNING id`, [trimestreId, estudianteIds]);
    return r.rows;
  }
  const r = await query(`DELETE FROM comportamientos WHERE trimestre_id=$1 RETURNING id`, [trimestreId]);
  return r.rows;
}

module.exports = {
  listarEstudiantesConComportamiento,
  guardarComportamiento,
  eliminarComportamientos
};