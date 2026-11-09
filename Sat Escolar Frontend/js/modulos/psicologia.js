// Psicologia: formularios, riesgo, alertas, seguimiento, analitica y chat — SAT Escolar

let _psFormularioPuntajesActual = null;
let _psSeccionesDisponibles = [];
let _psTodasRespuestasCache = [];
let _psPreguntaIndex = 0;
let _psDashboardCache = null;
let _psSeccionesCache = [];
let _psEstudiantesCache = null;
let _prediccionActual = null;
let _prediccionNombreEstudiante = "";
let _historialCache = [];
let _historial15Abierto = false;
let _historial30Abierto = false;
let _alertasCache = [];
let _alertas15Abierto = false;
let _alertas30Abierto = false;

const GRADOS_SECUNDARIA = ["3ro", "4to", "5to"];
const GRADO_COLORS = {
  "1ro": "#2563eb", "2do": "#7c3aed", "3ro": "#059669",
  "4to": "#d97706", "5to": "#dc2626", "6to": "#0891b2"
};
const GRADO_NIVEL = {
  "1ro": "Primaria", "2do": "Primaria",
  "3ro": "Secundaria", "4to": "Secundaria", "5to": "Secundaria"
};
const GRADO_GRADIENTS = {
  "1ro": "linear-gradient(110deg, #063b91, #1253a5)",
  "2do": "linear-gradient(110deg, #063b91, #1253a5)",
  "3ro": "linear-gradient(110deg, #063b91, #1253a5)",
  "4to": "linear-gradient(110deg, #063b91, #1253a5)",
  "5to": "linear-gradient(110deg, #063b91, #1253a5)",
  "6to": "linear-gradient(110deg, #063b91, #1253a5)"
};

// ── UTILIDADES API ─────────────────────────────────────────────────────────────

function cargarSidebarPsicologa() {
  const user = getUser();
  const nombre = user.fullName || "Psicologo";
  const role = user.role || "psicologo";
  const profileName = document.getElementById("psProfileName");
  const profileRole = document.getElementById("psProfileRole");
  if (profileName) profileName.textContent = nombre;
  if (profileRole) profileRole.textContent = role.toUpperCase();
}

async function cargarPanelPsicologa() {
  cargarSidebarPsicologa();
  try {
    const [dashboard, formularios, alertas, chat] = await Promise.all([
      apiFetch("/postgres/psicologia/dashboard"),
      apiFetch("/postgres/formularios-psicologicos").catch(() => []),
      apiFetch("/postgres/psicologia/alertas").catch(() => ({ alertas: [], pendientes: 0 })),
      apiFetch("/postgres/psicologia/mensajes").catch(() => [])
    ]);
    _psDashboardCache = dashboard;
    renderizarDashboardInicio(dashboard);
    renderizarGradosPsRespuestas(dashboard.secciones || []);
    cargarFormulariosPsicologicos();
    cargarGradosFormulario();
    cargarAlertasPsicologa(alertas);
    cargarChatPsicologa(chat);
    actualizarBadgeIncidentes();
    actualizarPanelDerecho(dashboard, alertas);
  } catch (e) {
    console.error("Error cargando panel psicologa:", e);
  }
}

function isAlertaSnoozed(alertaId) {
  const ts = localStorage.getItem('alerta_snoozed_' + alertaId);
  if (!ts) return false;
  const diff = Date.now() - parseInt(ts, 10);
  if (diff > 2 * 24 * 60 * 60 * 1000) { localStorage.removeItem('alerta_snoozed_' + alertaId); return false; }
  return true;
}
async function actualizarPanelDerecho(dashboard, alertas) {
  const secciones = dashboard.secciones || [];
  const alertasRaw = alertas?.alertas || [];
  const alertasList = alertasRaw.filter(a => !isAlertaSnoozed(a.id));

  const sessionEl = document.getElementById("psRightSession");
  if (sessionEl) {
    try {
      const hoy = await apiFetch("/postgres/psicologia/sesiones-hoy").catch(() => null);
      const sesiones = hoy?.sesiones || [];
      if (sesiones.length > 0) {
        sessionEl.innerHTML = `
          <div style="font-size:10.5px; color:var(--gris); margin-bottom:8px;">${escaparHtml(hoy.dia || '')} &middot; Tutoria de hoy</div>
          ${sesiones.map(s => `
            <div class="session">
              <strong>${escaparHtml(s.nombre || `${s.grado} ${s.letra}`)}</strong>
              <span>Tutor: ${escaparHtml(s.tutor_nombres || '')} ${escaparHtml(s.tutor_apellidos || '')} &middot; ${s.total_estudiantes} estudiante(s)</span>
            </div>
          `).join('')}
        `;
      } else {
        sessionEl.innerHTML = `
          <div class="empty">
            <div class="empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
            <strong>Hoy no hay tutoria</strong>
            <p>${hoy?.dia || ''}: sin sesiones programadas</p>
          </div>
        `;
      }
    } catch (_) {
      const secciones = dashboard.secciones || [];
      if (secciones.length > 0) {
        const gradoCount = {};
        secciones.forEach(s => { gradoCount[s.grado] = (gradoCount[s.grado] || 0) + 1; });
        const gradosStr = Object.entries(gradoCount).map(([g, c]) => `${g} (${c} secc.)`).join(", ");
        sessionEl.innerHTML = `
          <div class="session">
            <strong>${secciones.length} secciones con tutor</strong>
            <span>${gradosStr}</span>
          </div>
        `;
      }
    }
  }

  const alertasEl = document.getElementById("psRightAlertas");
  if (alertasEl) {
    if (alertasList.length > 0) {
      alertasEl.innerHTML = `<div style="max-height:360px; overflow-y:auto; overscroll-behavior:contain; padding-right:4px; display:grid; gap:8px; scrollbar-width:thin;">` + alertasList.map(a => {
        const nivel = a.nivel_riesgo || a.nivel || "Medio";
        const cls = nivel.includes("Alto") || nivel === "Alto riesgo" ? "alto" : "medio";
        let primerMotivo = a.mensaje || '';
        try {
          let ms = [];
          if (Array.isArray(a.motivos)) ms = a.motivos;
          else if (typeof a.motivos === 'string') ms = JSON.parse(a.motivos);
          if (ms.length > 0) primerMotivo = `${a.tipo ? a.tipo + ': ' : ''}` + String(ms[0]);
        } catch (_) {}
        return `
          <div class="pending-item" style="border-left:3px solid ${cls === 'alto' ? '#d4483f' : '#f2b51d'}; cursor:pointer;" onclick="handlePendienteClick(this, ${a.id})" title="Ver alertas (estáticas hasta intervención)">
            <div class="pending-icon" style="background:${cls === 'alto' ? '#fdeceb' : '#fef3c7'};color:${cls === 'alto' ? '#b91c1c' : '#92400e'};">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
            </div>
            <div class="pending-text">
              <strong>${escaparHtml(`${a.nombres || ''} ${a.apellidos || ''}`.trim() || a.estudiante_nombre || 'Estudiante')}</strong>
              <span>${escaparHtml(primerMotivo)}</span>
            </div>
          </div>
        `;
      }).join("") + `</div><div style="font-size:11px; color:#6b7280; text-align:center; margin-top:6px;">${alertasList.length} alerta${alertasList.length!==1?'s':''} pendiente${alertasList.length!==1?'s':''} · desplázate para ver todas</div>`;
    } else {
      alertasEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">&#9650;</div>
          <strong>Sin alertas registradas</strong>
          <p>Apareceran aqui al activarse el sistema</p>
        </div>
      `;
    }
  }
}

function mostrarSeccionPsicologa(idSeccion, navItem) {
  document.querySelectorAll(".seccion-psicologa").forEach(s => s.classList.add("oculto"));
  const sec = document.getElementById(idSeccion);
  if (sec) sec.classList.remove("oculto");

  document.querySelectorAll(".menu-item").forEach(item => item.classList.remove("active"));
  if (navItem) {
    navItem.classList.add("active");
  } else {
    document.querySelectorAll(".menu-item").forEach(item => {
      const onclick = item.getAttribute("onclick") || "";
      if (onclick.includes(idSeccion)) item.classList.add("active");
    });
  }

  const titulos = {
    "ps-inicio": "Panel Psicopedagogico",
    "ps-respuestas": "Respuestas",
    "ps-formularios": "Formularios",
    "ps-tests-validados": "Tests Validados",
    "ps-alertas": "Alertas de riesgo",
    "ps-chat": "Chat anonimo",
    "ps-seguimiento": "Seguimiento",
    "ps-predicciones": "Predicciones IA",
    "ps-derivaciones": "Derivaciones",
    "ps-expediente": "Expediente",
    "ps-documentacion": "Documentación",
    "ps-incidencias": "Incidencias"
  };
  const topTitle = document.getElementById("psTopbarTitle");
  if (topTitle) topTitle.textContent = titulos[idSeccion] || "Panel Psicopedagogico";

  if (idSeccion === "ps-seguimiento") cargarSeguimiento();
  if (idSeccion === "ps-formularios") cargarGradosFormulario();
  if (idSeccion === "ps-tests-validados") cargarTestsValidados();
  if (idSeccion === "ps-predicciones") cargarPredicciones();
  if (idSeccion === "ps-documentacion" && typeof cargarDocumentacion === "function") cargarDocumentacion();
}

function irAAlertas() {
  mostrarSeccionPsicologa("ps-alertas");
  cargarAlertasPsicologa();
}
function handlePendienteClick(el, alertaId) {
  localStorage.setItem('alerta_snoozed_' + alertaId, Date.now().toString());
  el.style.transition="opacity .2s, transform .2s"; el.style.opacity="0"; el.style.transform="translateX(12px)";
  setTimeout(()=>{
    el.remove();
    const cont=document.getElementById("psRightAlertas");
    if(cont && !cont.querySelector(".pending-item")){
      cont.innerHTML=`<div class="empty"><div class="empty-icon">&#9650;</div><strong>Sin alertas registradas</strong><p>Apareceran aqui al activarse el sistema</p></div>`;
    }
    irAAlertas();
    setTimeout(()=>{
      const card=document.querySelector(`#alertasPsicologaLista [data-alerta-id="${alertaId}"]`);
      if(card){ card.scrollIntoView({behavior:"smooth", block:"center"}); card.style.outline="2px solid #0d63d8"; card.style.outlineOffset="2px"; setTimeout(()=>card.style.outline="none",2000); }
    }, 300);
  },180);
}

// ── INICIO: DASHBOARD CON GRADOS ──────────────────────────────────────────────

function renderizarDashboardInicio(dashboard) {
  const container = document.getElementById("psInicioContainer");
  if (!container) return;
  const secciones = dashboard.secciones || [];
  const totalEstudiantes = dashboard.totalEstudiantes || 0;
  const totalFormularios = dashboard.totalFormularios || 0;
  const totalAlertas = dashboard.totalAlertas || 0;
  const totalSecciones = dashboard.totalSecciones || 0;
  const nombre = (getUser().fullName || "Psicologo");

  const gradosMap = {};
  secciones.forEach(s => {
    if (!gradosMap[s.grado]) gradosMap[s.grado] = { grado: s.grado, nivel: s.nivel, secciones: [], total: 0 };
    gradosMap[s.grado].secciones.push(s);
    gradosMap[s.grado].total++;
  });

  const grados = Object.values(gradosMap).sort((a, b) => {
    const order = { "1ro": 1, "2do": 2, "3ro": 3, "4to": 4, "5to": 5, "6to": 6 };
    return (order[a.grado] || 99) - (order[b.grado] || 99);
  });

  container.innerHTML = `
    <div class="stats">
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-label">Estudiantes</div>
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        </div>
        <div class="stat-value">${totalEstudiantes}</div>
        <div class="stat-sub">En ${totalSecciones} secciones</div>
      </div>
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-label">Formularios</div>
          <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
        </div>
        <div class="stat-value">${totalFormularios}</div>
        <div class="stat-sub">Cuestionarios activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-label">Alertas</div>
          <div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg></div>
        </div>
        <div class="stat-value" style="color:${totalAlertas > 0 ? 'var(--warn)' : 'var(--ok)'};">${totalAlertas}</div>
        <div class="stat-sub">Pendientes</div>
      </div>
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-label">Secciones</div>
          <div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></div>
        </div>
        <div class="stat-value">${totalSecciones}</div>
        <div class="stat-sub">Activas con tutor</div>
      </div>
    </div>

    <div class="section-head"><h2>Grados</h2></div>
    <div class="grades">
      ${grados.map(g => `
        <div class="grade" onclick="navegarSeccionesPsInicio('${g.grado}')">
          <div class="grade-header">
            <span class="badge-grade">${g.nivel}</span>
            <span class="grade-number">${g.grado}</span>
          </div>
          <div class="card-body">
            <h2 class="title">${g.grado} - ${g.nivel}</h2>
            <p class="subtitle">${g.secciones.length} seccion${g.secciones.length !== 1 ? 'es' : ''}</p>
            <div class="card-footer">
              <div class="info-item">
                <svg class="icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>${g.total} estudiantes</span>
              </div>
              <div class="info-item">
                <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>${g.secciones.length} seccion${g.secciones.length !== 1 ? 'es' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      `).join("")}
      ${grados.length === 0 ? `
        <div class="card" style="padding:40px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <p style="color:#6b7280; font-size:13px;">No hay secciones con tutor asignado. Cree desde el panel del director.</p>
        </div>
      ` : ''}
    </div>
  `;
}

async function navegarSeccionesPsInicio(grado) {
  const container = document.getElementById("psInicioContainer");
  if (!container || !_psDashboardCache) return;
  const secciones = (_psDashboardCache.secciones || []).filter(s => s.grado === grado);

  container.innerHTML = `
    <div class="section-head"><h2><span style="cursor:pointer;color:var(--accent);" onclick="renderizarDashboardInicio(_psDashboardCache)">Inicio</span> &rsaquo; ${grado}</h2></div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px;">
      ${secciones.map(s => `
        <div class="card" style="padding:18px; cursor:pointer;" onclick="navegarEstudiantesPsInicio(${s.id}, '${escaparHtml(grado + ' ' + s.letra)}')">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <div style="width:40px; height:40px; border-radius:10px; background:${GRADO_GRADIENTS[grado] || GRADO_GRADIENTS['3ro']}; display:grid; place-items:center; color:#fff; font-weight:800; font-size:13px; flex-shrink:0;">${s.grado} ${s.letra}</div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--ink);">${s.grado} ${s.letra}</div>
              <div style="font-size:11.5px; color:var(--ink-soft);">Tutor: ${escaparHtml(s.tutor_nombres || '')} ${escaparHtml(s.tutor_apellidos || '')}</div>
            </div>
          </div>
        </div>
      `).join("")}
      ${secciones.length === 0 ? '<div class="card" style="padding:32px; text-align:center; color:#6b7280;">No hay secciones para este grado.</div>' : ''}
    </div>
  `;
}

async function navegarEstudiantesPsInicio(seccionId, nombreSeccion) {
  const container = document.getElementById("psInicioContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="section-head"><h2><span style="cursor:pointer;color:var(--accent);" onclick="renderizarDashboardInicio(_psDashboardCache)">Inicio</span> &rsaquo; ${escaparHtml(nombreSeccion)}</h2></div>
    <div class="card" style="padding:40px; text-align:center; color:#6b7280;">Cargando estudiantes...</div>
  `;

  try {
    const estudiantes = await apiFetch("/postgres/estudiantes");
    const misEstudiantes = estudiantes.filter(e => e.seccion_id === seccionId);

    container.innerHTML = `
      <div class="section-head"><h2><span style="cursor:pointer;color:var(--accent);" onclick="renderizarDashboardInicio(_psDashboardCache)">Inicio</span> &rsaquo; ${escaparHtml(nombreSeccion)}</h2></div>
      <div class="card" style="padding:0; overflow:hidden;">
        <table class="student-table">
          <thead>
            <tr><th>Estudiante</th><th>Correo</th><th>Riesgo</th><th>Accion</th></tr>
          </thead>
          <tbody>
            ${misEstudiantes.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:#6b7280; padding:24px;">No hay estudiantes en esta seccion.</td></tr>' : ''}
            ${misEstudiantes.map(e => {
              const riesgo = e.nivel_riesgo || "Sin datos";
              const cls = { "Alto riesgo": "alto", "En riesgo": "medio", "Regular": "medio", "Bien": "bajo", "Excelente": "bajo" }[riesgo] || "";
              return `
                <tr>
                  <td><strong>${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</strong></td>
                  <td>${escaparHtml(e.correo)}</td>
                  <td><span class="status-badge ${cls}">${riesgo}</span></td>
                  <td><button class="btn btn-secondary" onclick="abrirPerfilEstudiante(${e.id}, '${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}')">Ver perfil</button></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="card" style="padding:24px; color:#dc2626;">Error: ${e.message}</div>`;
  }
}

// ── RESPUESTAS: NAVEGACION POR GRADOS ──────────────────────────────────────────

async function renderizarGradosPsRespuestas(secciones) {
  const container = document.getElementById("psRespVistaGrados");
  if (!container) return;
  if (!secciones) {
    try {
      const dashboard = await apiFetch("/postgres/psicologia/dashboard");
      secciones = dashboard.secciones || [];
    } catch (_) { secciones = []; }
  }

  const formularios = await apiFetch("/postgres/formularios-psicologicos").catch(() => []);

  const gradosMap = {};
  secciones.forEach(s => {
    if (!gradosMap[s.grado]) gradosMap[s.grado] = { grado: s.grado, nivel: s.nivel, secciones: [], totalFormularios: 0 };
    const countForm = (formularios || []).filter(f => f.activo !== false && (!f.grado || f.grado === s.grado) && (!f.seccion || f.seccion === s.letra) && (!f.nivel || f.nivel === s.nivel)).length;
    gradosMap[s.grado].secciones.push({ ...s, countForm });
    gradosMap[s.grado].totalFormularios += countForm;
  });

  const grados = Object.values(gradosMap).sort((a, b) => {
    const order = { "1ro": 1, "2do": 2, "3ro": 3, "4to": 4, "5to": 5, "6to": 6 };
    return (order[a.grado] || 99) - (order[b.grado] || 99);
  });

  container.innerHTML = `
    <div class="section-head"><h2>Respuestas de cuestionarios</h2></div>
    <div class="grades">
      ${grados.map(g => `
        <div class="grade" onclick="navegarSeccionesPsRespuestas('${g.grado}')">
          <div class="grade-header">
            <span class="badge-grade">${g.nivel}</span>
            <span class="grade-number">${g.grado}</span>
          </div>
          <div class="card-body">
            <h2 class="title">${g.grado} - ${g.nivel}</h2>
            <p class="subtitle">${g.secciones.length} seccion${g.secciones.length !== 1 ? 'es' : ''}</p>
            <div class="card-footer">
              <div class="info-item">
                <svg class="icon" viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                <span>${g.totalFormularios} cuestionarios</span>
              </div>
              <div class="info-item">
                <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>${g.secciones.length} seccion${g.secciones.length !== 1 ? 'es' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      `).join("")}
      ${grados.length === 0 ? '<div class="card" style="padding:40px; text-align:center; color:var(--gris);">No hay secciones con tutor.</div>' : ''}
    </div>
  `;
}

async function navegarSeccionesPsRespuestas(grado) {
  document.getElementById("psRespVistaGrados")?.classList.add("oculto");
  document.getElementById("psRespVistaCuestionarios")?.classList.add("oculto");
  document.getElementById("psRespVistaDetalle")?.classList.add("oculto");
  const container = document.getElementById("psRespVistaSecciones");
  container.classList.remove("oculto");

  container.innerHTML = `
    <div class="breadcrumb">
      <a class="breadcrumb-link" style="cursor:pointer" onclick="document.getElementById('psRespVistaSecciones').classList.add('oculto'); document.getElementById('psRespVistaCuestionarios').classList.add('oculto'); document.getElementById('psRespVistaDetalle').classList.add('oculto'); document.getElementById('psRespVistaGrados').classList.remove('oculto'); renderizarGradosPsRespuestas();">Respuestas</a>
      <span>&rsaquo;</span>
      <strong>${grado}</strong>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:14px; margin-top:14px;" id="psRespSeccionesList"></div>
  `;

  try {
    const [secciones, formularios] = await Promise.all([
      apiFetch("/postgres/psicologia/secciones-asignadas"),
      apiFetch("/postgres/formularios-psicologicos")
    ]);
    const seccionesGrado = secciones.filter(s => s.grado === grado);

    const list = document.getElementById("psRespSeccionesList");
    list.innerHTML = seccionesGrado.map(s => {
      const countForm = (formularios || []).filter(f => f.activo !== false && (!f.grado || f.grado === s.grado) && (!f.seccion || f.seccion === s.letra) && (!f.nivel || f.nivel === s.nivel)).length;
      return `
        <div class="card" style="padding:18px; cursor:pointer;" onclick="navegarCuestionariosPsRespuestas('${grado}', '${s.letra}')">
          <div style="width:40px; height:40px; border-radius:10px; background:var(--azul); display:grid; place-items:center; color:#fff; font-weight:800; font-size:13px; margin-bottom:10px;">${s.grado} ${s.letra}</div>
          <div style="font-weight:700; font-size:14px;">${s.grado} ${s.letra}</div>
          <div style="font-size:12px; color:var(--gris); margin-top:2px;">${countForm} cuestionarios</div>
        </div>
      `;
    }).join("");

    if (seccionesGrado.length === 0) {
      list.innerHTML = '<div class="card" style="padding:40px; text-align:center; color:var(--gris);">No hay secciones para este grado.</div>';
    }
  } catch (e) {
    container.innerHTML += '<div class="card" style="padding:24px; color:var(--warn);">Error: ' + e.message + '</div>';
  }
}

async function navegarCuestionariosPsRespuestas(grado, letra) {
  document.getElementById("psRespVistaGrados")?.classList.add("oculto");
  document.getElementById("psRespVistaSecciones")?.classList.add("oculto");
  document.getElementById("psRespVistaDetalle")?.classList.add("oculto");
  const container = document.getElementById("psRespVistaCuestionarios");
  container.classList.remove("oculto");

  container.innerHTML = `
    <div class="breadcrumb">
      <a class="breadcrumb-link" style="cursor:pointer" onclick="document.getElementById('psRespVistaCuestionarios').classList.add('oculto'); document.getElementById('psRespVistaDetalle').classList.add('oculto'); document.getElementById('psRespVistaSecciones').classList.add('oculto'); document.getElementById('psRespVistaGrados').classList.remove('oculto'); renderizarGradosPsRespuestas();">Respuestas</a>
      <span>&rsaquo;</span>
      <a class="breadcrumb-link" style="cursor:pointer" onclick="document.getElementById('psRespVistaCuestionarios').classList.add('oculto'); document.getElementById('psRespVistaDetalle').classList.add('oculto'); navegarSeccionesPsRespuestas('${grado}')">${grado}</a>
      <span>&rsaquo;</span>
      <strong>${grado} ${letra}</strong>
    </div>
    <div id="psRespCuestionariosList" style="margin-top:14px;"></div>
  `;

  try {
    const [formularios, respuestas] = await Promise.all([
      apiFetch("/postgres/formularios-psicologicos"),
      apiFetch("/postgres/psicologia/formularios/respuestas").catch(() => [])
    ]);
    const misFormularios = (formularios || []).filter(f => f.activo !== false && (!f.grado || f.grado === grado) && (!f.seccion || f.seccion === letra));

    const list = document.getElementById("psRespCuestionariosList");
    if (misFormularios.length === 0) {
      list.innerHTML = '<div class="card" style="padding:40px; text-align:center; color:#6b7280;">No hay cuestionarios para esta seccion.</div>';
      return;
    }

    list.innerHTML = misFormularios.map(f => {
      const respCount = (respuestas || []).filter(r => r.formulario_id === f.id || r.id === f.id).length;
      return `
        <div class="questionnaire-card" onclick="verDetalleRespuestasPs(${f.id}, '${grado}', '${letra}')">
          <div style="display:flex; align-items:center; gap:16px;">
            <div style="width:44px; height:44px; border-radius:11px; background:${GRADO_GRADIENTS[grado] || GRADO_GRADIENTS['3ro']}; display:grid; place-items:center; color:#fff; font-weight:800; font-size:12px; flex-shrink:0;">${escaparHtml(f.grado || 'G')}<br>${escaparHtml(f.seccion || '')}</div>
            <div style="flex:1;">
              <div class="q-title">${escaparHtml(f.titulo)}</div>
              <div class="q-meta">${f.preguntas?.length || 0} preguntas &middot; ${respCount} respuestas</div>
            </div>
            <span class="q-status ${f.activo !== false ? 'activo' : 'inactivo'}">${f.activo !== false ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    container.innerHTML += '<div class="card" style="padding:24px; color:#dc2626;">Error: ' + e.message + '</div>';
  }
}

async function verDetalleRespuestasPs(formularioId, gradoCtx, letraCtx) {
  document.getElementById("psRespVistaGrados")?.classList.add("oculto");
  document.getElementById("psRespVistaSecciones")?.classList.add("oculto");
  document.getElementById("psRespVistaCuestionarios")?.classList.add("oculto");
  const container = document.getElementById("psRespVistaDetalle");
  container.classList.remove("oculto");

  try {
    const [formulario, respuestasAll] = await Promise.all([
      apiFetch(`/postgres/formularios-psicologicos/${formularioId}`),
      apiFetch("/postgres/psicologia/formularios/respuestas")
    ]);
    const respuestas = (respuestasAll || []).filter(r => r.formulario_id === formularioId);

    // gradoCtx/letraCtx son el contexto desde donde se abrió el detalle; para formularios generales (grado null) es donde el usuario estaba navegando
    const bcGrado = gradoCtx || formulario.grado || '';
    const bcLetra = letraCtx || formulario.seccion || '';
    container.innerHTML = `
      <div class="breadcrumb">
        <a class="breadcrumb-link" style="cursor:pointer" onclick="document.getElementById('psRespVistaDetalle').classList.add('oculto'); document.getElementById('psRespVistaCuestionarios').classList.add('oculto'); document.getElementById('psRespVistaSecciones').classList.add('oculto'); document.getElementById('psRespVistaGrados').classList.remove('oculto'); renderizarGradosPsRespuestas();">Respuestas</a>
        <span>&rsaquo;</span>
        <a class="breadcrumb-link" style="cursor:pointer" onclick="document.getElementById('psRespVistaDetalle').classList.add('oculto'); navegarCuestionariosPsRespuestas('${bcGrado}', '${bcLetra}')">${escaparHtml(bcGrado || 'General')} ${escaparHtml(bcLetra)}</a>
        <span>&rsaquo;</span>
        <strong>${escaparHtml(formulario.titulo)}</strong>
      </div>
      <div class="card" style="padding:22px; margin-top:14px;">
        <div class="ps-section-title">${escaparHtml(formulario.titulo)}</div>
        <p style="font-size:13px; color:#6b7280; margin-bottom:16px;">${escaparHtml(formulario.descripcion || '')}</p>
        <table class="student-table">
          <thead>
            <tr><th>Estudiante</th><th>Fecha</th><th>Puntaje</th><th>Ver</th></tr>
          </thead>
          <tbody>
            ${(respuestas || []).map(r => {
              const nombre = r.estudiante_nombre || (r.nombres ? `${r.nombres} ${r.apellidos || ''}`.trim() : '') || `Estudiante #${r.estudiante_id}`;
              const fecha = r.fecha_respuesta || r.fecha || r.created_at;
              const punt = r.puntaje_promedio ?? r.puntaje_total ?? 0;
              const nivel = r.nivel_puntaje || (punt >= 61 ? 'Alto' : punt >= 31 ? 'Medio' : 'Bajo');
              const col = nivel === 'Alto' ? '#dc2626' : nivel === 'Medio' ? '#d97706' : '#059669';
              const bg = nivel === 'Alto' ? '#fef2f2' : nivel === 'Medio' ? '#fffbeb' : '#ecfdf5';
              return `
              <tr>
                <td><strong>${escaparHtml(nombre)}</strong><br><small style="color:#6b7280; font-size:11px;">${escaparHtml(r.correo || '')}</small></td>
                <td>${fecha ? new Date(fecha).toLocaleDateString() : '-'}</td>
                <td><span style="display:inline-block; min-width:42px; text-align:center; font-weight:800; font-size:13px; color:${col}; background:${bg}; padding:4px 8px; border-radius:8px; border:1px solid ${col}20;">${punt}</span> <small style="color:${col}; font-weight:600;">${nivel}</small></td>
                <td><button class="btn btn-secondary" onclick="verRespuestaEstudiantePs(${r.estudiante_id}, ${formularioId})">Ver</button></td>
              </tr>
            `}).join("")}
            ${(respuestas || []).length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#6b7280;padding:20px;">No hay respuestas aun.</td></tr>' : ''}
          </tbody>
        </table>
        <p style="font-size:11px; color:#9ca3af; margin-top:8px;">Puntaje = promedio 0-100 de las respuestas con puntaje (Alto ≥61, Medio 31-60, Bajo 0-30). Abiertas no puntúan.</p>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<p style="color:#dc2626;">Error: ' + e.message + '</p>';
  }
}

async function verRespuestaEstudiantePs(estudianteId, formularioId) {
  try {
    const data = await apiFetch(`/postgres/psicologia/formularios/${formularioId}/estudiantes/${estudianteId}/respuestas`);
    const body = document.getElementById("modalDetalleRespuestaBody");
    const titulo = document.getElementById("modalDetalleRespuestaTitulo");
    titulo.textContent = `${data.formulario_titulo || 'Cuestionario'} — ${data.nombres || ''} ${data.apellidos || ''}`.trim();

    let html = `<div style="background:#f0f7ff; border:1px solid #dbeafe; border-radius:10px; padding:12px 14px; margin-bottom:14px;">
      <div style="font-size:13px; color:#1e3a5f;"><strong>${escaparHtml(data.nombres || '')} ${escaparHtml(data.apellidos || '')}</strong> · ${escaparHtml(data.correo || '')}</div>
      <div style="font-size:11px; color:#6b7280; margin-top:2px;">Fecha: ${data.fecha_respuesta ? new Date(data.fecha_respuesta).toLocaleString('es-PE') : '-'}</div>
    </div>`;

    html += '<div style="display:grid;gap:10px;">';
    (data.respuestas || []).forEach((r, i) => {
      const punt = r.puntaje_riesgo;
      const hasPunt = punt != null;
      const col = !hasPunt ? '#6b7280' : punt >= 61 ? '#dc2626' : punt >= 31 ? '#d97706' : '#059669';
      const bg = !hasPunt ? '#f3f4f6' : punt >= 61 ? '#fef2f2' : punt >= 31 ? '#fffbeb' : '#ecfdf5';
      html += `
        <div style="background:white; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <p style="font-weight:600;color:#374151; font-size:13px; margin:0; flex:1;">${i + 1}. ${escaparHtml(r.pregunta)}</p>
            ${hasPunt ? `<span style="flex-shrink:0; font-size:12px; font-weight:800; color:${col}; background:${bg}; padding:4px 8px; border-radius:999px; border:1px solid ${col}20;">${punt}</span>` : `<span style="flex-shrink:0; font-size:11px; color:#9ca3af; background:#f9fafb; padding:3px 8px; border-radius:999px;">Abierta</span>`}
          </div>
          <div style="margin-top:8px; background:#f9fafb; border-radius:8px; padding:8px 10px; font-size:13px; color:#111827;">${r.respuesta ? escaparHtml(r.respuesta) : '<span style="color:#9ca3af;">Sin respuesta</span>'}</div>
          ${r.tipo !== 'abierta' && r.opcion_texto && r.opcion_texto !== r.respuesta ? `<div style="font-size:11px; color:#6b7280; margin-top:4px;">Opción registrada: ${escaparHtml(r.opcion_texto)}</div>` : ''}
        </div>
      `;
    });
    html += "</div>";

    // Evaluación detallada abajo - no se pierde ningún valor
    const ev = data.evaluacion;
    if (ev) {
      const colEv = ev.nivel === 'Alto' ? '#dc2626' : ev.nivel === 'Medio' ? '#d97706' : '#059669';
      const bgEv = ev.nivel === 'Alto' ? '#fef2f2' : ev.nivel === 'Medio' ? '#fffbeb' : '#ecfdf5';
      html += `
        <div style="margin-top:16px; background:${bgEv}; border:1px solid ${colEv}30; border-radius:12px; padding:16px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:white; color:${colEv}; font-weight:800; border:1px solid ${colEv}30;">${ev.puntaje_promedio}</span>
            <div>
              <div style="font-size:13px; font-weight:800; color:${colEv};">Puntaje promedio: ${ev.puntaje_promedio} · Nivel ${ev.nivel}</div>
              <div style="font-size:11px; color:#6b7280;">Total acumulado: ${ev.puntaje_total} pts · ${ev.respondidas}/${ev.total_preguntas} respondidas</div>
            </div>
          </div>
          <p style="font-size:12.5px; color:#374151; line-height:1.5; margin:0;">${escaparHtml(ev.interpretacion)}</p>
          <div style="font-size:11px; color:#6b7280; margin-top:8px;">Detalle: cada respuesta cerrada/likert aporta 0-100 según su riesgo (0 bajo, 100 alto). Abiertas no puntúan. El promedio es lo que usa el semáforo.</div>
        </div>
      `;
    }

    body.innerHTML = html;
    document.getElementById("modalDetalleRespuestaPs")?.classList.remove("oculto");
  } catch (e) {
    alert("Error cargando detalle: " + e.message);
  }
}

// ── FORMULARIOS PSICOLOGICOS ───────────────────────────────────────────────────

function agregarPreguntaPsicologica(tipo) {
  const contenedor = document.getElementById("psPreguntasContainer");
  if (!contenedor) return;
  _psPreguntaIndex += 1;
  const id = `ps-pregunta-${_psPreguntaIndex}`;
  const esCerrada = tipo === "cerrada";
  const esLikert = tipo === "likert";
  const titulo = esCerrada ? "Pregunta cerrada" : esLikert ? "Pregunta Likert (1-5)" : "Pregunta abierta";
  const placeholder = esCerrada ? "Ej: Te sentiste acompañado?" : esLikert ? "Ej: ¿Cómo calificarías tu bienestar?" : "Ej: Cuéntanos cómo te sentiste.";
  contenedor.insertAdjacentHTML("beforeend", `
    <div class="ps-question-item" id="${id}" data-tipo="${tipo}">
      <div class="ps-question-item-head">
        <strong>${titulo}</strong>
        <button type="button" class="modal-close" onclick="document.getElementById('${id}').remove()">&times;</button>
      </div>
      <div class="form-group">
        <label>Pregunta</label>
        <input type="text" class="ps-question-text"
          placeholder="${placeholder}">
      </div>
      ${esCerrada ? `
        <div class="form-group">
          <label>Opciones</label>
          <select class="ps-question-options">
            <option value="Verdadero,Falso">Verdadero / Falso</option>
            <option value="Si,No">Si / No</option>
            <option value="Nunca,A veces,Siempre">Nunca / A veces / Siempre</option>
          </select>
        </div>
      ` : ""}
      ${esLikert ? `
        <div class="form-group">
          <label>Escala Likert (1-5)</label>
          <select class="ps-question-options" disabled>
            <option>Muy malo (1) / Malo (2) / Regular (3) / Bueno (4) / Muy bueno (5)</option>
          </select>
          <small style="color:#6b7280;">Se guardará como: Muy malo, Malo, Regular, Bueno, Muy bueno</small>
        </div>
      ` : ""}
    </div>
  `);
}

function agregarPreguntaPsicologicaConDatos(pregunta) {
  agregarPreguntaPsicologica(pregunta.tipo);
  const item = document.querySelector("#psPreguntasContainer .ps-question-item:last-child");
  if (!item) return;
  const texto = item.querySelector(".ps-question-text");
  if (texto) texto.value = pregunta.pregunta || "";
  const opciones = item.querySelector(".ps-question-options");
  if (opciones && Array.isArray(pregunta.opciones)) {
    const valor = pregunta.opciones.join(",");
    if (![...opciones.options].some(o => o.value === valor)) {
      opciones.insertAdjacentHTML("beforeend", `<option value="${valor}">${pregunta.opciones.join(" / ")}</option>`);
    }
    opciones.value = valor;
  }
}

function obtenerPreguntasPsicologicas() {
  return [...document.querySelectorAll(".ps-question-item")].map(item => {
    const tipo = item.dataset.tipo;
    const pregunta = item.querySelector(".ps-question-text")?.value.trim();
    let opciones = null;
    if (tipo === "cerrada") {
      opciones = (item.querySelector(".ps-question-options")?.value || "").split(",");
    } else if (tipo === "likert") {
      opciones = ["Muy malo","Malo","Regular","Bueno","Muy bueno"];
    }
    return { tipo, pregunta, opciones };
  }).filter(p => p.pregunta);
}

async function cargarGradosFormulario() {
  const select = document.getElementById("psFormGrado");
  if (!select) return;
  try {
    const secciones = await apiFetch("/postgres/psicologia/secciones-asignadas");
    const grados = [...new Set(secciones.map(s => s.grado))].sort();
    if (grados.length === 0) {
      select.innerHTML = '<option value="">Sin grados habilitados</option>';
      return;
    }
    select.innerHTML = '<option value="">Seleccionar</option>' + grados.map(g => `<option value="${g}">${g}</option>`).join("");
  } catch (e) {
    select.innerHTML = '<option value="">Error cargando</option>';
  }
}

async function cargarSeccionesFormulario() {
  const grado = document.getElementById("psFormGrado")?.value;
  const select = document.getElementById("psFormSeccion");
  if (!select) return;
  select.innerHTML = '<option value="">Cargando...</option>';
  if (!grado) {
    select.innerHTML = '<option value="">Seleccionar seccion</option>';
    return;
  }
  try {
    const secciones = await apiFetch("/postgres/psicologia/secciones-asignadas");
    const nivel = GRADO_NIVEL[grado] || "Secundaria";
    const filtradas = secciones.filter(s => s.grado === grado && s.nivel === nivel);
    select.innerHTML = '<option value="">Seleccionar seccion</option>' +
      filtradas.map(s => `<option value="${s.letra}">${s.grado} ${s.letra}</option>`).join("");
  } catch (e) {
    select.innerHTML = '<option value="">Error cargando</option>';
  }
}

async function guardarFormularioPsicologico() {
  const editId = document.getElementById("psFormEditId")?.value;
  const titulo = document.getElementById("psFormTitulo")?.value.trim();
  const descripcion = document.getElementById("psFormDescripcion")?.value.trim();
  const grado = document.getElementById("psFormGrado")?.value;
  const seccion = document.getElementById("psFormSeccion")?.value;
  const preguntas = obtenerPreguntasPsicologicas();

  if (!titulo) { alert("Escribe el titulo del formulario."); return; }
  if (!grado || !seccion) { alert("Selecciona grado y seccion."); return; }
  if (preguntas.length === 0) { alert("Agrega al menos una pregunta."); return; }

  const nivel = GRADO_NIVEL[grado] || "Secundaria";
  try {
    await apiFetch(
      editId ? `/postgres/formularios-psicologicos/${editId}` : "/postgres/formularios-psicologicos",
      { method: editId ? "PUT" : "POST", body: { titulo, descripcion, nivel, grado, seccion, preguntas } }
    );
    alert(editId ? "Formulario actualizado." : "Formulario guardado.");
    cancelarEdicionFormularioPsicologico();
    await cargarFormulariosPsicologicos();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function editarFormularioPsicologico(id) {
  try {
    const formulario = await apiFetch(`/postgres/formularios-psicologicos/${id}`);
    document.getElementById("psFormEditId").value = formulario.id;
    document.getElementById("psFormTitulo").value = formulario.titulo || "";
    document.getElementById("psFormDescripcion").value = formulario.descripcion || "";
    await cargarGradosFormulario();
    document.getElementById("psFormGrado").value = formulario.grado || "";
    await cargarSeccionesFormulario();
    document.getElementById("psFormSeccion").value = formulario.seccion || "";
    document.getElementById("psPreguntasContainer").innerHTML = "";
    (formulario.preguntas || []).forEach(agregarPreguntaPsicologicaConDatos);
    document.getElementById("btnGuardarFormularioPs").textContent = "Actualizar formulario";
    document.getElementById("btnCancelarEdicionFormularioPs")?.classList.remove("oculto");
  } catch (e) {
    alert("Error: " + e.message);
  }
}

function cancelarEdicionFormularioPsicologico() {
  document.getElementById("psFormEditId").value = "";
  document.getElementById("psFormTitulo").value = "";
  document.getElementById("psFormDescripcion").value = "";
  document.getElementById("psFormGrado").value = "";
  document.getElementById("psFormSeccion").innerHTML = '<option value="">Seleccionar seccion</option>';
  document.getElementById("psPreguntasContainer").innerHTML = "";
  document.getElementById("btnGuardarFormularioPs").textContent = "Guardar formulario";
  document.getElementById("btnCancelarEdicionFormularioPs")?.classList.add("oculto");
}

async function cargarFormulariosPsicologicos() {
  try {
    const formularios = await apiFetch("/postgres/formularios-psicologicos");
    _psSeccionesDisponibles = await apiFetch("/postgres/psicologia/secciones-asignadas").catch(() => []);
    const container = document.getElementById("tablaFormulariosPsicologicos");
    if (!container) return;

    if (!formularios || formularios.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#6b7280;padding:20px;">Sin formularios creados.</p>';
      return;
    }

    container.innerHTML = formularios.map(f => `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;color:#1f2937;">${escaparHtml(f.titulo)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">${f.grado} ${f.seccion} &middot; ${f.preguntas?.length || 0} preguntas</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" onclick="editarFormularioPsicologico(${f.id})">Editar</button>
          <button class="btn btn-secondary" onclick="abrirModalPuntajesPs(${f.id})">Puntajes</button>
          <button class="btn btn-secondary" style="color:#b91c1c;" onclick="eliminarFormularioPsicologico(${f.id})">Eliminar</button>
        </div>
      </div>
    `).join("");
  } catch (e) {
    console.error("Error cargando formularios:", e);
  }
}

async function eliminarFormularioPsicologico(id) {
  if (!confirm("Eliminar este formulario?")) return;
  try {
    await apiFetch(`/postgres/formularios-psicologicos/${id}`, { method: "DELETE" });
    await cargarFormulariosPsicologicos();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ── PUNTAJES ───────────────────────────────────────────────────────────────────

async function abrirModalPuntajesPs(formularioId) {
  try {
    const formulario = await apiFetch(`/postgres/formularios-psicologicos/${formularioId}`);
    _psFormularioPuntajesActual = formulario;
    const container = document.getElementById("psPuntajesPreguntas");
    container.innerHTML = "";

    (formulario.preguntas || []).forEach((p, idx) => {
      if (p.tipo !== "cerrada") return;
      const puntaje = p.puntaje_senal ?? 50;
      container.innerHTML += `
        <div style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid #f3f4f6;">
          <span style="flex:1;font-size:13px;color:#374151;">${idx + 1}. ${escaparHtml(p.pregunta)}</span>
          <input type="range" min="0" max="100" value="${puntaje}" class="ps-score-range"
            data-idx="${idx}" oninput="this.nextElementSibling.textContent=this.value">
          <span style="min-width:30px;text-align:center;font-size:13px;font-weight:600;">${puntaje}</span>
        </div>
      `;
    });

    document.getElementById("modalPuntajesFormularioPs")?.classList.remove("oculto");
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function guardarPuntajesFormularioPs() {
  if (!_psFormularioPuntajesActual) return;
  try {
    const ranges = document.querySelectorAll(".ps-score-range");
    ranges.forEach(r => {
      const idx = Number(r.dataset.idx);
      _psFormularioPuntajesActual.preguntas[idx].puntaje_senal = Number(r.value);
    });
    await apiFetch(`/postgres/formularios-psicologicos/${_psFormularioPuntajesActual.id}`, {
      method: "PUT",
      body: { preguntas: _psFormularioPuntajesActual.preguntas }
    });
    cerrarModal("modalPuntajesFormularioPs");
    alert("Puntajes guardados.");
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ── TESTS VALIDADOS ───────────────────────────────────────────────────────
let _testsValidadosCache = null;
async function cargarTestsValidados(){
  const cont = document.getElementById("testsValidadosCatalogo");
  const box = document.getElementById("testsValidadosHabilitarBox");
  if(!cont) return;
  cont.innerHTML = `<div style="padding:24px; text-align:center; color:#6b7280;">Cargando tests validados...</div>`;
  if(box) box.classList.add("oculto");
  try{
    const tests = await apiFetch("/postgres/psicologia/tests-validados");
    _testsValidadosCache = tests;
    cont.innerHTML = tests.map(t => `
      <div class="card" style="padding:16px; border:1px solid #e5e7eb; background:white; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="background:${t.tipo==='personalizado'?'#065f46':'#1e3a5f'}; color:white; font-size:10px; font-weight:800; padding:3px 8px; border-radius:999px; letter-spacing:.2px;">${escaparHtml(t.codigo)}</span>
          <span style="font-size:11px; color:#6b7280;">${escaparHtml(t.tiempo)} · ${t.num_preguntas} preg. · Max ${t.puntaje_max} pts</span>
          ${t.tipo==='personalizado' ? '<span style="margin-left:auto; font-size:9px; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:2px 6px; border-radius:999px; font-weight:700;">IMPORTADO</span>' : `<span style="margin-left:auto; font-size:9px; color:#1e3a5f; background:#f1f5f9; border:1px solid #e2e8f0; padding:2px 6px; border-radius:999px; font-weight:700;">${escaparHtml(t.validacion.split("—")[0])}</span>`}
        </div>
        <div style="font-size:13.5px; font-weight:700; color:#111827; line-height:1.3;">${escaparHtml(t.nombre)}</div>
        <div style="font-size:12.5px; color:#6b7280; line-height:1.5; min-height:36px;">${escaparHtml(t.descripcion)}</div>
        ${t.autor ? `<div style="font-size:11px; color:#9ca3af;">Autor: ${escaparHtml(t.autor)}</div>` : ''}
        <div style="display:flex; align-items:center; gap:6px; margin-top:4px; padding-top:10px; border-top:1px solid #f3f4f6;">
          <button class="btn btn-secondary btn-sm" onclick="previewTestValidado('${escaparHtml(t.codigo)}')" style="padding:6px 10px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Ver test</button>
          <button class="btn btn-primary btn-sm" onclick="mostrarHabilitarTest('${escaparHtml(t.codigo)}')" style="padding:6px 10px;">Habilitar</button>
          ${t.tipo==='personalizado' && !['GAD-7','PHQ-9','BIENESTAR-5','CRAFFT-2-1-CONSUMO-DE-ALCOHOL-Y-DROGAS','ECADA'].includes(t.codigo) ? `
            <div style="margin-left:auto; display:flex; gap:4px;">
              <button title="Editar test" onclick="abrirEditarTest('${escaparHtml(t.codigo)}')" style="width:28px;height:28px;border:none;background:transparent;color:#92400e;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;" onmouseover="this.style.background='#fffbeb'" onmouseout="this.style.background='transparent'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>
              <button title="Eliminar test" onclick="confirmarEliminarTest('${escaparHtml(t.codigo)}','${escaparHtml(t.nombre)}')" style="width:28px;height:28px;border:none;background:transparent;color:#dc2626;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join("");
    if(!tests.length) cont.innerHTML = `<div class="card" style="padding:24px; text-align:center; color:#6b7280;">No hay tests validados.</div>`;
  }catch(e){
    cont.innerHTML = `<div class="card" style="padding:24px; text-align:center; color:#b91c1c;">Error: ${escaparHtml(e.message)}</div>`;
  }
}
function mostrarHabilitarTest(codigo){
  const test = (_testsValidadosCache||[]).find(t=>t.codigo===codigo);
  const box = document.getElementById("testsValidadosHabilitarBox");
  if(!test || !box) return;
  box.classList.remove("oculto");
  box.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
      <span style="background:#063b91; color:white; font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px;">${escaparHtml(test.codigo)}</span>
      <strong style="font-size:14px; color:#102a56;">Habilitar ${escaparHtml(test.nombre)}</strong>
    </div>
    <p style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">${escaparHtml(test.descripcion)}</p>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
      <div class="form-group"><label>Grado</label><select id="testValGrado"><option value="">Seleccionar</option><option>1ro</option><option>2do</option><option>3ro</option><option>4to</option><option>5to</option></select></div>
      <div class="form-group"><label>Sección</label><select id="testValSeccion"><option value="">Seleccionar</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option><option>F</option></select></div>
    </div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button class="btn btn-primary" onclick="confirmarHabilitarTest('${escaparHtml(codigo)}')">Habilitar para sección</button>
      <button class="btn btn-secondary" onclick="document.getElementById('testsValidadosHabilitarBox').classList.add('oculto')">Cancelar</button>
    </div>
    <div id="testValMsg" style="margin-top:10px; font-size:12.5px;"></div>
  `;
  box.scrollIntoView({behavior:"smooth", block:"center"});
}
async function confirmarHabilitarTest(codigo){
  const grado=document.getElementById("testValGrado")?.value;
  const seccion=document.getElementById("testValSeccion")?.value;
  const msg=document.getElementById("testValMsg");
  if(!grado || !seccion){ if(msg){ msg.style.color="#b91c1c"; msg.textContent="Selecciona grado y sección."; } return; }
  if(msg){ msg.style.color="#6b7280"; msg.textContent="Habilitando..."; }
  try{
    const res = await apiFetch("/postgres/psicologia/tests-validados/habilitar",{method:"POST", body:{ codigo, grado, seccion }});
    if(msg){ msg.style.color="#059669"; msg.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M20 6L9 17l-5-5"/></svg>${escaparHtml(res.mensaje||"Test habilitado. Aparecera en Respuestas y en el portal del estudiante.")}`; }
    if(window.mostrarToastGlobal) mostrarToastGlobal(res.mensaje || "Test habilitado","ok");
  }catch(e){
    if(msg){ msg.style.color="#b91c1c"; msg.textContent="Error: "+e.message; }
    if(window.mostrarToastGlobal) mostrarToastGlobal(e.message,"error");
  }
}

async function previewTestValidado(codigo){
  const body = document.getElementById("previewTestBody");
  const titulo = document.getElementById("previewTestTitulo");
  if(!body || !titulo) return;
  titulo.textContent = "Cargando...";
  body.innerHTML = `<div style="padding:30px; text-align:center; color:#6b7280;">Cargando test...</div>`;
  document.getElementById("modalPreviewTest")?.classList.remove("oculto");
  try{
    const test = await apiFetch(`/postgres/psicologia/tests-validados/${encodeURIComponent(codigo)}`);
    titulo.textContent = `${test.codigo} — ${test.nombre}`;
    body.innerHTML = `
      <div style="margin-bottom:16px;">
        <p style="font-size:13px; color:#374151; line-height:1.6; margin:0 0 10px;">${escaparHtml(test.descripcion)}</p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:11.5px; color:#6b7280;">
          <span style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="width:12px;height:12px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escaparHtml(test.tiempo)}</span>
          <span style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="width:12px;height:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${test.preguntas.length} preguntas</span>
          <span style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="width:12px;height:12px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Max: ${test.puntaje_max} pts</span>
          <span style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="width:12px;height:12px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>${escaparHtml(test.validacion)}</span>
        </div>
        ${test.autor ? `<div style="font-size:11px; color:#9ca3af; margin-top:4px;">Autor: ${escaparHtml(test.autor)}</div>` : ''}
      </div>

      <div style="font-size:12px; font-weight:700; color:#063b91; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px;">Preguntas</div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
        ${test.preguntas.map((p,i) => `
          <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px;">
            <div style="font-size:12.5px; font-weight:700; color:#102a56; margin-bottom:6px;">${i+1}. ${escaparHtml(p)}</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${test.opciones.map(o => `
                <span style="font-size:11px; background:${o.puntaje===0?'#dcfce7':o.puntaje<=1?'#fef3c7':o.puntaje<=2?'#ffedd5':'#fdeceb'}; color:${o.puntaje===0?'#166534':o.puntaje<=1?'#92400e':o.puntaje<=2?'#9a3412':'#991b1b'}; padding:3px 8px; border-radius:999px; font-weight:600;">${escaparHtml(o.texto)} (${o.puntaje}pts)</span>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>

      <div style="font-size:12px; font-weight:700; color:#063b91; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px;">Interpretación automática (rangos de puntaje)</div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:16px;">
        ${test.rangos.map(r => `
          <div style="display:flex; align-items:center; gap:10px; background:white; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px;">
            <div style="width:10px; height:10px; border-radius:50%; background:${r.color}; flex-shrink:0;"></div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:12.5px; font-weight:700; color:#102a56;">${r.min}–${r.max} pts: ${escaparHtml(r.nivel)}</div>
              <div style="font-size:11.5px; color:#6b7280; margin-top:2px;">${escaparHtml(r.recomendacion)}</div>
            </div>
          </div>
        `).join("")}
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end; border-top:1px solid #e5e7eb; padding-top:14px;">
        <button class="btn btn-secondary" onclick="cerrarModal('modalPreviewTest')">Cerrar</button>
        <button class="btn btn-primary" onclick="cerrarModal('modalPreviewTest'); mostrarHabilitarTest('${escaparHtml(codigo)}')">Habilitar este test</button>
      </div>
    `;
  }catch(e){
    titulo.textContent = "Error";
    body.innerHTML = `<div style="padding:20px; text-align:center; color:#b91c1c;">Error: ${escaparHtml(e.message)}</div>`;
  }
}

// ── EDITAR / ELIMINAR TEST PERSONALIZADO ──────────────────────────────────
async function abrirEditarTest(codigo){
  const test = (_testsValidadosCache||[]).find(t=>t.codigo===codigo);
  if(!test) return;
  const box = document.getElementById("testsValidadosHabilitarBox");
  if(!box) return;
  box.classList.remove("oculto");
  box.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
      <span style="background:#059669; color:white; font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px;">${escaparHtml(test.codigo)}</span>
      <strong style="font-size:14px; color:#102a56;">Editar ${escaparHtml(test.nombre)}</strong>
    </div>
    <div style="display:grid; gap:10px; margin-bottom:12px;">
      <div class="form-group"><label>Nombre del test</label><input id="editTestNombre" type="text" value="${escaparHtml(test.nombre)}" style="width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:13px;"></div>
      <div class="form-group"><label>Descripcion</label><textarea id="editTestDescripcion" rows="2" style="width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:13px;">${escaparHtml(test.descripcion||"")}</textarea></div>
      <div class="form-group"><label>Autor / Fuente</label><input id="editTestAutor" type="text" value="${escaparHtml(test.autor||"")}" style="width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:13px;"></div>
    </div>
    <div style="display:flex; gap:8px; margin-top:4px;">
      <button class="btn btn-primary" onclick="guardarEdicionTest('${escaparHtml(codigo)}')">Guardar cambios</button>
      <button class="btn btn-secondary" onclick="document.getElementById('testsValidadosHabilitarBox').classList.add('oculto')">Cancelar</button>
    </div>
    <div id="editTestMsg" style="margin-top:10px; font-size:12.5px;"></div>
  `;
}

async function guardarEdicionTest(codigo){
  const nombre = document.getElementById("editTestNombre")?.value?.trim();
  const descripcion = document.getElementById("editTestDescripcion")?.value?.trim();
  const autor = document.getElementById("editTestAutor")?.value?.trim();
  const msg = document.getElementById("editTestMsg");
  if(!nombre){ if(msg){ msg.style.color="#b91c1c"; msg.textContent="El nombre es obligatorio"; } return; }
  if(msg){ msg.style.color="#6b7280"; msg.textContent="Guardando..."; }
  try{
    const res = await apiFetch(`/postgres/psicologia/tests-validados/${encodeURIComponent(codigo)}`, { method:"PUT", body: { nombre, descripcion, autor } });
    if(msg){ msg.style.color="#059669"; msg.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M20 6L9 17l-5-5"/></svg>${escaparHtml(res.mensaje||"Test actualizado")}`; }
    if(window.mostrarToastGlobal) mostrarToastGlobal("Test actualizado", "ok");
    document.getElementById("testsValidadosHabilitarBox").classList.add("oculto");
    cargarTestsValidados();
  }catch(e){
    if(msg){ msg.style.color="#b91c1c"; msg.textContent="Error: "+e.message; }
  }
}

let _testAEliminar = null;

function confirmarEliminarTest(codigo, nombre){
  _testAEliminar = codigo;
  document.getElementById("eliminarTestNombre").textContent = `"${nombre}"`;
  document.getElementById("modalConfirmarEliminar")?.classList.remove("oculto");
}

function ejecutarEliminarTest(){
  if(!_testAEliminar) return;
  const codigo = _testAEliminar;
  _testAEliminar = null;
  cerrarModal('modalConfirmarEliminar');
  eliminarTest(codigo);
}

async function eliminarTest(codigo){
  try{
    const res = await apiFetch(`/postgres/psicologia/tests-validados/${encodeURIComponent(codigo)}`, { method:"DELETE" });
    if(window.mostrarToastGlobal) mostrarToastGlobal(res.mensaje || "Test eliminado", "ok");
    cargarTestsValidados();
  }catch(e){
    if(window.mostrarToastGlobal) mostrarToastGlobal(e.message, "error");
  }
}

// ── IMPORTAR EXCEL ───────────────────────────────────────────────────────
let _excelPreviewData = null;
function abrirModalImportarExcel(){
  _excelPreviewData = null;
  const step1 = document.getElementById("excelUploadStep");
  const step2 = document.getElementById("excelPreviewStep");
  const msg = document.getElementById("excelMsg");
  if(step1) step1.classList.remove("oculto");
  if(step2){ step2.classList.add("oculto"); step2.innerHTML = ""; }
  if(msg) msg.innerHTML = "";
  const fileInput = document.getElementById("excelFileInput");
  if(fileInput) fileInput.value = "";
  const fn = document.getElementById("excelFileName");
  if(fn) fn.style.display = "none";
  document.getElementById("modalImportarExcel")?.classList.remove("oculto");
}

function handleExcelFile(input){
  const file = input.files[0];
  if(!file) return;
  const fn = document.getElementById("excelFileName");
  if(fn){ fn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${file.name} (${(file.size/1024).toFixed(1)} KB)`; fn.style.display = "block"; }
  subirExcelPreview(file);
}

async function subirExcelPreview(file){
  const msg = document.getElementById("excelMsg");
  if(msg){ msg.style.color = "#6b7280"; msg.innerHTML = "Analizando Excel..."; }
  const formData = new FormData();
  formData.append("excel", file);
  formData.append("nombre", document.getElementById("excelTestNombre")?.value || file.name.replace(/\.[^.]+$/, ""));
  try{
    const result = await apiFetch("/postgres/psicologia/tests-validados/importar-excel", { method: "POST", body: formData, isFormData: true });
    _excelPreviewData = result;
    renderExcelPreview(result);
    if(msg) msg.innerHTML = "";
  }catch(e){
    if(msg){ msg.style.color = "#b91c1c"; msg.innerHTML = `Error: ${escaparHtml(e.message)}`; }
  }
}

function renderExcelPreview(test){
  const step1 = document.getElementById("excelUploadStep");
  const step2 = document.getElementById("excelPreviewStep");
  if(step1) step1.classList.add("oculto");
  if(!step2) return;
  step2.classList.remove("oculto");
  const autor = document.getElementById("excelTestAutor")?.value?.trim() || "Psicologia SAT Escolar";
  step2.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
      <span style="background:#063b91; color:white; font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px;">VISTA PREVIA</span>
      <span style="font-size:11px; color:#6b7280;">${escaparHtml(test.formato || 'simple')} &middot; ${test.preguntas.length} preguntas &middot; Max: ${test.puntaje_max} pts</span>
    </div>

    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:20px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#063b91" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span style="font-size:15px; font-weight:800; color:#102a56;">${escaparHtml(test.nombre)}</span>
      </div>
      <div style="font-size:11.5px; color:#6b7280; margin-bottom:10px;">Autor: ${escaparHtml(autor)} &middot; ${test.preguntas.length} preguntas &middot; Max ${test.puntaje_max} pts</div>
      <div style="font-size:11px; color:#9ca3af; border-top:1px solid #e2e8f0; padding-top:8px;">Asi lo veran los estudiantes al responder</div>
    </div>

    <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px; max-height:320px; overflow-y:auto; padding-right:4px;">
      ${test.preguntas.map((p,i) => `
        <div style="background:white; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px;">
          <div style="font-size:13px; font-weight:700; color:#102a56; margin-bottom:8px;">${i+1}. ${escaparHtml(p)}</div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${test.opciones.map(o => `
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#374151; padding:4px 6px; border-radius:6px; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='transparent'">
                <input type="radio" name="preview_q${i}" disabled style="accent-color:#063b91; width:14px; height:14px;">
                <span>${escaparHtml(o.texto)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>

    ${test.rangos?.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; font-weight:700; color:#063b91; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px;">Interpretacion automatica</div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${test.rangos.map(r => `
            <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
              <div style="width:8px; height:8px; border-radius:50%; background:${r.color};"></div>
              <span style="color:#374151; font-weight:600;">${r.min}–${r.max}: ${escaparHtml(r.nivel)}</span>
              <span style="color:#6b7280;">— ${escaparHtml(r.recomendacion)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ''}

    <div style="display:flex; gap:10px; justify-content:space-between; border-top:1px solid #e5e7eb; padding-top:14px;">
      <button class="btn btn-secondary" onclick="abrirModalImportarExcel()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver
      </button>
      <button class="btn btn-primary" onclick="guardarTestDesdeExcel()" style="padding:10px 24px; font-weight:700;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;margin-right:6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Guardar test
      </button>
    </div>
  `;
}

async function guardarTestDesdeExcel(){
  if(!_excelPreviewData) return;
  const msg = document.getElementById("excelMsg");
  const autor = document.getElementById("excelTestAutor")?.value?.trim() || "Psicologia SAT Escolar";
  if(msg){ msg.style.color = "#6b7280"; msg.innerHTML = "Guardando test..."; }
  try{
    const res = await apiFetch("/postgres/psicologia/tests-validados/guardar", {
      method: "POST",
      body: {
        nombre: _excelPreviewData.nombre,
        descripcion: _excelPreviewData.descripcion,
        autor: autor,
        preguntas: _excelPreviewData.preguntas,
        opciones: _excelPreviewData.opciones,
        rangos: _excelPreviewData.rangos,
        puntaje_max: _excelPreviewData.puntaje_max,
        tiempo: _excelPreviewData.tiempo,
        validacion: _excelPreviewData.validacion
      }
    });
    if(msg){ msg.style.color = "#059669"; msg.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M20 6L9 17l-5-5"/></svg>${escaparHtml(res.mensaje || "Test guardado")}`; }
    if(window.mostrarToastGlobal) mostrarToastGlobal("Test importado y guardado", "ok");
    cerrarModal("modalImportarExcel");
    cargarTestsValidados();
  }catch(e){
    if(msg){ msg.style.color = "#b91c1c"; msg.innerHTML = `Error: ${escaparHtml(e.message)}`; }
  }
}

// ── GENERAR CON IA ─────────────────────────────────────────────────────────
let _iaPreviewData = null;
function abrirModalGenerarIA(){
  _iaPreviewData = null;
  const step1 = document.getElementById("iaFormStep");
  const step2 = document.getElementById("iaPreviewStep");
  const msg = document.getElementById("iaMsg");
  if(step1) step1.classList.remove("oculto");
  if(step2){ step2.classList.add("oculto"); step2.innerHTML = ""; }
  if(msg) msg.innerHTML = "";
  document.getElementById("modalGenerarIA")?.classList.remove("oculto");
}
async function generarTestIA(){
  const objetivo = document.getElementById("iaObjetivo")?.value?.trim();
  const paraQue = document.getElementById("iaParaQue")?.value?.trim();
  const numPreg = document.getElementById("iaNumPreg")?.value;
  const msg = document.getElementById("iaMsg");
  const btn = document.getElementById("btnGenerarIA");
  if(!objetivo && !paraQue){ if(msg){ msg.style.color="#b91c1c"; msg.textContent="Indica cómo lo quieres y para qué lo quieres"; } return; }
  if(msg){ msg.style.color="#6b7280"; msg.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px; animation: spin 1s linear infinite;"><path d="M12 2a10 10 0 1 0 10 10H12V2Z"/></svg> Generando test con IA...`; }
  if(btn) btn.disabled = true;
  try{
    const result = await apiFetch("/postgres/psicologia/tests-validados/generar-ia", { method: "POST", body: { objetivo, paraQue, numPreguntas: numPreg } });
    _iaPreviewData = result;
    renderIAPreview(result);
    if(msg) msg.innerHTML = "";
  }catch(e){
    if(msg){ msg.style.color="#b91c1c"; msg.innerHTML=`Error: ${escaparHtml(e.message)}`; }
  }finally{ if(btn) btn.disabled = false; }
}
function renderIAPreview(test){
  const step1 = document.getElementById("iaFormStep");
  const step2 = document.getElementById("iaPreviewStep");
  if(step1) step1.classList.add("oculto");
  if(!step2) return;
  step2.classList.remove("oculto");
  const autor = document.getElementById("iaAutor")?.value?.trim() || "Psicologia SAT Escolar";
  step2.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
      <span style="background:#063b91; color:white; font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px;">VISTA PREVIA IA</span>
      <span style="font-size:11px; color:#6b7280;">${test.preguntas.length} preguntas · Max: ${test.puntaje_max} pts</span>
    </div>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:20px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#063b91" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <span style="font-size:15px; font-weight:800; color:#102a56;">${escaparHtml(test.nombre)}</span>
      </div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:6px;">${escaparHtml(test.descripcion)}</div>
      <div style="font-size:11.5px; color:#6b7280;">Autor: ${escaparHtml(autor)} · ${test.preguntas.length} preguntas · Max ${test.puntaje_max} pts</div>
      <div style="font-size:11px; color:#9ca3af; border-top:1px solid #e2e8f0; padding-top:8px; margin-top:8px;">Asi lo veran los estudiantes al responder</div>
    </div>
    <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px; max-height:320px; overflow-y:auto; padding-right:4px;">
      ${test.preguntas.map((p,i) => `
        <div style="background:white; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px;">
          <div style="font-size:13px; font-weight:700; color:#102a56; margin-bottom:8px;">${i+1}. ${escaparHtml(p)}</div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${test.opciones.map(o => `
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#374151; padding:4px 6px; border-radius:6px; cursor:pointer;">
                <input type="radio" name="ia_preview_q${i}" disabled style="accent-color:#063b91; width:14px; height:14px;">
                <span>${escaparHtml(o.texto)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    ${test.rangos?.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; font-weight:700; color:#063b91; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px;">Interpretacion automatica</div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${test.rangos.map(r => `<div style="display:flex; align-items:center; gap:8px; font-size:12px;"><div style="width:8px; height:8px; border-radius:50%; background:${r.color};"></div><span style="color:#374151; font-weight:600;">${r.min}–${r.max}: ${escaparHtml(r.nivel)}</span><span style="color:#6b7280;">— ${escaparHtml(r.recomendacion)}</span></div>`).join("")}
        </div>
      </div>
    ` : ''}
    <div style="display:flex; gap:10px; justify-content:space-between; border-top:1px solid #e5e7eb; padding-top:14px;">
      <button class="btn btn-secondary" onclick="document.getElementById('iaFormStep').classList.remove('oculto'); document.getElementById('iaPreviewStep').classList.add('oculto');">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarTestDesdeIA()" style="padding:10px 24px; font-weight:700;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;margin-right:6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Crear test
      </button>
    </div>
  `;
}
async function guardarTestDesdeIA(){
  if(!_iaPreviewData) return;
  const msg = document.getElementById("iaMsg");
  const autor = document.getElementById("iaAutor")?.value?.trim() || "Psicologia SAT Escolar";
  if(msg){ msg.style.color="#6b7280"; msg.innerHTML="Creando test..."; }
  try{
    const res = await apiFetch("/postgres/psicologia/tests-validados/guardar", { method: "POST", body: { nombre: _iaPreviewData.nombre, descripcion: _iaPreviewData.descripcion, autor: autor, preguntas: _iaPreviewData.preguntas, opciones: _iaPreviewData.opciones, rangos: _iaPreviewData.rangos, puntaje_max: _iaPreviewData.puntaje_max, tiempo: _iaPreviewData.tiempo, validacion: _iaPreviewData.validacion } });
    if(msg){ msg.style.color="#059669"; msg.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M20 6L9 17l-5-5"/></svg>${escaparHtml(res.mensaje || "Test creado")}`; }
    if(window.mostrarToastGlobal) mostrarToastGlobal("Test creado con IA", "ok");
    cerrarModal("modalGenerarIA");
    cargarTestsValidados();
  }catch(e){
    if(msg){ msg.style.color="#b91c1c"; msg.innerHTML=`Error: ${escaparHtml(e.message)}`; }
  }
}

// ── ALERTAS DE RIESGO ─────────────────────────────────────────────────────────
function esHoyAlerta(iso){ const d=new Date(iso), h=new Date(); return d.getFullYear()===h.getFullYear() && d.getMonth()===h.getMonth() && d.getDate()===h.getDate(); }
function toggleAlertas15(){ _alertas15Abierto=!_alertas15Abierto; renderAlertasPsicologa(); }
function toggleAlertas30(){ _alertas30Abierto=!_alertas30Abierto; renderAlertasPsicologa(); }

function renderAlertasPsicologa(){
  const container = document.getElementById("alertasPsicologaLista");
  if(!container) return;
  const alertas = _alertasCache;
  const badge = document.getElementById("badgeAlertasPsicologa");
  if(!alertas || alertas.length===0){
    container.innerHTML = `<div class="card" style="padding:40px 24px; text-align:center;"><div style="margin-bottom:12px; opacity:0.3;"><svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="1.5" style="width:48px;height:48px;"><path d="M20 6L9 17l-5-5"/><circle cx="12" cy="12" r="10"/></svg></div><p style="color:#6b7280; font-size:14px;">Sin alertas pendientes.</p><p style="color:#9ca3af; font-size:12px; margin-top:4px;">Todas las alertas fueron atendidas. Revisa el historial.</p></div>`;
    if(badge) badge.classList.add("oculto");
    return;
  }
  if(badge){ badge.textContent=alertas.length; badge.classList.remove("oculto"); }
  const ahora=Date.now(), hace15=ahora-15*86400000, hace30=ahora-30*86400000;
  const hoyItems=alertas.filter(a=> esHoyAlerta(a.creada_en));
  const items15=alertas.filter(a=> !esHoyAlerta(a.creada_en) && new Date(a.creada_en).getTime()>=hace15);
  const items30=alertas.filter(a=> !esHoyAlerta(a.creada_en) && new Date(a.creada_en).getTime()>=hace30 && new Date(a.creada_en).getTime() < hace15);
  const cntHoy=hoyItems.length, cnt15=items15.length, cnt30=items30.length;

  function etqAlerta(iso){
    const d=new Date(iso), hoy=new Date(); hoy.setHours(0,0,0,0);
    const ayer=new Date(hoy); ayer.setDate(hoy.getDate()-1);
    const f=new Date(d); f.setHours(0,0,0,0);
    if(f.getTime()===hoy.getTime()) return "Hoy";
    if(f.getTime()===ayer.getTime()) return "Ayer";
    return d.toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"});
  }
  function grupoAlertas(arr){
    if(arr.length===0) return `<div style="padding:18px; text-align:center; color:#9ca3af; font-size:12px;">Sin alertas en este rango.</div>`;
    const g={}; arr.forEach(a=>{ const k=new Date(a.creada_en).toISOString().slice(0,10); if(!g[k]) g[k]={label:etqAlerta(a.creada_en),items:[]}; g[k].items.push(a); });
    return Object.entries(g).map(([k,v])=> `<div style="padding:8px 14px 4px; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase;">${v.label}</div>${v.items.map(a=> renderCardAlerta(a)).join("")}`).join("");
  }
  function renderCardAlerta(a){
      const nivel = a.nivel_riesgo || a.nivel || "Medio";
      const cls = { "Alto riesgo": "alto", "En riesgo": "medio", "Regular": "medio", "Alto": "alto", "Medio": "medio", "Bajo": "bajo" }[nivel] || "bajo";
      const colorFondo = cls === 'alto' ? '#fdeceb' : cls === 'medio' ? '#fef3c7' : '#e3f7ee';
      const colorTexto = cls === 'alto' ? '#b91c1c' : cls === 'medio' ? '#92400e' : '#166534';
      const icono = cls === 'alto'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>'
        : cls === 'medio'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>';
      let motivos = [];
      try {
        if (Array.isArray(a.motivos)) motivos = a.motivos;
        else if (typeof a.motivos === 'string') motivos = JSON.parse(a.motivos);
        else if (a.motivos && typeof a.motivos === 'object') motivos = Object.values(a.motivos).flat();
      } catch (_) { motivos = []; }
      motivos = (motivos || []).filter(Boolean);
      return `
        <div class="card alerta-card" data-alerta-id="${a.id}" style="padding:18px; border-left:4px solid ${cls === 'alto' ? '#d4483f' : cls === 'medio' ? '#f2b51d' : '#1f9d6f'}; margin-bottom:10px; transition: opacity 0.3s, transform 0.3s;">
          <div style="display:flex; align-items:flex-start; gap:14px;">
            <div style="width:44px; height:44px; border-radius:12px; background:${colorFondo}; display:grid; place-items:center; flex-shrink:0; color:${colorTexto};">${icono}</div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-weight:700; color:#102a56; font-size:15px;">${escaparHtml(a.estudiante_nombre || `${a.nombres || ''} ${a.apellidos || ''}`.trim() || 'Estudiante')}</span>
                ${a.seccion || a.grado ? `<span class="status-badge" style="background:#edf4ff; color:#063b91;">${escaparHtml(a.seccion || `${a.grado || ''} ${a.letra || ''}`)}</span>` : ''}
                <span class="status-badge ${cls}">${escaparHtml(nivel)}</span>
              </div>
              <div style="font-size:13px; color:#374151; margin-top:6px; font-weight:600;">${escaparHtml(a.tipo || 'Alerta de riesgo')}</div>
              <div style="font-size:12.5px; color:#6b7280; margin-top:2px; line-height:1.5;">${escaparHtml(a.mensaje || '')}</div>
              ${motivos.length > 0 ? `
                <div style="margin-top:12px; background:#f5f8fc; border:1px solid #dce5f2; border-radius:10px; padding:12px 14px;">
                  <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#063b91; margin-bottom:8px;">Rasgos detectados</div>
                  <ul style="list-style:none; display:flex; flex-direction:column; gap:6px; margin:0; padding:0;">
                    ${motivos.map(m => `
                      <li style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:#374151; line-height:1.45;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="${colorTexto}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;margin-top:2px;"><polyline points="9 18 15 12 9 6"/></svg>
                        <span>${escaparHtml(String(m))}</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0;">
              ${a.puntaje_global != null ? `<div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:${colorTexto};">${Number(a.puntaje_global).toFixed(0)}</div><div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Indicador</div></div>` : ''}
              <button class="btn btn-primary btn-sm" onclick="atenderYVerFicha(${a.id}, ${a.estudiante_id}, '${escaparHtml(`${a.nombres || ''} ${a.apellidos || ''}`.trim() || a.estudiante_nombre || '')}')" style="font-size:11px;">Atender &rarr;</button>
            </div>
          </div>
        </div>
      `;
  }

  container.innerHTML = `
    <div style="background:#f9fafb; padding:8px 14px; font-size:11px; font-weight:800; color:#374151; letter-spacing:.3px;">Hoy — ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"})} <span style="font-weight:600; color:#9ca3af;">(${cntHoy})</span></div>
    <div style="max-height:420px; overflow-y:auto; padding:8px; background:white; border-bottom:1px solid #f3f4f6;">${hoyItems.length? grupoAlertas(hoyItems): `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:12px;">Sin alertas hoy.</div>`}</div>
    ${cnt15>0? `<button onclick="toggleAlertas15()" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:${_alertas15Abierto?'#edf4ff':'white'}; border:none; border-bottom:1px solid #f3f4f6; cursor:pointer;"><span style="font-size:13px; font-weight:700; color:${_alertas15Abierto?'#0d63d8':'#111827'};">Últimos 15 días <span style="font-size:11px; font-weight:700; background:${_alertas15Abierto?'#0d63d8':'#f3f4f6'}; color:${_alertas15Abierto?'white':'#6b7280'}; padding:2px 7px; border-radius:999px;">${cnt15}</span></span><span style="font-size:13px; color:#9ca3af; transform:${_alertas15Abierto?'rotate(180deg)':'none'};">▾</span></button><div style="display:${_alertas15Abierto?'block':'none'}; max-height:380px; overflow-y:auto; padding:8px; background:white; border-bottom:1px solid #f3f4f6;">${grupoAlertas(items15)}</div>`:''}
    ${cnt30>0? `<button onclick="toggleAlertas30()" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:${_alertas30Abierto?'#edf4ff':'white'}; border:none; cursor:pointer;"><span style="font-size:13px; font-weight:700; color:${_alertas30Abierto?'#0d63d8':'#111827'};">Últimos 30 días <span style="font-size:11px; font-weight:700; background:${_alertas30Abierto?'#0d63d8':'#f3f4f6'}; color:${_alertas30Abierto?'white':'#6b7280'}; padding:2px 7px; border-radius:999px;">${cnt30}</span></span><span style="font-size:13px; color:#9ca3af; transform:${_alertas30Abierto?'rotate(180deg)':'none'};">▾</span></button><div style="display:${_alertas30Abierto?'block':'none'}; max-height:420px; overflow-y:auto; padding:8px; background:white;">${grupoAlertas(items30)}</div>`:''}
  `;
}

async function cargarAlertasPsicologa(data) {
  const container = document.getElementById("alertasPsicologaLista");
  if (!container) return;
  try {
    if (!data) data = await apiFetch("/postgres/psicologia/alertas?estado=pendiente");
    const alertas = data?.alertas || data || [];
    _alertasCache = Array.isArray(alertas) ? alertas : [];
    _alertas15Abierto=false; _alertas30Abierto=false;
    renderAlertasPsicologa();
  } catch (e) {
    container.innerHTML = `
      <div class="card" style="padding:40px 24px; text-align:center;">
        <div style="margin-bottom:12px; opacity:0.3;"><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" style="width:48px;height:48px;"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
        <p style="color:#6b7280; font-size:14px;">No hay alertas de riesgo por el momento.</p>
      </div>`;
  }
  const _ = (()=>{ const badge=document.getElementById("badgeAlertasPsicologa"); if(badge){ const c=_alertasCache.length; if(c===0) badge.classList.add("oculto"); else {badge.textContent=c; badge.classList.remove("oculto");}}})();
}

async function atenderAlertaPsic(alertaId){
  try{
    localStorage.removeItem('alerta_snoozed_' + alertaId);
    await apiFetch(`/postgres/psicologia/alertas/${alertaId}/atender`,{method:"POST"});
    const card = document.querySelector(`[data-alerta-id="${alertaId}"]`);
    if(card){
      card.style.opacity = "0";
      card.style.transform = "translateX(30px)";
      await new Promise(r => setTimeout(r, 300));
    }
    _alertasCache = _alertasCache.filter(a => a.id !== alertaId);
    _alertasHistorialCache = null;
    renderAlertasPsicologa();
    if(window.mostrarToastGlobal) mostrarToastGlobal("Alerta atendida — movida al historial","ok");
  }catch(e){
    if(window.mostrarToastGlobal) mostrarToastGlobal(e.message,"error");
  }
}

async function atenderYVerFicha(alertaId, estudianteId, nombre){
  await atenderAlertaPsic(alertaId);
  abrirPerfilEstudiante(estudianteId, nombre);
}

let _alertasHistorialCache = null;
let _historialAlertasAbierto = false;
async function toggleHistorialAlertas(){
  _historialAlertasAbierto = !_historialAlertasAbierto;
  const histDiv = document.getElementById("alertasHistorialLista");
  const btn = document.getElementById("btnToggleHistorialAlertas");
  if(!histDiv) return;
  if(_historialAlertasAbierto){
    histDiv.classList.remove("oculto");
    if(btn) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;vertical-align:-1px;margin-right:3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Ocultar historial`;
    await renderHistorialAlertas();
  } else {
    histDiv.classList.add("oculto");
    if(btn) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;vertical-align:-1px;margin-right:3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Historial`;
  }
}
async function renderHistorialAlertas(){
  const cont = document.getElementById("alertasHistorialItems");
  if(!cont) return;
  cont.innerHTML = `<div style="padding:12px; text-align:center; color:#9ca3af; font-size:12px;">Cargando...</div>`;
  try{
    if(!_alertasHistorialCache) _alertasHistorialCache = await apiFetch("/postgres/psicologia/alertas?estado=atendida");
    const alertas = _alertasHistorialCache?.alertas || _alertasHistorialCache || [];
    const items = Array.isArray(alertas) ? alertas : [];
    if(!items.length){
      cont.innerHTML = `<div style="padding:18px; text-align:center; color:#9ca3af; font-size:12px;">Sin alertas atendidas aún.</div>`;
      return;
    }
    cont.innerHTML = items.slice(0, 30).map(a => {
      const nivel = a.nivel || "Medio";
      const cls = { "Alto riesgo": "alto", "En riesgo": "medio", "Regular": "medio", "Alto": "alto", "Medio": "medio", "Bajo": "bajo" }[nivel] || "bajo";
      const colorTexto = cls === 'alto' ? '#b91c1c' : cls === 'medio' ? '#92400e' : '#166534';
      const fechaAtendida = a.atendida_en ? new Date(a.atendida_en).toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : '';
      return `
        <div style="padding:12px 14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; border-left:3px solid #9ca3af; margin-bottom:6px; opacity:0.8;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-weight:600; font-size:13px; color:#374151;">${escaparHtml(a.estudiante_nombre || `${a.nombres || ''} ${a.apellidos || ''}`.trim() || 'Estudiante')}</span>
            <span class="status-badge ${cls}" style="opacity:0.7;">${escaparHtml(nivel)}</span>
            <span style="margin-left:auto; font-size:11px; color:#9ca3af;">Atendida ${fechaAtendida}</span>
          </div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px;">${escaparHtml(a.mensaje || a.tipo || '')}</div>
        </div>
      `;
    }).join("");
  }catch(e){
    cont.innerHTML = `<div style="padding:12px; text-align:center; color:#b91c1c; font-size:12px;">Error cargando historial.</div>`;
  }
}

// ── CHAT ANONIMO ───────────────────────────────────────────────────────────────

async function cargarChatPsicologa(data) {
  const container = document.getElementById("chatPsicologaLista");
  if (!container) return;
  try {
    if (!data) data = await apiFetch("/postgres/psicologia/mensajes");
    const mensajes = data || [];
    if (!mensajes || mensajes.length === 0) {
      container.innerHTML = '<p style="color:#6b7280;padding:16px;">No hay mensajes anonimos.</p>';
      return;
    }
    container.innerHTML = mensajes.map(m => `
      <div class="chat-message" onclick="abrirConversacionPs('${m.tipo || 'estudiante'}', ${m.id})">
        <div style="font-weight:600;color:#1f2937;">${escaparHtml(m.asunto || 'Mensaje anonimo')}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">${escaparHtml((m.mensaje || m.texto || '').substring(0, 80))}...</div>
      </div>
    `).join("");
  } catch (e) {
    container.innerHTML = '<p style="color:#6b7280;padding:16px;">Chat no disponible.</p>';
  }
}

async function abrirConversacionPs(tipo, mensajeId) {
  const vista = document.getElementById("vistaChatConversacion");
  vista?.classList.remove("oculto");
  try {
    const mensaje = await apiFetch(`/postgres/psicologia/mensajes/${tipo}/${mensajeId}`);
    const container = document.getElementById("chatConversacion");
    container.innerHTML = `
      <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:12px;">
        <p style="font-size:13px;color:#374151;">${escaparHtml(mensaje.mensaje || mensaje.texto || '')}</p>
        <p style="font-size:11px;color:#9ca3af;margin-top:6px;">${mensaje.fecha_creacion ? new Date(mensaje.fecha_creacion).toLocaleString() : ''}</p>
      </div>
    `;
    document.getElementById("chatRespuestaBox")?.classList.remove("oculto");
    document.getElementById("chatRespuestaBox").dataset.mensajeId = mensajeId;
    document.getElementById("chatRespuestaBox").dataset.tipo = tipo;
  } catch (e) {
    document.getElementById("chatConversacion").innerHTML = '<p style="color:#6b7280;">Conversacion no disponible.</p>';
  }
}

async function responderChatPsicologa() {
  const box = document.getElementById("chatRespuestaBox");
  const texto = document.getElementById("chatRespuestaTexto")?.value.trim();
  const mensajeId = box?.dataset.mensajeId;
  const tipo = box?.dataset.tipo || 'estudiante';
  if (!texto || !mensajeId) return;
  try {
    await apiFetch(`/postgres/psicologia/mensajes/${tipo}/${mensajeId}/responder`, {
      method: "POST",
      body: { respuesta: texto }
    });
    document.getElementById("chatRespuestaTexto").value = "";
    await cargarChatPsicologa();
    document.getElementById("vistaChatConversacion")?.classList.add("oculto");
    document.getElementById("chatRespuestaBox")?.classList.add("oculto");
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ── MODAL SEGUIMIENTO ──────────────────────────────────────────────────────────

async function abrirPerfilEstudiante(estudianteId, nombre) {
  verPerfilInline(estudianteId, nombre);
}
function volverPerfilInicio() {
  if (typeof _psDashboardCache !== "undefined" && _psDashboardCache) renderizarDashboardInicio(_psDashboardCache);
  else mostrarSeccionPsicologa("ps-inicio");
}
// Perfil en página (Inicio › grado › Perfil), sin ventana flotante ni cambiar de HTML
async function verPerfilInline(estudianteId, nombre) {
  const container = document.getElementById("psInicioContainer");
  if (!container) { window.location.href = `detalle-estudiante.html?id=${estudianteId}`; return; }
  mostrarSeccionPsicologa("ps-inicio");
  container.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:#6b7280;">Cargando perfil...</div>';
  try {
    const [estudiante, seguimiento, riesgo] = await Promise.all([
      apiFetch(`/postgres/psicologia/estudiantes/${estudianteId}/detalle-completo`).catch(() => null),
      apiFetch(`/estudiantes/${estudianteId}/seguimiento`).catch(() => null),
      apiFetch(`/postgres/psicologia/riesgo?estudianteId=${estudianteId}`).catch(() => null)
    ]);
    const fila = Array.isArray(riesgo) ? riesgo.find(r => r.estudiante_id === Number(estudianteId)) : null;
    const det = estudiante?.estudiante || estudiante || {};
    const nivelRiesgo = det.nivel_riesgo || fila?.nivel || 'Sin datos';
    const puntaje = (fila?.puntaje_global ?? estudiante?.indicador?.puntaje_global) != null
      ? Number(fila?.puntaje_global ?? estudiante?.indicador?.puntaje_global).toFixed(1) : null;
    let motivos = [];
    try {
      const fuenteMotivos = fila?.motivos ?? estudiante?.indicador?.motivos;
      if (Array.isArray(fuenteMotivos)) motivos = fuenteMotivos;
      else if (typeof fuenteMotivos === 'string') motivos = JSON.parse(fuenteMotivos);
    } catch (_) {}
    motivos = motivos.filter(Boolean).slice(0, 4);
    const caso = seguimiento?.caso || null;
    const enSeguimiento = caso && caso.estado !== "cerrado";
    const nombreCompleto = `${det.nombres || ''} ${det.apellidos || ''}`.trim() || nombre || 'Estudiante';
    const iniciales = ((nombreCompleto)[0] || 'E').toUpperCase();
    const seccionTxt = det.seccion || (det.grado ? `${det.grado} ${det.letra || ''}`.trim() : '') || 'Sin sección';
    const correoTxt = det.correo || 'Sin correo';
    const gradoLbl = `${det.grado || ''} ${det.letra || ''}`.trim();
    const seccId = det.seccion_id || det.seccionId || null;
    const migaGrado = (seccId && gradoLbl)
      ? ` &rsaquo; <span class="breadcrumb-link" onclick="navegarEstudiantesPsInicio(${seccId}, '${escaparHtml(gradoLbl)}')">${escaparHtml(gradoLbl)}</span>` : '';
    container.innerHTML = `
      <div class="section-head"><h2><span class="breadcrumb-link" onclick="volverPerfilInicio()">Inicio</span>${migaGrado} &rsaquo; Perfil</h2></div>
      <div class="card" style="padding:22px; display:grid; gap:14px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="seg-avatar" style="width:52px; height:52px; font-size:19px; background:${avatarColor(nombreCompleto)}; flex-shrink:0;">${iniciales}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:16px; font-weight:700; color:#102a56;">${escaparHtml(nombreCompleto)}</div>
            <div style="font-size:12.5px; color:#6b7280; margin-top:2px;">${escaparHtml(seccionTxt)}</div>
            <div style="font-size:12.5px; color:#6b7280; margin-top:1px; word-break:break-all;">${escaparHtml(correoTxt)}</div>
          </div>
          <span class="status-badge ${String(nivelRiesgo).includes('Alto') ? 'alto' : String(nivelRiesgo).includes('Medio') || String(nivelRiesgo).includes('Incompleto') ? 'medio' : 'bajo'}">${escaparHtml(nivelRiesgo)}</span>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:130px; background:#f5f8fc; border:1px solid #dce5f2; border-radius:10px; padding:12px;">
            <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#6d7b91;">Indicador global</div>
            <div style="font-size:22px; font-weight:800; color:${puntaje && Number(puntaje) < 60 ? '#d4483f' : puntaje && Number(puntaje) >= 80 ? '#1f9d6f' : '#b08a14'}; margin-top:3px;">${puntaje ?? '—'}</div>
          </div>
          <div style="flex:1; min-width:130px; background:#f5f8fc; border:1px solid #dce5f2; border-radius:10px; padding:12px;">
            <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#6d7b91;">Estado del caso</div>
            <div style="font-size:13px; font-weight:700; color:${enSeguimiento ? '#063b91' : '#6b7280'}; margin-top:6px;">${enSeguimiento ? escaparHtml(caso.estado_etiqueta) : 'Sin seguimiento'}</div>
          </div>
        </div>
        ${motivos.length > 0 ? `<div style="background:#fff8f5; border:1px solid #f5ddd4; border-radius:10px; padding:12px 14px;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#c2410c; margin-bottom:6px;">Señales detectadas</div>
          ${motivos.map(m => `<div style="display:flex; gap:7px; font-size:12px; color:#374151; line-height:1.45; margin-bottom:4px;"><span style="color:#d4483f; font-weight:800;">•</span><span>${escaparHtml(String(m))}</span></div>`).join('')}</div>` : ''}
        <div style="border:1px solid #e5e7eb; border-radius:10px; padding:12px; background:#f9fafb;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#6b7280;">Incidencias</div>
            <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="verIncidenciasEstudiante(${estudianteId})">Ver incidencias</button>
          </div>
          <div id="incidenciasResumen-${estudianteId}" style="font-size:12px; color:#6b7280;">Cargando incidencias...</div>
        </div>
        <div style="border:1px solid #dbeafe; border-radius:10px; padding:12px; background:#f8fbff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#063b91;">Ficha Socioeducativa</div>
            <button class="btn btn-primary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="verFichaSocioeducativa(${estudianteId})">Ver</button>
          </div>
          <div id="fichaResumen-${estudianteId}" style="font-size:12px; color:#6b7280;">Cargando ficha...</div>
        </div>
        <div id="perfilCuestionariosBox">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#063b91; margin-bottom:6px;">Cuestionarios</div>
          <p style="font-size:12px; color:#6b7280;">Cargando...</p>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; border-top:1px solid #e5e7eb; padding-top:12px;">
          <button class="btn btn-secondary" onclick="volverPerfilInicio()">← Volver</button>
          <button class="btn btn-primary" onclick='irASeguimiento(${estudianteId})'>Abrir seguimiento &rarr;</button>
        </div>
      </div>`;
    cargarCuestionariosPerfil(estudianteId);
    cargarIncidenciasResumen(estudianteId);
    cargarFichaResumen(estudianteId);
  } catch (e) {
    container.innerHTML = `<div class="section-head"><h2><span class="breadcrumb-link" onclick="volverPerfilInicio()">Inicio</span> &rsaquo; Perfil</h2></div>
      <div class="card" style="padding:24px; color:#b91c1c;">No se pudo cargar el perfil: ${escaparHtml(e.message)}</div>`;
  }
}
// Destino pendiente entre páginas (detalle → psicologa): abre la sección indicada
function irSeccionDestino() {
  try {
    const d = localStorage.getItem("sat_ps_seccion_destino");
    if (!d) return;
    localStorage.removeItem("sat_ps_seccion_destino");
    psMenuGo(d, null);
  } catch (_) {}
}
// ── SIDEBAR COMPARTIDO: una sola lista para psicologa.html y detalle-estudiante.html ──
const PS_MENU = [
  { sec: 'ps-inicio', label: 'Inicio', icon: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>' },
  { sec: 'ps-respuestas', label: 'Respuestas', icon: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>' },
  { sec: 'ps-formularios', label: 'Formularios', icon: '<path d="M15 4H7a2 2 0 0 0-2 2v13l4-2 3 2 3-2 3 2V9Z"/><path d="M9.5 11.5 11 13l3.5-3.5"/>' },
  { sec: 'ps-tests-validados', label: 'Tests Validados', icon: '<path d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/><path d="M12 12h4"/><path d="M12 16h4"/><path d="M8 12h.01"/><path d="M8 16h.01"/>', pill: 'MINSA' },
  { sec: 'ps-alertas', label: 'Alertas de riesgo', icon: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>', badge: 'badgeAlertasPsicologa' },
  { sec: 'ps-chat', label: 'Chat anonimo', icon: '<path d="M4 5h16v11H8l-4 4V5Z"/>' },
  { sec: 'ps-seguimiento', label: 'Seguimiento', icon: '<path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/>' },
  { sec: 'ps-predicciones', label: 'Predicciones IA', icon: '<path d="M12 2a10 10 0 1 0 10 10H12V2Z"/><path d="M20.66 7A10 10 0 0 0 14 2v6h6.66Z" opacity=".7"/>' },
  { sec: 'ps-derivaciones', label: 'Derivaciones', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11v-6a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v6"/><polyline points="9 11 12 14 15 11"/>', badge: 'badgeDerivaciones' },
  { sec: 'ps-expediente', label: 'Expediente', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
  { sec: 'ps-documentacion', label: 'Documentación', icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
  { sec: 'ps-incidencias', label: 'Incidencias', icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' }
];
function psMenuGo(sec, el) {
  mostrarSeccionPsicologa(sec, el || null);
  if (sec === 'ps-derivaciones' && typeof cargarDerivacionesPendientes === 'function') cargarDerivacionesPendientes();
  if (sec === 'ps-expediente' && typeof expInlineAbrir === 'function') expInlineAbrir();
  if (sec === 'ps-incidencias' && typeof incInlineCargar === 'function') incInlineCargar();
}
function psMenuDet(sec) {
  try { localStorage.setItem('sat_ps_seccion_destino', sec); } catch (_) {}
  window.location.href = 'psicologa.html';
}
function renderMenuPsicologa(active) {
  const nav = document.getElementById('psMenu');
  if (!nav) return;
  nav.innerHTML = PS_MENU.map(m => `
    <div class="menu-item${active === (m.sec || m.fn) ? ' active' : ''}" onclick="${m.sec ? `psMenuGo('${m.sec}',this)` : `${m.fn}()`}">
      <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg></div>
      <span>${m.label}</span>
      ${m.pill ? `<span style="margin-left:auto; background:#dcfce7; color:#166534; font-size:10px; font-weight:700; padding:2px 6px; border-radius:999px;">${m.pill}</span>` : ''}
      ${m.badge ? `<div class="badge" id="${m.badge}">0</div>` : ''}
    </div>`).join('');
  psMenuBadges();
}
function renderMenuDetalle() {
  const nav = document.getElementById('detMenu');
  if (!nav) return;
  const detExp = `abrirExpediente(Number(obtenerEstudianteIdDesdeUrl()), (document.getElementById('detEstudianteNombre')||{}).textContent || 'Estudiante')`;
  nav.innerHTML = PS_MENU.map(m => {
    const act = m.sec ? `psMenuDet('${m.sec}')` : (m.fn === 'abrirModalIncidencia' ? 'abrirModalIncidencia()' : `${m.fn}()`);
    const onclick = (m.label === 'Expediente') ? detExp : act;
    return `<a href="#" onclick="${onclick}; return false;">
      <div class="sidebar-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg></div>
      <span>${m.label}</span>
      ${m.pill ? `<span style="margin-left:auto; background:#dcfce7; color:#166534; font-size:10px; font-weight:700; padding:2px 6px; border-radius:999px;">${m.pill}</span>` : ''}
      ${m.badge ? `<span class="badge" id="${m.badge}" style="margin-left:auto; font-size:10px; font-weight:700; background:rgba(242,181,29,.16); color:#f2b51d; padding:2px 8px; border-radius:999px;">0</span>` : ''}
    </a>`;
  }).join('');
  psMenuBadges();
}
async function psMenuBadges() {
  try {
    const a = await apiFetch('/postgres/psicologia/alertas').catch(() => null);
    const n = a && (a.pendientes ?? (Array.isArray(a.alertas) ? a.alertas.length : 0)) || 0;
    const b = document.getElementById('badgeAlertasPsicologa');
    if (b) b.textContent = n;
  } catch (_) {}
  try {
    const d = await apiFetch('/postgres/derivaciones?estado=pendiente').catch(() => []);
    const n = Array.isArray(d) ? d.length : 0;
    const b = document.getElementById('badgeDerivaciones');
    if (b) { b.textContent = n; b.classList.remove('oculto'); }
  } catch (_) {}
}

async function cargarFichaResumen(estudianteId) {
  const cont = document.getElementById(`fichaResumen-${estudianteId}`);
  if (!cont) return;
  cont.textContent = "Cargando ficha...";
  try {
    const data = await apiFetch(`/postgres/ficha-diagnostica/${estudianteId}`);
    if (!data.completada) {
      cont.innerHTML = "El estudiante aún no completa su ficha.";
      return;
    }
    const nResp = data.datos ? Object.keys(data.datos).filter(k => data.datos[k] !== "" && data.datos[k] != null).length : 0;
    cont.innerHTML = `Completada el ${String(data.ficha?.updated_at || "").slice(0, 10)} · ${nResp} campos respondidos. Pulsa <strong>Ver</strong> para ver todo.`;
  } catch (e) {
    cont.textContent = "No se pudo cargar la ficha";
  }
}
async function cargarIncidenciasResumen(estudianteId) {
  const cont = document.getElementById(`incidenciasResumen-${estudianteId}`);
  if (!cont) return;
  cont.textContent = "Cargando incidencias...";
  try {
    const data = await apiFetch(`/postgres/estudiantes/${estudianteId}/historial`);
    const incs = data.incidencias || [];
    if (!incs.length) {
      cont.innerHTML = `<div style="background:#f9fafb; border:1px dashed #d1d5db; border-radius:8px; padding:10px; text-align:center; color:#6b7280; font-size:12px;">Alumno sin incidencias</div>`;
      return;
    }
    cont.innerHTML = incs.slice(0,3).map(i => `
      <div style="border:1px solid #e5e7eb; border-radius:8px; padding:8px; margin-bottom:6px; background:white;">
        <div style="font-size:11px; color:#6b7280;">${String(i.fecha_incidencia).slice(0,10)} · ${i.tipo}</div>
        <div style="font-size:12px; font-weight:600; color:#111827;">${escaparHtml(i.descripcion)}</div>
        ${i.observacion ? `<div style="font-size:11px; color:#6b7280;">${escaparHtml(i.observacion)}</div>` : ""}
      </div>
    `).join("") + (incs.length > 3 ? `<div style="font-size:11px; color:#6b7280; text-align:center;">+${incs.length - 3} más — Ver incidencias para ver todo</div>` : "");
  } catch (e) {
    cont.textContent = "Error cargando incidencias";
  }
}
async function verIncidenciasEstudiante(estudianteId) {
  const cont = document.getElementById(`incidenciasResumen-${estudianteId}`);
  if (!cont) return;
  cont.innerHTML = `<div style="font-size:12px; color:#6b7280;">Cargando incidencias...</div>`;
  try {
    const data = await apiFetch(`/postgres/estudiantes/${estudianteId}/historial`);
    const incs = data.incidencias || [];
    if (!incs.length) {
      cont.innerHTML = `<div style="background:#f9fafb; border:1px dashed #d1d5db; border-radius:8px; padding:10px; text-align:center; color:#6b7280; font-size:12px;">Alumno sin incidencias</div>`;
      return;
    }
    cont.innerHTML = incs.map(i => `
      <div style="border:1px solid #e5e7eb; border-radius:8px; padding:8px; margin-bottom:6px; background:white;">
        <div style="font-size:11px; color:#6b7280;">${String(i.fecha_incidencia).slice(0,10)} · ${i.tipo} · por ${i.rol_creador || "?"}</div>
        <div style="font-size:12px; font-weight:600; color:#111827;">${escaparHtml(i.descripcion)}</div>
        ${i.observacion ? `<div style="font-size:11px; color:#6b7280;">${escaparHtml(i.observacion)}</div>` : ""}
      </div>
    `).join("");
  } catch (e) {
    cont.innerHTML = `<div style="font-size:12px; color:#b91c1c;">Error: ${e.message}</div>`;
  }
}

function irASeguimiento(estudianteId) {
  cerrarModal("modalIncidentes");
  document.querySelectorAll(".seccion-psicologa").forEach(s => s.classList.add("oculto"));
  document.getElementById("ps-seguimiento")?.classList.remove("oculto");
  document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));
  document.querySelectorAll(".menu-item").forEach(m => {
    const onclick = m.getAttribute("onclick") || "";
    if (onclick.includes("ps-seguimiento")) m.classList.add("active");
  });
  const topbar = document.getElementById("psTopbarTitle");
  const breadcrumb = document.getElementById("psBreadcrumb");
  if (topbar) topbar.textContent = "Seguimiento";
  if (breadcrumb) breadcrumb.textContent = "Gestion de casos de seguimiento";
  verDetalleSeguimiento(estudianteId);
}

async function agregarSeguimiento(estudianteId, nombre) {
  return agregarSeguimientoFlujo(estudianteId, nombre);
}

// ── CUESTIONARIOS EN PERFIL DEL ESTUDIANTE (agrupados por semana) ─────────────

const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function semanaDeFecha(fechaISO) {
  const d = new Date(fechaISO);
  const desplazo = (d.getDay() + 6) % 7;
  const lunes = new Date(d); lunes.setDate(d.getDate() - desplazo);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  const fmt = x => `${DIAS_CORTO[x.getDay()]} ${x.getDate()}/${x.getMonth() + 1}`;
  return { key: lunes.toISOString().slice(0, 10), label: `Semana del ${fmt(lunes)} al ${fmt(domingo)}` };
}

async function cargarCuestionariosPerfil(estudianteId) {
  const box = document.getElementById("perfilCuestionariosBox");
  if (!box) return;
  try {
    const forms = await apiFetch(`/postgres/psicologia/estudiantes/${estudianteId}/cuestionarios`).catch(() => []);
    if (!forms || forms.length === 0) {
      box.innerHTML = `
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#063b91; margin-bottom:6px;">Cuestionarios</div>
        <div style="background:#f5f8fc; border:1px solid #dce5f2; border-radius:10px; padding:14px; text-align:center;">
          <p style="font-size:12px; color:#6b7280;">No hay cuestionarios habilitados para su salon.</p>
        </div>`;
      return;
    }

    // Agrupar por semana (segun creacion del formulario), mas recientes primero
    const grupos = new Map();
    forms.forEach(f => {
      const sem = semanaDeFecha(f.created_at);
      if (!grupos.has(sem.key)) grupos.set(sem.key, { ...sem, items: [] });
      grupos.get(sem.key).items.push(f);
    });
    const semanas = [...grupos.values()].sort((a, b) => b.key.localeCompare(a.key));
    const SEMANAS_VISIBLES = 2;

    const itemHtml = f => {
      const respondido = f.respondido === true || f.respondido === "true";
      const fechaCreacion = f.created_at ? new Date(f.created_at).toLocaleDateString() : "-";
      return respondido ? `
        <div style="display:flex; align-items:center; gap:10px; background:#fff; border:1px solid #dce5f2; border-radius:10px; padding:10px 12px; cursor:pointer; transition:border-color .15s;" onclick="abrirRespuestaDesdePerfil(${estudianteId}, ${f.id})" onmouseover="this.style.borderColor='#0d63d8'" onmouseout="this.style.borderColor='#dce5f2'">
          <svg viewBox="0 0 24 24" fill="none" stroke="#1f9d6f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          <div style="flex:1; min-width:0;">
            <div style="font-size:12.5px; font-weight:600; color:#102a56; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escaparHtml(f.titulo)}</div>
            <div style="font-size:10.5px; color:#6b7280; margin-top:1px;">Creado: ${fechaCreacion}${f.fecha_respuesta ? ` &middot; Respondido: ${new Date(f.fecha_respuesta).toLocaleDateString()}` : ''}</div>
          </div>
          <span class="status-badge bajo">Respondido &middot; ver</span>
        </div>` : `
        <div style="display:flex; align-items:center; gap:10px; background:#f9fafb; border:1px dashed #d1d5db; border-radius:10px; padding:10px 12px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <div style="flex:1; min-width:0;">
            <div style="font-size:12.5px; font-weight:600; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escaparHtml(f.titulo)}</div>
            <div style="font-size:10.5px; color:#9ca3af; margin-top:1px;">Creado: ${fechaCreacion}</div>
          </div>
          <span class="status-badge medio">Pendiente</span>
        </div>`;
    };

    const grupoHtml = (g, visible) => `
      <div class="perfil-semana" data-key="${g.key}" style="${visible ? "" : "display:none;"}">
        <div style="font-size:10.5px; font-weight:700; color:#526276; margin:8px 0 6px;">${escaparHtml(g.label)}</div>
        <div style="display:flex; flex-direction:column; gap:7px;">${g.items.map(itemHtml).join("")}</div>
      </div>`;

    box.innerHTML = `
      <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#063b91; margin-bottom:2px;">Cuestionarios</div>
      ${semanas.slice(0, SEMANAS_VISIBLES).map(g => grupoHtml(g, true)).join("")}
      ${semanas.length > SEMANAS_VISIBLES ? semanas.slice(SEMANAS_VISIBLES).map(g => grupoHtml(g, false)).join("") : ""}
      ${semanas.length > SEMANAS_VISIBLES ? `
        <button id="btnMasSemanas" class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="(function(b){var ocultos=document.querySelectorAll('.perfil-semana');var mostrar=ocultos.length&&getComputedStyle(ocultos[ocultos.length-1]).display==='none';ocultos.forEach(function(x,i){if(i>=${SEMANAS_VISIBLES})x.style.display=mostrar?'block':'none'});b.textContent=mostrar?'Mostrar menos':'Mostrar mas';})(this)">Mostrar mas</button>` : ""}
      <div style="font-size:10.5px; color:#9ca3af; margin-top:6px;">${forms.filter(f => f.respondido).length} de ${forms.length} respondidos</div>
    `;
  } catch (_) {
    box.innerHTML = '<p style="font-size:12px; color:#9ca3af;">Cuestionarios no disponibles.</p>';
  }
}

async function abrirRespuestaDesdePerfil(estudianteId, formularioId) {
  cerrarModal("modalIncidentes");
  document.querySelectorAll(".seccion-psicologa").forEach(s => s.classList.add("oculto"));
  document.getElementById("ps-respuestas")?.classList.remove("oculto");
  document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));
  document.querySelectorAll(".menu-item").forEach(m => {
    const onclick = m.getAttribute("onclick") || "";
    if (onclick.includes("ps-respuestas")) m.classList.add("active");
  });
  ["psRespVistaGrados", "psRespVistaSecciones", "psRespVistaCuestionarios"].forEach(id => document.getElementById(id)?.classList.add("oculto"));
  document.getElementById("psRespVistaDetalle")?.classList.remove("oculto");
  const topbar = document.getElementById("psTopbarTitle");
  if (topbar) topbar.textContent = "Respuestas";

  await verDetalleRespuestasPs(formularioId);
  abrirDetalleRespuestaEstudiante(formularioId, estudianteId);
}

async function abrirDetalleRespuestaEstudiante(formularioId, estudianteId) {
  try {
    const detalle = await apiFetch(`/postgres/psicologia/formularios/${formularioId}/estudiantes/${estudianteId}/respuestas`);
    if (!detalle) { alert("No hay respuesta registrada para este estudiante en este cuestionario."); return; }
    const body = document.getElementById("modalDetalleRespuestaBody");
    const titulo = document.getElementById("modalDetalleRespuestaTitulo");
    titulo.textContent = `${detalle.nombres || "Estudiante"} ${detalle.apellidos || ""} - ${detalle.formulario_titulo || "Cuestionario"}`;

    let html = `<div style="background:#f5f8fc;border:1px solid #dce5f2;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;color:#102a56;">${escaparHtml(detalle.formulario_titulo || "")}</div>
      <div style="font-size:11.5px;color:#6b7280;margin-top:2px;">${detalle.fecha_respuesta ? "Respondido: " + new Date(detalle.fecha_respuesta).toLocaleString() : ""}</div>
    </div><div style="display:grid;gap:12px;">`;
    (detalle.respuestas || []).forEach((r, i) => {
      html += `
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;">${r.tipo === 'cerrada' ? 'Cerrada' : r.tipo === 'likert' ? 'Likert 1-5' : 'Abierta'} · Pregunta ${i + 1}</div>
          <div style="font-size:13px;font-weight:600;color:#374151;margin:4px 0 8px;">${escaparHtml(r.pregunta)}</div>
          <div style="background:#edf5ff;border-left:3px solid #0d63d8;border-radius:8px;padding:9px 12px;font-size:13px;color:#102a56;">${escaparHtml(r.respuesta || "Sin respuesta")}</div>
        </div>`;
    });
    html += "</div>";
    body.innerHTML = html;
    document.getElementById("modalDetalleRespuestaPs")?.classList.remove("oculto");
  } catch (e) {
    alert("Error cargando respuesta: " + e.message);
  }
}

// ── INCIDENTES ─────────────────────────────────────────────────────────────────

async function actualizarBadgeIncidentes() {
  try {
    const incidentes = await apiFetch("/estudiantes/incidentes?nuevos=1");
    const badge = document.getElementById("badgeIncidentes");
    const n = Array.isArray(incidentes) ? incidentes.length : 0;
    if (badge) {
      badge.style.display = n > 0 ? "flex" : "none";
      badge.textContent = n > 0 ? n : "";
    }
  } catch (e) {
    const badge = document.getElementById("badgeIncidentes");
    if (badge) badge.style.display = "none";
  }
}

async function abrirModalIncidentes() {
  const body = document.getElementById("modalIncidentesBody");
  body.innerHTML = '<p style="color:#6b7280;">Cargando...</p>';
  document.getElementById("modalIncidentes")?.classList.remove("oculto");

  try {
    const incidentes = await apiFetch("/estudiantes/incidentes");
    if (!incidentes || !Array.isArray(incidentes) || incidentes.length === 0) {
      body.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px;">No hay incidentes reportados.</p>';
      return;
    }
    body.innerHTML = incidentes.map(inc => `
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:14px;color:#1f2937;">Incidente #${inc.id}</strong>
          <span class="status-badge ${inc.estado === 'pendiente' ? 'medio' : 'bajo'}">${inc.estado}</span>
        </div>
        <p style="font-size:13px;color:#374151;margin-top:6px;">${escaparHtml(inc.descripcion || '')}</p>
        <p style="font-size:11px;color:#9ca3af;margin-top:4px;">${inc.fecha ? new Date(inc.fecha.replace(" ", "T")).toLocaleString() : ''}</p>
      </div>
    `).join("");
  } catch (e) {
    body.innerHTML = '<p style="color:#b91c1c;text-align:center;padding:20px;">Error: ' + escaparHtml(e.message) + '</p>';
  }
}

let _incInlineCache = [];
// Incidencias en página (sección ps-incidencias), sin ventana flotante
async function incInlineCargar() {
  const lista = document.getElementById("incInlineLista");
  const det = document.getElementById("incInlineDetalle");
  if (!lista) return;
  if (det) det.classList.add("oculto");
  lista.classList.remove("oculto");
  lista.innerHTML = '<p style="color:#6b7280; text-align:center; padding:20px;">Cargando incidencias...</p>';
  try {
    const incidentes = await apiFetch("/estudiantes/incidentes");
    _incInlineCache = Array.isArray(incidentes) ? incidentes : [];
    const pendientes = _incInlineCache.filter(i => i.estado === 'pendiente');
    const historial = _incInlineCache.filter(i => i.estado !== 'pendiente');
    try {
      await apiFetch("/estudiantes/incidentes/leer", { method: "POST" });
      if (typeof actualizarBadgeIncidentes === "function") actualizarBadgeIncidentes();
    } catch (_) {}
    if (!_incInlineCache.length) {
      lista.innerHTML = '<div style="background:#f9fafb; border:1px dashed #d1d5db; border-radius:10px; padding:20px; text-align:center; color:#6b7280; font-size:13px;">Sin incidencias reportadas.</div>';
      return;
    }
    const card = inc => `
      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px; background:white; cursor:pointer; transition:border-color .15s;" onmouseover="this.style.borderColor='#0d63d8'" onmouseout="this.style.borderColor='#e5e7eb'" onclick="incInlineDetalle(${inc.id})">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong style="font-size:14px; color:#1f2937;">Incidente #${inc.id}</strong>
          <span class="status-badge ${inc.estado === 'pendiente' ? 'medio' : 'bajo'}">${escaparHtml(inc.estado || 'reportado')}</span>
        </div>
        <p style="font-size:13px; color:#374151; margin-top:6px;">${escaparHtml(String(inc.descripcion || '').slice(0, 140))}${String(inc.descripcion || '').length > 140 ? '…' : ''}</p>
        <p style="font-size:11px; color:#9ca3af; margin-top:4px;">${inc.fecha ? new Date(String(inc.fecha).replace(" ", "T")).toLocaleString() : ''}</p>
      </div>`;
    lista.innerHTML = (pendientes.length
      ? `<div style="font-size:11px; font-weight:800; color:#92400e; text-transform:uppercase; letter-spacing:.5px; margin:4px 0 8px;">Pendientes (${pendientes.length})</div>` + pendientes.map(card).join("")
      : `<div style="background:#eef7f0; border:1px solid #c9e8d2; border-radius:10px; padding:12px; text-align:center; color:#166534; font-size:12px; margin-bottom:8px;">Sin pendientes. Todo revisado.</div>`)
      + (historial.length
        ? `<button onclick="document.getElementById('incInlineHistorial').classList.toggle('oculto')" style="width:100%; margin-top:10px; display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:white; border:1px solid #e5e7eb; border-radius:10px; cursor:pointer;"><span style="font-size:13px; font-weight:700; color:#111827;">Historial de revisadas <span style="font-size:11px; font-weight:700; background:#f3f4f6; color:#6b7280; padding:2px 7px; border-radius:999px;">${historial.length}</span></span><span style="font-size:13px; color:#9ca3af;">▾</span></button><div id="incInlineHistorial" class="oculto" style="display:grid; gap:10px; margin-top:10px;">${historial.map(card).join("")}</div>`
        : "");
  } catch (e) {
    lista.innerHTML = '<p style="color:#b91c1c; text-align:center; padding:20px;">Error: ' + escaparHtml(e.message) + '</p>';
  }
}
function incInlineDetalle(id) {
  const lista = document.getElementById("incInlineLista");
  const det = document.getElementById("incInlineDetalle");
  if (!det) return;
  const inc = _incInlineCache.find(x => x.id === id);
  if (!inc) return;
  if (lista) lista.classList.add("oculto");
  det.classList.remove("oculto");
  det.innerHTML = `
    <button class="btn btn-secondary btn-sm" style="margin-bottom:12px;" onclick="document.getElementById('incInlineDetalle').classList.add('oculto'); document.getElementById('incInlineLista').classList.remove('oculto')">← Volver a incidencias</button>
    <div style="border:1px solid #e5e7eb; border-radius:10px; padding:16px; background:white;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
        <strong style="font-size:15px; color:#102a56;">Incidente #${inc.id}</strong>
        <span class="status-badge ${inc.estado === 'pendiente' ? 'medio' : 'bajo'}">${escaparHtml(inc.estado || 'reportado')}</span>
      </div>
      <p style="font-size:13.5px; color:#1f2937; line-height:1.6;">${escaparHtml(inc.descripcion || '')}</p>
      ${inc.foto_base64 ? `<div style="margin-top:10px;"><img src="${inc.foto_base64}" alt="Evidencia" style="max-width:100%; border-radius:8px; border:1px solid #e5e7eb;"></div>` : ""}
      <p style="font-size:11.5px; color:#6b7280; margin-top:8px;">${inc.fecha ? new Date(String(inc.fecha).replace(" ", "T")).toLocaleString() : ''}${inc.seccion ? ' · ' + escaparHtml(inc.seccion) : ''}</p>
    </div>`;
  det.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarModal(id) {
  document.getElementById(id)?.classList.add("oculto");
}

function cerrarModalSiFondo(event, id) {
  if (event.target.id === id) cerrarModal(id);
}

// ── SEGUIMIENTO ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#2563eb","#7c3aed","#059669","#d97706","#dc2626","#0891b2","#be185d"];

function avatarColor(nombre) {
  let hash = 0;
  for (let i = 0; i < (nombre || "").length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

async function cargarSeguimiento() {
  cargarSidebarUsuario();
  const container = document.getElementById("segListaContainer");
  const detalle = document.getElementById("segDetalleContainer");
  if (!container) return;
  detalle?.classList.add("oculto");
  container.classList.remove("oculto");
  try {
    const [casos, secciones] = await Promise.all([
      apiFetch("/estudiantes/seguimiento/casos").catch(() => []),
      apiFetch("/postgres/psicologia/secciones-asignadas").catch(() => [])
    ]);
    _psSeccionesCache = secciones || [];

    const prioridadCls = { critica: "alto", alta: "alto", media: "medio", baja: "bajo" };
    const estadoCls = { abierto: "alto", en_seguimiento: "medio", cerrado: "bajo" };

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:12px; flex-wrap:wrap;">
        <div>
          <h2 style="font-size:18px; font-weight:700; color:#111827;">Casos de seguimiento</h2>
          <p style="font-size:13px; color:#6b7280;">${(casos || []).length} caso(s) activo(s)</p>
        </div>
        <button class="btn btn-primary" onclick="navegarNuevoSeguimiento()">+ Nuevo seguimiento</button>
      </div>

      ${(casos || []).length === 0 ? `
        <div class="card" style="padding:48px 24px; text-align:center;">
          <p style="color:#6b7280; font-size:14px;">No hay casos de seguimiento activos.</p>
          <button class="btn btn-primary" style="margin-top:14px;" onclick="navegarNuevoSeguimiento()">Crear seguimiento desde estudiantes</button>
        </div>
      ` : `
        <div style="display:grid; gap:12px;">
          ${casos.map(caso => {
            const iniciales = ((caso.nombres || "")[0] || "") + ((caso.apellidos || "")[0] || "");
            const color = avatarColor(caso.nombres + caso.apellidos);
            return `
              <div class="seg-card">
                <div class="seg-header" style="cursor:pointer;" onclick="verDetalleSeguimiento(${caso.estudiante_id})">
                  <div class="seg-avatar" style="background:${color};">${iniciales}</div>
                  <div class="seg-info" style="flex:1;">
                    <h3>${escaparHtml(caso.nombres)} ${escaparHtml(caso.apellidos)}</h3>
                    <p>${caso.grado ? escaparHtml(caso.grado + ' ' + caso.letra) : 'Sin seccion'} &middot; Psicologo: ${escaparHtml(caso.psicologo_nombres || '')} &middot; Actualizado: ${caso.fecha_actualizacion ? new Date(caso.fecha_actualizacion).toLocaleDateString() : '-'}</p>
                  </div>
                  <span class="status-badge ${estadoCls[caso.estado] || 'medio'}">${escaparHtml(caso.estado_etiqueta)}</span>
                  <span class="status-badge ${prioridadCls[caso.nivel_prioridad] || 'medio'}">Prioridad ${escaparHtml(caso.nivel_prioridad)}</span>
                </div>
                <div style="display:flex; gap:8px; justify-content:flex-end; border-top:1px solid #f3f4f6; padding-top:10px; margin-top:10px;">
                  <button class="btn btn-secondary btn-sm" onclick="verDetalleSeguimiento(${caso.estudiante_id})">Abrir</button>
                  <button class="btn btn-secondary btn-sm" onclick="editarEstadoCaso(${caso.estudiante_id}, '${caso.estado}', '${caso.nivel_prioridad}', '${escaparHtml(caso.nombres)} ${escaparHtml(caso.apellidos)}')">Editar estado</button>
                  <button class="btn btn-secondary btn-sm" style="background:#fdeceb; border-color:#f5c6c1; color:#b91c1c;" onclick="cerrarCaso(${caso.estudiante_id}, '${escaparHtml(caso.nombres)} ${escaparHtml(caso.apellidos)}')">Cerrar caso</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `}
    `;
  } catch (e) {
    container.innerHTML = '<div class="card" style="padding:24px; color:#dc2626;">Error: ' + e.message + '</div>';
  }
}

async function navegarNuevoSeguimiento() {
  const container = document.getElementById("segListaContainer");
  const detalle = document.getElementById("segDetalleContainer");
  if (!container) return;
  detalle?.classList.add("oculto");
  container.classList.remove("oculto");

  try {
    const [secciones, estudiantes] = await Promise.all([
      apiFetch("/postgres/psicologia/secciones-asignadas").catch(() => []),
      apiFetch("/postgres/estudiantes")
    ]);
    _psSeccionesCache = secciones || [];

    container.innerHTML = `
      <div style="margin-bottom:20px;">
        <h2 style="font-size:18px; font-weight:700; color:#111827;">Nuevo seguimiento</h2>
        <p style="font-size:13px; color:#6b7280;">Selecciona el salón y luego al estudiante que deseas agregar al seguimiento.</p>
      </div>
      <div class="section-title" style="border-bottom:none;">Salones</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px; margin-bottom:24px;">
        ${(_psSeccionesCache || []).map(s => `
          <div class="card" style="padding:16px; cursor:pointer;" onclick="listarEstudiantesParaSeguimiento(${s.id}, '${escaparHtml((s.grado || '') + ' ' + (s.letra || ''))}')">
            <div style="font-weight:700; font-size:14px; color:#102a56;">${escaparHtml(s.grado || '')} ${escaparHtml(s.letra || '')}</div>
            <div style="font-size:11.5px; color:#6d7b91; margin-top:3px;">Tutor: ${escaparHtml(s.tutor_nombres || '')} ${escaparHtml(s.tutor_apellidos || '')}</div>
          </div>
        `).join("")}
        ${(_psSeccionesCache || []).length === 0 ? '<div class="card" style="padding:24px; color:#6b7280;">No hay secciones asignadas.</div>' : ''}
      </div>
      <div id="segSelectorEstudiantes"></div>
    `;

    if (Array.isArray(estudiantes)) _psEstudiantesCache = estudiantes;
  } catch (e) {
    container.innerHTML = '<div class="card" style="padding:24px; color:#dc2626;">Error: ' + e.message + '</div>';
  }
}

async function listarEstudiantesParaSeguimiento(seccionId, nombreSeccion) {
  const box = document.getElementById("segSelectorEstudiantes");
  if (!box) return;
  box.innerHTML = '<div class="card" style="padding:20px; color:#6b7280;">Cargando estudiantes...</div>';

  let estudiantes = _psEstudiantesCache;
  if (!Array.isArray(estudiantes)) {
    estudiantes = await apiFetch("/postgres/estudiantes").catch(() => []);
    _psEstudiantesCache = estudiantes;
  }
  const delSalon = (estudiantes || []).filter(e => e.seccion_id === seccionId);

  box.innerHTML = `
    <div class="section-title">Estudiantes de ${escaparHtml(nombreSeccion)}</div>
    <div class="card" style="padding:0; overflow:hidden;">
      <table class="student-table">
        <thead><tr><th>Estudiante</th><th>Correo</th><th>Riesgo</th><th>Estado</th><th>Accion</th></tr></thead>
        <tbody>
          ${delSalon.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:20px;">Sin estudiantes en esta seccion.</td></tr>' : ''}
          ${delSalon.map(e => {
            const riesgo = e.nivel_riesgo || "Sin datos";
            const cls = String(riesgo).includes("Alto") ? "alto" : String(riesgo).includes("Medio") ? "medio" : "bajo";
            const enCaso = e.estado_caso && e.estado_caso !== "cerrado";
            return `
              <tr>
                <td><strong>${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</strong></td>
                <td>${escaparHtml(e.correo || '')}</td>
                <td><span class="status-badge ${cls}">${escaparHtml(riesgo)}</span></td>
                <td>${enCaso ? `<span class="status-badge medio">${escaparHtml(e.estado_caso)}</span>` : '<span style="color:#9ca3af;font-size:11.5px;">—</span>'}</td>
                <td style="white-space:nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick="verPerfilDesdeSeguimiento(${e.id})">Ver perfil</button>
                  ${!enCaso ? `<button class="btn btn-primary btn-sm" onclick="agregarSeguimientoFlujo(${e.id}, '${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}')">Agregar</button>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function verPerfilDesdeSeguimiento(estudianteId) {
  const nombre = (() => {
    const e = (_psEstudiantesCache || []).find(x => x.id === estudianteId);
    return e ? `${e.nombres} ${e.apellidos}` : 'Estudiante';
  })();
  await abrirPerfilEstudiante(estudianteId, nombre);
}

let _intImagenBase64 = null;
let _confirmCallback = null;

function mostrarToast(msg, tipo="ok"){
  const c=document.getElementById("toastContainer");
  if(!c){ alert(msg); return; }
  const bg = tipo==="error" ? "#fef2f2" : tipo==="warn" ? "#fffbeb" : "#ecfdf5";
  const bd = tipo==="error" ? "#fecaca" : tipo==="warn" ? "#fde68a" : "#a7f3d0";
  const col= tipo==="error" ? "#b91c1c" : tipo==="warn" ? "#92400e" : "#065f46";
  const icon= tipo==="error" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' : tipo==="warn" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><path d="M20 6L9 17l-5-5"/></svg>';
  const el=document.createElement("div");
  el.style.cssText=`pointer-events:auto; background:${bg}; border:1px solid ${bd}; color:${col}; padding:12px 16px; border-radius:12px; font-size:13px; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,.12); display:flex; align-items:center; gap:10px; min-width:260px; max-width:360px; animation: toastIn .2s ease;`;
  el.innerHTML=`<span style="width:26px;height:26px;border-radius:50%;background:${col};color:white;display:grid;place-items:center;font-size:12px;flex-shrink:0;">${icon}</span><span style="flex:1;">${escaparHtml(msg)}</span>`;
  c.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(-6px)"; el.style.transition=".25s"; setTimeout(()=>el.remove(),260); }, 3200);
}
function mostrarConfirm({titulo, mensaje, btnTexto="Confirmar", btnColor="#dc2626", onConfirm}){
  document.getElementById("modalConfirmTitulo").textContent=titulo;
  document.getElementById("modalConfirmMensaje").textContent=mensaje;
  const btn=document.getElementById("modalConfirmBtn");
  btn.textContent=btnTexto; btn.style.background=btnColor;
  _confirmCallback=onConfirm;
  document.getElementById("modalConfirm")?.classList.remove("oculto");
}
function ejecutarConfirm(){ const cb=_confirmCallback; cerrarModal('modalConfirm'); if(cb) cb(); }

// ── MODAL INTERVENCIÓN ──
function abrirModalIntervencion(estudianteId, nombre){
  document.getElementById("intEstudianteId").value=estudianteId;
  document.getElementById("modalIntervencionTitulo").textContent=`Nueva intervención — ${nombre}`;
  document.getElementById("intTipo").value=""; document.getElementById("intDescripcion").value="";
  document.getElementById("intAcuerdos").value=""; document.getElementById("intEstadoEmocional").value="";
  const rta=document.getElementById("intRasgos"); if(rta){ rta.value=""; const rc=document.getElementById("intRasgosCount"); if(rc) rc.textContent="0"; }
  document.getElementById("intFecha").valueAsDate=new Date(); document.getElementById("intProximaFecha").value="";
  document.getElementById("intDescCount").textContent="0"; document.getElementById("intError").style.display="none";
  _intImagenBase64=null; document.getElementById("intImagen").value=""; quitarImagenIntervencion(true);
  document.getElementById("modalIntervencion")?.classList.remove("oculto");
}
function previewIntervencionImagen(input){
  const f=input.files[0]; if(!f) return;
  if(!["image/jpeg","image/png","image/webp","image/gif"].includes(f.type)){ mostrarToast("Solo JPG, PNG, WebP o GIF","error"); input.value=""; return; }
  if(f.size>5*1024*1024){ mostrarToast("Imagen máx 5 MB","error"); input.value=""; return; }
  const r=new FileReader();
  r.onload=e=>{
    _intImagenBase64=e.target.result;
    document.getElementById("intPreview").src=_intImagenBase64;
    document.getElementById("intPreviewName").textContent=`${f.name} · ${(f.size/1024).toFixed(0)} KB`;
    document.getElementById("intDropPlaceholder").style.display="none";
    document.getElementById("intPreviewWrap").style.display="block";
  };
  r.readAsDataURL(f);
}
function quitarImagenIntervencion(silent){
  _intImagenBase64=null;
  const inp=document.getElementById("intImagen"); if(inp) inp.value="";
  const ph=document.getElementById("intDropPlaceholder"), pw=document.getElementById("intPreviewWrap");
  if(ph) ph.style.display="block"; if(pw) pw.style.display="none";
  if(!silent) mostrarToast("Imagen quitada","warn");
}
document.addEventListener("DOMContentLoaded",()=>{
  const dz=document.getElementById("intDropZone");
  if(dz){
    dz.addEventListener("dragover",e=>{e.preventDefault(); dz.style.borderColor="#0d63d8"; dz.style.background="#f0f7ff";});
    dz.addEventListener("dragleave",e=>{dz.style.borderColor="#cbd5e1"; dz.style.background="#f8fafc";});
    dz.addEventListener("drop",e=>{ e.preventDefault(); dz.style.borderColor="#cbd5e1"; dz.style.background="#f8fafc"; const f=e.dataTransfer.files[0]; if(f){ const dt=new DataTransfer(); dt.items.add(f); document.getElementById("intImagen").files=dt.files; previewIntervencionImagen(document.getElementById("intImagen")); }});
  }
  document.getElementById("intDescripcion")?.addEventListener("input",e=>{ document.getElementById("intDescCount").textContent=String(e.target.value.length); });
  document.getElementById("intRasgos")?.addEventListener("input",e=>{
    const w = e.target.value.trim() ? e.target.value.trim().split(/\s+/).filter(Boolean).length : 0;
    const c=document.getElementById("intRasgosCount"); if(c){ c.textContent=String(w); c.style.color = w>1500 ? "#dc2626" : "#9ca3af"; }
    if(w>1500){ e.target.value = e.target.value.trim().split(/\s+/).slice(0,1500).join(" "); if(c) c.textContent="1500"; }
  });
});

async function guardarIntervencion(){
  const estudianteId=Number(document.getElementById("intEstudianteId").value);
  const tipo=document.getElementById("intTipo").value;
  const descripcion=document.getElementById("intDescripcion").value.trim();
  const acuerdos=document.getElementById("intAcuerdos").value.trim();
  const estadoEmocional=document.getElementById("intEstadoEmocional").value;
  const rasgos=document.getElementById("intRasgos")?.value.trim() || null;
  const fechaIntervencion=document.getElementById("intFecha").value || null;
  const proximaFecha=document.getElementById("intProximaFecha").value || null;
  const err=document.getElementById("intError");
  if(!tipo){ err.textContent="Selecciona el tipo de intervención."; err.style.display="block"; return; }
  if(!descripcion){ err.textContent="La descripción es obligatoria."; err.style.display="block"; return; }
  if(descripcion.length>5000){ err.textContent="Máximo 5000 caracteres."; err.style.display="block"; return; }
  err.style.display="none";
  const btn=document.getElementById("btnGuardarIntervencion");
  btn.disabled=true; btn.textContent="Guardando...";
  try{
    await apiFetch("/estudiantes/seguimiento",{
      method:"POST",
      body:{
        estudianteId, estado:"en_seguimiento", tipoIntervencion:tipo, descripcion,
        acuerdos: acuerdos||null, estadoEmocional: estadoEmocional||null,
        rasgosAdolescente: rasgos, fechaIntervencion, proximaFecha,
        fotoBase64: _intImagenBase64 || null
      }
    });
    cerrarModal('modalIntervencion');
    mostrarToast("Intervención registrada correctamente.");
    verDetalleSeguimiento(estudianteId);
  }catch(e){ err.textContent=e.message; err.style.display="block"; mostrarToast(e.message,"error"); }
  finally{ btn.disabled=false; btn.textContent="Guardar intervención"; }
}

async function editarEstadoCaso(estudianteId, estadoActual, prioridadActual, nombre) {
  document.getElementById("editEstadoEstudianteId").value=estudianteId;
  document.getElementById("modalEditarEstadoSub").textContent=`${nombre} · Actual: ${estadoActual} / ${prioridadActual}`;
  document.getElementById("editEstado").value=estadoActual;
  document.getElementById("editPrioridad").value=prioridadActual;
  document.getElementById("editEstadoError").style.display="none";
  document.getElementById("modalEditarEstado")?.classList.remove("oculto");
}
async function guardarEdicionEstado(){
  const estudianteId=Number(document.getElementById("editEstadoEstudianteId").value);
  const estado=document.getElementById("editEstado").value;
  const nivelPrioridad=document.getElementById("editPrioridad").value;
  const observacion=document.getElementById("editEstadoObservacion")?.value.trim() || "";
  const err=document.getElementById("editEstadoError");
  if(!observacion){ err.textContent="Debes escribir la observación de por qué cambias el estado (mínimo 10 caracteres)."; err.style.display="block"; document.getElementById("editEstadoObservacion")?.focus(); return; }
  if(observacion.length < 10){ err.textContent="Observación muy corta: explica el motivo del cambio."; err.style.display="block"; return; }
  err.style.display="none";
  try{
    await apiFetch(`/estudiantes/${estudianteId}/seguimiento/estado`,{method:"PUT", body:{ estado, nivelPrioridad, observacion }});
    cerrarModal('modalEditarEstado');
    mostrarToast("Estado actualizado.");
    // limpiar
    const ta=document.getElementById("editEstadoObservacion"); if(ta) ta.value=""; const cc=document.getElementById("editObsCount"); if(cc) cc.textContent="0";
    cargarSeguimiento();
  }catch(e){ err.textContent=e.message; err.style.display="block"; mostrarToast(e.message,"error"); }
}
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("editEstadoObservacion")?.addEventListener("input",e=>{
    const c=document.getElementById("editObsCount"); if(c) c.textContent=String(e.target.value.length);
  });
});

async function cerrarCaso(estudianteId, nombre) {
  mostrarConfirm({
    titulo:`¿Cerrar caso de ${nombre}?`,
    mensaje:"El estudiante pasará a estado Estable. Podrás reabrirlo con una nueva intervención.",
    btnTexto:"Cerrar caso", btnColor:"#dc2626",
    onConfirm: async ()=>{
      try{
        await apiFetch(`/estudiantes/${estudianteId}/seguimiento/cerrar`,{method:"POST"});
        mostrarToast("Caso cerrado correctamente.");
        cargarSeguimiento();
      }catch(e){ mostrarToast(e.message,"error"); }
    }
  });
}

async function agregarSeguimientoFlujo(estudianteId, nombre) {
  abrirModalIntervencion(estudianteId, nombre);
}

async function registrarIntervencion(estudianteId, nombre) {
  await agregarSeguimientoFlujo(estudianteId, nombre);
}

async function verDetalleSeguimiento(estudianteId) {
  const container = document.getElementById("segDetalleContainer");
  const lista = document.getElementById("segListaContainer");
  if (!container) return;
  lista?.classList.add("oculto");
  container.classList.remove("oculto");

  container.innerHTML = '<div class="card" style="padding:40px; text-align:center;">Cargando...</div>';

  try {
    const [estudiantes, secciones, historial] = await Promise.all([
      apiFetch("/postgres/estudiantes"),
      apiFetch("/postgres/psicologia/secciones-asignadas").catch(() => []),
      apiFetch(`/estudiantes/${estudianteId}/seguimiento`).catch(() => null)
    ]);

    const estudiante = (estudiantes || []).find(e => e.id === estudianteId);
    if (!estudiante) {
      container.innerHTML = '<div class="card" style="padding:24px; color:#dc2626;">Estudiante no encontrado.</div>';
      return;
    }

    const sec = (secciones || []).find(s => s.id === estudiante.seccion_id) || {};
    const color = avatarColor(estudiante.nombres + estudiante.apellidos);
    const iniciales = ((estudiante.nombres || "")[0] || "") + ((estudiante.apellidos || "")[0] || "");
    const caso = historial?.caso || null;
    const historialItems = historial?.historial || [];
    const estadoCaso = caso?.estado_etiqueta || "Sin seguimiento";

    container.innerHTML = `
      <div class="breadcrumb">
        <a onclick="cargarSeguimiento(); document.getElementById('segDetalleContainer').classList.add('oculto'); document.getElementById('segListaContainer').classList.remove('oculto');">Seguimiento</a>
        <span>&rsaquo;</span>
        <strong>${escaparHtml(estudiante.nombres)} ${escaparHtml(estudiante.apellidos)}</strong>
      </div>

      <div class="card" style="padding:24px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
          <div class="seg-avatar" style="background:${color}; width:56px; height:56px; font-size:20px;">${iniciales}</div>
          <div>
            <h2 style="font-size:18px; font-weight:700; color:#111827; margin:0;">${escaparHtml(estudiante.nombres)} ${escaparHtml(estudiante.apellidos)}</h2>
            <p style="font-size:13px; color:#6b7280; margin:2px 0 0 0;">${sec.grado ? sec.grado + ' ' + sec.letra : 'Sin seccion'} &middot; ${escaparHtml(estudiante.correo || '')}</p>
          </div>
          <span class="status-badge ${(estudiante.nivel_riesgo || '').includes('Alto') ? 'alto' : (estudiante.nivel_riesgo || '').includes('Riesgo') || (estudiante.nivel_riesgo || '').includes('Regular') ? 'medio' : 'bajo'}" style="margin-left:auto;">${estudiante.nivel_riesgo || 'Sin evaluar'}</span>
        </div>
        ${caso ? `
          <div style="display:flex; align-items:center; justify-content:space-between; background:#f9fafb; border-radius:10px; padding:14px; border:1px solid #f3f4f6; gap:12px; flex-wrap:wrap;">
            <div>
              <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:600; letter-spacing:0.5px; margin-bottom:6px;">Estado del caso</div>
              <div style="font-size:15px; font-weight:600; color:#1f2937;">${caso.estado_etiqueta} &middot; Prioridad ${caso.nivel_prioridad || 'media'}</div>
              <div style="font-size:12px; color:#6b7280; margin-top:4px;">Actualizado: ${caso.fecha_actualizacion ? new Date(caso.fecha_actualizacion).toLocaleDateString() : '-'}</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" onclick="registrarIntervencion(${estudianteId}, '${escaparHtml(estudiante.nombres)} ${escaparHtml(estudiante.apellidos)}')">+ Intervencion</button>
              <button class="btn btn-secondary btn-sm" onclick="editarEstadoCaso(${estudianteId}, '${caso.estado}', '${caso.nivel_prioridad || 'media'}', '${escaparHtml(estudiante.nombres)} ${escaparHtml(estudiante.apellidos)}')">Editar estado</button>
              <button class="btn btn-secondary btn-sm" style="background:#fdeceb; border-color:#f5c6c1; color:#b91c1c;" onclick="cerrarCaso(${estudianteId}, '${escaparHtml(estudiante.nombres)} ${escaparHtml(estudiante.apellidos)}')">Cerrar caso</button>
            </div>
          </div>
        ` : `
          <div style="display:flex; align-items:center; justify-content:space-between; background:#f9fafb; border-radius:10px; padding:14px; border:1px solid #f3f4f6; gap:12px; flex-wrap:wrap;">
            <div style="font-size:13px; color:#6b7280;">Este estudiante no tiene un caso de seguimiento abierto.</div>
            <button class="btn btn-primary btn-sm" onclick="agregarSeguimientoFlujo(${estudianteId}, '${escaparHtml(estudiante.nombres)} ${escaparHtml(estudiante.apellidos)}')">Abrir caso de seguimiento</button>
          </div>
        `}
      </div>

      <div class="card" style="padding:22px; overflow:hidden;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
          <h3 style="font-size:16px; font-weight:800; color:#111827; display:flex; align-items:center; gap:10px;">
            <span style="width:32px;height:32px;border-radius:9px;background:#edf4ff;display:grid;place-items:center;color:#0d63d8;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg></span>
            Historial de intervenciones
            <span style="font-size:11px; font-weight:700; background:#f3f4f6; color:#6b7280; padding:3px 8px; border-radius:999px;">${historialItems.length}</span>
          </h3>
        </div>
        ${historialItems.length > 0 ? `
          <div style="position:relative; padding-left:22px;">
            <div style="position:absolute; left:7px; top:6px; bottom:6px; width:2px; background:linear-gradient(180deg,#dbeafe,#e5e7eb); border-radius:999px;"></div>
            <div style="display:grid; gap:14px;">
            ${historialItems.map((h, idx) => {
              const isFirst = idx===0;
              return `
              <div style="position:relative; background:${isFirst?'linear-gradient(135deg,#f8fbff,#ffffff)':'#ffffff'}; border:1px solid ${isFirst?'#dbeafe':'#eef2f7'}; border-radius:14px; padding:16px 16px 14px; box-shadow:${isFirst?'0 4px 16px rgba(13,99,216,.08)':'0 2px 8px rgba(0,0,0,.04)'};">
                <div style="position:absolute; left:-21px; top:18px; width:12px; height:12px; border-radius:50%; background:${isFirst?'#0d63d8':'#9ca3af'}; border:2px solid white; box-shadow:0 0 0 3px ${isFirst?'#dbeafe':'#f3f4f6'};"></div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                  <span style="font-size:11px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; padding:4px 9px; border-radius:999px; background:${h.tipo_intervencion==='Entrevista'?'#edf4ff':h.tipo_intervencion==='Observacion'?'#fef3c7':'#ecfdf5'}; color:${h.tipo_intervencion==='Entrevista'?'#0d63d8':h.tipo_intervencion==='Observacion'?'#92400e':'#065f46'}; border:1px solid ${h.tipo_intervencion==='Entrevista'?'#dbeafe':h.tipo_intervencion==='Observacion'?'#fde68a':'#a7f3d0'};">${escaparHtml(h.tipo_intervencion || 'Intervención')}</span>
                  ${h.fecha_intervencion ? `<span style="font-size:11px; color:#9ca3af; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${new Date(h.fecha_intervencion).toLocaleString("es-PE",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span>` : ''}
                  ${h.estado_emocional ? `<span style="font-size:11px; padding:3px 8px; border-radius:999px; background:#f3f4f6; color:#374151; border:1px solid #e5e7eb;">${escaparHtml(h.estado_emocional)}</span>` : ''}
                </div>
                <p style="font-size:13.5px; color:#1f2937; line-height:1.55; margin:0 0 8px;">${escaparHtml(h.descripcion || '')}</p>
                ${h.rasgos_adolescente ? `<div style="background:#f0f7ff; border:1px solid #dbeafe; border-radius:10px; padding:10px 12px; margin-top:8px;"><div style="font-size:11px; font-weight:700; color:#0d63d8; text-transform:uppercase; letter-spacing:.3px; margin-bottom:4px;">Rasgos del adolescente</div><div style="font-size:12.5px; color:#1e3a5f;">${escaparHtml(h.rasgos_adolescente)}</div></div>` : ''}
                ${h.acuerdos ? `<div style="background:#f9fafb; border:1px solid #eef2f7; border-radius:10px; padding:10px 12px; margin-top:8px;"><div style="font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.3px; margin-bottom:4px;">Acuerdos</div><div style="font-size:12.5px; color:#374151;">${escaparHtml(h.acuerdos)}</div></div>` : ''}
                ${h.observaciones_adicionales ? `<div style="font-size:12px; color:#6b7280; margin-top:8px; font-style:italic;">${escaparHtml(h.observaciones_adicionales)}</div>` : ''}
                ${(h.evidencia_base64 || h.foto_base64) ? `<div style="margin-top:12px;"><img src="${h.evidencia_base64 || h.foto_base64}" alt="Evidencia" style="max-width:100%; max-height:260px; border-radius:12px; border:1px solid #e5e7eb; cursor:zoom-in;" onclick="window.open(this.src,'_blank')"><div style="font-size:11px; color:#9ca3af; margin-top:4px;">Evidencia adjunta · click para ampliar</div></div>` : ''}
                ${h.psicologo_nombres ? `<div style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:11.5px; color:#6b7280;"><span style="width:20px;height:20px;border-radius:50%;background:#edf4ff;display:grid;place-items:center;color:#0d63d8; font-size:10px; font-weight:700;">${(h.psicologo_nombres[0]||'').toUpperCase()}</span>Por: ${escaparHtml(h.psicologo_nombres)} ${escaparHtml(h.psicologo_apellidos||'')}</div>` : ''}
                ${h.proxima_fecha ? `<div style="margin-top:10px; display:inline-flex; align-items:center; gap:6px; background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:600;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>Próxima: ${new Date(h.proxima_fecha).toLocaleDateString("es-PE")}</div>` : ''}
              </div>
            `}).join("")}
            </div>
          </div>
        ` : `
          <div style="text-align:center; padding:36px 20px; background:#f9fafb; border:1px dashed #e5e7eb; border-radius:14px;">
            <div style="width:48px;height:48px;border-radius:12px;background:white;border:1px solid #eef2f7;display:grid;place-items:center;margin:0 auto 10px;color:#9ca3af;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
            <p style="font-size:13px; font-weight:600; color:#374151;">Sin intervenciones aún</p>
            <p style="font-size:12px; color:#9ca3af; margin-top:4px;">Registra la primera intervención para este estudiante.</p>
          </div>
        `}
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<div class="card" style="padding:24px; color:#dc2626;">Error: ' + e.message + '</div>';
  }
}


// ── PREDICCIONES IA ────────────────────────────────────────────────────────────

async function cargarPredicciones() {
  const selSeccion = document.getElementById("predSeccion");
  const selEst = document.getElementById("predEstudiante");
  if (!selSeccion) return;

  try {
    let secciones = _psSeccionesCache;
    if (!secciones || secciones.length === 0) {
      secciones = await apiFetch("/postgres/psicologia/secciones-asignadas");
      _psSeccionesCache = secciones;
    }
    selSeccion.innerHTML = `<option value="">Todas las secciones</option>` +
      secciones.map(s => `<option value="${s.id}">${s.nivel} ${s.grado}° "${s.letra}"</option>`).join("");
  } catch (e) {
    selSeccion.innerHTML = `<option value="">Error cargando secciones</option>`;
  }
  // Historial activo antes de predecir: si hay estudiante seleccionado, su historial; si no, historial de hoy (para no olvidar a quién predijiste)
  if (selEst?.value) cargarHistorialPredicciones(selEst.value);
  else {
    cargarHistorialHoy();
  }
  // asegurar listener para auto-cargar historial al cambiar estudiante
  if (selEst && !selEst.dataset.histBound) {
    selEst.addEventListener("change", () => {
      const id = selEst.value;
      if (id) cargarHistorialPredicciones(id);
      else {
        cargarHistorialHoy();
      }
    });
    selEst.dataset.histBound = "1";
  }
  const ta = document.getElementById("predRasgos");
  if (ta && !ta.dataset.bound) {
    ta.addEventListener("input", () => {
      const w = ta.value.trim() ? ta.value.trim().split(/\s+/).filter(Boolean).length : 0;
      const c = document.getElementById("predRasgosCount");
      if (c){ c.textContent = String(w); c.style.color = w>1500 ? "#dc2626" : "#9ca3af"; }
      if(w>1500){ ta.value = ta.value.trim().split(/\s+/).slice(0,1500).join(" "); if(c) c.textContent="1500"; }
    });
    ta.dataset.bound = "1";
  }
}

async function cargarEstudiantesPrediccion() {
  const seccionId = document.getElementById("predSeccion")?.value;
  const selEst = document.getElementById("predEstudiante");
  if (!selEst) return;

  if (!seccionId) {
    selEst.innerHTML = `<option value="">Seleccionar estudiante</option>`;
    cargarHistorialHoy();
    return;
  }

  try {
    const estudiantes = await apiFetch("/postgres/estudiantes?seccionId=" + seccionId);
    selEst.innerHTML = `<option value="">Seleccionar estudiante</option>` +
      estudiantes.map(e => `<option value="${e.id}">${e.apellidos}, ${e.nombres}</option>`).join("");
    // auto-cargar historial si ya estaba seleccionado (no aplica tras recarga, pero por si acaso)
    if (selEst.value) cargarHistorialPredicciones(selEst.value);
  } catch (e) {
    selEst.innerHTML = `<option value="">Error cargando estudiantes</option>`;
  }
}

async function generarPrediccion() {
  const estudianteId = document.getElementById("predEstudiante")?.value;
  if (!estudianteId) {
    alert("Selecciona un estudiante primero");
    return;
  }

  const btn = document.getElementById("btnGenerarPrediccion");
  const resultado = document.getElementById("prediccionResultado");
  const historial = document.getElementById("prediccionHistorial");

  btn.disabled = true;
  btn.textContent = "Analizando...";
  resultado.classList.remove("oculto");
  resultado.innerHTML = `
    <div class="card" style="padding:40px; text-align:center;">
      <div style="margin-bottom:12px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--azul)" stroke-width="1.5" style="animation: spin 1s linear infinite;">
          <path d="M12 2a10 10 0 1 0 10 10H12V2Z"/>
        </svg>
      </div>
      <p style="color:#6b7280; font-size:14px;">La IA esta analizando los datos del estudiante...</p>
      <p style="color:#9ca3af; font-size:12px; margin-top:4px;">Esto puede tomar 10-30 segundos</p>
    </div>
    <style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
  `;

  const rasgosLibre = document.getElementById("predRasgos")?.value.trim() || "";
  const checks = [...document.querySelectorAll(".predRasgoCheck:checked")].map(c => c.value);
  const rasgosEstruct = checks.join(", ");
  const rasgos = [rasgosLibre, rasgosEstruct].filter(Boolean).join(" | ");
  const rasgosParaEnviar = rasgos || null;
  try {
    const data = await apiFetch("/postgres/psicologia/predicciones/estudiantes/" + estudianteId, {
      method: "POST",
      body: rasgosParaEnviar ? { rasgos: rasgosParaEnviar, rasgos_estructurados: rasgosEstruct || null } : {}
    });

    mostrarPrediccion(data.prediccion, resultado, document.getElementById("predEstudiante")?.options[document.getElementById("predEstudiante")?.selectedIndex]?.text);
    _prediccionActual = data.prediccion;
    _prediccionNombreEstudiante = document.getElementById("predEstudiante")?.options[document.getElementById("predEstudiante")?.selectedIndex]?.text || "";
    if (historial) cargarHistorialPredicciones(estudianteId);
    // vaciar caja de rasgos para no tener que borrar manual
    const taR = document.getElementById("predRasgos");
    if (taR) { taR.value = ""; const cc = document.getElementById("predRasgosCount"); if (cc) cc.textContent = "0"; }
  } catch (e) {
    resultado.innerHTML = `
      <div class="card" style="padding:24px; border-left:4px solid #dc2626;">
        <h3 style="font-size:14px; font-weight:700; color:#dc2626; margin-bottom:8px;">Error al generar prediccion</h3>
        <p style="font-size:13px; color:#6b7280;">${escaparHtml(e.message)}</p>
        ${e.message.includes("API key") ? `
          <p style="font-size:12px; color:#9ca3af; margin-top:8px;">
            Configure GEMINI_API_KEY en las variables de entorno del servidor.
          </p>
        ` : ''}
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generar prediccion";
  }
}

function mostrarPrediccion(pred, container, nombreEstudiante) {
  const nivelColor = { Bajo: "#059669", Medio: "#d97706", Alto: "#dc2626" };
  const nivelBg = { Bajo: "#ecfdf5", Medio: "#fffbeb", Alto: "#fef2f2" };
  const nivelBorder = { Bajo: "#a7f3d0", Medio: "#fde68a", Alto: "#fecaca" };
  const probColor = { Alta: "#dc2626", Media: "#d97706", Baja: "#059669" };
  const prioColor = { Alta: "#dc2626", Media: "#d97706", Baja: "#059669" };

  const nivel = pred.nivel_riesgo_predicho || "Medio";
  const confianza = pred.confianza || 0;
  const tp = pred.tendencia_principal || null;
  const tend = pred.tendencias || null;
  const ramaLabel = { alcoholismo: "Alcoholismo", drogadicción: "Drogadicción", violencia_familiar: "Violencia familiar", vandalismo: "Vandalismo", sin_señal_clara: "Sin señal clara" };

  container.innerHTML = `
    <div class="card" style="padding:24px; border:2px solid ${nivelBorder[nivel]}; background:${nivelBg[nivel]};">
      ${tp ? `
        <div style="margin-bottom:14px; padding:12px 14px; background:white; border:1px solid #e5e7eb; border-radius:10px;">
          <div style="font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px;">Tendencia principal — anticipación, no diagnóstico</div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="background:#102a56; color:white; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:800;">${escaparHtml(ramaLabel[tp.rama] || tp.rama || "—")}</span>
            <span style="font-size:11px; color:#6b7280;">confianza ${tp.confianza ?? 0}%</span>
          </div>
          ${tp.justificacion ? `<div style="font-size:12px; color:#374151; margin-top:6px; line-height:1.5;">${escaparHtml(tp.justificacion)}</div>` : ""}
          ${tend ? `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-top:10px;">
            ${Object.entries({ alcohol: "Alcohol", droga: "Droga", violencia_familiar: "Violencia fam.", vandalismo: "Vandalismo" }).map(([k,label]) => {
              const v = Number(tend[k] ?? 0);
              const col = v >= 60 ? "#dc2626" : v >= 30 ? "#d97706" : "#059669";
              return `<div style="font-size:10px;"><div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span style="color:#6b7280; font-weight:600;">${label}</span><span style="font-weight:700; color:${col};">${v}%</span></div><div style="height:6px; background:#f3f4f6; border-radius:999px; overflow:hidden;"><div style="width:${v}%; height:100%; background:${col};"></div></div></div>`;
            }).join("")}
          </div>` : ""}
          <div style="font-size:10px; color:#9ca3af; margin-top:6px; font-style:italic;">La observación del docente en comportamiento (ej. "juega mucho, daño") y los rasgos del psicólogo alimentan esta tendencia. Requiere entrevista clínica para confirmar.</div>
        </div>
      ` : ""}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; color:#111827; margin-bottom:4px;">Resultado del analisis predictivo</h3>
          <p style="font-size:12px; color:#6b7280;">${pred.created_at ? new Date(pred.created_at).toLocaleString() : ''} · Modelo: ${pred.modelo || 'Gemini'}</p>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button onclick="descargarPrediccion(_prediccionActual, _prediccionNombreEstudiante); event.stopPropagation();"
            style="display:flex; align-items:center; gap:5px; padding:7px 12px; border-radius:8px; border:1px solid #d1d5db; background:white; cursor:pointer; font-size:12px; font-weight:600; color:#374151;"
            onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar
          </button>
          <button onclick="limpiarAnalisis(); event.stopPropagation();"
            style="display:flex; align-items:center; gap:5px; padding:7px 12px; border-radius:8px; border:1px solid #e5e7eb; background:#f9fafb; cursor:pointer; font-size:12px; font-weight:600; color:#6b7280;"
            onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='#f9fafb'" title="Oculta el resultado actual (no borra el historial)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            Análisis leído
          </button>
          <div style="text-align:center; padding:12px 20px; border-radius:12px; background:white; border:2px solid ${nivelColor[nivel]};">
            <div style="font-size:22px; font-weight:800; color:${nivelColor[nivel]};">${nivel.toUpperCase()}</div>
            <div style="font-size:11px; color:#6b7280; margin-top:2px;">Riesgo predicho</div>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
        <div style="background:white; border-radius:10px; padding:10px 16px; border:1px solid ${nivelBorder[nivel]};">
          <span style="font-size:11px; color:#6b7280;">Confianza</span>
          <div style="font-size:18px; font-weight:700; color:${nivelColor[nivel]};">${confianza}%</div>
        </div>
      </div>

      ${pred.resumen ? `
        <div style="background:white; border-radius:10px; padding:14px 16px; margin-bottom:16px; border:1px solid #e5e7eb;">
          <h4 style="font-size:12px; font-weight:700; color:#374151; margin-bottom:6px;">RESUMEN — Qué está pasando</h4>
          <p style="font-size:13px; color:#4b5563; line-height:1.5;">${escaparHtml(pred.resumen)}</p>
        </div>
      ` : ''}
      ${(pred.rasgos_adolescente || (pred.datos_entrada && (typeof pred.datos_entrada==='string' ? JSON.parse(pred.datos_entrada).rasgos_adolescente : pred.datos_entrada.rasgos_adolescente))) ? `
        <div style="background:#f0f7ff; border:1px solid #dbeafe; border-radius:10px; padding:14px 16px; margin-bottom:16px;">
          <h4 style="font-size:11px; font-weight:800; color:#0d63d8; text-transform:uppercase; letter-spacing:.4px; margin-bottom:6px;">Rasgos del adolescente (aportados por psicólogo)</h4>
          <p style="font-size:13px; color:#1e3a5f; line-height:1.5;">${escaparHtml(pred.rasgos_adolescente || (typeof pred.datos_entrada==='string' ? JSON.parse(pred.datos_entrada).rasgos_adolescente : pred.datos_entrada.rasgos_adolescente))}</p>
        </div>
      ` : ''}
    </div>

    ${pred.comportamientos_predichos?.length > 0 ? `
      <div class="card" style="padding:24px; margin-top:18px;">
        <h3 style="font-size:15px; font-weight:700; color:#111827; margin-bottom:14px;">Comportamientos predichos</h3>
        <div style="display:grid; gap:10px;">
          ${pred.comportamientos_predichos.map(c => `
            <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; border-left:4px solid ${probColor[c.probabilidad] || '#9ca3af'};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="font-size:13px; color:#111827;">${escaparHtml(c.comportamiento)}</strong>
                <span style="font-size:11px; font-weight:600; color:${probColor[c.probabilidad] || '#9ca3af'}; background:${probColor[c.probabilidad]}15; padding:2px 8px; border-radius:6px;">
                  Prob: ${c.probabilidad || 'N/A'}
                </span>
              </div>
              <p style="font-size:12px; color:#6b7280; margin-bottom:4px;">Horizonte: ${c.horizonte || 'N/A'}</p>
              <p style="font-size:12px; color:#4b5563;">${escaparHtml(c.justificacion || '')}</p>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ''}

    ${pred.factores_contribuyentes?.length > 0 ? `
      <div class="card" style="padding:24px; margin-top:18px;">
        <h3 style="font-size:15px; font-weight:700; color:#111827; margin-bottom:14px;">Factores contribuyentes</h3>
        <div style="display:grid; gap:10px;">
          ${pred.factores_contribuyentes.map(f => `
            <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; border-left:4px solid ${nivelColor[f.impacto] || '#9ca3af'};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="font-size:13px; color:#111827;">${escaparHtml(f.factor)}</strong>
                <span style="font-size:11px; font-weight:600; color:${nivelColor[f.impacto] || '#9ca3af'};">
                  Impacto: ${f.impacto || 'N/A'}
                </span>
              </div>
              <p style="font-size:12px; color:#4b5563;">${escaparHtml(f.descripcion || '')}</p>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ''}

    ${pred.recomendaciones?.length > 0 ? `
      <div class="card" style="padding:24px; margin-top:18px;">
        <h3 style="font-size:15px; font-weight:700; color:#111827; margin-bottom:14px;">Recomendaciones</h3>
        <div style="display:grid; gap:10px;">
          ${pred.recomendaciones.map(r => `
            <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; border-left:4px solid ${prioColor[r.prioridad] || '#9ca3af'};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="font-size:13px; color:#111827;">${escaparHtml(r.accion)}</strong>
                <div style="display:flex; gap:6px;">
                  <span style="font-size:10px; font-weight:600; color:${prioColor[r.prioridad] || '#9ca3af'}; background:${prioColor[r.prioridad]}15; padding:2px 8px; border-radius:6px;">
                    ${r.prioridad || 'N/A'}
                  </span>
                  <span style="font-size:10px; font-weight:600; color:#6b7280; background:#f3f4f6; padding:2px 8px; border-radius:6px;">
                    ${r.responsable || 'N/A'}
                  </span>
                </div>
              </div>
              <p style="font-size:12px; color:#6b7280;">Plazo: ${r.plazo || 'N/A'}</p>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ''}
  `;
}

function limpiarAnalisis() {
  const c = document.getElementById("prediccionResultado");
  if (c) { c.innerHTML = ""; c.classList.add("oculto"); }
  // No borrar _prediccionActual para que descarga siga funcionando si ya se pulsó, pero ocultar vista
}

async function cargarHistorialPredicciones(estudianteId) {
  const container = document.getElementById("prediccionHistorial");
  if (!container || !estudianteId) return;
  container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#6b7280; font-size:12.5px;">Cargando historial...</div>`;
  try {
    const predicciones = await apiFetch("/postgres/psicologia/predicciones/estudiantes/" + estudianteId + "?limite=30");
    _historialCache = Array.isArray(predicciones) ? predicciones : [];
    if (_historialCache.length === 0) {
      container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#6b7280; font-size:12.5px;">Sin predicciones para este estudiante.</div>`;
      return;
    }
    _historial15Abierto = false;
    _historial30Abierto = false;
    renderHistorialPredicciones(estudianteId);
  } catch (e) { container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#dc2626; font-size:12.5px;">Error cargando historial: ${escaparHtml(e.message)}</div>`; }
}

async function cargarHistorialHoy() {
  const container = document.getElementById("prediccionHistorial");
  if (!container) return;
  container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#6b7280; font-size:12.5px;">Cargando historial de hoy...</div>`;
  try {
    const predicciones = await apiFetch("/postgres/psicologia/predicciones/hoy?limite=30");
    _historialCache = Array.isArray(predicciones) ? predicciones : [];
    if (_historialCache.length === 0) {
      container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#6b7280; font-size:12.5px;">Sin predicciones hoy.<br><span style="font-size:11px;color:#9ca3af;">Cuando generes una, aparecerá aquí. Si eliges un estudiante, verás solo su historial.</span></div>`;
      return;
    }
    _historial15Abierto = false;
    _historial30Abierto = false;
    renderHistorialHoy();
  } catch (e) { container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#dc2626; font-size:12.5px;">Error cargando historial: ${escaparHtml(e.message)}</div>`; }
}

function renderHistorialHoy() {
  const container = document.getElementById("prediccionHistorial");
  if (!container) return;
  const lista = _historialCache;
  if (!lista || lista.length === 0) { container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#6b7280; font-size:12.5px;">Sin predicciones hoy.</div>`; return; }
  const nivelColor = { Bajo: "#059669", Medio: "#d97706", Alto: "#dc2626" };
  function card(p){
    const hora=new Date(p.created_at).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"});
    const nombre = `${p.apellidos||''}, ${p.nombres||''}`.trim() || "Estudiante";
    const seccion = p.grado ? `${p.grado}° "${p.letra}"` : (p.seccion_nombre || "");
    return `
      <div onclick="verPrediccionGuardada(${p.id})" title="Ver análisis completo"
        style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #f9fafb; cursor:pointer; transition:background .12s;"
        onmouseover="this.style.background='#f5f8fc'" onmouseout="this.style.background='white'">
        <div style="display:flex; gap:10px; align-items:center; min-width:0; flex:1;">
          <div style="width:36px; height:36px; border-radius:10px; display:grid; place-items:center; flex-shrink:0; background:${p.nivel_riesgo_predicho==='Alto'?'#fef2f2':p.nivel_riesgo_predicho==='Medio'?'#fffbeb':'#ecfdf5'}; color:${nivelColor[p.nivel_riesgo_predicho]}; font-weight:800; font-size:11px; border:1px solid ${p.nivel_riesgo_predicho==='Alto'?'#fecaca':p.nivel_riesgo_predicho==='Medio'?'#fde68a':'#a7f3d0'};">${p.nivel_riesgo_predicho[0]}</div>
          <div style="min-width:0; flex:1;">
            <div style="font-size:13px; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escaparHtml(nombre)} <span style="font-weight:400; color:#9ca3af; font-size:11px;">· ${escaparHtml(seccion)}</span></div>
            <div style="font-size:11.5px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">${escaparHtml((p.resumen||'').slice(0,80))}</div>
            <div style="font-size:11px; color:${nivelColor[p.nivel_riesgo_predicho]}; font-weight:600;">${p.nivel_riesgo_predicho} · ${p.confianza||'-'}% · ${hora} Hoy</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;">
          <button onclick="event.stopPropagation(); eliminarPrediccionHoy(${p.id})" title="Eliminar" style="background:none; border:none; cursor:pointer; color:#9ca3af; font-size:15px; padding:2px 6px; border-radius:6px;" onmouseover="this.style.color='#dc2626'; this.style.background='#fef2f2'" onmouseout="this.style.color='#9ca3af'; this.style.background='none'">&times;</button>
        </div>
      </div>`;
  }
  container.innerHTML = `
    <div class="card" style="padding:0; overflow:hidden; border:1px solid #e5e7eb;">
      <div style="padding:14px 16px 10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-bottom:1px solid #f3f4f6;">
        <h3 style="font-size:14px; font-weight:800; color:#111827; display:flex; align-items:center; gap:8px;">
          <span style="width:28px;height:28px;border-radius:8px;background:#edf4ff;display:grid;place-items:center;color:#0d63d8;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>
          Historial de hoy
          <span style="font-size:11px; font-weight:700; background:#f3f4f6; color:#6b7280; padding:2px 8px; border-radius:999px;">${lista.length}</span>
        </h3>
        <span style="font-size:11px; color:#9ca3af;">${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"})}</span>
      </div>
      <div style="max-height:420px; overflow-y:auto;">
        ${lista.map(card).join("")}
      </div>
      <div style="padding:10px 14px; background:#f9fafb; border-top:1px solid #f3f4f6; font-size:11px; color:#9ca3af; text-align:center;">Al elegir un estudiante verás solo su historial.</div>
    </div>
  `;
}

async function eliminarPrediccionHoy(id) {
  if (!confirm("¿Eliminar esta predicción?")) return;
  try {
    await apiFetch("/postgres/psicologia/predicciones/" + id, { method: "DELETE" });
    cargarHistorialHoy();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

function toggleHistorial15(sid) { _historial15Abierto = !_historial15Abierto; renderHistorialPredicciones(sid); }
function toggleHistorial30(sid) { _historial30Abierto = !_historial30Abierto; renderHistorialPredicciones(sid); }
function verPrediccionGuardada(predId){
  const p = _historialCache.find(x => String(x.id)===String(predId));
  if(!p){ alert("Predicción no encontrada en caché. Recarga el historial."); return; }
  const container = document.getElementById("prediccionResultado");
  if(!container) return;
  container.classList.remove("oculto");
  // Normalizar arrays si vienen como string (JSONB)
  try{ if(typeof p.comportamientos_predichos==="string") p.comportamientos_predichos=JSON.parse(p.comportamientos_predichos); }catch(_){}
  try{ if(typeof p.factores_contribuyentes==="string") p.factores_contribuyentes=JSON.parse(p.factores_contribuyentes); }catch(_){}
  try{ if(typeof p.recomendaciones==="string") p.recomendaciones=JSON.parse(p.recomendaciones); }catch(_){}
  const nombre = document.getElementById("predEstudiante")?.options[document.getElementById("predEstudiante")?.selectedIndex]?.text || `${p.nombres||''} ${p.apellidos||''}`.trim() || "Estudiante";
  _prediccionActual = p;
  _prediccionNombreEstudiante = nombre;
  mostrarPrediccion(p, container, nombre);
  container.scrollIntoView({ behavior:"smooth", block:"start" });
}

function renderHistorialPredicciones(estudianteId) {
  const container = document.getElementById("prediccionHistorial");
  if (!container) return;
  const sid = estudianteId || document.getElementById("predEstudiante")?.value;
  const lista = _historialCache;
  if (!lista || lista.length === 0) { container.innerHTML = `<div class="card" style="padding:18px; text-align:center; color:#6b7280; font-size:12.5px;">Sin predicciones previas.</div>`; return; }

  const nivelColor = { Bajo: "#059669", Medio: "#d97706", Alto: "#dc2626" };
  const ahora = Date.now();
  const hace15 = ahora - 15*86400000, hace30 = ahora - 30*86400000;
  function esHoy(iso){ const d=new Date(iso), h=new Date(); return d.getFullYear()===h.getFullYear() && d.getMonth()===h.getMonth() && d.getDate()===h.getDate(); }
  const hoyItems = lista.filter(p => esHoy(p.created_at));
  const items15 = lista.filter(p => !esHoy(p.created_at) && new Date(p.created_at).getTime() >= hace15);
  const items30 = lista.filter(p => !esHoy(p.created_at) && new Date(p.created_at).getTime() >= hace30 && new Date(p.created_at).getTime() < hace15); // 16-30, no duplica 15
  const cnt15 = items15.length, cnt30 = items30.length, cntHoy = hoyItems.length;

  function etq(iso){
    const d=new Date(iso); const hoy=new Date(); hoy.setHours(0,0,0,0);
    const ayer=new Date(hoy); ayer.setDate(hoy.getDate()-1);
    const f=new Date(d); f.setHours(0,0,0,0);
    if(f.getTime()===hoy.getTime()) return "Hoy";
    if(f.getTime()===ayer.getTime()) return "Ayer";
    return d.toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"});
  }
  function card(p){
    const dias=Math.floor((Date.now()-new Date(p.created_at).getTime())/86400000);
    const hora=new Date(p.created_at).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"});
    return `
      <div onclick="verPrediccionGuardada(${p.id})" title="Ver análisis completo"
        style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #f9fafb; cursor:pointer; transition:background .12s;"
        onmouseover="this.style.background='#f5f8fc'" onmouseout="this.style.background='white'">
        <div style="display:flex; gap:10px; align-items:center; min-width:0;">
          <div style="width:36px; height:36px; border-radius:10px; display:grid; place-items:center; flex-shrink:0; background:${p.nivel_riesgo_predicho==='Alto'?'#fef2f2':p.nivel_riesgo_predicho==='Medio'?'#fffbeb':'#ecfdf5'}; color:${nivelColor[p.nivel_riesgo_predicho]}; font-weight:800; font-size:11px; border:1px solid ${p.nivel_riesgo_predicho==='Alto'?'#fecaca':p.nivel_riesgo_predicho==='Medio'?'#fde68a':'#a7f3d0'};">${p.nivel_riesgo_predicho[0]}</div>
          <div style="min-width:0;">
            <div style="font-size:13px; font-weight:700; color:${nivelColor[p.nivel_riesgo_predicho]};">${p.nivel_riesgo_predicho} <span style="font-weight:400; color:#9ca3af; font-size:11px;">· ${p.confianza||'-'}% · ${hora}</span></div>
            <div style="font-size:11.5px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;">${escaparHtml((p.resumen||'').slice(0,70))}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          <span style="font-size:11px; color:#9ca3af;">${dias===0?'Hoy':dias+'d'}</span>
          <button onclick="event.stopPropagation(); eliminarPrediccionHistorial(${p.id}, ${sid})" title="Eliminar" style="background:none; border:none; cursor:pointer; color:#9ca3af; font-size:15px; padding:2px 6px; border-radius:6px;" onmouseover="this.style.color='#dc2626'; this.style.background='#fef2f2'" onmouseout="this.style.color='#9ca3af'; this.style.background='none'">&times;</button>
        </div>
      </div>`;
  }
  function gruposHtml(arr){
    if(arr.length===0) return `<div style="padding:18px; text-align:center; color:#9ca3af; font-size:12px;">Sin predicciones en este rango.</div>`;
    const g={}; arr.forEach(p=>{ const k=new Date(p.created_at).toISOString().slice(0,10); if(!g[k]) g[k]={label:etq(p.created_at),items:[]}; g[k].items.push(p); });
    return Object.entries(g).map(([k,v])=> `<div style="padding:8px 14px 4px; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.4px;">${v.label}</div>${v.items.map(card).join("")}`).join("");
  }

  container.innerHTML = `
    <div class="card" style="padding:0; overflow:hidden; border:1px solid #e5e7eb;">
      <div style="padding:14px 16px 10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-bottom:1px solid #f3f4f6;">
        <h3 style="font-size:14px; font-weight:800; color:#111827; display:flex; align-items:center; gap:8px;">
          <span style="width:28px;height:28px;border-radius:8px;background:#edf4ff;display:grid;place-items:center;color:#0d63d8;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>
          Historial
          <span style="font-size:11px; font-weight:700; background:#f3f4f6; color:#6b7280; padding:2px 8px; border-radius:999px;">${cntHoy + cnt15 + cnt30}</span>
          <span style="font-size:11px; font-weight:600; color:#9ca3af;">· 30 días</span>
        </h3>
        <button onclick="limpiarHistorialPredicciones()" title="Borra >30 días" style="font-size:11px; padding:6px 10px; border:1px solid #e5e7eb; background:white; border-radius:8px; cursor:pointer; color:#6b7280;">Limpiar &gt;30d</button>
      </div>

      <!-- Hoy -->
      <div style="background:#f9fafb; padding:8px 14px; font-size:11px; font-weight:800; color:#374151; letter-spacing:.3px;">
        Hoy — ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"})} <span style="font-weight:600; color:#9ca3af;">(${cntHoy})</span>
      </div>
      <div style="max-height:240px; overflow-y:auto; border-bottom:1px solid #f3f4f6;">
        ${hoyItems.length? gruposHtml(hoyItems) : `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:12px;">Sin predicciones hoy.</div>`}
      </div>

      ${cnt15>0 ? `
      <!-- Últimos 15 días solo si hay datos -->
      <button onclick="toggleHistorial15(${sid})" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:${_historial15Abierto?'#edf4ff':'white'}; border:none; border-bottom:1px solid #f3f4f6; cursor:pointer; text-align:left;">
        <span style="font-size:13px; font-weight:700; color:${_historial15Abierto?'#0d63d8':'#111827'};">Últimos 15 días <span style="font-size:11px; font-weight:700; background:${_historial15Abierto?'#0d63d8':'#f3f4f6'}; color:${_historial15Abierto?'white':'#6b7280'}; padding:2px 7px; border-radius:999px;">${cnt15}</span></span>
        <span style="font-size:13px; color:#9ca3af; transform:${_historial15Abierto?'rotate(180deg)':'none'}; transition:.15s;">▾</span>
      </button>
      <div style="display:${_historial15Abierto?'block':'none'}; max-height:340px; overflow-y:auto; border-bottom:1px solid #f3f4f6;">
        ${gruposHtml(items15)}
      </div>` : ''}

      ${cnt30>0 ? `
      <!-- Últimos 30 días solo si hay datos -->
      <button onclick="toggleHistorial30(${sid})" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:${_historial30Abierto?'#edf4ff':'white'}; border:none; cursor:pointer; text-align:left;">
        <span style="font-size:13px; font-weight:700; color:${_historial30Abierto?'#0d63d8':'#111827'};">Últimos 30 días <span style="font-size:11px; font-weight:700; background:${_historial30Abierto?'#0d63d8':'#f3f4f6'}; color:${_historial30Abierto?'white':'#6b7280'}; padding:2px 7px; border-radius:999px;">${cnt30}</span></span>
        <span style="font-size:13px; color:#9ca3af; transform:${_historial30Abierto?'rotate(180deg)':'none'}; transition:.15s;">▾</span>
      </button>
      <div style="display:${_historial30Abierto?'block':'none'}; max-height:380px; overflow-y:auto;">
        ${gruposHtml(items30)}
      </div>` : ''}
    </div>
  `;
}

async function eliminarPrediccionHistorial(id, estudianteId) {
  if (!confirm("¿Eliminar esta predicción?")) return;
  try {
    await apiFetch("/postgres/psicologia/predicciones/" + id, { method: "DELETE" });
    cargarHistorialPredicciones(estudianteId);
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function limpiarHistorialPredicciones() {
  if (!confirm("¿Eliminar predicciones con más de 30 días de antigüedad?")) return;
  try {
    const res = await apiFetch("/postgres/psicologia/predicciones/limpiar", {
      method: "POST",
      body: { dias: 30 }
    });
    alert(res.mensaje);
    const estudianteId = document.getElementById("predEstudiante")?.value;
    if (estudianteId) cargarHistorialPredicciones(estudianteId);
    else cargarHistorialHoy();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

function descargarPrediccion(pred, nombreEstudiante) {
  if (typeof docx === "undefined") {
    alert("Librería de documentos no cargada. Recarga la página.");
    return;
  }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TableCell, TableRow, Table, WidthType, ShadingType } = docx;

  const nivelColor = { Bajo: "4CAF50", Medio: "FF9800", Alto: "F44336" };
  const nivel = pred.nivel_riesgo_predicho || "Medio";

  const children = [];

  // Título
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "SAT Escolar", bold: true, size: 36, font: "Inter" })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "Predicción de Comportamiento con IA", size: 24, font: "Inter", color: "666666" })]
  }));

  // Info del alumno
  children.push(new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({ text: "Estudiante: ", bold: true, size: 22, font: "Inter" }),
      new TextRun({ text: nombreEstudiante || "N/A", size: 22, font: "Inter" })
    ]
  }));
  children.push(new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: "Fecha: ", bold: true, size: 22, font: "Inter" }),
      new TextRun({ text: pred.created_at ? new Date(pred.created_at).toLocaleString() : new Date().toLocaleString(), size: 22, font: "Inter" })
    ]
  }));
  children.push(new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: "Modelo: ", bold: true, size: 22, font: "Inter" }),
      new TextRun({ text: pred.modelo || "Gemini", size: 22, font: "Inter" })
    ]
  }));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [
      new TextRun({ text: "Nivel de riesgo: ", bold: true, size: 24, font: "Inter" }),
      new TextRun({ text: nivel.toUpperCase(), bold: true, size: 28, font: "Inter", color: nivelColor[nivel] || "333333" })
    ]
  }));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [
      new TextRun({ text: "Confianza: ", bold: true, size: 22, font: "Inter" }),
      new TextRun({ text: (pred.confianza || 0) + "%", size: 22, font: "Inter" })
    ]
  }));

  // Rasgos del adolescente (si existe)
  const rasgosTxt = pred.rasgos_adolescente || (pred.datos_entrada && (typeof pred.datos_entrada==='string' ? (()=>{
    try{ return JSON.parse(pred.datos_entrada).rasgos_adolescente; }catch(_){ return null; }
  })() : pred.datos_entrada.rasgos_adolescente));
  if (rasgosTxt) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "Rasgos del adolescente (observación del psicólogo)", bold: true, size: 24, font: "Inter" })]
    }));
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: rasgosTxt, size: 21, font: "Inter", color: "1E3A5F" })]
    }));
  }

  // Resumen
  if (pred.resumen) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "Resumen Ejecutivo — Qué está pasando", bold: true, size: 26, font: "Inter" })]
    }));
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: pred.resumen, size: 22, font: "Inter" })]
    }));
  }

  // Comportamientos predichos
  if (pred.comportamientos_predichos?.length > 0) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "Comportamientos Predichos", bold: true, size: 26, font: "Inter" })]
    }));
    pred.comportamientos_predichos.forEach(c => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: "• " + (c.comportamiento || ""), bold: true, size: 22, font: "Inter" }),
          new TextRun({ text: " (Prob: " + (c.probabilidad || "N/A") + ")", size: 20, font: "Inter", color: "888888" })
        ]
      }));
      if (c.horizonte) {
        children.push(new Paragraph({
          indent: { left: 300 },
          spacing: { after: 40 },
          children: [new TextRun({ text: "Horizonte: " + c.horizonte, size: 20, font: "Inter", color: "666666" })]
        }));
      }
      if (c.justificacion) {
        children.push(new Paragraph({
          indent: { left: 300 },
          spacing: { after: 100 },
          children: [new TextRun({ text: c.justificacion, size: 20, font: "Inter", color: "444444" })]
        }));
      }
    });
  }

  // Factores contribuyentes
  if (pred.factores_contribuyentes?.length > 0) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "Factores Contribuyentes", bold: true, size: 26, font: "Inter" })]
    }));
    pred.factores_contribuyentes.forEach(f => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: "• " + (f.factor || ""), bold: true, size: 22, font: "Inter" }),
          new TextRun({ text: " (Impacto: " + (f.impacto || "N/A") + ")", size: 20, font: "Inter", color: "888888" })
        ]
      }));
      if (f.descripcion) {
        children.push(new Paragraph({
          indent: { left: 300 },
          spacing: { after: 100 },
          children: [new TextRun({ text: f.descripcion, size: 20, font: "Inter", color: "444444" })]
        }));
      }
    });
  }

  // Recomendaciones
  if (pred.recomendaciones?.length > 0) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "Recomendaciones", bold: true, size: 26, font: "Inter" })]
    }));
    pred.recomendaciones.forEach(r => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: "• " + (r.accion || ""), bold: true, size: 22, font: "Inter" }),
          new TextRun({ text: " [" + (r.prioridad || "N/A") + "]", size: 20, font: "Inter", color: "888888" }),
          new TextRun({ text: " → " + (r.responsable || "N/A"), size: 20, font: "Inter", color: "666666" })
        ]
      }));
      if (r.plazo) {
        children.push(new Paragraph({
          indent: { left: 300 },
          spacing: { after: 100 },
          children: [new TextRun({ text: "Plazo: " + r.plazo, size: 20, font: "Inter", color: "666666" })]
        }));
      }
    });
  }

  // Footer
  children.push(new Paragraph({
    spacing: { before: 400 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "SAT Escolar — Sistema de Alerta Temprana · Generado automáticamente por IA", size: 18, font: "Inter", color: "999999", italics: true })]
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } }
      },
      children
    }]
  });

  Packer.toBlob(doc).then(blob => {
    const apellido = (nombreEstudiante || "estudiante").replace(/[, ]+/g, "_");
    saveAs(blob, `Prediccion_${apellido}.docx`);
  });
}

// ── DOCUMENTACIÓN — Respaldo diario por fecha ──
let _docHandle = null;
let _docListaActual = [];
const DOC_IDB_DB = 'sat_doc_carpeta';
const DOC_IDB_STORE = 'handle';

async function docIdbPut(handle) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DOC_IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DOC_IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(DOC_IDB_STORE, 'readwrite');
      tx.objectStore(DOC_IDB_STORE).put(handle, 'carpeta');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}
async function docIdbGet() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DOC_IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DOC_IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(DOC_IDB_STORE, 'readonly');
      const get = tx.objectStore(DOC_IDB_STORE).get('carpeta');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}
async function docIdbDel() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DOC_IDB_DB, 1);
    req.onsuccess = () => {
      const tx = req.result.transaction(DOC_IDB_STORE, 'readwrite');
      tx.objectStore(DOC_IDB_STORE).delete('carpeta');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

async function cargarDocumentacion() {
  const input = document.getElementById('docFecha');
  if (input && !input.value) {
    const hoy = new Date().toISOString().slice(0,10);
    input.value = hoy;
  }
  // Restaurar carpeta elegida si existe
  try {
    const h = await docIdbGet();
    if (h) {
      _docHandle = h;
      const st = document.getElementById('docCarpetaEstado');
      if (st) st.innerHTML = `Carpeta elegida: <b>${h.name || 'seleccionada'}</b> · Se guardará la carpeta <b>YYYY-MM-DD</b> dentro.`;
      document.getElementById('btnOlvidarCarpeta')?.classList.remove('oculto');
      // Verificar permiso
      if (h.queryPermission) {
        const perm = await h.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && h.requestPermission) await h.requestPermission({ mode: 'readwrite' });
      }
    }
  } catch (_) {}
  // Si no soporta, ocultar botón elegir y avisar
  if (!window.showDirectoryPicker) {
    const b = document.getElementById('btnElegirCarpeta');
    if (b) { b.textContent = 'Tu navegador no soporta carpetas — se descargará ZIP'; b.disabled = true; b.title = 'Usa Chrome/Edge para guardar directo en carpeta'; }
  }
  const fecha = document.getElementById('docFecha')?.value;
  if (fecha) cargarDocumentosPorFecha(fecha);
}

async function elegirCarpetaDocumentacion() {
  if (!window.showDirectoryPicker) {
    alert('Tu navegador no soporta elegir carpeta. Se descargará un ZIP en Descargas. Usa Chrome o Edge para guardado directo.');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    _docHandle = handle;
    await docIdbPut(handle);
    const st = document.getElementById('docCarpetaEstado');
    if (st) st.innerHTML = `Carpeta elegida: <b>${handle.name}</b> · Se creará la carpeta <b>YYYY-MM-DD</b> dentro.`;
    document.getElementById('btnOlvidarCarpeta')?.classList.remove('oculto');
  } catch (e) {
    if (e.name !== 'AbortError') alert('No se pudo elegir carpeta: ' + e.message);
  }
}
async function olvidarCarpetaDocumentacion() {
  _docHandle = null;
  await docIdbDel();
  const st = document.getElementById('docCarpetaEstado');
  if (st) st.textContent = 'No has elegido carpeta. Se descargará un ZIP en Descargas.';
  document.getElementById('btnOlvidarCarpeta')?.classList.add('oculto');
}

async function cargarDocumentosPorFecha(fecha) {
  if (!fecha) return;
  const listaEl = document.getElementById('docLista');
  const contEl = document.getElementById('docContador');
  const btn = document.getElementById('btnDescargarDia');
  if (!listaEl) return;
  listaEl.innerHTML = '<div style="padding:18px; text-align:center; color:#6b7280; font-size:13px;">Cargando documentos del ' + escaparHtml(fecha) + '...</div>';
  if (btn) btn.disabled = true;
  try {
    const data = await apiFetch('/postgres/psicologia/documentos?fecha=' + encodeURIComponent(fecha));
    _docListaActual = data.documentos || [];
    if (contEl) contEl.textContent = _docListaActual.length;
    if (btn) btn.disabled = _docListaActual.length === 0;
    if (_docListaActual.length === 0) {
      listaEl.innerHTML = '<div style="padding:24px; text-align:center; color:#9ca3af; font-size:13px; border:1px dashed #d1d5db; border-radius:10px;">Sin documentos ese día. Crea un expediente o ficha y aparecerá aquí.</div>';
      return;
    }
    listaEl.innerHTML = _docListaActual.map(d => {
      const tipoLabel = d.tipo_label || d.tipo;
      const nombre = `${tipoLabel} — ${d.apellidos || ''} ${d.nombres || ''}`.trim();
      // nombre_archivo ya viene como "tipo — Apellidos Nombres"
      return `<div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; background:white;">
        <div style="width:36px; height:36px; border-radius:8px; background:#eef4fb; display:grid; place-items:center; color:#1a3a5c; flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13px; font-weight:700; color:#1f2937; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escaparHtml(nombre)}</div>
          <div style="font-size:11px; color:#6b7280;">${escaparHtml(d.grado || '')} ${escaparHtml(d.letra || '')} · ${new Date(d.fecha_registro).toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
        <span style="font-size:11px; color:#6b7280; white-space:nowrap;">${escaparHtml(d.origen)}</span>
      </div>`;
    }).join('');
  } catch (e) {
    listaEl.innerHTML = `<div style="padding:18px; text-align:center; color:#b91c1c; font-size:13px;">Error: ${escaparHtml(e.message)}</div>`;
  }
}

async function descargarDocumentosDelDia() {
  const fecha = document.getElementById('docFecha')?.value;
  if (!fecha) { alert('Elige una fecha'); return; }
  if (!_docListaActual.length) { alert('No hay documentos ese día'); return; }
  const btn = document.getElementById('btnDescargarDia');
  if (btn) { btn.disabled = true; btn.textContent = 'Preparando...'; }
  try {
    // Intentar guardado directo en carpeta si hay handle y es Chrome/Edge
    let usarCarpeta = false;
    if (_docHandle && window.showDirectoryPicker) {
      try {
        const perm = _docHandle.queryPermission ? await _docHandle.queryPermission({ mode: 'readwrite' }) : 'granted';
        if (perm === 'granted') usarCarpeta = true;
        else if (_docHandle.requestPermission) {
          const r = await _docHandle.requestPermission({ mode: 'readwrite' });
          usarCarpeta = r === 'granted';
        }
      } catch (_) { usarCarpeta = false; }
    }

    if (usarCarpeta) {
      await descargarEnCarpeta(fecha, _docListaActual, _docHandle);
      alert(`Guardado en carpeta ${fecha}/ dentro de "${_docHandle.name}" — ${_docListaActual.length} documentos.`);
    } else {
      await descargarZip(fecha, _docListaActual);
    }
  } catch (e) {
    alert('Error al descargar: ' + e.message);
  } finally {
    if (btn) { btn.disabled = _docListaActual.length === 0; btn.textContent = 'Descargar del día'; }
  }
}

async function fetchDocumentoContenido(docMeta) {
  // Devuelve { html, nombre } para el ZIP/carpeta
  const safeName = (docMeta.nombre_archivo || `${docMeta.tipo} - ${docMeta.apellidos} ${docMeta.nombres}`).replace(/[\\/:*?"<>|]/g, '').trim() || 'documento';
  if (docMeta.origen === 'ficha') {
    // Ficha socioeducativa
    const data = await apiFetch(`/postgres/ficha-diagnostica/${docMeta.estudiante_id}`);
    const datos = data.datos || {};
    // Reusar la vista de ficha si existe, sino simple
    let html = '';
    if (typeof construirHtmlWordFicha === 'function') {
      html = construirHtmlWordFicha(datos, `${docMeta.apellidos} ${docMeta.nombres}`);
    } else {
      html = `<html><head><meta charset="utf-8"></head><body><h2>Ficha Socioeducativa — ${docMeta.apellidos} ${docMeta.nombres}</h2><pre>${escaparHtml(JSON.stringify(datos, null, 2))}</pre></body></html>`;
    }
    // Envolver como Word HTML
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    return { html: full, nombre: `${safeName}.doc` };
  } else {
    // Expediente
    const f = await apiFetch(`/postgres/expediente/formatos/${docMeta.id}`);
    const datos = f.datos || {};
    let inner = '';
    if (typeof renderVistaExpediente === 'function' && f.tipo) {
      inner = renderVistaExpediente(f.tipo, datos);
    } else {
      inner = `<pre>${escaparHtml(JSON.stringify(datos, null, 2))}</pre>`;
    }
    const header = `<div style="text-align:center; font-weight:800; color:#1a3a5c; margin-bottom:12px;">${escaparHtml(f.tipo)} — ${escaparHtml(docMeta.apellidos)} ${escaparHtml(docMeta.nombres)}</div>`;
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif; color:#222; padding:20px;}</style></head><body>${header}${inner}</body></html>`;
    return { html: full, nombre: `${safeName}.doc` };
  }
}

async function descargarEnCarpeta(fecha, lista, dirHandle) {
  // Crea subcarpeta con la fecha y escribe cada .doc
  const sub = await dirHandle.getDirectoryHandle(fecha, { create: true });
  for (const docMeta of lista) {
    const { html, nombre } = await fetchDocumentoContenido(docMeta);
    const fileHandle = await sub.getFileHandle(nombre, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([html], { type: 'application/msword' }));
    await writable.close();
  }
}

async function descargarZip(fecha, lista) {
  if (typeof JSZip === 'undefined') {
    // Cargar JSZip dinámicamente si no está
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar JSZip'));
      document.head.appendChild(s);
    });
  }
  const zip = new JSZip();
  const folder = zip.folder(fecha);
  for (const docMeta of lista) {
    const { html, nombre } = await fetchDocumentoContenido(docMeta);
    folder.file(nombre, html);
  }
  const blob = await folder.generateAsync ? await zip.generateAsync({ type: 'blob' }) : await zip.generateAsync({ type: 'blob' });
  // FileSaver
  if (typeof saveAs === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar FileSaver'));
      document.head.appendChild(s);
    });
  }
  saveAs(blob, `${fecha}.zip`);
}
