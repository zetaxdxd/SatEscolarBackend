const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "sat_escolar_secret_2025";

function verificarToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "Token requerido" });
  try {
    req.user = jwt.verify(auth.split(" ")[1], SECRET);
    next();
  } catch { res.status(401).json({ error: "Token inválido o expirado" }); }
}

module.exports = { verificarToken };