// models/postgres/mensajeAnonimoModel.js
// Chat anónimo entre estudiantes/docentes y el psicólogo.

const { query } = require("../../config/postgres");

async function crearMensaje({ remitenteTipo, estudianteId, docenteId, psicologoId, seccionId, contenido }) {
  const result = await query(
    `
      INSERT INTO mensajes_anonimos
        (remitente_tipo, estudiante_id, docente_id, psicologo_id, seccion_id, contenido)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [remitenteTipo, estudianteId || null, docenteId || null, psicologoId || null, seccionId || null, contenido]
  );
  return result.rows[0];
}

async function listarConversacionesPsicologo() {
  const result = await query(
    `
      SELECT
        CASE WHEN m.remitente_tipo = 'docente' THEN 'docente' ELSE 'estudiante' END AS tipo,
        COALESCE(m.docente_id, m.estudiante_id) AS participante_id,
        COALESCE(s.nombre, 'Sin sección') AS seccion,
        s.nivel AS nivel_educativo,
        s.grado,
        s.letra,
        COUNT(*) FILTER (WHERE m.remitente_tipo <> 'psicologo' AND m.leido = FALSE)::int AS no_leidos,
        MAX(m.creado_en) AS ultimo_mensaje,
        (
          SELECT contenido FROM mensajes_anonimos m2
          WHERE m2.docente_id IS NOT DISTINCT FROM m.docente_id
            AND m2.estudiante_id IS NOT DISTINCT FROM m.estudiante_id
            AND m2.remitente_tipo <> 'psicologo'
          ORDER BY m2.creado_en DESC, m2.id DESC
          LIMIT 1
        ) AS ultimo_contenido
      FROM mensajes_anonimos m
      LEFT JOIN secciones s
        ON s.id = COALESCE(m.seccion_id, (
          SELECT e.seccion_id FROM estudiantes e WHERE e.id = m.estudiante_id
        ))
      WHERE m.remitente_tipo IN ('estudiante', 'docente')
        AND m.eliminado = FALSE
      GROUP BY
        (CASE WHEN m.remitente_tipo = 'docente' THEN 'docente' ELSE 'estudiante' END),
        m.docente_id, m.estudiante_id, s.nombre, s.nivel, s.grado, s.letra
      ORDER BY ultimo_mensaje DESC
    `
  );
  return result.rows;
}

async function listarMensajesConversacion({ tipo, participanteId }) {
  const idColumn = tipo === "docente" ? "docente_id" : "estudiante_id";
  const result = await query(
    `
      SELECT
        m.id,
        m.remitente_tipo,
        m.contenido,
        m.leido,
        m.eliminado,
        m.creado_en
      FROM mensajes_anonimos m
      WHERE m.${idColumn} = $1
        AND m.eliminado = FALSE
      ORDER BY m.creado_en ASC, m.id ASC
    `,
    [participanteId]
  );
  return result.rows;
}

async function listarMensajesPropios({ tipo, participanteId }) {
  return listarMensajesConversacion({ tipo, participanteId });
}

async function marcarConversacionLeida({ tipo, participanteId, psicologoId }) {
  const idColumn = tipo === "docente" ? "docente_id" : "estudiante_id";
  await query(
    `
      UPDATE mensajes_anonimos
      SET leido = TRUE
      WHERE ${idColumn} = $1
        AND remitente_tipo <> 'psicologo'
        AND leido = FALSE
    `,
    [participanteId]
  );
}

async function eliminarMensaje({ mensajeId, remitenteTipo, participanteId }) {
  const idColumn = remitenteTipo === "docente" ? "docente_id" : "estudiante_id";
  const result = await query(
    `
      UPDATE mensajes_anonimos
      SET eliminado = TRUE
      WHERE id = $1
        AND remitente_tipo = $2
        AND ${idColumn} = $3
      RETURNING id
    `,
    [mensajeId, remitenteTipo, participanteId]
  );
  return result.rows[0] || null;
}

async function eliminarTodoChat({ remitenteTipo, participanteId }) {
  const idColumn = remitenteTipo === "docente" ? "docente_id" : "estudiante_id";
  const result = await query(
    `
      UPDATE mensajes_anonimos
      SET eliminado = TRUE
      WHERE ${idColumn} = $1
        AND (remitente_tipo = $2 OR remitente_tipo = 'psicologo')
      RETURNING id
    `,
    [participanteId, remitenteTipo]
  );
  return result.rows;
}

module.exports = {
  crearMensaje,
  listarConversacionesPsicologo,
  listarMensajesConversacion,
  listarMensajesPropios,
  marcarConversacionLeida,
  eliminarMensaje,
  eliminarTodoChat
};