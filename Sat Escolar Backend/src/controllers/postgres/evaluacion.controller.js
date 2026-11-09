// Controlador: evaluacion — SAT Escolar
// Cada dominio expone solo sus casos de uso.

const academicoModel = require("../../models/postgres/academicoModel");
const { programarRecalculoRiesgo } = require("../../utils/recalculoRiesgo");
const { query } = require("../../config/postgres");
const { respuestaError } = require("../../utils/respuestaError");

async function crearEvaluacionAcademica(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden crear evaluaciones" });
    }
    const { seccionId, periodoId, asignaturaId, nombre, fecha, peso = 1 } = req.body;
    const pesoNumero = Number(peso);
    if (!seccionId || !periodoId || !asignaturaId || !String(nombre || "").trim()) {
      return res.status(400).json({ error: "seccionId, periodoId, asignaturaId y nombre son requeridos" });
    }
    if (!Number.isFinite(pesoNumero) || pesoNumero <= 0 || pesoNumero > 100) {
      return res.status(400).json({ error: "El peso debe ser mayor que 0 y menor o igual a 100" });
    }

    const evaluacion = await academicoModel.crearEvaluacion({
      userId: req.user.id,
      userEmail: req.user.email,
      seccionId: Number(seccionId),
      periodoId: Number(periodoId),
      asignaturaId: Number(asignaturaId),
      nombre: String(nombre).trim(),
      fecha: fecha || null,
      peso: pesoNumero
    });
    if (!evaluacion) {
      return res.status(403).json({ error: "La sección no está asignada al docente" });
    }
    res.status(201).json(evaluacion);
  } catch (error) {
    const status = error.code === "23503" ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
}


async function listarEvaluacionesAcademicas(req, res) {
  try {
    if (!["docente", "psicologo"].includes(req.user.role)) {
      return res.status(403).json({ error: "No autorizado para consultar evaluaciones" });
    }
    const evaluaciones = await academicoModel.listarEvaluaciones({
      userId: req.user.id,
      userEmail: req.user.email,
      role: req.user.role,
      seccionId: req.query.seccionId ? Number(req.query.seccionId) : undefined,
      periodoId: req.query.periodoId ? Number(req.query.periodoId) : undefined,
      asignaturaId: req.query.asignaturaId ? Number(req.query.asignaturaId) : undefined
    });
    res.json(evaluaciones);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function guardarNotasEvaluacion(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden registrar notas" });
    }
    const { registros } = req.body;
    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: "registros requeridos" });
    }
    const invalido = registros.find(registro => {
      const valor = Number(registro.valor);
      return !registro.estudianteId || !Number.isFinite(valor) || valor < 0 || valor > 20;
    });
    if (invalido) {
      return res.status(400).json({ error: "Cada nota debe tener estudianteId y un valor entre 0 y 20" });
    }

    const notas = await academicoModel.guardarNotas({
      userId: req.user.id,
      userEmail: req.user.email,
      evaluacionId: Number(req.params.id),
      registros: registros.map(registro => ({
        estudianteId: Number(registro.estudianteId),
        valor: Number(registro.valor),
        observacion: registro.observacion || null
      }))
    });
    res.status(201).json({ ok: true, total: notas.length, notas });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function listarNotasEvaluacion(req, res) {
  try {
    if (!["docente", "psicologo"].includes(req.user.role)) {
      return res.status(403).json({ error: "No autorizado para consultar las notas de la evaluación" });
    }
    const notas = await academicoModel.listarNotasEvaluacion({
      userId: req.user.id,
      userEmail: req.user.email,
      role: req.user.role,
      evaluacionId: Number(req.params.id)
    });
    res.json(notas);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function crearProductoCompetencia(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden crear productos de evaluación" });
    }
    const { seccionId, trimestreId, asignaturaId, competenciaId, nombre } = req.body;
    if (!seccionId || !trimestreId || !asignaturaId || !competenciaId || !String(nombre || "").trim()) {
      return res.status(400).json({ error: "Sección, trimestre, asignatura, competencia y producto son requeridos" });
    }
    const producto = await academicoModel.crearProductoCompetencia({
      userId: req.user.id,
      userEmail: req.user.email,
      seccionId: Number(seccionId),
      trimestreId: Number(trimestreId),
      asignaturaId: Number(asignaturaId),
      competenciaId: Number(competenciaId),
      nombre: String(nombre).trim()
    });
    if (!producto) {
      return res.status(403).json({ error: "El curso, sección o competencia no pertenece al docente" });
    }
    res.status(201).json(producto);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function listarProductosCompetencia(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden consultar productos de evaluación" });
    }
    const productos = await academicoModel.listarProductosCompetencia({
      userId: req.user.id,
      userEmail: req.user.email,
      seccionId: req.query.seccionId ? Number(req.query.seccionId) : undefined,
      asignaturaId: req.query.asignaturaId ? Number(req.query.asignaturaId) : undefined,
      trimestreId: req.query.trimestreId ? Number(req.query.trimestreId) : undefined
    });
    res.json(productos);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarCalificacionesCompetencia(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden consultar estas calificaciones" });
    }
    const calificaciones = await academicoModel.listarCalificacionesProducto({
      userId: req.user.id,
      userEmail: req.user.email,
      productoId: Number(req.params.id)
    });
    if (calificaciones.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado o sección sin estudiantes" });
    }
    res.json(calificaciones);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function guardarCalificacionesCompetencia(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden registrar niveles de logro" });
    }
    const { registros } = req.body;
    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: "Debes enviar al menos una calificación" });
    }
    const permitidos = new Set(["AD", "A", "B", "C"]);
    const normalizados = registros.map(registro => ({
      estudianteId: Number(registro.estudianteId),
      nivelLogro: String(registro.nivelLogro || "").toUpperCase(),
      observacion: String(registro.observacion || "").trim() || null
    }));
    if (normalizados.some(registro => !registro.estudianteId || !permitidos.has(registro.nivelLogro))) {
      return res.status(400).json({ error: "Cada estudiante debe tener un nivel AD, A, B o C" });
    }
    const guardadas = await academicoModel.guardarCalificacionesCompetencia({
      userId: req.user.id,
      userEmail: req.user.email,
      productoId: Number(req.params.id),
      registros: normalizados
    });
    res.json({ ok: true, total: guardadas.length, registros: guardadas });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function listarResumenCompetenciasTrimestrales(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden consultar este resumen" });
    }
    const { seccionId, asignaturaId, anio = new Date().getFullYear() } = req.query;
    if (!seccionId || !asignaturaId) {
      return res.status(400).json({ error: "seccionId y asignaturaId son requeridos" });
    }
    const resumen = await academicoModel.listarResumenCompetenciasTrimestrales({
      userId: req.user.id,
      userEmail: req.user.email,
      seccionId: Number(seccionId),
      asignaturaId: Number(asignaturaId),
      anio: Number(anio)
    });
    res.json(resumen);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function listarCalificacionesTrimestrales(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden consultar estas calificaciones" });
    }
    const { seccionId, competenciaId, trimestreId } = req.query;
    if (!seccionId || !competenciaId || !trimestreId) {
      return res.status(400).json({ error: "seccionId, competenciaId y trimestreId son requeridos" });
    }
    const registros = await academicoModel.listarCalificacionesTrimestrales({
      userId: req.user.id,
      userEmail: req.user.email,
      seccionId: Number(seccionId),
      competenciaId: Number(competenciaId),
      trimestreId: Number(trimestreId)
    });
    if (registros.length === 0) {
      return res.status(404).json({ error: "No se encontraron estudiantes para esta competencia" });
    }
    res.json(registros);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function guardarCalificacionesTrimestrales(req, res) {
  try {
    if (req.user.role !== "docente") {
      return res.status(403).json({ error: "Solo los docentes pueden registrar niveles de logro" });
    }
    const { seccionId, competenciaId, trimestreId, registros } = req.body;
    if (!seccionId || !competenciaId || !trimestreId || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: "Sección, competencia, trimestre y registros son requeridos" });
    }
    const permitidos = new Set(["AD", "A", "B", "C"]);
    const normalizados = registros.map(registro => ({
      estudianteId: Number(registro.estudianteId),
      nivelLogro: String(registro.nivelLogro || "").toUpperCase(),
      observacion: String(registro.observacion || "").trim() || null
    }));
    if (normalizados.some(registro => !registro.estudianteId || !permitidos.has(registro.nivelLogro))) {
      return res.status(400).json({ error: "Cada registro debe contener estudiante y nivel AD, A, B o C" });
    }
    const guardadas = await academicoModel.guardarCalificacionesTrimestrales({
      userId: req.user.id,
      userEmail: req.user.email,
      seccionId: Number(seccionId),
      competenciaId: Number(competenciaId),
      trimestreId: Number(trimestreId),
      registros: normalizados
    });
    programarRecalculoRiesgo(normalizados.map(registro => registro.estudianteId));
    res.json({ ok: true, total: guardadas.length, registros: guardadas, recalculo_riesgo_programado: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}
module.exports = {
  crearEvaluacionAcademica,
  listarEvaluacionesAcademicas,
  guardarNotasEvaluacion,
  listarNotasEvaluacion,
  crearProductoCompetencia,
  listarProductosCompetencia,
  listarCalificacionesCompetencia,
  guardarCalificacionesCompetencia,
  listarResumenCompetenciasTrimestrales,
  listarCalificacionesTrimestrales,
  guardarCalificacionesTrimestrales,
};
