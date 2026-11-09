const express = require("express");
const { verificarToken } = require("../../middleware/auth");

const router = express.Router();

router.use(verificarToken);

router.use("/secciones", require("./secciones.routes"));
router.use("/asignaturas", require("./asignaturas.routes"));
router.use("/estudiantes", require("./estudiantes.routes"));
router.use("/asistencias", require("./asistencias.routes"));
router.use("/docentes", require("./docentes.routes"));
router.use("/", require("./academicos.routes"));
router.use("/", require("./psicologia.routes"));
router.use("/", require("./expediente.routes"));
router.use("/", require("./mensajes.routes"));

module.exports = router;