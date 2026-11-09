const { query } = require("../../config/postgres");

function filtroDocentePorUsuario(paramUserId = 1, paramEmail = 2) {
  return `(d.user_id = $${paramUserId} OR LOWER(d.correo) = LOWER($${paramEmail}))`;
}

async function buscarDocentePorCorreo(correo) {
  const result = await query(
    `
      SELECT id, nombres, apellidos, correo, password_hash, debe_cambiar_password, es_tutor
      FROM docentes
      WHERE LOWER(correo) = LOWER($1)
        AND activo = TRUE
      LIMIT 1
    `,
    [correo]
  );
  return result.rows[0] || null;
}

async function listarCorreosDocentes() {
  const result = await query(
    `
      SELECT correo, nombres, apellidos
      FROM docentes
      WHERE activo = TRUE
      ORDER BY correo
    `
  );
  return result.rows;
}

async function obtenerDocentePorUserId(userId, userEmail = null) {
  const result = await query(
    `
      SELECT *
      FROM docentes d
      WHERE ${filtroDocentePorUsuario()}
        AND activo = TRUE
      LIMIT 1
    `,
    [userId, userEmail]
  );
  return result.rows[0] || null;
}

async function listarSeccionesDeDocente(userId, userEmail = null) {
  const result = await query(
    `
      SELECT
        d.id AS docente_id,
        s.id AS seccion_id,
        s.nivel,
        s.grado,
        s.letra,
        s.nombre AS seccion
      FROM docentes d
      JOIN docente_secciones ds ON ds.docente_id = d.id
      JOIN secciones s ON s.id = ds.seccion_id
      WHERE ${filtroDocentePorUsuario()}
        AND d.activo = TRUE
      ORDER BY s.nivel, s.grado, s.letra
    `,
    [userId, userEmail]
  );
  return result.rows;
}

async function listarFormulariosDeDocente(userId, userEmail = null) {
  const result = await query(
    `
      SELECT
        f.id,
        f.titulo,
        f.descripcion,
        f.nivel,
        f.grado,
        f.seccion,
        f.activo,
        f.created_at,
        s.id AS seccion_id,
        h.id AS habilitacion_id,
        COALESCE(h.activo, FALSE) AS habilitado,
        h.fecha_habilitacion,
        COUNT(p.id)::int AS total_preguntas,
        COALESCE(resp.respuestas_count, 0)::int AS respuestas_count,
        COALESCE(est.total_estudiantes, 0)::int AS total_estudiantes
      FROM docentes d
      JOIN docente_secciones ds ON ds.docente_id = d.id
      JOIN secciones s ON s.id = ds.seccion_id
      JOIN formularios_psicologicos f
        ON f.nivel = s.nivel
       AND (f.grado IS NULL OR f.grado = s.grado)
       AND (f.seccion IS NULL OR f.seccion = s.letra)
      LEFT JOIN formulario_habilitaciones h
        ON h.formulario_id = f.id
       AND h.docente_id = d.id
       AND h.seccion_id = s.id
      LEFT JOIN formulario_preguntas p ON p.formulario_id = f.id
      LEFT JOIN (
        SELECT formulario_id, COUNT(DISTINCT estudiante_id) AS respuestas_count
        FROM formulario_respuestas
        GROUP BY formulario_id
      ) resp ON resp.formulario_id = f.id
      LEFT JOIN (
        SELECT seccion_id, COUNT(*) AS total_estudiantes
        FROM estudiantes
        WHERE activo = TRUE
        GROUP BY seccion_id
      ) est ON est.seccion_id = s.id
      WHERE ${filtroDocentePorUsuario()}
        AND d.activo = TRUE
      GROUP BY f.id, s.id, h.id, resp.respuestas_count, est.total_estudiantes
      ORDER BY f.created_at DESC
    `,
    [userId, userEmail]
  );
  return result.rows;
}

async function habilitarFormularioDocente(userId, userEmail, formularioId) {
  const result = await query(
    `
      WITH formulario_docente AS (
        SELECT
          d.id AS docente_id,
          f.id AS formulario_id,
          s.id AS seccion_id
        FROM docentes d
        JOIN docente_secciones ds ON ds.docente_id = d.id
        JOIN secciones s ON s.id = ds.seccion_id
        JOIN formularios_psicologicos f
          ON f.nivel = s.nivel
         AND (f.grado IS NULL OR f.grado = s.grado)
         AND (f.seccion IS NULL OR f.seccion = s.letra)
        WHERE ${filtroDocentePorUsuario()}
          AND d.activo = TRUE
          AND f.id = $3
        LIMIT 1
      )
      INSERT INTO formulario_habilitaciones
        (formulario_id, docente_id, seccion_id, activo, fecha_habilitacion)
      SELECT formulario_id, docente_id, seccion_id, TRUE, CURRENT_TIMESTAMP
      FROM formulario_docente
      ON CONFLICT (formulario_id, docente_id, seccion_id)
      DO UPDATE SET activo = TRUE, fecha_habilitacion = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [userId, userEmail, formularioId]
  );
  return result.rows[0] || null;
}

async function listarEstadoRespuestasFormulario(userId, userEmail, formularioId) {
  const result = await query(
    `
      WITH formulario_docente AS (
        SELECT
          f.id AS formulario_id,
          s.id AS seccion_id
        FROM docentes d
        JOIN docente_secciones ds ON ds.docente_id = d.id
        JOIN secciones s ON s.id = ds.seccion_id
        JOIN formularios_psicologicos f
          ON f.nivel = s.nivel
         AND (f.grado IS NULL OR f.grado = s.grado)
         AND (f.seccion IS NULL OR f.seccion = s.letra)
        WHERE ${filtroDocentePorUsuario()}
          AND d.activo = TRUE
          AND f.id = $3
        LIMIT 1
      )
      SELECT
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        CASE WHEN COUNT(r.id) > 0 THEN TRUE ELSE FALSE END AS respondio,
        MAX(r.created_at) AS fecha_respuesta
      FROM formulario_docente fd
      JOIN estudiantes e ON e.seccion_id = fd.seccion_id AND e.activo = TRUE
      LEFT JOIN formulario_respuestas r
        ON r.formulario_id = fd.formulario_id
       AND r.estudiante_id = e.id
      GROUP BY e.id, e.nombres, e.apellidos, e.correo
      ORDER BY e.apellidos, e.nombres
    `,
    [userId, userEmail, formularioId]
  );
  return result.rows;
}

module.exports = {
  buscarDocentePorCorreo,
  listarCorreosDocentes,
  obtenerDocentePorUserId,
  listarSeccionesDeDocente,
  listarFormulariosDeDocente,
  habilitarFormularioDocente,
  listarEstadoRespuestasFormulario
};
