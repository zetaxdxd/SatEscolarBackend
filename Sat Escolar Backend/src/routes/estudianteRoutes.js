const express = require("express");
const { verificarToken } = require("../middleware/auth");
const c = require("../controllers/estudianteController");
const router = express.Router();

// Todos los endpoints requieren token
router.use(verificarToken);

// Estudiantes
router.delete("/:id",       c.borrarEstudiante);

// Registros docente
router.post("/registro",           c.guardarRegistro);
router.get("/:id/registros",       c.obtenerRegistros);

// Formularios
router.post("/formulario/activar",   c.activar);
router.post("/formulario/desactivar",c.desactivar);
router.get("/formulario/activo",     c.formularioActivo);
router.post("/formulario/respuesta", c.enviarRespuestaFormulario);
router.get("/formulario/respuestas", (req, res, next) => {
  if (req.user.role !== "psicologo") {
    return res.status(403).json({ error: "Solo psicología puede ver respuestas de estudiantes" });
  }
  next();
}, c.obtenerRespuestasGrupo);

// Incidentes
router.post("/incidente",       c.reportarIncidente);
router.get("/incidentes",       c.obtenerIncidentes);
router.get("/incidentes/contador", c.contarIncidentesPendientes);
router.post("/incidentes/leer", c.marcarLeidos);

// Riesgo
router.get("/:id/evaluacion",   c.obtenerEvaluacion);
router.post("/:id/recalcular",  c.forzarRecalculo);

// Seguimiento
router.post("/seguimiento",      c.actualizarSeguimiento);
router.get("/seguimiento/casos", c.listarCasosSeguimiento);
router.post("/:id/seguimiento/cerrar", c.cerrarCasoSeguimiento);
router.put("/:id/seguimiento/estado",  c.editarEstadoSeguimiento);
router.get("/:id/seguimiento",   c.obtenerHistorial);

module.exports = router;
