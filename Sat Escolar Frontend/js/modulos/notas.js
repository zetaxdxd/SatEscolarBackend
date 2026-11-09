// Notas simples por bimestre, promedios y observaciones del docente — SAT Escolar

let _nsCampos = [];

let _nsAsistenciaPromedio = {};

let _nsBimestres = [];

let _nsBimestreActual = null;

let _nsPromediosPorBimestre = {};

let _nsObsPorEstudiante = {};


function _nsStorageKey(asignaturaId) { return `sat_ns_campos_${asignaturaId}`; }

// Solo para migración única: nombres que quedaron en el navegador antes de
// que los campos vivieran en el servidor. Ya no se guarda nada local.
function cargarCamposPersistidos(asignaturaId) {
  try {
    const arr = JSON.parse(localStorage.getItem(_nsStorageKey(asignaturaId)) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}


const VALOR_LETRA = { AD: 20, A: 16, B: 12, C: 6 };

const LETRAS_NOTA = ["AD", "A", "B", "C"];


function letraDesdeNota(nota) {
  if (nota >= 18) return "AD";
  if (nota >= 14) return "A";
  if (nota >= 11) return "B";
  return "C";
}


function claseCuadritoNota(letra) {
  return { AD: "nota-cuadrito-ad", A: "nota-cuadrito-a", B: "nota-cuadrito-b", C: "nota-cuadrito-c" }[letra] || "nota-cuadrito-c";
}


function prepararNotasSimples(seccionId, asignaturaId) {
  _nsCampos = [];
  return cargarSeccionesNotasSimples(seccionId, asignaturaId);
}


async function cargarSeccionesNotasSimples(seccionPreferida, asignaturaPreferida) {
  const seccionEl = document.getElementById("nsSeccion");
  if (!seccionEl) return;
  try {
    const user = getUser();
    let secciones;
    if (user.role === 'docente') {
      const raw = await apiFetch("/postgres/docentes/me/secciones");
      secciones = raw.map(s => ({ id: s.seccion_id || s.id, nivel: s.nivel, grado: s.grado, letra: s.letra, nombre: s.seccion || s.nombre || `${s.grado} ${s.letra}` }));
    } else {
      secciones = await apiFetch("/postgres/secciones");
    }
    seccionEl.innerHTML = secciones.length
      ? secciones.map(s => `<option value="${s.id}">${s.nombre}</option>`).join("")
      : '<option value="">Sin salones asignados</option>';
    if (seccionPreferida) seccionEl.value = String(seccionPreferida);
    await cargarCursosNotasSimples(asignaturaPreferida);
  } catch (e) { console.error("Error cargando secciones notas:", e); }
}


async function cargarCursosNotasSimples(asignaturaPreferida) {
  const cursoEl = document.getElementById("nsCurso");
  const seccionId = Number(document.getElementById("nsSeccion")?.value);
  if (!cursoEl || !seccionId) return;
  try {
    const asignaturas = await apiFetch(`/postgres/asignaturas?seccionId=${seccionId}`);
    cursoEl.innerHTML = asignaturas.length
      ? asignaturas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join("")
      : '<option value="">Sin cursos asignados</option>';
    if (asignaturaPreferida) cursoEl.value = String(asignaturaPreferida);
    await cargarCamposNotas();
    await cargarTrimestresNotasSimples();
  } catch (e) { console.error("Error cargando cursos notas:", e); }
}


// Campos desde el servidor (fuente única). Agregar/quitar/renombrar es instantáneo.
async function cargarCamposNotas() {
  const asignaturaId = Number(document.getElementById("nsCurso")?.value);
  if (!asignaturaId) { _nsCampos = []; renderCamposNotasSimples(); return; }
  try {
    _nsCampos = await apiFetch(`/postgres/docentes/me/campos?asignaturaId=${asignaturaId}`);
  } catch (e) { console.error("Error cargando campos:", e.message); _nsCampos = []; }
  renderCamposNotasSimples();
}


async function cargarTrimestresNotasSimples() {
  const bimEl = document.getElementById("nsTrimestre");
  if (!bimEl) return;
  try {
    const bimestres = await apiFetch("/postgres/trimestres-academicos");
    const anio = new Date().getFullYear();
    _nsBimestres = bimestres.filter(t => t.anio === anio);
    if (_nsBimestres.length === 0) _nsBimestres = bimestres;
    bimEl.innerHTML = _nsBimestres
      .map(t => `<option value="${t.id}">${t.nombre}</option>`).join("");
    // Aterriza directo en el primer bimestre que falte llenar
    await irPrimerBimestrePendiente();
    _nsBimestreActual = Number(bimEl.value);
    await cargarNotasSimples();
  } catch (e) { console.error("Error cargando bimestres:", e); }
}


// ¿El bimestre tiene notas de TODOS los estudiantes? (si falta aunque sea uno, sigue pendiente)
async function bimestreCompleto(seccionId, asignaturaId, trimestreId) {
  try {
    const datos = await apiFetch(`/postgres/docentes/me/notas-simples?seccionId=${seccionId}&asignaturaId=${asignaturaId}&trimestreId=${trimestreId}`);
    if (!datos.length) return false;
    return datos.every(e => (e.notas || []).length > 0);
  } catch (e) { return false; }
}


// Selecciona el primer bimestre pendiente (sin llenar). Si todos están llenos, queda el último.
async function irPrimerBimestrePendiente(desdeIndice = 0) {
  const bimEl = document.getElementById("nsTrimestre");
  const seccionId = Number(document.getElementById("nsSeccion")?.value);
  const asignaturaId = Number(document.getElementById("nsCurso")?.value);
  if (!bimEl || !seccionId || !asignaturaId || !_nsBimestres.length) return false;
  for (let i = desdeIndice; i < _nsBimestres.length; i++) {
    if (!(await bimestreCompleto(seccionId, asignaturaId, _nsBimestres[i].id))) {
      bimEl.value = String(_nsBimestres[i].id);
      return true;
    }
  }
  return false;
}


function celdaCampoHTML(campo, i, nota) {
  const letra = nota !== undefined && nota !== null ? letraDesdeNota(nota) : "";
  return `
    <td data-campo="${i}">
      <select class="nota-cuadrito ${letra ? claseCuadritoNota(letra) : "nota-cuadrito-vacio"}" data-campo="${i}" data-campo-nombre="${escaparHtml(campo.nombre)}"
              onchange="cambiarLetraNota(this)">
        <option value="" ${!letra ? "selected" : ""}>—</option>
        ${LETRAS_NOTA.map(l => `<option value="${l}" ${letra === l ? "selected" : ""}>${l}</option>`).join("")}
      </select>
    </td>`;
}


async function agregarCampoNota() {
  const asignaturaId = Number(document.getElementById("nsCurso")?.value);
  if (!asignaturaId) { alert("Selecciona un curso primero."); return; }
  const nombres = new Set(_nsCampos.map(c => c.nombre));
  let n = _nsCampos.length + 1;
  while (nombres.has(`Campo ${n}`)) n++;
  try {
    const r = await apiFetch("/postgres/docentes/me/campos", {
      method: "POST", body: { asignaturaId, nombre: `Campo ${n}` }
    });
    _nsCampos.push(r.campo);
    renderCamposNotasSimples();
    // Agrega la columna vacía a cada fila sin recargar: no se pierde lo ya marcado
    document.querySelectorAll("#tablaNotasSimples tr[data-estudiante-id]").forEach(fila => {
      fila.querySelector(".ns-obs-cell")?.insertAdjacentHTML("beforebegin", celdaCampoHTML(r.campo, _nsCampos.length - 1, undefined));
    });
    actualizarResumenNotas();
    const inputs = document.querySelectorAll("#nsCampos .notas-simples-chip input");
    const ultimo = inputs[inputs.length - 1];
    if (ultimo) { ultimo.focus(); ultimo.select(); }
  } catch (e) { alert("No se pudo agregar el campo: " + e.message); }
}


function renombrarCampoNota(index, nombre) {
  const campo = _nsCampos[index];
  if (!campo) return;
  const limpio = String(nombre || "").trim();
  if (!limpio || limpio === campo.nombre) { renderCamposNotasSimples(); return; }
  if (!campo.id) { campo.nombre = limpio; renderCamposNotasSimples(); return; }
  apiFetch(`/postgres/docentes/me/campos/${campo.id}`, { method: "PUT", body: { nombre: limpio } })
    .then(r => {
      campo.nombre = r.campo.nombre;
      const th = document.getElementById(`nsCampoHead-${index}`);
      if (th) th.textContent = campo.nombre;
      document.querySelectorAll(`#tablaNotasSimples .nota-cuadrito[data-campo="${index}"]`)
        .forEach(s => s.setAttribute("data-campo-nombre", campo.nombre));
      renderCamposNotasSimples();
    })
    .catch(e => { alert("No se pudo renombrar: " + e.message); renderCamposNotasSimples(); });
}


function renderCamposNotasSimples() {
  const contenedor = document.getElementById("nsCampos");
  const head = document.getElementById("nsTablaHead");
  if (!contenedor || !head) return;
  contenedor.innerHTML = `
    ${_nsCampos.map((campo, index) => `
      <span class="notas-simples-chip">
        <input value="${escaparHtml(campo.nombre)}" placeholder="Nombre del campo (ej: Práctica 1)"
               onchange="renombrarCampoNota(${index}, this.value)">
        <button type="button" class="teacher-v2-small-btn" onclick="quitarCampoNota(${index})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </span>`).join("")}`;
  const bimEl = document.getElementById("nsTrimestre");
  const bimNombre = bimEl?.options[bimEl.selectedIndex]?.text || "Bimestre";
  head.innerHTML = `
    <tr>
      <th>Estudiante</th>
      ${_nsCampos.map((_, i) => `<th id="nsCampoHead-${i}">${escaparHtml(_nsCampos[i].nombre) || `Campo ${i + 1}`}</th>`).join("")}
      <th>Observaciones</th>
      <th>Promedio<br>${escaparHtml(bimNombre)}</th>
    </tr>`;
}


async function quitarCampoNota(index) {
  const campo = _nsCampos[index];
  if (!campo) return;
  if (!confirm(`Quitar el campo "${campo.nombre}"?\n\nSe borrará el campo y TODAS sus notas guardadas en todos los bimestres. Esta acción no se puede deshacer.`)) return;
  // Sin id (legado sin sembrar): solo sale de la vista
  if (!campo.id) {
    _nsCampos.splice(index, 1);
    renderCamposNotasSimples();
    await cargarNotasSimples();
    return;
  }
  try {
    const r = await apiFetch(`/postgres/docentes/me/campos/${campo.id}`, { method: "DELETE" });
    _nsCampos.splice(index, 1);
    renderCamposNotasSimples();
    // Quita la columna y reindexa sin recargar: no se pierde lo ya marcado
    document.querySelectorAll(`#tablaNotasSimples tr[data-estudiante-id]`).forEach(fila => {
      const td = fila.querySelector(`td[data-campo="${index}"]`);
      if (td) td.remove();
      fila.querySelectorAll(`td[data-campo]`).forEach(td => {
        const oldIdx = Number(td.getAttribute("data-campo"));
        const newIdx = oldIdx > index ? oldIdx - 1 : oldIdx;
        td.setAttribute("data-campo", String(newIdx));
        const select = td.querySelector("select.nota-cuadrito");
        if (select) {
          select.setAttribute("data-campo", String(newIdx));
          if (_nsCampos[newIdx]) select.setAttribute("data-campo-nombre", _nsCampos[newIdx].nombre);
        }
      });
      actualizarPromedioFila(fila);
    });
    actualizarResumenNotas();
    (window.mostrarToastGlobal || alert)(`Campo "${r.campo.nombre}" eliminado (${r.notasBorradas} notas borradas).`, "ok");
  } catch (e) { alert("No se pudo quitar el campo: " + e.message); }
}


async function cargarNotasSimples() {
  const seccionId = Number(document.getElementById("nsSeccion")?.value);
  const asignaturaId = Number(document.getElementById("nsCurso")?.value);
  const trimestreId = Number(document.getElementById("nsTrimestre")?.value);
  const tabla = document.getElementById("tablaNotasSimples");
  if (!tabla || !seccionId || !asignaturaId || !trimestreId) return;
  _nsBimestreActual = trimestreId;

  const nsColspan = 3 + (_nsCampos.length || 0);
  tabla.innerHTML = `<tr><td colspan="${nsColspan}" class="teacher-v2-empty">Cargando estudiantes...</td></tr>`;
  try {
    const seccionDatos = await apiFetch("/postgres/docentes/me/secciones");
    const sec = seccionDatos.find(s => Number(s.seccion_id) === seccionId);
    const nivel = sec?.nivel || "Secundaria";
    const grado = sec?.grado || "5to";
    const letra = sec?.letra || "A";

    const [estudiantes, asistencias] = await Promise.all([
      apiFetch(`/postgres/docentes/me/notas-simples?seccionId=${seccionId}&asignaturaId=${asignaturaId}&trimestreId=${trimestreId}`),
      apiFetch(`/postgres/asistencias?nivel=${encodeURIComponent(nivel)}&grado=${encodeURIComponent(grado)}&seccion=${encodeURIComponent(letra)}`)
    ]);

_nsEstudiantesActuales = estudiantes.map(e => ({
      id: e.estudiante_id,
      nombres: e.nombres,
      apellidos: e.apellidos,
      correo: e.correo || ""
    }));
    _nsPromediosPorBimestre = {};
    estudiantes.forEach(e => {
      const valores = (e.notas || []).map(n => Number(n.nota)).filter(v => !Number.isNaN(v));
      if (!valores.length) return;
      const promedio = valores.reduce((a, c) => a + c, 0) / valores.length;
      _nsPromediosPorBimestre[e.estudiante_id] = { promedio, letra: letraDesdeNota(promedio) };
    });

    _nsAsistenciaPromedio = {};
    const diasPorEstudiante = {};
    asistencias.forEach(a => {
      diasPorEstudiante[a.estudiante_id] = diasPorEstudiante[a.estudiante_id] || { total: 0, presentes: 0 };
      diasPorEstudiante[a.estudiante_id].total += 1;
      if (a.estado === "Asistió" || a.estado === "Tardanza") diasPorEstudiante[a.estudiante_id].presentes += 1;
    });
    Object.entries(diasPorEstudiante).forEach(([id, d]) => {
      _nsAsistenciaPromedio[Number(id)] = d.total ? Math.round((d.presentes / d.total) * 100) : null;
    });

    const camposGuardados = [...new Set(estudiantes.flatMap(e => (e.notas || []).map(n => n.campo)))];
    // Siembra única: si el servidor aún no tiene campos, sube los que existían
    // en notas guardadas o en este navegador (migración automática, una sola vez)
    if (_nsCampos.length === 0 && camposGuardados.length > 0) {
      const legacy = cargarCamposPersistidos(asignaturaId).map(c => c && c.nombre).filter(Boolean);
      for (const nombre of [...new Set([...legacy, ...camposGuardados])]) {
        try { await apiFetch("/postgres/docentes/me/campos", { method: "POST", body: { asignaturaId, nombre } }); } catch (_) {}
      }
      try { localStorage.removeItem(_nsStorageKey(asignaturaId)); } catch (_) {}
      try { _nsCampos = await apiFetch(`/postgres/docentes/me/campos?asignaturaId=${asignaturaId}`); } catch (_) {}
    }
    const unidos = new Map();
    [..._nsCampos, ...camposGuardados.map(nombre => ({ nombre }))]
      .forEach(c => { if (c && c.nombre && !unidos.has(c.nombre)) unidos.set(c.nombre, c); });
    _nsCampos = [...unidos.values()];
    renderCamposNotasSimples();

    _nsObsPorEstudiante = {};
    estudiantes.forEach(e => {
      if (e.observacion && String(e.observacion).trim()) _nsObsPorEstudiante[e.estudiante_id] = String(e.observacion);
    });

    if (estudiantes.length === 0) {
      tabla.innerHTML = `<tr><td colspan="${nsColspan}" class="teacher-v2-empty">Sin estudiantes en esta sección.</td></tr>`;
      actualizarResumenNotas();
      return;
    }

    tabla.innerHTML = estudiantes.map(e => {
      const notasPorCampo = {};
      (e.notas || []).forEach(n => { notasPorCampo[n.campo] = Number(n.nota); });
      const prom = _nsPromediosPorBimestre[e.estudiante_id];
      return `
        <tr data-estudiante-id="${e.estudiante_id}">
          <td><strong>${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</strong><br><small class="teacher-v2-email">${escaparHtml(e.seccion)}</small></td>
          ${_nsCampos.map((campo, i) => celdaCampoHTML(campo, i, notasPorCampo[campo.nombre])).join("")}
          <td class="ns-obs-cell" style="min-width:200px;">
            <input type="text" class="ns-obs" data-estudiante="${e.estudiante_id}"
              value="${escaparHtml(_nsObsPorEstudiante[e.estudiante_id] || "")}"
              placeholder="Observación (opcional)" maxlength="500"
              oninput="cambiarObsNota(${e.estudiante_id}, this.value)"
              style="width:100%; padding:6px 8px; border:1px solid #e5e7eb; border-radius:8px; font-size:11.5px; background:#f9fafb;">
          </td>
          <td class="ns-promedio-cell">
            <span class="nota-cuadrito ${prom ? claseCuadritoNota(prom.letra) : "nota-cuadrito-vacio"} ns-promedio-cuadrito">${prom ? prom.letra : "–"}</span>
            <small class="ns-promedio-numero">${prom ? prom.promedio.toFixed(1) : ""}</small>
          </td>
        </tr>`;
    }).join("");

    tabla.querySelectorAll("tr[data-estudiante-id]").forEach(actualizarPromedioFila);
    actualizarResumenNotas();
  } catch (e) {
    tabla.innerHTML = `<tr><td colspan="${nsColspan}" class="teacher-v2-empty">Error: ${escaparHtml(e.message)}</td></tr>`;
    actualizarResumenNotas();
  }
}


function cambiarObsNota(estudianteId, valor) {
  if (String(valor || "").trim()) _nsObsPorEstudiante[estudianteId] = String(valor).trim().slice(0, 500);
  else delete _nsObsPorEstudiante[estudianteId];
}


// Línea de detección: cuántos promedian bajo (C) y cuántos siguen sin registrar
function actualizarResumenNotas() {
  const el = document.getElementById("nsResumen");
  if (!el) return;
  const bimEl = document.getElementById("nsTrimestre");
  const bimNombre = bimEl?.options[bimEl.selectedIndex]?.text || "Bimestre";
  const filas = [...document.querySelectorAll("#tablaNotasSimples tr[data-estudiante-id]")];
  if (!filas.length) { el.innerHTML = ""; return; }
  let enC = 0, sinRegistrar = 0;
  filas.forEach(fila => {
    const valores = [...fila.querySelectorAll(".nota-cuadrito[data-campo]")]
      .map(s => VALOR_LETRA[s.value]).filter(v => v !== undefined);
    if (!valores.length) { sinRegistrar++; return; }
    if (letraDesdeNota(valores.reduce((a, b) => a + b, 0) / valores.length) === "C") enC++;
  });
  el.innerHTML = `<strong>${escaparHtml(bimNombre)}</strong> · ${filas.length} estudiantes`
    + (enC ? ` · <span style="color:#dc2626; font-weight:700;">${enC} en C — requieren atención</span>` : ` · <span style="color:#059669;">sin promedios en C</span>`)
    + (sinRegistrar ? ` · <span style="color:#ca8a04;">${sinRegistrar} sin registrar</span>` : "");
}


function cambiarLetraNota(select) {
  const fila = select.closest("tr");
  select.className = `nota-cuadrito ${select.value ? claseCuadritoNota(select.value) : "nota-cuadrito-vacio"}`;
  actualizarPromedioFila(fila);
  const nota = VALOR_LETRA[select.value];
  if (nota !== undefined && _nsBimestreActual) {
    const filaId = Number(fila.dataset.estudianteId);
    const valores = [...fila.querySelectorAll(".nota-cuadrito[data-campo]")]
      .map(s => VALOR_LETRA[s.value]).filter(v => v !== undefined);
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    _nsPromediosPorBimestre[filaId] = { promedio, letra: letraDesdeNota(promedio) };
  }
  actualizarResumenNotas();
}


function actualizarPromedioFila(fila) {
  if (!fila) return;
  const cuadrito = fila.querySelector(".ns-promedio-cuadrito");
  const numero = fila.querySelector(".ns-promedio-numero");
  if (!cuadrito) return;
  const valores = [...fila.querySelectorAll(".nota-cuadrito[data-campo]")]
    .map(select => VALOR_LETRA[select.value])
    .filter(v => v !== undefined);
  if (valores.length === 0) {
    cuadrito.textContent = "–";
    cuadrito.className = "nota-cuadrito nota-cuadrito-vacio ns-promedio-cuadrito";
    if (numero) numero.textContent = "";
  } else {
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const letra = letraDesdeNota(promedio);
    cuadrito.textContent = letra;
    cuadrito.className = `nota-cuadrito ${claseCuadritoNota(letra)} ns-promedio-cuadrito`;
    if (numero) numero.textContent = promedio.toFixed(1);
  }
}


async function guardarNotasSimples() {
  const asignaturaId = Number(document.getElementById("nsCurso")?.value);
  const trimestreId = Number(document.getElementById("nsTrimestre")?.value);
  if (!asignaturaId || !trimestreId) { alert("Selecciona curso y bimestre."); return; }
  if (_nsCampos.length === 0) { alert("Agrega al menos un campo de nota."); return; }

  const registros = [];
  const observaciones = [];
  document.querySelectorAll("#tablaNotasSimples tr[data-estudiante-id]").forEach(fila => {
    const estudianteId = Number(fila.dataset.estudianteId);
    fila.querySelectorAll(".nota-cuadrito[data-campo]").forEach(select => {
      if (!select.value) return;
      registros.push({ estudianteId, campo: select.dataset.campoNombre || "", nota: VALOR_LETRA[select.value] });
    });
    const obsInput = fila.querySelector(".ns-obs");
    observaciones.push({ estudianteId, texto: (obsInput?.value || "").trim() });
  });

  if (registros.length === 0) { alert("Elige al menos una nota antes de guardar."); return; }
  const sinNombre = _nsCampos.some(c => !c.nombre.trim());
  if (sinNombre) { alert("Ponle nombre a todos los campos antes de guardar."); return; }

  try {
    const res = await apiFetch("/postgres/docentes/me/notas-simples", {
      method: "PUT",
      body: { asignaturaId, trimestreId, registros }
    });
    await apiFetch("/postgres/docentes/me/observaciones", {
      method: "PUT",
      body: { trimestreId, observaciones }
    });
    const bimNombre = document.getElementById("nsTrimestre")?.options[document.getElementById("nsTrimestre").selectedIndex]?.text || "";
    // Pasa automáticamente al siguiente bimestre que falte llenar, ya limpio
    const idxActual = _nsBimestres.findIndex(b => Number(b.id) === trimestreId);
    const hayPendiente = await irPrimerBimestrePendiente(idxActual + 1);
    _nsObsPorEstudiante = {};
    await cargarNotasSimples();
    (window.mostrarToastGlobal || alert)(hayPendiente
      ? `Notas del ${bimNombre} guardadas (${res.total} registros). Pasaste al siguiente bimestre pendiente.`
      : `Notas del ${bimNombre} guardadas (${res.total} registros). Todos los bimestres ya tienen notas.`, "ok");
  } catch (e) { alert("Error al guardar notas: " + e.message); }
}

function getCorreoActual() {
  const user = getUser();
  let correo = (user.correo || user.email || "").trim();
  if (!correo) {
    try {
      const token = localStorage.getItem("sat_token") || "";
      const payload = JSON.parse(atob(token.split(".")[1] || ""));
      correo = payload.email || payload.correo || payload.username || "";
    } catch(e) {}
  }
  return String(correo).trim().toLowerCase();
}

function solicitarEliminarNotas() {
  const bimEl = document.getElementById("nsTrimestre");
  const label = bimEl ? bimEl.options[bimEl.selectedIndex]?.text : "";
  document.getElementById("eliminarNotasBimestreLabel").textContent = label || "";
  const correo = getCorreoActual();
  document.getElementById("eliminarNotasCorreoDest").textContent = correo || "tu correo";
  document.getElementById("eliminarNotasPassword").value = "";
  document.getElementById("eliminarNotasBox")?.classList.remove("oculto");
  document.getElementById("eliminarNotasCodigoBox")?.classList.add("oculto");
  const msg = document.getElementById("msgEliminarNotas");
  if (!correo) msg.textContent = "No se pudo obtener tu correo. Cierra sesión y vuelve a entrar.";
  else msg.textContent = "";
}

async function enviarCodigoEliminarNotas() {
  const correo = getCorreoActual();
  const password = document.getElementById("eliminarNotasPassword")?.value || "";
  const msg = document.getElementById("msgEliminarNotas");
  const asignaturaId = Number(document.getElementById("nsCurso")?.value);
  const trimestreId = Number(document.getElementById("nsTrimestre")?.value);
  const seccionId = Number(document.getElementById("nsSeccion")?.value);
  if (!correo) { msg.textContent = "No se pudo obtener tu correo"; return; }
  if (!password) { msg.textContent = "Ingresa tu contraseña para verificar"; return; }
  if (!asignaturaId || !trimestreId || !seccionId) { msg.textContent = "Selecciona sección, curso y bimestre"; return; }
  msg.textContent = "Verificando contraseña y enviando código a tu correo...";
  try {
    const resp = await apiFetch("/verification/solicitar", { method: "POST", body: { email: correo, tipo: "eliminar_notas", datos: { correo, password, asignaturaId, trimestreId, seccionId, tipo: "eliminar_notas" } } });
    msg.className = "msg-ok"; msg.textContent = resp.mensaje || "Código enviado a tu correo";
    document.getElementById("eliminarNotasEmailDest").textContent = correo;
    document.getElementById("eliminarNotasCodigoBox")?.classList.remove("oculto");
    if (resp.codigoDemo) { msg.textContent += ` (Demo: ${resp.codigoDemo})`; document.getElementById("eliminarNotasCodigo").value = resp.codigoDemo; }
  } catch (e) { msg.className = "msg-err"; msg.textContent = "Error: " + e.message; }
}

async function verificarYEliminarNotas() {
  const correo = getCorreoActual();
  const codigo = document.getElementById("eliminarNotasCodigo")?.value.trim();
  const msg = document.getElementById("msgEliminarNotas");
  const asignaturaId = Number(document.getElementById("nsCurso")?.value);
  const trimestreId = Number(document.getElementById("nsTrimestre")?.value);
  if (!codigo) { msg.textContent = "Ingresa el código"; return; }
  msg.textContent = "Verificando y eliminando...";
  try {
    await apiFetch("/verification/verificar", { method: "POST", body: { email: correo, codigo } });
    const res = await apiFetch("/postgres/docentes/me/notas-simples", { method: "DELETE", body: { asignaturaId, trimestreId } });
    await apiFetch("/postgres/docentes/me/observaciones", { method: "DELETE", body: { trimestreId } }).catch(()=>{});
    const estudiantes = [...document.querySelectorAll("#tablaNotasSimples tr[data-estudiante-id]")].map(tr => Number(tr.dataset.estudianteId));
    await Promise.all(estudiantes.map(id => apiFetch("/postgres/docentes/me/comportamiento", { method: "DELETE", body: { estudianteId: id, trimestreId } }).catch(()=>{})));
    msg.className = "msg-ok"; msg.textContent = `Notas eliminadas (${res.total || 0} registros)`;
    document.getElementById("eliminarNotasBox")?.classList.add("oculto");
    await cargarNotasSimples();
  } catch (e) { msg.className = "msg-err"; msg.textContent = "Error: " + e.message; }
}

async function abrirModuloNotasDocente() {
  mostrarSeccionDocente("doc-notas");
  await inicializarNotasDocente();
}


let _nsEstudiantesActuales = [];

