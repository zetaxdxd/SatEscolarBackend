const express = require("express");
const {
  listarEstudiantes,
  obtenerFormularioActivoEstudiante,
  listarHistorialFormulariosEstudiante,
  guardarRespuestasFormularioEstudiante,
  listarNotasEstudiante
} = require("../../controllers/postgres/estudiantes.controller");

const router = express.Router();

router.get("/", listarEstudiantes);
router.get("/me/formulario-activo", obtenerFormularioActivoEstudiante);
router.get("/me/formularios/historial", listarHistorialFormulariosEstudiante);
router.post("/me/formularios/:id/respuestas", guardarRespuestasFormularioEstudiante);
router.get("/:id/notas", listarNotasEstudiante);

module.exports = router;