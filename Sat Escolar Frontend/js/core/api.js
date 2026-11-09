// Núcleo: API, sesión y verificación de correos — SAT Escolar

const API = window.SAT_API_URL || "/api";

function getToken() { return localStorage.getItem("sat_token"); }

function getUser()  { return JSON.parse(localStorage.getItem("sat_user") || "{}"); }


async function apiFetch(path, options = {}) {
  const token = getToken();
  const isFormData = options.isFormData;
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = "Bearer " + token;
  if (options.headers) Object.assign(headers, options.headers);
  const res = await fetch(API + path, {
    ...options,
    headers,
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined
  });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) data = await res.json();
    else {
      const txt = await res.text();
      try { data = JSON.parse(txt); } catch (_) { data = { error: txt.slice(0, 400) || `Error ${res.status}` }; }
    }
  } catch (_) {
    const txt = await res.text().catch(() => "");
    data = { error: txt.slice(0, 400) || `Error ${res.status}` };
  }
  if (res.status === 401) {
    localStorage.removeItem("sat_token");
    localStorage.removeItem("sat_user");
    throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status} en la solicitud`);
  return data;
}

// ── AUTENTICACIÓN ─────────────────────────────────────────────────────────────


async function iniciarSesion() {
  const usuario  = document.getElementById("usuario").value.trim();
  const password = document.getElementById("password").value.trim();
  const mensaje  = document.getElementById("mensajeLogin");

  if (!usuario || !password) { mensaje.textContent = "Completa usuario y contraseña."; return; }

  // Verificación interna: el correo debe existir en el sistema antes de continuar.
  try {
    const resCorreo = await fetch(API + "/auth/verificar-correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: usuario })
    });
    const datosCorreo = await resCorreo.json();
    if (!resCorreo.ok) {
      mensaje.textContent = datosCorreo.error || "No se pudo verificar el correo.";
      return;
    }
    if (!datosCorreo.existe) {
      mensaje.textContent = "El correo no está registrado en el sistema. Revisa que esté bien escrito.";
      return;
    }
  } catch (e) {
    // Si la verificación falla por conexión, dejamos que el login reporte el error.
  }

  try {
    const res = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usuario, password })
    });
    const data = await res.json();
    if (!res.ok) {
      mensaje.textContent = data.error || "No se pudo iniciar sesión.";
      return;
    }
    localStorage.setItem("sat_token", data.token);
    localStorage.setItem("sat_user", JSON.stringify({
      id: data.id,
      role: data.role,
      fullName: data.fullName,
      studentId: data.studentId,
      seccionId: data.seccionId,
      nivel: data.nivel,
      grado: data.grado,
      seccion: data.seccion,
      correo: data.correo || data.email,
      email: data.email || data.correo,
      esTutor: data.esTutor
    }));

    const destinos = { docente: "pages/docente.html", psicologo: "pages/psicologa.html", estudiante: "pages/estudiante.html", director: "pages/director.html" };
    window.location.href = destinos[data.role] || "index.html";
  } catch (e) {
    mensaje.textContent = e.message === "Failed to fetch" || e.name === "TypeError"
      ? "No se pudo conectar con el servidor. Verifica que el backend esté encendido."
      : (e.message || "No se pudo iniciar sesión.");
  }
}


function validarAcceso(rolPermitido) {
  const user = getUser();
  // Mapear "psicologa" del HTML al rol "psicologo" de la BD
  const rolNormalizado = rolPermitido === "psicologa" ? "psicologo" : rolPermitido;
  if (!user.role || user.role !== rolNormalizado) {
    alert("Acceso no autorizado.");
    window.location.href = "../index.html";
  }
}


function cerrarSesion() {
  localStorage.removeItem("sat_token");
  localStorage.removeItem("sat_user");
  window.location.href = "../index.html";
}

// ── PANEL DOCENTE ─────────────────────────────────────────────────────────────


async function verificarCorreoEnCreacion(correoInputId, msgElId) {
  const input = document.getElementById(correoInputId);
  const msgEl = document.getElementById(msgElId);
  const correo = (input?.value || "").trim();
  if (!correo) {
    if (msgEl) { msgEl.className = "msg-err"; msgEl.textContent = ""; }
    return false;
  }
  try {
    const res = await fetch(API + "/auth/verificar-correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo })
    });
    const data = await res.json();
    if (!res.ok) {
      if (msgEl) { msgEl.className = "msg-err"; msgEl.textContent = data.error || "Correo no válido."; }
      return false;
    }
    if (data.existe) {
      if (msgEl) {
        msgEl.className = "msg-err";
        msgEl.textContent = `El correo ya está registrado (${data.rol}). Revisa que esté bien escrito o usa otro.`;
      }
      return false;
    }
    if (msgEl) { msgEl.className = "msg-ok"; msgEl.textContent = "Correo disponible."; }
    return true;
  } catch (e) {
    if (msgEl) { msgEl.className = "msg-err"; msgEl.textContent = "No se pudo verificar el correo. Intenta de nuevo."; }
    return false;
  }
}

