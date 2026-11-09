const { pool, query } = require("../../config/postgres");

const ESTADOS = new Set(["abierto", "en_seguimiento", "cerrado"]);
const PRIORIDADES = new Set(["baja", "media", "alta", "critica"]);

function normalizarEstado(valor) {
  const limpio = String(valor || "").trim().toLowerCase();
  const equivalencias = {
    "riesgo alto": "abierto",
    "monitoreo": "en_seguimiento",
    "en mejora": "en_seguimiento",
    "estable": "cerrado"
  };
  return equivalencias[limpio] || limpio;
}

function normalizarPrioridad(valor, estadoOriginal = "") {
  const limpia = String(valor || "").trim().toLowerCase();
  if (PRIORIDADES.has(limpia)) return limpia;
  const estado = String(estadoOriginal || "").trim().toLowerCase();
  if (estado === "riesgo alto") return "alta";
  if (estado === "en mejora" || estado === "estable") return "baja";
  return "media";
}

function etiquetaEstado(estado) {
  return {
    abierto: "Riesgo alto",
    en_seguimiento: "Monitoreo",
    cerrado: "Estable"
  }[estado] || estado;
}

async function registrarIntervencion({
  estudianteId,
  usuarioPsicologoId,
  psicologoId,
  estado,
  nivelPrioridad,
  tipoIntervencion,
  descripcion,
  acuerdos,
  aparienciaVestimenta,
  aparienciaFisica,
  estadoEmocional,
  observacionesAdicionales,
  fechaIntervencion,
  proximaFecha,
  evidenciaBase64,
  evidenciaTipo,
  rasgosAdolescente
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const estudiante = await client.query(
      "SELECT id FROM estudiantes WHERE id = $1 AND activo = TRUE",
      [estudianteId]
    );
    if (!estudiante.rows[0]) {
      const error = new Error("El estudiante no existe en PostgreSQL");
      error.status = 404;
      throw error;
    }

    const psicologo = await client.query(
      `SELECT p.id
       FROM psicologos p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = $1 AND u.id = $2 AND p.activo = TRUE AND u.activo = TRUE`,
      [psicologoId, usuarioPsicologoId]
    );
    if (!psicologo.rows[0]) {
      const error = new Error("La sesion no corresponde a un psicologo activo en PostgreSQL");
      error.status = 403;
      throw error;
    }

    let casoResult = await client.query(
      `SELECT * FROM casos_seguimiento
       WHERE estudiante_id = $1 AND estado IN ('abierto', 'en_seguimiento')
       ORDER BY fecha_actualizacion DESC
       LIMIT 1
       FOR UPDATE`,
      [estudianteId]
    );

    if (casoResult.rows[0]) {
      casoResult = await client.query(
        `UPDATE casos_seguimiento
         SET psicologo_id = $2,
             estado = $3,
             nivel_prioridad = $4,
             fecha_actualizacion = CURRENT_TIMESTAMP,
             cerrado_en = CASE WHEN $3::varchar = 'cerrado' THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE id = $1
         RETURNING *`,
        [casoResult.rows[0].id, psicologoId, estado, nivelPrioridad]
      );
    } else {
      casoResult = await client.query(
        `INSERT INTO casos_seguimiento
          (estudiante_id, psicologo_id, estado, nivel_prioridad, cerrado_en)
         VALUES ($1, $2, $3::varchar, $4, CASE WHEN $3::varchar = 'cerrado' THEN CURRENT_TIMESTAMP ELSE NULL END)
         RETURNING *`,
        [estudianteId, psicologoId, estado, nivelPrioridad]
      );
    }

    const caso = casoResult.rows[0];
    const seguimientoResult = await client.query(
      `INSERT INTO seguimientos_psicopedagogicos
        (caso_id, estudiante_id, psicologo_id, tipo_intervencion, descripcion,
         acuerdos, apariencia_vestimenta, apariencia_fisica, estado_emocional,
         observaciones_adicionales, fecha_intervencion, proxima_fecha, evidencia_base64, evidencia_tipo, rasgos_adolescente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_TIMESTAMP), $12, $13, $14, $15)
       RETURNING *`,
      [caso.id, estudianteId, psicologoId, tipoIntervencion, descripcion,
       acuerdos || null, aparienciaVestimenta || null, aparienciaFisica || null,
       estadoEmocional || null, observacionesAdicionales || null,
       fechaIntervencion || null, proximaFecha || null,
       evidenciaBase64 || null, evidenciaTipo || null, rasgosAdolescente || null]
    );

    await client.query("COMMIT");
    return {
      caso: { ...caso, estado_etiqueta: etiquetaEstado(caso.estado) },
      seguimiento: seguimientoResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function obtenerSeguimientoEstudiante(estudianteId) {
  const estudianteResult = await query(
    `SELECT e.id, e.nombres, e.apellidos, e.correo,
            s.nivel, s.grado, s.letra, s.nombre AS seccion
     FROM estudiantes e
     JOIN secciones s ON s.id = e.seccion_id
     WHERE e.id = $1 AND e.activo = TRUE`,
    [estudianteId]
  );
  if (!estudianteResult.rows[0]) {
    const error = new Error("El estudiante no existe en PostgreSQL");
    error.status = 404;
    throw error;
  }

  const casoResult = await query(
    `SELECT c.*, p.nombres AS psicologo_nombres, p.apellidos AS psicologo_apellidos
     FROM casos_seguimiento c
     JOIN psicologos p ON p.id = c.psicologo_id
     WHERE c.estudiante_id = $1
     ORDER BY (c.estado IN ('abierto', 'en_seguimiento')) DESC, c.fecha_actualizacion DESC
     LIMIT 1`,
    [estudianteId]
  );
  const caso = casoResult.rows[0] || null;
  const historialResult = await query(
    `SELECT sp.*, p.nombres AS psicologo_nombres, p.apellidos AS psicologo_apellidos
     FROM seguimientos_psicopedagogicos sp
     JOIN psicologos p ON p.id = sp.psicologo_id
     WHERE sp.estudiante_id = $1
     ORDER BY sp.fecha_intervencion DESC, sp.id DESC`,
    [estudianteId]
  );

  return {
    estudiante: estudianteResult.rows[0],
    caso: caso ? { ...caso, estado_etiqueta: etiquetaEstado(caso.estado) } : null,
    seguimiento_activo: Boolean(caso && caso.estado !== "cerrado"),
    historial: historialResult.rows
  };
}

async function listarCasos({ soloActivos = true } = {}) {
  const filtro = soloActivos ? "WHERE c.estado IN ('abierto', 'en_seguimiento')" : "";
  const result = await query(
    `SELECT c.id AS caso_id, c.estado, c.nivel_prioridad, c.fecha_creacion, c.fecha_actualizacion,
            p.nombres AS psicologo_nombres, p.apellidos AS psicologo_apellidos,
            e.id AS estudiante_id, e.nombres, e.apellidos, e.correo,
            s.nombre AS seccion, s.grado, s.letra
     FROM casos_seguimiento c
     JOIN estudiantes e ON e.id = c.estudiante_id AND e.activo = TRUE
     JOIN secciones s ON s.id = e.seccion_id
     JOIN psicologos p ON p.id = c.psicologo_id
     ${filtro}
     ORDER BY CASE c.estado WHEN 'abierto' THEN 0 WHEN 'en_seguimiento' THEN 1 ELSE 2 END,
              CASE c.nivel_prioridad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
              c.fecha_actualizacion DESC`
  );
  return result.rows.map(r => ({ ...r, estado_etiqueta: etiquetaEstado(r.estado) }));
}

async function cerrarCaso(estudianteId) {
  const result = await query(
    `UPDATE casos_seguimiento
     SET estado = 'cerrado', cerrado_en = CURRENT_TIMESTAMP, fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE estudiante_id = $1 AND estado IN ('abierto', 'en_seguimiento')
     RETURNING id`,
    [estudianteId]
  );
  return result.rows[0] || null;
}

async function actualizarEstadoCaso(estudianteId, estado, nivelPrioridad, observacion) {
  if (!ESTADOS.has(estado)) {
    const error = new Error("estado invalido (abierto, en_seguimiento, cerrado)");
    error.status = 400;
    throw error;
  }
  if (!observacion || String(observacion).trim().length < 10) {
    const error = new Error("Debes escribir la observación de por qué cambias el estado (mínimo 10 caracteres)");
    error.status = 400;
    throw error;
  }
  const sets = ["estado = $2", "fecha_actualizacion = CURRENT_TIMESTAMP", `observacion_cambio = $${3}`];
  const params = [estudianteId, estado, String(observacion).trim().slice(0,1000)];
  if (nivelPrioridad) {
    params.push(nivelPrioridad);
    sets.push(`nivel_prioridad = $${params.length}`);
  }
  if (estado === "cerrado") sets.push("cerrado_en = CURRENT_TIMESTAMP");
  const result = await query(
    `UPDATE casos_seguimiento SET ${sets.join(", ")}
     WHERE estudiante_id = $1 AND estado IN ('abierto', 'en_seguimiento')
     RETURNING id, estado, nivel_prioridad`,
    params
  );
  const caso = result.rows[0] || null;
  if (caso) {
    // Dejar rastro en historial como intervención de tipo Cambio de estado
    try {
      await query(
        `INSERT INTO seguimientos_psicopedagogicos (caso_id, estudiante_id, psicologo_id, tipo_intervencion, descripcion, estado_emocional)
         SELECT $1, $2, psicologo_id, $3, $4, 'Cambio de estado'
         FROM casos_seguimiento WHERE id = $1`,
        [caso.id, estudianteId, `Cambio de estado → ${etiquetaEstado(estado)}`, String(observacion).trim().slice(0,1000)]
      );
    } catch (_) {}
  }
  return caso;
}

module.exports = {
  ESTADOS,
  PRIORIDADES,
  normalizarEstado,
  normalizarPrioridad,
  etiquetaEstado,
  registrarIntervencion,
  listarCasos,
  cerrarCaso,
  actualizarEstadoCaso,
  obtenerSeguimientoEstudiante
};
