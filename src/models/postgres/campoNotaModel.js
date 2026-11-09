// models/postgres/campoNotaModel.js
// CRUD de campos de evaluación por curso, con cascada a notas_simples.

const { query } = require("../../config/postgres");

async function listarCampos(asignaturaId) {
  const result = await query(
    `SELECT id, asignatura_id, nombre, orden FROM campos_nota
     WHERE asignatura_id = $1 ORDER BY orden ASC, id ASC`,
    [asignaturaId]
  );
  return result.rows;
}

async function crearCampo({ asignaturaId, nombre }) {
  const limpio = String(nombre || "").trim().slice(0, 80);
  if (!limpio) throw new Error("El nombre del campo es requerido");
  const max = await query(`SELECT COALESCE(MAX(orden), -1)::int AS m FROM campos_nota WHERE asignatura_id = $1`, [asignaturaId]);
  const result = await query(
    `INSERT INTO campos_nota (asignatura_id, nombre, orden)
     VALUES ($1, $2, $3)
     ON CONFLICT (asignatura_id, nombre) DO NOTHING
     RETURNING id, asignatura_id, nombre, orden`,
    [asignaturaId, limpio, Number(max.rows[0]?.m ?? -1) + 1]
  );
  if (result.rows[0]) return { campo: result.rows[0], creado: true };
  const existente = await query(
    `SELECT id, asignatura_id, nombre, orden FROM campos_nota WHERE asignatura_id = $1 AND nombre = $2`,
    [asignaturaId, limpio]
  );
  return { campo: existente.rows[0], creado: false };
}

async function obtenerCampo(id) {
  const result = await query(`SELECT id, asignatura_id, nombre FROM campos_nota WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function renombrarCampo({ id, nombre }) {
  const limpio = String(nombre || "").trim().slice(0, 80);
  if (!limpio) throw new Error("El nombre del campo es requerido");
  const actual = await obtenerCampo(id);
  if (!actual) throw new Error("Campo no encontrado");
  if (actual.nombre === limpio) return { campo: actual, notasActualizadas: 0 };
  const dup = await query(
    `SELECT id FROM campos_nota WHERE asignatura_id = $1 AND nombre = $2 AND id <> $3`,
    [actual.asignatura_id, limpio, id]
  );
  if (dup.rows[0]) throw new Error(`Ya existe un campo llamado "${limpio}" en este curso`);
  await query(`UPDATE campos_nota SET nombre = $1 WHERE id = $2`, [limpio, id]);
  // Las notas guardadas usan el nombre del campo: se renombran en todos los bimestres
  const notas = await query(
    `UPDATE notas_simples SET campo = $1, updated_at = CURRENT_TIMESTAMP
     WHERE asignatura_id = $2 AND campo = $3 RETURNING estudiante_id`,
    [limpio, actual.asignatura_id, actual.nombre]
  );
  return { campo: { ...actual, nombre: limpio }, notasActualizadas: notas.rowCount || 0 };
}

async function eliminarCampo(id) {
  const actual = await obtenerCampo(id);
  if (!actual) throw new Error("Campo no encontrado");
  // Borrado en cascada: todas las notas guardadas de este campo, en todos los bimestres
  const notas = await query(
    `DELETE FROM notas_simples WHERE asignatura_id = $1 AND campo = $2 RETURNING estudiante_id`,
    [actual.asignatura_id, actual.nombre]
  );
  await query(`DELETE FROM campos_nota WHERE id = $1`, [id]);
  const afectados = [...new Set(notas.rows.map(r => Number(r.estudiante_id)).filter(Boolean))];
  return { campo: actual, notasBorradas: notas.rowCount || 0, afectados };
}

module.exports = { listarCampos, crearCampo, obtenerCampo, renombrarCampo, eliminarCampo };
