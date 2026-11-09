// models/postgres/formularioSocioModel.js
const { query } = require("../../config/postgres");

async function activarFormulario({ docenteId, grado, seccion }) {
  await query(
    `UPDATE formularios_activos SET activo = FALSE WHERE grado = $1 AND seccion = $2`,
    [grado, seccion]
  );
  const result = await query(
    `INSERT INTO formularios_activos (docente_id, grado, seccion, activo)
     VALUES ($1, $2, $3, TRUE) RETURNING *`,
    [docenteId, grado, seccion]
  );
  return result.rows[0];
}

async function desactivarFormulario(docenteId, grado, seccion) {
  const result = await query(
    `UPDATE formularios_activos SET activo = FALSE
     WHERE docente_id = $1 AND grado = $2 AND seccion = $3 AND activo = TRUE`,
    [docenteId, grado, seccion]
  );
  return result.rowCount;
}

async function getFormularioActivo(grado, seccion) {
  if (!grado || !seccion) {
    const result = await query(
      `SELECT * FROM formularios_activos WHERE activo = TRUE ORDER BY fecha_activacion DESC LIMIT 1`
    );
    return result.rows[0] || null;
  }
  const result = await query(
    `SELECT * FROM formularios_activos WHERE grado = $1 AND seccion = $2 AND activo = TRUE
     ORDER BY fecha_activacion DESC LIMIT 1`,
    [grado, seccion]
  );
  return result.rows[0] || null;
}

async function guardarRespuestaFormulario({ formularioId, estudianteId, pregunta1, pregunta2, pregunta3, pregunta4, pregunta5, riesgoSocio, puntajeSocio }) {
  await query(
    `DELETE FROM respuestas_formulario WHERE formulario_id = $1 AND estudiante_id = $2`,
    [formularioId, estudianteId]
  );
  const result = await query(
    `INSERT INTO respuestas_formulario
       (formulario_id, estudiante_id, pregunta1, pregunta2, pregunta3, pregunta4, pregunta5, riesgo_socio, puntaje_socio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [formularioId, estudianteId, pregunta1 || null, pregunta2 || null, pregunta3 || null, pregunta4 || null, pregunta5 || null, riesgoSocio || null, puntajeSocio ?? null]
  );
  return result.rows[0];
}

async function getRespuestasFormulario(grado, seccion) {
  const result = await query(
    `SELECT rf.*, e.nombres, e.apellidos, e.correo,
            (e.nombres || ' ' || e.apellidos) AS nombre
       FROM respuestas_formulario rf
       JOIN estudiantes e ON rf.estudiante_id = e.id
       JOIN formularios_activos fa ON rf.formulario_id = fa.id
      WHERE fa.grado = $1 AND fa.seccion = $2
      ORDER BY rf.fecha DESC`,
    [grado, seccion]
  );
  return result.rows;
}

async function getRespuestasEstudiante(estudianteId) {
  const result = await query(
    `SELECT * FROM respuestas_formulario WHERE estudiante_id = $1 ORDER BY fecha DESC`,
    [estudianteId]
  );
  return result.rows;
}

module.exports = {
  activarFormulario,
  desactivarFormulario,
  getFormularioActivo,
  guardarRespuestaFormulario,
  getRespuestasFormulario,
  getRespuestasEstudiante
};