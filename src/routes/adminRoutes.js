const express = require("express");
const { verificarToken } = require("../middleware/auth");
const { requireDirector } = require("../middleware/validateAuth");
const admin = require("../controllers/adminController");

const router = express.Router();

router.use(verificarToken, requireDirector);

router.post("/docentes", admin.crearDocente);
router.get("/docentes", admin.listarDocentes);
router.put("/docentes/:id/password", admin.resetearContrasenaDocente);
router.put("/docentes/:id/tutor", admin.cambiarTutorDocente);
router.delete("/docentes/:id", admin.eliminarDocente);

router.post("/asignaturas", admin.crearAsignatura);
router.put("/secciones/:id/dia-tutoria", admin.asignarDiaTutoria);

router.post("/psicologos", admin.crearPsicologo);
router.get("/psicologos", admin.listarPsicologos);

router.post("/reset-database", admin.resetDatabase);

router.get("/auditoria", admin.listarAuditoria);

module.exports = router;