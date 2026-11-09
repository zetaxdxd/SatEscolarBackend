const express = require("express");
const multer = require("multer");
const {
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
  listarAlertasPsicologia,
  atenderAlertaPsicologia,
  recalcularRiesgoEstudiante,
  obtenerRiesgoEstudiante,
  obtenerDetalleCompletoEstudiante,
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
  listarDocumentosPorFecha
} = require("../../controllers/postgres/psicologia.controller");
const { query } = require("../../config/postgres");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos Excel (.xlsx, .xls)"));
    }
  }
});

const router = express.Router();

router.post("/formularios-psicologicos", crearFormularioPsicologico);
router.get("/formularios-psicologicos", listarFormulariosPsicologicos);
router.get("/formularios-psicologicos/:id", obtenerFormularioPsicologico);
router.get("/formularios-psicologicos/:id/habilitaciones", listarHabilitacionesFormularioPsicologico);
router.put("/formularios-psicologicos/:id", actualizarFormularioPsicologico);
router.delete("/formularios-psicologicos/:id", eliminarFormularioPsicologico);

router.get("/psicologia/formularios/respuestas", listarRespuestasPsicologia);
router.get("/psicologia/formularios/:formularioId/analitica", obtenerAnaliticaFormularioPsicologia);
router.get("/psicologia/formularios/:formularioId/estudiantes/:estudianteId/respuestas", obtenerDetalleRespuestaPsicologia);
router.put("/psicologia/preguntas/:id/puntajes", configurarPuntajesPregunta);

router.get("/psicologia/tests-validados", listarTestsValidados);
router.post("/psicologia/tests-validados/habilitar", habilitarTestValidado);
router.post("/psicologia/tests-validados/importar-excel", upload.single("excel"), (err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: `Error de archivo: ${err.message}` });
  if (err) return res.status(400).json({ error: err.message });
  next();
}, importarExcelTests);
router.post("/psicologia/tests-validados/generar-ia", generarTestConIA);
router.post("/psicologia/tests-validados/guardar", guardarTestPersonalizado);
router.get("/psicologia/tests-validados/:formularioId/estudiantes/:estudianteId/resultado", obtenerResultadoTestValidado);
router.put("/psicologia/tests-validados/:codigo", editarTestPersonalizado);
router.delete("/psicologia/tests-validados/:codigo", eliminarTestPersonalizado);
router.get("/psicologia/tests-validados/:codigo", detalleTestValidado);

router.get("/psicologia/riesgo", listarIndicadoresRiesgo);
router.get("/psicologia/riesgo/estudiantes/:id", obtenerRiesgoEstudiante);
router.post("/psicologia/riesgo/estudiantes/:id/recalcular", recalcularRiesgoEstudiante);
router.get("/psicologia/estudiantes/:id/detalle-completo", obtenerDetalleCompletoEstudiante);

router.post("/psicologia/predicciones/estudiantes/:estudianteId", generarPrediccion);
router.get("/psicologia/predicciones/hoy", obtenerPrediccionesHoy);
router.get("/psicologia/predicciones/estudiantes/:estudianteId", obtenerPrediccionesEstudiante);
router.get("/psicologia/predicciones/secciones/:seccionId", obtenerPrediccionesPorSeccion);
router.delete("/psicologia/predicciones/:id", eliminarPrediccionPsicologia);
router.post("/psicologia/predicciones/limpiar", limpiarPredicciones);

router.get("/psicologia/documentos", listarDocumentosPorFecha);
router.get("/psicologia/alertas", listarAlertasPsicologia);
router.post("/psicologia/alertas/:id/atender", atenderAlertaPsicologia);

router.get("/psicologia/secciones-asignadas", async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT ON (s.id) s.id, s.nivel, s.grado, s.letra, s.nombre, s.dia_tutoria,
        d.nombres AS tutor_nombres, d.apellidos AS tutor_apellidos
      FROM secciones s
      INNER JOIN docente_secciones ds ON ds.seccion_id = s.id
      INNER JOIN docentes d ON d.id = ds.docente_id AND d.activo = TRUE
      ORDER BY s.id, d.nombres
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Sesiones de tutoría de HOY (según día asignado por el director, hora Lima UTC-5)
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
function hoyLima() {
  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000); // UTC-5 Peru sin DST
  return { diaSemana: ahora.getUTCDay(), fecha: ahora.toISOString().slice(0, 10) };
}

router.get("/psicologia/sesiones-hoy", async (req, res) => {
  try {
    const { diaSemana } = hoyLima();
    const result = await query(`
      SELECT DISTINCT ON (s.id) s.id, s.nivel, s.grado, s.letra, s.nombre, s.dia_tutoria,
        d.nombres AS tutor_nombres, d.apellidos AS tutor_apellidos,
        (SELECT COUNT(*) FROM estudiantes e WHERE e.seccion_id = s.id AND e.activo = TRUE)::int AS total_estudiantes
      FROM secciones s
      INNER JOIN docente_secciones ds ON ds.seccion_id = s.id
      INNER JOIN docentes d ON d.id = ds.docente_id AND d.activo = TRUE
      WHERE s.dia_tutoria = $1
      ORDER BY s.id, d.nombres
    `, [diaSemana]);
    res.json({
      dia: DIAS_SEMANA[diaSemana],
      fecha: hoyLima().fecha,
      sesiones: result.rows.map(r => ({ ...r, dia_nombre: DIAS_SEMANA[r.dia_tutoria] }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/psicologia/dashboard", async (req, res) => {
  try {
    const secciones = await query(`
      SELECT DISTINCT ON (s.id) s.id, s.nivel, s.grado, s.letra, s.nombre, s.dia_tutoria,
        d.nombres AS tutor_nombres, d.apellidos AS tutor_apellidos
      FROM secciones s
      INNER JOIN docente_secciones ds ON ds.seccion_id = s.id
      INNER JOIN docentes d ON d.id = ds.docente_id AND d.activo = TRUE
      ORDER BY s.id, d.nombres
   `);
    const seccionIds = secciones.rows.map(s => s.id);

    let estudiantes = { rows: [] };
    let formularios = { rows: [] };
    let alertasData = { alertas: [], pendientes: 0 };

    if (seccionIds.length > 0) {
      estudiantes = await query(
        `SELECT COUNT(*) AS total FROM estudiantes WHERE seccion_id = ANY($1) AND activo = TRUE`,
        [seccionIds]
      );
      formularios = await query(
        `SELECT COUNT(*) AS total FROM formularios_psicologicos WHERE (grado, seccion) IN (SELECT grado, letra FROM secciones WHERE id = ANY($1))`,
        [seccionIds]
      );
    }

    try {
      const alertaModel = require("../../models/postgres/alertaModel");
      alertasData = { alertas: [], pendientes: await alertaModel.contarPendientes() };
    } catch (_) {}

    res.json({
      secciones: secciones.rows,
      totalEstudiantes: Number(estudiantes.rows[0]?.total || 0),
      totalFormularios: Number(formularios.rows[0]?.total || 0),
      totalSecciones: new Set(secciones.rows.map(s => s.id)).size,
      totalAlertas: alertasData.pendientes
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cuestionarios habilitados para un estudiante (por su grado/seccion),
// con estado respondido/pendiente y fecha de respuesta
router.get("/psicologia/estudiantes/:id/cuestionarios", async (req, res) => {
  try {
    const estudianteId = Number(req.params.id);
    if (!estudianteId) return res.status(400).json({ error: "id de estudiante requerido" });
    const result = await query(
      `
      SELECT f.id, f.titulo, f.descripcion, f.activo, f.created_at, f.es_validado, f.codigo_minsa,
             EXISTS (
               SELECT 1 FROM formulario_respuestas fr
               WHERE fr.formulario_id = f.id AND fr.estudiante_id = $1
             ) AS respondido,
             (SELECT MAX(fr.created_at) FROM formulario_respuestas fr
              WHERE fr.formulario_id = f.id AND fr.estudiante_id = $1) AS fecha_respuesta
      FROM formularios_psicologicos f
      JOIN estudiantes e ON e.id = $2 AND e.activo = TRUE
      JOIN secciones s ON s.id = e.seccion_id
      WHERE (f.grado IS NULL OR f.grado = s.grado) AND (f.seccion IS NULL OR f.seccion = s.letra) AND f.nivel = s.nivel
      ORDER BY f.created_at DESC
      `,
      [estudianteId, estudianteId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;