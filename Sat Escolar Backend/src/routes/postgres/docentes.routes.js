const express = require("express");
const {
  listarMisSeccionesDocente,
  listarMisFormulariosDocente,
  habilitarFormularioDocente,
  listarEstadoRespuestasDocente,
  registrarEstudianteTutor,
  registrarEstudiantesMasivo,
  actualizarEstudianteTutor,
  listarComportamientosDocente,
  guardarComportamientoDocente,
  listarNotasSimplesDocente,
  guardarNotasSimplesDocente,
  eliminarNotasSimplesDocente,
  eliminarComportamientoDocente,
  listarObservacionesDocente,
  guardarObservacionesDocente,
  eliminarObservacionesDocente,
  listarCamposDocente,
  crearCampoDocente,
  renombrarCampoDocente,
  eliminarCampoDocente
} = require("../../controllers/postgres/docentes.controller");

const router = express.Router();

router.get("/me/secciones", listarMisSeccionesDocente);
router.get("/me/formularios", listarMisFormulariosDocente);
router.post("/me/formularios/:id/habilitar", habilitarFormularioDocente);
router.get("/me/formularios/:id/estado-respuestas", listarEstadoRespuestasDocente);
router.post("/me/estudiantes", registrarEstudianteTutor);
router.post("/me/estudiantes/masivo", registrarEstudiantesMasivo);
router.patch("/me/estudiantes/:id", actualizarEstudianteTutor);
router.get("/me/comportamiento", listarComportamientosDocente);
router.put("/me/comportamiento", guardarComportamientoDocente);
router.delete("/me/comportamiento", eliminarComportamientoDocente);
router.get("/me/notas-simples", listarNotasSimplesDocente);
router.put("/me/notas-simples", guardarNotasSimplesDocente);
router.delete("/me/notas-simples", eliminarNotasSimplesDocente);
router.get("/me/observaciones", listarObservacionesDocente);
router.put("/me/observaciones", guardarObservacionesDocente);
router.delete("/me/observaciones", eliminarObservacionesDocente);
router.get("/me/campos", listarCamposDocente);
router.post("/me/campos", crearCampoDocente);
router.put("/me/campos/:id", renombrarCampoDocente);
router.delete("/me/campos/:id", eliminarCampoDocente);

module.exports = router;