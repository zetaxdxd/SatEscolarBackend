const express = require("express");
const {
  obtenerMiPerfil,
  guardarMiPerfil,
  obtenerPerfilEstudiante,
  crearIncidencia,
  listarIncidenciasEstudiante,
  historialEstudiante,
  listarDerivaciones,
  atenderDerivacion,
  crearDerivacionDirecta,
  crearExpedienteFormato,
  listarExpedienteFormatos,
  obtenerExpedienteFormato,
  actualizarExpedienteFormato,
  archivarExpedienteFormato,
  actualizarNEE,
  actualizarEstadoCaso,
  crearCharla,
  listarCharlas,
  generarReporteBimestral,
  crearEvaluacionAnual,
  listarEvaluacionesAnuales,
  responderEvaluacionAnual,
  estadisticasEvaluacionAnual,
  obtenerFichaDiagnostica,
  guardarFichaDiagnostica
} = require("../../controllers/postgres/expediente.controller");

const router = express.Router();

// Perfil — estudiante obligatorio
router.get("/estudiantes/me/perfil", obtenerMiPerfil);
router.post("/estudiantes/me/perfil", guardarMiPerfil);
router.get("/estudiantes/:id/perfil", obtenerPerfilEstudiante);
router.get("/estudiantes/:id/historial", historialEstudiante);

// Incidencias — cualquier rol puede crear
router.post("/incidencias", crearIncidencia);
router.get("/incidencias/estudiante/:id", listarIncidenciasEstudiante);

// Derivaciones — con expediente + informe
router.get("/derivaciones", listarDerivaciones);
router.post("/derivaciones", crearDerivacionDirecta);
router.post("/derivaciones/:id/atender", atenderDerivacion);

// Expediente formatos — correlativo automático por estudiante y tipo
router.post("/expediente/:estudianteId/formatos", crearExpedienteFormato);
router.get("/expediente/:estudianteId/formatos", listarExpedienteFormatos);
router.get("/expediente/formatos/:id", obtenerExpedienteFormato);
router.put("/expediente/formatos/:id", actualizarExpedienteFormato);
router.delete("/expediente/formatos/:id", archivarExpedienteFormato);

// Charlas por aula
router.post("/charlas", crearCharla);
router.get("/charlas", listarCharlas);

// NEE y estado caso
router.patch("/estudiantes/:id/nee", actualizarNEE);
router.patch("/casos/:id/estado", actualizarEstadoCaso);

// Reporte bimestral / mensual
router.get("/reporte/bimestral", generarReporteBimestral);

// Ficha Diagnóstica SocioEducativa (aparece tal cual al estudiante)
router.get("/ficha-diagnostica", obtenerFichaDiagnostica);
router.post("/ficha-diagnostica", guardarFichaDiagnostica);
router.get("/ficha-diagnostica/:id", obtenerFichaDiagnostica);
router.post("/ficha-diagnostica/:id", guardarFichaDiagnostica);
router.post("/ficha-diagnostica/:id/docx", async (req, res) => {
  const { generarFichaDocx } = require("../../controllers/postgres/fichaController");
  return generarFichaDocx(req, res);
});

// Evaluaciones anuales masivas (1,220)
router.post("/evaluaciones-anuales", crearEvaluacionAnual);
router.get("/evaluaciones-anuales", listarEvaluacionesAnuales);
router.post("/evaluaciones-anuales/:id/respuestas", responderEvaluacionAnual);
router.get("/evaluaciones-anuales/:id/estadisticas", estadisticasEvaluacionAnual);



module.exports = router;
