// utils/auditoria.js — Bitácora de accesos a datos sensibles (ISO 27001 A.8.15)
// Nunca interrumpe el flujo principal: si el registro falla, solo se loguea.
const { query } = require("../config/postgres");

async function registrarAcceso({ usuarioId = null, rol = null, accion = "", estudianteId = null, detalle = null } = {}) {
  try {
    await query(
      `INSERT INTO auditoria_accesos (usuario_id, rol, accion, estudiante_id, detalle)
       VALUES ($1,$2,$3,$4,$5)`,
      [usuarioId, rol, accion, estudianteId, detalle]
    );
  } catch (e) {
    console.warn("[auditoría] no se pudo registrar:", e.message);
  }
}

module.exports = { registrarAcceso };
