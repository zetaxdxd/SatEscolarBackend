// Expediente integral: incidencias + derivaciones — SAT Escolar
async function cargarSeccionesIncidencia() {
  const selSec = document.getElementById("incSeccionId");
  if (!selSec) return;
  if (selSec.options.length > 1) return;
  selSec.innerHTML = `<option value="">Cargando secciones...</option>`;
  try {
    let secciones = [];
    // Solo aulas activas y existentes: usar dashboard (solo secciones con tutor y estudiantes) o secciones-asignadas
    try { const d = await apiFetch("/postgres/psicologia/dashboard"); secciones = d.secciones || []; } catch (_) {}
    if (!secciones.length) {
      try { const d = await apiFetch("/postgres/psicologia/secciones-asignadas"); secciones = Array.isArray(d) ? d : d.secciones || []; } catch (_) {}
    }
    if (!secciones.length) {
      try { secciones = await apiFetch("/postgres/secciones/activas"); if (!Array.isArray(secciones)) secciones = secciones.secciones || secciones.rows || []; } catch (_) {}
    }
    // Fallback solo si no hay dashboard: filtrar solo Secundaria activas con nombre válido
    if (!secciones.length) {
      const todas = await apiFetch("/postgres/secciones");
      secciones = (Array.isArray(todas) ? todas : todas.rows || []).filter(s => s.nivel === "Secundaria" && s.grado && s.letra);
    }
    if (!secciones.length) throw new Error("Sin secciones activas");
    selSec.innerHTML = `<option value="">Seleccionar sección</option>` + secciones.map(s => `<option value="${s.id}">${s.grado} ${s.letra}</option>`).join("");
  } catch (e) {
    selSec.innerHTML = `<option value="">No se pudo cargar secciones</option>`;
  }
}
async function abrirModalIncidencia(estudianteId = null) {
  await cargarSeccionesIncidencia();
  // Precargar cache para buscador
  cargarTodosEstudiantesCache().catch(()=>{});
  // Limpiar buscador
  const busc = document.getElementById("incBuscarEstudiante");
  const hidden = document.getElementById("incEstudianteIdHidden");
  const sug = document.getElementById("incSugerencias");
  if (busc) busc.value = "";
  if (hidden) hidden.value = "";
  if (sug) { sug.style.display = "none"; sug.innerHTML = ""; }
  if (estudianteId) {
    const sel = document.getElementById("incEstudianteId");
    if (sel) sel.value = estudianteId;
    if (hidden) hidden.value = String(estudianteId);
    // Si viene con estudianteId, intentar auto-completar su nombre y sección
    try {
      const all = await cargarTodosEstudiantesCache();
      const est = all.find(e => String(e.id) === String(estudianteId));
      if (est && busc) busc.value = `${est.nombres} ${est.apellidos}`;
      const selSec = document.getElementById("incSeccionId");
      if (est && selSec && est.seccion_id) selSec.value = String(est.seccion_id);
    } catch (_) {}
  }
  // Vista en página (psicologa): formulario inline en la sección
  const inlineWrap = document.getElementById("incInlineFormWrap");
  if (inlineWrap) {
    inlineWrap.classList.remove("oculto");
    inlineWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    if (busc) setTimeout(()=> busc.focus(), 300);
    return;
  }
  // Vista flotante (detalle-estudiante y otras páginas que conservan el modal)
  const modal = document.getElementById("modalIncidencia");
  if (!modal) return;
  modal.classList.remove("oculto");
  if (busc) setTimeout(()=> busc.focus(), 150);
}

let _incEstudiantesCache = [];
let _incTodosCache = [];
async function cargarTodosEstudiantesCache() {
  if (_incTodosCache.length) return _incTodosCache;
  try {
    const d = await apiFetch("/postgres/psicologia/dashboard");
    const secciones = d.secciones || [];
    let todos = [];
    for (const s of secciones) {
      try {
        const ests = await apiFetch(`/postgres/estudiantes?seccionId=${s.id}`);
        todos = todos.concat(ests.map(e => ({ ...e, grado: s.grado, letra: s.letra, seccion_id: s.id })));
      } catch (_) {}
    }
    _incTodosCache = todos;
    return todos;
  } catch (_) { return []; }
}
async function cargarEstudiantesIncidencia(seccionId) {
  const sel = document.getElementById("incEstudianteId");
  const hidden = document.getElementById("incEstudianteIdHidden");
  // Limpiar buscador y sugerencias al cambiar sección
  const busc = document.getElementById("incBuscarEstudiante");
  const sug = document.getElementById("incSugerencias");
  if (sug) { sug.style.display = "none"; sug.innerHTML = ""; }
  if (hidden) hidden.value = "";
  if (busc) busc.value = "";
  if (!sel) return;
  if (!seccionId) {
    sel.innerHTML = `<option value="">Selecciona sección primero o usa el buscador</option>`;
    return;
  }
  sel.innerHTML = `<option value="">Cargando...</option>`;
  try {
    const estudiantes = await apiFetch(`/postgres/estudiantes?seccionId=${seccionId}`);
    _incEstudiantesCache = estudiantes;
    sel.innerHTML = `<option value="">Seleccionar estudiante</option>` + estudiantes.map(e => `<option value="${e.id}">${e.nombres} ${e.apellidos}</option>`).join("");
  } catch (_) {
    sel.innerHTML = `<option value="">Error cargando</option>`;
  }
}
function onIncBuscarInput(texto) {
  const sug = document.getElementById("incSugerencias");
  const hidden = document.getElementById("incEstudianteIdHidden");
  if (hidden) hidden.value = "";
  if (!sug) return;
  const q = String(texto || "").trim().toLowerCase();
  if (q.length < 2) { sug.style.display = "none"; sug.innerHTML = ""; return; }
  const pool = _incTodosCache.length ? _incTodosCache : _incEstudiantesCache;
  const seen = new Set();
  const filtrados = [];
  for (const e of pool) {
    if (seen.has(e.id)) continue;
    if (`${e.nombres} ${e.apellidos}`.toLowerCase().includes(q)) { seen.add(e.id); filtrados.push(e); if (filtrados.length >= 8) break; }
  }
  if (!filtrados.length) { sug.innerHTML = `<div style="padding:10px; font-size:12px; color:#9ca3af;">Sin resultados</div>`; sug.style.display = "block"; return; }
  sug.innerHTML = filtrados.map(e => `<div onclick="selectIncEstudiante(${e.id}, '${String(e.nombres).replace(/'/g,"\\'")} ${String(e.apellidos).replace(/'/g,"\\'")}', '${e.grado||''}', '${e.letra||''}', ${e.seccion_id||'null'})" style="padding:8px 10px; cursor:pointer; font-size:12.5px; color:#374151; border-bottom:1px solid #f3f4f6;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='white'">${e.nombres} ${e.apellidos} <span style="color:#9ca3af; font-size:11px;">— ${e.grado||''} ${e.letra||''}</span></div>`).join("");
  sug.style.display = "block";
}
function onIncBuscarFocus() {
  const busc = document.getElementById("incBuscarEstudiante");
  if (busc && busc.value.trim().length >= 2) onIncBuscarInput(busc.value);
}
function selectIncEstudiante(id, nombre, grado, letra, seccionId) {
  const busc = document.getElementById("incBuscarEstudiante");
  const hidden = document.getElementById("incEstudianteIdHidden");
  const sel = document.getElementById("incEstudianteId");
  const selSec = document.getElementById("incSeccionId");
  const sug = document.getElementById("incSugerencias");
  if (busc) busc.value = nombre;
  if (hidden) hidden.value = String(id);
  if (sel) { sel.innerHTML = `<option value="${id}" selected>${nombre}</option>`; sel.value = String(id); }
  if (selSec && seccionId) selSec.value = String(seccionId);
  if (sug) { sug.style.display = "none"; sug.innerHTML = ""; }
}
function filtrarEstudiantesIncidencia(texto) { onIncBuscarInput(texto); }
async function buscarEstudianteGlobal(texto) {
  await cargarTodosEstudiantesCache();
  onIncBuscarInput(texto);
}

async function crearIncidencia() {
  const hiddenId = document.getElementById("incEstudianteIdHidden")?.value;
  const selId = document.getElementById("incEstudianteId")?.value;
  const estudiante_id = hiddenId || selId;
  const tipo = document.getElementById("incTipo")?.value;
  const descripcion = document.getElementById("incDescripcion")?.value.trim();
  const observacion = document.getElementById("incObservacion")?.value.trim();
  const derivar_a = document.getElementById("incDerivarA")?.value || null;
  const motivo = document.getElementById("incMotivoDerivacion")?.value.trim() || descripcion;
  const msg = document.getElementById("incMsg");
  if (!estudiante_id || !tipo || !descripcion) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Selecciona estudiante, tipo y descripción"; }
    return;
  }
  if (msg) { msg.style.color = "#6b7280"; msg.textContent = "Guardando incidencia..."; }
  try {
    const res = await apiFetch("/postgres/incidencias", {
      method: "POST",
      body: { estudiante_id: Number(estudiante_id), tipo, descripcion, observacion: observacion || null, derivar_a: derivar_a || null, motivo_derivacion: motivo, informe: observacion }
    });
    if (msg) { msg.style.color = "#059669"; msg.textContent = "Incidencia registrada"; }
    if (window.mostrarToastGlobal) mostrarToastGlobal(derivar_a ? `Incidencia + derivación a ${derivar_a}` : "Incidencia registrada", "ok");
    setTimeout(() => {
      cerrarModal("modalIncidencia");
      document.getElementById("incInlineFormWrap")?.classList.add("oculto");
      const secInc = document.getElementById("ps-incidencias");
      if (secInc && !secInc.classList.contains("oculto") && typeof incInlineCargar === "function") incInlineCargar();
      if (msg) msg.textContent = "";
      // Limpiar
      const desc = document.getElementById("incDescripcion"); if (desc) desc.value = "";
      const obs = document.getElementById("incObservacion"); if (obs) obs.value = "";
      // Recargar historial si está visible
      const hid = document.getElementById("incEstudianteId")?.value;
      if (hid) cargarHistorialExpediente(hid);
    }, 600);
  } catch (e) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Error: " + e.message; }
  }
}

async function cargarHistorialExpediente(estudianteId) {
  const cont = document.getElementById("historialExpediente");
  if (!cont) return;
  cont.innerHTML = `<div style="padding:12px; color:#6b7280; font-size:12px;">Cargando historial...</div>`;
  try {
    const data = await apiFetch(`/postgres/estudiantes/${estudianteId}/historial`);
    const perfil = data.perfil;
    const estudiante = data.estudiante;
    const incs = data.incidencias || [];
    const ders = data.derivaciones || [];
    let html = "";
    if (estudiante) {
      html += `<div style="font-size:13px; font-weight:800; color:#102a56; margin-bottom:8px;">${estudiante.nombres} ${estudiante.apellidos} — ${estudiante.grado} ${estudiante.letra} ${estudiante.nivel || ""}</div>`;
    }
    if (perfil) {
      html += `<div style="background:#f0f7ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:11px; font-weight:700; color:#1e3a5f; margin-bottom:4px;">Perfil — ${perfil.perfil_completado ? "Completo" : "Incompleto"}</div>
        <div style="font-size:11.5px; color:#374151; line-height:1.6;">
          Vive con: <strong>${perfil.con_quien_vive || "-"}</strong> · Convivencia: <strong>${perfil.situacion_convivencia || "-"}</strong><br>
          Apoderado: ${perfil.apoderado_nombre || "-"} (${perfil.apoderado_parentesco || ""}) — ${perfil.apoderado_telefono || ""}<br>
          ${perfil.antecedentes ? `Antecedentes: ${perfil.antecedentes}` : ""}
        </div>
      </div>`;
    } else {
      html += `<div style="font-size:12px; color:#9ca3af; margin-bottom:12px;">Sin perfil completado</div>`;
    }
    if (incs.length) {
      html += `<div style="font-size:11px; font-weight:700; color:#374151; margin-bottom:6px;">Incidencias (${incs.length})</div>`;
      html += incs.map(i => `
        <div style="border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin-bottom:6px; background:white;">
          <div style="font-size:11px; color:#6b7280;">${String(i.fecha_incidencia).slice(0,10)} · ${i.tipo} · por ${i.rol_creador || "?"}</div>
          <div style="font-size:12.5px; color:#111827; font-weight:600;">${i.descripcion}</div>
          ${i.observacion ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Obs: ${i.observacion}</div>` : ""}
        </div>
      `).join("");
    } else {
      html += `<div style="font-size:12px; color:#9ca3af;">Sin incidencias</div>`;
    }
    if (ders.length) {
      html += `<div style="font-size:11px; font-weight:700; color:#374151; margin:10px 0 6px;">Derivaciones (${ders.length})</div>`;
      html += ders.map(d => `
        <div style="border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin-bottom:6px; background:#fffbeb;">
          <div style="font-size:11px; color:#92400e;">${String(d.fecha_derivacion).slice(0,10)} → ${d.destino} · ${d.estado}</div>
          <div style="font-size:12.5px; color:#111827;">${d.motivo}</div>
          ${d.informe ? `<div style="font-size:12px; color:#6b7280;">Informe: ${d.informe}</div>` : ""}
        </div>
      `).join("");
    }
    cont.innerHTML = html || `<div style="font-size:12px; color:#9ca3af;">Sin historial</div>`;
  } catch (e) {
    cont.innerHTML = `<div style="font-size:12px; color:#b91c1c;">Error: ${e.message}</div>`;
  }
}

// Derivaciones — notificaciones
async function cargarDerivacionesPendientes() {
  const cont = document.getElementById("derivacionesLista");
  if (!cont) return;
  cont.innerHTML = `<div style="padding:12px; color:#6b7280;">Cargando derivaciones...</div>`;
  try {
    const data = await apiFetch("/postgres/derivaciones?estado=pendiente");
    if (!data.length) {
      cont.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:12px;">Sin derivaciones pendientes</div>`;
      return;
    }
    cont.innerHTML = data.map(d => `
      <div class="card" style="padding:14px; border-left:3px solid #f59e0b;">
        <div style="font-size:11px; color:#92400e; margin-bottom:4px;">${String(d.fecha_derivacion).slice(0,10)} · De: ${d.origen_correo || d.origen_rol} → ${d.estudiante_id}</div>
        <div style="font-size:13px; font-weight:700; color:#111827;">${d.nombres} ${d.apellidos} — ${d.grado} ${d.letra}</div>
        <div style="font-size:12px; color:#374151; margin:4px 0;">Motivo: ${d.motivo}</div>
        ${d.informe ? `<div style="font-size:12px; color:#6b7280; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:8px; margin-top:6px;">Informe: ${d.informe}</div>` : ""}
        ${d.expediente ? `<div style="font-size:11px; color:#6b7280; margin-top:6px;">Expediente: perfil ${d.expediente.perfil ? "completo" : "incompleto"} · incidencia ${d.incidencia_id || "directa"}</div>` : ""}
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-primary btn-sm" onclick="atenderDerivacion(${d.id})">Marcar atendida</button>
          <button class="btn btn-secondary btn-sm" onclick="verExpedienteDerivacion(${d.estudiante_id})">Ver expediente</button>
        </div>
      </div>
    `).join("");
    // Badge
    const badge = document.getElementById("badgeDerivaciones");
    if (badge) { badge.textContent = data.length; badge.classList.remove("oculto"); }
  } catch (e) {
    cont.innerHTML = `<div style="font-size:12px; color:#b91c1c;">Error: ${e.message}</div>`;
  }
}

async function atenderDerivacion(id) {
  try {
    await apiFetch(`/postgres/derivaciones/${id}/atender`, { method: "POST" });
    if (window.mostrarToastGlobal) mostrarToastGlobal("Derivación atendida", "ok");
    cargarDerivacionesPendientes();
  } catch (e) {
    if (window.mostrarToastGlobal) mostrarToastGlobal(e.message, "error");
  }
}

function verExpedienteDerivacion(estudianteId) {
  if (typeof abrirPerfilEstudiante === "function") abrirPerfilEstudiante(estudianteId);
  else window.location.hash = `#estudiante-${estudianteId}`;
}
async function cargarMiHistorial(){
  try{
    const me = await apiFetch("/postgres/estudiantes/me/perfil");
    const eid = me.estudiante_id;
    if(!eid) return;
    // Reusar el mismo render pero en el contenedor del estudiante
    const cont = document.getElementById("historialExpedienteEstudiante");
    if(cont){
      // Temporalmente mapear el ID esperado por cargarHistorialExpediente
      const orig = document.getElementById("historialExpediente");
      // Crear un contenedor temporal si no existe el original
      if(!orig){
        const tmp = document.createElement("div");
        tmp.id = "historialExpediente";
        tmp.style.display = "none";
        document.body.appendChild(tmp);
      }
      await cargarHistorialExpediente(eid);
      // Copiar contenido al contenedor de estudiante
      const src = document.getElementById("historialExpediente");
      if(src && cont) cont.innerHTML = src.innerHTML;
    } else {
      await cargarHistorialExpediente(eid);
    }
  }catch(_){}
}

// Crear derivación directa sin incidencia
async function crearDerivacionDirecta() {
  const estudiante_id = document.getElementById("derEstudianteId")?.value;
  const destino = document.getElementById("derDestino")?.value;
  const motivo = document.getElementById("derMotivo")?.value.trim();
  const informe = document.getElementById("derInforme")?.value.trim();
  const msg = document.getElementById("derMsg");
  if (!estudiante_id || !destino || !motivo) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Estudiante, destino y motivo obligatorios"; }
    return;
  }
  if (msg) { msg.style.color = "#6b7280"; msg.textContent = "Derivando..."; }
  try {
    await apiFetch("/postgres/derivaciones", { method: "POST", body: { estudiante_id: Number(estudiante_id), destino, motivo, informe } });
    if (msg) { msg.style.color = "#059669"; msg.textContent = "Derivación enviada"; }
    if (window.mostrarToastGlobal) mostrarToastGlobal(`Derivado a ${destino}`, "ok");
    setTimeout(() => { cerrarModal("modalDerivacion"); if (msg) msg.textContent = ""; }, 600);
  } catch (e) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Error: " + e.message; }
  }
}
