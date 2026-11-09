// services/otpService.js
// Códigos OTP de un solo uso con hash+salt y vencimiento (patrón OmniCash).

const crypto = require("crypto");
const { query } = require("../config/postgres");
const { enviarCorreo } = require("./emailService");

const OTP_TTL_MS = 10 * 60 * 1000;
const PROPOSITO_BORRAR_MENSAJE = "borrar_mensaje";

function generarCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashearCodigo(codigo, salt) {
  return crypto.createHash("sha256").update(`${codigo}:${salt}`).digest("hex");
}

function enmascarar(destino) {
  const [usuario, dominio] = String(destino || "").split("@");
  if (!dominio) return "correo enmascarado";
  const visible = usuario.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}

async function crearYEnviarCodigo({ destino, proposito }) {
  const codigo = generarCodigo();
  const salt = crypto.randomBytes(16).toString("hex");
  const codigoHash = hashearCodigo(codigo, salt);
  const expiraEn = new Date(Date.now() + OTP_TTL_MS);

  await query(
    `UPDATE codigos_verificacion SET usado = TRUE
     WHERE LOWER(destino) = LOWER($1) AND proposito = $2 AND usado = FALSE`,
    [destino, proposito]
  );

  await query(
    `INSERT INTO codigos_verificacion (destino, proposito, codigo_hash, salt, expira_en)
     VALUES ($1, $2, $3, $4, $5)`,
    [String(destino).toLowerCase(), proposito, codigoHash, salt, expiraEn]
  );

  const envio = await enviarCorreo({
    para: destino,
    asunto: "Código de verificación - SAT Escolar",
    texto: `Tu código de verificación es: ${codigo}. Vence en 10 minutos. No lo compartas con nadie.`
  });

  return {
    codigoDev: envio.modo === "dev" ? codigo : null,
    enmascarado: enmascarar(destino),
    modo: envio.modo
  };
}

async function verificarCodigo({ destino, proposito, codigo }) {
  const result = await query(
    `SELECT id, codigo_hash, salt, expira_en
     FROM codigos_verificacion
     WHERE LOWER(destino) = LOWER($1)
       AND proposito = $2
       AND usado = FALSE
       AND expira_en > CURRENT_TIMESTAMP
     ORDER BY id DESC
     LIMIT 1`,
    [destino, proposito]
  );

  const fila = result.rows[0];
  if (!fila) return { valido: false, motivo: "Código inexistente o vencido" };

  const hash = hashearCodigo(String(codigo), fila.salt);
  if (hash !== fila.codigo_hash) return { valido: false, motivo: "Código incorrecto" };

  await query("UPDATE codigos_verificacion SET usado = TRUE WHERE id = $1", [fila.id]);
  return { valido: true };
}

module.exports = {
  generarCodigo,
  hashearCodigo,
  enmascarar,
  crearYEnviarCodigo,
  verificarCodigo,
  OTP_TTL_MS,
  PROPOSITO_BORRAR_MENSAJE
};