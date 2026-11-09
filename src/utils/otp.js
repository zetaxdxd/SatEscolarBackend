// utils/otp.js - Reutilizado de OmniCash para SAT Escolar
// OTP 6 dígitos con hash SHA256 + salt, timingSafeEqual
const crypto = require("crypto");

const MAX_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutos

function generarCodigoOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashearCodigo(codigo) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(`${salt}:${codigo}`).digest("hex");
  return { hash, salt };
}

function verificarCodigo(codigo, hash) {
  const [salt, hashHex] = String(hash ?? "").split(":");
  if (!salt || !hashHex) return false;
  const calculado = crypto.createHash("sha256").update(`${salt}:${codigo}`).digest("hex");
  const a = Buffer.from(calculado, "utf8");
  const b = Buffer.from(hashHex, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function codigoVigente(fila) {
  if (!fila) return false;
  if (fila.used_at || fila.usedAt) return false;
  const attempts = Number(fila.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) return false;
  const expira = new Date(fila.expires_at ?? fila.expiresAt).getTime();
  return Date.now() < expira;
}

module.exports = { generarCodigoOtp, hashearCodigo, verificarCodigo, codigoVigente, OTP_MAX_ATTEMPTS: MAX_ATTEMPTS, OTP_TTL_MS };
