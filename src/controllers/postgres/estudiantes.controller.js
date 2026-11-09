// Controlador: estudiantes — SAT Escolar
// Cada dominio expone solo sus casos de uso.

const academicoModel = require("../../models/postgres/academicoModel");
const asistenciaModel = require("../../models/postgres/asistenciaModel");
const docenteModel = require("../../models/postgres/docenteModel");
const estudianteModel = require("../../models/postgres/estudianteModel");
const formularioPsicologicoModel = require("../../models/postgres/formularioPsicologicoModel");
const { programarRecalculoRiesgo } = require("../../utils/recalculoRiesgo");
const { query } = require("../../config/postgres");
const { respuestaError } = require("../../utils/respuestaError");

async function listarEstudiantes(req, res) {
  try {
    const { nivel, grado, seccion, seccionId } = req.query;
    const estudiantes = await estudianteModel.listarEstudiantes({
      nivel: nivel || undefined,
      grado: grado || undefined,
      letra: seccion || undefined,
      seccionId: seccionId ? Number(seccionId) : undefined
    });
    res.json(estudiantes);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function guardarAsistencias(req, res) {
  try {
    const { fecha, registros } = req.body;
    if (!fecha) return res.status(400).json({ error: "fecha requerida" });
    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: "registros requeridos" });
    }

    const estadosPermitidos = ["Asistió", "Tardanza", "Faltó"];
    const invalido = registros.find(r => !r.estudianteId || !estadosPermitidos.includes(r.estado));
    if (invalido) {
      return res.status(400).json({ error: "Cada registro debe tener estudianteId y estado válido" });
    }

    const guardados = await asistenciaModel.guardarAsistencias({ fecha, registros });
    programarRecalculoRiesgo(registros.map(registro => registro.estudianteId));
    res.status(201).json({ ok: true, total: guardados.length, registros: guardados, recalculo_riesgo_programado: true });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarAsistencias(req, res) {
  try {
    const { fecha, nivel, grado, seccion } = req.query;
    const asistencias = await asistenciaModel.listarAsistencias({
      fecha: fecha || undefined,
      nivel: nivel || undefined,
      grado: grado || undefined,
      letra: seccion || undefined
    });
    res.json(asistencias);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarFechasAsistencias(req, res) {
  try {
    const { seccionId } = req.query;
    const fechas = await asistenciaModel.listarFechasAsistencias({
      seccionId: seccionId ? Number(seccionId) : undefined
    });
    res.json(fechas);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function obtenerFormularioActivoEstudiante(req, res) {
  try {
    if (req.user.role !== "estudiante") {
      return res.status(403).json({ error: "Solo estudiantes pueden consultar este formulario" });
    }
    const estudianteId = req.user.studentId || req.user.id;
    const formulario = await formularioPsicologicoModel.obtenerFormularioActivoParaEstudiante(estudianteId);
    res.json(formulario);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function guardarRespuestasFormularioEstudiante(req, res) {
  try {
    if (req.user.role !== "estudiante") {
      return res.status(403).json({ error: "Solo estudiantes pueden responder formularios" });
    }
    const estudianteId = req.user.studentId || req.user.id;
    const { respuestas } = req.body;
    if (!Array.isArray(respuestas) || respuestas.length === 0) {
      return res.status(400).json({ error: "Debes enviar respuestas" });
    }

    const invalida = respuestas.find(r => !r.preguntaId || !String(r.respuesta || "").trim());
    if (invalida) {
      return res.status(400).json({ error: "Completa todas las respuestas" });
    }

    const guardadas = await formularioPsicologicoModel.guardarRespuestasEstudiante({
      formularioId: Number(req.params.id),
      estudianteId,
      respuestas
    });
    programarRecalculoRiesgo([estudianteId]);
    res.status(201).json({ ok: true, total: guardadas.length, recalculo_riesgo_programado: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}


async function listarHistorialFormulariosEstudiante(req, res) {
  try {
    if (req.user.role !== "estudiante") {
      return res.status(403).json({ error: "Solo estudiantes pueden consultar historial" });
    }
    const estudianteId = req.user.studentId || req.user.id;
    const historial = await formularioPsicologicoModel.listarHistorialEstudiante(estudianteId);
    res.json(historial);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarNotasEstudiante(req, res) {
  try {
    const estudianteId = Number(req.params.id);
    if (req.user.role === "estudiante" && Number(req.user.studentId || req.user.id) !== estudianteId) {
      return res.status(403).json({ error: "No autorizado para consultar estas notas" });
    }
    if (req.user.role === "docente") {
      const estudiante = await estudianteModel.obtenerEstudiantePorId(estudianteId);
      const secciones = await docenteModel.listarSeccionesDeDocente(req.user.id, req.user.email);
      if (!estudiante || !secciones.some(item => Number(item.seccion_id) === Number(estudiante.seccion_id))) {
        return res.status(403).json({ error: "El estudiante no pertenece a una sección asignada al docente" });
      }
    } else if (!["estudiante", "psicologo"].includes(req.user.role)) {
      return res.status(403).json({ error: "No autorizado para consultar notas" });
    }

    const notas = await academicoModel.listarNotasEstudiante({
      estudianteId,
      periodoId: req.query.periodoId ? Number(req.query.periodoId) : undefined
    });
    res.json(notas);
  } catch (error) {
    respuestaError(res, error);
  }
}

module.exports = {
  listarEstudiantes,
  guardarAsistencias,
  listarAsistencias,
  listarFechasAsistencias,
  obtenerFormularioActivoEstudiante,
  guardarRespuestasFormularioEstudiante,
  listarHistorialFormulariosEstudiante,
  listarNotasEstudiante,
};
