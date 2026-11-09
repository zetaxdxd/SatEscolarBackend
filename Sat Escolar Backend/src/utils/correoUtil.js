// utils/correoUtil.js
// Verificación interna de correos para creación de cuentas.
const { query } = require("../config/postgres");

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarFormatoCorreo(correo) {
  return REGEX_CORREO.test(String(correo || "").trim());
}

// Busca el correo en todas las tablas de cuentas (usuarios del sistema, docentes, estudiantes y usuarios legacy SQLite).
async function correoEnUso(correo) {
  const email = String(correo || "").trim().toLowerCase();
  if (!validarFormatoCorreo(email)) return null;

  const [usuarios, docentes, estudiantes] = await Promise.all([
    query(
      `SELECT id, rol AS tipo, correo FROM usuarios WHERE LOWER(correo) = LOWER($1) AND activo = TRUE LIMIT 1`,
      [email]
    ),
    query(
      `SELECT id, 'docente' AS tipo, correo FROM docentes WHERE LOWER(correo) = LOWER($1) AND activo = TRUE LIMIT 1`,
      [email]
    ),
    query(
      `SELECT id, 'estudiante' AS tipo, correo FROM estudiantes WHERE LOWER(correo) = LOWER($1) AND activo = TRUE LIMIT 1`,
      [email]
    )
  ]);

  const fila = usuarios.rows[0] || docentes.rows[0] || estudiantes.rows[0];
  if (fila) return fila;
  return null;
}

module.exports = { validarFormatoCorreo, correoEnUso };