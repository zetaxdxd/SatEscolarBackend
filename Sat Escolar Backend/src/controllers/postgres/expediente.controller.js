// Expediente integral: perfil bajo + incidencias + derivaciones + historial
const { query } = require("../../config/postgres");
const { respuestaError } = require("../../utils/respuestaError");
const { registrarAcceso } = require("../../utils/auditoria");

function rolDeUsuario(req) {
  const r = String(req.user?.rol || req.user?.role || "").toLowerCase();
  if (["psicologo","director","docente","tutor","estudiante"].includes(r)) return r === "tutor" ? "tutor" : r;
  return r;
}

// ── PERFIL ───────────────────────────────────────────────────────────────
async function obtenerMiPerfil(req, res) {
  try {
    let estudianteId = null;
    const rol = String(req.user.role || req.user.rol || "").toLowerCase();
    if (rol === "estudiante") {
      estudianteId = Number(req.user.studentId || req.user.estudianteId || req.user.id);
      if (!estudianteId && req.user.correo) {
        const e2 = await query("SELECT id FROM estudiantes WHERE correo=$1", [req.user.correo]);
        estudianteId = e2.rows[0]?.id || null;
      }
    } else {
      const uRes = await query("SELECT correo FROM usuarios WHERE id=$1", [req.user.id]);
      const correo = uRes.rows[0]?.correo;
      if (correo) {
        const eRes = await query("SELECT id FROM estudiantes WHERE correo=$1", [correo]);
        estudianteId = eRes.rows[0]?.id || null;
      }
      // Fallback: si es docente/psicologo consultando su propio perfil de estudiante (no aplica)
    }
    if (!estudianteId || isNaN(estudianteId)) return res.status(404).json({ error: "Estudiante no encontrado", perfil_completado: false });
    const pRes = await query("SELECT * FROM perfiles_estudiante WHERE estudiante_id=$1", [estudianteId]);
    if (pRes.rows.length === 0) return res.json({ perfil_completado: false, perfil: null, estudiante_id: estudianteId });
    res.json({ perfil_completado: !!pRes.rows[0].perfil_completado, perfil: pRes.rows[0], estudiante_id: estudianteId });
  } catch (e) { respuestaError(res, e); }
}

async function guardarMiPerfil(req, res) {
  try {
    let estudianteId = null;
    const rol = String(req.user.role || req.user.rol || "").toLowerCase();
    if (rol === "estudiante") {
      estudianteId = Number(req.user.studentId || req.user.estudianteId || req.user.id);
      if ((!estudianteId || isNaN(estudianteId)) && req.user.correo) {
        const e2 = await query("SELECT id FROM estudiantes WHERE correo=$1", [req.user.correo]);
        estudianteId = e2.rows[0]?.id || null;
      }
    } else {
      const uRes = await query("SELECT correo FROM usuarios WHERE id=$1", [req.user.id]);
      const correo = uRes.rows[0]?.correo;
      if (correo) {
        const eRes = await query("SELECT id FROM estudiantes WHERE correo=$1", [correo]);
        estudianteId = eRes.rows[0]?.id || null;
      }
    }
    if (!estudianteId || isNaN(estudianteId)) return res.status(404).json({ error: "Estudiante no encontrado" });
    const { dni, fecha_nacimiento, direccion, telefono, con_quien_vive, situacion_convivencia, antecedentes, apoderado_nombre, apoderado_dni, apoderado_parentesco, apoderado_telefono, apoderado_ocupacion } = req.body;
    if (!con_quien_vive || !situacion_convivencia || !apoderado_nombre || !apoderado_telefono) {
      return res.status(400).json({ error: "con_quien_vive, situacion_convivencia, apoderado_nombre y apoderado_telefono son obligatorios" });
    }
    const upsert = await query(`
      INSERT INTO perfiles_estudiante (estudiante_id, dni, fecha_nacimiento, direccion, telefono, con_quien_vive, situacion_convivencia, antecedentes, apoderado_nombre, apoderado_dni, apoderado_parentesco, apoderado_telefono, apoderado_ocupacion, perfil_completado, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, TRUE, NOW())
      ON CONFLICT (estudiante_id) DO UPDATE SET
        dni=EXCLUDED.dni, fecha_nacimiento=EXCLUDED.fecha_nacimiento, direccion=EXCLUDED.direccion, telefono=EXCLUDED.telefono,
        con_quien_vive=EXCLUDED.con_quien_vive, situacion_convivencia=EXCLUDED.situacion_convivencia, antecedentes=EXCLUDED.antecedentes,
        apoderado_nombre=EXCLUDED.apoderado_nombre, apoderado_dni=EXCLUDED.apoderado_dni, apoderado_parentesco=EXCLUDED.apoderado_parentesco,
        apoderado_telefono=EXCLUDED.apoderado_telefono, apoderado_ocupacion=EXCLUDED.apoderado_ocupacion,
        perfil_completado=TRUE, updated_at=NOW()
      RETURNING *;
    `, [estudianteId, dni||null, fecha_nacimiento||null, direccion||null, telefono||null, con_quien_vive, situacion_convivencia, antecedentes||null, apoderado_nombre, apoderado_dni||null, apoderado_parentesco||null, apoderado_telefono, apoderado_ocupacion||null]);
    res.json({ mensaje: "Perfil guardado", perfil: upsert.rows[0] });
  } catch (e) { respuestaError(res, e); }
}

async function obtenerPerfilEstudiante(req, res) {
  try {
    const estudianteId = Number(req.params.id);
    const pRes = await query("SELECT * FROM perfiles_estudiante WHERE estudiante_id=$1", [estudianteId]);
    if (pRes.rows.length === 0) return res.json({ perfil_completado: false, perfil: null });
    res.json({ perfil_completado: !!pRes.rows[0].perfil_completado, perfil: pRes.rows[0] });
  } catch (e) { respuestaError(res, e); }
}

// ── INCIDENCIAS ───────────────────────────────────────────────────────────
async function crearIncidencia(req, res) {
  try {
    const { estudiante_id, tipo, descripcion, observacion, derivar_a, motivo_derivacion, informe } = req.body;
    const estudianteId = Number(estudiante_id);
    if (!estudianteId || !tipo || !descripcion) return res.status(400).json({ error: "estudiante_id, tipo y descripcion son obligatorios" });
    const rol = rolDeUsuario(req);
    const rolCreador = ["docente","tutor","psicologo","director"].includes(rol) ? rol : "docente";
    const incRes = await query(`
      INSERT INTO incidencias (estudiante_id, tipo, descripcion, observacion, creado_por, rol_creador, fecha_incidencia)
      VALUES ($1,$2,$3,$4,$5,$6, CURRENT_DATE) RETURNING *;
    `, [estudianteId, tipo, descripcion, observacion||null, req.user.id, rolCreador]);
    const incidencia = incRes.rows[0];

    // Si pide derivación, crear derivación con expediente
    let derivacion = null;
    if (derivar_a && ["psicologo","tutor","direccion"].includes(derivar_a)) {
      // Armar expediente snapshot
      const perfilRes = await query("SELECT * FROM perfiles_estudiante WHERE estudiante_id=$1", [estudianteId]);
      const perfil = perfilRes.rows[0] || null;
      const estRes = await query("SELECT e.nombres, e.apellidos, e.correo, s.grado, s.letra, s.nivel FROM estudiantes e JOIN secciones s ON s.id=e.seccion_id WHERE e.id=$1", [estudianteId]);
      const estudiante = estRes.rows[0] || {};
      const expediente = { perfil, estudiante, incidencia, observacion: observacion||null, fecha: new Date().toISOString() };
      const derRes = await query(`
        INSERT INTO derivaciones (incidencia_id, estudiante_id, origen_id, origen_rol, destino, motivo, informe, expediente)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;
      `, [incidencia.id, estudianteId, req.user.id, rolCreador, derivar_a, motivo_derivacion||descripcion, informe||observacion||null, JSON.stringify(expediente)]);
      derivacion = derRes.rows[0];
    }
    res.status(201).json({ incidencia, derivacion });
  } catch (e) { respuestaError(res, e); }
}

async function listarIncidenciasEstudiante(req, res) {
  try {
    const estudianteId = Number(req.params.id);
    const resQ = await query(`
      SELECT i.*, u.correo as creador_correo, s.grado, s.letra
      FROM incidencias i
      LEFT JOIN usuarios u ON u.id=i.creado_por
      LEFT JOIN estudiantes e ON e.id=i.estudiante_id
      LEFT JOIN secciones s ON s.id=e.seccion_id
      WHERE i.estudiante_id=$1 ORDER BY i.fecha_incidencia DESC, i.created_at DESC
    `, [estudianteId]);
    res.json(resQ.rows);
  } catch (e) { respuestaError(res, e); }
}

async function historialEstudiante(req, res) {
  try {
    const estudianteId = Number(req.params.id);
    const perfilRes = await query("SELECT * FROM perfiles_estudiante WHERE estudiante_id=$1", [estudianteId]);
    const incRes = await query("SELECT * FROM incidencias WHERE estudiante_id=$1 ORDER BY fecha_incidencia DESC LIMIT 20", [estudianteId]);
    const derRes = await query("SELECT d.*, u.correo as origen_correo FROM derivaciones d LEFT JOIN usuarios u ON u.id=d.origen_id WHERE d.estudiante_id=$1 ORDER BY d.fecha_derivacion DESC LIMIT 20", [estudianteId]);
    // Reusar datos existentes: notas, asistencia, comportamiento, evaluaciones
    const estRes = await query("SELECT e.*, s.grado, s.letra, s.nivel FROM estudiantes e JOIN secciones s ON s.id=e.seccion_id WHERE e.id=$1", [estudianteId]);
    res.json({
      perfil: perfilRes.rows[0] || null,
      perfil_completado: !!perfilRes.rows[0]?.perfil_completado,
      incidencias: incRes.rows,
      derivaciones: derRes.rows,
      estudiante: estRes.rows[0] || null
    });
  } catch (e) { respuestaError(res, e); }
}

// ── DERIVACIONES ───────────────────────────────────────────────────────────
async function listarDerivaciones(req, res) {
  try {
    const { destino, estado } = req.query;
    const rol = rolDeUsuario(req);
    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;
    if (destino) { where += ` AND d.destino=$${idx++}`; params.push(destino); }
    else if (rol === "psicologo") { where += ` AND d.destino='psicologo'`; }
    else if (rol === "director") { where += ` AND d.destino='direccion'`; }
    // tutor ve las suyas
    if (estado) { where += ` AND d.estado=$${idx++}`; params.push(estado); }
    else { where += ` AND d.estado='pendiente'`; }
    const q = await query(`
      SELECT d.*, e.nombres, e.apellidos, e.correo as estudiante_correo, s.grado, s.letra, s.nivel,
             u.correo as origen_correo
      FROM derivaciones d
      JOIN estudiantes e ON e.id=d.estudiante_id
      JOIN secciones s ON s.id=e.seccion_id
      LEFT JOIN usuarios u ON u.id=d.origen_id
      ${where}
      ORDER BY d.fecha_derivacion DESC LIMIT 50
    `, params);
    res.json(q.rows);
  } catch (e) { respuestaError(res, e); }
}

async function atenderDerivacion(req, res) {
  try {
    const id = Number(req.params.id);
    const q = await query("UPDATE derivaciones SET estado='atendida', atendida_en=NOW() WHERE id=$1 RETURNING *", [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: "Derivación no encontrada" });
    res.json({ mensaje: "Derivación atendida", derivacion: q.rows[0] });
  } catch (e) { respuestaError(res, e); }
}

async function crearDerivacionDirecta(req, res) {
  try {
    const { estudiante_id, destino, motivo, informe } = req.body;
    const estudianteId = Number(estudiante_id);
    if (!estudianteId || !destino || !motivo) return res.status(400).json({ error: "estudiante_id, destino y motivo son obligatorios" });
    if (!["psicologo","tutor","direccion"].includes(destino)) return res.status(400).json({ error: "destino inválido" });
    const rol = rolDeUsuario(req);
    const perfilRes = await query("SELECT * FROM perfiles_estudiante WHERE estudiante_id=$1", [estudianteId]);
    const estRes = await query("SELECT e.nombres, e.apellidos, e.correo, s.grado, s.letra FROM estudiantes e JOIN secciones s ON s.id=e.seccion_id WHERE e.id=$1", [estudianteId]);
    const expediente = { perfil: perfilRes.rows[0]||null, estudiante: estRes.rows[0]||null, fecha: new Date().toISOString() };
    const q = await query(`
      INSERT INTO derivaciones (estudiante_id, origen_id, origen_rol, destino, motivo, informe, expediente)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;
    `, [estudianteId, req.user.id, rol, destino, motivo, informe||motivo, JSON.stringify(expediente)]);
    res.status(201).json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}

// ── EXPEDIENTE FORMATOS (correlativo automático por estudiante y tipo) ───────────
async function crearExpedienteFormato(req, res) {
  try {
    const estudianteId = Number(req.params.estudianteId);
    const { tipo, datos, archivo_base64, archivo_tipo, archivo_nombre, fecha_registro } = req.body;
    const tiposValidos = ['ficha_diagnostica','consentimiento','acta_compromiso','entrevista_estudiante','entrevista_padre','ficha_estudiante','visita_domiciliaria','derivacion_externa','seguimiento'];
    if (!estudianteId || !tipo || !tiposValidos.includes(tipo)) return res.status(400).json({ error: "estudianteId y tipo válido son obligatorios" });
    // Correlativo automático por estudiante y tipo
    const corrRes = await query("SELECT COALESCE(MAX(correlativo),0)+1 as next FROM expediente_formatos WHERE estudiante_id=$1 AND tipo=$2", [estudianteId, tipo]);
    const correlativo = corrRes.rows[0].next;
    const q = await query(`
      INSERT INTO expediente_formatos (estudiante_id, tipo, correlativo, datos, archivo_base64, archivo_tipo, archivo_nombre, creado_por, fecha_registro)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *;
    `, [estudianteId, tipo, correlativo, JSON.stringify(datos||{}), archivo_base64||null, archivo_tipo||null, archivo_nombre||null, req.user.id, fecha_registro||new Date().toISOString().slice(0,10)]);
    res.status(201).json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}
async function listarExpedienteFormatos(req, res) {
  try {
    const estudianteId = Number(req.params.estudianteId);
    const { tipo } = req.query;
    let where = "WHERE estudiante_id=$1 AND estado='activo'";
    const params = [estudianteId];
    if (tipo) { where += ` AND tipo=$2`; params.push(tipo); }
    const q = await query(`SELECT * FROM expediente_formatos ${where} ORDER BY fecha_registro DESC, correlativo DESC`, params);
    registrarAcceso({ usuarioId: req.user.id, rol: rolDeUsuario(req), accion: "listar_expediente", estudianteId, detalle: tipo || "todos" });
    res.json(q.rows);
  } catch (e) { respuestaError(res, e); }
}
async function obtenerExpedienteFormato(req, res) {
  try {
    const id = Number(req.params.id);
    const q = await query("SELECT * FROM expediente_formatos WHERE id=$1", [id]);
    if (!q.rows.length) return res.status(404).json({ error: "Formato no encontrado" });
    registrarAcceso({ usuarioId: req.user.id, rol: rolDeUsuario(req), accion: "ver_formato", estudianteId: q.rows[0].estudiante_id, detalle: q.rows[0].tipo });
    res.json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}
async function actualizarExpedienteFormato(req, res) {
  try {
    const id = Number(req.params.id);
    const { datos, archivo_base64, archivo_tipo, archivo_nombre, fecha_registro } = req.body;
    const q = await query(`
      UPDATE expediente_formatos SET datos=COALESCE($1, datos), archivo_base64=COALESCE($2, archivo_base64), archivo_tipo=COALESCE($3, archivo_tipo), archivo_nombre=COALESCE($4, archivo_nombre), fecha_registro=COALESCE($5, fecha_registro)
      WHERE id=$6 RETURNING *;
    `, [datos?JSON.stringify(datos):null, archivo_base64||null, archivo_tipo||null, archivo_nombre||null, fecha_registro||null, id]);
    if (!q.rows.length) return res.status(404).json({ error: "Formato no encontrado" });
    res.json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}
async function archivarExpedienteFormato(req, res) {
  try {
    const id = Number(req.params.id);
    const q = await query("UPDATE expediente_formatos SET estado='archivado' WHERE id=$1 RETURNING *", [id]);
    if (!q.rows.length) return res.status(404).json({ error: "Formato no encontrado" });
    res.json({ mensaje: "Archivado", formato: q.rows[0] });
  } catch (e) { respuestaError(res, e); }
}

// ── NEE Y ESTADO CASO ────────────────────────────────────────────────────────
async function actualizarNEE(req, res) {
  try {
    const estudianteId = Number(req.params.id);
    const { nee, nee_detalle } = req.body;
    const vals = ['ninguna','TDAH','TEA','discapacidad_intelectual','trastorno_lenguaje','otro'];
    if (nee && !vals.includes(nee)) return res.status(400).json({ error: "NEE inválido" });
    const q = await query(`
      INSERT INTO perfiles_estudiante (estudiante_id, nee, nee_detalle, perfil_completado, updated_at)
      VALUES ($1,$2,$3, FALSE, NOW())
      ON CONFLICT (estudiante_id) DO UPDATE SET nee=EXCLUDED.nee, nee_detalle=EXCLUDED.nee_detalle, updated_at=NOW()
      RETURNING *;
    `, [estudianteId, nee||'ninguna', nee_detalle||null]);
    res.json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}
async function actualizarEstadoCaso(req, res) {
  try {
    const casoId = Number(req.params.id);
    const { estado_caso } = req.body;
    const vals = ['en_psicologia','en_direccion','derivado_externo','cerrado'];
    if (!vals.includes(estado_caso)) return res.status(400).json({ error: "estado_caso inválido" });
    const q = await query("UPDATE casos_seguimiento SET estado_caso=$1, fecha_actualizacion=NOW() WHERE id=$2 RETURNING *", [estado_caso, casoId]);
    if (!q.rows.length) return res.status(404).json({ error: "Caso no encontrado" });
    res.json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}
async function obtenerFichaDiagnostica(req, res) {
  try {
    let estudianteId = null;
    const rol = String(req.user.role || req.user.rol || "").toLowerCase();
    if (rol === "estudiante") estudianteId = Number(req.user.studentId || req.user.id);
    else estudianteId = Number(req.params.id);
    if (!Number.isInteger(estudianteId) || estudianteId <= 0) {
      return res.status(400).json({ error: "estudiante_id requerido" });
    }
    const q = await query("SELECT * FROM fichas_diagnosticas_socioeducativas WHERE estudiante_id=$1", [estudianteId]);
    if (!q.rows.length) return res.json({ completada: false, datos: null });
    registrarAcceso({ usuarioId: req.user.id, rol, accion: "ver_ficha", estudianteId });
    res.json({ completada: !!q.rows[0].completada, datos: q.rows[0].datos, ficha: q.rows[0] });
  } catch (e) { respuestaError(res, e); }
}
async function guardarFichaDiagnostica(req, res) {
  try {
    let estudianteId = null;
    const rol = String(req.user.role || req.user.rol || "").toLowerCase();
    if (rol === "estudiante") estudianteId = Number(req.user.studentId || req.user.id);
    else estudianteId = Number(req.params.id || req.body.estudiante_id);
    if (!Number.isInteger(estudianteId) || estudianteId <= 0) {
      return res.status(400).json({ error: "estudiante_id requerido" });
    }
    const datos = req.body.datos || req.body;
    // Validar que tenga al menos datos generales
    const q = await query(`
      INSERT INTO fichas_diagnosticas_socioeducativas (estudiante_id, datos, completada, updated_at)
      VALUES ($1,$2,TRUE,NOW())
      ON CONFLICT (estudiante_id) DO UPDATE SET datos=EXCLUDED.datos, completada=TRUE, updated_at=NOW()
      RETURNING *;
    `, [estudianteId, JSON.stringify(datos)]);
    // También actualizar perfil bajo para compatibilidad con motor
    // Normaliza etiquetas del formulario a los valores del CHECK de perfiles_estudiante
    try {
      const MAP_VIVE = {
        "ambos padres": "padres", "solo madre": "madre", "solo padre": "padre",
        "solo abuelos": "abuelos", "hermanos": "otro", "madre y padrastro": "otro",
        "padre y madrastra": "otro", "tíos y abuela": "abuelos", "tios y abuela": "abuelos",
        "otros": "otro", "padres": "padres", "madre": "madre", "padre": "padre",
        "abuelos": "abuelos", "tutor": "tutor", "albergue": "albergue", "solo": "solo", "otro": "otro"
      };
      const MAP_SITUACION = {
        "armoniosas": "estable", "regularmente armoniosas": "estable",
        "conflictivas": "conflictiva", "violentas": "violencia",
        "estable": "estable", "conflictiva": "conflictiva", "violencia": "violencia",
        "ausencia": "ausencia", "sobreproteccion": "sobreproteccion"
      };
      const norm = v => String(v || "").trim().toLowerCase();
      let conQuien = datos.conQuienVives || datos["2.2"] || null;
      if (!conQuien) {
        // Derivar desde los checkboxes vives_* si vienen sin normalizar
        const MAP_VIVES = {
          vives_ambospadres: "padres", vives_solomadre: "madre", vives_solopadre: "padre",
          vives_soloabuelos: "abuelos", vives_hermanos: "otro", vives_madrastra: "otro",
          vives_padrastra: "otro", vives_tios: "abuelos", vives_otros: "otro"
        };
        for (const [k, val] of Object.entries(MAP_VIVES)) {
          if (datos[k]) { conQuien = val; break; }
        }
      }
      conQuien = conQuien ? (MAP_VIVE[norm(conQuien)] || null) : null;
      const sitRaw = datos.situacion_convivencia || datos.relacionesFamiliares || datos.relaciones_familiares || datos["2.3"] || null;
      const situacion = sitRaw ? (MAP_SITUACION[norm(sitRaw)] || null) : null;
      if (conQuien || situacion) {
        await query(`INSERT INTO perfiles_estudiante (estudiante_id, con_quien_vive, situacion_convivencia, perfil_completado) VALUES ($1,$2,$3,TRUE) ON CONFLICT (estudiante_id) DO UPDATE SET con_quien_vive=COALESCE(EXCLUDED.con_quien_vive, perfiles_estudiante.con_quien_vive), situacion_convivencia=COALESCE(EXCLUDED.situacion_convivencia, perfiles_estudiante.situacion_convivencia), perfil_completado=TRUE`, [estudianteId, conQuien, situacion]);
      }
    } catch (e) { console.error("sync perfil bajo:", e.message); }
    res.json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}

// ── CHARLAS POR AULA ─────────────────────────────────────────────────────────
async function crearCharla(req, res) {
  try {
    const { seccion_id, grado, seccion, fecha, tema, motivo, descripcion, participantes } = req.body;
    if (!tema) return res.status(400).json({ error: "tema es obligatorio" });
    const psicRes = await query("SELECT id FROM psicologos WHERE usuario_id=$1", [req.user.id]);
    const psicologoId = psicRes.rows[0]?.id || null;
    const q = await query(`
      INSERT INTO charlas_aula (seccion_id, grado, seccion, fecha, tema, motivo, descripcion, participantes, psicologo_id, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *;
    `, [seccion_id||null, grado||null, seccion||null, fecha||new Date().toISOString().slice(0,10), tema, motivo||null, descripcion||null, participantes||null, psicologoId, req.user.id]);
    res.status(201).json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}
async function listarCharlas(req, res) {
  try {
    const { desde, hasta, seccion_id } = req.query;
    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;
    if (desde) { where += ` AND fecha >= $${idx++}`; params.push(desde); }
    if (hasta) { where += ` AND fecha <= $${idx++}`; params.push(hasta); }
    if (seccion_id) { where += ` AND seccion_id = $${idx++}`; params.push(seccion_id); }
    const q = await query(`SELECT c.*, s.grado, s.letra, s.nombre FROM charlas_aula c LEFT JOIN secciones s ON s.id=c.seccion_id ${where} ORDER BY fecha DESC LIMIT 100`, params);
    res.json(q.rows);
  } catch (e) { respuestaError(res, e); }
}
async function generarReporteBimestral(req, res) {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son obligatorios (YYYY-MM-DD)" });
    const atencionesQ = await query(`SELECT tipo, COUNT(*)::int as total FROM expediente_formatos WHERE fecha_registro BETWEEN $1 AND $2 AND estado='activo' GROUP BY tipo`, [desde, hasta]);
    const charlasQ = await query(`SELECT COUNT(*)::int as total, COUNT(DISTINCT seccion_id)::int as aulas FROM charlas_aula WHERE fecha BETWEEN $1 AND $2`, [desde, hasta]);
    const derivQ = await query(`SELECT destino, COUNT(*)::int as total FROM derivaciones WHERE fecha_derivacion::date BETWEEN $1 AND $2 GROUP BY destino`, [desde, hasta]);
    const incQ = await query(`SELECT tipo, COUNT(*)::int as total FROM incidencias WHERE fecha_incidencia BETWEEN $1 AND $2 GROUP BY tipo`, [desde, hasta]);
    res.json({
      rango: { desde, hasta },
      atenciones_por_tipo: atencionesQ.rows,
      total_atenciones: atencionesQ.rows.reduce((a,b)=>a+b.total,0),
      charlas: charlasQ.rows[0] || { total: 0, aulas: 0 },
      derivaciones_por_destino: derivQ.rows,
      incidencias_por_tipo: incQ.rows
    });
  } catch (e) { respuestaError(res, e); }
}
async function crearEvaluacionAnual(req, res) {
  try {
    const { anio, nombre, descripcion, tipo } = req.body;
    if (!anio || !nombre) return res.status(400).json({ error: "anio y nombre son obligatorios" });
    const q = await query(`INSERT INTO evaluaciones_anuales (anio, nombre, descripcion, tipo, creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [anio, nombre, descripcion||null, tipo||'general', req.user.id]);
    res.status(201).json(q.rows[0]);
  } catch (e) { if (String(e.message).includes("duplicate")) return res.status(409).json({ error: "Ya existe una evaluación con ese nombre para ese año" }); respuestaError(res, e); }
}
async function listarEvaluacionesAnuales(req, res) {
  try {
    const { anio } = req.query;
    let where = "";
    const params = [];
    if (anio) { where = "WHERE anio=$1"; params.push(anio); }
    const q = await query(`SELECT e.*, (SELECT COUNT(*)::int FROM evaluacion_anual_respuestas r WHERE r.evaluacion_id=e.id) as respondieron FROM evaluaciones_anuales e ${where} ORDER BY anio DESC, created_at DESC`, params);
    res.json(q.rows);
  } catch (e) { respuestaError(res, e); }
}
async function responderEvaluacionAnual(req, res) {
  try {
    const evaluacionId = Number(req.params.id);
    const estudianteId = Number(req.user.studentId || req.user.estudianteId || req.user.id);
    const { respuestas } = req.body;
    if (!respuestas) return res.status(400).json({ error: "respuestas son obligatorias" });
    const q = await query(`INSERT INTO evaluacion_anual_respuestas (evaluacion_id, estudiante_id, respuestas) VALUES ($1,$2,$3) ON CONFLICT (evaluacion_id, estudiante_id) DO UPDATE SET respuestas=EXCLUDED.respuestas RETURNING *`, [evaluacionId, estudianteId, JSON.stringify(respuestas)]);
    res.json(q.rows[0]);
  } catch (e) { respuestaError(res, e); }
}
async function estadisticasEvaluacionAnual(req, res) {
  try {
    const evaluacionId = Number(req.params.id);
    const evalRes = await query("SELECT * FROM evaluaciones_anuales WHERE id=$1", [evaluacionId]);
    if (!evalRes.rows.length) return res.status(404).json({ error: "Evaluación no encontrada" });
    const respRes = await query("SELECT respuestas FROM evaluacion_anual_respuestas WHERE evaluacion_id=$1", [evaluacionId]);
    const total = respRes.rows.length;
    // Agrupar por pregunta (asumiendo respuestas es {pregunta1: respuesta, ...} o array)
    const porPregunta = {};
    respRes.rows.forEach(r => {
      const resp = r.respuestas;
      if (Array.isArray(resp)) {
        resp.forEach((ans, idx) => {
          const key = `P${idx+1}`;
          porPregunta[key] = porPregunta[key] || {};
          porPregunta[key][ans] = (porPregunta[key][ans]||0)+1;
        });
      } else if (typeof resp === 'object') {
        Object.entries(resp).forEach(([k,v]) => {
          porPregunta[k] = porPregunta[k] || {};
          const val = String(v);
          porPregunta[k][val] = (porPregunta[k][val]||0)+1;
        });
      }
    });
    // Convertir a porcentajes
    const estadisticas = Object.entries(porPregunta).map(([pregunta, counts]) => {
      const totalResp = Object.values(counts).reduce((a,b)=>a+b,0);
      const distribucion = Object.entries(counts).map(([resp, cant]) => ({ respuesta: resp, cantidad: cant, porcentaje: Math.round(cant/totalResp*100) }));
      return { pregunta, distribucion, total: totalResp };
    });
    res.json({ evaluacion: evalRes.rows[0], total_respuestas: total, estadisticas });
  } catch (e) { respuestaError(res, e); }
}

module.exports = {
  obtenerMiPerfil,
  guardarMiPerfil,
  obtenerPerfilEstudiante,
  crearIncidencia,
  listarIncidenciasEstudiante,
  historialEstudiante,
  listarDerivaciones,
  atenderDerivacion,
  crearDerivacionDirecta,
  crearExpedienteFormato,
  listarExpedienteFormatos,
  obtenerExpedienteFormato,
  actualizarExpedienteFormato,
  archivarExpedienteFormato,
  actualizarNEE,
  actualizarEstadoCaso,
  crearCharla,
  listarCharlas,
  generarReporteBimestral,
  crearEvaluacionAnual,
  listarEvaluacionesAnuales,
  responderEvaluacionAnual,
  estadisticasEvaluacionAnual,
  obtenerFichaDiagnostica,
  guardarFichaDiagnostica
};
