// Tutoría: salón, registro de estudiantes y comportamiento — SAT Escolar

async function cargarSeccionesTutor() {
  const select = document.getElementById("tutorSeccionRegistro");
  if (!select) return;
  try {
    const secciones = await apiFetch("/postgres/docentes/me/secciones");
    if (!secciones.length) { select.innerHTML = '<option value="">Sin salones asignados</option>'; return; }
    select.innerHTML = secciones.map(s => `<option value="${s.seccion_id}">${s.seccion}</option>`).join("");
    // Cada tutor tiene un solo salón: entrar directo sin pedir que elija
    if (secciones.length === 1) {
      select.value = String(secciones[0].seccion_id);
      continuarRegistroSalon();
      const btnCambiar = document.getElementById("btnCambiarSalon");
      if (btnCambiar) btnCambiar.classList.add("oculto");
    } else {
      const btnCambiar = document.getElementById("btnCambiarSalon");
      if (btnCambiar) btnCambiar.classList.remove("oculto");
    }
  } catch (e) { console.error("Error cargando secciones tutor:", e); }
}


let _tutorSalonActual = null;


function continuarRegistroSalon() {
  const select = document.getElementById("tutorSeccionRegistro");
  const msg = document.getElementById("msgSalonTutor");
  if (!select || !select.value) {
    msg.className = "msg-err";
    msg.textContent = "Selecciona el salón que vas a registrar para continuar.";
    return;
  }
  _tutorSalonActual = Number(select.value);
  const nombre = select.options[select.selectedIndex]?.text || "";
  document.getElementById("tutorSalonActualTxt").textContent = nombre;
  document.getElementById("pasoSalonTutor").classList.add("oculto");
  document.getElementById("pasoEstudiantesTutor").classList.remove("oculto");
  msg.className = "msg-err";
  msg.textContent = "";
  document.getElementById("msgRegistroTutor").textContent = "";
  cargarListaEstudiantesTutor();
}


function volverSeleccionSalonTutor() {
  document.getElementById("pasoEstudiantesTutor").classList.add("oculto");
  document.getElementById("pasoSalonTutor").classList.remove("oculto");
}

// ── EXCEL (SheetJS + fallback CSV) ───────────────────────────────────────────


async function cargarListaEstudiantesTutor() {
  const contenedor = document.getElementById("listaEstudiantesTutor");
  const seccionId = _tutorSalonActual;
  if (!contenedor || !seccionId) return;
  try {
    const estudiantes = await apiFetch(`/postgres/estudiantes?seccionId=${seccionId}`);
    if (!estudiantes.length) {
      contenedor.innerHTML = '<p class="teacher-v2-muted" style="margin-top:8px;">Aún no hay estudiantes en esta sección.</p>';
      return;
    }
    contenedor.innerHTML = `
      <div class="teacher-v2-table-wrap" style="margin-top:8px;">
        <table class="teacher-v2-table">
          <thead><tr><th>Estudiante</th><th>Correo</th><th>Clave</th></tr></thead>
          <tbody>
            ${estudiantes.map(e => `
              <tr>
                <td><strong>${escaparHtml(e.nombres + " " + e.apellidos)}</strong></td>
                <td>${escaparHtml(e.correo)}</td>
                <td id="clave-${e.id}"><button type="button" class="teacher-v2-small-btn" onclick="restablecerClaveEstudiante(${e.id})">Restablecer</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="teacher-v2-muted" style="margin-top:8px;">Por seguridad las claves se guardan cifradas y no se pueden ver. Si un alumno la olvida, restablécela aquí y dicta la nueva.</p>`;
  } catch (e) {
    contenedor.innerHTML = `<p class="msg-err">Error: ${escaparHtml(e.message)}</p>`;
  }
}

function restablecerClaveEstudiante(id) {
  const celda = document.getElementById(`clave-${id}`);
  if (!celda || celda.dataset.editando) return;
  celda.dataset.editando = "1";
  celda.innerHTML = `<div style="display:flex; gap:6px; flex-wrap:wrap;">
      <input type="password" id="nuevaClave-${id}" placeholder="Nueva clave" style="flex:1; min-width:140px; padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:12px;">
      <button type="button" class="teacher-v2-small-btn" onclick="guardarClaveEstudiante(${id})">Guardar</button>
      <button type="button" class="teacher-v2-small-btn" onclick="cargarListaEstudiantesTutor()">Cancelar</button>
    </div><div id="msgClave-${id}" class="form-hint"></div>`;
  document.getElementById(`nuevaClave-${id}`).focus();
}

async function guardarClaveEstudiante(id) {
  const input = document.getElementById(`nuevaClave-${id}`);
  const msg = document.getElementById(`msgClave-${id}`);
  const nueva = (input.value || "").trim();
  const err = (typeof validarPasswordFuerte === "function") ? validarPasswordFuerte(nueva) : null;
  if (err) { msg.style.color = "#b91c1c"; msg.textContent = err; return; }
  msg.style.color = "#6b7280"; msg.textContent = "Guardando...";
  try {
    await apiFetch(`/postgres/docentes/me/estudiantes/${id}`, { method: "PATCH", body: { contraseña: nueva } });
    msg.style.color = "#059669"; msg.textContent = "Clave actualizada.";
    setTimeout(() => { if (typeof cargarListaEstudiantesTutor === "function") cargarListaEstudiantesTutor(); }, 900);
  } catch (e) { msg.style.color = "#b91c1c"; msg.textContent = "Error: " + e.message; }
}

// ── EXCEL DE NOTAS ───────────────────────────────────────────────────────────


async function registrarEstudianteTutor() {
  const nombres = document.getElementById("tutorEstNombre").value.trim();
  const apellidos = document.getElementById("tutorEstApellido").value.trim();
  const correo = document.getElementById("tutorEstCorreo").value.trim();
  const contraseña = (document.getElementById("tutorEstPassword")?.value || "").trim();
  const confirm = (document.getElementById("tutorEstPasswordConfirm")?.value || "").trim();
  const seccionId = _tutorSalonActual;
  const msg = document.getElementById("msgRegistroTutor");
  if (!nombres || !apellidos || !correo || !seccionId) { msg.textContent = "Completa todos los campos del estudiante."; return; }
  if (contraseña !== confirm) { msg.textContent = "Las contraseñas no coinciden"; return; }
  const pwErr = validarPasswordFuerte(contraseña);
  if (pwErr) { msg.textContent = pwErr; return; }
  const okCorreo = await verificarCorreoEnCreacion("tutorEstCorreo", "msgRegistroTutor");
  if (!okCorreo) return;
  try {
    await apiFetch("/postgres/docentes/me/estudiantes", { method: "POST", body: { nombres, apellidos, correo, seccionId, contraseña } });
    msg.className = "msg-ok";
    msg.textContent = "Estudiante registrado correctamente.";
    ["tutorEstNombre", "tutorEstApellido", "tutorEstCorreo", "tutorEstPassword", "tutorEstPasswordConfirm"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
    const pautasEl=document.getElementById("pautasEst"); if(pautasEl) pautasEl.innerHTML="";
    await cargarListaEstudiantesTutor();
  } catch (e) { msg.className = "msg-err"; msg.textContent = "Error: " + e.message; }
}

async function solicitarCodigoEstudiante() {
  const nombres = document.getElementById("tutorEstNombre").value.trim();
  const apellidos = document.getElementById("tutorEstApellido").value.trim();
  const correo = document.getElementById("tutorEstCorreo").value.trim();
  const contraseña = (document.getElementById("tutorEstPassword")?.value || "").trim();
  const confirm = (document.getElementById("tutorEstPasswordConfirm")?.value || "").trim();
  const seccionId = _tutorSalonActual;
  const msg = document.getElementById("msgRegistroTutor");
  if (!nombres || !apellidos || !correo || !seccionId) { msg.textContent="Completa todos los campos"; return; }
  if (contraseña !== confirm) { msg.textContent="Las contraseñas no coinciden"; return; }
  const pwErr = validarPasswordFuerte(contraseña);
  if (pwErr) { msg.textContent = pwErr; return; }
  msg.textContent="Verificando correo y enviando código...";
  try {
    const okCorreo = await verificarCorreoEnCreacion("tutorEstCorreo","msgRegistroTutor");
    if (okCorreo===false) return;
    const resp = await apiFetch("/verification/solicitar", { method:"POST", body:{ email: correo, tipo:"estudiante", datos:{ nombres, apellidos, correo, password: contraseña, seccionId, tipo:"estudiante" } } });
    msg.className="msg-ok"; msg.textContent=resp.mensaje||"Código enviado. Revisa tu correo";
    document.getElementById("codigoEstBox")?.classList.remove("oculto");
    document.getElementById("codigoEstEmail").textContent=correo;
    document.getElementById("btnSolicitarEst")?.classList.add("oculto");
    if(resp.codigoDemo){ msg.textContent+=` (Demo: ${resp.codigoDemo})`; document.getElementById("codigoEst").value=resp.codigoDemo; }
  } catch(e){ msg.className="msg-err"; msg.textContent="Error: "+e.message; }
}

async function verificarYCrearEstudiante() {
  const correo = document.getElementById("tutorEstCorreo").value.trim();
  const codigo = document.getElementById("codigoEst").value.trim();
  const msg = document.getElementById("msgRegistroTutor");
  if(!codigo){ msg.textContent="Ingresa el código"; return; }
  msg.textContent="Verificando...";
  try {
    const resp = await apiFetch("/verification/verificar", { method:"POST", body:{ email: correo, codigo } });
    msg.className="msg-ok"; msg.textContent=resp.mensaje||"Estudiante creado tras verificar";
    ["tutorEstNombre","tutorEstApellido","tutorEstCorreo","tutorEstPassword","tutorEstPasswordConfirm","codigoEst"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";});
    document.getElementById("pautasEst") && (document.getElementById("pautasEst").innerHTML="");
    document.getElementById("codigoEstBox")?.classList.add("oculto");
    document.getElementById("btnSolicitarEst")?.classList.remove("oculto");
    // El nuevo estudiante aparece solo en la lista del salón
    await cargarListaEstudiantesTutor();
  } catch(e){ msg.className="msg-err"; msg.textContent="Error: "+e.message; }
}


async function cargarComportamientoDocente() {
  const seccionSelect = document.getElementById("compSeccion");
  const trimestreSelect = document.getElementById("compTrimestre");
  if (!seccionSelect || !trimestreSelect) return;

  try {
    if (!seccionSelect.options.length) {
      const secciones = await apiFetch("/postgres/docentes/me/secciones");
      seccionSelect.innerHTML = secciones.length
        ? secciones.map(s => `<option value="${s.seccion_id}">${s.seccion}</option>`).join("")
        : '<option value="">Sin secciones</option>';
    }
    if (!trimestreSelect.options.length) {
      const trimestres = await apiFetch("/postgres/trimestres-academicos");
      trimestreSelect.innerHTML = trimestres
        .filter(t => t.anio === new Date().getFullYear())
        .map(t => `<option value="${t.id}">${t.nombre} (${t.orden})</option>`).join("") || "<option value=''>Sin trimestres</option>";
    }
    await cargarEstudiantesComportamiento();
  } catch (e) { console.error("Error cargando comportamiento:", e); }
}


async function cargarEstudiantesComportamiento() {
  const seccionId = Number(document.getElementById("compSeccion").value);
  const trimestreId = Number(document.getElementById("compTrimestre").value);
  const tabla = document.getElementById("tablaComportamiento");
  if (!tabla || !seccionId || !trimestreId) return;

  try {
    const estudiantes = await apiFetch(`/postgres/docentes/me/comportamiento?seccionId=${seccionId}&trimestreId=${trimestreId}`);
    tabla.innerHTML = estudiantes.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:16px;">Sin estudiantes en esta sección.</td></tr>'
      : estudiantes.map(e => {
        const esBajo = e.nivel==='Regular' || e.nivel==='Deficiente';
        return `
        <tr data-estudiante="${e.estudiante_id}">
          <td><strong>${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</strong></td>
          <td>${escaparHtml(e.seccion)}</td>
          <td>
            <select class="comp-nivel" onchange="onCambioNivelComp(${e.estudiante_id})">
              <option value="">— Sin registrar —</option>
              ${["Excelente", "Bueno", "Regular", "Deficiente"].map(n =>
                `<option value="${n}" ${e.nivel === n ? "selected" : ""}>${n}</option>`).join("")}
            </select>
          </td>
          <td>
            <input class="comp-observacion" value="${escaparHtml(e.observacion || "")}" 
              placeholder="${esBajo ? 'Justificación requerida para B/C *' : 'Observación (opcional) — ej: juega mucho, conversador'}"
              style="${esBajo && !e.observacion ? 'border-color:#fca5a5; background:#fff5f5;' : ''}"
              maxlength="400">
            ${esBajo ? '<div style="font-size:10.5px; color:#b91c1c; margin-top:3px;">Para Regular (B) / Deficiente (C) describe el porqué</div>' : ''}
          </td>
          <td><button class="btn-admin small" onclick="guardarComportamiento(${e.estudiante_id})">Guardar</button></td>
        </tr>`}).join("");
  } catch (e) {
    tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#b91c1c;padding:16px;">Error: ' + escaparHtml(e.message) + '</td></tr>';
  }
}

function onCambioNivelComp(estudianteId){
  const fila=document.querySelector(`tr[data-estudiante="${estudianteId}"]`);
  if(!fila) return;
  const nivel=fila.querySelector(".comp-nivel").value;
  const inp=fila.querySelector(".comp-observacion");
  const esBajo=nivel==='Regular'||nivel==='Deficiente';
  inp.placeholder = esBajo ? 'Justificación requerida para B/C * — ej: juega mucho, se distrae, líder' : 'Observación (opcional) — ej: juega mucho, conversador';
  if(esBajo && !inp.value.trim()){ inp.style.borderColor='#fca5a5'; inp.style.background='#fff5f5'; inp.focus(); }
  else { inp.style.borderColor=''; inp.style.background=''; }
}

async function guardarComportamiento(estudianteId) {
  const fila = document.querySelector(`tr[data-estudiante="${estudianteId}"]`);
  if (!fila) return;
  const nivel = fila.querySelector(".comp-nivel").value;
  const observacion = fila.querySelector(".comp-observacion").value.trim();
  const trimestreId = Number(document.getElementById("compTrimestre").value);
  if (!nivel) { (window.mostrarToastGlobal||alert)("Selecciona un nivel de comportamiento.","warn"); return; }
  if ((nivel==="Regular" || nivel==="Deficiente") && !observacion){
    (window.mostrarToastGlobal||alert)("Para B (Regular) y C (Deficiente) la observación/justificación es requerida: describe si es por juego, distracción, etc.","warn");
    fila.querySelector(".comp-observacion").focus();
    fila.querySelector(".comp-observacion").style.borderColor='#fca5a5';
    return;
  }

  try {
    await apiFetch("/postgres/docentes/me/comportamiento", {
      method: "PUT",
      body: { estudianteId, trimestreId, nivel, observacion: observacion || null }
    });
    (window.mostrarToastGlobal||alert)("Comportamiento registrado. El riesgo se recalculará.");
    fila.querySelector(".comp-observacion").style.borderColor='';
    fila.querySelector(".comp-observacion").style.background='';
  } catch (e) { (window.mostrarToastGlobal||alert)("Error: "+e.message,"error"); }
}

// ═══════════════════════════════════════════════════════════════
//  PSICÓLOGA: alertas de riesgo
// ═══════════════════════════════════════════════════════════════

