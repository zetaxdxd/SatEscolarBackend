// Expediente formatos — manejo de fichas por estudiante con correlativo
const TIPOS_EXPEDIENTE = [
  { id: 'ficha_diagnostica', label: 'Ficha Diagnóstica' },
  { id: 'consentimiento', label: 'Consentimiento Informado' },
  { id: 'acta_compromiso', label: 'Acta de Compromiso' },
  { id: 'entrevista_estudiante', label: 'Entrevista al Estudiante' },
  { id: 'entrevista_padre', label: 'Entrevista al Padre' },
  { id: 'ficha_estudiante', label: 'Ficha Personal del Estudiante' },
  { id: 'visita_domiciliaria', label: 'Visita Domiciliaria' },
  { id: 'derivacion_interna', label: 'Derivación Interna' },
  { id: 'derivacion_externa', label: 'Derivación Externa' },
  { id: 'seguimiento', label: 'Ficha de Seguimiento' }
];

let _expedienteEstudianteId = null;
let _expedienteTipoActual = 'ficha_diagnostica';

async function abrirExpediente(estudianteId, nombre) {
  _expedienteEstudianteId = estudianteId;
  document.getElementById("expedienteEstudianteNombre").textContent = nombre || `Estudiante #${estudianteId}`;
  document.getElementById("modalExpediente")?.classList.remove("oculto");
  // Cargar pestañas
  renderExpedienteTabs();
  await cargarExpedienteFormatos();
}

function renderExpedienteTabs() {
  const cont = document.getElementById("expedienteTabs");
  if (!cont) return;
  cont.innerHTML = TIPOS_EXPEDIENTE.map(t => `
    <button onclick="cambiarExpedienteTipo('${t.id}')" style="padding:6px 10px; border-radius:8px; font-size:11px; font-weight:600; border:1px solid ${t.id===_expedienteTipoActual?'#1a3a5c':'#e5e7eb'}; background:${t.id===_expedienteTipoActual?'#1a3a5c':'white'}; color:${t.id===_expedienteTipoActual?'white':'#6b7280'}; cursor:pointer;">
      ${t.label}
    </button>
  `).join("");
}

async function cambiarExpedienteTipo(tipo) {
  _expedienteTipoActual = tipo;
  renderExpedienteTabs();
  await cargarExpedienteFormatos();
}

// ── Expediente en página (ps-expediente), sin ventana flotante ──
let _expInlineFiltro = null;
let _expInlineFormatos = [];
let _expEstCache = null;

let _expGradosCache = null;
async function renderExpedienteGrados() {
  const gradCont = document.getElementById("expGrados");
  const secCont = document.getElementById("expSecciones");
  const estCont = document.getElementById("expEstudiantes");
  if (!gradCont) return;
  gradCont.classList.remove("oculto");
  secCont?.classList.add("oculto");
  estCont?.classList.add("oculto");
  gradCont.innerHTML = '<p style="font-size:12px; color:#6b7280;">Cargando grados...</p>';
  try {
    let secciones = _expGradosCache;
    if (!secciones) {
      const dash = await apiFetch("/postgres/psicologia/dashboard").catch(()=>null);
      secciones = dash?.secciones || await apiFetch("/postgres/psicologia/secciones-asignadas").catch(()=>[]);
      _expGradosCache = secciones;
    }
    const gradosMap = {};
    secciones.forEach(s => {
      if (!gradosMap[s.grado]) gradosMap[s.grado] = { grado: s.grado, nivel: s.nivel, secciones: [] };
      gradosMap[s.grado].secciones.push(s);
    });
    const order = {"1ro":1,"2do":2,"3ro":3,"4to":4,"5to":5,"6to":6};
    const grados = Object.values(gradosMap).sort((a,b)=>(order[a.grado]||99)-(order[b.grado]||99));
    gradCont.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:10px;">
        ${grados.map(g=>`
          <div class="card" style="padding:14px; cursor:pointer; text-align:center; border:1px solid #e5e7eb;" onclick="navegarExpedienteSecciones('${g.grado}')">
            <div style="width:36px; height:36px; border-radius:8px; background:var(--azul); display:grid; place-items:center; color:#fff; font-weight:800; font-size:12px; margin:0 auto 8px;">${g.grado}</div>
            <div style="font-weight:700; font-size:13px;">${g.grado} - ${g.nivel}</div>
            <div style="font-size:11px; color:var(--gris);">${g.secciones.length} secciones</div>
          </div>
        `).join("")}
      </div>
    `;
    if (!grados.length) gradCont.innerHTML = '<p style="font-size:12px; color:#9ca3af;">Sin secciones con tutor.</p>';
  } catch(e){
    gradCont.innerHTML = `<p style="font-size:12px; color:#b91c1c;">Error: ${escaparHtml(e.message)}</p>`;
  }
}
async function navegarExpedienteSecciones(grado){
  const gradCont = document.getElementById("expGrados");
  const secCont = document.getElementById("expSecciones");
  const estCont = document.getElementById("expEstudiantes");
  gradCont?.classList.add("oculto");
  estCont?.classList.add("oculto");
  secCont?.classList.remove("oculto");
  secCont.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
      <a class="breadcrumb-link" style="cursor:pointer" onclick="renderExpedienteGrados()">Grados</a>
      <span>&rsaquo;</span>
      <strong>${grado}</strong>
    </div>
    <div id="expSeccionesList" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:10px;"></div>
  `;
  try{
    let secciones = _expGradosCache;
    if(!secciones){
      const dash = await apiFetch("/postgres/psicologia/dashboard").catch(()=>null);
      secciones = dash?.secciones || await apiFetch("/postgres/psicologia/secciones-asignadas").catch(()=>[]);
      _expGradosCache = secciones;
    }
    const filtradas = secciones.filter(s=>s.grado===grado);
    const list = document.getElementById("expSeccionesList");
    list.innerHTML = filtradas.map(s=>`
      <div class="card" style="padding:14px; cursor:pointer; text-align:center; border:1px solid #e5e7eb;" onclick="navegarExpedienteEstudiantes('${s.grado}','${s.letra}',${s.id})">
        <div style="width:36px; height:36px; border-radius:8px; background:var(--azul); display:grid; place-items:center; color:#fff; font-weight:800; font-size:12px; margin:0 auto 8px;">${s.grado} ${s.letra}</div>
        <div style="font-weight:700; font-size:13px;">${s.grado} ${s.letra}</div>
        <div style="font-size:11px; color:var(--gris);">${s.nivel}</div>
      </div>
    `).join("");
    if (!filtradas.length) list.innerHTML = '<p style="font-size:12px; color:#9ca3af;">Sin secciones para este grado.</p>';
  }catch(e){
    secCont.innerHTML += `<p style="font-size:12px; color:#b91c1c;">Error: ${e.message}</p>`;
  }
}
async function navegarExpedienteEstudiantes(grado, letra, seccionId){
  const secCont = document.getElementById("expSecciones");
  const estCont = document.getElementById("expEstudiantes");
  secCont?.classList.add("oculto");
  estCont?.classList.remove("oculto");
  estCont.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
      <a class="breadcrumb-link" style="cursor:pointer" onclick="renderExpedienteGrados()">Grados</a>
      <span>&rsaquo;</span>
      <a class="breadcrumb-link" style="cursor:pointer" onclick="navegarExpedienteSecciones('${grado}')">${grado}</a>
      <span>&rsaquo;</span>
      <strong>${grado} ${letra}</strong>
    </div>
    <div id="expEstudiantesList" style="display:grid; gap:8px;"><p style="font-size:12px; color:#6b7280;">Cargando estudiantes...</p></div>
  `;
  try{
    const estudiantes = await apiFetch(`/postgres/estudiantes?seccionId=${seccionId}`);
    const list = document.getElementById("expEstudiantesList");
    if(!estudiantes.length){
      list.innerHTML = '<p style="font-size:12px; color:#9ca3af;">Sin estudiantes en esta sección.</p>';
      return;
    }
    list.innerHTML = estudiantes.map(e=>{
      const nom = `${e.nombres||''} ${e.apellidos||''}`.trim().replace(/'/g,"\\'");
      return `<div onclick="expInlineAbrir(${e.id}, '${nom}')" style="border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; background:white; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.borderColor='#1a3a5c'" onmouseout="this.style.borderColor='#e5e7eb'">
        <div><strong style="font-size:13px; color:#1f2937;">${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</strong><div style="font-size:11px; color:#6b7280;">${escaparHtml(e.correo||'')}</div></div>
        <span style="font-size:12px; color:var(--azul); font-weight:700;">Abrir →</span>
      </div>`;
    }).join("");
  }catch(e){
    document.getElementById("expEstudiantesList").innerHTML = `<p style="font-size:12px; color:#b91c1c;">Error: ${e.message}</p>`;
  }
}
async function expInlineAbrir(estudianteId, nombre) {
  const id = Number(estudianteId) || Number(_expedienteEstudianteId) || 0;
  const picker = document.getElementById("expInlinePicker");
  const vista = document.getElementById("expInlineVista");
  if (!picker || !vista) return;
  if (!id) {
    picker.classList.remove("oculto");
    vista.classList.add("oculto");
    renderExpedienteGrados();
    return;
  }
  _expedienteEstudianteId = id;
  if (nombre) {
    const h = document.getElementById("expedienteEstudianteNombre");
    if (h) h.textContent = nombre;
  }
  picker.classList.add("oculto");
  vista.classList.remove("oculto");
  _expInlineFiltro = null;
  await expInlineCargarHead();
  await expInlineCargar();
}
function expInlineVolver() {
  _expedienteEstudianteId = null;
  _expInlineFiltro = null;
  document.getElementById("expInlineVista")?.classList.add("oculto");
  document.getElementById("expInlinePicker")?.classList.remove("oculto");
  const b = document.getElementById("expInlineSearch");
  const r = document.getElementById("expInlineResults");
  if (b) b.value = "";
  if (r) r.innerHTML = '<p style="font-size:12px; color:#9ca3af;">Escribe al menos 2 letras.</p>';
  renderExpedienteGrados();
}
async function expInlineCargarHead() {
  const head = document.getElementById("expInlineHead");
  if (!head || !_expedienteEstudianteId) return;
  head.innerHTML = '<span style="font-size:12px; color:#6b7280;">Cargando estudiante...</span>';
  try {
    const det = await apiFetch(`/postgres/psicologia/estudiantes/${_expedienteEstudianteId}/detalle-completo`).catch(() => null);
    const e = (det && det.estudiante) || {};
    const nombre = `${e.nombres || ''} ${e.apellidos || ''}`.trim() || document.getElementById("expedienteEstudianteNombre")?.textContent || `Estudiante #${_expedienteEstudianteId}`;
    const secc = e.grado ? `${e.grado} ${e.letra || ''}`.trim() : '';
    const riesgo = e.nivel_riesgo || (det && det.indicador && det.indicador.nivel) || 'Sin datos';
    const cls = String(riesgo).includes('Alto') ? 'alto' : String(riesgo).includes('Medio') ? 'medio' : 'bajo';
    head.innerHTML = `<div style="font-size:16px; font-weight:800; color:#102a56;">${escaparHtml(nombre)}</div>`
      + `<div style="font-size:12px; color:#6b7280; margin-top:2px;">${escaparHtml(secc)}${e.correo ? ' · ' + escaparHtml(e.correo) : ''}</div>`
      + `<div style="margin-top:6px;"><span class="status-badge ${cls}">${escaparHtml(riesgo)}</span></div>`;
    const h2 = document.getElementById("expedienteEstudianteNombre");
    if (h2) h2.textContent = nombre;
  } catch (_) { /* conserva nombre previo */ }
}
async function expInlineCargar() {
  const tiles = document.getElementById("expInlineTiles");
  if (!tiles || !_expedienteEstudianteId) return;
  tiles.innerHTML = '<p style="font-size:12px; color:#6b7280;">Cargando documentos...</p>';
  try {
    _expInlineFormatos = await apiFetch(`/postgres/expediente/${_expedienteEstudianteId}/formatos`);
    const porTipo = {};
    _expInlineFormatos.forEach(f => { porTipo[f.tipo] = (porTipo[f.tipo] || 0) + 1; });
    tiles.innerHTML = TIPOS_EXPEDIENTE.map(t => {
      const n = porTipo[t.id] || 0;
      const activo = _expInlineFiltro === t.id;
      return `<div onclick="expInlineFiltrar('${t.id}')" title="Filtrar por ${t.label}" style="border:1px solid ${activo ? '#1a3a5c' : '#e5e7eb'}; background:${activo ? '#eef4fb' : 'white'}; border-radius:12px; padding:14px 10px; cursor:pointer; transition:all .15s; text-align:center;" onmouseover="this.style.borderColor='#1a3a5c'" onmouseout="this.style.borderColor='${activo ? '#1a3a5c' : '#e5e7eb'}'">`
        + `<div style="font-size:12.5px; font-weight:700; color:#1a3a5c; line-height:1.35; min-height:34px; display:flex; align-items:center; justify-content:center;">${t.label}</div>`
        + `<div style="margin-top:8px;"><span style="display:inline-block; font-size:11px; font-weight:700; background:${n ? '#1a3a5c' : '#f3f4f6'}; color:${n ? 'white' : '#6b7280'}; padding:2px 10px; border-radius:999px;">${n} registro${n === 1 ? '' : 's'}</span></div></div>`;
    }).join("");
    expInlineHistorial();
  } catch (e) {
    tiles.innerHTML = `<p style="font-size:12px; color:#b91c1c;">Error: ${escaparHtml(e.message)}</p>`;
  }
}
function expInlineFiltrar(tipo) {
  _expInlineFiltro = (_expInlineFiltro === tipo) ? null : tipo;
  if (_expInlineFiltro) _expedienteTipoActual = _expInlineFiltro;
  expInlineCargar();
}
function expInlineHistorial() {
  const cont = document.getElementById("expInlineHist");
  const det = document.getElementById("expInlineDetalle");
  const tit = document.getElementById("expInlineHistTitulo");
  if (!cont) return;
  if (det) det.classList.add("oculto");
  cont.classList.remove("oculto");
  const lista = _expInlineFiltro ? _expInlineFormatos.filter(f => f.tipo === _expInlineFiltro) : _expInlineFormatos;
  if (tit) tit.textContent = _expInlineFiltro ? `Historial — ${tipoExpedienteLabel(_expInlineFiltro)}` : "Historial";
  if (!lista.length) {
    cont.innerHTML = `<div style="background:#f9fafb; border:1px dashed #d1d5db; border-radius:10px; padding:18px; text-align:center; color:#6b7280; font-size:12.5px;">Sin registros${_expInlineFiltro ? ' de ' + tipoExpedienteLabel(_expInlineFiltro) : ''}.</div>`;
    return;
  }
  cont.innerHTML = lista.map(f => {
    const d = f.datos || {};
    const entradas = Object.entries(d).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
    const vista = entradas.slice(0, 2).map(([k, v]) => `<div style="font-size:11px; color:#4b5563;"><strong style="color:#1a3a5c;">${expNombreBonito(k)}:</strong> ${escaparHtml(String(v).slice(0, 120))}</div>`).join("");
    return `<div style="border:1px solid #e5e7eb; border-left:3px solid #1a3a5c; border-radius:10px; padding:12px; background:white;">`
      + `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">`
      + `<span style="font-size:12px; font-weight:700; color:#1a3a5c;">${tipoExpedienteLabel(f.tipo)} N.° ${f.correlativo} <span style="font-weight:400; color:#6b7280;">· ${String(f.fecha_registro).slice(0, 10)}</span></span>`
      + `<div style="display:flex; gap:6px; flex-shrink:0;"><button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="expInlineDetalle(${f.id})">Ver</button>`
      + `<button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="imprimirExpedienteFormato(${f.id})">Imprimir</button></div></div>`
      + (vista ? `<div style="display:grid; gap:2px;">${vista}</div>` : "")
      + (f.archivo_nombre ? `<div style="font-size:11px; color:#6b7280; margin-top:4px;">Adjunto: ${escaparHtml(f.archivo_nombre)}</div>` : "")
      + `</div>`;
  }).join("");
}
async function expInlineDetalle(id) {
  const cont = document.getElementById("expInlineHist");
  const det = document.getElementById("expInlineDetalle");
  if (!det) return;
  det.classList.remove("oculto");
  if (cont) cont.classList.add("oculto");
  det.innerHTML = '<p style="font-size:12px; color:#6b7280;">Cargando documento...</p>';
  try {
    const f = await apiFetch(`/postgres/expediente/formatos/${id}`);
    const d = f.datos || {};
    let html = `<button class="btn btn-secondary btn-sm" style="margin-bottom:12px;" onclick="document.getElementById('expInlineDetalle').classList.add('oculto'); document.getElementById('expInlineHist').classList.remove('oculto')">← Volver al historial</button>`;
    html += `<div style="font-size:11px; color:#6b7280; margin-bottom:10px; background:#f0f4fa; border:1px solid #dbe4f0; border-radius:8px; padding:8px 10px;">${tipoExpedienteLabel(f.tipo)} N.° ${f.correlativo} · ${String(f.fecha_registro).slice(0, 10)} · Solo lectura</div>`;
    html += EXPEDIENTE_FORMS[f.tipo] ? renderVistaExpediente(f.tipo, d) : '<p style="font-size:12px; color:#9ca3af;">Sin datos registrados.</p>';
    if (f.archivo_nombre) html += `<div style="margin-top:10px; font-size:12px;"><a href="data:${f.archivo_tipo};base64,${f.archivo_base64}" download="${f.archivo_nombre}" style="color:#1a3a5c; font-weight:700;">Descargar adjunto: ${escaparHtml(f.archivo_nombre)}</a></div>`;
    html += `<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px; border-top:1px solid #e5e7eb; padding-top:12px;"><button class="btn btn-primary" onclick="imprimirExpedienteFormato(${f.id})">Imprimir</button></div>`;
    det.innerHTML = html;
    det.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    det.innerHTML = `<button class="btn btn-secondary btn-sm" style="margin-bottom:12px;" onclick="document.getElementById('expInlineDetalle').classList.add('oculto'); document.getElementById('expInlineHist').classList.remove('oculto')">← Volver al historial</button><p style="font-size:12px; color:#b91c1c;">Error: ${escaparHtml(e.message)}</p>`;
  }
}
let _expInlineEstCache = null;
async function expInlineBuscar(q) {
  const res = document.getElementById("expInlineResults");
  if (!res) return;
  q = String(q || "").trim().toLowerCase();
  if (q.length < 2) { res.innerHTML = '<p style="font-size:12px; color:#9ca3af;">Escribe al menos 2 letras.</p>'; return; }
  res.innerHTML = '<p style="font-size:12px; color:#6b7280;">Buscando...</p>';
  try {
    if (!_expInlineEstCache) _expInlineEstCache = await apiFetch("/postgres/estudiantes");
    const list = (_expInlineEstCache || []).filter(e => `${e.nombres || ''} ${e.apellidos || ''}`.toLowerCase().includes(q)).slice(0, 8);
    res.innerHTML = list.length ? list.map(e => {
      const nom = `${e.nombres || ''} ${e.apellidos || ''}`.trim().replace(/'/g, "\\'");
      return `<div onclick="expInlineAbrir(${e.id}, '${nom}')" style="border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; background:white; cursor:pointer;" onmouseover="this.style.borderColor='#1a3a5c'" onmouseout="this.style.borderColor='#e5e7eb'"><strong style="font-size:13px; color:#1f2937;">${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</strong><div style="font-size:11px; color:#6b7280;">${escaparHtml(e.grado || '')} ${escaparHtml(e.letra || '')} · ${escaparHtml(e.correo || '')}</div></div>`;
    }).join("") : '<p style="font-size:12px; color:#9ca3af;">Sin resultados.</p>';
  } catch (e) {
    res.innerHTML = `<p style="font-size:12px; color:#b91c1c;">Error: ${escaparHtml(e.message)}</p>`;
  }
}

async function cargarExpedienteFormatos() {
  const cont = document.getElementById("expedienteLista");
  if (!cont || !_expedienteEstudianteId) return;
  cont.innerHTML = `<div style="padding:12px; color:#6b7280; font-size:12px;">Cargando...</div>`;
  try {
    const data = await apiFetch(`/postgres/expediente/${_expedienteEstudianteId}/formatos?tipo=${_expedienteTipoActual}`);
    if (!data.length) {
      cont.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:12px;">Sin registros de ${TIPOS_EXPEDIENTE.find(t=>t.id===_expedienteTipoActual)?.label}. <br><button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="abrirModalNuevoFormato()">+ Nuevo</button></div>`;
      return;
    }
    cont.innerHTML = data.map(f => {
      const d = f.datos || {};
      const label = tipoExpedienteLabel(f.tipo);
      const entradas = Object.entries(d).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
      const vista = entradas.slice(0, 3).map(([k, v]) => `<div style="font-size:11px; color:#4b5563; line-height:1.5;"><strong style="color:#1a3a5c;">${expNombreBonito(k)}:</strong> ${String(v).slice(0, 140)}</div>`).join("");
      return `
      <div class="card" style="padding:12px; margin-bottom:8px; border-left:3px solid #1a3a5c;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px;">
          <span style="font-size:11.5px; font-weight:700; color:#1a3a5c;">${label} N.° ${f.correlativo} <span style="font-weight:400; color:#6b7280;">· ${String(f.fecha_registro).slice(0, 10)}</span></span>
          <div style="display:flex; gap:4px; flex-shrink:0;">
            <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="verExpedienteFormato(${f.id})">Ver</button>
            <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="imprimirExpedienteFormato(${f.id})">Imprimir</button>
          </div>
        </div>
        ${vista ? `<div style="display:grid; gap:2px; background:#f9fafb; border:1px solid #f3f4f6; border-radius:8px; padding:8px;">${vista}</div>${entradas.length > 3 ? `<div style="font-size:10.5px; color:#9ca3af; margin-top:4px;">+${entradas.length - 3} campos más — pulsa Ver</div>` : ""}` : `<div style="font-size:12px; color:#9ca3af; font-style:italic;">Sin datos</div>`}
        ${f.archivo_nombre ? `<div style="font-size:11px; color:#6b7280; margin-top:6px;">Adjunto: ${f.archivo_nombre}</div>` : ""}
      </div>
    `;
    }).join("") + `<div style="text-align:center; margin-top:10px;"><button class="btn btn-primary btn-sm" onclick="abrirModalNuevoFormato()">+ Nuevo ${tipoExpedienteLabel(_expedienteTipoActual)}</button></div>`;
  } catch (e) {
    cont.innerHTML = `<div style="font-size:12px; color:#b91c1c;">Error: ${e.message}</div>`;
  }
}

// ── Formatos digitales espejo de los documentos del área ──
// Misma estructura y orden que el papel: encabezado institucional,
// secciones numeradas y los mismos campos/etiquetas.
const EXP_DOC_HEAD = '<div style="background:linear-gradient(135deg,#1e4976 0%,#1a3a5c 100%); color:white; border-radius:10px; padding:14px; text-align:center; margin-bottom:12px;">'
  + '<div style="font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:#ffffff;">{{EXP_TITULO}}</div>'
  + '<div style="font-size:10.5px; opacity:.9; margin-top:3px;">Área de Psicología · Psic. Edinson Moises Ruiz · C.PS.P. N° 56460</div></div>';

const EXPEDIENTE_FORMS = {
  ficha_diagnostica: { titulo: 'Ficha Diagnóstica', secciones: [
    { t: 'Datos generales', campos: [
      { k: 'apellidosNombres', label: 'Apellidos y nombres', t: 'text' },
      { k: 'edad', label: 'Edad', t: 'text', w: 'half' },
      { k: 'grado', label: 'Grado', t: 'text', w: 'half' },
      { k: 'seccion', label: 'Sección', t: 'text', w: 'half' }
    ]},
    { t: 'Aspecto familiar', campos: [
      { k: 'conQuienVives', label: '¿Con quién vives?', t: 'radio', opts: ['Ambos padres', 'Solo madre', 'Solo padre', 'Abuelos', 'Otros'] },
      { k: 'relacionesFamiliares', label: 'Relaciones familiares', t: 'radio', opts: ['Armoniosas', 'Regularmente armoniosas', 'Conflictivas', 'Violentas'] },
      { k: 'problemasHogar', label: '¿Qué problemas presenta el hogar?', t: 'text' }
    ]},
    { t: 'Vivienda, salud y académico', campos: [
      { k: 'viviendaTipo', label: 'Vivienda: propia / alquilada / alojados', t: 'text' },
      { k: 'saludSeguro', label: 'Seguro: SIS / EsSalud / otro', t: 'text' },
      { k: 'observaciones', label: 'Observaciones', t: 'textarea', rows: 3 }
    ]}
  ]},
  consentimiento: { titulo: 'Consentimiento Informado', secciones: [
    { t: 'Datos', campos: [
      { k: 'fecha', label: 'Fecha', t: 'date', w: 'half' },
      { k: 'nombrePaciente', label: 'Nombre del paciente', t: 'text' },
      { k: 'nombreRepresentante', label: 'Nombre del representante legal (si corresponde)', t: 'text' }
    ]},
    { t: 'Manifiesto', campos: [
      { t: 'html', html: 'Manifiesto que: 1) Recibí información confidencial, clara y satisfactoria sobre objetivos, procedimientos, temporalidad y honorarios. 2) Acuerdo que será solo el/la psicólogo(a) quien preste la intervención. 3) El consentimiento podrá ser revocado libremente en cualquier momento. 4) Los datos se usarán solo para la intervención, facturación y seguimiento, con confidencialidad garantizada.' },
      { k: 'autoriza', label: 'Autorizo y otorgo mi consentimiento para la intervención profesional y el tratamiento de datos', t: 'check' }
    ]}
  ]},
  acta_compromiso: { titulo: 'Acta de Compromiso', secciones: [
    { t: 'Datos', campos: [
      { k: 'fecha', label: 'Fecha', t: 'date', w: 'half' },
      { k: 'estudiante', label: 'Estudiante', t: 'text' }
    ]},
    { t: 'Compromisos y acuerdos', campos: [
      { k: 'compromisos', label: 'Compromisos asumidos', t: 'textarea', rows: 4 },
      { k: 'acuerdos', label: 'Acuerdos', t: 'textarea', rows: 3 },
      { k: 'firmantes', label: 'Firmantes (nombres y parentesco)', t: 'text' }
    ]}
  ]},
  entrevista_estudiante: { titulo: 'Registro de Entrevista con el Estudiante', secciones: [
    { t: 'Datos', campos: [
      { k: 'apellidosNombres', label: 'Apellidos y nombres', t: 'text' },
      { k: 'gradoSeccion', label: 'Grado y sección', t: 'text', w: 'half' },
      { k: 'fechaEntrevista', label: 'Fecha de la entrevista', t: 'date', w: 'half' },
      { k: 'solicitadaPor', label: 'Entrevista solicitada por', t: 'text' },
      { k: 'motivo', label: 'Motivo', t: 'text' },
      { k: 'dimension', label: 'Dimensión (Académica, personal, social)', t: 'radio', opts: ['Académica', 'Personal', 'Social'] }
    ]},
    { t: 'Desarrollo de la entrevista', campos: [
      { k: 'aspectos', label: 'Aspectos principales abordados en la entrevista', t: 'textarea', rows: 5 },
      { k: 'conclusiones', label: 'Conclusiones y acuerdos tomados', t: 'textarea', rows: 4 },
      { k: 'observaciones', label: 'Observaciones', t: 'textarea', rows: 3 },
      { k: 'proximaFecha', label: 'Fecha de próxima reunión de seguimiento (si fuera necesario)', t: 'date' }
    ]}
  ]},
  entrevista_padre: { titulo: 'Registro de Entrevista con el Padre de Familia', secciones: [
    { t: 'Datos', campos: [
      { k: 'apellidosNombres', label: 'Apellidos y nombres (estudiante)', t: 'text' },
      { k: 'gradoSeccion', label: 'Grado y sección', t: 'text', w: 'half' },
      { k: 'fechaEntrevista', label: 'Fecha de la entrevista', t: 'date', w: 'half' },
      { k: 'solicitadaPor', label: 'Entrevista solicitada por', t: 'text' },
      { k: 'motivo', label: 'Motivo', t: 'text' }
    ]},
    { t: 'Desarrollo', campos: [
      { k: 'aspectos', label: 'Aspectos principales abordados en la entrevista', t: 'textarea', rows: 5 },
      { k: 'compromisosPadre', label: 'Compromisos del padre', t: 'textarea', rows: 4 },
      { k: 'sugerencias', label: 'Sugerencias y recomendaciones', t: 'textarea', rows: 3 },
      { k: 'proximaFecha', label: 'Fecha de próxima reunión de seguimiento (si fuera necesario)', t: 'date' }
    ]}
  ]},
  ficha_estudiante: { titulo: 'Ficha Personal del Estudiante', secciones: [
    { t: 'I. Datos personales', campos: [
      { k: 'apellidosNombres', label: 'Apellidos y nombres', t: 'text' },
      { k: 'grado', label: 'Grado', t: 'text', w: 'half' },
      { k: 'seccion', label: 'Sección', t: 'text', w: 'half' },
      { k: 'fecha', label: 'Fecha', t: 'date', w: 'half' },
      { k: 'edad', label: 'Edad', t: 'text', w: 'half' },
      { k: 'dni', label: 'D.N.I.', t: 'text', w: 'half' },
      { k: 'lugarFechaNac', label: 'Lugar y fecha de nacimiento', t: 'text' },
      { k: 'domicilio', label: 'Domicilio', t: 'text' },
      { k: 'telefono', label: 'Teléfono / celular', t: 'text', w: 'half' },
      { k: 'trabaja', label: 'Trabajas', t: 'radio', opts: ['Si', 'No'] },
      { k: 'enQueTrabaja', label: 'Si trabajas ¿en qué?', t: 'text' },
      { k: 'queHacePago', label: '¿Qué haces con tu pago?', t: 'text' }
    ]},
    { t: 'II. Datos familiares', campos: [
      { k: 'fam', t: 'tabla', cols: ['Nombres y Apellidos', 'Vive', 'Edad', 'Grado de instrucción', 'Ocupación', 'Estudia / Trabaja', 'Apoya en gastos'], rows: ['Padre', 'Madre', 'Hno. 01', 'Hno. 02', 'Hno. 03', 'Hno. 04', 'Hno. 05'] },
      { k: 'estadoCivil', label: '¿Cuál es el estado civil de tus padres?', t: 'radio', opts: ['Casado', 'Conviviente'] },
      { k: 'separados', label: 'Tus padres están separados', t: 'radio', opts: ['Si', 'No'] },
      { k: 'conQuienVives', label: 'Si tus padres son separados ¿con quién vives?', t: 'radio', opts: ['Papá', 'Mamá'] },
      { k: 'porqueSeparados', label: '¿Por qué?', t: 'text' },
      { k: 'relacionPadres', label: 'Si tus padres son separados: ¿cómo es la relación entre ellos?', t: 'radio', opts: ['Buena, cuando se ven conversan amablemente', 'Mala, cuando se ven, pelean', 'Indiferente, no quieren verse'] },
      { k: 'conversas', label: '¿Conversas frecuentemente con tus padres sobre lo que te pasa día a día?', t: 'radio', opts: ['Si, cuando llego del colegio conversamos', 'Conversamos de vez en cuando', 'No, mis padres nunca tienen tiempo'] },
      { k: 'golpean', label: 'En casa ¿te golpean?', t: 'radio', opts: ['Si', 'No'] },
      { k: 'quienGolpea', label: '¿Quién?', t: 'radio', opts: ['Papá', 'Mamá', 'Otros'] },
      { k: 'agredenVerbal', label: '¿Te agreden verbalmente?', t: 'radio', opts: ['Si', 'No'] },
      { k: 'quienAgrede', label: '¿Quién?', t: 'radio', opts: ['Papá', 'Mamá', 'Otros'] },
      { k: 'discusiones', label: '¿Existen discusiones fuertes en tu familia?', t: 'radio', opts: ['Si', 'No'] },
      { k: 'comoSientes', label: '¿Cómo te sientes al respecto?', t: 'checks', opts: ['Enojado', 'Triste', 'Indiferente', 'Tranquilo(a)', 'No soportas estar en casa'] },
      { k: 'dondeSeguro', label: '¿Dónde te sientes más seguro(a) y contento(a)?', t: 'radio', opts: ['En mi casa', 'Calle', 'Colegio'] },
      { k: 'drogasAlcohol', label: '¿Alguno de tus familiares tiene problemas de drogas o alcohol?', t: 'radio', opts: ['Si', 'No'] },
      { k: 'quienDrogas', label: '¿Quién?', t: 'text' },
      { k: 'recurres', label: '¿Cuándo tienes problemas a quién recurres?', t: 'checks', opts: ['Papá', 'Mamá', 'Amigos', 'Otros'] }
    ]},
    { t: 'III. Aspecto socioeconómico', campos: [
      { k: 'situacionEconomica', label: '¿Cuál es la situación económica de tu familia?', t: 'radio', opts: ['Muy buena', 'Buena', 'Regular', 'Mala'] },
      { k: 'problemasEconomicos', label: '¿Qué tipos de problemas económicos tienen tus padres?', t: 'checks', opts: ['Pago de servicios', 'Alimentación', 'Vestido', 'Educación'] },
      { k: 'zona', label: 'La zona donde vives es', t: 'radio', opts: ['Urbana', 'Urbano popular', 'AAHH'] },
      { k: 'utiles', label: 'El año pasado tenías tus útiles completos', t: 'radio', opts: ['Si', 'No'] },
      { k: 'casa', label: 'Vives en casa', t: 'radio', opts: ['Propia', 'Alquilada', 'Prestada'] }
    ]},
    { t: 'IV. Aspecto de salud', campos: [
      { k: 'saludEstado', label: 'Actualmente ¿cómo es tu estado de salud?', t: 'radio', opts: ['Buena', 'Regular', 'Mala'] },
      { k: 'enfermedades', label: '¿Qué enfermedades sufres con frecuencia?', t: 'checks', opts: ['Infección estomacal', 'Infección respiratoria', 'Otros'] },
      { k: 'dondeAcudes', label: '¿Cuándo te enfermas a dónde acudes?', t: 'radio', opts: ['Centro de salud', 'Hospital', 'EsSalud', 'Clínica'] },
      { k: 'alimentas', label: 'Según lo consideres tú ¿te alimentas adecuadamente?', t: 'radio', opts: ['Si', 'No'] },
      { k: 'porqueAlimentas', label: '¿Por qué?', t: 'text' },
      { k: 'cuidasSalud', label: '¿Cómo cuidas tu salud?', t: 'checks', opts: ['No comiendo comida chatarra', 'Duermo lo necesario', 'Me baño diariamente', 'Tomo vitaminas', 'Visito periódicamente al médico'] }
    ]},
    { t: 'V. Datos académicos', campos: [
      { k: 'rendimiento', label: 'Te consideras un o una estudiante con rendimiento académico', t: 'radio', opts: ['Muy bueno(a)', 'Bueno(a)', 'Regular', 'Bajo(a)'] },
      { k: 'porqueAsistes', label: '¿Por qué asistes a la institución educativa?', t: 'checks', opts: ['Porque mis padres o tutores me obligan', 'Porque me preparo para el futuro', 'Porque quiero ingresar a la universidad', 'Porque hago amigos(as)', 'Porque no hay otra cosa diferente que hacer'] },
      { k: 'masGusta', label: '¿Qué es lo que más te gusta de tu institución educativa?', t: 'checks', opts: ['Las clases', 'La limpieza', 'El recreo', 'Las actividades deportivas', 'Compartir con mis amigos'] },
      { k: 'menosGusta', label: '¿Qué es lo que menos te gusta de tu institución educativa?', t: 'checks', opts: ['El maltrato de tus compañeros o compañeras', 'El maltrato del director, profesores y/o auxiliares', 'Las tareas', 'La suciedad en la institución', 'Las áreas que son muy pesadas'] },
      { k: 'mayorDificultad', label: '¿Cuál ha sido tu mayor dificultad en los últimos años?', t: 'checks', opts: ['Bajas calificaciones', 'Muchas faltas', 'Muchas tardanzas', 'Falta de respeto a la autoridad', 'Agresiones físicas y/o verbales'] },
      { k: 'mejorar', label: '¿En qué debería mejorar la institución educativa?', t: 'checks', opts: ['Disciplina en general', 'Talleres deportivos', 'Orientación y consejo al estudiante', 'Relación docente – estudiante', 'Orientación a padres / control', 'Reiterar a estudiantes con problemas de conducta'] }
    ]},
    { t: 'VI. Vida social', campos: [
      { t: 'html', html: 'Marca con una <strong>X</strong> las características que más te describen y con un <strong>0</strong> lo que tus compañeros o compañeras piensan de ti.' },
      { k: 'describeX', label: 'Te describen (X)', t: 'checks', opts: ['Amable', 'Responsable', 'Nervioso(a)', 'Agresivo(a)', 'Tímido(a)', 'Alegre', 'Impulsivo(a)', 'Renegón(a)'] },
      { k: 'piensan0', label: 'Tus compañeros piensan (0)', t: 'checks', opts: ['Amable', 'Responsable', 'Nervioso(a)', 'Agresivo(a)', 'Tímido(a)', 'Alegre', 'Impulsivo(a)', 'Renegón(a)'] },
      { k: 'comoDiviertes', label: '¿Cómo te diviertes?', t: 'checks', opts: ['Escuchando música', 'Voy a fiestas', 'Voy al internet', 'Paseo o converso', 'Hago deporte', 'Veo televisión'] }
    ]},
    { t: 'VII. Proyecto de vida', campos: [
      { t: 'html', html: 'Según cómo proyectas tu vida en diez años serás:' },
      { k: 'proyectoVida', label: 'Proyecto de vida', t: 'radio', opts: ['Un profesional universitario', 'Un profesional no universitario', 'Un comerciante', 'Un obrero', 'No tengo la menor idea'] }
    ]}
  ]},
  visita_domiciliaria: { titulo: 'Ficha de Visita Domiciliaria', secciones: [
    { t: 'Datos del estudiante', campos: [
      { k: 'nombresApellidos', label: 'Nombres y apellidos', t: 'text' },
      { k: 'edad', label: 'Edad', t: 'text', w: 'half' },
      { k: 'fechaNac', label: 'Fecha de nacimiento', t: 'date', w: 'half' },
      { k: 'gradoSeccion', label: 'Grado y sección', t: 'text', w: 'half' },
      { k: 'turno', label: 'Turno', t: 'text', w: 'half' }
    ]},
    { t: 'Datos de la visita', campos: [
      { k: 'fechaVisita', label: 'Fecha de la visita', t: 'date', w: 'half' },
      { k: 'hora', label: 'Hora', t: 'text', w: 'half' },
      { k: 'direccion', label: 'Dirección del domicilio', t: 'text' },
      { k: 'motivoVisita', label: 'Motivo de la visita', t: 'textarea', rows: 3 }
    ]},
    { t: 'Descripción de la visita', campos: [
      { t: 'html', html: 'Durante la visita domiciliaria, el psicólogo fue recibido por:' },
      { k: 'recibidoNombre', label: 'Nombre', t: 'text' },
      { k: 'recibidoParentesco', label: 'Parentesco', t: 'text', w: 'half' },
      { k: 'otrosPresentes', label: 'Otros presentes', t: 'text' },
      { k: 'observado', label: 'Se observó lo siguiente', t: 'textarea', rows: 5 },
      { k: 'planIntervencion', label: 'Plan de intervención', t: 'textarea', rows: 4 }
    ]},
    { t: 'Acuerdos y compromisos', campos: [
      { k: 'acuerdosApoderado', label: 'Compromisos del apoderado(a)', t: 'textarea', rows: 3 },
      { k: 'acuerdosEstudiante', label: 'Compromisos del estudiante', t: 'textarea', rows: 3 },
      { k: 'acuerdosInstitucion', label: 'Compromisos de la institución educativa', t: 'textarea', rows: 3 },
      { k: 'acuerdosPsicologia', label: 'Compromisos del departamento de psicología', t: 'textarea', rows: 3 }
    ]}
  ]},
  derivacion_interna: { titulo: 'Ficha de Derivación Estudiantil', secciones: [
    { t: 'I. Datos del estudiante', campos: [
      { k: 'nombresApellidos', label: 'Nombres y apellidos', t: 'text' },
      { k: 'edad', label: 'Edad', t: 'text', w: 'half' },
      { k: 'sexo', label: 'Sexo', t: 'text', w: 'half' },
      { k: 'gradoSeccion', label: 'Grado y sección', t: 'text' },
      { k: 'nivelAcademico', label: 'Nivel académico', t: 'radio', opts: ['Inicial', 'Primaria', 'Secundaria'] },
      { k: 'docenteResponsable', label: 'Docente responsable', t: 'text' },
      { k: 'apoderado', label: 'Nombres y apellidos del apoderado', t: 'text' },
      { k: 'celularApoderado', label: 'N.° de celular del apoderado', t: 'text', w: 'half' }
    ]},
    { t: 'II. Motivo de derivación', campos: [
      { k: 'motivoDeriv', label: 'Motivo', t: 'checks', opts: ['Rendimiento académico', 'Problemas conductuales', 'Problemas emocionales / familiares', 'Mixto'] },
      { k: 'especificar', label: 'Especificar (¿dónde?, ¿cuándo?, ¿por qué?, ¿con quién?)', t: 'textarea', rows: 4 }
    ]},
    { t: 'III. Deriva', campos: [
      { k: 'derivaA', label: 'Deriva a', t: 'checks', opts: ['Directora / Subdirectora', 'Docente / Profesor(a)', 'Padre / Madre de familia'] }
    ]}
  ]},
  derivacion_externa: { titulo: 'Ficha de Derivación', secciones: [
    { t: 'I. Datos informativos', campos: [
      { k: 'apellidosNombres', label: 'Apellidos y nombres del/de la estudiante', t: 'text' },
      { k: 'edad', label: 'Edad', t: 'text', w: 'half' },
      { k: 'grado', label: 'Grado', t: 'text', w: 'half' },
      { k: 'fechaDerivacion', label: 'Fecha de derivación', t: 'date', w: 'half' },
      { k: 'tutor', label: 'Nombre del tutor(a)', t: 'text' }
    ]},
    { t: 'II. Motivo de derivación', campos: [
      { t: 'html', html: 'Debe cumplir los criterios de frecuencia, intensidad y efecto de las dificultades que afectan el proceso de desarrollo integral del/de la estudiante.' },
      { k: 'motivoA', label: 'Motivo (grupo 1)', t: 'checks', opts: ['Bajo rendimiento', 'Inadaptación escolar', 'Lento aprendizaje', 'Problemas familiares', 'Inatención'] },
      { k: 'motivoB', label: 'Motivo (grupo 2)', t: 'checks', opts: ['Problemas emocionales', 'Dificultades conductuales', 'Problemas de aprendizaje', 'Violencia escolar', 'Falta de habilidad social'] },
      { k: 'otrosTexto', label: 'Otros (especificar)', t: 'text' },
      { k: 'otrosSi', label: 'Marcar Otros', t: 'check' }
    ]},
    { t: 'III. Descripción de las dificultades', campos: [
      { k: 'descripcion', label: 'Descripción de las dificultades y/o problema que presenta el/la estudiante', t: 'textarea', rows: 5 }
    ]},
    { t: 'IV. Derivar a', campos: [
      { k: 'derivarA', label: 'Derivar a', t: 'radio', opts: ['Centro de Salud (Psicología)', 'Demuna', 'Comisaría', 'Fiscalía', 'Ministerio de la Mujer', 'Otro'] },
      { k: 'otroDerivacion', label: 'Otro (especificar)', t: 'text' }
    ]}
  ]},
  seguimiento: { titulo: 'Ficha de Seguimiento', secciones: [
    { t: '1. Datos generales', campos: [
      { k: 'lugarFecha', label: 'Lugar y fecha', t: 'text' },
      { k: 'apellidosNombres', label: 'Apellidos y nombres', t: 'text' },
      { k: 'numSesion', label: 'N.° de sesión', t: 'text', w: 'half' },
      { k: 'responsables', label: 'Responsable(s)', t: 'text' }
    ]},
    { t: '2. Objetivo de la sesión', campos: [
      { k: 'objetivo', label: 'Objetivo', t: 'textarea', rows: 3 }
    ]},
    { t: '3. Tema tratado', campos: [
      { k: 'tema', label: 'Tema tratado', t: 'textarea', rows: 4 }
    ]},
    { t: '4. Propuesta de plan de tratamiento', campos: [
      { k: 'planTratamiento', label: 'Plan de tratamiento', t: 'textarea', rows: 3 }
    ]},
    { t: '5. Compromisos', campos: [
      { k: 'compromisos', label: 'Compromisos', t: 'textarea', rows: 4 }
    ]},
    { t: '6. Conclusiones y próxima sesión', campos: [
      { k: 'conclusiones', label: 'Conclusiones y temas a tratar para la próxima sesión', t: 'textarea', rows: 3 }
    ]},
    { t: '7. Observaciones', campos: [
      { k: 'observaciones', label: 'Observaciones', t: 'textarea', rows: 4 }
    ]}
  ]}
};

// ── Render genérico: creación (editable) y vista (solo lectura, espejo) ──
const EXP_IN = 'width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; background:white;';
const EXP_LAB = 'font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:4px;';
const EXP_SEC = (n, t) => `<div style="font-size:12px; font-weight:800; color:#1a3a5c; text-transform:uppercase; border-left:4px solid #1a3a5c; padding-left:9px; margin:14px 0 9px;"><span style="display:inline-block; background:#1a3a5c; color:white; width:22px; height:22px; border-radius:50%; text-align:center; line-height:22px; font-size:11px; margin-right:7px;">${n}</span>${t}</div>`;
const EXP_OPT_CSS = 'display:inline-flex; align-items:center; gap:6px; font-size:12px; border:1px solid #e5e7eb; border-radius:6px; padding:6px 9px; background:white;';

function expCampoCrear(f) {
  if (f.t === 'html') return `<div style="font-size:12px; color:#4b5563; background:#f0f4fa; border:1px solid #dbe4f0; border-radius:8px; padding:9px 11px; line-height:1.5;">${f.html}</div>`;
  const lab = `<label style="${EXP_LAB}">${f.label}</label>`;
  if (f.t === 'text') return `<div>${lab}<input name="${f.k}" style="${EXP_IN}"></div>`;
  if (f.t === 'date') return `<div>${lab}<input type="date" name="${f.k}" style="${EXP_IN}"></div>`;
  if (f.t === 'textarea') return `<div>${lab}<textarea name="${f.k}" rows="${f.rows || 3}" style="${EXP_IN}resize:vertical;"></textarea></div>`;
  if (f.t === 'radio') return `<div>${lab}<div style="display:flex; gap:7px; flex-wrap:wrap;">${f.opts.map(o => `<label style="${EXP_OPT_CSS}cursor:pointer;"><input type="radio" name="${f.k}" value="${o}" style="accent-color:#1a3a5c;">${o}</label>`).join('')}</div></div>`;
  if (f.t === 'check') return `<div><label style="display:flex; gap:8px; align-items:flex-start; font-size:12.5px; border:1px solid #e5e7eb; border-radius:8px; padding:9px; background:white; cursor:pointer;"><input type="checkbox" name="${f.k}" value="Si" style="width:15px; height:15px; accent-color:#1a3a5c; margin-top:1px;">${f.label}</label></div>`;
  if (f.t === 'checks') return `<div>${lab}<div style="display:grid; grid-template-columns:repeat(2,1fr); gap:6px;">${f.opts.map((o, i) => `<label style="${EXP_OPT_CSS}cursor:pointer;"><input type="checkbox" name="${f.k}_${i}" value="Si" style="width:14px; height:14px; accent-color:#1a3a5c;">${o}</label>`).join('')}</div></div>`;
  if (f.t === 'tabla') {
    const th = `<th style="background:#1a3a5c; color:white; padding:7px; font-size:10px; text-transform:uppercase; text-align:left;"></th>` + f.cols.map(c => `<th style="background:#1a3a5c; color:white; padding:7px; font-size:10px; text-transform:uppercase; text-align:left;">${c}</th>`).join('');
    const trs = f.rows.map((r, ri) => `<tr><td style="padding:6px; border-bottom:1px solid #eef2f7; font-size:11px; font-weight:700;">${r}</td>` + f.cols.map((_, ci) => `<td style="padding:4px; border-bottom:1px solid #eef2f7;"><input name="${f.k}_${ri}_${ci}" style="width:100%; padding:5px; border:1px solid #d1d5db; border-radius:4px; font-size:11px;"></td>`).join('') + `</tr>`).join('');
    return `<div>${lab}<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; font-size:11px;"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div></div>`;
  }
  return '';
}
function expSecCrear(sec, n) {
  return `${EXP_SEC(n, sec.t)}<div style="display:grid; gap:9px;">${expCamposCrear(sec.campos)}</div>`;
}
function expCamposCrear(campos) {
  let h = '', buf = [];
  const flush = () => {
    if (!buf.length) return;
    h += buf.length === 1 ? expCampoCrear(buf[0]) : `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">${buf.map(expCampoCrear).join('')}</div>`;
    buf = [];
  };
  for (const f of campos) {
    if (f.w === 'half' && (f.t === 'text' || f.t === 'date')) { buf.push(f); if (buf.length === 2) flush(); }
    else { flush(); h += expCampoCrear(f); }
  }
  flush();
  return h;
}
function renderFormExpediente(tipo) {
  const spec = EXPEDIENTE_FORMS[tipo];
  if (!spec) return '';
  return EXP_DOC_HEAD.replace('{{EXP_TITULO}}', spec.titulo) + spec.secciones.map((s, i) => expSecCrear(s, i + 1)).join('');
}
function expValBox(label, v) {
  const val = (v === undefined || v === null || v === '') ? '—' : String(v);
  const c = val === '—' ? '#9ca3af' : '#1a3a5c';
  return `<div style="margin-bottom:9px;"><div style="font-weight:600; color:#2c3e50; margin-bottom:4px; font-size:12px;">${label}</div><div style="padding:9px 11px; border:1px solid #bdc3c7; border-radius:6px; font-size:13px; background:#f8f9ff; color:${c}; font-weight:600; min-height:40px;">${val}</div></div>`;
}
function expMini(txt, on) {
  return `<span style="display:inline-flex; align-items:center; gap:6px; border:1px solid ${on ? '#1a3a5c' : '#e3e8ef'}; background:${on ? '#eef4fb' : '#fbfcfe'}; color:${on ? '#1a3a5c' : '#6b7280'}; font-weight:${on ? '700' : '500'}; font-size:12px; border-radius:6px; padding:5px 9px;">${on ? '☑' : '☐'} ${txt}</span>`;
}
function expCampoVer(f, datos) {
  const gv = k => {
    const v = datos[k];
    return (v === undefined || v === null || v === '') ? '—' : String(v);
  };
  if (f.t === 'html') return `<div style="font-size:12px; color:#4b5563; background:#f0f4fa; border:1px solid #dbe4f0; border-radius:8px; padding:9px 11px; line-height:1.5; margin-bottom:9px;">${f.html}</div>`;
  if (f.t === 'radio') {
    const v = gv(f.k);
    return `<div style="font-weight:700; color:#2c3e50; margin:10px 0 7px; font-size:12.5px;">${f.label}</div><div style="display:flex; gap:7px; flex-wrap:wrap;">${f.opts.map(o => expMini(o, v === o)).join('')}</div>`;
  }
  if (f.t === 'check') {
    const on = gv(f.k) === 'Si';
    return `<div style="margin:8px 0;">${expMini(f.label, on)}</div>`;
  }
  if (f.t === 'checks') {
    return `<div style="font-weight:700; color:#2c3e50; margin:10px 0 7px; font-size:12.5px;">${f.label}</div><div style="display:grid; grid-template-columns:repeat(2,1fr); gap:6px;">${f.opts.map((o, i) => expMini(o, gv(`${f.k}_${i}`) === 'Si')).join('')}</div>`;
  }
  if (f.t === 'tabla') {
    const trs = f.rows.map((r, ri) => `<tr><td style="padding:7px; border-bottom:1px solid #ecf0f1; font-size:11px; font-weight:700;">${r}</td>` + f.cols.map((_, ci) => {
      const v = gv(`${f.k}_${ri}_${ci}`);
      return `<td style="padding:7px; border-bottom:1px solid #ecf0f1; font-size:11.5px; color:${v === '—' ? '#9ca3af' : '#1a3a5c'}; font-weight:600;">${v}</td>`;
    }).join('') + `</tr>`).join('');
    const th = `<th style="background:#1a3a5c; color:white; padding:7px; font-size:10px; text-transform:uppercase; text-align:left;"></th>` + f.cols.map(c => `<th style="background:#1a3a5c; color:white; padding:7px; font-size:10px; text-transform:uppercase; text-align:left;">${c}</th>`).join('');
    return `<div style="font-weight:700; color:#2c3e50; margin:10px 0 7px; font-size:12.5px;">${f.label}</div><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db;"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
  }
  return expValBox(f.label, gv(f.k));
}
function renderVistaExpediente(tipo, datos) {
  const spec = EXPEDIENTE_FORMS[tipo];
  if (!spec) return '';
  return EXP_DOC_HEAD.replace('{{EXP_TITULO}}', spec.titulo) + spec.secciones.map((s, i) => `${EXP_SEC(i + 1, s.t)}${s.campos.map(f => expCampoVer(f, datos)).join('')}`).join('');
}
function abrirModalNuevoFormato() {
  const modal = document.getElementById("modalNuevoFormato");
  if (modal) modal.classList.remove("oculto");
  const sel = document.getElementById("nuevoFormatoTipo");
  if (sel) sel.value = _expedienteTipoActual;
  const cont = document.getElementById("nuevoFormatoCampos");
  if (cont) cont.innerHTML = renderFormExpediente(_expedienteTipoActual);
  // Actualizar al cambiar tipo
  if (sel) sel.onchange = () => {
    const c = document.getElementById("nuevoFormatoCampos");
    if (c) c.innerHTML = renderFormExpediente(sel.value);
  };
}

async function crearNuevoFormato() {
  const tipo = document.getElementById("nuevoFormatoTipo")?.value || _expedienteTipoActual;
  const fecha = document.getElementById("nuevoFormatoFecha")?.value || new Date().toISOString().slice(0, 10);
  const fileInput = document.getElementById("nuevoFormatoArchivo");
  const camposCont = document.getElementById("nuevoFormatoCampos");
  const msg = document.getElementById("nuevoFormatoMsg");
  const datos = {};
  if (camposCont) {
    camposCont.querySelectorAll("input, select, textarea").forEach(el => {
      const k = el.name || el.id;
      if (!k) return;
      if (el.type === "radio" && !el.checked) return;
      if (el.type === "checkbox" && !el.checked) return;
      datos[k] = el.value;
    });
  }
  let archivo_base64 = null, archivo_tipo = null, archivo_nombre = null;
  if (fileInput && fileInput.files[0]) {
    const file = fileInput.files[0];
    archivo_nombre = file.name;
    archivo_tipo = file.type;
    archivo_base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  if (Object.keys(datos).length === 0 && !archivo_nombre) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Completa al menos un campo del formato o adjunta un archivo"; }
    return;
  }
  if (msg) { msg.style.color = "#6b7280"; msg.textContent = "Guardando..."; }
  try {
    await apiFetch(`/postgres/expediente/${_expedienteEstudianteId}/formatos`, {
      method: "POST",
      body: { tipo, datos, archivo_base64, archivo_tipo, archivo_nombre, fecha_registro: fecha }
    });
    if (msg) { msg.style.color = "#059669"; msg.textContent = "Guardado"; }
    if (window.mostrarToastGlobal) mostrarToastGlobal("Formato guardado", "ok");
    if (fileInput) fileInput.value = "";
    if (msg) setTimeout(() => msg.textContent = "", 1200);
    cerrarModal("modalNuevoFormato");
    await cargarExpedienteFormatos();
    // Si el expediente inline está visible, refrescar fichas e historial
    const secExp = document.getElementById("ps-expediente");
    if (secExp && !secExp.classList.contains("oculto") && typeof expInlineCargar === "function") expInlineCargar();
  } catch (e) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Error: " + e.message; }
  }
}

function tipoExpedienteLabel(tipo) {
  return (TIPOS_EXPEDIENTE.find(t => t.id === tipo) || {}).label || tipo;
}
// Nombre legible para claves guardadas (apellidosNombres -> Apellidos Nombres)
function expNombreBonito(k) {
  return String(k).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
}

// Vista profesional de solo lectura: espejo del documento que llenó el psicólogo
async function verExpedienteFormato(id) {
  const modal = document.getElementById("modalVerFormato");
  const titulo = document.getElementById("verFormatoTitulo");
  const cuerpo = document.getElementById("verFormatoBody");
  if (!modal || !cuerpo) return;
  if (titulo) titulo.textContent = "Cargando...";
  cuerpo.innerHTML = '<p style="color:#6b7280; font-size:13px;">Cargando documento...</p>';
  modal.classList.remove("oculto");
  try {
    const f = await apiFetch(`/postgres/expediente/formatos/${id}`);
    const d = f.datos || {};
    const nombreEst = document.getElementById("expedienteEstudianteNombre")?.textContent || "";
    if (titulo) titulo.textContent = `${tipoExpedienteLabel(f.tipo)} — ${nombreEst}`;
    let html = `<div style="font-size:11px; color:#6b7280; margin-bottom:10px; background:#f0f4fa; border:1px solid #dbe4f0; border-radius:8px; padding:8px 10px;">N.° ${f.correlativo} · Registrado el ${String(f.fecha_registro).slice(0, 10)} · Solo lectura</div>`;
    if (EXPEDIENTE_FORMS[f.tipo]) {
      html += renderVistaExpediente(f.tipo, d);
    } else {
      const filas = Object.entries(d).map(([k, v]) => `<div style="display:grid; grid-template-columns:1fr 2fr; gap:8px; font-size:12px; border-bottom:1px solid #f3f4f6; padding:6px 0;"><span style="color:#6b7280;">${k}</span><span style="color:#1a3a5c; font-weight:600;">${String(v)}</span></div>`).join("");
      html += filas || '<p style="color:#9ca3af; font-size:12px;">Sin datos registrados.</p>';
    }
    if (f.archivo_nombre) {
      html += `<div style="margin-top:10px; font-size:12px;"><a href="data:${f.archivo_tipo};base64,${f.archivo_base64}" download="${f.archivo_nombre}" style="color:#1a3a5c; font-weight:700;">Descargar adjunto: ${f.archivo_nombre}</a></div>`;
    }
    html += `<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px; border-top:1px solid #e5e7eb; padding-top:12px; position:sticky; bottom:0; background:white;">
      <button class="btn btn-secondary" onclick="cerrarModal('modalVerFormato')">Cerrar</button>
      <button class="btn btn-primary" onclick="imprimirExpedienteFormato(${f.id})">Imprimir</button>
    </div>`;
    cuerpo.innerHTML = html;
    cuerpo.scrollTop = 0;
  } catch (e) {
    if (titulo) titulo.textContent = "Documento";
    cuerpo.innerHTML = `<p style="color:#b91c1c; font-size:13px;">Error: ${e.message}</p>`;
  }
}

async function imprimirExpedienteFormato(id) {
  try {
    const f = await apiFetch(`/postgres/expediente/formatos/${id}`);
    const d = f.datos || {};
    const nombreEst = document.getElementById("expedienteEstudianteNombre")?.textContent || "";
    const cuerpo = EXPEDIENTE_FORMS[f.tipo]
      ? renderVistaExpediente(f.tipo, d)
      : Object.entries(d).map(([k, v]) => `<p><strong>${k}:</strong> ${String(v)}</p>`).join("");
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${tipoExpedienteLabel(f.tipo)} #${f.correlativo}</title><style>body{font-family:Arial,sans-serif; padding:24px; color:#222;} h1{font-size:18px;} .box{background:#f9fafb;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;} @media print{.noprint{display:none;}}</style></head>`
      + `<body><h1>${tipoExpedienteLabel(f.tipo)} N.° ${f.correlativo}</h1><p>Estudiante: ${nombreEst} · Fecha: ${String(f.fecha_registro).slice(0, 10)}</p>${cuerpo}`
      + `<div class="noprint" style="margin-top:16px;"><button onclick="window.print()">Imprimir</button></div><script>window.print()<\/script></body></html>`);
    w.document.close();
  } catch (e) { alert("Error: " + e.message); }
}

// Reporte bimestral — por estudiante, sin filtrar por tipo, muestra nombre/tipo legible
let _reporteLeido = false;
async function generarReporteBimestral() {
  const inicio = document.getElementById("reporteInicio")?.value;
  const fin = document.getElementById("reporteFin")?.value;
  const msg = document.getElementById("reporteMsg");
  if (!inicio || !fin) { if(msg){msg.style.color="#b91c1c"; msg.textContent="Selecciona rango de fechas";} return; }
  if(msg){msg.style.color="#6b7280"; msg.textContent="Generando...";}
  _reporteLeido = false;
  try {
    if (!_expedienteEstudianteId) {
      if(msg){msg.style.color="#b91c1c"; msg.textContent="Abre primero el expediente de un estudiante";} return;
    }
    const todos = await apiFetch(`/postgres/expediente/${_expedienteEstudianteId}/formatos`);
    const filtrados = todos.filter(f => String(f.fecha_registro).slice(0,10) >= inicio && String(f.fecha_registro).slice(0,10) <= fin);
    const porTipo = {};
    filtrados.forEach(f => { porTipo[f.tipo] = (porTipo[f.tipo]||0)+1; });
    const nombreEst = document.getElementById("expedienteEstudianteNombre")?.textContent || `Estudiante #${_expedienteEstudianteId}`;
    let html = `<div class="card" style="padding:16px; margin-top:12px; border:1px solid #e5e7eb;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="font-size:14px; font-weight:700; color:#102a56; margin:0;">Reporte — ${nombreEst}</h3>
        <span style="font-size:11px; color:#6b7280;">${inicio} al ${fin}</span>
      </div>
      <p style="font-size:12px; color:#6b7280; margin-bottom:10px;">Total atenciones: <strong>${filtrados.length}</strong> · Se muestran por tipo con su nombre, no por fecha</p>`;
    if (!filtrados.length) {
      html += `<div style="background:#f9fafb; border:1px dashed #d1d5db; border-radius:8px; padding:12px; text-align:center; color:#9ca3af; font-size:12px;">Sin atenciones en ese rango</div>`;
    } else {
      for (const [tipo, cant] of Object.entries(porTipo)) {
        const label = TIPOS_EXPEDIENTE.find(t=>t.id===tipo)?.label || tipo;
        html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:6px;"><span style="font-size:12px; color:#374151;">${label}</span><span style="font-size:11px; font-weight:700; background:#0d63d8; color:white; padding:2px 8px; border-radius:999px;">${cant}</span></div>`;
      }
      // Detalle por registro con nombre/tipo legible
      html += `<div style="margin-top:10px; display:grid; gap:6px;">`;
      filtrados.forEach(f => {
        const label = TIPOS_EXPEDIENTE.find(t=>t.id===f.tipo)?.label || f.tipo;
        const desc = f.datos?.descripcion || f.datos?.texto || f.datos?.nota || "";
        html += `<div style="border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:white;"><div style="font-size:11px; font-weight:700; color:#0d63d8;">${label} #${f.correlativo}</div><div style="font-size:11px; color:#6b7280;">${String(f.fecha_registro).slice(0,10)} — ${desc ? desc.slice(0,80) : "(sin descripción)"}</div></div>`;
      });
      html += `</div>`;
    }
    html += `<div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="window.print()">Imprimir</button><button class="btn btn-secondary btn-sm" id="btnReporteLeido" onclick="marcarReporteLeido()">Marcar leído y limpiar</button></div></div>`;
    const cont = document.getElementById("reporteResultado");
    if (cont) cont.innerHTML = html;
    if(msg){msg.textContent="";}
  } catch(e){ if(msg){msg.style.color="#b91c1c"; msg.textContent="Error: "+e.message;} }
}
function marcarReporteLeido(){
  _reporteLeido = true;
  const cont = document.getElementById("reporteResultado");
  const btn = document.getElementById("btnReporteLeido");
  if(btn){ btn.textContent="✓ Leído"; btn.disabled=true; btn.style.opacity=".6"; }
  if(window.mostrarToastGlobal) mostrarToastGlobal("Reporte marcado como leído — puedes generar otro","ok");
}
function limpiarReporte(){
  _reporteLeido = false;
  const cont = document.getElementById("reporteResultado");
  const msg = document.getElementById("reporteMsg");
  if(cont) cont.innerHTML = "";
  if(msg) msg.textContent="";
  const ini = document.getElementById("reporteInicio");
  const fin = document.getElementById("reporteFin");
  if(ini) ini.value=""; if(fin) fin.value="";
}
