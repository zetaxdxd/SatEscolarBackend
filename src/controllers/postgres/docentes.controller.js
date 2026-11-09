// Controlador: docentes — SAT Escolar
// Cada dominio expone solo sus casos de uso.

const bcrypt = require("bcryptjs");
const comportamientoModel = require("../../models/postgres/comportamientoModel");
const correoUtil = require("../../utils/correoUtil");
const docenteModel = require("../../models/postgres/docenteModel");
const estudianteModel = require("../../models/postgres/estudianteModel");
const notaSimpleModel = require("../../models/postgres/notaSimpleModel");
const campoNotaModel = require("../../models/postgres/campoNotaModel");
const observacionModel = require("../../models/postgres/observacionModel");
const { programarRecalculoRiesgo } = require("../../utils/recalculoRiesgo");
const { query } = require("../../config/postgres");
const { respuestaError } = require("../../utils/respuestaError");

async function obtenerTutorAutorizado(req, seccionId) {
  const docente = await docenteModel.obtenerDocentePorUserId(
    req.user.id,
    req.user.email || req.user.username
  );
  if (!docente) return { error: "solo docentes activos pueden registrar estudiantes" };
  if (!docente.es_tutor) return { error: "solo el docente tutor puede registrar estudiantes" };
  const secciones = await docenteModel.listarSeccionesDeDocente(
    req.user.id,
    req.user.email || req.user.username
  );
  if (!secciones.some(s => Number(s.seccion_id) === Number(seccionId))) {
    return { error: "la sección no está asignada a tu tutoría" };
  }
  return { docente, secciones };
}


async function registrarEstudianteTutor(req, res) {
  try {
    const { nombres, apellidos, correo, seccionId, contraseña, password } = req.body;

    if (!nombres || !apellidos || !correo || !seccionId) {
      return res.status(400).json({ error: "nombres, apellidos, correo y seccionId son requeridos" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo).trim())) {
      return res.status(400).json({ error: "correo electrónico inválido (ej: nombre@ofelia.edu.pe)" });
    }

    const contrasena = String(contraseña || password || "").trim();
    if (!contrasena || contrasena.length < 4) {
      return res.status(400).json({ error: "la contraseña es obligatoria y debe tener al menos 4 caracteres" });
    }
    const passwordHash = await bcrypt.hash(contrasena, 10);

    const autorizacion = await obtenerTutorAutorizado(req, seccionId);
    if (autorizacion.error) return res.status(403).json({ error: autorizacion.error });

    const existente = await estudianteModel.buscarEstudiantePorCorreo(correo);
    if (existente) return res.status(409).json({ error: "ya existe un estudiante con ese correo" });

    const enUso = await correoUtil.correoEnUso(correo);
    if (enUso) {
      return res.status(409).json({ error: `el correo ya está registrado en el sistema como ${enUso.tipo}. Revisa que esté bien escrito o usa otro.` });
    }

    const estudiante = await estudianteModel.crearEstudiante({
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      correo: String(correo).trim().toLowerCase(),
      seccionId: Number(seccionId),
      passwordHash
    });

    res.status(201).json({ estudiante, mensaje: "Estudiante registrado correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function registrarEstudiantesMasivo(req, res) {
  try {
    const { seccionId, registros } = req.body;
    if (!seccionId || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: "seccionId y registros son requeridos" });
    }
    if (registros.length > 500) {
      return res.status(400).json({ error: "máximo 500 estudiantes por carga" });
    }

    const autorizacion = await obtenerTutorAutorizado(req, seccionId);
    if (autorizacion.error) return res.status(403).json({ error: autorizacion.error });

    const resultados = { registrados: [], errores: [] };
    for (let i = 0; i < registros.length; i++) {
      const fila = registros[i];
      const numeroFila = fila.fila || i + 1;
      const nombres = String(fila.nombres || "").trim();
      const apellidos = String(fila.apellidos || "").trim();
      const correo = String(fila.correo || "").trim().toLowerCase();
      const contraseña = String(fila.contraseña || fila.password || "").trim();

      if (!nombres || !apellidos || !correo) {
        resultados.errores.push({ fila: numeroFila, correo, error: "falta nombre, apellido o correo" });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        resultados.errores.push({ fila: numeroFila, correo, error: "correo inválido" });
        continue;
      }
      if (!contraseña || contraseña.length < 4) {
        resultados.errores.push({ fila: numeroFila, correo, error: "la contraseña es obligatoria (mínimo 4 caracteres)" });
        continue;
      }

      const existente = await estudianteModel.buscarEstudiantePorCorreo(correo);
      if (existente) {
        resultados.errores.push({ fila: numeroFila, correo, error: "ya existe un estudiante con ese correo" });
        continue;
      }
      const enUso = await correoUtil.correoEnUso(correo);
      if (enUso) {
        resultados.errores.push({ fila: numeroFila, correo, error: `correo ya registrado como ${enUso.tipo}` });
        continue;
      }

      const passwordHash = contraseña ? await bcrypt.hash(contraseña, 10) : null;
      const estudiante = await estudianteModel.crearEstudiante({
        nombres,
        apellidos,
        correo,
        seccionId: Number(seccionId),
        passwordHash
      });
      resultados.registrados.push({
        id: estudiante.id,
        nombres,
        apellidos,
        correo,
        clave: contraseña || correo.split("@")[0]
      });
    }

    res.status(201).json(resultados);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function actualizarEstudianteTutor(req, res) {
  try {
    const estudianteId = Number(req.params.id);
    const { nombres, apellidos, correo, seccionId, contraseña, password } = req.body;
    if (!estudianteId) return res.status(400).json({ error: "id de estudiante requerido" });

    const estudiante = await estudianteModel.obtenerEstudiantePorId(estudianteId);
    if (!estudiante) return res.status(404).json({ error: "estudiante no encontrado" });

    const autorizacion = await obtenerTutorAutorizado(req, estudiante.seccion_id);
    if (autorizacion.error) return res.status(403).json({ error: autorizacion.error });

    let passwordHash;
    const contrasena = String(contraseña || password || "").trim();
    if (contrasena) {
      if (contrasena.length < 4) {
        return res.status(400).json({ error: "la contraseña debe tener al menos 4 caracteres" });
      }
      passwordHash = await bcrypt.hash(contrasena, 10);
    }

    if (correo !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo).trim())) {
        return res.status(400).json({ error: "correo electrónico inválido (ej: nombre@ofelia.edu.pe)" });
      }
      const enUso = await correoUtil.correoEnUso(String(correo).trim());
      if (enUso && Number(enUso.id) !== estudianteId) {
        return res.status(409).json({ error: `el correo ya está registrado en el sistema como ${enUso.tipo}. Revisa que esté bien escrito o usa otro.` });
      }
    }

    const actualizado = await estudianteModel.actualizarEstudiante(estudianteId, {
      nombres: nombres !== undefined ? String(nombres).trim() : undefined,
      apellidos: apellidos !== undefined ? String(apellidos).trim() : undefined,
      correo: correo !== undefined ? String(correo).trim().toLowerCase() : undefined,
      seccionId: seccionId !== undefined ? Number(seccionId) : undefined,
      passwordHash
    });

    res.json({ estudiante: actualizado, mensaje: "Estudiante actualizado correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarComportamientosDocente(req, res) {
  try {
    const seccionId = Number(req.query.seccionId);
    const trimestreId = Number(req.query.trimestreId);

    if (!seccionId) return res.status(400).json({ error: "seccionId requerido" });
    if (!trimestreId) return res.status(400).json({ error: "trimestreId requerido" });

    const secciones = await docenteModel.listarSeccionesDeDocente(
      req.user.id,
      req.user.email || req.user.username
    );
    if (!secciones.some(s => Number(s.seccion_id) === seccionId)) {
      return res.status(403).json({ error: "la sección no está asignada a este docente" });
    }

    const estudiantes = await comportamientoModel.listarEstudiantesConComportamiento({
      seccionId,
      trimestreId
    });
    res.json(estudiantes);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function guardarComportamientoDocente(req, res) {
  try {
    const { estudianteId, trimestreId, nivel, observacion } = req.body;

    if (!estudianteId || !trimestreId || !nivel) {
      return res.status(400).json({ error: "estudianteId, trimestreId y nivel son requeridos" });
    }
    const niveles = ["Excelente", "Bueno", "Regular", "Deficiente"];
    if (!niveles.includes(nivel)) {
      return res.status(400).json({ error: `nivel debe ser uno de: ${niveles.join(", ")}` });
    }
    if ((nivel === "Regular" || nivel === "Deficiente") && !String(observacion || "").trim()) {
      return res.status(400).json({ error: "Para nivel Regular (B) o Deficiente (C) la observación/justificación es requerida: indica si es por juego, distracción, etc." });
    }

    const docente = await docenteModel.obtenerDocentePorUserId(
      req.user.id,
      req.user.email || req.user.username
    );
    if (!docente) return res.status(403).json({ error: "solo docentes activos pueden registrar comportamiento" });

    const secciones = await docenteModel.listarSeccionesDeDocente(
      req.user.id,
      req.user.email || req.user.username
    );
    const pertenece = await query(
      `
        SELECT e.id
        FROM estudiantes e
        JOIN docente_secciones ds
          ON ds.seccion_id = e.seccion_id
         AND ds.docente_id = $1
        WHERE e.id = $2 AND e.activo = TRUE
        LIMIT 1
      `,
      [docente.id, estudianteId]
    );
    if (!pertenece.rows[0]) {
      return res.status(403).json({ error: "el estudiante no pertenece a las secciones de este docente" });
    }

    const trimestre = await query("SELECT id FROM trimestres_academicos WHERE id = $1", [trimestreId]);
    if (!trimestre.rows[0]) return res.status(404).json({ error: "trimestre no encontrado" });

    const guardado = await comportamientoModel.guardarComportamiento({
      estudianteId,
      trimestreId,
      nivel,
      observacion,
      registradoPor: docente.id
    });

    programarRecalculoRiesgo([estudianteId]);
    res.json({ comportamiento: guardado, mensaje: "Comportamiento registrado correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarNotasSimplesDocente(req, res) {
  try {
    const seccionId = Number(req.query.seccionId);
    const asignaturaId = Number(req.query.asignaturaId);
    const trimestreId = Number(req.query.trimestreId);
    if (!seccionId || !asignaturaId || !trimestreId) {
      return res.status(400).json({ error: "seccionId, asignaturaId y trimestreId son requeridos" });
    }

    const estudiantes = await notaSimpleModel.listarNotasSimples({
      seccionId,
      asignaturaId,
      trimestreId
    });
    res.json(estudiantes);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function guardarNotasSimplesDocente(req, res) {
  try {
    const { asignaturaId, trimestreId, registros } = req.body;
    if (!asignaturaId || !trimestreId || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: "asignaturaId, trimestreId y registros son requeridos" });
    }
    const guardados = await notaSimpleModel.guardarNotasSimples({
      asignaturaId: Number(asignaturaId),
      trimestreId: Number(trimestreId),
      registros
    });
    // Con un solo bimestre (8 semanas) ya se puede evaluar riesgo con notas + comportamiento + asistencia
    const ids = [...new Set(registros.map(r => Number(r.estudianteId)).filter(Boolean))];
    if (ids.length) programarRecalculoRiesgo(ids);
    res.json({ ok: true, total: guardados.length, registros: guardados });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function eliminarNotasSimplesDocente(req, res) {
  try {
    const { asignaturaId, trimestreId } = req.body;
    if (!asignaturaId || !trimestreId) return res.status(400).json({ error: "asignaturaId y trimestreId requeridos" });
    const borrados = await notaSimpleModel.eliminarNotasSimples({ asignaturaId: Number(asignaturaId), trimestreId: Number(trimestreId) });
    res.json({ ok: true, total: borrados.length });
  } catch (error) { respuestaError(res, error); }
}

async function eliminarComportamientoDocente(req, res) {
  try {
    const { estudianteId, trimestreId } = req.body;
    if (!trimestreId) return res.status(400).json({ error: "trimestreId requerido" });
    const ids = estudianteId ? [Number(estudianteId)] : null;
    const borrados = await comportamientoModel.eliminarComportamientos({ trimestreId: Number(trimestreId), estudianteIds: ids });
    if (ids && ids[0]) programarRecalculoRiesgo(ids);
    res.json({ ok: true, total: borrados.length });
  } catch (error) { respuestaError(res, error); }
}


async function listarObservacionesDocente(req, res) {
  try {
    const trimestreId = Number(req.query.trimestreId);
    if (!trimestreId) return res.status(400).json({ error: "trimestreId requerido" });
    const filas = await observacionModel.listarObservaciones({ trimestreId });
    res.json(filas);
  } catch (error) { respuestaError(res, error); }
}


async function guardarObservacionesDocente(req, res) {
  try {
    const { trimestreId, observaciones } = req.body;
    if (!trimestreId || !Array.isArray(observaciones)) {
      return res.status(400).json({ error: "trimestreId y observaciones[] son requeridos" });
    }
    const docente = await docenteModel.obtenerDocentePorUserId(
      req.user.id,
      req.user.email || req.user.username
    );
    if (!docente) return res.status(403).json({ error: "solo docentes activos pueden registrar observaciones" });
    const trimestre = await query("SELECT id FROM trimestres_academicos WHERE id = $1", [trimestreId]);
    if (!trimestre.rows[0]) return res.status(404).json({ error: "trimestre no encontrado" });
    const ids = (observaciones || []).map(o => Number(o.estudianteId)).filter(Boolean);
    if (ids.length) {
      const pertenecen = await query(
        `SELECT e.id FROM estudiantes e
         JOIN docente_secciones ds ON ds.seccion_id = e.seccion_id AND ds.docente_id = $1
         WHERE e.id = ANY($2::int[]) AND e.activo = TRUE`,
        [docente.id, ids]
      );
      const ok = new Set(pertenecen.rows.map(r => Number(r.id)));
      const fuera = ids.filter(id => !ok.has(id));
      if (fuera.length) return res.status(403).json({ error: "algunos estudiantes no pertenecen a tus secciones" });
    }
    const guardadas = await observacionModel.guardarObservaciones({ trimestreId, observaciones, creadoPor: docente.id });
    // Limpia las que quedaron vacías para no dejar basura
    const vacias = (observaciones || []).filter(o => !String(o.texto || "").trim() && Number(o.estudianteId)).map(o => Number(o.estudianteId));
    if (vacias.length) await observacionModel.eliminarObservacionesVacias({ trimestreId, estudianteIds: vacias });
    if (ids.length) programarRecalculoRiesgo([...new Set(ids)]);
    res.json({ ok: true, total: guardadas.length });
  } catch (error) { respuestaError(res, error); }
}


async function eliminarObservacionesDocente(req, res) {
  try {
    const { trimestreId, estudianteId } = req.body;
    if (!trimestreId) return res.status(400).json({ error: "trimestreId requerido" });
    let total = 0;
    if (estudianteId) {
      total = await observacionModel.eliminarObservacionesVacias({ trimestreId: Number(trimestreId), estudianteIds: [Number(estudianteId)] });
      programarRecalculoRiesgo([Number(estudianteId)]);
    } else {
      total = await observacionModel.eliminarPorTrimestre({ trimestreId: Number(trimestreId) });
    }
    res.json({ ok: true, total });
  } catch (error) { respuestaError(res, error); }
}


async function verificarAsignaturaDocente(req, asignaturaId) {
  const docente = await docenteModel.obtenerDocentePorUserId(
    req.user.id,
    req.user.email || req.user.username
  );
  if (!docente) return { error: "solo docentes activos pueden gestionar campos" };
  const ok = await query(
    `SELECT 1 FROM docente_asignaturas_secciones WHERE docente_id = $1 AND asignatura_id = $2 LIMIT 1`,
    [docente.id, asignaturaId]
  );
  if (!ok.rows[0]) return { error: "el curso no está asignado a este docente" };
  return { docente };
}


async function listarCamposDocente(req, res) {
  try {
    const asignaturaId = Number(req.query.asignaturaId);
    if (!asignaturaId) return res.status(400).json({ error: "asignaturaId requerido" });
    const v = await verificarAsignaturaDocente(req, asignaturaId);
    if (v.error) return res.status(403).json({ error: v.error });
    res.json(await campoNotaModel.listarCampos(asignaturaId));
  } catch (error) { respuestaError(res, error); }
}


async function crearCampoDocente(req, res) {
  try {
    const asignaturaId = Number(req.body.asignaturaId);
    const { nombre } = req.body;
    if (!asignaturaId || !String(nombre || "").trim()) {
      return res.status(400).json({ error: "asignaturaId y nombre son requeridos" });
    }
    const v = await verificarAsignaturaDocente(req, asignaturaId);
    if (v.error) return res.status(403).json({ error: v.error });
    const r = await campoNotaModel.crearCampo({ asignaturaId, nombre });
    res.json({ ok: true, ...r });
  } catch (error) { respuestaError(res, error); }
}


async function renombrarCampoDocente(req, res) {
  try {
    const id = Number(req.params.id);
    const { nombre } = req.body;
    if (!id || !String(nombre || "").trim()) {
      return res.status(400).json({ error: "id y nombre son requeridos" });
    }
    const campo = await campoNotaModel.obtenerCampo(id);
    if (!campo) return res.status(404).json({ error: "Campo no encontrado" });
    const v = await verificarAsignaturaDocente(req, campo.asignatura_id);
    if (v.error) return res.status(403).json({ error: v.error });
    const r = await campoNotaModel.renombrarCampo({ id, nombre });
    res.json({ ok: true, ...r });
  } catch (error) { respuestaError(res, error); }
}


async function eliminarCampoDocente(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "id requerido" });
    const campo = await campoNotaModel.obtenerCampo(id);
    if (!campo) return res.status(404).json({ error: "Campo no encontrado" });
    const v = await verificarAsignaturaDocente(req, campo.asignatura_id);
    if (v.error) return res.status(403).json({ error: v.error });
    const r = await campoNotaModel.eliminarCampo(id);
    if (r.afectados.length) programarRecalculoRiesgo(r.afectados);
    res.json({ ok: true, ...r, afectados: undefined });
  } catch (error) { respuestaError(res, error); }
}


async function listarMisSeccionesDocente(req, res) {
  try {
    const secciones = await docenteModel.listarSeccionesDeDocente(req.user.id, req.user.email);
    res.json(secciones);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarMisFormulariosDocente(req, res) {
  try {
    const formularios = await docenteModel.listarFormulariosDeDocente(req.user.id, req.user.email);
    res.json(formularios);
  } catch (error) {
    respuestaError(res, error);
  }
}


async function habilitarFormularioDocente(req, res) {
  try {
    const habilitacion = await docenteModel.habilitarFormularioDocente(req.user.id, req.user.email, req.params.id);
    if (!habilitacion) {
      return res.status(404).json({ error: "Formulario no asignado a una sección del docente" });
    }
    res.status(201).json({ ok: true, habilitacion });
  } catch (error) {
    respuestaError(res, error);
  }
}


async function listarEstadoRespuestasDocente(req, res) {
  try {
    const estado = await docenteModel.listarEstadoRespuestasFormulario(req.user.id, req.user.email, req.params.id);
    res.json(estado);
  } catch (error) {
    respuestaError(res, error);
  }
}

module.exports = {
  obtenerTutorAutorizado,
  registrarEstudianteTutor,
  registrarEstudiantesMasivo,
  actualizarEstudianteTutor,
  listarComportamientosDocente,
  guardarComportamientoDocente,
  listarNotasSimplesDocente,
  guardarNotasSimplesDocente,
  eliminarNotasSimplesDocente,
  eliminarComportamientoDocente,
  listarObservacionesDocente,
  guardarObservacionesDocente,
  eliminarObservacionesDocente,
  listarCamposDocente,
  crearCampoDocente,
  renombrarCampoDocente,
  eliminarCampoDocente,
  listarMisSeccionesDocente,
  listarMisFormulariosDocente,
  habilitarFormularioDocente,
  listarEstadoRespuestasDocente,
};
