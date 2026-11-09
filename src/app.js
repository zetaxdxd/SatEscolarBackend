const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const path    = require("path");
require("dotenv").config();

const authRoutes       = require("./routes/authRoutes");
const estudianteRoutes = require("./routes/estudianteRoutes");
const postgresRoutes   = require("./routes/postgres");
const adminRoutes      = require("./routes/adminRoutes");
const verificationRoutes = require("./routes/verificationRoutes");

const app = express();

// Render/Cloudflare hacen de proxy: necesario para que rate-limit vea la IP real
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Cabeceras de seguridad. CSP desactivada: el frontend usa handlers inline (onclick).
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: por defecto solo misma origen (el backend sirve el frontend).
// Para permitir otros orígenes, define CORS_ORIGIN="https://dominio1,https://dominio2".
app.use(cors(process.env.CORS_ORIGIN
  ? { origin: process.env.CORS_ORIGIN.split(",").map(o => o.trim()) }
  : { origin: false }));

// Límite de intentos en endpoints públicos de autenticación (fuerza bruta/enumeración).
// Clave: IP real del cliente. Detrás de Cloudflare+Render la IP fiable viene en
// cf-connecting-ip; req.ip con trust proxy varía por edge y anularía el contador.
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers["cf-connecting-ip"] || ipKeyGenerator(req.ip),
  message: { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }
});
app.use("/api/auth", limiteAuth);

app.use(express.json({ limit: "10mb" })); // Permitir fotos en base64

app.use("/api/auth",        authRoutes);
app.use("/api/estudiantes", estudianteRoutes);
app.use("/api/postgres",    postgresRoutes);
app.use("/api/admin",       adminRoutes);
app.use("/api/verification", verificationRoutes);

// Health check
app.get("/api/ping", (req, res) => res.json({ ok: true, mensaje: "SAT Escolar API funcionando ✅" }));


// Frontend estático (despliegue de servicio único: misma origen que el API)
const frontendDir = path.join(__dirname, "..", "..", "Sat Escolar Frontend");
app.use(express.static(frontendDir, { maxAge: 0, etag: false, lastModified: false }));

module.exports = app;