const express = require("express");
const {
  listarPeriodosAcademicos,
  listarTrimestresAcademicos,
  listarNivelesLogro
} = require("../../controllers/postgres/secciones.controller");
const {
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
  guardarCalificacionesTrimestrales
} = require("../../controllers/postgres/evaluacion.controller");

const router = express.Router();

router.get("/periodos-academicos", listarPeriodosAcademicos);
router.get("/trimestres-academicos", listarTrimestresAcademicos);
router.get("/niveles-logro", listarNivelesLogro);

router.post("/evaluaciones-academicas", crearEvaluacionAcademica);
router.get("/evaluaciones-academicas", listarEvaluacionesAcademicas);
router.get("/evaluaciones-academicas/:id/notas", listarNotasEvaluacion);
router.post("/evaluaciones-academicas/:id/notas", guardarNotasEvaluacion);

router.post("/productos-evaluacion", crearProductoCompetencia);
router.get("/productos-evaluacion", listarProductosCompetencia);
router.get("/productos-evaluacion/:id/calificaciones", listarCalificacionesCompetencia);
router.post("/productos-evaluacion/:id/calificaciones", guardarCalificacionesCompetencia);

router.get("/calificaciones-trimestrales/resumen", listarResumenCompetenciasTrimestrales);
router.get("/calificaciones-trimestrales", listarCalificacionesTrimestrales);
router.post("/calificaciones-trimestrales", guardarCalificacionesTrimestrales);

module.exports = router;