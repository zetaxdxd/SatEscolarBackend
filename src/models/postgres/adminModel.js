// models/postgres/adminModel.js
// Operaciones administrativas de la directora (superusuario).

const { pool } = require("../../config/postgres");

function codigoAsignatura(nombre) {
  const limpio = String(nombre).trim().toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÜÑ ]/g, "");
  const palabras = limpio.split(/\s+/).filter(Boolean);
  const base = (palabras.length === 1 ? limpio.slice(0, 6) : palabras.map(p => p[0]).join("")).slice(0, 6);
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || "CUR"}-${sufijo}`;
}

async function crearAsignatura({ nombre }) {
  const result = await pool.query(
    `
      INSERT INTO asignaturas (nombre, codigo)
      VALUES ($1, $2)
      ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id, nombre, codigo
    `,
    [String(nombre).trim(), codigoAsignatura(String(nombre).trim())]
  );
  return result.rows[0];
}

async function crearDocente({ nombres, apellidos, correo, passwordHash, esTutor, secciones }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertado = await client.query(
      `
        INSERT INTO docentes (nombres, apellidos, correo, password_hash, debe_cambiar_password, es_tutor, activo)
        VALUES ($1, $2, $3, $4, TRUE, $5, TRUE)
        RETURNING id
      `,
      [nombres, apellidos, correo.toLowerCase(), passwordHash, Boolean(esTutor)]
    );
    const docenteId = insertado.rows[0].id;

    for (const seccion of secciones || []) {
      const { seccionId, asignaturas } = seccion;
      await client.query(
        `
          INSERT INTO docente_secciones (docente_id, seccion_id)
          VALUES ($1, $2)
          ON CONFLICT (docente_id, seccion_id) DO NOTHING
        `,
        [docenteId, seccionId]
      );
      const ids = [...(asignaturas || [])];
      for (const nombre of (seccion.asignaturasNuevas || [])) {
        const creada = await client.query(
          `
            INSERT INTO asignaturas (nombre, codigo)
            VALUES ($1, $2)
            ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
            RETURNING id
          `,
          [String(nombre).trim(), codigoAsignatura(String(nombre).trim())]
        );
        ids.push(creada.rows[0].id);
      }
      for (const asignaturaId of ids) {
        await client.query(
          `
            INSERT INTO docente_asignaturas_secciones (docente_id, asignatura_id, seccion_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (docente_id, asignatura_id, seccion_id) DO NOTHING
          `,
          [docenteId, asignaturaId, seccionId]
        );
      }
    }

    await client.query("COMMIT");
    return docenteId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listarDocentes() {
  const result = await pool.query(
    `
      SELECT
        d.id,
        d.nombres,
        d.apellidos,
        d.correo,
        d.es_tutor,
        d.debe_cambiar_password,
        d.activo,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'seccion_id', s.id,
              'seccion', s.nombre,
              'nivel', s.nivel,
              'grado', s.grado,
              'letra', s.letra,
              'asignaturas', COALESCE((
                SELECT json_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre) ORDER BY a.nombre)
                FROM docente_asignaturas_secciones das
                JOIN asignaturas a ON a.id = das.asignatura_id
                WHERE das.docente_id = d.id AND das.seccion_id = s.id
              ), '[]'::json)
            ) ORDER BY s.nombre
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS secciones
      FROM docentes d
      LEFT JOIN docente_secciones ds ON ds.docente_id = d.id
      LEFT JOIN secciones s ON s.id = ds.seccion_id
      GROUP BY d.id
      ORDER BY d.apellidos, d.nombres
    `
  );
  return result.rows;
}

async function crearPsicologo({ nombres, apellidos, correo, username, passwordHash, codigo }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertado = await client.query(
      `
        INSERT INTO usuarios (username, correo, password_hash, rol, activo, nombres, apellidos)
        VALUES ($1, $2, $3, 'psicologo', TRUE, $4, $5)
        RETURNING id
      `,
      [username.toLowerCase(), correo.toLowerCase(), passwordHash, nombres, apellidos]
    );
    const usuarioId = insertado.rows[0].id;

    await client.query(
      `
        INSERT INTO psicologos (usuario_id, nombres, apellidos, codigo, activo)
        VALUES ($1, $2, $3, $4, TRUE)
      `,
      [usuarioId, nombres, apellidos, codigo]
    );

    await client.query("COMMIT");
    return usuarioId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listarPsicologos() {
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.nombres,
        p.apellidos,
        p.codigo,
        p.activo,
        u.id AS usuario_id,
        u.username,
        u.correo
      FROM psicologos p
      JOIN usuarios u ON u.id = p.usuario_id
      ORDER BY p.apellidos, p.nombres
    `
  );
  return result.rows;
}

async function cambiarContrasenaDocente(docenteId, passwordHash) {
  const result = await pool.query(
    `
      UPDATE docentes
      SET password_hash = $2,
          debe_cambiar_password = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND activo = TRUE
      RETURNING id
    `,
    [docenteId, passwordHash]
  );
  return result.rows[0] || null;
}

async function cambiarTutorDocente(docenteId, esTutor) {
  const result = await pool.query(
    `
      UPDATE docentes
      SET es_tutor = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND activo = TRUE
      RETURNING id, es_tutor
    `,
    [docenteId, Boolean(esTutor)]
  );
  return result.rows[0] || null;
}

module.exports = {
  crearDocente,
  listarDocentes,
  crearAsignatura,
  crearPsicologo,
  listarPsicologos,
  cambiarContrasenaDocente,
  cambiarTutorDocente
};