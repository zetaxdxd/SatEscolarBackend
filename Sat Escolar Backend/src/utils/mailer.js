// utils/mailer.js - Reutilizado de OmniCash para SAT Escolar
const nodemailer = require("nodemailer");

// ISO 27001 A.8.9/A.5.17: sin secretos en el código. Todo sale de variables
// de entorno (ver Sat Escolar Backend/.env.example). Sin SMTP configurado opera en
// modo demo (log + codigoDemo) y NUNCA usa credenciales quemadas.
function getConfig() {
  const gmailUser = process.env.GMAIL_USER || "";
  const gmailPass = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  const host = process.env.SMTP_HOST || (gmailUser ? "smtp.gmail.com" : "");
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : (host === "smtp.gmail.com" ? 465 : 587);
  const rawPass = process.env.SMTP_PASSWORD || gmailPass || "";
  return {
    smtpHost: host,
    smtpPort: port,
    smtpUser: process.env.SMTP_USER || gmailUser || "",
    smtpPassword: String(rawPass).replace(/\s/g, ""),
    smtpFromEmail: process.env.SMTP_FROM_EMAIL || gmailUser || "",
    emailFrom: process.env.EMAIL_FROM || "SAT Escolar"
  };
}

// Nodemailer v9 resuelve IPv4+IPv6 y elige al azar: en redes sin salida IPv6
// (como Render) cae en ENETUNREACH. Se resuelve solo IPv4 con dns.resolve4
// y se conecta a la IP con SNI al hostname original (certificado válido).
async function resolverIpv4(host) {
  try {
    if (!host || require("net").isIP(host)) return { ip: host, sni: null };
    const ips = await require("dns").promises.resolve4(host);
    if (ips && ips.length) return { ip: ips[Math.floor(Math.random() * ips.length)], sni: host };
  } catch (e) {
    console.warn(`[correo] resolve4 falló para ${host}: ${e.message}; se usa hostname`);
  }
  return { ip: host, sni: null };
}

function esFalloRed(err) {
  return /timeout|ENETUNREACH|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|EPIPE|ESOCKET/i.test(err && err.message || "");
}
// API HTTP de Brevo (puerto 443): funciona aunque el SMTP esté bloqueado.
// Requiere BREVO_API_KEY (empieza con xkeysib-). Sin ella se omite.
async function enviarPorBrevoHttp({ para, asunto, html, nombreRemitente, emailRemitente }) {
  const key = String(process.env.BREVO_API_KEY || "").trim();
  if (!key) return false;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "accept": "application/json", "api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { name: nombreRemitente, email: emailRemitente },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Brevo API ${res.status}: ${txt.slice(0, 160)}`);
  }
  return true;
}

async function crearTransporte(host, port, secure, auth) {
  const { ip, sni } = await resolverIpv4(host);
  const opts = {
    host: ip,
    port,
    secure,
    auth,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  };
  if (!secure) opts.requireTLS = true;
  if (sni) {
    opts.servername = sni;
    opts.tls = { servername: sni, minVersion: "TLSv1.2" };
  }
  if (ip !== host) console.log(`[correo] SMTP ${host}:${port} -> IPv4 ${ip}`);
  return nodemailer.createTransport(opts);
}

async function enviarCorreo({ para, codigo, asunto, texto }) {
  const cfg = getConfig();
  if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPassword) {
    console.warn(`[correo] SMTP no configurado. Para: ${para}`);
    console.warn(`[correo] ${asunto}: ${texto} Codigo: ${codigo}`);
    return;
  }
  const auth = { user: cfg.smtpUser, pass: cfg.smtpPassword };
  // Gmail: si el puerto 465 no responde, se reintenta con 587 STARTTLS y viceversa
  const esGmail = /gmail/i.test(cfg.smtpHost);
  const intentos = [{ host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpPort === 465, tag: "principal" }];
  if (esGmail) {
    intentos.push(cfg.smtpPort === 465
      ? { host: cfg.smtpHost, port: 587, secure: false, tag: "gmail-587" }
      : { host: cfg.smtpHost, port: 465, secure: true, tag: "gmail-465" });
  }
  console.log(`[correo] Enviando a ${para} — ${asunto}`);
  const opciones = {
    from: `"${cfg.emailFrom}" <${cfg.smtpFromEmail}>`,
    to: para,
    subject: asunto,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:#03275f;padding:18px 24px;display:flex;align-items:center;gap:10px">
          <span style="color:#fff;font-size:20px;font-weight:bold">SAT</span>
          <span style="color:#f2b51d;font-size:20px;font-weight:bold">Escolar</span>
        </div>
        <div style="padding:24px">
          <p>Hola,</p>
          <p>${texto}</p>
          <div style="background:#f0f4ff;border:1px dashed #063b91;border-radius:8px;padding:16px;text-align:center;font-size:28px;letter-spacing:6px;font-weight:bold;color:#063b91">${codigo}</div>
          <p style="font-size:12px;color:#888;margin-top:16px">Este código es de un solo uso y expira en 10 minutos. Si no solicitaste esta operación, ignora este correo.</p>
        </div>
      </div>
    `,
  };
  const htmlBody = opciones.html;
  // 1) API HTTP de Brevo primero (no usa puertos SMTP)
  try {
    if (await enviarPorBrevoHttp({ para, asunto, html: htmlBody, nombreRemitente: cfg.emailFrom, emailRemitente: cfg.smtpFromEmail })) {
      console.log(`[correo] Enviado a ${para} (brevo-http)`);
      return;
    }
  } catch (e) {
    console.error(`[correo] Brevo HTTP falló (${para}): ${e.message}`);
  }
  let ultimoError = null;
  for (const it of intentos) {
    try {
      const t = await crearTransporte(it.host, it.port, it.secure, auth);
      await t.sendMail(opciones);
      console.log(`[correo] Enviado a ${para} (${it.tag})`);
      return;
    } catch (e) {
      ultimoError = e;
      console.error(`[correo] Intento ${it.tag} ${it.host}:${it.port} falló (${para}): ${e.message}`);
      if (!esFalloRed(e)) break; // auth/contenido: reintentar no ayuda
    }
  }
  // Respaldo opcional vía variables de entorno (sin credenciales quemadas)
  const bUser = process.env.SMTP_USER_RESPALDO || "";
  const bPass = String(process.env.SMTP_PASSWORD_RESPALDO || "").replace(/\s/g, "");
  const bHost = process.env.SMTP_HOST_RESPALDO || "";
  if (bUser && bPass && bHost) {
    try {
      console.log(`[correo] Intentando respaldo ${bHost}...`);
      const respaldo = await crearTransporte(bHost, process.env.SMTP_PORT_RESPALDO ? Number(process.env.SMTP_PORT_RESPALDO) : 587, false, { user: bUser, pass: bPass });
      await respaldo.sendMail(opciones);
      console.log(`[correo] Enviado por respaldo`);
      return;
    } catch (e2) {
      console.error(`[correo] Respaldo falló: ${e2.message}`);
      ultimoError = e2;
    }
  }
  throw ultimoError;
}

function enviarCodigoVerificacion(para, codigo) {
  return enviarCorreo({
    para,
    codigo,
    asunto: "Tu código de verificación SAT Escolar",
    texto: "Recibimos una solicitud para crear tu cuenta en SAT Escolar. Usa este código para verificar tu correo electrónico:",
  });
}

module.exports = { enviarCorreo, enviarCodigoVerificacion };
