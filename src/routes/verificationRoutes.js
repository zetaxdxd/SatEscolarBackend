const express = require("express");
const { verificarToken } = require("../middleware/auth");
const verificationController = require("../controllers/verificationController");

const router = express.Router();

// Todas requieren estar autenticado (director crea psicologo/docente, docente crea estudiante)
router.use(verificarToken);

router.post("/solicitar", verificationController.solicitarCodigo);
router.post("/verificar", verificationController.verificarCodigoYCrear);

module.exports = router;
