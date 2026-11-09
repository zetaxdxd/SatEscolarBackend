const { query } = require("../../config/postgres");

async function guardarAsistencias({ fecha, registros }) {
  const guardados = [];

  for (const registro of registros) {
    const result = await query(
      `
        INSERT INTO asistencias (estudiante_id, fecha, estado, observacion)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (estudiante_id, fecha)
        DO UPDATE SET
          estado = EXCLUDED.estado,
          observacion = EXCLUDED.observacion,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [
        registro.estudianteId,
        fecha,
        registro.estado,
        registro.observacion || null
      ]
    );
    guardados.push(result.rows[0]);
  }

  return guardados;
}

async function listarAsistencias({ fecha, nivel, grado, letra }) {
  const params = [];
  const where = [];

  if (fecha) {
    params.push(fecha);
    where.push(`a.fecha = $${params.length}`);
  }

  if (nivel) {
    params.push(nivel);
    where.push(`s.nivel = $${params.length}`);
  }

  if (grado) {
    params.push(grado);
    where.push(`s.grado = $${params.length}`);
  }

  if (letra) {
    params.push(letra);
    where.push(`s.letra = $${params.length}`);
  }

  const result = await query(
    `
      SELECT
        a.id,
        a.fecha,
        a.estado,
        a.observacion,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        s.nivel,
        s.grado,
        s.letra,
        s.nombre AS seccion
      FROM asistencias a
      JOIN estudiantes e ON e.id = a.estudiante_id
      JOIN secciones s ON s.id = e.seccion_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY s.nivel, s.grado, s.letra, e.apellidos, e.nombres
    `,
    params
  );

  return result.rows;
}

async function listarFechasAsistencias({ seccionId } = {}) {
  const params = [];
  let join = "";
  let where = "";
  if (seccionId) {
    join = "JOIN estudiantes e ON e.id = a.estudiante_id";
    params.push(Number(seccionId));
    where = `WHERE e.seccion_id = $${params.length}`;
  }
  const result = await query(
    `SELECT a.fecha,
            COUNT(*)::int AS total,
            SUM(CASE WHEN a.estado = 'Asistió' THEN 1 ELSE 0 END)::int AS asistieron,
            SUM(CASE WHEN a.estado = 'Tardanza' THEN 1 ELSE 0 END)::int AS tardanzas,
            SUM(CASE WHEN a.estado = 'Faltó' THEN 1 ELSE 0 END)::int AS faltaron
     FROM asistencias a ${join} ${where}
     GROUP BY a.fecha ORDER BY a.fecha DESC`,
    params
  );
  return result.rows;
}

module.exports = {
  guardarAsistencias,
  listarAsistencias,
  listarFechasAsistencias
};
