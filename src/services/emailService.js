// services/emailService.js
// Envío de correos. Si no hay SMTP configurado (EMAIL_HOST), simula el envío
// mostrando el contenido en la consola para poder probar el flujo completo.

const nodemailer = require("nodemailer");

let transporter = null;
const host = process.env.EMAIL_HOST;
if (host) {
  try {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } catch (error) {
    console.warn("No se pudo inicializar el transporte de correo:", error.message);
  }
}

async function enviarCorreo({ para, asunto, texto }) {
  if (!transporter) {
    console.log(`[EMAIL-SIMULADO] Para: ${para} | Asunto: ${asunto} | ${texto}`);
    return { enviado: false, modo: "dev" };
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: para,
    subject: asunto,
    text: texto
  });
  return { enviado: true, modo: "email" };
}

module.exports = { enviarCorreo };