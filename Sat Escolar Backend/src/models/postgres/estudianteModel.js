// models/postgres/estudianteModel.js

const { query } = require("../../config/postgres");

async function crearEstudiante({ nombres, apellidos, correo, seccionId, passwordHash }) {
  const result = await query(
    `
      INSERT INTO estudiantes (nombres, apellidos, correo, seccion_id, password_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [nombres, apellidos, correo, seccionId, passwordHash || null]
  );
  return result.rows[0];
}

async function listarEstudiantes(filtros = {}) {
  const params = [];
  const where = ["e.activo = TRUE"];

  if (filtros.seccionId) {
    params.push(filtros.seccionId);
    where.push(`e.seccion_id = $${params.length}`);
  }

  if (filtros.nivel) {
    params.push(filtros.nivel);
    where.push(`s.nivel = $${params.length}`);
  }

  if (filtros.grado) {
    params.push(filtros.grado);
    where.push(`s.grado = $${params.length}`);
  }

  if (filtros.letra) {
    params.push(filtros.letra);
    where.push(`s.letra = $${params.length}`);
  }

  const result = await query(
    `
      SELECT
        e.id,
        e.nombres,
        e.apellidos,
        e.correo,
        e.activo,
        e.created_at,
        s.id AS seccion_id,
        s.nivel,
        s.grado,
        s.letra,
        s.nombre AS seccion
      FROM estudiantes e
      JOIN secciones s ON s.id = e.seccion_id
      WHERE ${where.join(" AND ")}
      ORDER BY s.nivel, s.grado, s.letra, e.apellidos, e.nombres
    `,
    params
  );
  return result.rows;
}

async function obtenerEstudiantePorId(id) {
  const result = await query(
    `
      SELECT
        e.*,
        s.nivel,
        s.grado,
        s.letra,
        s.nombre AS seccion
      FROM estudiantes e
      JOIN secciones s ON s.id = e.seccion_id
      WHERE e.id = $1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function buscarEstudiantePorCorreo(correo) {
  const result = await query(
    `
      SELECT
        e.*,
        s.nivel,
        s.grado,
        s.letra,
        s.nombre AS seccion
      FROM estudiantes e
      JOIN secciones s ON s.id = e.seccion_id
      WHERE LOWER(e.correo) = LOWER($1) AND e.activo = TRUE
      LIMIT 1
    `,
    [correo]
  );
  return result.rows[0] || null;
}

async function actualizarEstudiante(id, { nombres, apellidos, correo, seccionId, passwordHash }) {
  const result = await query(
    `
      UPDATE estudiantes
      SET
        nombres = COALESCE($2, nombres),
        apellidos = COALESCE($3, apellidos),
        correo = COALESCE($4, correo),
        seccion_id = COALESCE($5, seccion_id),
        password_hash = COALESCE($6, password_hash),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, nombres, apellidos, correo, seccionId, passwordHash]
  );
  return result.rows[0] || null;
}

async function desactivarEstudiante(id) {
  const result = await query(
    `
      UPDATE estudiantes
      SET activo = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function listarCorreos() {
  const result = await query(
    `
      SELECT correo, nombres, apellidos
      FROM estudiantes
      WHERE activo = TRUE
      ORDER BY correo
    `
  );
  return result.rows;
}

module.exports = {
  crearEstudiante,
  listarEstudiantes,
  obtenerEstudiantePorId,
  buscarEstudiantePorCorreo,
  listarCorreos,
  actualizarEstudiante,
  desactivarEstudiante
};
