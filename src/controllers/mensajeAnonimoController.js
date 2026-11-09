// controllers/mensajeAnonimoController.js
// Chat anónimo: estudiantes y docentes escriben al psicólogo; el psicólogo
// responde. La eliminación de mensajes/chat exige contraseña + código OTP.

const bcrypt = require("bcryptjs");
const mensajeModel = require("../models/postgres/mensajeAnonimoModel");
const docenteModel = require("../models/postgres/docenteModel");
const estudianteModel = require("../models/postgres/estudianteModel");
const otpService = require("../services/otpService");
const { respuestaError } = require("../utils/respuestaError");

function participanteDeToken(req) {
  if (req.user.role === "estudiante") {
    return { tipo: "estudiante", participanteId: req.user.studentId, correo: req.user.correo };
  }
  if (req.user.role === "docente") {
    return { tipo: "docente", participanteId: req.user.id, correo: req.user.email || req.user.username };
  }
  return null;
}

async function verificarContrasenaParticipante({ tipo, participanteId, correo, contrasena }) {
  if (tipo === "estudiante") {
    const esperada = String(correo || "").split("@")[0];
    return contrasena === esperada;
  }
  const docente = await docenteModel.obtenerDocentePorUserId(participanteId, correo);
  if (!docente?.password_hash) return false;
  return bcrypt.compare(contrasena, docente.password_hash);
}

async function enviarMensaje(req, res) {
  try {
    const participante = participanteDeToken(req);
    if (!participante) return res.status(403).json({ error: "Solo estudiantes y docentes pueden enviar mensajes" });

    const contenido = String(req.body.contenido || "").trim();
    if (!contenido) return res.status(400).json({ error: "contenido requerido" });
    if (contenido.length > 3000) return res.status(400).json({ error: "El mensaje no debe superar 3000 caracteres" });

    let seccionId = req.user.seccionId || null;
    if (participante.tipo === "docente") {
      const secciones = await docenteModel.listarSeccionesDeDocente(
        participante.participanteId,
        participante.correo
      );
      seccionId = secciones[0]?.seccion_id || null;
    }

    const mensaje = await mensajeModel.crearMensaje({
      remitenteTipo: participante.tipo,
      estudianteId: participante.tipo === "estudiante" ? participante.participanteId : null,
      docenteId: participante.tipo === "docente" ? participante.participanteId : null,
      seccionId,
      contenido
    });

    res.status(201).json({ mensaje, mensaje_texto: "Mensaje enviado de forma anónima al psicólogo" });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function misMensajes(req, res) {
  try {
    const participante = participanteDeToken(req);
    if (!participante) return res.status(403).json({ error: "No autorizado" });

    const mensajes = await mensajeModel.listarMensajesPropios({
      tipo: participante.tipo,
      participanteId: participante.participanteId
    });

    res.json({
      tipo: participante.tipo,
      mensajes: mensajes.map(m => ({
        id: m.id,
        remitente: m.remitente_tipo === "psicologo" ? "psicólogo" : "tú",
        contenido: m.contenido,
        creado_en: m.creado_en
      }))
    });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function solicitarEliminarMensaje(req, res) {
  try {
    const participante = participanteDeToken(req);
    if (!participante) return res.status(403).json({ error: "No autorizado" });

    const mensajeId = Number(req.params.id);
    const contrasena = String(req.body.contrasena || "");
    if (!mensajeId || !contrasena) {
      return res.status(400).json({ error: "mensaje y contraseña requeridos" });
    }

    const ok = await verificarContrasenaParticipante({ ...participante, contrasena });
    if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });

    const destino = participante.correo;
    if (!destino || !String(destino).includes("@")) {
      return res.status(400).json({ error: "El usuario no tiene un correo registrado" });
    }

    const resultado = await otpService.crearYEnviarCodigo({
      destino,
      proposito: otpService.PROPOSITO_BORRAR_MENSAJE
    });

    res.json({
      mensaje: "Te enviamos un código de verificación a tu correo",
      enviado_a: resultado.enmascarado,
      modo: resultado.modo,
      codigo_dev: resultado.codigoDev,
      paso: "confirmar"
    });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function confirmarEliminarMensaje(req, res) {
  try {
    const participante = participanteDeToken(req);
    if (!participante) return res.status(403).json({ error: "No autorizado" });

    const mensajeId = Number(req.params.id);
    const codigo = String(req.body.codigo || "").trim();
    if (!mensajeId || !codigo) {
      return res.status(400).json({ error: "mensaje y código requeridos" });
    }

    const verificacion = await otpService.verificarCodigo({
      destino: participante.correo,
      proposito: otpService.PROPOSITO_BORRAR_MENSAJE,
      codigo
    });
    if (!verificacion.valido) return res.status(401).json({ error: verificacion.motivo });

    const eliminado = await mensajeModel.eliminarMensaje({
      mensajeId,
      remitenteTipo: participante.tipo,
      participanteId: participante.participanteId
    });
    if (!eliminado) return res.status(404).json({ error: "Mensaje no encontrado o no es tuyo" });

    res.json({ ok: true, mensaje: "Mensaje eliminado correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function solicitarBorrarChat(req, res) {
  try {
    const participante = participanteDeToken(req);
    if (!participante) return res.status(403).json({ error: "No autorizado" });

    const contrasena = String(req.body.contrasena || "");
    if (!contrasena) return res.status(400).json({ error: "Contraseña requerida" });

    const ok = await verificarContrasenaParticipante({ ...participante, contrasena });
    if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });

    const resultado = await otpService.crearYEnviarCodigo({
      destino: participante.correo,
      proposito: otpService.PROPOSITO_BORRAR_MENSAJE
    });

    res.json({
      mensaje: "Te enviamos un código de verificación a tu correo",
      enviado_a: resultado.enmascarado,
      modo: resultado.modo,
      codigo_dev: resultado.codigoDev,
      paso: "confirmar"
    });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function confirmarBorrarChat(req, res) {
  try {
    const participante = participanteDeToken(req);
    if (!participante) return res.status(403).json({ error: "No autorizado" });

    const codigo = String(req.body.codigo || "").trim();
    if (!codigo) return res.status(400).json({ error: "Código requerido" });

    const verificacion = await otpService.verificarCodigo({
      destino: participante.correo,
      proposito: otpService.PROPOSITO_BORRAR_MENSAJE,
      codigo
    });
    if (!verificacion.valido) return res.status(401).json({ error: verificacion.motivo });

    const eliminados = await mensajeModel.eliminarTodoChat({
      remitenteTipo: participante.tipo,
      participanteId: participante.participanteId
    });

    res.json({ ok: true, total_eliminados: eliminados.length, mensaje: "Chat eliminado correctamente" });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function listarMensajesPsicologo(req, res) {
  try {
    if (req.user.role !== "psicologo") {
      return res.status(403).json({ error: "Solo Psicología puede ver el chat anónimo" });
    }
    const conversaciones = await mensajeModel.listarConversacionesPsicologo();
    res.json({ conversaciones });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function verConversacionPsicologo(req, res) {
  try {
    if (req.user.role !== "psicologo") {
      return res.status(403).json({ error: "Solo Psicología puede ver el chat anónimo" });
    }
    const tipo = req.params.tipo === "docente" ? "docente" : "estudiante";
    const participanteId = Number(req.params.id);
    if (!participanteId) return res.status(400).json({ error: "id de participante requerido" });

    await mensajeModel.marcarConversacionLeida({ tipo, participanteId });
    const mensajes = await mensajeModel.listarMensajesConversacion({ tipo, participanteId });
    res.json({
      tipo,
      etiqueta: tipo === "docente" ? "Docente anónimo" : "Estudiante anónimo",
      mensajes: mensajes.map(m => ({
        id: m.id,
        remitente: m.remitente_tipo === "psicologo" ? "psicólogo" : "remitente anónimo",
        contenido: m.contenido,
        creado_en: m.creado_en
      }))
    });
  } catch (error) {
    respuestaError(res, error);
  }
}

async function responderConversacion(req, res) {
  try {
    if (req.user.role !== "psicologo") {
      return res.status(403).json({ error: "Solo Psicología puede responder el chat anónimo" });
    }
    const tipo = req.params.tipo === "docente" ? "docente" : "estudiante";
    const participanteId = Number(req.params.id);
    const contenido = String(req.body.contenido || "").trim();
    if (!participanteId) return res.status(400).json({ error: "id de participante requerido" });
    if (!contenido) return res.status(400).json({ error: "contenido requerido" });

    const mensaje = await mensajeModel.crearMensaje({
      remitenteTipo: "psicologo",
      estudianteId: tipo === "estudiante" ? participanteId : null,
      docenteId: tipo === "docente" ? participanteId : null,
      psicologoId: req.user.id,
      seccionId: req.body.seccionId || null,
      contenido
    });

    res.status(201).json({ mensaje, mensaje_texto: "Respuesta enviada al remitente anónimo" });
  } catch (error) {
    respuestaError(res, error);
  }
}

module.exports = {
  enviarMensaje,
  misMensajes,
  solicitarEliminarMensaje,
  confirmarEliminarMensaje,
  solicitarBorrarChat,
  confirmarBorrarChat,
  listarMensajesPsicologo,
  verConversacionPsicologo,
  responderConversacion
};