const express = require("express");
const { guardarAsistencias, listarAsistencias, listarFechasAsistencias } = require("../../controllers/postgres/estudiantes.controller");

const router = express.Router();

router.post("/", guardarAsistencias);
router.get("/fechas", listarFechasAsistencias);
router.get("/", listarAsistencias);

module.exports = router;