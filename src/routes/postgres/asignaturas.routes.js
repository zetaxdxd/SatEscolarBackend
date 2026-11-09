const express = require("express");
const { listarAsignaturas, listarCompetenciasAsignatura } = require("../../controllers/postgres/secciones.controller");

const router = express.Router();

router.get("/", listarAsignaturas);
router.get("/:id/competencias", listarCompetenciasAsignatura);

module.exports = router;