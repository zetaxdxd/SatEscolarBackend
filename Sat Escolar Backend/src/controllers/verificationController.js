// controllers/verificationController.js - Reutilizado de OmniCash para SAT Escolar
// Flujo: solicitar -> envía OTP al correo nuevo -> verificar -> crea usuario
const bcrypt = require("bcryptjs");
const verificationCodeModel = require("../models/postgres/verificationCodeModel");
const pendingRegistrationModel = require("../models/postgres/pendingRegistrationModel");
const adminModel = require("../models/postgres/adminModel");
const { generarCodigoOtp, hashearCodigo, verificarCodigo, codigoVigente, OTP_TTL_MS, OTP_MAX_ATTEMPTS } = require("../utils/otp");
const { enviarCodigoVerificacion } = require("../utils/mailer");
const correoUtil = require("../utils/correoUtil");
const { respuestaError } = require("../utils/respuestaError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REENVIOS = 5;
const REGISTRO_TTL_MS = 10 * 60 * 1000;

function esContrasenaFuerte(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return false;
  return /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw);
}

async function solicitarCodigo(req, res) {
  try {
    const { email, tipo, datos } = req.body;
    const emailNormalizado = String(email || datos?.correo || "").trim().toLowerCase();
    const password = String(datos?.password || "").trim();

    if (!EMAIL_REGEX.test(emailNormalizado)) {
      return res.status(400).json({ error: "Correo electrónico inválido" });
    }
    // Verificación MX (informativa): los dominios escolares sin MX (como los
    // institucionales) no tienen buzón que reciba nada, así que más abajo se
    // entrega el código en pantalla en vez de intentar el envío SMTP.
    let dominioRecibe = true;
    try {
      const dns = require("dns").promises;
      const dominio = emailNormalizado.split("@")[1];
      const mx = await dns.resolveMx(dominio);
      if (!mx || mx.length === 0) {
        dominioRecibe = false;
        console.warn(`[SAT] Sin registros MX para ${dominio}; se entregará código en pantalla`);
      }
    } catch (e) {
      dominioRecibe = false;
      console.warn(`[SAT] No se pudo verificar MX (${e.code || e.message}); se entregará código en pantalla`);
    }
    // Para eliminar notas, el correo es del solicitante (ya existe) - verifica contraseña
    const esEliminar = tipo === 'eliminar_notas' || datos?.tipo === 'eliminar_notas';
    if (!esEliminar) {
      const enUso = await correoUtil.correoEnUso(emailNormalizado);
      if (enUso) {
        return res.status(409).json({ error: `El correo ya está registrado como ${enUso.tipo}` });
      }
      if (!esContrasenaFuerte(password)) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula y número" });
      }
      if (tipo === 'docente' && datos?.esTutor && (!datos.secciones || !Array.isArray(datos.secciones) || datos.secciones.length === 0)) {
        return res.status(400).json({ error: "El docente tutor debe tener al menos un curso/sección asignada. Agrega un curso antes de enviar el código" });
      }
    } else {
      if (!password) return res.status(400).json({ error: "Ingresa tu contraseña para verificar" });
      // Verifica que la contraseña sea correcta para ese correo (solicitante)
      const solicitante = await require("../config/postgres").pool.query(
        `SELECT password_hash FROM usuarios WHERE LOWER(correo)=LOWER($1) UNION ALL SELECT password_hash FROM docentes WHERE LOWER(correo)=LOWER($1) UNION ALL SELECT password_hash FROM estudiantes WHERE LOWER(correo)=LOWER($1) LIMIT 1`,
        [emailNormalizado]
      );
      const hash = solicitante.rows[0]?.password_hash;
      if (!hash || !(await bcrypt.compare(password, hash))) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }
    }
    // Confirma que no haya pendiente vigente (evita spam)
    const pendienteAnterior = await pendingRegistrationModel.findByEmail(emailNormalizado);
    if (pendienteAnterior && new Date(pendienteAnterior.expiresAt) > new Date()) {
      return res.status(409).json({ error: "Ya hay una solicitud pendiente para este correo. Revisa tu bandeja o espera 10 min" });
    }
    // Límite de reenvíos
    const activos = await verificationCodeModel.countActivos(emailNormalizado, 'SAT_VERIFY');
    if (activos >= MAX_REENVIOS) {
      return res.status(429).json({ error: "Has alcanzado el límite de códigos enviados. Espera unos minutos" });
    }
    // Hashea la contraseña con bcrypt (byCrypto) - para eliminar solo guarda contexto
    let datosParaGuardar;
    if (esEliminar) {
      datosParaGuardar = { ...datos, correo: emailNormalizado, tipo };
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      datosParaGuardar = { ...datos, correo: emailNormalizado, passwordHash, tipo, password: undefined };
      delete datosParaGuardar.password;
    }

    // Guarda pendiente
    const expiresAt = new Date(Date.now() + REGISTRO_TTL_MS).toISOString();
    await pendingRegistrationModel.upsert({ email: emailNormalizado, data: datosParaGuardar, expiresAt });

    // Genera OTP (siempre se guarda: el frontend lo verifica igual)
    await verificationCodeModel.invalidarActivos(emailNormalizado, 'SAT_VERIFY');
    const codigo = generarCodigoOtp();
    const { hash, salt } = hashearCodigo(codigo);
    const expira = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await verificationCodeModel.insert({ email: emailNormalizado, purpose: 'SAT_VERIFY', codeHash: `${salt}:${hash}`, expiresAt: expira });
    // Dominio sin buzón (sin MX): no se intenta SMTP, se entrega en pantalla
    if (!dominioRecibe) {
      console.warn(`[SAT] Código en pantalla para ${emailNormalizado} (dominio sin MX)`);
      return res.json({ requiereCodigo: true, correo: emailNormalizado, mensaje: "Este dominio no recibe correos. Usa el código en pantalla para continuar", codigoDemo: codigo });
    }
    try {
      await enviarCodigoVerificacion(emailNormalizado, codigo);
    } catch (eEnvio) {
      // Si el correo no pudo enviarse, limpiar para NO dejar al usuario
      // atrapado 10 min en "ya hay una solicitud pendiente"
      await verificationCodeModel.invalidarActivos(emailNormalizado, 'SAT_VERIFY').catch(() => {});
      await pendingRegistrationModel.eliminar(emailNormalizado).catch(() => {});
      return res.status(502).json({ error: "No se pudo enviar el correo con el código. Verifica que el correo exista e inténtalo de nuevo" });
    }

    // En desarrollo, si SMTP no está configurado, el código se loguea y lo devolvemos para facilitar pruebas
    const smtpConfigurado = !!(process.env.SMTP_USER || process.env.SMTP_PASSWORD || process.env.GMAIL_USER || process.env.GMAIL_APP_PASSWORD);
    const respuesta = { requiereCodigo: true, correo: emailNormalizado, mensaje: "Código enviado al correo. Revisa tu bandeja (y spam)" };
    if (!smtpConfigurado || emailNormalizado.includes("test.") || emailNormalizado.includes("sat.prueba")) {
      console.warn(`[SAT] Código para ${emailNormalizado}: ${codigo} (demo para pruebas)`);
      respuesta.codigoDemo = codigo;
    }
    res.json(respuesta);
  } catch (error) {
    respuestaError(res, error);
  }
}

async function verificarCodigoYCrear(req, res) {
  try {
    const { email, codigo } = req.body;
    const emailNormalizado = String(email || "").trim().toLowerCase();
    const codigoStr = String(codigo || "").trim();

    if (!EMAIL_REGEX.test(emailNormalizado) || !codigoStr) {
      return res.status(400).json({ error: "Correo y código son requeridos" });
    }
    const fila = await verificationCodeModel.findLatest(emailNormalizado, 'SAT_VERIFY');
    if (!codigoVigente(fila)) {
      const msg = fila && fila.attempts >= OTP_MAX_ATTEMPTS
        ? 'Demasiados intentos. Solicita un código nuevo'
        : 'El código expiró o ya fue usado. Solicita uno nuevo';
      return res.status(400).json({ error: msg });
    }
    if (!verificarCodigo(codigoStr, fila.code_hash || fila.codeHash)) {
      await verificationCodeModel.registrarIntento(fila.id);
      return res.status(400).json({ error: "El código ingresado es incorrecto" });
    }
    // Código válido: recupera pendiente
    const pendiente = await pendingRegistrationModel.findByEmail(emailNormalizado);
    if (!pendiente || new Date(pendiente.expiresAt) <= new Date()) {
      return res.status(400).json({ error: "Tu solicitud venció. Vuelve a solicitar el código" });
    }
    const datos = pendiente.data;
    const esEliminar = datos.tipo === 'eliminar_notas' || datos.tipo === 'eliminar_notas';
    // Para eliminar, no verificar duplicado (es el propio usuario)
    if (!esEliminar) {
      const enUso = await correoUtil.correoEnUso(emailNormalizado);
      if (enUso) {
        return res.status(409).json({ error: `El correo ya está registrado como ${enUso.tipo}` });
      }
    } else {
      // Solo verifica que el solicitante existe (para eliminar)
      const existeSolicitante = await correoUtil.correoEnUso(emailNormalizado) || await require("../config/postgres").pool.query("SELECT id FROM usuarios WHERE LOWER(correo)=LOWER($1) UNION SELECT id FROM docentes WHERE LOWER(correo)=LOWER($1)", [emailNormalizado]).then(r=>r.rows[0]);
      if (!existeSolicitante) {
        return res.status(404).json({ error: "El correo no está registrado" });
      }
    }
    // Marca usado e invalida
    await verificationCodeModel.marcarUsado(fila.id);
    await verificationCodeModel.invalidarActivos(emailNormalizado, 'SAT_VERIFY');

    // Para eliminar notas, solo verifica y retorna éxito (el borrado lo hace el endpoint DELETE separado)
    if (esEliminar) {
      await pendingRegistrationModel.eliminar(emailNormalizado);
      return res.json({ verificado: true, mensaje: "Correo verificado para eliminar notas", correo: emailNormalizado });
    }

    // Crea el usuario según tipo
    let resultado;
    if (datos.tipo === 'psicologo' || datos.rol === 'psicologo') {
      const username = String(datos.nombres).split(/\s+/)[0].toLowerCase() + "." + String(datos.apellidos).split(/\s+/)[0].toLowerCase();
      const existente = await require("../config/postgres").pool.query(
        `SELECT id FROM usuarios WHERE LOWER(username)=LOWER($1) OR LOWER(correo)=LOWER($2)`, [username, emailNormalizado]
      );
      if (existente.rows.length > 0) throw new Error("Ya existe un usuario con ese nombre o correo");
      const id = await adminModel.crearPsicologo({
        nombres: datos.nombres, apellidos: datos.apellidos, correo: emailNormalizado,
        username, passwordHash: datos.passwordHash, codigo: datos.codigo || `PSI-${Date.now()}`
      });
      resultado = { id, mensaje: "Psicólogo creado correctamente tras verificar el correo", correo: emailNormalizado };
    } else if (datos.tipo === 'docente') {
      const secciones = datos.secciones || [];
      if (!Array.isArray(secciones) || secciones.length === 0) {
        if (datos.esTutor) {
          return res.status(400).json({ error: "El docente tutor debe tener al menos un curso/sección asignada" });
        }
        const id = await adminModel.crearDocente({
          nombres: datos.nombres, apellidos: datos.apellidos, correo: emailNormalizado,
          passwordHash: datos.passwordHash, esTutor: !!datos.esTutor, secciones: []
        });
        resultado = { id, mensaje: "Docente creado correctamente tras verificar el correo", correo: emailNormalizado };
      } else {
        const id = await adminModel.crearDocente({
          nombres: datos.nombres, apellidos: datos.apellidos, correo: emailNormalizado,
          passwordHash: datos.passwordHash, esTutor: !!datos.esTutor, secciones
        });
        resultado = { id, mensaje: "Docente creado correctamente tras verificar el correo", correo: emailNormalizado };
      }
    } else if (datos.tipo === 'estudiante') {
      // Para estudiante, usamos el modelo de estudiante
      const estudianteModel = require("../models/postgres/estudianteModel");
      // Busca sección por id o crea
      let seccionId = datos.seccionId || datos.seccion_id;
      if (!seccionId && datos.grado && datos.letra) {
        const nivel = ["1ro","2do"].includes(datos.grado) ? "Primaria" : "Secundaria";
        const existente = await require("../config/postgres").pool.query(
          `SELECT id FROM secciones WHERE nivel=$1 AND grado=$2 AND letra=$3`, [nivel, datos.grado, datos.letra]
        );
        if (existente.rows.length > 0) seccionId = existente.rows[0].id;
        else {
          const nueva = await require("../config/postgres").pool.query(
            `INSERT INTO secciones (nivel, grado, letra) VALUES ($1,$2,$3) RETURNING id`, [nivel, datos.grado, datos.letra]
          );
          seccionId = nueva.rows[0].id;
        }
      }
      const nuevo = await estudianteModel.crearEstudiante({
        nombres: datos.nombres, apellidos: datos.apellidos, correo: emailNormalizado,
        passwordHash: datos.passwordHash, seccionId
      });
      resultado = { id: nuevo.id || nuevo, mensaje: "Estudiante creado correctamente tras verificar el correo", correo: emailNormalizado };
    } else {
      return res.status(400).json({ error: "Tipo de registro no reconocido" });
    }

    await pendingRegistrationModel.eliminar(emailNormalizado);
    res.status(201).json(resultado);
  } catch (error) {
    respuestaError(res, error);
  }
}

module.exports = { solicitarCodigo, verificarCodigoYCrear };
