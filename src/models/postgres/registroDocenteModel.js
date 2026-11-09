// models/postgres/registroDocenteModel.js
const { query } = require("../../config/postgres");

async function guardarRegistroDocente({ estudianteId, docenteId, evaluacion, asistencia, nota, conducta, observacion }) {
  const result = await query(
    `INSERT INTO registros_docente (estudiante_id, docente_id, evaluacion, asistencia, nota, conducta, observacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [estudianteId, docenteId, evaluacion || "Semanal", asistencia || null, nota ?? null, conducta || null, observacion || null]
  );
  return result.rows[0];
}

async function getRegistrosDeEstudiante(estudianteId) {
  const result = await query(
    `SELECT * FROM registros_docente WHERE estudiante_id = $1 ORDER BY fecha DESC`,
    [estudianteId]
  );
  return result.rows;
}

async function getAsistenciaEstudiante(estudianteId) {
  const result = await query(
    `SELECT asistencia FROM registros_docente WHERE estudiante_id = $1 ORDER BY fecha ASC`,
    [estudianteId]
  );
  return result.rows;
}

module.exports = { guardarRegistroDocente, getRegistrosDeEstudiante, getAsistenciaEstudiante };