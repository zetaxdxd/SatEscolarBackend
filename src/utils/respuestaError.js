// utils/respuestaError.js
// Respuesta uniforme para errores internos. En producción no expone detalles
// del sistema (mensajes de PostgreSQL, rutas, stack); solo los registra en logs.

function respuestaError(res, error) {
  const produccion = process.env.NODE_ENV === "production";
  const detalle = error && error.stack ? error.stack.split("\n").slice(0, 2).join(" | ") : String(error);
  console.error("[ERROR 500]", detalle);
  res.status(500).json({ error: produccion ? "Error interno del servidor" : String((error && error.message) || error) });
}

module.exports = { respuestaError };