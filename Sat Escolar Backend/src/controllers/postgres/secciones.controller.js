// Controlador: secciones — SAT Escolar
// Cada dominio expone solo sus casos de uso.

const academicoModel = require("../../models/postgres/academicoModel");
const seccionModel = require("../../models/postgres/seccionModel");
const { query } = require("../../config/postgres");
const { respuestaError } = require("../../utils/respuestaError");

async function listarSecciones(req, res) {
  try {
    const { nivel, grado } = req.query;
    const secciones = await seccionModel.listarSecciones({
      nivel: nivel || undefined,
      grado: grado || undefined
    });
    res.json(secciones);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function getSeccionesActivas(req, res) {
  try {
    const result = await query(`
      SELECT id AS seccion_id, grado, letra
      FROM secciones
      WHERE nivel = 'Secundaria'
    `);
    res.json(result.rows);
  } catch (error) {
    respuestaError(res, error);
  }
}



async function listarPeriodosAcademicos(req, res) {
  try {
    const periodos = await academicoModel.listarPeriodos({ soloActivos: req.query.todos !== "1" });
    res.json(periodos);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarAsignaturas(req, res) {
  try {
    const asignaturas = await academicoModel.listarAsignaturas({
      soloActivas: req.query.todas !== "1",
      seccionId: req.query.seccionId ? Number(req.query.seccionId) : undefined,
      userId: req.user.id,
      userEmail: req.user.email,
      role: req.user.role
    });
    res.json(asignaturas);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarTrimestresAcademicos(req, res) {
  try {
    const trimestres = await academicoModel.listarTrimestres({
      anio: req.query.anio ? Number(req.query.anio) : undefined
    });
    res.json(trimestres);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarNivelesLogro(req, res) {
  try {
    res.json(await academicoModel.listarNivelesLogro());
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarCompetenciasAsignatura(req, res) {
  try {
    const competencias = await academicoModel.listarCompetencias({
      asignaturaId: Number(req.params.id)
    });
    res.json(competencias);
  } catch (error) {
    respuestaError(res, error);
  }
}

module.exports = {
  listarSecciones,
  getSeccionesActivas,
  listarPeriodosAcademicos,
  listarAsignaturas,
  listarTrimestresAcademicos,
  listarNivelesLogro,
  listarCompetenciasAsignatura,
};
