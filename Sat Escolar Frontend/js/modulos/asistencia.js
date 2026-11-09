// Asistencia del docente — SAT Escolar

let _docenteEstudiantesActuales = [];

let _docenteModoAsistencia = false;

let _docenteAsistenciaHoy = [];

let _docenteSeccionesDisponibles = [];

let _docenteSalonActual = null;

async function cargarFiltrosSalonDocente() {
  try {
    _docenteSeccionesDisponibles = await apiFetch("/postgres/secciones");
    if (_docenteSeccionesDisponibles.length === 0) return;

    const nivelEl = document.getElementById("docNivel");
    const gradoEl = document.getElementById("docGrado");
    const seccionEl = document.getElementById("docSeccion");
    if (nivelEl && gradoEl && seccionEl) {
      nivelEl.onchange = () => actualizarGradosDocente();
      gradoEl.onchange = () => actualizarSeccionesDocente();
      const nivelActual = nivelEl.value;
      const niveles = [...new Set(_docenteSeccionesDisponibles.map(s => s.nivel))];
      nivelEl.innerHTML = niveles.map(n => `<option value="${n}">${n}</option>`).join("");
      nivelEl.value = niveles.includes(nivelActual) ? nivelActual : (niveles.includes("Secundaria") ? "Secundaria" : niveles[0]);
      actualizarGradosDocente();
    }
    cargarFiltrosHistorialAsistencia();
  } catch (e) {
    console.error("No se pudieron cargar las secciones desde PostgreSQL:", e);
  }
}


function actualizarGradosDocente(gradoPreferido = null, seccionPreferida = null) {
  const nivelEl = document.getElementById("docNivel");
  const gradoEl = document.getElementById("docGrado");
  if (!nivelEl || !gradoEl) return;

  const grados = [...new Set(_docenteSeccionesDisponibles
    .filter(s => s.nivel === nivelEl.value)
    .map(s => s.grado))];

  const gradoActual = gradoPreferido || gradoEl.value;
  gradoEl.innerHTML = grados.map(g => `<option value="${g}">${g}</option>`).join("");
  gradoEl.value = grados.includes(gradoActual) ? gradoActual : (grados.includes("5to") ? "5to" : grados[0] || "");
  actualizarSeccionesDocente(seccionPreferida);
}


function actualizarSeccionesDocente(seccionPreferida = null) {
  const nivelEl = document.getElementById("docNivel");
  const gradoEl = document.getElementById("docGrado");
  const seccionEl = document.getElementById("docSeccion");
  if (!nivelEl || !gradoEl || !seccionEl) return;

  const secciones = [...new Set(_docenteSeccionesDisponibles
    .filter(s => s.nivel === nivelEl.value && s.grado === gradoEl.value)
    .map(s => s.letra))];

  const seccionActual = seccionPreferida || seccionEl.value;
  seccionEl.innerHTML = secciones.map(s => `<option value="${s}">${s}</option>`).join("");
  seccionEl.value = secciones.includes(seccionActual) ? seccionActual : (secciones[0] || "");
}


function cargarFiltrosHistorialAsistencia() {
  const nivelEl = document.getElementById("asistenciaNivelFiltro");
  const gradoEl = document.getElementById("asistenciaGradoFiltro");
  const seccionEl = document.getElementById("asistenciaSeccionFiltro");
  if (!nivelEl || !gradoEl || !seccionEl || _docenteSeccionesDisponibles.length === 0) return;

  nivelEl.onchange = () => actualizarGradosHistorialAsistencia();
  gradoEl.onchange = () => actualizarSeccionesHistorialAsistencia();

  const niveles = [...new Set(_docenteSeccionesDisponibles.map(s => s.nivel))];
  const nivelActual = nivelEl.value;
  nivelEl.innerHTML = niveles.map(n => `<option value="${n}">${n}</option>`).join("");
  nivelEl.value = niveles.includes(nivelActual) ? nivelActual : (niveles.includes("Secundaria") ? "Secundaria" : niveles[0]);
  actualizarGradosHistorialAsistencia();
}


function actualizarGradosHistorialAsistencia(gradoPreferido = null, seccionPreferida = null) {
  const nivelEl = document.getElementById("asistenciaNivelFiltro");
  const gradoEl = document.getElementById("asistenciaGradoFiltro");
  if (!nivelEl || !gradoEl) return;

  const grados = [...new Set(_docenteSeccionesDisponibles
    .filter(s => s.nivel === nivelEl.value)
    .map(s => s.grado))];
  const gradoActual = gradoPreferido || gradoEl.value;
  gradoEl.innerHTML = grados.map(g => `<option value="${g}">${g}</option>`).join("");
  gradoEl.value = grados.includes(gradoActual) ? gradoActual : (grados.includes("5to") ? "5to" : grados[0] || "");
  actualizarSeccionesHistorialAsistencia(seccionPreferida);
}


function actualizarSeccionesHistorialAsistencia(seccionPreferida = null) {
  const nivelEl = document.getElementById("asistenciaNivelFiltro");
  const gradoEl = document.getElementById("asistenciaGradoFiltro");
  const seccionEl = document.getElementById("asistenciaSeccionFiltro");
  if (!nivelEl || !gradoEl || !seccionEl) return;

  const secciones = [...new Set(_docenteSeccionesDisponibles
    .filter(s => s.nivel === nivelEl.value && s.grado === gradoEl.value)
    .map(s => s.letra))];
  const seccionActual = seccionPreferida || seccionEl.value;
  seccionEl.innerHTML = secciones.map(s => `<option value="${s}">${s}</option>`).join("");
  seccionEl.value = secciones.includes(seccionActual) ? seccionActual : (secciones[0] || "");
}


async function cargarSalonDocente(salon = _docenteSalonActual) {
  const tabla = document.getElementById("tablaRegistroDocente");
  if (!tabla) return;

  try {
    if (!salon?.nivel || !salon?.grado || !salon?.seccion) {
      tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">Selecciona Asistencia desde uno de tus cursos.</td></tr>';
      return;
    }
    _docenteSalonActual = salon;
    const { nivel, grado, seccion } = salon;
    const estudiantes = await apiFetch(`/postgres/estudiantes?nivel=${encodeURIComponent(nivel)}&grado=${encodeURIComponent(grado)}&seccion=${encodeURIComponent(seccion)}`);
    _docenteEstudiantesActuales = estudiantes;
    _docenteModoAsistencia = false;
    const total = document.getElementById("totalSalonDocente");
    if (total) total.textContent = estudiantes.length;
    const salonActual = document.getElementById("salonAsistenciaActual");
    if (salonActual) salonActual.textContent = `${grado} ${seccion} · ${nivel}`;

    const hoy = fechaLocalISO();
    const fechaEl = document.getElementById("asistenciaFechaHoy");
    if (fechaEl) {
      const fechaTexto = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      fechaEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}`;
    }
    actualizarControlesAsistenciaDocente();

    const estadoDiaEl = document.getElementById("asistenciaEstadoDia");
    const btnEditar = document.getElementById("btnEditarAsistenciaPg");
    let asistenciasHoy = [];
    try {
      asistenciasHoy = await apiFetch(`/postgres/asistencias?fecha=${hoy}&nivel=${encodeURIComponent(nivel)}&grado=${encodeURIComponent(grado)}&seccion=${encodeURIComponent(seccion)}`);
    } catch (e) {
      console.error("No se pudo consultar la asistencia del día:", e);
    }
    _docenteAsistenciaHoy = asistenciasHoy;

    if (estadoDiaEl) {
      if (asistenciasHoy.length > 0) {
        estadoDiaEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M20 6L9 17l-5-5"/></svg>La asistencia de hoy ya esta registrada (${asistenciasHoy.length} estudiantes). Puedes editarla si algun alumno llego tarde o falto.`;
        estadoDiaEl.style.color = "#059669";
      } else {
        estadoDiaEl.textContent = "Hoy aún no se ha tomado asistencia en este salón.";
        estadoDiaEl.style.color = "#ca8a04";
      }
    }
    if (btnEditar) btnEditar.classList.toggle("oculto", asistenciasHoy.length === 0);

    if (estudiantes.length === 0) {
      tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">No hay estudiantes registrados para este filtro.</td></tr>';
      return;
    }

    tabla.innerHTML = estudiantes.map((e, index) => {
      const nombreCompleto = `${e.nombres || ""} ${e.apellidos || ""}`.trim();
      const iniciales = nombreCompleto
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0])
        .join("")
        .toUpperCase();
      const registroHoy = asistenciasHoy.find(a => a.estudiante_id === e.id);
      const estadoPrevio = (registroHoy && registroHoy.estado) || "Asistió";
      return `
      <tr data-estudiante-id="${e.id}" data-estado="${estadoPrevio}">
        <td>
          <div class="teacher-v2-student-cell">
            <span class="teacher-v2-row-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="teacher-v2-avatar">${iniciales || "ES"}</span>
            <span>
              <strong>${nombreCompleto}</strong>
              <small>${[e.grado, e.letra].filter(Boolean).join(" ") || e.seccion || ""}</small>
            </span>
          </div>
        </td>
        <td><span class="teacher-v2-email">${e.correo}</span></td>
        <td class="doc-asistencia-cell oculto" style="text-align:center;">${htmlCicloEstado(estadoPrevio)}</td>
      </tr>`;
    }).join("");
  } catch (e) {
    console.error(e);
    tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">No se pudo cargar la lista desde PostgreSQL. Revisa tus credenciales y que el backend esté reiniciado.</td></tr>';
  }
}


function actualizarControlesAsistenciaDocente() {
  document.querySelectorAll(".doc-asistencia-head").forEach(th => th.classList.toggle("oculto", !_docenteModoAsistencia));
  document.querySelectorAll(".doc-asistencia-cell").forEach(td => td.classList.toggle("oculto", !_docenteModoAsistencia));
  document.getElementById("btnGuardarAsistenciaPg")?.classList.toggle("oculto", !_docenteModoAsistencia);
  const btn = document.getElementById("btnModoAsistencia");
  if (btn) btn.textContent = _docenteModoAsistencia ? "Ocultar asistencia" : "Tomar asistencia";
}


function activarModoAsistencia() {
  if (_docenteEstudiantesActuales.length === 0) {
    alert("Selecciona Asistencia desde uno de tus cursos para cargar estudiantes.");
    return;
  }
  _docenteModoAsistencia = !_docenteModoAsistencia;
  actualizarControlesAsistenciaDocente();
}



async function guardarAsistenciaPostgres() {
  const botonGuardar = document.getElementById("btnGuardarAsistenciaPg");
  const filas = [...document.querySelectorAll("#tablaRegistroDocente tr[data-estudiante-id]")];
  const registros = filas.map(fila => ({
    estudianteId: Number(fila.dataset.estudianteId),
    estado: fila.dataset.estado || ""
  })).filter(r => r.estado);

  if (registros.length === 0) {
    alert("Marca al menos una asistencia antes de guardar.");
    return;
  }

  try {
    if (botonGuardar) {
      botonGuardar.disabled = true;
      botonGuardar.textContent = "Guardando...";
    }

    await apiFetch("/postgres/asistencias", {
      method: "POST",
      body: { fecha: fechaLocalISO(), registros }
    });

    alert("Asistencia guardada correctamente.");
    _docenteModoAsistencia = false;
    document.querySelectorAll("#tablaRegistroDocente tr[data-estudiante-id]").forEach(fila => {
      fila.dataset.estado = "";
      fila.querySelectorAll(".teacher-v2-attendance-choice").forEach(btn => btn.classList.remove("is-selected"));
    });
    actualizarControlesAsistenciaDocente();
    await cargarSalonDocente();
  } catch (e) {
    alert("Error al guardar asistencia: " + e.message);
  } finally {
    if (botonGuardar) {
      botonGuardar.disabled = false;
      botonGuardar.textContent = "Guardar asistencia";
    }
  }
}


async function cargarHistorialAsistencia() {
  const tabla = document.getElementById("tablaHistorialAsistencia");
  if (!tabla) return;

  const fecha = document.getElementById("asistenciaFechaFiltro")?.value || fechaLocalISO();
  const nivel = document.getElementById("asistenciaNivelFiltro")?.value || "Secundaria";
  const grado = document.getElementById("asistenciaGradoFiltro")?.value || "5to";
  const seccion = document.getElementById("asistenciaSeccionFiltro")?.value || "A";

  try {
    const registros = await apiFetch(`/postgres/asistencias?fecha=${encodeURIComponent(fecha)}&nivel=${encodeURIComponent(nivel)}&grado=${encodeURIComponent(grado)}&seccion=${encodeURIComponent(seccion)}`);

    if (registros.length === 0) {
      tabla.innerHTML = '<tr><td colspan="5" class="teacher-v2-empty">No hay asistencia registrada para esa fecha.</td></tr>';
      return;
    }

    tabla.innerHTML = registros.map((r, index) => `
      <tr>
        <td>
          <div class="teacher-v2-student-cell">
            <span class="teacher-v2-row-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="teacher-v2-avatar">${inicialesEstudiante(r.nombres, r.apellidos)}</span>
            <span>
              <strong>${r.nombres} ${r.apellidos}</strong>
              <small>${[r.grado, r.letra].filter(Boolean).join(" ") || r.seccion || ""}</small>
            </span>
          </div>
        </td>
        <td><span class="teacher-v2-email">${r.correo}</span></td>
        <td><span class="teacher-v2-attendance-badge ${claseAsistencia(r.estado)}">${r.estado}</span></td>
        <td>${r.fecha?.slice(0, 10) || fecha}</td>
        <td>
          <button class="teacher-v2-small-btn" onclick="abrirEditarAsistencia(${r.estudiante_id}, '${r.fecha?.slice(0, 10) || fecha}', '${String(r.estado).replace(/'/g, "\\'")}', '${String(`${r.nombres} ${r.apellidos}`).replace(/'/g, "\\'")}')">Editar</button>
        </td>
      </tr>`).join("");
  } catch (e) {
    tabla.innerHTML = '<tr><td colspan="5" class="teacher-v2-empty">No se pudo cargar la asistencia.</td></tr>';
  }
}


function abrirEditarAsistencia(estudianteId, fecha, estado, nombre) {
  const idEl = document.getElementById("editAsistenciaEstudianteId");
  const fechaEl = document.getElementById("editAsistenciaFecha");
  const estadoEl = document.getElementById("editAsistenciaEstado");
  const obsEl = document.getElementById("editAsistenciaObservacion");
  const nombreEl = document.getElementById("editAsistenciaEstudianteNombre");
  if (idEl) idEl.value = estudianteId;
  if (fechaEl) fechaEl.value = fecha;
  if (estadoEl) estadoEl.value = estado;
  if (obsEl) obsEl.value = "";
  if (nombreEl) nombreEl.textContent = `${nombre} - ${fecha}`;
  document.getElementById("modalEditarAsistencia")?.classList.remove("oculto");
}


async function guardarEdicionAsistencia() {
  const estudianteId = Number(document.getElementById("editAsistenciaEstudianteId")?.value);
  const fecha = document.getElementById("editAsistenciaFecha")?.value;
  const estado = document.getElementById("editAsistenciaEstado")?.value;
  const observacion = document.getElementById("editAsistenciaObservacion")?.value.trim();

  if (!estudianteId || !fecha || !estado) {
    alert("No se pudo identificar el registro.");
    return;
  }

  try {
    await apiFetch("/postgres/asistencias", {
      method: "POST",
      body: {
        fecha,
        registros: [{ estudianteId, estado, observacion }]
      }
    });
    cerrarModal("modalEditarAsistencia");
    await cargarHistorialAsistencia();
    alert("Asistencia actualizada correctamente.");
  } catch (e) {
    alert("No se pudo actualizar la asistencia: " + e.message);
  }
}


async function guardarRegistrosDocente() {
  const filas = [...document.querySelectorAll("#tablaRegistroDocente tr[data-estudiante-id]")];
  if (filas.length === 0) { alert("No hay estudiantes para guardar."); return; }

  try {
    for (const fila of filas) {
      const id = parseInt(fila.dataset.estudianteId);
      const notaCampo = document.getElementById(`doc-nota-${id}`);
      const nota = notaCampo?.value === "" ? null : parseFloat(notaCampo.value);
      if (nota !== null && (isNaN(nota) || nota < 0 || nota > 20)) {
        alert("Las notas deben estar entre 0 y 20.");
        notaCampo?.focus();
        return;
      }

      const conductaUi = document.getElementById(`doc-conducta-${id}`)?.value || "A";
      await apiFetch("/estudiantes/registro", {
        method: "POST",
        body: {
          estudianteId: id,
          evaluacion: "Registro diario",
          asistencia: document.getElementById(`doc-asistencia-${id}`)?.value || "Asistió",
          nota,
          conducta: conductaParaMotor(conductaUi),
          observacion: `Conducta registrada: ${conductaUi}`
        }
      });
    }
    alert("Registros guardados correctamente.");
    await cargarSalonDocente();
  } catch (e) {
    alert("Error al guardar registros: " + e.message);
  }
}


async function actualizarResumenEvidenciasDocente() {
  try {
    const resumen = await apiFetch("/estudiantes/incidentes/contador");
    const ids = ["docEvidenciasPendientes", "docEvidenciasPendientesVista", "modalEvidenciasPendientes"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = resumen.total || 0;
    });
  } catch (e) {}
}

// -- NOTAS DOCENTE -----------------------------------------------------------


async function eliminarEstudiante(id) {
  if (!confirm("¿Eliminar este estudiante?")) return;
  try {
    await apiFetch("/estudiantes/" + id, { method: "DELETE" });
    cargarPanelDocente();
  } catch (e) { alert("Error: " + e.message); }
}


async function guardarAsistencia() {
  try {
    const estudiantes = await apiFetch("/postgres/estudiantes");
    const user = getUser();

    for (const e of estudiantes) {
      const campo = document.getElementById("asistencia-" + e.id);
      if (!campo) continue;
      await apiFetch("/estudiantes/registro", {
        method: "POST",
        body: {
          estudianteId: e.id,
          evaluacion: "Asistencia",
          asistencia: campo.value,
          conducta: "Buena"
        }
      });
    }
    alert("Asistencia guardada correctamente.");
    cargarPanelDocente();
  } catch (e) { alert("Error: " + e.message); }
}


async function guardarCalificacion() {
  const id         = document.getElementById("estudianteNota").value;
  const evaluacion = document.getElementById("evaluacion").value.trim();
  const nota       = parseFloat(document.getElementById("nota").value);
  const conducta   = document.getElementById("conducta").value;
  const observacion= document.getElementById("observacion").value.trim();

  if (!id || !evaluacion || !observacion) { alert("Completa todos los campos."); return; }
  if (isNaN(nota) || nota < 0 || nota > 20) { alert("La nota debe ser entre 0 y 20."); return; }

  try {
    await apiFetch("/estudiantes/registro", {
      method: "POST",
      body: { estudianteId: parseInt(id), evaluacion, asistencia: "Asistió", nota, conducta, observacion }
    });
    alert("Registro enviado al módulo psicopedagógico.");
    cargarPanelDocente();
  } catch (e) { alert("Error: " + e.message); }
}

// ── PANEL PSICÓLOGA ───────────────────────────────────────────────────────────

// ── REGISTRO DE ASISTENCIAS: historial vertical por días + detalle ──
const REG_ASIS_ESTILO = {
  "Asistió": "background:#e7f7ee; color:#166534;",
  "Tardanza": "background:#fef3c7; color:#92400e;",
  "Faltó": "background:#fdeceb; color:#b91c1c;",
  "Sin registro": "background:#f3f4f6; color:#6b7280;"
};

// Control profesional de un clic: píldora con punto de color + etiqueta.
// Rota: Asistió (verde) → Tardanza (naranja) → Faltó (rojo) → Asistió…
const CICLO_ORDEN = ["Asistió", "Tardanza", "Faltó"];
const CICLO_UI = {
  "Asistió": { dot: "#16a34a", bg: "#e7f7ee", bd: "#bbe7cd", tx: "#166534", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.2" style="width:11px;height:11px;" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' },
  "Tardanza": { dot: "#f59e0b", bg: "#fef3c7", bd: "#f5dfa8", tx: "#92400e", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" style="width:11px;height:11px;" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' },
  "Faltó": { dot: "#dc2626", bg: "#fdeceb", bd: "#f5c6c0", tx: "#b91c1c", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.2" style="width:10px;height:10px;" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' }
};
function htmlCicloEstado(estado) {
  const v = CICLO_ORDEN.includes(estado) ? estado : "Asistió";
  const u = CICLO_UI[v];
  return `<button type="button" class="seg-est" data-estado="${v}" title="${v} (clic para cambiar)" onclick="ciclarEstadoAsistencia(this)" style="display:inline-flex; align-items:center; gap:8px; padding:4px 12px 4px 4px; border-radius:999px; border:1px solid ${u.bd}; background:${u.bg}; color:${u.tx}; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s;">`
    + `<span style="width:22px; height:22px; border-radius:50%; background:${u.dot}; display:inline-grid; place-items:center; flex-shrink:0;">${u.svg}</span>${v}</button>`;
}
function ciclarEstadoAsistencia(btn) {
  const sig = CICLO_ORDEN[(CICLO_ORDEN.indexOf(btn.dataset.estado) + 1) % CICLO_ORDEN.length];
  const u = CICLO_UI[sig];
  btn.dataset.estado = sig;
  btn.title = `${sig} (clic para cambiar)`;
  btn.style.background = u.bg;
  btn.style.borderColor = u.bd;
  btn.style.color = u.tx;
  btn.innerHTML = `<span style="width:22px; height:22px; border-radius:50%; background:${u.dot}; display:inline-grid; place-items:center; flex-shrink:0;">${u.svg}</span>${sig}`;
  const fila = btn.closest("tr[data-estudiante-id]");
  if (fila) fila.dataset.estado = sig;
}

function fechaLargaSegura(f) {
  if (!f) return "-";
  const s = String(f).slice(0, 10) + "T12:00:00";
  try { return new Date(s).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  catch (_) { return String(f).slice(0, 10); }
}

async function initRegistroAsistencias() {
  const f = document.getElementById("regAsisFecha");
  if (f && !f.value) f.value = new Date().toISOString().slice(0, 10);
  const sel = document.getElementById("regAsisSeccion");
  if (sel && sel.options.length <= 1) {
    try {
      const secs = await apiFetch("/postgres/docentes/me/secciones");
      sel.innerHTML = '<option value="">Todas</option>' + (secs || []).map(s => `<option value="${s.seccion_id}">${s.seccion}</option>`).join("");
    } catch (e) {}
  }
  document.getElementById("regAsisDetalle")?.classList.add("oculto");
  document.getElementById("regAsisHistWrap")?.classList.remove("oculto");
  cargarHistorialFechas();
}

async function cargarHistorialFechas() {
  const cont = document.getElementById("regAsisHistorial");
  const seccionId = document.getElementById("regAsisSeccion")?.value || "";
  if (!cont) return;
  cont.innerHTML = '<p class="teacher-v2-empty">Cargando historial...</p>';
  try {
    const dias = await apiFetch(`/postgres/asistencias/fechas${seccionId ? `?seccionId=${seccionId}` : ""}`);
    if (!dias.length) {
      cont.innerHTML = '<p class="teacher-v2-empty">Aún no hay días registrados. Cuando tomes asistencia aparecerán aquí.</p>';
      return;
    }
    const parseF = f => {
      const p = String(f).slice(0, 10).split("-").map(Number);
      return new Date(p[0], p[1] - 1, p[2]);
    };
    const isoF = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const lunesDe = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
    const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const etiquetaDia = f => {
      const d = parseF(f);
      return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} del ${d.getFullYear()}`;
    };
    const porFecha = {};
    dias.forEach(d => { porFecha[String(d.fecha).slice(0, 10)] = d; });
    const hoyLunes = lunesDe(new Date());
    const pill = (txt, bg, c) => `<span style="font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; background:${bg}; color:${c};">${txt}</span>`;
    const filaDia = (f, d) => {
      const det = d
        ? `<div style="margin-top:5px; display:flex; gap:5px; flex-wrap:wrap;">${pill(`${d.asistieron || 0} asistieron`, "#e7f7ee", "#166534")}${pill(`${d.tardanzas || 0} tardanzas`, "#fef3c7", "#92400e")}${pill(`${d.faltaron || 0} faltaron`, "#fdeceb", "#b91c1c")}</div>`
        : `<div style="font-size:11px; color:#9ca3af; margin-top:3px;">Sin registro</div>`;
      return `<div style="border:1px solid #e5e7eb; border-left:3px solid ${d ? "#1a3a5c" : "#e5e7eb"}; border-radius:12px; padding:11px 14px; background:white; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; transition:box-shadow .15s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(26,58,92,.10)'" onmouseout="this.style.boxShadow=''">
        <div>
          <div style="font-size:15px; font-weight:800; color:#1a3a5c;">${etiquetaDia(f)}</div>
          ${det}
        </div>
        <button type="button" class="teacher-v2-small-btn" onclick="verRegistroDia('${f}')">Ver</button>
      </div>`;
    };
    const diasSemana = (lun, soloConDatos) => {
      const out = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(lun); d.setDate(d.getDate() + i);
        const f = isoF(d);
        if (soloConDatos && !porFecha[f]) continue;
        out.push(filaDia(f, porFecha[f]));
      }
      return out.join("");
    };
    const grupoBox = (idAttr, titulo, n, inner, destacado, abierto) => `
      <button onclick="document.getElementById('${idAttr}').classList.toggle('oculto')" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:13px 15px; background:${destacado ? "#eef4fb" : "white"}; border:1px solid ${destacado ? "#1a3a5c" : "#e5e7eb"}; border-radius:12px; cursor:pointer; margin-bottom:8px;">
        <span style="font-size:14px; font-weight:800; color:#1a3a5c;">${titulo} <span style="font-size:11px; font-weight:700; background:${destacado ? "#1a3a5c" : "#f3f4f6"}; color:${destacado ? "white" : "#6b7280"}; padding:2px 8px; border-radius:999px;">${n}</span></span>
        <span style="font-size:13px; color:#9ca3af;">▾</span>
      </button>
      <div id="${idAttr}" class="${abierto ? "" : "oculto"}" style="margin:0 0 14px;">${inner}</div>`;
    const semActual = diasSemana(hoyLunes, false);
    const ult4Dias = [];
    for (let i = 1; i <= 4; i++) {
      const lun = new Date(hoyLunes); lun.setDate(lun.getDate() - i * 7);
      for (let k = 0; k < 5; k++) {
        const d = new Date(lun); d.setDate(d.getDate() + k);
        const f = isoF(d);
        if (porFecha[f]) ult4Dias.push(filaDia(f, porFecha[f]));
      }
    }
    const ult4 = ult4Dias.length ? ult4Dias.join("") : "";
    const corte = new Date(hoyLunes); corte.setDate(corte.getDate() - 4 * 7);
    const antiguas = dias.filter(d => parseF(d.fecha) < corte);
    let htmlGrupos = grupoBox("regAsisGAct", "Semana actual", 5, semActual, true, true);
    if (ult4) htmlGrupos += grupoBox("regAsisG4", "Últimas 4 semanas", ult4Dias.length, ult4, false, false);
    if (antiguas.length) htmlGrupos += grupoBox("regAsisGAnt", "Semanas anteriores", antiguas.length, antiguas.map(d => filaDia(String(d.fecha).slice(0, 10), d)).join(""), false, false);
    cont.innerHTML = htmlGrupos;
  } catch (e) {
    cont.innerHTML = `<p class="teacher-v2-empty">Error: ${escaparHtml(e.message)}</p>`;
  }
}

function buscarFechaRegistro() {
  const fecha = document.getElementById("regAsisFecha")?.value || "";
  if (!fecha) { alert("Elige un día para buscar."); return; }
  verRegistroDia(fecha);
}

function volverHistorialRegistro() {
  document.getElementById("regAsisDetalle")?.classList.add("oculto");
  document.getElementById("regAsisHistWrap")?.classList.remove("oculto");
}

let _regDiaActual = null;

async function verRegistroDia(fecha) {
  const seccionId = document.getElementById("regAsisSeccion")?.value || "";
  const det = document.getElementById("regAsisDetalle");
  const hist = document.getElementById("regAsisHistWrap");
  const tabla = document.getElementById("tablaRegistroAsistencias");
  if (!det || !tabla) return;
  if (hist) hist.classList.add("oculto");
  det.classList.remove("oculto");
  tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">Cargando...</td></tr>';
  try {
    let secciones = [];
    try { secciones = await apiFetch("/postgres/docentes/me/secciones"); } catch (e) { secciones = []; }
    if (seccionId) secciones = secciones.filter(s => String(s.seccion_id) === String(seccionId));
    let alumnos = [];
    for (const s of (secciones || [])) {
      try {
        const ests = await apiFetch(`/postgres/estudiantes?seccionId=${s.seccion_id}`);
        (ests || []).forEach(e => alumnos.push({ ...e, seccionNombre: s.seccion }));
      } catch (e) {}
    }
    const asis = await apiFetch(`/postgres/asistencias?fecha=${fecha}`).catch(() => []);
    const porEst = {};
    (asis || []).forEach(a => { porEst[a.estudiante_id] = a; });
    _regDiaActual = {
      fecha,
      filas: alumnos.map(e => ({
        id: e.id,
        nombre: `${e.nombres} ${e.apellidos}`,
        seccion: e.seccionNombre || "",
        estado: porEst[e.id] ? porEst[e.id].estado : "",
        observacion: (porEst[e.id] && porEst[e.id].observacion) || ""
      }))
    };
    renderDiaVista();
  } catch (e) {
    tabla.innerHTML = `<tr><td colspan="3" class="teacher-v2-empty">Error: ${escaparHtml(e.message)}</td></tr>`;
  }
}

function renderDiaVista() {
  if (!_regDiaActual) return;
  const { fecha, filas } = _regDiaActual;
  const titulo = document.getElementById("regAsisDetalleTitulo");
  const acciones = document.getElementById("regAsisDetalleAcciones");
  const tabla = document.getElementById("tablaRegistroAsistencias");
  const resumen = document.getElementById("regAsisResumen");
  const msg = document.getElementById("regAsisEditMsg");
  if (titulo) titulo.textContent = fechaLargaSegura(fecha);
  if (msg) msg.textContent = "";
  if (acciones) acciones.innerHTML = `<button type="button" class="teacher-v2-small-btn" onclick="guardarEdicionRegistro()">Guardar cambios</button>`;
  const cuenta = { "Asistió": 0, "Tardanza": 0, "Faltó": 0 };
  tabla.innerHTML = filas.map((f, i) => {
    const estado = f.estado || "Asistió";
    cuenta[estado] = (cuenta[estado] || 0) + 1;
    return `<tr data-i="${i}"><td><strong>${escaparHtml(f.nombre)}</strong></td>`
      + `<td>${escaparHtml(f.seccion)}</td>`
      + `<td>${htmlCicloEstado(estado)}</td></tr>`;
  }).join("") || '<tr><td colspan="3" class="teacher-v2-empty">Ese día no hay registros. Si tomaste asistencia aparecerá aquí.</td></tr>';
  if (resumen) {
    resumen.innerHTML = Object.entries(cuenta).map(([k, v]) => `<span style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px; ${REG_ASIS_ESTILO[k]}">${k}: ${v}</span>`).join("");
  }
}

async function guardarEdicionRegistro() {
  if (!_regDiaActual) return;
  const msg = document.getElementById("regAsisEditMsg");
  const registros = [];
  document.querySelectorAll("#tablaRegistroAsistencias tr[data-i]").forEach(tr => {
    const i = Number(tr.dataset.i);
    const estado = tr.querySelector(".seg-est")?.dataset.estado || "";
    if (!estado) return;
    registros.push({ estudianteId: _regDiaActual.filas[i].id, estado });
  });
  if (!registros.length) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Marca al menos un estado antes de guardar."; }
    return;
  }
  if (msg) { msg.style.color = "#6b7280"; msg.textContent = "Guardando cambios..."; }
  try {
    await apiFetch("/postgres/asistencias", { method: "POST", body: { fecha: _regDiaActual.fecha, registros } });
    if (msg) { msg.style.color = "#059669"; msg.textContent = "Cambios guardados."; }
    await verRegistroDia(_regDiaActual.fecha);
    if (typeof cargarHistorialFechas === "function") cargarHistorialFechas();
  } catch (e) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Error: " + e.message; }
  }
}
