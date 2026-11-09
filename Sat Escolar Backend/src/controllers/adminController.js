// controllers/adminController.js
// Endpoints de la directora (superusuario).

const bcrypt = require("bcryptjs");
const adminModel = require("../models/postgres/adminModel");
const correoUtil = require("../utils/correoUtil");
const { query } = require("../config/postgres");
const { respuestaError } = require("../utils/respuestaError");

function validarNombresApellidos(res, nombres, apellidos) {
  if (!nombres || !apellidos) {
    res.status(400).json({ error: "nombres y apellidos son requeridos" });
    return false;
  }
  return true;
}

async function crearDocente(req, res) {
  try {
    const { nombres, apellidos, password, esTutor, secciones } = req.body;
    let { correo } = req.body;

    if (!validarNombresApellidos(res, nombres, apellidos)) return;
    const correoValido = String(correo || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoValido)) {
      return res.status(400).json({ error: "correo electrónico inválido (ej: nombre@ofelia.edu.pe)" });
    }
    correo = correoValido;
    const passwordStr = String(password);
    if (passwordStr.length < 8) {
      return res.status(400).json({ error: "la contraseña debe tener al menos 8 caracteres" });
    }
    if (!/[A-Z]/.test(passwordStr)) {
      return res.status(400).json({ error: "la contraseña debe contener al menos una mayúscula" });
    }
    if (!/[a-z]/.test(passwordStr)) {
      return res.status(400).json({ error: "la contraseña debe contener al menos una minúscula" });
    }
    if (!/[0-9]/.test(passwordStr)) {
      return res.status(400).json({ error: "la contraseña debe contener al menos un número" });
    }
    if (!Array.isArray(secciones) || secciones.length === 0) {
      return res.status(400).json({ error: "asigna al menos una sección" });
    }

    const existente = await query(
      `SELECT id FROM docentes WHERE LOWER(correo) = LOWER($1)
       UNION SELECT id FROM usuarios WHERE LOWER(correo) = LOWER($1)`,
      [correo]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: "ya existe un docente o usuario con ese correo" });
    }
    const enUso = await correoUtil.correoEnUso(correo);
    if (enUso) {
      return res.status(409).json({ error: `el correo ya está registrado en el sistema como ${enUso.tipo}. Revisa que esté bien escrito o usa otro.` });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const docenteId = await adminModel.crearDocente({
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      correo,
      passwordHash,
      esTutor: Boolean(esTutor),
      secciones
    });

    res.status(201).json({ id: docenteId, mensaje: "Docente creado correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function listarDocentes(req, res) {
  try {
    const docentes = await adminModel.listarDocentes();
    res.json(docentes);
  } catch (error) {
    respuestaError(res, error);
  }
}

// Dia de tutoria por seccion: 1=Lunes .. 6=Sabado, null = sin dia
const DIAS_VALIDOS = new Set([1, 2, 3, 4, 5, 6]);
async function asignarDiaTutoria(req, res) {
  try {
    const seccionId = Number(req.params.id);
    if (!seccionId) return res.status(400).json({ error: "id de seccion requerido" });

    const bruto = req.body.diaTutoria;
    const dia = (bruto === null || bruto === "" || bruto === undefined) ? null : Number(bruto);
    if (dia !== null && !DIAS_VALIDOS.has(dia)) {
      return res.status(400).json({ error: "diaTutoria debe ser 1 (Lunes) a 6 (Sabado) o null" });
    }

    const existe = await query(`SELECT id FROM secciones WHERE id = $1`, [seccionId]);
    if (!existe.rows[0]) return res.status(404).json({ error: "seccion no encontrada" });

    await query(`UPDATE secciones SET dia_tutoria = $1 WHERE id = $2`, [dia, seccionId]);
    res.json({ ok: true, mensaje: dia ? `Tutoria asignada al dia ${dia}` : "Dia de tutoria removido", dia_tutoria: dia });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function crearPsicologo(req, res) {
  try {
    const { nombres, apellidos, correo, username, password, codigo } = req.body;

    if (!validarNombresApellidos(res, nombres, apellidos)) return;
    if (!username || String(username).length < 3) {
      return res.status(400).json({ error: "el usuario debe tener al menos 3 caracteres" });
    }
    if (!correo || !String(correo).includes("@")) {
      return res.status(400).json({ error: "correo electrónico inválido" });
    }
    const ps = String(password || "");
    if (ps.length < 8) return res.status(400).json({ error: "la contraseña debe tener al menos 8 caracteres" });
    if (!/[A-Z]/.test(ps)) return res.status(400).json({ error: "la contraseña debe contener al menos una mayúscula" });
    if (!/[a-z]/.test(ps)) return res.status(400).json({ error: "la contraseña debe contener al menos una minúscula" });
    if (!/[0-9]/.test(ps)) return res.status(400).json({ error: "la contraseña debe contener al menos un número" });

    const existente = await query(
      `SELECT id FROM usuarios WHERE LOWER(username) = LOWER($1) OR LOWER(correo) = LOWER($2)`,
      [username, correo]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: "ya existe un usuario con ese nombre o correo" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const usuarioId = await adminModel.crearPsicologo({
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      correo,
      username,
      passwordHash,
      codigo: String(codigo || `PSI-${Date.now()}`).slice(0, 30)
    });

    res.status(201).json({ id: usuarioId, mensaje: "Psicólogo creado correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function crearAsignatura(req, res) {
  try {
    const { nombre } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: "nombre del curso es requerido" });
    }
    const creada = await adminModel.crearAsignatura({ nombre: String(nombre).trim() });
    res.status(201).json(creada);
  } catch (error) {
    respuestaError(res, error);
  }
}

async function listarPsicologos(req, res) {
  try {
    const psicologos = await adminModel.listarPsicologos();
    res.json(psicologos);
  } catch (error) {
    respuestaError(res, error);
  }
}

async function resetearContrasenaDocente(req, res) {
  try {
    const { password } = req.body;
    const docenteId = Number(req.params.id);

    if (!docenteId) return res.status(400).json({ error: "id de docente requerido" });
    const ps = String(password || "");
    if (ps.length < 8) return res.status(400).json({ error: "la contraseña debe tener al menos 8 caracteres" });
    if (!/[A-Z]/.test(ps)) return res.status(400).json({ error: "debe contener al menos una mayúscula" });
    if (!/[a-z]/.test(ps)) return res.status(400).json({ error: "debe contener al menos una minúscula" });
    if (!/[0-9]/.test(ps)) return res.status(400).json({ error: "debe contener al menos un número" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const actualizado = await adminModel.cambiarContrasenaDocente(docenteId, passwordHash);
    if (!actualizado) return res.status(404).json({ error: "docente no encontrado" });

    res.json({ mensaje: "Contraseña actualizada correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function cambiarTutorDocente(req, res) {
  try {
    const docenteId = Number(req.params.id);
    const { esTutor } = req.body;

    if (!docenteId) return res.status(400).json({ error: "id de docente requerido" });
    if (typeof esTutor !== "boolean") {
      return res.status(400).json({ error: "esTutor debe ser booleano" });
    }

    const actualizado = await adminModel.cambiarTutorDocente(docenteId, esTutor);
    if (!actualizado) return res.status(404).json({ error: "docente no encontrado" });

    res.json(actualizado);
  } catch (error) {
    respuestaError(res, error);
  }
}

async function eliminarDocente(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "id requerido" });
    const r = await query("DELETE FROM docentes WHERE id = $1 RETURNING id", [id]);
    if (!r.rows.length) return res.status(404).json({ error: "docente no encontrado" });
    // Limpia asignaciones huérfanas
    await query("DELETE FROM docente_secciones WHERE docente_id = $1", [id]);
    await query("DELETE FROM docente_asignaturas_secciones WHERE docente_id = $1", [id]);
    res.json({ ok: true, mensaje: "Docente eliminado" });
  } catch (e) { respuestaError(res, e); }
}

async function resetDatabase(req, res) {
  try {
    const bcrypt = require("bcryptjs");
    const { pool } = require("../config/postgres");
    const client = await pool.connect();

    await client.query("BEGIN");

    await client.query(`
      DELETE FROM docente_asignaturas_secciones; DELETE FROM docente_secciones;
      DELETE FROM asignaturas; DELETE FROM productos_evaluacion;
      DELETE FROM competencias; DELETE FROM niveles_logro;
      DELETE FROM trimestres_academicos; DELETE FROM evaluaciones_academicas;
      DELETE FROM calificaciones_trimestrales_competencia; DELETE FROM calificaciones_competencia;
      DELETE FROM notas_simples; DELETE FROM notas;
      DELETE FROM formulario_respuestas; DELETE FROM formulario_habilitaciones;
      DELETE FROM formulario_preguntas; DELETE FROM pregunta_opciones;
      DELETE FROM formularios_psicologicos; DELETE FROM formularios_activos;
      DELETE FROM comportamientos; DELETE FROM alertas_riesgo;
      DELETE FROM evaluaciones_riesgo_estudiante; DELETE FROM configuraciones_riesgo;
      DELETE FROM evaluaciones_riesgo; DELETE FROM seguimientos_psicopedagogicos;
      DELETE FROM casos_seguimiento; DELETE FROM asistencias;
      DELETE FROM reporte_archivos; DELETE FROM reportes_anonimos;
      DELETE FROM mensajes_anonimos; DELETE FROM codigos_verificacion;
      DELETE FROM respuestas_formulario; DELETE FROM registros_docente;
      DELETE FROM psicologos; DELETE FROM docentes;
      DELETE FROM estudiantes; DELETE FROM periodos_academicos;
      DELETE FROM secciones; DELETE FROM usuarios;
    `);

    await client.query("ALTER SEQUENCE usuarios_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE psicologos_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE secciones_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE periodos_academicos_id_seq RESTART WITH 1");

    const hashDir = bcrypt.hashSync("Directora2026!", 10);

    await client.query(`
      INSERT INTO usuarios (username,correo,password_hash,rol,activo) VALUES ($1,$2,$3,'director',TRUE)
      ON CONFLICT DO NOTHING
    `, ["directora", "directora@ofelia.edu.pe", hashDir]);

    await client.query("COMMIT");
    client.release();

    res.json({
      ok: true,
      mensaje: "Base de datos reiniciada. Solo queda el director.",
      usuarios: [
        { rol: "Director", correo: "directora@ofelia.edu.pe", password: "Directora2026!" }
      ]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ISO 27001 A.8.15: bitácora de accesos a datos sensibles (solo dirección)
async function listarAuditoria(req, res) {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 500);
    const { estudiante_id, accion } = req.query;
    const conds = [];
    const params = [];
    if (estudiante_id) { params.push(Number(estudiante_id)); conds.push(`a.estudiante_id = $${params.length}`); }
    if (accion) { params.push(String(accion)); conds.push(`a.accion = $${params.length}`); }
    params.push(limite);
    const q = await query(
      `SELECT a.id, a.fecha, a.usuario_id, a.rol, a.accion, a.estudiante_id, a.detalle,
              u.correo AS usuario_correo,
              (e.nombres || ' ' || e.apellidos) AS estudiante_nombre
       FROM auditoria_accesos a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN estudiantes e ON e.id = a.estudiante_id
       ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
       ORDER BY a.fecha DESC LIMIT $${params.length}`,
      params
    );
    res.json(q.rows);
  } catch (e) { respuestaError(res, e); }
}

module.exports = {
  crearDocente,
  listarDocentes,
  crearAsignatura,
  crearPsicologo,
  listarPsicologos,
  resetearContrasenaDocente,
  cambiarTutorDocente,
  eliminarDocente,
  asignarDiaTutoria,
  resetDatabase,
  listarAuditoria
};