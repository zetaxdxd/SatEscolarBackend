// Controlador: psicologia — SAT Escolar
// Cada dominio expone solo sus casos de uso.

const alertaModel = require("../../models/postgres/alertaModel");
const formularioPsicologicoModel = require("../../models/postgres/formularioPsicologicoModel");
const riesgoEstudianteService = require("../../services/riesgoEstudianteService");
const prediccionService = require("../../services/prediccionService");
const { TESTS_VALIDADOS, calcularResultado } = require("../../data/testsValidados");
const { query } = require("../../config/postgres");
const { respuestaError } = require("../../utils/respuestaError");
const { registrarAcceso } = require("../../utils/auditoria");
const XLSX = require("xlsx");

async function listarAlertasPsicologia(req, res) {
  try {
    const { estado, nivel, seccionId } = req.query;
    const alertas = await alertaModel.listarAlertas({
      estado: estado || undefined,
      nivel: nivel || undefined,
      seccionId: seccionId ? Number(seccionId) : undefined
    });
    const pendientes = await alertaModel.contarPendientes();
    res.json({ alertas, pendientes });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function atenderAlertaPsicologia(req, res) {
  try {
    const alertaId = Number(req.params.id);
    if (!alertaId) return res.status(400).json({ error: "id de alerta requerido" });

    const atendida = await alertaModel.atenderAlerta(alertaId, req.user.id);
    if (!atendida) return res.status(404).json({ error: "alerta no encontrada o ya atendida" });

    res.json({ alerta: atendida, mensaje: "Alerta atendida" });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function crearFormularioPsicologico(req, res) {
  try {
    const { titulo, descripcion, nivel, grado, seccion, preguntas } = req.body;
    if (!titulo) return res.status(400).json({ error: "titulo requerido" });
    if (!Array.isArray(preguntas) || preguntas.length === 0) {
      return res.status(400).json({ error: "Debe agregar al menos una pregunta" });
    }

    const invalida = preguntas.find(p =>
      !p.pregunta ||
      !["cerrada", "abierta", "likert"].includes(p.tipo) ||
      (p.tipo === "cerrada" && (!Array.isArray(p.opciones) || p.opciones.length < 2))
    );

    if (invalida) {
      return res.status(400).json({ error: "Revisa las preguntas cerradas, abiertas y Likert" });
    }

    const formulario = await formularioPsicologicoModel.crearFormulario({
      titulo,
      descripcion,
      nivel,
      grado,
      seccion,
      creadoPor: req.user.id,
      preguntas
    });

    res.status(201).json(formulario);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarFormulariosPsicologicos(req, res) {
  try {
    const formularios = await formularioPsicologicoModel.listarFormularios();
    res.json(formularios);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function obtenerFormularioPsicologico(req, res) {
  try {
    const formulario = await formularioPsicologicoModel.obtenerFormularioPorId(req.params.id);
    if (!formulario) return res.status(404).json({ error: "Formulario no encontrado" });
    res.json(formulario);
  } catch (error) {
    respuestaError(res, error);
  }
}



async function listarHabilitacionesFormularioPsicologico(req, res) {

  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicología o Dirección puede ver este detalle" });
    }
    const docentes = await formularioPsicologicoModel.listarHabilitacionesDocentes(Number(req.params.id));
    if (docentes.length === 0) {
      return res.status(404).json({ error: "No hay docentes asignados a la sección de este formulario" });
    }
    res.json(docentes);
  } catch (error) {
    respuestaError(res, error);
  }
}




async function actualizarFormularioPsicologico(req, res) {
  try {
    const { titulo, descripcion, nivel, grado, seccion, preguntas } = req.body;
    if (!titulo) return res.status(400).json({ error: "titulo requerido" });
    if (!Array.isArray(preguntas) || preguntas.length === 0) {
      return res.status(400).json({ error: "Debe agregar al menos una pregunta" });
    }

    const invalida = preguntas.find(p =>
      !p.pregunta ||
      !["cerrada", "abierta", "likert"].includes(p.tipo) ||
      (p.tipo === "cerrada" && (!Array.isArray(p.opciones) || p.opciones.length < 2))
    );

    if (invalida) {
      return res.status(400).json({ error: "Revisa las preguntas cerradas, abiertas y Likert" });
    }

    const formulario = await formularioPsicologicoModel.actualizarFormulario(req.params.id, {
      titulo,
      descripcion,
      nivel,
      grado,
      seccion,
      preguntas
    });

    res.json(formulario);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

async function eliminarFormularioPsicologico(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicología o Dirección puede eliminar formularios" });
    }
    const r = await query("DELETE FROM formularios_psicologicos WHERE id = $1 RETURNING id", [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Formulario no encontrado" });
    res.json({ mensaje: "Formulario eliminado", id: r.rows[0].id });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarRespuestasPsicologia(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo psicología puede ver respuestas" });
    }
    const respuestas = await formularioPsicologicoModel.listarRespuestasPsicologia();
    res.json(respuestas);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function obtenerDetalleRespuestaPsicologia(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo psicología puede ver respuestas" });
    }
    const detalle = await formularioPsicologicoModel.obtenerDetalleRespuestaPsicologia(
      Number(req.params.formularioId),
      Number(req.params.estudianteId)
    );
    if (!detalle) return res.status(404).json({ error: "Respuesta no encontrada" });
    res.json(detalle);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function obtenerAnaliticaFormularioPsicologia(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo psicología puede ver analítica" });
    }
    const analitica = await formularioPsicologicoModel.obtenerAnaliticaFormularioPsicologia(Number(req.params.formularioId));
    if (!analitica) return res.status(404).json({ error: "Formulario no encontrado" });
    res.json(analitica);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function configurarPuntajesPregunta(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicología o Dirección puede configurar puntajes" });
    }
    const { opciones } = req.body;
    if (!Array.isArray(opciones) || opciones.length < 2) {
      return res.status(400).json({ error: "Debes enviar al menos dos opciones" });
    }
    const normalizadas = opciones.map(opcion => ({
      texto: String(opcion.texto || "").trim(),
      puntajeRiesgo: Number(opcion.puntajeRiesgo)
    }));
    const invalida = normalizadas.find(opcion =>
      !opcion.texto || !Number.isFinite(opcion.puntajeRiesgo) ||
      opcion.puntajeRiesgo < 0 || opcion.puntajeRiesgo > 100
    );
    if (invalida) {
      return res.status(400).json({ error: "Cada opción debe tener texto y puntaje entre 0 y 100" });
    }

    const resultado = await formularioPsicologicoModel.configurarPuntajesPregunta(
      Number(req.params.id),
      normalizadas
    );
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function listarIndicadoresRiesgo(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const indicadores = await riesgoEstudianteService.listarUltimosIndicadores({
      seccionId: req.query.seccionId ? Number(req.query.seccionId) : null
    });
    res.json(indicadores);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function recalcularRiesgoEstudiante(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const resultado = await riesgoEstudianteService.calcularIndicadorEstudiante(
      Number(req.params.id),
      {
        periodoId: req.body?.periodoId ? Number(req.body.periodoId) : null,
        guardar: true
      }
    );
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function obtenerRiesgoEstudiante(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const indicador = await riesgoEstudianteService.obtenerUltimoIndicador(Number(req.params.id));
    if (!indicador) {
      return res.status(404).json({ error: "El estudiante todavía no tiene indicador calculado" });
    }
    res.json(indicador);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function obtenerDetalleCompletoEstudiante(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicología o Dirección puede ver este detalle" });
    }
 
    const estudianteId = Number(req.params.id);
 
    const estudianteResult = await query(
      `SELECT e.id, e.nombres, e.apellidos, e.correo, e.seccion_id,
              s.nivel, s.grado, s.letra, s.nombre AS seccion
       FROM estudiantes e
       JOIN secciones s ON s.id = e.seccion_id
       WHERE e.id = $1 AND e.activo = TRUE`,
      [estudianteId]
    );
    const estudiante = estudianteResult.rows[0];
    if (!estudiante) return res.status(404).json({ error: "Estudiante no encontrado" });
 
    // Indicador de riesgo más reciente ya calculado (no recalcula aquí;
    // el recálculo se dispara aparte, vía el botón o el script).
    const indicador = await riesgoEstudianteService.obtenerUltimoIndicador(estudianteId);
 
    // Detalle día por día de asistencia (últimos 60 días para no traer todo el histórico).
    const asistenciaDetalle = await query(
      `SELECT fecha, estado, observacion
       FROM asistencias
       WHERE estudiante_id = $1
         AND fecha >= CURRENT_DATE - INTERVAL '60 days'
       ORDER BY fecha DESC`,
      [estudianteId]
    );
 
    // Detalle de calificaciones por competencia, con nombre de curso, competencia y trimestre.
    const calificacionesDetalle = await query(
      `SELECT
         ctc.nivel_logro,
         ctc.observacion,
         ctc.updated_at,
         c.nombre AS competencia,
         a.nombre AS asignatura,
         t.nombre AS trimestre,
         t.orden AS trimestre_orden
       FROM calificaciones_trimestrales_competencia ctc
       JOIN competencias c ON c.id = ctc.competencia_id
       JOIN asignaturas a ON a.id = c.asignatura_id
       JOIN trimestres_academicos t ON t.id = ctc.trimestre_id
       WHERE ctc.estudiante_id = $1
       ORDER BY t.orden ASC, a.nombre ASC, c.nombre ASC`,
      [estudianteId]
    );
 
    registrarAcceso({ usuarioId: req.user.id, rol: req.user.role, accion: "ver_detalle_estudiante", estudianteId });
    res.json({
      estudiante,
      indicador: indicador || null,
      asistencia_detalle: asistenciaDetalle.rows,
      calificaciones_detalle: calificacionesDetalle.rows
    });
  } catch (error) {
    respuestaError(res, error);
  }
}


function validarAccesoPsicologia(req, res) {
  if (!["psicologo", "director"].includes(req.user.role)) {
    res.status(403).json({ error: "Solo Psicología o Dirección puede consultar indicadores de riesgo" });
    return false;
  }
  return true;
}

async function generarPrediccion(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const estudianteId = Number(req.params.estudianteId);
    if (!estudianteId) return res.status(400).json({ error: "ID de estudiante requerido" });

    // Buscar psicologo_id del usuario (puede ser null si es director)
    let psicologoId = null;
    if (req.user.role === "psicologo") {
      const psicResult = await query("SELECT id FROM psicologos WHERE usuario_id = $1", [req.user.id]);
      psicologoId = psicResult.rows[0]?.id || null;
    }

    const rawRasgos = String(req.body?.rasgos || "").trim();
    const rawEstruct = String(req.body?.rasgos_estructurados || "").trim();
    const combinado = [rawRasgos, rawEstruct].filter(Boolean).join(" | ");
    const rasgos = combinado ? combinado.split(/\s+/).slice(0,1500).join(" ").slice(0,9000) : null;
    const resultado = await prediccionService.generarPrediccionIA(estudianteId, psicologoId, rasgos);
    res.json(resultado);
  } catch (error) {
    const msg = error.message || "";
    if (msg.includes("API key")) {
      return res.status(503).json({ error: msg });
    }
    res.status(error.status || 500).json({ error: msg });
  }
}


async function obtenerPrediccionesEstudiante(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const estudianteId = Number(req.params.estudianteId);
    const limite = Math.min(Math.max(Number(req.query.limite) || 30, 1), 50);
    const predicciones = await prediccionService.obtenerPrediccionesEstudiante(estudianteId, limite);
    res.json(predicciones);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function obtenerPrediccionesPorSeccion(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const seccionId = Number(req.params.seccionId);
    const predicciones = await prediccionService.obtenerPrediccionesPorSeccion(seccionId);
    res.json(predicciones);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function obtenerPrediccionesHoy(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const limite = Math.min(Math.max(Number(req.query.limite) || 30, 1), 50);
    const predicciones = await prediccionService.obtenerPrediccionesHoy(limite);
    res.json(predicciones);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function eliminarPrediccionPsicologia(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID requerido" });
    const eliminada = await prediccionService.eliminarPrediccion(id);
    if (!eliminada) return res.status(404).json({ error: "Predicción no encontrada" });
    res.json({ mensaje: "Predicción eliminada", id: eliminada.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


async function limpiarPredicciones(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const dias = Number(req.body?.dias) || 30;
    const eliminadas = await prediccionService.limpiarPrediccionesAntiguas(dias);
    res.json({ mensaje: `${eliminadas} predicciones eliminadas (>${dias} días)` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listarDocumentosPorFecha(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const fecha = req.query.fecha ? String(req.query.fecha).slice(0,10) : new Date().toISOString().slice(0,10);
    // Validar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: "Fecha inválida, use YYYY-MM-DD" });
    const exp = await query(
      `SELECT ef.id, ef.tipo, ef.correlativo, ef.fecha_registro, ef.datos,
              e.id AS estudiante_id, e.nombres, e.apellidos, e.correo,
              s.grado, s.letra, s.nivel
       FROM expediente_formatos ef
       JOIN estudiantes e ON e.id = ef.estudiante_id
       JOIN secciones s ON s.id = e.seccion_id
       WHERE ef.fecha_registro::date = $1::date
       ORDER BY ef.fecha_registro DESC`,
      [fecha]
    );
    const fichas = await query(
      `SELECT f.id, f.estudiante_id, f.updated_at AS fecha_registro, f.datos,
              e.nombres, e.apellidos, e.correo, s.grado, s.letra, s.nivel
       FROM fichas_diagnosticas_socioeducativas f
       JOIN estudiantes e ON e.id = f.estudiante_id
       JOIN secciones s ON s.id = e.seccion_id
       WHERE f.completada = true AND f.updated_at::date = $1::date
       ORDER BY f.updated_at DESC`,
      [fecha]
    );
    const lista = [
      ...exp.rows.map(r => ({
        id: r.id,
        tipo: r.tipo,
        tipo_label: r.tipo,
        correlativo: r.correlativo,
        fecha_registro: r.fecha_registro,
        estudiante_id: r.estudiante_id,
        nombres: r.nombres,
        apellidos: r.apellidos,
        correo: r.correo,
        grado: r.grado,
        letra: r.letra,
        nivel: r.nivel,
        origen: 'expediente',
        nombre_archivo: `${r.tipo} - ${r.apellidos || ''} ${r.nombres || ''}`.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\- ]/g,'').replace(/\s+/g,' ').trim()
      })),
      ...fichas.rows.map(r => ({
        id: r.id,
        tipo: 'ficha_socioeducativa',
        tipo_label: 'Ficha Socioeducativa',
        correlativo: null,
        fecha_registro: r.fecha_registro,
        estudiante_id: r.estudiante_id,
        nombres: r.nombres,
        apellidos: r.apellidos,
        correo: r.correo,
        grado: r.grado,
        letra: r.letra,
        nivel: r.nivel,
        origen: 'ficha',
        nombre_archivo: `ficha_socioeducativa - ${r.apellidos || ''} ${r.nombres || ''}`.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\- ]/g,'').replace(/\s+/g,' ').trim()
      }))
    ].sort((a,b)=> new Date(b.fecha_registro) - new Date(a.fecha_registro));
    res.json({ fecha, total: lista.length, documentos: lista });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listarTestsValidados(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const builtIn = TESTS_VALIDADOS.map(t => ({
      codigo: t.codigo,
      nombre: t.nombre,
      descripcion: t.descripcion,
      num_preguntas: t.preguntas.length,
      tiempo: t.tiempo,
      validacion: t.validacion,
      puntaje_max: t.puntaje_max,
      autor: t.autor || "",
      tipo: "minsa"
    }));
    let custom = [];
    try {
      const result = await query("SELECT codigo, nombre, descripcion, autor, puntaje_max, tiempo, validacion, jsonb_array_length(preguntas) AS num_preguntas FROM tests_personalizados WHERE activo = TRUE ORDER BY created_at DESC");
      custom = result.rows.map(r => ({ ...r, num_preguntas: Number(r.num_preguntas), tipo: "personalizado" }));
    } catch (_) {}
    res.json([...builtIn, ...custom]);
  } catch (e) { respuestaError(res, e); }
}

async function detalleTestValidado(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const { codigo } = req.params;
    const builtIn = TESTS_VALIDADOS.find(t => t.codigo === codigo);
    if (builtIn) return res.json(builtIn);
    try {
      const result = await query("SELECT * FROM tests_personalizados WHERE codigo = $1 AND activo = TRUE", [codigo]);
      if (result.rows.length) {
        const t = result.rows[0];
        return res.json({
          codigo: t.codigo,
          nombre: t.nombre,
          descripcion: t.descripcion,
          preguntas: t.preguntas,
          opciones: t.opciones,
          rangos: t.rangos,
          puntaje_max: t.puntaje_max,
          tiempo: t.tiempo,
          validacion: t.validacion,
          autor: t.autor || "",
          tipo: "personalizado"
        });
      }
    } catch (_) {}
    res.status(404).json({ error: "Test no encontrado" });
  } catch (e) { respuestaError(res, e); }
}

async function habilitarTestValidado(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const { codigo, grado, seccion, nivel } = req.body;
    if (!codigo || !grado || !seccion) return res.status(400).json({ error: "código, grado y sección son requeridos" });
    const test = TESTS_VALIDADOS.find(t => t.codigo === codigo);
    if (!test) return res.status(404).json({ error: "Test no encontrado" });
    const nivelFinal = nivel || "Secundaria";
    const preguntas = test.preguntas.map(p => ({
      tipo: "cerrada",
      pregunta: p,
      opciones: test.opciones.map(o => o.texto)
    }));
    const formulario = await formularioPsicologicoModel.crearFormulario({
      titulo: `${test.codigo} — ${test.nombre}`,
      descripcion: `${test.descripcion} | Validación: ${test.validacion}`,
      nivel: nivelFinal,
      grado,
      seccion,
      creadoPor: req.user.id,
      preguntas
    });
    // Marcar como validado y guardar puntajes
    await query("UPDATE formularios_psicologicos SET es_validado = TRUE, codigo_minsa = $2 WHERE id = $1", [formulario.id, test.codigo]);
    // Crear habilitación para que el estudiante pueda ver y responder el test
    const seccionRes = await query("SELECT id FROM secciones WHERE grado = $1 AND letra = $2 AND nivel = $3 LIMIT 1", [grado, seccion, nivelFinal]);
    if (seccionRes.rows.length > 0) {
      await query(
        "INSERT INTO formulario_habilitaciones (formulario_id, seccion_id, docente_id, activo) VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING",
        [formulario.id, seccionRes.rows[0].id, req.user.id]
      );
    }
    // Configurar puntajes por pregunta (mapeo 0..max -> 0..100 para motor de riesgo)
    const maxPuntaje = Math.max(...test.opciones.map(o => o.puntaje));
    for (const preg of formulario.preguntas) {
      const opcionesConPuntaje = test.opciones.map(o => ({ texto: o.texto, puntajeRiesgo: Math.round((o.puntaje / maxPuntaje) * 100) }));
      await formularioPsicologicoModel.configurarPuntajesPregunta(preg.id, opcionesConPuntaje);
    }
    res.status(201).json({ mensaje: `Test ${test.codigo} habilitado para ${grado} ${seccion}`, formularioId: formulario.id });
  } catch (e) { respuestaError(res, e); }
}

async function obtenerResultadoTestValidado(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const formularioId = Number(req.params.formularioId);
    const estudianteId = Number(req.params.estudianteId);
    const detalle = await formularioPsicologicoModel.obtenerDetalleRespuestaPsicologia(formularioId, estudianteId);
    if (!detalle) return res.status(404).json({ error: "Sin respuestas" });
    const form = await query("SELECT codigo_minsa FROM formularios_psicologicos WHERE id = $1", [formularioId]);
    const codigo = form.rows[0]?.codigo_minsa;
    if (!codigo) return res.json(detalle);
    const test = TESTS_VALIDADOS.find(t => t.codigo === codigo);
    const resultado = calcularResultado(codigo, detalle.respuestas.map(r => ({ respuesta: r.respuesta, pregunta: r.pregunta })));
    res.json({ ...detalle, test, resultado });
  } catch (e) { respuestaError(res, e); }
}


module.exports = {
  listarAlertasPsicologia,
  atenderAlertaPsicologia,
  crearFormularioPsicologico,
  listarFormulariosPsicologicos,
  obtenerFormularioPsicologico,
  listarHabilitacionesFormularioPsicologico,
  actualizarFormularioPsicologico,
  eliminarFormularioPsicologico,
  listarRespuestasPsicologia,
  obtenerDetalleRespuestaPsicologia,
  obtenerAnaliticaFormularioPsicologia,
  configurarPuntajesPregunta,
  listarIndicadoresRiesgo,
  recalcularRiesgoEstudiante,
  obtenerRiesgoEstudiante,
  obtenerDetalleCompletoEstudiante,
  validarAccesoPsicologia,
  generarPrediccion,
  obtenerPrediccionesEstudiante,
  obtenerPrediccionesPorSeccion,
  obtenerPrediccionesHoy,
  eliminarPrediccionPsicologia,
  limpiarPredicciones,
  listarTestsValidados,
  detalleTestValidado,
  habilitarTestValidado,
  obtenerResultadoTestValidado,
  importarExcelTests,
  guardarTestPersonalizado,
  editarTestPersonalizado,
  eliminarTestPersonalizado,
  generarTestConIA,
  listarDocumentosPorFecha,
};

// ── IMPORTAR EXCEL COMO TEST ───────────────────────────────────────────────

function parsearExcelABuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  return { sheetName, data };
}

function detectarFormatoExcel(rows) {
  if (!rows.length || rows.length < 2) return null;
  const header = rows[0].map(h => String(h).toLowerCase().trim());
  const hasPuntaje = header.some(h => /puntaje|score|puntos?|valor/.test(h));
  const hasOpcion = header.some(h => /opcion|option|respuesta|respuesta/.test(h));
  const hasPregunta = header.some(h => /pregunta|question|item|enunciado/.test(h));
  if (hasPregunta && hasPuntaje) return "con_puntajes";
  if (hasPregunta && hasOpcion) return "pregunta_opciones";
  return "simple";
}

function generarRangosAutomaticos(maxPuntaje) {
  if (maxPuntaje <= 0) return [];
  const step = maxPuntaje / 4;
  return [
    { min: 0, max: Math.round(step), nivel: "Mínimo", color: "#1f9d6f", recomendacion: "Sin riesgo significativo." },
    { min: Math.round(step) + 1, max: Math.round(step * 2), nivel: "Leve", color: "#eab308", recomendacion: "Observar y seguimiento." },
    { min: Math.round(step * 2) + 1, max: Math.round(step * 3), nivel: "Moderado", color: "#f97316", recomendacion: "Intervención focal." },
    { min: Math.round(step * 3) + 1, max: maxPuntaje, nivel: "Severo", color: "#dc2626", recomendacion: "Derivación prioritaria." }
  ];
}

function parsearExcelATest(rows, nombreTest) {
  const formato = detectarFormatoExcel(rows);
  if (!formato) throw new Error("No se pudo detectar el formato del Excel. Asegúrate de tener una fila de encabezados.");

  const header = rows[0].map(h => String(h).toLowerCase().trim());
  const dataRows = rows.slice(1).filter(r => r.some(c => c !== ""));

  if (formato === "con_puntajes") {
    const idxPregunta = header.findIndex(h => /pregunta|question|item|enunciado/.test(h));
    const opcionCols = [];
    header.forEach((h, i) => {
      if (i !== idxPregunta && /opcion|option|respuesta/.test(h)) {
        const scoreCol = header.findIndex((hh, ii) => ii > i && /puntaje|score|puntos?|valor/.test(hh));
        opcionCols.push({ textoIdx: i, scoreIdx: scoreCol, nombre: h });
      }
    });
    if (idxPregunta < 0 || opcionCols.length < 2) {
      throw new Error("Formato 'con_puntajes' requiere columna 'Pregunta' + al menos 2 columnas Opción + Puntaje.");
    }
    const preguntas = [];
    const opcionesSet = new Map();
    dataRows.forEach(row => {
      const preg = String(row[idxPregunta] || "").trim();
      if (!preg) return;
      preguntas.push(preg);
      opcionCols.forEach(oc => {
        const texto = String(row[oc.textoIdx] || "").trim();
        const score = Number(row[oc.scoreIdx]) || 0;
        if (texto && !opcionesSet.has(texto)) opcionesSet.set(texto, { texto, puntaje: score });
      });
    });
    const opciones = [...opcionesSet.values()];
    const maxPuntaje = Math.max(...opciones.map(o => o.puntaje));
    const rangos = generarRangosAutomaticos(maxPuntaje);
    return { formato: "con_puntajes", preguntas, opciones, rangos, puntaje_max: maxPuntaje * preguntas.length };
  }

  if (formato === "pregunta_opciones") {
    const idxPregunta = header.findIndex(h => /pregunta|question|item|enunciado/.test(h));
    const optCols = [];
    header.forEach((h, i) => {
      if (i !== idxPregunta && /opcion|option|respuesta/.test(h)) optCols.push(i);
    });
    if (idxPregunta < 0 || optCols.length < 2) throw new Error(`Se necesita columna 'Pregunta' + al menos 2 de Opción.`);
    const preguntas = [];
    dataRows.forEach(row => {
      const preg = String(row[idxPregunta] || "").trim();
      if (preg) preguntas.push(preg);
    });
    const opciones = optCols.map((ci, idx) => ({
      texto: String(rows[0][ci]).replace(/opcion\s*/i, "").replace(/option\s*/i, "").trim() || `Opción ${idx+1}`,
      puntaje: idx
    }));
    const maxPuntaje = Math.max(...opciones.map(o => o.puntaje));
    const rangos = generarRangosAutomaticos(maxPuntaje);
    return { formato: "pregunta_opciones", preguntas, opciones, rangos, puntaje_max: maxPuntaje * preguntas.length };
  }

  // Formato simple: primera columna = preguntas, resto = opciones
  const preguntas = [];
  const opcionesMap = new Map();
  dataRows.forEach((row, rowIdx) => {
    const preg = String(row[0] || "").trim();
    if (!preg) return;
    preguntas.push(preg);
    for (let i = 1; i < row.length; i++) {
      const texto = String(row[i] || "").trim();
      if (texto && !opcionesMap.has(texto)) opcionesMap.set(texto, { texto, puntaje: i - 1 });
    }
  });
  const opciones = [...opcionesMap.values()];
  const maxPuntaje = Math.max(...opciones.map(o => o.puntaje));
  const rangos = generarRangosAutomaticos(maxPuntaje);
  return { formato: "simple", preguntas, opciones, rangos, puntaje_max: maxPuntaje * preguntas.length };
}

async function importarExcelTests(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    if (!req.file) return res.status(400).json({ error: "Archivo Excel requerido. Envía un archivo .xlsx o .xls" });
    let data;
    try {
      ({ data } = parsearExcelABuffer(req.file.buffer));
    } catch (parseErr) {
      return res.status(400).json({ error: `Error al leer Excel: ${parseErr.message}` });
    }
    const nombre = req.body.nombre || req.file.originalname.replace(/\.[^.]+$/, "");
    let test;
    try {
      test = parsearExcelATest(data, nombre);
    } catch (formatErr) {
      return res.status(400).json({ error: `Formato no reconocido: ${formatErr.message}` });
    }
    if (!test.preguntas.length) return res.status(400).json({ error: "No se encontraron preguntas en el Excel" });
    res.json({
      nombre,
      descripcion: `Test personalizado importado desde Excel — ${test.preguntas.length} preguntas`,
      tiempo: `${Math.max(1, Math.ceil(test.preguntas.length * 0.5))} min`,
      validacion: "Importado por psicólogo — SAT Escolar",
      ...test
    });
  } catch (e) { respuestaError(res, e); }
}

function generarCodigoTest(nombre) {
  const slug = nombre
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const code = slug || `TEST-${Date.now()}`;
  return code.slice(0, 50);
}

async function guardarTestPersonalizado(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const { nombre, descripcion, autor, preguntas, opciones, rangos, puntaje_max, tiempo, validacion } = req.body;
    if (!nombre || !preguntas?.length || !opciones?.length) {
      return res.status(400).json({ error: "nombre, preguntas y opciones son requeridos" });
    }
    const nombreExistente = await query("SELECT codigo FROM tests_personalizados WHERE LOWER(nombre) = LOWER($1) AND activo = TRUE", [nombre]);
    if (nombreExistente.rows.length > 0) {
      return res.status(400).json({ error: "Ya existe un test con ese nombre" });
    }
    let codigo = generarCodigoTest(nombre);
    let existente = await query("SELECT codigo FROM tests_personalizados WHERE codigo = $1 AND activo = TRUE", [codigo]);
    if (existente.rows.length > 0) {
      let n = 2;
      while (true) {
        const candidato = `${codigo.slice(0, 48)}-${n}`;
        const testConSufijo = await query("SELECT codigo FROM tests_personalizados WHERE codigo = $1 AND activo = TRUE", [candidato]);
        if (testConSufijo.rows.length === 0) { codigo = candidato; break; }
        n++;
      }
    }
    await query(
      `INSERT INTO tests_personalizados (codigo, nombre, descripcion, autor, preguntas, opciones, rangos, puntaje_max, tiempo, validacion, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [codigo, nombre, descripcion || "", autor || "", JSON.stringify(preguntas), JSON.stringify(opciones), JSON.stringify(rangos || []), puntaje_max || 0, tiempo || "2 min", validacion || "Personalizado", req.user.id]
    );
    res.status(201).json({ mensaje: "Test guardado correctamente", codigo });
  } catch (e) { respuestaError(res, e); }
}

const TESTS_CATALOGO_PROTEGIDOS = ["GAD-7","PHQ-9","BIENESTAR-5","CRAFFT-2-1-CONSUMO-DE-ALCOHOL-Y-DROGAS","ECADA"];
async function editarTestPersonalizado(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const { codigo } = req.params;
    if (TESTS_CATALOGO_PROTEGIDOS.includes(codigo)) return res.status(403).json({ error: "Los tests del catálogo no se pueden editar" });
    const { nombre, descripcion, autor, preguntas, opciones, rangos, puntaje_max, tiempo, validacion } = req.body;
    const existente = await query("SELECT * FROM tests_personalizados WHERE codigo = $1 AND activo = TRUE", [codigo]);
    if (!existente.rows.length) return res.status(404).json({ error: "Test no encontrado" });
    if (nombre) {
      const nombreExistente = await query("SELECT codigo FROM tests_personalizados WHERE LOWER(nombre) = LOWER($1) AND codigo != $2 AND activo = TRUE", [nombre, codigo]);
      if (nombreExistente.rows.length) return res.status(400).json({ error: "Ya existe un test con ese nombre" });
    }
    await query(
      `UPDATE tests_personalizados SET
        nombre = COALESCE($1, nombre),
        descripcion = COALESCE($2, descripcion),
        autor = COALESCE($3, autor),
        preguntas = COALESCE($4, preguntas),
        opciones = COALESCE($5, opciones),
        rangos = COALESCE($6, rangos),
        puntaje_max = COALESCE($7, puntaje_max),
        tiempo = COALESCE($8, tiempo),
        validacion = COALESCE($9, validacion)
      WHERE codigo = $10 AND activo = TRUE`,
      [
        nombre || null, descripcion ?? null, autor ?? null,
        preguntas ? JSON.stringify(preguntas) : null,
        opciones ? JSON.stringify(opciones) : null,
        rangos ? JSON.stringify(rangos) : null,
        puntaje_max || null, tiempo || null, validacion || null,
        codigo
      ]
    );
    res.json({ mensaje: "Test actualizado correctamente" });
  } catch (e) { respuestaError(res, e); }
}

async function generarTestConIA(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const { objetivo, paraQue, numPreguntas, edad } = req.body;
    const objetivoTxt = String(objetivo || "").trim();
    const paraQueTxt = String(paraQue || "").trim();
    if (!objetivoTxt && !paraQueTxt) return res.status(400).json({ error: "Indica el objetivo y para qué quieres el test" });
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) return res.status(503).json({ error: "IA no configurada (GEMINI_API_KEY)" });
    const nPreg = Math.min(20, Math.max(3, Number(numPreguntas) || 8));
    const prompt = `Eres psicólogo experto en adolescentes peruanos (Tarapoto, 13-17 años, 3ro-5to secundaria). Genera un test breve, claro y ético con estas indicaciones:\n- Objetivo: ${objetivoTxt}\n- Para qué lo quiere el psicólogo: ${paraQueTxt}\n- Edad: ${String(edad || "13-17 años, 3ro-5to").trim()}\n- Número de preguntas: ${nPreg}\n\nResponde EXCLUSIVAMENTE JSON válido sin markdown con esta estructura:\n{\n  "nombre": "título corto (ej: Test de Ansiedad Escolar)",\n  "descripcion": "1-2 oraciones breves para qué sirve y en qué edades se usa",\n  "tiempo": "X min",\n  "validacion": "Propuesta IA — revisar con psicólogo",\n  "preguntas": ["pregunta 1", "pregunta 2", ...],\n  "opciones": [{"texto": "Nunca", "puntaje": 0}, {"texto": "A veces", "puntaje": 1}, {"texto": "Frecuente", "puntaje": 2}, {"texto": "Siempre", "puntaje": 3}],\n  "rangos": [{"min":0,"max":6,"nivel":"Bajo","color":"#059669","recomendacion":"..."}, {"min":7,"max":12,"nivel":"Moderado","color":"#d97706","recomendacion":"..."}, {"min":13,"max":18,"nivel":"Alto","color":"#dc2626","recomendacion":"..."}],\n  "puntaje_max": 18\n}\nReglas: preguntas claras para 13-17, lenguaje sencillo peruano, sin diagnosticar, solo tamizaje. Opciones 3-4 con puntaje creciente. Rangos coherentes con puntaje_max (nPreguntas * max puntaje opción). No inventes validación oficial. Breve.`;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${geminiKey}`;
    const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 3000, responseMimeType: "application/json" } };
    let lastErr = null;
    let text = "";
    for (const model of ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.6-flash"]) {
      try {
        const u = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`;
        const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.message || r.status);
        text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) break;
      } catch (e) { lastErr = e; }
    }
    if (!text && lastErr) throw lastErr;
    if (!text) throw new Error("IA no devolvió contenido");
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Respuesta IA no es JSON válido");
      parsed = JSON.parse(m[0]);
    }
    if (!parsed.preguntas?.length || !parsed.opciones?.length) throw new Error("IA no generó preguntas/opciones válidas");
    // Normalizar
    const preguntas = parsed.preguntas.map(p => String(p).trim()).filter(Boolean).slice(0, nPreg);
    const opciones = parsed.opciones.slice(0, 5).map(o => ({ texto: String(o.texto).trim(), puntaje: Number(o.puntaje) || 0 }));
    const maxPunt = Math.max(...opciones.map(o=>o.puntaje),0);
    const puntaje_max = Number(parsed.puntaje_max) || (maxPunt * preguntas.length);
    const rangos = Array.isArray(parsed.rangos) ? parsed.rangos : [];
    const resData = {
      nombre: String(parsed.nombre || objetivoTxt).slice(0,120) || "Test generado con IA",
      descripcion: String(parsed.descripcion || paraQueTxt).slice(0,300) || "Test generado con IA",
      tiempo: String(parsed.tiempo || `${Math.ceil(preguntas.length * 0.5)} min`),
      validacion: String(parsed.validacion || "Propuesta IA — revisar con psicólogo"),
      formato: "ia_generado",
      preguntas, opciones, rangos, puntaje_max
    };
    res.json(resData);
  } catch (e) { respuestaError(res, e); }
}
async function eliminarTestPersonalizado(req, res) {
  try {
    if (!validarAccesoPsicologia(req, res)) return;
    const { codigo } = req.params;
    if (TESTS_CATALOGO_PROTEGIDOS.includes(codigo)) return res.status(403).json({ error: "Los tests del catálogo no se pueden eliminar" });
    const existente = await query("SELECT codigo, nombre FROM tests_personalizados WHERE codigo = $1 AND activo = TRUE", [codigo]);
    if (!existente.rows.length) return res.status(404).json({ error: "Test no encontrado" });
    await query("UPDATE tests_personalizados SET activo = FALSE WHERE codigo = $1", [codigo]);
    res.json({ mensaje: `"${existente.rows[0].nombre}" eliminado correctamente` });
  } catch (e) { respuestaError(res, e); }
}
