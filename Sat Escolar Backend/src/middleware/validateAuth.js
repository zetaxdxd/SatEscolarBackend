const { normalizeRole, isValidRole } = require("../utils/roles");

function validateRegister(req, res, next) {
  const fullName = String(req.body.fullName || req.body.nombreCompleto || "").trim();
  const email = String(req.body.email || req.body.correo || "").trim().toLowerCase();
  const username = String(req.body.username || req.body.usuario || "").trim().toLowerCase();
  const password = String(req.body.password || req.body.contrasena || "");
  const role = normalizeRole(req.body.role || req.body.rol);

  if (!fullName || !email || !username || !password || !role) {
    return res.status(400).json({ mensaje: "Completa todos los campos" });
  }

  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ mensaje: "Correo electrónico inválido" });
  }

  if (username.length < 3) {
    return res.status(400).json({ mensaje: "El usuario debe tener al menos 3 caracteres" });
  }

  if (password.length < 6) {
    return res.status(400).json({ mensaje: "La contraseña debe tener al menos 6 caracteres" });
  }

  if (!isValidRole(role)) {
    return res.status(400).json({
      mensaje: "Rol inválido. Usa estudiante, docente o psicologo"
    });
  }

  req.validatedBody = {
    fullName,
    email,
    username,
    password,
    role
  };

  next();
}

function validateLogin(req, res, next) {
  const identifier = String(
    req.body.identifier || req.body.usuarioOCorreo || req.body.usuario || req.body.email || ""
  ).trim().toLowerCase();
  const password = String(req.body.password || req.body.contrasena || "");

  if (!identifier || !password) {
    return res.status(400).json({ mensaje: "Ingresa usuario/correo y contraseña" });
  }

  req.validatedBody = {
    identifier,
    password
  };

  next();
}

function requireDirector(req, res, next) {
  if (!req.user || req.user.role !== "director") {
    return res.status(403).json({ error: "Acceso restringido a la dirección" });
  }
  next();
}

module.exports = {
  validateLogin,
  validateRegister,
  requireDirector
};
