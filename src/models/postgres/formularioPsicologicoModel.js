const { pool, query } = require("../../config/postgres");

function normalizarOpcion(opcion) {
  if (typeof opcion === "string") {
    return { texto: opcion.trim(), puntajeRiesgo: null };
  }
  return {
    texto: String(opcion?.texto || opcion?.label || "").trim(),
    puntajeRiesgo: opcion?.puntajeRiesgo ?? opcion?.puntaje_riesgo ?? null
  };
}

const OPCIONES_LIKERT_DEFAULT = [
  { texto: "1 (Nunca)", puntajeRiesgo: 0 },
  { texto: "2 (Casi nunca)", puntajeRiesgo: 25 },
  { texto: "3 (A veces)", puntajeRiesgo: 50 },
  { texto: "4 (Casi siempre)", puntajeRiesgo: 75 },
  { texto: "5 (Siempre)", puntajeRiesgo: 100 }
];

function opcionesParaPregunta(pregunta) {
  if (pregunta.tipo !== "likert") return pregunta.opciones || [];
  if (Array.isArray(pregunta.opciones) && pregunta.opciones.length > 0) return pregunta.opciones;
  return OPCIONES_LIKERT_DEFAULT;
}

async function guardarOpcionesPregunta(client, preguntaId, opciones) {
  for (let i = 0; i < opciones.length; i++) {
    const opcion = normalizarOpcion(opciones[i]);
    if (!opcion.texto) continue;
    await client.query(
      `
        INSERT INTO pregunta_opciones (pregunta_id, texto, puntaje_riesgo, orden)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (pregunta_id, texto)
        DO UPDATE SET
          puntaje_riesgo = COALESCE(EXCLUDED.puntaje_riesgo, pregunta_opciones.puntaje_riesgo),
          orden = EXCLUDED.orden,
          updated_at = CURRENT_TIMESTAMP
      `,
      [preguntaId, opcion.texto, opcion.puntajeRiesgo, i + 1]
    );
  }
}

async function crearFormulario({ titulo, descripcion, nivel, grado, seccion, creadoPor, preguntas }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const formResult = await client.query(
      `
        INSERT INTO formularios_psicologicos
          (titulo, descripcion, nivel, grado, seccion, creado_por)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [titulo, descripcion || null, nivel || null, grado || null, seccion || null, creadoPor || null]
    );

    const formulario = formResult.rows[0];
    const preguntasGuardadas = [];

    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      const opciones = opcionesParaPregunta(p);
      const preguntaResult = await client.query(
        `
          INSERT INTO formulario_preguntas
            (formulario_id, tipo, pregunta, opciones, orden, obligatoria)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [
          formulario.id,
          p.tipo,
          p.pregunta,
          ["cerrada", "likert"].includes(p.tipo) ? JSON.stringify(opciones) : null,
          i + 1,
          p.obligatoria !== false
        ]
      );
      const preguntaGuardada = preguntaResult.rows[0];
      if (["cerrada", "likert"].includes(p.tipo)) {
        await guardarOpcionesPregunta(client, preguntaGuardada.id, opciones);
      }
      preguntasGuardadas.push(preguntaGuardada);
    }

    await client.query("COMMIT");
    return { ...formulario, preguntas: preguntasGuardadas };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listarFormularios() {
  const result = await query(
    `
      SELECT
        f.*,
        COUNT(DISTINCT p.id)::int AS total_preguntas,
        COUNT(DISTINCT h.id) FILTER (WHERE h.activo = TRUE)::int AS total_habilitaciones,
        COUNT(DISTINCT d.id)::int AS total_docentes_asignados,
        GREATEST(
          COUNT(DISTINCT d.id) - COUNT(DISTINCT h.docente_id) FILTER (WHERE h.activo = TRUE),
          0
        )::int AS total_docentes_pendientes
      FROM formularios_psicologicos f
      LEFT JOIN formulario_preguntas p ON p.formulario_id = f.id
      LEFT JOIN secciones s
        ON s.nivel = f.nivel
       AND s.grado = f.grado
       AND s.letra = f.seccion
      LEFT JOIN docente_secciones ds ON ds.seccion_id = s.id
      LEFT JOIN docentes d ON d.id = ds.docente_id AND d.activo = TRUE
      LEFT JOIN formulario_habilitaciones h
        ON h.formulario_id = f.id
       AND h.docente_id = d.id
       AND h.seccion_id = s.id
       AND h.activo = TRUE
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `
  );
  return result.rows;
}

async function listarHabilitacionesDocentes(formularioId) {
  const result = await query(
    `
      SELECT
        d.id AS docente_id,
        d.nombres,
        d.apellidos,
        d.correo,
        s.id AS seccion_id,
        s.nivel,
        s.grado,
        s.letra AS seccion,
        CASE WHEN h.id IS NOT NULL THEN TRUE ELSE FALSE END AS habilitado,
        h.fecha_habilitacion
      FROM formularios_psicologicos f
      JOIN secciones s
        ON s.nivel = f.nivel
       AND s.grado = f.grado
       AND s.letra = f.seccion
      JOIN docente_secciones ds ON ds.seccion_id = s.id
      JOIN docentes d ON d.id = ds.docente_id AND d.activo = TRUE
      LEFT JOIN formulario_habilitaciones h
        ON h.formulario_id = f.id
       AND h.docente_id = d.id
       AND h.seccion_id = s.id
       AND h.activo = TRUE
      WHERE f.id = $1
      ORDER BY habilitado DESC, d.apellidos, d.nombres
    `,
    [formularioId]
  );
  return result.rows;
}

async function obtenerFormularioPorId(id) {
  const formularioResult = await query(
    "SELECT * FROM formularios_psicologicos WHERE id = $1",
    [id]
  );
  const formulario = formularioResult.rows[0];
  if (!formulario) return null;

  const preguntasResult = await query(
    `
      SELECT
        p.*,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', po.id,
              'texto', po.texto,
              'puntaje_riesgo', po.puntaje_riesgo,
              'orden', po.orden
            ) ORDER BY po.orden, po.id
          ) FILTER (WHERE po.id IS NOT NULL),
          '[]'::jsonb
        ) AS opciones_puntuadas
      FROM formulario_preguntas p
      LEFT JOIN pregunta_opciones po ON po.pregunta_id = p.id
      WHERE p.formulario_id = $1
      GROUP BY p.id
      ORDER BY p.orden ASC
    `,
    [id]
  );

  return { ...formulario, preguntas: preguntasResult.rows };
}

async function actualizarFormulario(id, { titulo, descripcion, nivel, grado, seccion, preguntas }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const habilitado = await client.query(
      "SELECT id FROM formulario_habilitaciones WHERE formulario_id = $1 AND activo = TRUE LIMIT 1",
      [id]
    );
    if (habilitado.rows[0]) {
      const error = new Error("No se puede editar un formulario que ya fue habilitado por un docente");
      error.status = 409;
      throw error;
    }

    const formResult = await client.query(
      `
        UPDATE formularios_psicologicos
        SET
          titulo = $2,
          descripcion = $3,
          nivel = $4,
          grado = $5,
          seccion = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [id, titulo, descripcion || null, nivel || null, grado || null, seccion || null]
    );

    const formulario = formResult.rows[0];
    if (!formulario) {
      const error = new Error("Formulario no encontrado");
      error.status = 404;
      throw error;
    }

    await client.query("DELETE FROM formulario_preguntas WHERE formulario_id = $1", [id]);
    const preguntasGuardadas = [];

    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      const opciones = opcionesParaPregunta(p);
      const preguntaResult = await client.query(
        `
          INSERT INTO formulario_preguntas
            (formulario_id, tipo, pregunta, opciones, orden, obligatoria)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [
          id,
          p.tipo,
          p.pregunta,
          ["cerrada", "likert"].includes(p.tipo) ? JSON.stringify(opciones) : null,
          i + 1,
          p.obligatoria !== false
        ]
      );
      const preguntaGuardada = preguntaResult.rows[0];
      if (["cerrada", "likert"].includes(p.tipo)) {
        await guardarOpcionesPregunta(client, preguntaGuardada.id, opciones);
      }
      preguntasGuardadas.push(preguntaGuardada);
    }

    await client.query("COMMIT");
    return { ...formulario, preguntas: preguntasGuardadas };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function obtenerFormularioActivoParaEstudiante(estudianteId) {
  const result = await query(
    `
      SELECT
        f.*,
        h.fecha_habilitacion,
        d.nombres || ' ' || d.apellidos AS habilitado_por,
        COUNT(DISTINCT p.id)::int AS total_preguntas,
        COUNT(DISTINCT r.pregunta_id)::int AS total_respondidas
      FROM estudiantes e
      JOIN formulario_habilitaciones h
        ON h.seccion_id = e.seccion_id
       AND h.activo = TRUE
      JOIN formularios_psicologicos f
        ON f.id = h.formulario_id
       AND f.activo = TRUE
      JOIN docentes d ON d.id = h.docente_id
      LEFT JOIN formulario_preguntas p ON p.formulario_id = f.id
      LEFT JOIN formulario_respuestas r
        ON r.formulario_id = f.id
       AND r.estudiante_id = e.id
      WHERE e.id = $1 AND e.activo = TRUE
      GROUP BY f.id, h.fecha_habilitacion, d.nombres, d.apellidos
      HAVING COUNT(DISTINCT r.pregunta_id) = 0
      ORDER BY h.fecha_habilitacion DESC
      LIMIT 1
    `,
    [estudianteId]
  );

  const formulario = result.rows[0];
  if (!formulario) return null;
  return obtenerFormularioPorId(formulario.id).then(detalle => ({
    ...detalle,
    fecha_habilitacion: formulario.fecha_habilitacion,
    habilitado_por: formulario.habilitado_por,
    total_preguntas: formulario.total_preguntas
  }));
}

async function guardarRespuestasEstudiante({ formularioId, estudianteId, respuestas }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const acceso = await client.query(
      `
        SELECT f.id
        FROM estudiantes e
        JOIN formulario_habilitaciones h
          ON h.seccion_id = e.seccion_id
         AND h.activo = TRUE
        JOIN formularios_psicologicos f
          ON f.id = h.formulario_id
         AND f.activo = TRUE
        WHERE e.id = $1 AND f.id = $2 AND e.activo = TRUE
        LIMIT 1
      `,
      [estudianteId, formularioId]
    );

    if (!acceso.rows[0]) {
      const error = new Error("Formulario no habilitado para este estudiante");
      error.status = 403;
      throw error;
    }

    const guardadas = [];
    for (const item of respuestas) {
      const result = await client.query(
        `
          INSERT INTO formulario_respuestas
            (formulario_id, pregunta_id, estudiante_id, respuesta)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (formulario_id, pregunta_id, estudiante_id)
          DO UPDATE SET respuesta = EXCLUDED.respuesta, created_at = CURRENT_TIMESTAMP
          RETURNING *
        `,
        [formularioId, item.preguntaId, estudianteId, item.respuesta]
      );
      guardadas.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return guardadas;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listarHistorialEstudiante(estudianteId) {
  const result = await query(
    `
      SELECT
        f.id,
        f.titulo,
        MAX(r.created_at) AS fecha_respondida,
        'Completado' AS estado
      FROM formulario_respuestas r
      JOIN formularios_psicologicos f ON f.id = r.formulario_id
      WHERE r.estudiante_id = $1
      GROUP BY f.id, f.titulo
      ORDER BY MAX(r.created_at) DESC
    `,
    [estudianteId]
  );
  return result.rows;
}

async function listarRespuestasPsicologia() {
  const result = await query(
    `
      SELECT
        f.id AS formulario_id,
        f.titulo AS formulario_titulo,
        f.nivel,
        f.grado,
        f.seccion,
        f.es_validado,
        f.codigo_minsa,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        MAX(r.created_at) AS fecha_respuesta,
        COUNT(DISTINCT r.pregunta_id)::int AS total_respuestas,
        COALESCE(SUM(po.puntaje_riesgo),0)::int AS puntaje_total,
        COALESCE(AVG(po.puntaje_riesgo),0)::int AS puntaje_promedio
      FROM formulario_respuestas r
      JOIN formularios_psicologicos f ON f.id = r.formulario_id
      JOIN estudiantes e ON e.id = r.estudiante_id
      LEFT JOIN pregunta_opciones po ON po.pregunta_id = r.pregunta_id AND LOWER(po.texto) = LOWER(r.respuesta)
      GROUP BY f.id, f.titulo, f.nivel, f.grado, f.seccion, f.es_validado, f.codigo_minsa, e.id, e.nombres, e.apellidos, e.correo
      ORDER BY MAX(r.created_at) DESC, e.apellidos, e.nombres
    `
  );
  // Añadir nivel interpretado (0-30 bajo, 31-60 medio, 61-100 alto)
  return result.rows.map(r => ({
    ...r,
    nivel_puntaje: r.puntaje_promedio >= 61 ? 'Alto' : r.puntaje_promedio >= 31 ? 'Medio' : 'Bajo'
  }));
}

async function obtenerDetalleRespuestaPsicologia(formularioId, estudianteId) {
  const encabezadoResult = await query(
    `
      SELECT
        f.id AS formulario_id,
        f.titulo AS formulario_titulo,
        f.descripcion,
        f.nivel,
        f.grado,
        f.seccion,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        MAX(r.created_at) AS fecha_respuesta
      FROM formulario_respuestas r
      JOIN formularios_psicologicos f ON f.id = r.formulario_id
      JOIN estudiantes e ON e.id = r.estudiante_id
      WHERE r.formulario_id = $1 AND r.estudiante_id = $2
      GROUP BY f.id, f.titulo, f.descripcion, f.nivel, f.grado, f.seccion, e.id, e.nombres, e.apellidos, e.correo
    `,
    [formularioId, estudianteId]
  );

  const encabezado = encabezadoResult.rows[0];
  if (!encabezado) return null;

  const respuestasResult = await query(
    `
      SELECT
        p.id AS pregunta_id,
        p.tipo,
        p.pregunta,
        p.orden,
        r.respuesta,
        r.created_at,
        po.puntaje_riesgo,
        po.texto AS opcion_texto
      FROM formulario_preguntas p
      LEFT JOIN formulario_respuestas r
        ON r.pregunta_id = p.id
       AND r.formulario_id = p.formulario_id
       AND r.estudiante_id = $2
      LEFT JOIN pregunta_opciones po ON po.pregunta_id = p.id AND LOWER(po.texto) = LOWER(r.respuesta)
      WHERE p.formulario_id = $1
      ORDER BY p.orden ASC
    `,
    [formularioId, estudianteId]
  );

  const puntajeTotal = respuestasResult.rows.reduce((s, r) => s + (Number(r.puntaje_riesgo) || 0), 0);
  const conPuntaje = respuestasResult.rows.filter(r => r.puntaje_riesgo != null).length;
  const puntajePromedio = conPuntaje ? Math.round(puntajeTotal / conPuntaje) : 0;
  const nivelPuntaje = puntajePromedio >= 61 ? 'Alto' : puntajePromedio >= 31 ? 'Medio' : 'Bajo';
  // Evaluación textual detallada: por cada respuesta, su aporte
  const evaluacion = {
    puntaje_total: puntajeTotal,
    puntaje_promedio: puntajePromedio,
    total_preguntas: respuestasResult.rows.length,
    respondidas: respuestasResult.rows.filter(r => r.respuesta).length,
    nivel: nivelPuntaje,
    interpretacion: nivelPuntaje === 'Alto' ? 'Puntaje alto — requiere atención prioritaria. Revisar respuestas con mayor riesgo.' : nivelPuntaje === 'Medio' ? 'Puntaje medio — en seguimiento. Conversar y observar.' : 'Puntaje bajo — sin señal de alerta, seguimiento normal.'
  };

  return { ...encabezado, respuestas: respuestasResult.rows, evaluacion };
}

async function obtenerAnaliticaFormularioPsicologia(formularioId) {
  const formulario = await obtenerFormularioPorId(formularioId);
  if (!formulario) return null;

  const respuestasResult = await query(
    `
      SELECT
        r.pregunta_id,
        r.respuesta,
        r.created_at,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo
      FROM formulario_respuestas r
      JOIN estudiantes e ON e.id = r.estudiante_id
      WHERE r.formulario_id = $1
      ORDER BY e.apellidos, e.nombres, r.created_at DESC
    `,
    [formularioId]
  );

  const respuestas = respuestasResult.rows;
  const estudiantes = new Map();
  respuestas.forEach(r => {
    estudiantes.set(r.estudiante_id, {
      estudiante_id: r.estudiante_id,
      nombres: r.nombres,
      apellidos: r.apellidos,
      correo: r.correo
    });
  });

  const preguntas = (formulario.preguntas || []).map(p => {
    const dePregunta = respuestas.filter(r => r.pregunta_id === p.id);
    if (p.tipo === "cerrada" || p.tipo === "likert") {
      const conteos = new Map();
      dePregunta.forEach(r => {
        const key = r.respuesta || "Sin respuesta";
        conteos.set(key, (conteos.get(key) || 0) + 1);
      });
      return {
        id: p.id,
        tipo: p.tipo,
        pregunta: p.pregunta,
        orden: p.orden,
        total: dePregunta.length,
        opciones: [...conteos.entries()].map(([opcion, total]) => ({
          opcion,
          total,
          porcentaje: dePregunta.length ? Math.round((total / dePregunta.length) * 100) : 0
        }))
      };
    }

    return {
      id: p.id,
      tipo: p.tipo,
      pregunta: p.pregunta,
      orden: p.orden,
      total: dePregunta.length,
      respuestas: dePregunta.map(r => ({
        estudiante_id: r.estudiante_id,
        estudiante: `${r.nombres || ""} ${r.apellidos || ""}`.trim(),
        correo: r.correo,
        respuesta: r.respuesta,
        fecha: r.created_at
      }))
    };
  });

  return {
    formulario: {
      id: formulario.id,
      titulo: formulario.titulo,
      descripcion: formulario.descripcion,
      nivel: formulario.nivel,
      grado: formulario.grado,
      seccion: formulario.seccion
    },
    total_estudiantes_respondieron: estudiantes.size,
    preguntas
  };
}

async function configurarPuntajesPregunta(preguntaId, opciones) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const preguntaResult = await client.query(
      "SELECT id, tipo FROM formulario_preguntas WHERE id = $1",
      [preguntaId]
    );
    const pregunta = preguntaResult.rows[0];
    if (!pregunta) {
      const error = new Error("Pregunta no encontrada");
      error.status = 404;
      throw error;
    }
    if (!["cerrada", "likert"].includes(pregunta.tipo)) {
      const error = new Error("Solo las preguntas cerradas o Likert admiten puntaje automático");
      error.status = 400;
      throw error;
    }

    const opcionesActuales = await client.query(
      "SELECT texto FROM pregunta_opciones WHERE pregunta_id = $1 ORDER BY orden, id",
      [preguntaId]
    );
    const textosActuales = new Set(opcionesActuales.rows.map(item => item.texto));
    const textosRecibidos = new Set(opciones.map(item => normalizarOpcion(item).texto));
    if (
      textosActuales.size !== textosRecibidos.size ||
      [...textosRecibidos].some(texto => !textosActuales.has(texto))
    ) {
      const error = new Error("Debes puntuar exactamente las opciones registradas en la pregunta");
      error.status = 400;
      throw error;
    }

    await guardarOpcionesPregunta(client, preguntaId, opciones);
    const result = await client.query(
      `
        SELECT id, pregunta_id, texto, puntaje_riesgo, orden
        FROM pregunta_opciones
        WHERE pregunta_id = $1
        ORDER BY orden, id
      `,
      [preguntaId]
    );
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  crearFormulario,
  listarFormularios,
  listarHabilitacionesDocentes,
  obtenerFormularioPorId,
  actualizarFormulario,
  obtenerFormularioActivoParaEstudiante,
  guardarRespuestasEstudiante,
  listarHistorialEstudiante,
  listarRespuestasPsicologia,
  obtenerDetalleRespuestaPsicologia,
  obtenerAnaliticaFormularioPsicologia,
  configurarPuntajesPregunta
};
