const express = require("express");
const { login, verificarCorreo } = require("../controllers/authController");
const router = express.Router();

router.post("/login", login);
router.post("/verificar-correo", verificarCorreo);

module.exports = router;