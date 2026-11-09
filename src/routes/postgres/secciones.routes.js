const express = require("express");
const { listarSecciones, getSeccionesActivas } = require("../../controllers/postgres/secciones.controller");
const { verificarToken } = require("../../middleware/auth");
const { requireDirector } = require("../../middleware/validateAuth");
const seccionModel = require("../../models/postgres/seccionModel");
const { respuestaError } = require("../../utils/respuestaError");

const router = express.Router();

router.get("/activas", getSeccionesActivas);
router.get("/", listarSecciones);

router.post("/", verificarToken, requireDirector, async (req, res) => {
  try {
    const { nivel, grado, letra } = req.body;
    if (!nivel || !grado || !letra) {
      return res.status(400).json({ error: "nivel, grado y letra son requeridos" });
    }
    const seccion = await seccionModel.crearSeccion({
      nivel: String(nivel).trim(),
      grado: String(grado).trim(),
      letra: String(letra).trim().toUpperCase()
    });
    res.status(201).json(seccion);
  } catch (error) {
    respuestaError(res, error);
  }
});

module.exports = router;