// models/postgres/evaluacionRiesgoModel.js
const { query } = require("../../config/postgres");

async function guardarEvaluacionRiesgo({ estudianteId, nivelRiesgo, puntajeTotal, puntajeAcademico, puntajeAsistencia, puntajeConducta, puntajeSocio }) {
  await query(
    `INSERT INTO evaluaciones_riesgo
       (estudiante_id, nivel_riesgo, puntaje_total, puntaje_academico, puntaje_asistencia, puntaje_conducta, puntaje_socio, ultima_actualizacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
     ON CONFLICT (estudiante_id) DO UPDATE SET
       nivel_riesgo       = EXCLUDED.nivel_riesgo,
       puntaje_total      = EXCLUDED.puntaje_total,
       puntaje_academico  = EXCLUDED.puntaje_academico,
       puntaje_asistencia = EXCLUDED.puntaje_asistencia,
       puntaje_conducta   = EXCLUDED.puntaje_conducta,
       puntaje_socio      = EXCLUDED.puntaje_socio,
       ultima_actualizacion = CURRENT_TIMESTAMP`,
    [estudianteId, nivelRiesgo, puntajeTotal, puntajeAcademico, puntajeAsistencia, puntajeConducta, puntajeSocio]
  );
}

async function getEvaluacionRiesgo(estudianteId) {
  const result = await query(
    `SELECT * FROM evaluaciones_riesgo WHERE estudiante_id = $1`,
    [estudianteId]
  );
  return result.rows[0] || null;
}

async function contarIncidentesEstudiante(estudianteId) {
  const result = await query(
    `SELECT COUNT(*)::int AS total FROM reportes_anonimos WHERE estudiante_id = $1`,
    [estudianteId]
  );
  return result.rows[0]?.total || 0;
}

module.exports = { guardarEvaluacionRiesgo, getEvaluacionRiesgo, contarIncidentesEstudiante };