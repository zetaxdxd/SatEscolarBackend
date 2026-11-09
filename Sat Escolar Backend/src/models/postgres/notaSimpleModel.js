// models/postgres/notaSimpleModel.js
// Registro simple de notas por campos del docente (nombre de campo + nota).

const { query } = require("../../config/postgres");

async function listarNotasSimples({ seccionId, asignaturaId, trimestreId }) {
  const result = await query(
    `
      SELECT
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        s.nombre AS seccion,
        COALESCE(
          json_agg(
            jsonb_build_object('campo', n.campo, 'nota', n.nota)
            ORDER BY n.campo
          ) FILTER (WHERE n.id IS NOT NULL),
          '[]'::json
        ) AS notas,
        o.texto AS observacion
      FROM estudiantes e
      JOIN secciones s ON s.id = e.seccion_id
      LEFT JOIN notas_simples n
        ON n.estudiante_id = e.id
       AND n.asignatura_id = $2
       AND n.trimestre_id = $3
      LEFT JOIN observaciones_bimestre o
        ON o.estudiante_id = e.id
       AND o.trimestre_id = $3
      WHERE e.seccion_id = $1 AND e.activo = TRUE
      GROUP BY e.id, s.nombre, o.texto
      ORDER BY e.apellidos, e.nombres
    `,
    [seccionId, asignaturaId, trimestreId]
  );
  return result.rows;
}

async function guardarNotasSimples({ asignaturaId, trimestreId, registros }) {
  const guardados = [];
  for (const r of registros) {
    if (!r.estudianteId || !r.campo || r.nota === null || r.nota === undefined || r.nota === "") continue;
    const nota = Number(r.nota);
    if (Number.isNaN(nota) || nota < 0 || nota > 20) continue;
    const result = await query(
      `
        INSERT INTO notas_simples (estudiante_id, asignatura_id, trimestre_id, campo, nota)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (estudiante_id, asignatura_id, trimestre_id, campo)
        DO UPDATE SET
          nota = EXCLUDED.nota,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, estudiante_id, campo, nota
      `,
      [r.estudianteId, asignaturaId, trimestreId, String(r.campo).trim(), nota]
    );
    guardados.push(result.rows[0]);
  }
  return guardados;
}

async function eliminarNotasSimples({ asignaturaId, trimestreId }) {
  const result = await query(
    `DELETE FROM notas_simples WHERE asignatura_id=$1 AND trimestre_id=$2 RETURNING id`,
    [asignaturaId, trimestreId]
  );
  return result.rows;
}

module.exports = { listarNotasSimples, guardarNotasSimples, eliminarNotasSimples };