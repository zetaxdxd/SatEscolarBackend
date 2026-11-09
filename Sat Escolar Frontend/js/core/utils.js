// Utilidades puras (sin estado) — SAT Escolar

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function fechaLocalISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}


function inicialesEstudiante(nombres = "", apellidos = "") {
  return `${nombres} ${apellidos}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join("")
    .toUpperCase() || "ES";
}


function claseAsistencia(estado) {
  if (estado === "Asistió") return "is-present";
  if (estado === "Tardanza") return "is-late";
  if (estado === "Faltó") return "is-absent";
  return "is-empty";
}


function conductaParaMotor(valor) {
  if (valor === "B") return "Regular";
  if (valor === "C") return "Mala";
  return "Buena";
}


function claseNivelLogro(codigo) {
  const valor = String(codigo || "").toUpperCase();
  return valor === "AD" ? "destacado" : valor.toLowerCase();
}


function _dimensionCard(titulo, puntaje, peso) {
  const p = puntaje || 0;
  const color = p < 30 ? "#16a34a" : p < 60 ? "#ca8a04" : "#dc2626";
  return `
    <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;">
      <div style="font-weight:600;margin-bottom:6px;">${titulo}</div>
      <div style="font-size:1.4rem;font-weight:800;color:${color};">${p.toFixed(0)}<span style="font-size:0.8rem;font-weight:400;color:#6b7280;">/100</span></div>
      <div style="font-size:0.75rem;color:#9ca3af;">Peso: ${peso}</div>
    </div>`;
}

// ── MODAL SEGUIMIENTO ─────────────────────────────────────────────────────────


function formatearMesAnio(fecha) {
  const date = fecha ? new Date(fecha.replace(" ", "T")) : new Date();
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
}


function formatearFechaLarga(fecha) {
  if (!fecha) return "-";
  const date = new Date(fecha.replace(" ", "T"));
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}


function calcularFechaLimite(fecha) {
  const date = fecha ? new Date(fecha.replace(" ", "T")) : new Date();
  date.setDate(date.getDate() + 7);
  return formatearFechaLarga(date.toISOString());
}


function _renderIncidenteCard(i) {
  return `
    <div class="incident-card">
      <h3>Reportado por: ${i.nombre_estudiante || "Anónimo"}</h3>
      <p><strong>Fecha:</strong> ${i.fecha?.slice(0,16) || ""}</p>
      <p style="margin-top:12px;">${i.descripcion}</p>
      ${i.foto_base64 ? `<div class="foto-preview-container"><img src="${i.foto_base64}" alt="Evidencia fotográfica"></div>` : ""}
    </div>`;
}

// ── SECCIONES / NAVEGACIÓN ────────────────────────────────────────────────────


function cerrarModal(id) { document.getElementById(id)?.classList.add("oculto"); }

function abrirModal(id) { document.getElementById(id)?.classList.remove("oculto"); }

function cerrarModalSiFondo(e, id) { if (e.target === e.currentTarget) cerrarModal(id); }

// ── TEMA ──────────────────────────────────────────────────────────────────────


function cambiarTema() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("temaSAT", document.body.classList.contains("dark-mode") ? "dark" : "light");
  actualizarBotonTema();
}


function cargarTema() {
  if (localStorage.getItem("temaSAT") === "dark") document.body.classList.add("dark-mode");
  else document.body.classList.remove("dark-mode");
  actualizarBotonTema();
}


function actualizarBotonTema() {
  const boton = document.getElementById("btnTema");
  if (boton) boton.innerHTML = document.body.classList.contains("dark-mode")
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}


function claseBadgePorColorRiesgo(color) {
  const mapa = {
    verde: "badge-bajo",
    amarillo: "badge-medio",
    rojo: "badge-alto",
    gris: "badge-medio"
  };
  return mapa[color] || "badge-medio";
}



function _tarjetaDimensionRiesgo(titulo, datosDimension) {
  if (!datosDimension || !datosDimension.disponible) {
    return `
      <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;">
        <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem;">${titulo}</div>
        <div style="font-size:0.8rem;color:#9ca3af;">${escaparHtml(datosDimension?.detalle || "Sin datos")}</div>
      </div>`;
  }
  const p = datosDimension.puntaje || 0;
  const color = p < 40 ? "#dc2626" : p < 70 ? "#ca8a04" : "#16a34a";
  return `
    <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;">
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem;">${titulo}</div>
      <div style="font-size:1.3rem;font-weight:800;color:${color};">${p}<span style="font-size:0.7rem;font-weight:400;color:#6b7280;">/100</span></div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  PANEL DIRECTORA (superusuario)
// ═══════════════════════════════════════════════════════════════


function cargarSidebarUsuario() {
  const user = getUser();
  const nombre = user.fullName || "";
  const correo = user.correo || "";
  const role = user.role || "";

  const titulos = {
    psicologo: "Psicólogo",
    docente: user.esTutor ? "Docente Tutor" : "Docente",
    director: "Director",
    estudiante: "Estudiante"
  };
  const titulo = titulos[role] || role;

  // Buscar elementos del sidebar por los IDs estándar
  const nombreEl = document.getElementById("sidebarUserName");
  const rolEl = document.getElementById("sidebarUserRole");
  const correoEl = document.getElementById("sidebarUserEmail");

  if (nombreEl) nombreEl.textContent = nombre || titulo;
  if (rolEl) rolEl.textContent = titulo;
  if (correoEl) correoEl.textContent = correo;
}

function togglePassword(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

function alternarPassword(button) {
  // Usado en login y en director/docente: busca el input hermano dentro del mismo eye-wrap/input-group
  const wrap = button.closest(".eye-wrap") || button.closest(".input-group") || button.parentElement;
  const input = wrap ? wrap.querySelector("input[type='password'], input[type='text']") : null;
  if (!input) return;
  const mostrar = input.type === "password";
  input.type = mostrar ? "text" : "password";
  button.setAttribute("aria-label", mostrar ? "Ocultar contraseña" : "Mostrar contraseña");
}

function validarPautasPassword(inputId, pautasId) {
  const input = document.getElementById(inputId);
  const pautasEl = document.getElementById(pautasId);
  if (!input || !pautasEl) return;
  const val = input.value;
  const checks = [
    { ok: val.length >= 8, text: "Mínimo 8 caracteres" },
    { ok: /[A-Z]/.test(val), text: "Una mayúscula" },
    { ok: /[a-z]/.test(val), text: "Una minúscula" },
    { ok: /\d/.test(val), text: "Un número" },
  ];
  pautasEl.innerHTML = checks.map(c => `<span class="${c.ok ? 'ok' : 'fail'}">${c.ok ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;vertical-align:-1px;"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;vertical-align:-1px;"><circle cx="12" cy="12" r="10"/></svg>'} ${c.text}</span>`).join("");
}

function contrasenasCoinciden(id1, id2) {
  const a = document.getElementById(id1)?.value || "";
  const b = document.getElementById(id2)?.value || "";
  return a && a === b;
}

// ── TOAST + CONFIRM PROFESIONALES (reemplazan burbuja nativa en TODO el sistema) ──
function asegurarToastContainer(){
  let c=document.getElementById("toastContainer");
  if(c) return c;
  c=document.createElement("div");
  c.id="toastContainer";
  c.style.cssText="position:fixed; top:18px; right:18px; z-index:10000; display:flex; flex-direction:column; gap:8px; pointer-events:none;";
  document.body.appendChild(c);
  return c;
}
function mostrarToastGlobal(msg, tipo="ok"){
  try{
    const c=asegurarToastContainer();
    const bg = tipo==="error" ? "#fef2f2" : tipo==="warn" ? "#fffbeb" : "#ecfdf5";
    const bd = tipo==="error" ? "#fecaca" : tipo==="warn" ? "#fde68a" : "#a7f3d0";
    const col= tipo==="error" ? "#b91c1c" : tipo==="warn" ? "#92400e" : "#065f46";
    const icon= tipo==="error" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' : tipo==="warn" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><path d="M20 6L9 17l-5-5"/></svg>';
    const el=document.createElement("div");
    el.style.cssText=`pointer-events:auto; background:${bg}; border:1px solid ${bd}; color:${col}; padding:12px 16px; border-radius:12px; font-size:13px; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,.12); display:flex; align-items:center; gap:10px; min-width:260px; max-width:360px;`;
    el.innerHTML=`<span style="width:26px;height:26px;border-radius:50%;background:${col};color:white;display:grid;place-items:center;font-size:12px;flex-shrink:0;">${icon}</span><span style="flex:1;">${escaparHtml(String(msg))}</span>`;
    c.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(-6px)"; el.style.transition=".25s"; setTimeout(()=>el.remove(),260); }, 3200);
  }catch(_){ console.log(msg); }
}
// Parche no-bloqueante: alert -> toast profesional (todas las páginas que cargan utils.js)
(function(){
  const _origAlert = window.alert;
  window.alert = function(msg){
    try{ mostrarToastGlobal(String(msg), String(msg).toLowerCase().includes("error") ? "error" : "ok"); }catch(_){ _origAlert(String(msg)); }
  };
})();

// ── RESPONSIVE: Drawer para teléfono (<768px) ──
(function(){
  function asegurarToggle(){
    if(document.querySelector('.sidebar-toggle')) return;
    const sb = document.querySelector('.app-sidebar, .sidebar');
    if(!sb) return;
    const btn = document.createElement('button');
    btn.className = 'sidebar-toggle';
    btn.setAttribute('aria-label','Menú');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    btn.onclick = () => document.body.classList.toggle('sidebar-open');
    document.body.prepend(btn);
  }
  document.addEventListener('DOMContentLoaded', asegurarToggle);
  // Cerrar al tocar fuera o navegar
  document.addEventListener('click', (e)=>{
    if(window.innerWidth>768 || !document.body.classList.contains('sidebar-open')) return;
    const sb=document.querySelector('.app-sidebar, .sidebar');
    const tg=document.querySelector('.sidebar-toggle');
    if(sb && !sb.contains(e.target) && tg && !tg.contains(e.target)){
      document.body.classList.remove('sidebar-open');
    }
  });
  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('.sidebar-nav a, .sidebar-logout a, .sidebar-nav a.active').forEach(a=>{
      a.addEventListener('click', ()=> document.body.classList.remove('sidebar-open'));
    });
  });
})();

// Validación de contraseña fuerte — compartida (antes solo existía en admin.js
// y el panel del docente tutor fallaba en silencio al crear alumnos).
// Retorna null si es válida, o el mensaje de error.
function validarPasswordFuerte(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(pw)) return "Debe contener al menos una letra mayúscula.";
  if (!/[a-z]/.test(pw)) return "Debe contener al menos una letra minúscula.";
  if (!/[0-9]/.test(pw)) return "Debe contener al menos un número.";
  return null;
}

