const {
  guardarRegistroDocente, getRegistrosDeEstudiante, getAsistenciaEstudiante
} = require("../models/postgres/registroDocenteModel");
const {
  activarFormulario, desactivarFormulario, getFormularioActivo,
  guardarRespuestaFormulario, getRespuestasFormulario, getRespuestasEstudiante
} = require("../models/postgres/formularioSocioModel");
const {
  guardarEvaluacionRiesgo, getEvaluacionRiesgo, contarIncidentesEstudiante
} = require("../models/postgres/evaluacionRiesgoModel");
const pgEstudianteModel = require("../models/postgres/estudianteModel");

const { evaluarEstudiante, analizarTextoSocio } = require("../utils/motorRiesgo");
const reporteAnonimoModel = require("../models/postgres/reporteAnonimoModel");
const docentePgModel = require("../models/postgres/docenteModel");
const seguimientoPgModel = require("../models/postgres/seguimientoModel");
const { respuestaError } = require("../utils/respuestaError");

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
const TIPOS_IMAGEN_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function prepararArchivoReporte(fotoBase64) {
  if (!fotoBase64) return null;
  const match = String(fotoBase64).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match || !TIPOS_IMAGEN_PERMITIDOS.has(match[1])) {
    const error = new Error("La evidencia debe ser una imagen JPEG, PNG, WebP o GIF valida");
    error.status = 400;
    throw error;
  }
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64").length;
  if (bytes > MAX_IMAGEN_BYTES) {
    const error = new Error("La imagen no debe superar los 5 MB");
    error.status = 413;
    throw error;
  }
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[match[1]];
  return {
    nombre: `evidencia-${Date.now()}.${extension}`,
    tipoMime: match[1],
    contenidoBase64: String(fotoBase64)
  };
}

// ─── ESTUDIANTES ──────────────────────────────────────────────────────────────

async function borrarEstudiante(req, res) {
  try {
    const desactivado = await pgEstudianteModel.desactivarEstudiante(Number(req.params.id));
    if (!desactivado) return res.status(404).json({ error: "Estudiante no encontrado" });
    res.json({ ok: true });
  } catch (e) { respuestaError(res, e); }
}

// ─── REGISTROS DOCENTE ────────────────────────────────────────────────────────

async function guardarRegistro(req, res) {
  try {
    const { estudianteId, evaluacion, asistencia, nota, conducta, observacion } = req.body;
    if (!estudianteId) return res.status(400).json({ error: "estudianteId requerido" });

    const registro = await guardarRegistroDocente({
      estudianteId, docenteId: req.user.id,
      evaluacion: evaluacion || "Semanal",
      asistencia: asistencia || "Asistió",
      nota: nota ?? null,
      conducta: conducta || "Buena",
      observacion: observacion || null
    });

    // Recalcular riesgo después de cada registro
    await recalcularRiesgo(estudianteId);
    res.status(201).json(registro);
  } catch (e) { respuestaError(res, e); }
}

async function obtenerRegistros(req, res) {
  try {
    const registros = await getRegistrosDeEstudiante(req.params.id);
    res.json(registros);
  } catch (e) { respuestaError(res, e); }
}

// ─── FORMULARIOS SOCIOEMOCIONALES ─────────────────────────────────────────────

async function activar(req, res) {
  try {
    const { grado, seccion } = req.body;
    if (!grado || !seccion) return res.status(400).json({ error: "grado y seccion requeridos" });
    const formulario = await activarFormulario({ docenteId: req.user.id, grado, seccion });
    res.json(formulario);
  } catch (e) { respuestaError(res, e); }
}

async function desactivar(req, res) {
  try {
    const { grado, seccion } = req.body;
    await desactivarFormulario(req.user.id, grado, seccion);
    res.json({ ok: true });
  } catch (e) { respuestaError(res, e); }
}

async function formularioActivo(req, res) {
  try {
    const { grado, seccion } = req.query;
    const f = await getFormularioActivo(grado, seccion);
    res.json(f || null);
  } catch (e) { respuestaError(res, e); }
}

async function enviarRespuestaFormulario(req, res) {
  try {
    const { formularioId, estudianteId, pregunta1, pregunta2, pregunta3, pregunta4, pregunta5 } = req.body;
    if (!formularioId || !estudianteId) return res.status(400).json({ error: "formularioId y estudianteId requeridos" });

    // Analizar texto con el motor
    const textos = [pregunta1, pregunta2, pregunta3, pregunta4, pregunta5].filter(Boolean);
    const { puntaje, alertas } = analizarTextoSocio(textos);
    let riesgoSocio = "Bajo";
    if (puntaje >= 60) riesgoSocio = "Alto";
    else if (puntaje >= 30) riesgoSocio = "Medio";

    const respuesta = await guardarRespuestaFormulario({
      formularioId, estudianteId, pregunta1, pregunta2, pregunta3, pregunta4, pregunta5,
      riesgoSocio, puntajeSocio: puntaje
    });

    // Recalcular riesgo global
    await recalcularRiesgo(estudianteId);
    res.status(201).json({ ...respuesta, alertas });
  } catch (e) { respuestaError(res, e); }
}

async function obtenerRespuestasGrupo(req, res) {
  try {
    const { grado, seccion } = req.query;
    const respuestas = await getRespuestasFormulario(grado, seccion);
    res.json(respuestas);
  } catch (e) { respuestaError(res, e); }
}

// ─── INCIDENTES ───────────────────────────────────────────────────────────────

async function reportarIncidente(req, res) {
  try {
    if (!["estudiante", "docente"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo estudiantes y docentes pueden enviar reportes anonimos" });
    }
    const descripcion = String(req.body.descripcion || "").trim();
    if (!descripcion) return res.status(400).json({ error: "descripcion requerida" });
    if (descripcion.length > 3000) return res.status(400).json({ error: "La descripcion no debe superar 3000 caracteres" });

    let seccionId = req.user.seccionId || null;
    if (req.user.role === "docente") {
      const secciones = await docentePgModel.listarSeccionesDeDocente(req.user.id, req.user.email);
      seccionId = secciones[0]?.seccion_id || null;
    }

    const reporte = await reporteAnonimoModel.crearReporteAnonimo({
      seccionId,
      descripcion,
      archivo: prepararArchivoReporte(req.body.fotoBase64)
    });
    res.status(201).json(reporte);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function obtenerIncidentes(req, res) {
  try {
    if (req.user.role !== "psicologo") {
      return res.status(403).json({ error: "Solo Psicologia puede consultar reportes anonimos" });
    }
    const soloNuevos = req.query.nuevos === "1";
    const lista = await reporteAnonimoModel.listarReportesAnonimos({ soloPendientes: soloNuevos });
    res.json(lista);
  } catch (e) { respuestaError(res, e); }
}

async function marcarLeidos(req, res) {
  try {
    if (req.user.role !== "psicologo") {
      return res.status(403).json({ error: "Solo Psicologia puede revisar reportes anonimos" });
    }
    const revisadoPor = req.user.authSource === "postgres" ? req.user.id : null;
    const actualizados = await reporteAnonimoModel.marcarReportesRevisados(revisadoPor);
    res.json({ ok: true, total: actualizados.length });
  } catch (e) { respuestaError(res, e); }
}

async function contarIncidentesPendientes(req, res) {
  try {
    if (!['docente', 'psicologo'].includes(req.user.role)) {
      return res.status(403).json({ error: "No autorizado para consultar el contador" });
    }
    let seccionIds = null;
    if (req.user.role === "docente") {
      const secciones = await docentePgModel.listarSeccionesDeDocente(req.user.id, req.user.email);
      seccionIds = secciones.map(seccion => Number(seccion.seccion_id));
    }
    const total = await reporteAnonimoModel.contarReportesPendientes({ seccionIds });
    res.json({ total });
  } catch (e) { respuestaError(res, e); }
}

// ─── EVALUACIÓN DE RIESGO ─────────────────────────────────────────────────────

async function obtenerEvaluacion(req, res) {
  try {
    const ev = await getEvaluacionRiesgo(req.params.id);
    if (!ev) return res.json({ nivelRiesgo: "Sin datos", puntajeTotal: 0 });
    res.json(ev);
  } catch (e) { respuestaError(res, e); }
}

async function forzarRecalculo(req, res) {
  try {
    const resultado = await recalcularRiesgo(req.params.id);
    res.json(resultado);
  } catch (e) { respuestaError(res, e); }
}

// Función interna reutilizable
async function recalcularRiesgo(estudianteId) {
  const registros   = await getRegistrosDeEstudiante(estudianteId);
  const respuestas  = await getRespuestasEstudiante(estudianteId);
  const numIncidentes = await contarIncidentesEstudiante(estudianteId);

  const notas      = registros.filter(r => r.nota !== null).map(r => r.nota);
  const asistencias = registros.map(r => r.asistencia);
  const conductas  = registros.map(r => r.conducta);

  const resultado = evaluarEstudiante({ notas, asistencias, conductas, respuestasSocio: respuestas, numIncidentes });

  await guardarEvaluacionRiesgo({
    estudianteId,
    nivelRiesgo:      resultado.nivelRiesgo,
    puntajeTotal:     resultado.puntajeTotal,
    puntajeAcademico: resultado.dimensiones.academico.puntaje,
    puntajeAsistencia:resultado.dimensiones.asistencia.puntaje,
    puntajeConducta:  resultado.dimensiones.conducta.puntaje,
    puntajeSocio:     resultado.dimensiones.socio.puntaje
  });

  return resultado;
}

// ─── SEGUIMIENTO ─────────────────────────────────────────────────────────────

async function actualizarSeguimiento(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicologia o Direccion puede registrar seguimientos" });
    }
    if (!req.user.psychologistId) {
      return res.status(403).json({ error: "La sesion del psicologo debe provenir de PostgreSQL" });
    }

    const estudianteId = Number(req.body.estudianteId);
    const estadoOriginal = req.body.estadoNuevo || req.body.estado;
    const estado = seguimientoPgModel.normalizarEstado(estadoOriginal);
    if (!estudianteId || !seguimientoPgModel.ESTADOS.has(estado)) {
      return res.status(400).json({ error: "estudianteId y estado valido son requeridos" });
    }

    const tipoIntervencion = String(req.body.tipoIntervencion || req.body.accion || "Intervencion psicopedagogica").trim();
    const descripcion = String(req.body.descripcion || req.body.notas || req.body.accion || "").trim();
    if (!descripcion) return res.status(400).json({ error: "La descripcion de la intervencion es obligatoria" });
    if (descripcion.length > 5000) return res.status(400).json({ error: "La descripcion no debe superar 5000 caracteres" });

    let evidenciaBase64=null, evidenciaTipo=null;
    if(req.body.fotoBase64){
      const archivo=prepararArchivoReporte(req.body.fotoBase64);
      if(archivo){ evidenciaBase64=archivo.contenidoBase64; evidenciaTipo=archivo.tipoMime; }
    }
    const rawRasgosSeg = String(req.body.rasgosAdolescente || "").trim();
    const rasgosAdolescente = rawRasgosSeg ? rawRasgosSeg.split(/\s+/).slice(0,1500).join(" ").slice(0,9000) : null;
    const resultado = await seguimientoPgModel.registrarIntervencion({
      estudianteId,
      usuarioPsicologoId: req.user.id,
      psicologoId: req.user.psychologistId,
      estado,
      nivelPrioridad: seguimientoPgModel.normalizarPrioridad(req.body.nivelPrioridad, estadoOriginal),
      tipoIntervencion,
      descripcion,
      acuerdos: String(req.body.acuerdos || "").trim() || null,
      aparienciaVestimenta: String(req.body.aparienciaVestimenta || "").trim() || null,
      aparienciaFisica: String(req.body.aparienciaFisica || "").trim() || null,
      estadoEmocional: String(req.body.estadoEmocional || "").trim() || null,
      observacionesAdicionales: String(req.body.observacionesAdicionales || "").trim() || null,
      fechaIntervencion: req.body.fechaIntervencion || null,
      proximaFecha: req.body.proximaFecha || null,
      evidenciaBase64, evidenciaTipo, rasgosAdolescente
    });
    res.status(201).json({ ok: true, ...resultado });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function obtenerHistorial(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicologia o Direccion puede consultar seguimientos" });
    }
    const estudianteId = Number(req.params.id);
    if (!estudianteId) return res.status(400).json({ error: "estudianteId invalido" });
    const seguimiento = await seguimientoPgModel.obtenerSeguimientoEstudiante(estudianteId);
    res.json(seguimiento);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function listarCasosSeguimiento(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicologia o Direccion puede consultar casos" });
    }
    const soloActivos = req.query.todos !== "true";
    const casos = await seguimientoPgModel.listarCasos({ soloActivos });
    res.json(casos);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function cerrarCasoSeguimiento(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicologia o Direccion puede cerrar casos" });
    }
    const estudianteId = Number(req.params.id);
    if (!estudianteId) return res.status(400).json({ error: "estudianteId invalido" });
    const cerrado = await seguimientoPgModel.cerrarCaso(estudianteId);
    if (!cerrado) return res.status(404).json({ error: "No hay caso activo para este estudiante" });
    res.json({ ok: true, mensaje: "Caso cerrado correctamente", caso: cerrado });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function editarEstadoSeguimiento(req, res) {
  try {
    if (!["psicologo", "director"].includes(req.user.role)) {
      return res.status(403).json({ error: "Solo Psicologia o Direccion puede editar casos" });
    }
    const estudianteId = Number(req.params.id);
    if (!estudianteId) return res.status(400).json({ error: "estudianteId invalido" });
    const estado = seguimientoPgModel.normalizarEstado(req.body.estado);
    const nivelPrioridad = req.body.nivelPrioridad
      ? seguimientoPgModel.normalizarPrioridad(req.body.nivelPrioridad)
      : null;
    const observacion = String(req.body.observacion || "").trim();
    const actualizado = await seguimientoPgModel.actualizarEstadoCaso(estudianteId, estado, nivelPrioridad, observacion);
    if (!actualizado) return res.status(404).json({ error: "No hay caso activo para este estudiante" });
    res.json({ ok: true, mensaje: "Estado del caso actualizado", caso: { ...actualizado, estado_etiqueta: seguimientoPgModel.etiquetaEstado(actualizado.estado) } });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

module.exports = {
  borrarEstudiante,
  guardarRegistro, obtenerRegistros,
  activar, desactivar, formularioActivo,
  enviarRespuestaFormulario, obtenerRespuestasGrupo,
  reportarIncidente, obtenerIncidentes, marcarLeidos, contarIncidentesPendientes,
  obtenerEvaluacion, forzarRecalculo,
  actualizarSeguimiento, obtenerHistorial,
  listarCasosSeguimiento, cerrarCasoSeguimiento, editarEstadoSeguimiento,
  recalcularRiesgo
};
