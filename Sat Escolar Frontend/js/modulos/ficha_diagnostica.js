// Ficha Diagnóstica SocioEducativa — 11 secciones obligatoria para estudiante
const MAP_VIVE_A_PERFIL = {
  "Ambos Padres": "padres", "Solo Madre": "madre", "Solo Padre": "padre",
  "Solo Abuelos": "abuelos", "Hermanos": "otro", "Madre y Padrastro": "otro",
  "Padre y Madrastra": "otro", "Tíos y Abuela": "abuelos", "Tios y Abuela": "abuelos",
  "Otros": "otro", "Otro": "otro"
};
const MAP_RELACION_A_PERFIL = {
  "Armoniosas": "estable", "Regularmente Armoniosas": "estable",
  "Conflictivas": "conflictiva", "Violentas": "violencia"
};

function getFichaForm() {
  return document.getElementById("fichaForm") || document.getElementById("fichaDiagnosticaForm") || null;
}
function recogerDatosFicha() {
  const form = getFichaForm();
  if (!form) return null;
  const datos = {};
  form.querySelectorAll("input, select, textarea").forEach(el => {
    const key = el.name || el.id;
    if (!key) return;
    if (el.type === "radio") { if (el.checked) datos[key] = el.value; }
    else if (el.type === "checkbox") { if (el.checked) datos[key] = el.value; }
    else datos[key] = el.value;
  });
  // Normalizar claves para el backend (acepta ambas)
  if (datos.apellidos && !datos.apellidosNombres) datos.apellidosNombres = datos.apellidos;
  if (datos.email && !datos.correo) datos.correo = datos.email;
  if (datos.residencia && !datos.lugarResidencia) datos.lugarResidencia = datos.residencia;
  if (datos.fechanac && !datos.fechaNacimiento) datos.fechaNacimiento = datos.fechanac;
  if (datos.lugarnac && !datos.lugarNacimiento) datos.lugarNacimiento = datos.lugarnac;
  if (datos.emergencia && !datos.emergenciaAcudir) datos.emergenciaAcudir = datos.emergencia;
  if (datos.telefono && !datos.telefonoFijo) datos.telefonoFijo = datos.telefono;
  // Derivar conQuienVives normalizado para el motor de riesgo (CHECK: padres/madre/padre/abuelos/tutor/albergue/solo/otro)
  const vivesLabels = {
    vives_ambospadres: "Ambos Padres", vives_solomadre: "Solo Madre", vives_solopadre: "Solo Padre",
    vives_soloabuelos: "Solo Abuelos", vives_hermanos: "Hermanos", vives_madrastra: "Madre y Padrastro",
    vives_padrastra: "Padre y Madrastra", vives_tios: "Tíos y Abuela", vives_otros: "Otros"
  };
  const marcados = Object.keys(vivesLabels).filter(k => datos[k]);
  if (marcados.length && !datos.conQuienVives) {
    const primero = vivesLabels[marcados[0]];
    datos.conQuienVives = MAP_VIVE_A_PERFIL[primero] || "otro";
    datos.conQuienVivesLabel = marcados.map(k => vivesLabels[k]).join(", ");
  }
  if (datos.relaciones_familiares && !datos.situacion_convivencia) {
    datos.situacion_convivencia = MAP_RELACION_A_PERFIL[datos.relaciones_familiares] || null;
  }
  return datos;
}

function mostrarExitoFicha() {
  const ok = document.getElementById("successMsg");
  if (ok) { ok.style.display = "block"; setTimeout(() => ok.style.display = "none", 3000); }
  const top = document.getElementById("fichaDiagnosticaMsgTop");
  if (top) { top.style.display = "block"; setTimeout(() => top.style.display = "none", 3000); }
}
async function cargarFichaDiagnostica() {
  const form = getFichaForm();
  if (!form) return;
  try {
    const data = await apiFetch("/postgres/ficha-diagnostica");
    if (data.completada && data.datos) {
      // Recrear filas de herman@s dinámicos guardados (fam_hermano_N_*) antes de rellenar
      try {
        const nums = Object.keys(data.datos).filter(k => /^fam_hermano_\d+_nombre$/.test(k)).map(k => Number(k.match(/^fam_hermano_(\d+)_nombre$/)[1])).filter(n => n > 1);
        const maxN = nums.length ? Math.max(...nums) : 1;
        while (_totalHermanos < maxN) agregarHermano();
      } catch (_) {}
      Object.entries(data.datos).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        form.querySelectorAll(`[name="${CSS.escape(k)}"]`).forEach(el => {
          if (el.type === "radio" || el.type === "checkbox") {
            if (el.value === String(v)) el.checked = true;
          } else el.value = v;
        });
      });
      // Sincronizar contador visual
      try {
        const n = Object.keys(data.datos).filter(k => /^fam_hermano_\d+_nombre$/.test(k) && data.datos[k]).length || 1;
        _totalHermanos = Math.max(_totalHermanos, n);
        actualizarContadorHermanos();
      } catch (_) {}
    }
  } catch (_) {}
}

async function guardarFichaDiagnostica() {
  const datos = recogerDatosFicha();
  if (!datos) return;
  if (!datos.apellidos) {
    const msg = document.getElementById("fichaDiagnosticaMsg");
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Escribe al menos tus Apellidos y Nombres"; }
    return;
  }
  const msg = document.getElementById("fichaDiagnosticaMsg");
  if (msg) { msg.style.color = "#6b7280"; msg.textContent = "Guardando tu ficha..."; }
  try {
    await apiFetch("/postgres/ficha-diagnostica", { method: "POST", body: { datos } });
    mostrarExitoFicha();
    if (msg) { msg.style.color = "#059669"; msg.textContent = "Ficha guardada. ¡Bienvenido!"; }
    if (window.mostrarToastGlobal) mostrarToastGlobal("Ficha guardada", "ok");
    setTimeout(() => {
      const m = document.getElementById("modalPerfilObligatorio");
      if (m) m.style.display = "none";
      document.body.style.overflow = "";
      const btn = document.getElementById("btnResponderCuestionario");
      if (btn) { btn.disabled = false; btn.title = ""; btn.classList.remove("oculto"); }
      if (typeof verificarPerfilObligatorio === "function") verificarPerfilObligatorio();
      if (typeof cargarFormularioEstudiante === "function") cargarFormularioEstudiante();
    }, 700);
  } catch (e) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Error: " + e.message; }
  }
}

// ── Descarga Word COMPLETA (11 secciones, preguntas + respuestas) ──
// Genera un .doc compatible con Word con los colores del sistema SAT.
// No depende del backend: garantiza que salga TODO el cuestionario.
function escaparHtmlWord(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Claves de respuesta en texto libre (cajas amplias en vista y Word)
const FICHA_TEXTO_KEYS = ["enfermedad", "por_que_no", "cuales_productos", "problemas_comparten", "carrera_profesional", "valores_importantes", "area_gusta", "area_nogusta", "habitaciones", "estudiante_pagan", "otra_actividad", "deportes_practicas", "papa_donde", "papa_que", "mama_donde", "mama_que", "estudiante_lugar", "estudiante_ocupacion", "estudiante_horario"];
const FICHA_CHECK_PREFIX = ["vives_", "prob_", "apoya_", "prioridad_", "gasto_", "vivienda_", "servicio_", "tiene_", "consume_", "propina_", "actividad_", "dificultad_"];
const FICHA_CHECK_EXACT = ["papa_permanente", "papa_eventual", "papa_comerciante", "papa_chacra", "mama_permanente", "mama_eventual", "mama_comerciante", "mama_chacra"];
function fichaEsCheck(key) {
  return FICHA_CHECK_EXACT.includes(key) || FICHA_CHECK_PREFIX.some(p => key.startsWith(p));
}
// Parte "pregunta?: opción" de las etiquetas de checks
function fichaSplitLabel(label) {
  const i = label.lastIndexOf(":");
  if (i > 4) return [label.slice(0, i).trim(), label.slice(i + 1).trim()];
  return [label, ""];
}
// Mismo formato del cuestionario que llena el alumno, en documento Word formal:
// encabezado institucional, 11 secciones, tabla familiar, cuadritos ☑/☐ y
// cajas amplias para que la información completa se vea.
function construirHtmlWordFicha(datos, nombreArchivo) {
  const d = datos || {};
  const E = escaparHtmlWord;
  const nombre = E(d.apellidos || d.apellidosNombres || "Estudiante");
  const fecha = new Date().toLocaleDateString("es-PE");
  const TD = "border:1px solid #8a8a8a; padding:7px 9px; font-size:11pt; vertical-align:top;";
  const TDV = TD + "font-weight:bold; color:#1a3a5c;";
  const TDBIG = "border:1px solid #8a8a8a; padding:10px 12px; font-size:12pt; font-weight:bold; color:#1a3a5c; min-height:32pt;";
  const TH = "border:1px solid #1a3a5c; background:#1a3a5c; color:#ffffff; padding:8px 9px; font-size:10pt; text-align:left;";
  const QL = "font-size:11pt; font-weight:bold; color:#2c3e50; margin:12px 0 6px;";
  const valRaw = key => {
    let v = valorRespuesta(d, key);
    if (v === null || v === undefined || v === "") return "";
    if (Array.isArray(v)) v = v.join(", ");
    return String(v);
  };
  const respSiNo = v => v === "Si"
    ? `<span style="font-size:13pt;">☑</span> <b>Sí</b> &nbsp;&nbsp; <span style="font-size:13pt;">☐</span> No`
    : v === "No"
      ? `<span style="font-size:13pt;">☐</span> Sí &nbsp;&nbsp; <span style="font-size:13pt;">☑</span> <b>No</b>`
      : `<span style="color:#999;">—</span>`;
  const secTit = sec => `<h2 style="font-size:14pt; color:#1a3a5c; border-bottom:2px solid #1a3a5c; padding-bottom:4px; margin:22px 0 12px; text-transform:uppercase;">${E(sec)}</h2>`;
  let H = "";
  for (const [sec, items] of FICHA_CUESTIONARIO) {
    H += secTit(sec);
    if (sec.startsWith("1.")) {
      // Datos generales: tabla etiqueta / valor amplio
      H += `<table style="border-collapse:collapse; width:100%;"><tbody>` + items.map(([k, label]) => {
        const v = valRaw(k) || "—";
        return `<tr><td style="${TD}width:38%;">${E(label)}</td><td style="${TDV}">${E(v)}</td></tr>`;
      }).join("") + `</tbody></table>`;
    } else if (sec.startsWith("2.")) {
      // Tabla familiar idéntica a la original
      const famRow = (t, p) => `<tr><td style="${TD}"><b>${t}</b></td>` + ["nombre", "edad", "instruccion", "ocupacion", "celular", "viven"].map(c => `<td style="${TDV}font-size:10pt;">${E(valRaw(`fam_${p}_${c}`) || "—")}</td>`).join("") + `</tr>`;
      let rows = famRow("Padre", "padre") + famRow("Madre", "madre") + famRow("Herman@", "hermano_1");
      Object.keys(d).filter(k => /^fam_hermano_\d+_nombre$/.test(k)).map(k => k.match(/^fam_hermano_(\d+)_nombre$/)[1]).filter(n => n !== "1").forEach(n => {
        if (!d[`fam_hermano_${n}_nombre`]) return;
        rows += famRow("Herman@", `hermano_${n}`);
      });
      H += `<p style="${QL}">Datos de los miembros de la familia</p><table style="border-collapse:collapse; width:100%;"><thead><tr>${["Parentesco", "Apellidos y Nombres", "Edad", "Grado de Instrucción", "Ocupación", "Celular", "¿Viven? (SI/NO)"].map(h => `<th style="${TH}">${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
      H += restoBloques(items.filter(([k]) => !k.startsWith("fam_padre_") && !k.startsWith("fam_madre_") && !/^fam_hermano_1_/.test(k)));
    } else if (/^[789]\./.test(sec)) {
      // Tablas 7/8/9 como las originales, con cuadritos en Sí/No
      H += `<table style="border-collapse:collapse; width:100%;"><tbody>` + items.map(([k, label]) => {
        const v = valRaw(k);
        const ans = (v === "Si" || v === "No") ? respSiNo(v) : (v ? `<b style="color:#1a3a5c;">${E(v)}</b>` : `<span style="color:#999;">—</span>`);
        return `<tr><td style="${TD}font-weight:bold; width:62%;">${E(label)}</td><td style="${TD}">${ans}</td></tr>`;
      }).join("") + `</tbody></table>`;
    } else {
      H += restoBloques(items);
    }
  }
  function restoBloques(items) {
    let out = "", grupoQ = null, grupoOpts = [];
    const flush = () => {
      if (!grupoQ) return;
      // Rellena la última fila a 3 columnas
      const filas = [];
      for (let i = 0; i < grupoOpts.length; i += 3) {
        let r = grupoOpts.slice(i, i + 3).map(([opt, on]) => `<td style="${TD}width:33%;"><span style="font-size:13pt;">${on ? "☑" : "☐"}</span> ${E(opt)}</td>`).join("");
        const faltan = 3 - grupoOpts.slice(i, i + 3).length;
        if (faltan) r += `<td style="${TD}" colspan="${faltan}"></td>`;
        filas.push(`<tr>${r}</tr>`);
      }
      out += `<p style="${QL}">${E(grupoQ)}</p><table style="border-collapse:collapse; width:100%;"><tbody>${filas.join("")}</tbody></table>`;
      grupoQ = null; grupoOpts = [];
    };
    for (const [k, label] of items) {
      if (fichaEsCheck(k)) {
        const [q, opt] = fichaSplitLabel(label);
        if (grupoQ !== q) flush();
        grupoQ = q;
        grupoOpts.push([opt || label, valRaw(k) === "Si"]);
      } else {
        flush();
        const v = valRaw(k);
        if (FICHA_TEXTO_KEYS.includes(k)) {
          out += `<p style="${QL}">${E(label)}</p><table style="border-collapse:collapse; width:100%;"><tbody><tr><td style="${TDBIG}">${E(v || "—")}</td></tr></tbody></table>`;
        } else if (v === "Si" || v === "No") {
          out += `<table style="border-collapse:collapse; width:100%; margin-bottom:8px;"><tbody><tr><td style="${TD}font-weight:bold; width:62%;">${E(label)}</td><td style="${TD}">${respSiNo(v)}</td></tr></tbody></table>`;
        } else {
          out += `<table style="border-collapse:collapse; width:100%; margin-bottom:8px;"><tbody><tr><td style="${TD}width:38%;">${E(label)}</td><td style="${TDV}">${E(v || "—")}</td></tr></tbody></table>`;
        }
      }
    }
    flush();
    return out;
  }
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Ficha Diagnóstica Socioeducativa</title></head><body style="font-family:Arial,sans-serif; color:#222;">
    <div style="background:#1a3a5c; color:#ffffff; padding:22px 18px; text-align:center;">
      <h1 style="margin:0; font-size:20pt;">FICHA DIAGNÓSTICA SOCIOEDUCATIVA</h1>
      <p style="margin:6px 0 0; font-size:11pt;">Completa todos los campos con información veraz y detallada</p>
    </div>
    <p style="font-size:12pt; margin:14px 0 4px;"><strong>Estudiante:</strong> ${nombre}</p>
    <p style="font-size:10pt; color:#555; margin:0 0 6px;">SAT Escolar · Sistema de Alerta Temprana · Generada el ${fecha}</p>
    ${H}
    <p style="font-size:9pt; color:#666; margin-top:20px; border-top:1px solid #999; padding-top:8px;">Documento generado por SAT Escolar · Confidencial · Solo uso psicopedagógico.</p>
  </body></html>`;
}
function descargarWordLocal(datos, nombreBase) {
  const html = construirHtmlWordFicha(datos, nombreBase);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (nombreBase || "Ficha_Diagnostica_Socioeducativa") + ".doc";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function descargarDocx() {
  const datos = recogerDatosFicha();
  if (!datos) return;
  const msg = document.getElementById("fichaDiagnosticaMsg");
  if (msg) { msg.style.color = "#6b7280"; msg.textContent = "Generando Word..."; }
  try {
    // 1) Intento backend (plantilla oficial del psicólogo)
    const user = (typeof getUser === "function") ? getUser() : {};
    const sid = user.studentId || user.id || 0;
    try {
      const res = await fetch((typeof API !== "undefined" ? API : "/api") + `/postgres/ficha-diagnostica/${sid}/docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("sat_token") },
        body: JSON.stringify({ datos })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Ficha_Diagnostica_Socioeducativa_plantilla.docx";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (_) { /* sigue al completo local */ }
    // 2) Siempre generar el Word COMPLETO (11 secciones) en local
    descargarWordLocal(datos, "Ficha_Diagnostica_Socioeducativa_COMPLETA");
    if (msg) { msg.style.color = "#059669"; msg.textContent = "Word descargado (cuestionario completo)"; }
  } catch (e) {
    if (msg) { msg.style.color = "#b91c1c"; msg.textContent = "Error: " + e.message; }
  }
}

function abrirMiFicha() {
  const m = document.getElementById("modalPerfilObligatorio");
  if (m) { m.style.display = "flex"; cargarFichaDiagnostica(); }
}

let _totalHermanos = 1;
function actualizarContadorHermanos() {
  const c = document.getElementById("contador_hermanos");
  if (c) c.textContent = _totalHermanos === 1 ? "1 herman@ registrado" : _totalHermanos + " herman@s registrados";
}
function agregarHermano() {
  _totalHermanos++;
  const n = _totalHermanos;
  const fila = document.querySelector("#hermano_1")?.closest("tbody");
  if (!fila) return;
  const tr = document.createElement("tr");
  tr.id = "hermano_" + n;
  tr.innerHTML = `<td><strong>Herman@</strong></td>
    <td><input type="text" name="fam_hermano_${n}_nombre" style="width:100%;padding:8px;border:1px solid #bdc3c7;border-radius:3px;font-size:13px;"></td>
    <td><input type="text" name="fam_hermano_${n}_edad" style="width:100%;max-width:80px;padding:8px;border:1px solid #bdc3c7;border-radius:3px;font-size:13px;"></td>
    <td><input type="text" name="fam_hermano_${n}_instruccion" style="width:100%;padding:8px;border:1px solid #bdc3c7;border-radius:3px;font-size:13px;"></td>
    <td><input type="text" name="fam_hermano_${n}_ocupacion" style="width:100%;padding:8px;border:1px solid #bdc3c7;border-radius:3px;font-size:13px;"></td>
    <td><input type="tel" name="fam_hermano_${n}_celular" style="width:100%;padding:8px;border:1px solid #bdc3c7;border-radius:3px;font-size:13px;"></td>
    <td><input type="text" name="fam_hermano_${n}_viven" style="width:100%;padding:8px;border:1px solid #bdc3c7;border-radius:3px;font-size:13px;"></td>`;
  tr.style.animation = "fichaFadeIn 0.3s ease";
  fila.appendChild(tr);
  actualizarContadorHermanos();
}
function quitarUltimoHermano() {
  if (_totalHermanos <= 1) return;
  document.getElementById("hermano_" + _totalHermanos)?.remove();
  _totalHermanos--;
  actualizarContadorHermanos();
}

function actualizarContador() { actualizarContadorHermanos(); }
// Submit del formulario dentro del modal (id original fichaForm)
document.addEventListener("submit", function (e) {
  if (e.target && (e.target.id === "fichaForm" || e.target.id === "fichaDiagnosticaForm")) {
    e.preventDefault();
    guardarFichaDiagnostica();
  }
});

// Vista de solo lectura para el psicólogo — cuestionario COMPLETO (preguntas + respuestas)
const FICHA_CUESTIONARIO = [
  ["1. Datos Generales", [
    ["apellidos", "Apellidos y Nombres"], ["edad", "Edad"], ["grado", "Grado"], ["seccion", "Sección"],
    ["email", "Correo Electrónico"], ["residencia", "Lugar de Residencia"], ["sexo", "Sexo"], ["celular", "Celular"],
    ["fechanac", "Fecha de Nacimiento"], ["lugarnac", "Lugar de Nacimiento"], ["domicilio", "Domicilio"], ["distrito", "Distrito"],
    ["emergencia", "En una Emergencia Acudir a:"], ["telefono", "Teléfono Fijo"]
  ]],
  ["2. Aspecto Familiar", [
    ["fam_padre_nombre", "Padre — Apellidos y Nombres"], ["fam_padre_edad", "Padre — Edad"], ["fam_padre_instruccion", "Padre — Grado de Instrucción"], ["fam_padre_ocupacion", "Padre — Ocupación"], ["fam_padre_celular", "Padre — Celular"], ["fam_padre_viven", "Padre — ¿Viven?"],
    ["fam_madre_nombre", "Madre — Apellidos y Nombres"], ["fam_madre_edad", "Madre — Edad"], ["fam_madre_instruccion", "Madre — Grado de Instrucción"], ["fam_madre_ocupacion", "Madre — Ocupación"], ["fam_madre_celular", "Madre — Celular"], ["fam_madre_viven", "Madre — ¿Viven?"],
    ["vives_ambospadres", "2.2. ¿Con quién vives?: Ambos Padres"], ["vives_solomadre", "2.2. ¿Con quién vives?: Solo Madre"], ["vives_solopadre", "2.2. ¿Con quién vives?: Solo Padre"], ["vives_soloabuelos", "2.2. ¿Con quién vives?: Solo Abuelos"], ["vives_hermanos", "2.2. ¿Con quién vives?: Hermanos"], ["vives_madrastra", "2.2. ¿Con quién vives?: Madre y Padrastro"], ["vives_padrastra", "2.2. ¿Con quién vives?: Padre y Madrastra"], ["vives_tios", "2.2. ¿Con quién vives?: Tíos y Abuela"], ["vives_otros", "2.2. ¿Con quién vives?: Otros"],
    ["relaciones_familiares", "2.3. Las relaciones familiares en tu hogar son:"],
    ["prob_violencia", "2.4. ¿Qué problemas presenta el hogar?: Violencia Familiar"], ["prob_comunicacion", "2.4. ¿Qué problemas presenta el hogar?: Escasa Comunicación"], ["prob_economicos", "2.4. ¿Qué problemas presenta el hogar?: Problemas Económicos"], ["prob_salud", "2.4. ¿Qué problemas presenta el hogar?: Problemas de Salud"], ["prob_otros", "2.4. ¿Qué problemas presenta el hogar?: Otros"],
    ["dificultad_comunicacion", "2.5. Generalmente la dificultad de comunicarte con tu familia es por:"],
    ["apoya_mama", "2.6. Cuando haces tus tareas ¿Quién te apoya?: Mamá"], ["apoya_papa", "2.6. Cuando haces tus tareas ¿Quién te apoya?: Papá"], ["apoya_hermanos", "2.6. Cuando haces tus tareas ¿Quién te apoya?: Hermanos"], ["apoya_abuelos", "2.6. Cuando haces tus tareas ¿Quién te apoya?: Abuelos"], ["apoya_solo", "2.6. Cuando haces tus tareas ¿Quién te apoya?: Hago Solo mi Tarea"], ["apoya_prof", "2.6. Cuando haces tus tareas ¿Quién te apoya?: Profesor Particular"], ["apoya_nadie", "2.6. Cuando haces tus tareas ¿Quién te apoya?: No Tengo a Nadie"], ["apoya_tios", "2.6. Cuando haces tus tareas ¿Quién te apoya?: Tíos"]
  ]],
  ["3. Aspecto Laboral y Económico", [
    ["papa_trabaja", "3.1. ¿Tu papá trabaja?"], ["papa_permanente", "3.1. Papá: Trabajo Permanente"], ["papa_eventual", "3.1. Papá: Trabajo Eventual"], ["papa_comerciante", "3.1. Papá: Comerciante"], ["papa_chacra", "3.1. Papá: Trabaja en Chacra"], ["papa_donde", "¿Dónde trabaja tu papá?"], ["papa_que", "¿En qué trabaja tu papá?"],
    ["mama_trabaja", "3.2. ¿Tu mamá trabaja?"], ["mama_permanente", "3.2. Mamá: Trabajo Permanente"], ["mama_eventual", "3.2. Mamá: Trabajo Eventual"], ["mama_comerciante", "3.2. Mamá: Comerciante"], ["mama_chacra", "3.2. Mamá: Trabaja en Chacra"], ["mama_donde", "¿Dónde trabaja tu mamá?"], ["mama_que", "¿En qué trabaja tu mamá?"],
    ["ingreso_familiar", "3.3. ¿Cuánto es el ingreso familiar mensual?"],
    ["prioridad_alimentos", "3.4. ¿En qué priorizan sus ingresos tus padres?: Alimentos"], ["prioridad_educacion", "3.4. ¿En qué priorizan sus ingresos tus padres?: Educación"], ["prioridad_vestimenta", "3.4. ¿En qué priorizan sus ingresos tus padres?: Vestimenta"], ["prioridad_artefactos", "3.4. ¿En qué priorizan sus ingresos tus padres?: Artefactos"], ["prioridad_telecable", "3.4. ¿En qué priorizan sus ingresos tus padres?: Telecable"], ["prioridad_otros", "3.4. ¿En qué priorizan sus ingresos tus padres?: Otros"],
    ["estudiante_trabaja", "3.5. Condición del estudiante. ¿Trabajas?"], ["estudiante_lugar", "Lugar de trabajo"], ["estudiante_ocupacion", "Ocupación"], ["estudiante_horario", "Horario"], ["estudiante_pagan", "¿Cuánto te pagan?"],
    ["gasto_padres", "3.6. ¿En qué gastas lo que te pagan?: Le Doy a Mis Padres"], ["gasto_ropa", "3.6. ¿En qué gastas lo que te pagan?: Compro Mi Ropa"], ["gasto_diarios", "3.6. ¿En qué gastas lo que te pagan?: Gastos Diarios"], ["gasto_internet", "3.6. ¿En qué gastas lo que te pagan?: Para Internet"], ["gasto_recreacion", "3.6. ¿En qué gastas lo que te pagan?: Diversión y Recreación"], ["gasto_otros", "3.6. ¿En qué gastas lo que te pagan?: Otros"]
  ]],
  ["4. Aspecto Vivienda", [
    ["vivienda_tipo", "4.1. Tu vivienda es:"], ["material_vivienda", "4.2. Tu vivienda es de material:"], ["piso_tipo", "4.3. El piso de tu casa es de:"],
    ["habitaciones", "4.4. Número de habitaciones:"],
    ["vivienda_cocina", "4.5. Tu vivienda cuenta con: Cocina"], ["vivienda_dormitorio", "4.5. Tu vivienda cuenta con: Dormitorio(s)"], ["vivienda_comedor", "4.5. Tu vivienda cuenta con: Comedor"], ["vivienda_sshh", "4.5. Tu vivienda cuenta con: SSHH"], ["vivienda_biblioteca", "4.5. Tu vivienda cuenta con: Biblioteca"], ["vivienda_patio", "4.5. Tu vivienda cuenta con: Patio"], ["vivienda_sala", "4.5. Tu vivienda cuenta con: Sala"], ["vivienda_jardines", "4.5. Tu vivienda cuenta con: Jardines"], ["vivienda_uncuarto", "4.5. Tu vivienda cuenta con: Solo Un Cuarto"], ["vivienda_letrina", "4.5. Tu vivienda cuenta con: Letrina"],
    ["servicio_agua", "4.6. Tu casa tiene servicio de: Agua"], ["servicio_luz", "4.6. Tu casa tiene servicio de: Luz"], ["servicio_desague", "4.6. Tu casa tiene servicio de: Desagüe"], ["servicio_telecable", "4.6. Tu casa tiene servicio de: Telecable"], ["servicio_internet", "4.6. Tu casa tiene servicio de: Internet"],
    ["tiene_computadora", "4.7. En tu casa tienes: Computadora"], ["tiene_television", "4.7. En tu casa tienes: Televisión"], ["tiene_refrigeradora", "4.7. En tu casa tienes: Refrigeradora"], ["tiene_lavadora", "4.7. En tu casa tienes: Lavadora"], ["tiene_cable", "4.7. En tu casa tienes: Cable"], ["tiene_cocina", "4.7. En tu casa tienes: Cocina"],
    ["distancia_ie", "4.8. ¿A qué distancia se encuentra la IE desde tu casa?"], ["transporte_ie", "4.9. ¿Cómo te trasladas de tu casa al colegio?"]
  ]],
  ["5. Aspecto de Salud", [
    ["dificultad_vision", "5.1. Presenta dificultades físicas en la: Visión"], ["dificultad_auditiva", "5.1. Presenta dificultades físicas en la: Auditiva"], ["dificultad_fisica", "5.1. Presenta dificultades físicas en la: Físico"], ["dificultad_cardiaca", "5.1. Presenta dificultades físicas en la: Cardíaca"],
    ["asegurado_en", "5.2. Estás asegurado en:"], ["enfermedad", "5.3. ¿Sufres de alguna enfermedad que requiere tratamiento? Menciónalo:"]
  ]],
  ["6. Aspecto de Alimentación", [
    ["consume_desayuno", "6.1. Consumes al día: Desayuno"], ["consume_refrigerio", "6.1. Consumes al día: Refrigerio"], ["consume_almuerzo", "6.1. Consumes al día: Almuerzo"], ["consume_cena", "6.1. Consumes al día: Cena"],
    ["vaacolegio", "6.2. Al colegio vas:"],
    ["propina_golosinas", "6.3. Prefieres gastar tu propina en: Golosinas"], ["propina_gaseosa", "6.3. Prefieres gastar tu propina en: Gaseosa"], ["propina_frutas", "6.3. Prefieres gastar tu propina en: Frutas"], ["propina_comida", "6.3. Prefieres gastar tu propina en: Comida Preparada"], ["propina_otros", "6.3. Prefieres gastar tu propina en: Otros"],
    ["productos_localidad", "6.4. ¿Consumes productos de la localidad o la región?"], ["cuales_productos", "¿Cuáles?"], ["por_que_no", "Si es NO, diga porqué:"]
  ]],
  ["7. Aspecto Académico", [
    ["repitente", "7.1. ¿Eres repitente?"], ["horario_estudio", "7.2. ¿Has elaborado tu horario de estudio en casa?"], ["cumples_tareas", "7.3. ¿Cumples tus tareas?"],
    ["ambiente_estudio", "7.4. ¿Tienes un ambiente adecuado en casa para el estudio?"], ["esquema_temas", "7.5. ¿Elaboras esquema organizado de temas estudiados?"], ["distrae_facilidad", "7.6. ¿Te distraes con facilidad?"],
    ["nervioso_examen", "7.7. ¿Te pones nervioso al dar examen?"], ["olvidas_facilidad", "7.8. ¿Te olvidas fácilmente de lo que estudias?"],
    ["miedo_expresarse", "7.9. ¿Tienes miedo a expresarte frente a compañeros?"], ["exponer_trabajos", "7.10. ¿Te gusta salir a exponer tus trabajos?"],
    ["comprendes_lees", "7.11. ¿Comprendes lo que lees?"], ["comprendes_escuchas", "7.12. ¿Comprendes cuando escuchas en clase?"],
    ["temor_preguntar", "7.13. ¿Tienes temor de preguntar dudas al profesor?"], ["confianza_profesores", "7.14. ¿Tienes confianza en tus profesores?"],
    ["area_gusta", "7.15. ¿Cuál es el área que más te gusta?"], ["area_nogusta", "7.16. ¿Cuál es el área que menos te gusta?"]
  ]],
  ["8. Aspecto Emocional", [
    ["eres_nervioso", "8.1. ¿Eres nervioso?"], ["eres_timido", "8.2. ¿Eres tímido?"], ["nadie_te_quiere", "8.3. ¿Sientes que nadie te quiere?"],
    ["mas_amigos", "8.4. ¿Tienes más de un amigo o amiga?"], ["llaman_atencion", "8.5. ¿Te llaman la atención por interrumpir clases?"], ["obedeces_instrucciones", "8.6. ¿Obedeces instrucciones/indicaciones?"],
    ["alteras_facilidad", "8.7. ¿Te alteras con facilidad?"], ["fallecido_recientemente", "8.8. ¿Tienes familiar que haya fallecido recientemente?"]
  ]],
  ["9. Aspecto Social", [
    ["evasion_colegio", "9.1. ¿Te evasdes del colegio cuando no te gusta la clase?"], ["control_emociones", "9.2. ¿Pierdes control emocional cuando te agreden?"],
    ["estimulante_curiosidad", "9.3. ¿Consumiste algún estimulante por curiosidad?"], ["licor_invitan", "9.4. Si te invitan una copa de licor ¿tomas?"],
    ["das_iniciativas", "9.5. ¿Das iniciativas y compartes conocimientos?"], ["dirigir_trabajo", "9.6. ¿Te gusta dirigir el trabajo en equipo?"],
    ["internet_juegos", "9.7. ¿Te gusta internet porque entras a juegos?"], ["internet_estudio", "9.8. ¿Te gusta internet para bajar info de estudio?"]
  ]],
  ["10. Aspecto Personal", [
    ["afecto_compañeros", "10.1. ¿Tus compañeros te brindan afecto y comprensión?"], ["pensado_irte", "10.2. ¿Has pensado en irte de casa?"],
    ["pensamiento_suicida", "10.3. ¿En algún momento pensaste en quitarte la vida?"], ["mejor_que_padres", "10.4. ¿Te gustaría ser mejor que tus padres?"],
    ["cuidar_aspecto", "10.5. ¿Te interesa cuidar tu aspecto personal?"], ["problemas_comparten", "10.6. Cuando tienes problemas los compartes con:"],
    ["carrera_profesional", "10.7. ¿Qué carrera profesional te gustaría estudiar?"], ["valores_importantes", "10.8. ¿Qué valores son más importantes para ti?"]
  ]],
  ["11. Tus Habilidades", [
    ["deportes_practicas", "11.1. ¿Qué deportes practicas?"],
    ["actividad_canto", "11.2. ¿En qué actividades participas?: Canto"], ["actividad_declamacion", "11.2. ¿En qué actividades participas?: Declamación"], ["actividad_teatro", "11.2. ¿En qué actividades participas?: Teatro"],
    ["actividad_danza", "11.2. ¿En qué actividades participas?: Danza"], ["actividad_pintura", "11.2. ¿En qué actividades participas?: Pintura"], ["actividad_otro", "11.2. ¿En qué actividades participas?: Otro"],
    ["otra_actividad", "Indique otra actividad:"]
  ]]
];
let _fichaVistaDatos = null;
let _fichaVistaEstudiante = null;
function valorRespuesta(d, key) {
  // Acepta alias normalizados y dinámicos (hermanos extra fam_hermano_N_*)
  if (d[key] !== undefined && d[key] !== null && d[key] !== "") return d[key];
  const alias = {
    apellidosNombres: ["apellidos"], correo: ["email"], lugarResidencia: ["residencia"],
    fechaNacimiento: ["fechanac"], lugarNacimiento: ["lugarnac"], emergenciaAcudir: ["emergencia"],
    telefonoFijo: ["telefono"], conQuienVives: [], situacion_convivencia: ["relaciones_familiares"]
  };
  for (const a of (alias[key] || [])) {
    if (d[a] !== undefined && d[a] !== null && d[a] !== "") return d[a];
  }
  return null;
}
async function verFichaSocioeducativa(estudianteId) {
  const modal = document.getElementById("modalFichaVista");
  const body = document.getElementById("fichaVistaBody");
  const titulo = document.getElementById("fichaVistaTitulo");
  if (!modal || !body) return;
  if (titulo) titulo.textContent = "Ficha Socioeducativa — cargando...";
  body.innerHTML = '<p style="color:#6b7280; font-size:13px;">Cargando ficha...</p>';
  modal.classList.remove("oculto");
  try {
    const data = await apiFetch(`/postgres/ficha-diagnostica/${estudianteId}`);
    if (!data.completada || !data.datos) {
      if (titulo) titulo.textContent = "Ficha Socioeducativa";
      _fichaVistaDatos = null; _fichaVistaEstudiante = null;
      body.innerHTML = '<div style="background:#f9fafb; border:1px dashed #d1d5db; border-radius:10px; padding:18px; text-align:center; color:#6b7280; font-size:13px;">El estudiante aún no completa su ficha socioeducativa.</div>';
      return;
    }
    const d = data.datos;
    _fichaVistaDatos = d; _fichaVistaEstudiante = estudianteId;
    if (titulo) titulo.textContent = `Ficha Socioeducativa — ${(d.apellidos || d.apellidosNombres || "")}`;
    // Hermanos dinámicos extra
    const extras = Object.keys(d).filter(k => /^fam_hermano_\d+_nombre$/.test(k)).map(k => k.match(/^fam_hermano_(\d+)_nombre$/)[1]).filter(n => n !== "1");
    const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const val = key => {
      let v = valorRespuesta(d, key);
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return "—";
      if (Array.isArray(v)) v = v.join(", ");
      return String(v);
    };
    const valColor = v => v === "—" ? "#9ca3af" : "#1a3a5c";
    // Espejo del formulario del alumno, 100% solo lectura (sin inputs)
    const RADIO_OPTS = {
      relaciones_familiares: ["Armoniosas", "Regularmente Armoniosas", "Conflictivas", "Violentas"],
      dificultad_comunicacion: ["Falta de Tiempo", "Desinterés", "Temor", "No Hay Dificultad"],
      asegurado_en: ["ESSALUD", "SIS", "No estoy asegurado", "Otros"],
      ingreso_familiar: ["Menos de 200", "De 200 a 400", "De 400 a 700", "De 700 a Más"],
      distancia_ie: ["Menos de 1 km", "2 km", "3 km", "4 km", "Más de 5 km"],
      transporte_ie: ["Caminando", "Bicicleta", "Moto Lineal", "Mototaxi", "Carro"],
      vaacolegio: ["Habiendo tomado desayuno", "Sin tomar desayuno", "Con dinero para comprar", "Llevando desayuno"]
    };
    const mini = (txt, on) => `<span style="display:inline-flex; align-items:center; gap:6px; border:1px solid ${on ? "#1a3a5c" : "#e3e8ef"}; background:${on ? "#eef4fb" : "#fbfcfe"}; color:${on ? "#1a3a5c" : "#6b7280"}; font-weight:${on ? "700" : "500"}; font-size:12px; border-radius:6px; padding:5px 9px;">${on ? "☑" : "☐"} ${esc(txt)}</span>`;
    const optBox = (txt, on) => `<div style="border:1px solid ${on ? "#1a3a5c" : "#e3e8ef"}; background:${on ? "#eef4fb" : "#fbfcfe"}; padding:6px 8px; border-radius:6px; display:flex; align-items:center; gap:7px; font-size:12px; color:${on ? "#1a3a5c" : "#374151"}; font-weight:${on ? "700" : "500"};"><span>${on ? "☑" : "☐"}</span><span>${esc(txt)}</span></div>`;
    const qlab = t => `<div style="font-weight:700; color:#2c3e50; margin:14px 0 8px; font-size:13px;">${esc(t)}</div>`;
    const optGrid = (q, opts) => qlab(q) + `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">${opts.map(([t, on]) => optBox(t, on)).join("")}</div>`;
    const radioRow = (q, opts) => qlab(q) + `<div style="display:flex; gap:8px; flex-wrap:wrap;">${opts.map(([t, on]) => mini(t, on)).join("")}</div>`;
    const parSiNo = v => [["Sí", v === "Si"], ["No", v === "No"]];
    const bigBox = (label, v) => `<div style="margin-bottom:12px;"><div style="font-weight:600; color:#2c3e50; margin-bottom:6px; font-size:13px;">${esc(label)}</div><div style="padding:12px 14px; border:1px solid #bdc3c7; border-radius:5px; font-size:14px; background:#f8f9ff; color:${valColor(v)}; font-weight:600; min-height:52px;">${esc(v)}</div></div>`;
    // Mismo formato del cuestionario original, solo lectura (sin inputs editables)
    let html = `<div style="background:linear-gradient(135deg,#1e4976 0%,#1a3a5c 100%); color:white; padding:24px 16px; text-align:center; border-radius:10px; margin-bottom:8px;">
      <div style="font-size:17px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; color:#ffffff;">Ficha Diagnóstica Socioeducativa</div>
      <div style="font-size:12px; opacity:.9; margin-top:6px;">${esc(d.apellidos || d.apellidosNombres || "")} · Completada el ${esc(String(data.ficha?.updated_at || "").slice(0, 10))} · Solo lectura</div>
    </div>`;
    const secTitle = sec => {
      const num = (sec.match(/^(\d+)/) || [])[1] || "";
      const name = sec.replace(/^\d+\.\s*/, "");
      return `<div style="font-size:15px; font-weight:bold; color:#1a3a5c; margin-bottom:15px; text-transform:uppercase; border-left:5px solid #1a3a5c; padding-left:12px;"><span style="display:inline-block; background:#1a3a5c; color:white; width:26px; height:26px; border-radius:50%; text-align:center; line-height:26px; font-weight:bold; margin-right:8px; font-size:12px;">${num}</span>${esc(name)}</div>`;
    };
    // Bloques de opciones/radios/textos iguales a los del formulario
    function restoVista(items) {
      let out = "", gq = null, gopts = [];
      const flush = () => {
        if (!gq) return;
        out += optGrid(gq, gopts);
        gq = null; gopts = [];
      };
      for (const [k, label] of items) {
        if (fichaEsCheck(k)) {
          const [q, opt] = fichaSplitLabel(label);
          if (gq !== q) flush();
          gq = q;
          gopts.push([opt || label, val(k) === "Si"]);
        } else {
          flush();
          const v = val(k);
          if (FICHA_TEXTO_KEYS.includes(k)) out += bigBox(label, v);
          else if (RADIO_OPTS[k]) out += radioRow(label, RADIO_OPTS[k].map(o => [o, v === o]));
          else if (v === "Si" || v === "No") out += radioRow(label, parSiNo(v));
          else out += bigBox(label, v);
        }
      }
      flush();
      return out;
    }
    for (const [sec, items] of FICHA_CUESTIONARIO) {
      let inner = "";
      if (sec.startsWith("1.")) {
        // Datos generales: cuadrícula con cajas amplias
        inner = `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px;">` + items.map(([k, label]) => bigBox(label, val(k))).join("") + `</div>`;
      } else if (sec.startsWith("2.")) {
        // Tabla familiar idéntica a la original
        const famCell = v => `<td style="padding:10px 12px; border-bottom:1px solid #ecf0f1; font-size:12px; color:${valColor(v)}; font-weight:600;">${esc(v)}</td>`;
        const famRow = (t, p) => `<tr><td style="padding:10px 12px; border-bottom:1px solid #ecf0f1;"><strong>${t}</strong></td>${["nombre", "edad", "instruccion", "ocupacion", "celular", "viven"].map(c => famCell(val(`fam_${p}_${c}`))).join("")}</tr>`;
        let famRows = famRow("Padre", "padre") + famRow("Madre", "madre") + famRow("Herman@", "hermano_1");
        for (const n of extras) {
          const nom = d[`fam_hermano_${n}_nombre`];
          if (!nom) continue;
          famRows += `<tr><td style="padding:10px 12px; border-bottom:1px solid #ecf0f1;"><strong>Herman@</strong></td>${["nombre", "edad", "instruccion", "ocupacion", "celular", "viven"].map(c => famCell(val(`fam_hermano_${n}_${c}`))).join("")}</tr>`;
        }
        inner = `<div style="overflow-x:auto; margin-bottom:15px;"><div style="margin-bottom:10px; color:#2c3e50; font-weight:600; font-size:13px;">Datos de los miembros de la familia</div><table style="width:100%; border-collapse:collapse; background:white; border:1px solid #bdc3c7; font-size:12px;"><thead><tr>${["Parentesco", "Apellidos y Nombres", "Edad", "Grado de Instrucción", "Ocupación", "Celular", "¿Viven? (SI/NO)"].map(h => `<th style="background-color:#1a3a5c; color:white; padding:10px; text-align:left; font-size:11px; text-transform:uppercase;">${h}</th>`).join("")}</tr></thead><tbody>${famRows}</tbody></table></div>`;
        inner += restoVista(items.filter(([k]) => !k.startsWith("fam_padre_") && !k.startsWith("fam_madre_") && !/^fam_hermano_1_/.test(k)));
      } else if (/^[789]\./.test(sec)) {
        // Tablas 7/8/9 como las originales, con cuadritos Sí/No marcados
        inner = `<table style="width:100%; border-collapse:collapse; background:white; border:1px solid #bdc3c7; font-size:13px;"><tbody>${items.map(([k, label]) => {
          const v = val(k);
          const ans = (v === "Si" || v === "No")
            ? `<div style="display:flex; gap:8px; flex-wrap:wrap;">${parSiNo(v).map(([t, on]) => mini(t, on)).join("")}</div>`
            : `<span style="color:${valColor(v)}; font-weight:600;">${esc(v)}</span>`;
          return `<tr><td style="font-weight:bold; padding:10px; border-bottom:1px solid #ecf0f1; width:58%;">${esc(label)}</td><td style="padding:10px; border-bottom:1px solid #ecf0f1;">${ans}</td></tr>`;
        }).join("")}</tbody></table>`;
      } else if (sec.startsWith("10.")) {
        // Tabla 10.1–10.5 + cajas amplias 10.6–10.8
        const tabla = items.filter(([k]) => !FICHA_TEXTO_KEYS.includes(k));
        const cajas = items.filter(([k]) => FICHA_TEXTO_KEYS.includes(k));
        inner = `<table style="width:100%; border-collapse:collapse; background:white; border:1px solid #bdc3c7; font-size:13px; margin-bottom:14px;"><tbody>${tabla.map(([k, label]) => {
          const v = val(k);
          return `<tr><td style="font-weight:bold; padding:10px; border-bottom:1px solid #ecf0f1; width:58%;">${esc(label)}</td><td style="padding:10px; border-bottom:1px solid #ecf0f1;"><div style="display:flex; gap:8px; flex-wrap:wrap;">${parSiNo(v).map(([t, on]) => mini(t, on)).join("")}</div></td></tr>`;
        }).join("")}</tbody></table>`;
        inner += cajas.map(([k, label]) => bigBox(label, val(k))).join("");
      } else {
        inner = restoVista(items);
      }
      html += `<div style="margin-bottom:30px; border-bottom:2px solid #ecf0f1; padding-bottom:20px;">${secTitle(sec)}${inner}</div>`;
    }
    html += `<div style="display:flex; gap:10px; justify-content:center; margin-top:30px; flex-wrap:wrap; position:sticky; bottom:0; background:white; padding-top:12px; border-top:1px solid #ecf0f1;">
      <button class="btn btn-secondary" onclick="cerrarModal('modalFichaVista')">Cerrar</button>
      <button class="btn btn-primary" style="background:#27ae60; padding:12px 30px; font-size:14px; font-weight:600; text-transform:uppercase;" onclick="descargarDocxVista()">⬇ Descargar Word</button>
    </div>`;
    body.innerHTML = html;
  } catch (e) {
    if (titulo) titulo.textContent = "Ficha Socioeducativa";
    body.innerHTML = `<p style="color:#b91c1c; font-size:13px;">Error: ${e.message}</p>`;
  }
}
async function descargarDocxVista() {
  if (!_fichaVistaDatos || !_fichaVistaEstudiante) return;
  // 1) Word COMPLETO local (11 secciones) — garantizado
  try {
    const nombre = "Ficha_" + String(_fichaVistaDatos.apellidos || _fichaVistaDatos.apellidosNombres || _fichaVistaEstudiante).replace(/[^\wáéíóúñü\s-]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40);
    descargarWordLocal(_fichaVistaDatos, nombre || "Ficha_Diagnostica_Socioeducativa");
  } catch (e) { alert("Error: " + e.message); return; }
  // 2) Además intentar plantilla oficial del backend (solo datos generales)
  try {
    const res = await fetch((typeof API !== "undefined" ? API : "/api") + `/postgres/ficha-diagnostica/${_fichaVistaEstudiante}/docx`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("sat_token") },
      body: JSON.stringify({ datos: _fichaVistaDatos })
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Ficha_Diagnostica_plantilla_oficial.docx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  } catch (_) { /* el Word completo ya se descargó */ }
}
