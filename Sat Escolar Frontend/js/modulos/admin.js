// Panel de dirección — SAT Escolar

// validarPasswordFuerte vive en core/utils.js (compartida con el panel docente).
// Se conserva esta referencia por compatibilidad.
if (typeof validarPasswordFuerte === "undefined") {
  var validarPasswordFuerte = function (pw) {
    if (typeof pw !== "string" || pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!/[A-Z]/.test(pw)) return "Debe contener al menos una letra mayúscula.";
    if (!/[a-z]/.test(pw)) return "Debe contener al menos una letra minúscula.";
    if (!/[0-9]/.test(pw)) return "Debe contener al menos un número.";
    return null;
  };
}

function mostrarSeccionDirector(idSeccion) {
  document.querySelectorAll(".seccion-director").forEach(s => s.classList.add("oculto"));
  const seccion = document.getElementById(idSeccion);
  if (seccion) seccion.classList.remove("oculto");

  document.querySelectorAll(".sidebar-nav a").forEach(a => a.classList.remove("active"));
  const navItems = document.querySelectorAll(".sidebar-nav a");
  const map = { "dir-inicio": 0, "dir-docentes": 1, "dir-psicologos": 2, "dir-estudiantes": 3 };
  if (map[idSeccion] !== undefined && navItems[map[idSeccion]]) {
    navItems[map[idSeccion]].classList.add("active");
  }

  if (idSeccion === "dir-estudiantes") {
    volverSeccionesEstudiantes();
  }
  if (idSeccion === "dir-psicologos") {
    cargarPsicologosAdmin();
  }
  if (idSeccion === "dir-docentes") {
    cargarDiasTutoria();
  }
}

async function cargarDiasTutoria() {
  const grid = document.getElementById("diasTutoriaGrid");
  if (!grid) return;
  try {
    const secciones = await apiFetch("/postgres/secciones");
    const dias = [["", "Sin dia"], ["1", "Lunes"], ["2", "Martes"], ["3", "Miercoles"], ["4", "Jueves"], ["5", "Viernes"], ["6", "Sabado"]];
    grid.innerHTML = secciones.map(s => `
      <div class="card" style="padding:14px; display:flex; flex-direction:column; gap:8px;">
        <div style="font-weight:700; font-size:14px; color:#03275f;">${escaparHtml(s.nombre || `${s.grado} ${s.letra}`)}</div>
        <div style="font-size:11.5px; color:#6d7b91;">${escaparHtml(s.nivel)}</div>
        <select onchange="guardarDiaTutoria(${s.id}, this.value)" style="padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:13px;">
          ${dias.map(([val, nom]) => `<option value="${val}" ${String(s.dia_tutoria ?? "") === val ? "selected" : ""}>${nom}</option>`).join('')}
        </select>
      </div>
    `).join("");
    if (!secciones.length) grid.innerHTML = '<p style="color:#6b7280; font-size:13px;">No hay salones registrados aun.</p>';
  } catch (e) {
    grid.innerHTML = `<p style="color:#b91c1c; font-size:13px;">Error: ${escaparHtml(e.message)}</p>`;
  }
}

async function guardarDiaTutoria(seccionId, dia) {
  try {
    await apiFetch(`/admin/secciones/${seccionId}/dia-tutoria`, {
      method: "PUT",
      body: { diaTutoria: dia === "" ? null : Number(dia) }
    });
    alert("Dia de tutoria guardado.");
  } catch (e) {
    alert("Error: " + e.message);
    cargarDiasTutoria();
  }
}

async function cargarPanelDirector() {
  cargarSidebarUsuario();

  try {
    const [docentes, estudiantes, alertas] = await Promise.all([
      apiFetch("/admin/docentes"),
      apiFetch("/postgres/estudiantes").catch(() => []),
      apiFetch("/postgres/psicologia/alertas").catch(() => ({ pendientes: 0 }))
    ]);

    const secciones = new Set(estudiantes.map(e => e.seccion_id).filter(Boolean));

    document.getElementById("statDocentes").textContent = docentes.length;
    document.getElementById("statEstudiantes").textContent = estudiantes.length;
    document.getElementById("statSecciones").textContent = secciones.size;
    document.getElementById("statAlertas").textContent = alertas.pendientes || 0;

    const user = getUser();
    const nombre = user.fullName || "Directora";
    document.getElementById("mensajeDirectorInicio").textContent =
      `Bienvenida, ${nombre}. Aqui administras el personal de la institucion.`;
  } catch (e) {
    document.getElementById("mensajeDirectorInicio").textContent = "No se pudo cargar el resumen: " + e.message;
  }

  await cargarDocentesAdmin();
  await cargarPsicologosAdmin();
  await cargarEstudiantesAdmin();
}

let _cursosDocenteAdmin = [];
let _seccionesCache = [];

function agregarCursoDocenteAdmin() {
  const grado = document.getElementById("adminDocGradoSel").value;
  const letra = document.getElementById("adminDocSeccionLetra").value.trim().toUpperCase();
  const nombreCurso = document.getElementById("adminDocCursoNombre").value.trim();
  const msg = document.getElementById("msgAdminDoc");

  if (!grado || !letra) { msg.textContent = "Selecciona el grado y escribe la letra de seccion."; return; }
  if (!nombreCurso) { msg.textContent = "Escribe el nombre del curso."; return; }

  const texto = `${grado} ${letra}`;
  const existente = _cursosDocenteAdmin.find(c => c.seccionTexto === texto);
  if (existente) { existente.nombres.push(nombreCurso); }
  else { _cursosDocenteAdmin.push({ grado, letra, seccionTexto: texto, nombres: [nombreCurso] }); }
  document.getElementById("adminDocCursoNombre").value = "";
  renderCursosDocenteAdmin(document.getElementById("adminDocCursosAgregados"));
}

function quitarCursoDocenteAdmin(index) {
  _cursosDocenteAdmin.splice(index, 1);
  renderCursosDocenteAdmin(document.getElementById("adminDocCursosAgregados"));
}

function renderCursosDocenteAdmin(contenedor) {
  if (!contenedor) return;
  contenedor.innerHTML = _cursosDocenteAdmin.map((curso, index) => `
    <div class="seccion-chip">
      <label>${escaparHtml(curso.seccionTexto)}</label>
      <small>${curso.nombres.map(n => escaparHtml(n)).join(", ")}</small>
      <button type="button" class="btn btn-danger btn-sm" onclick="quitarCursoDocenteAdmin(${index})" style="margin-top:6px;">Quitar</button>
    </div>`).join("");
  document.getElementById("msgAdminDoc").textContent = "";
}

async function crearDocenteAdmin() {
  const nombres = document.getElementById("adminDocNombre").value.trim();
  const apellidos = document.getElementById("adminDocApellido").value.trim();
  const correo = document.getElementById("adminDocCorreo").value.trim();
  const password = document.getElementById("adminDocPassword").value;
  const esTutor = document.getElementById("adminDocEsTutor").checked;
  const msg = document.getElementById("msgAdminDoc");

  if (!nombres || !apellidos || !correo || !password) { msg.textContent = "Completa todos los campos."; return; }
  const pwErr = validarPasswordFuerte(password);
  if (pwErr) { msg.textContent = pwErr; return; }
  if (_cursosDocenteAdmin.length === 0) { msg.textContent = "Agrega al menos un curso."; return; }
  const okCorreo = await verificarCorreoEnCreacion("adminDocCorreo", "msgAdminDoc");
  if (!okCorreo) return;

  const secciones = [];
  for (const curso of _cursosDocenteAdmin) {
    const nivel = ["1ro", "2do"].includes(curso.grado) ? "Primaria" : "Secundaria";
    let seccion = _seccionesCache.find(s => s.nivel === nivel && s.grado === curso.grado && s.letra === curso.letra);
    if (!seccion) {
      try {
        seccion = await apiFetch("/postgres/secciones", { method: "POST", body: { nivel, grado: curso.grado, letra: curso.letra } });
        _seccionesCache.push(seccion);
      } catch (e) { msg.textContent = "Error creando seccion: " + e.message; return; }
    }
    secciones.push({ seccionId: seccion.id, asignaturas: [], asignaturasNuevas: curso.nombres });
  }

  try {
    await apiFetch("/admin/docentes", { method: "POST", body: { nombres, apellidos, correo, password, esTutor, secciones } });
    msg.className = "msg-ok";
    msg.textContent = "Docente registrado correctamente.";
    ["adminDocNombre", "adminDocApellido", "adminDocCorreo", "adminDocPassword", "adminDocCursoNombre", "adminDocSeccionLetra"].forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("adminDocEsTutor").checked = false;
    document.getElementById("adminDocGradoSel").value = "";
    _cursosDocenteAdmin = [];
    renderCursosDocenteAdmin(document.getElementById("adminDocCursosAgregados"));
    await cargarDocentesAdmin();
  } catch (e) { msg.className = "msg-err"; msg.textContent = "Error: " + e.message; }
}

async function cargarDocentesAdmin() {
  const tabla = document.getElementById("tablaDocentesAdmin");
  if (!tabla) return;
  try {
    const docentes = await apiFetch("/admin/docentes");
    if (!docentes.length) {
      tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:20px;">Sin docentes registrados.</td></tr>';
      return;
    }
    tabla.innerHTML = docentes.map(d => {
      const secciones = (d.secciones || []).map(s =>
        `${s.seccion} ${s.asignaturas?.length ? "- " + s.asignaturas.map(a => a.nombre).join(", ") : ""}`).join("<br>");
      return `
        <tr>
          <td><strong>${escaparHtml(d.nombres)} ${escaparHtml(d.apellidos)}</strong></td>
          <td>${escaparHtml(d.correo || "-")}</td>
          <td>${d.es_tutor ? '<span class="badge badge-blue">Tutor</span>' : '<span class="badge badge-gray">No</span>'}</td>
          <td style="font-size:12px;">${secciones || "-"}</td>
          <td style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="resetearPasswordDocenteAdmin(${d.id})">Nueva contrasena</button>
            <button class="btn btn-secondary btn-sm" onclick="cambiarTutorDocenteAdmin(${d.id}, ${!d.es_tutor})">${d.es_tutor ? "Quitar tutor" : "Hacer tutor"}</button>
            <button class="btn btn-danger btn-sm" onclick="eliminarDocenteAdmin(${d.id}, '${escaparHtml(d.nombres)} ${escaparHtml(d.apellidos)}')">Eliminar</button>
          </td>
        </tr>`;
    }).join("");
  } catch (e) {
    tabla.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#b91c1c;padding:20px;">Error: ${escaparHtml(e.message)}</td></tr>`;
  }
}

async function resetearPasswordDocenteAdmin(id) {
  const password = prompt("Nueva contrasena (min. 8 caracteres, 1 mayuscula, 1 minuscula, 1 numero):");
  if (!password) return;
  const pwErr = validarPasswordFuerte(password);
  if (pwErr) { alert(pwErr); return; }
  try {
    await apiFetch(`/admin/docentes/${id}/password`, { method: "PUT", body: { password } });
    alert("Contrasena actualizada.");
  } catch (e) { alert("Error: " + e.message); }
}

async function cambiarTutorDocenteAdmin(id, esTutor) {
  try {
    await apiFetch(`/admin/docentes/${id}/tutor`, { method: "PUT", body: { esTutor } });
    await cargarDocentesAdmin();
  } catch (e) { alert("Error: " + e.message); }
}
async function eliminarDocenteAdmin(id, nombre){
  if(!confirm(`¿Eliminar docente ${nombre}? Esta acción no se puede deshacer.`)) return;
  try{
    await apiFetch(`/admin/docentes/${id}`, {method:"DELETE"});
    if(window.mostrarToastGlobal) mostrarToastGlobal(`Docente ${nombre} eliminado.`,"ok");
    await cargarDocentesAdmin();
    await cargarPanelDirector();
  }catch(e){ (window.mostrarToastGlobal||alert)(e.message,"error"); }
}

// ═══════════════════════════════════════════════════════════════
//  ESTUDIANTES — Vista por secciones
// ═══════════════════════════════════════════════════════════════

let _estudiantesCache = [];

async function cargarEstudiantesAdmin() {
  const grilla = document.getElementById("grillaSecciones");
  if (!grilla) return;
  try {
    _estudiantesCache = await apiFetch("/postgres/estudiantes");

    const porSeccion = {};
    _estudiantesCache.forEach(e => {
      const key = e.seccion || "Sin seccion";
      if (!porSeccion[key]) porSeccion[key] = [];
      porSeccion[key].push(e);
    });

    if (Object.keys(porSeccion).length === 0) {
      grilla.innerHTML = '<p style="color:#6b7280; font-size:14px;">Sin estudiantes registrados.</p>';
      return;
    }

    grilla.innerHTML = Object.entries(porSeccion).map(([seccion, estudiantes]) => {
      const activos = estudiantes.filter(e => e.activo).length;
      return `
        <div class="section-card" onclick="verEstudiantesSeccion('${escaparHtml(seccion)}')">
          <div class="section-card-header">
            <div>
              <div class="section-card-title">${escaparHtml(seccion)}</div>
              <div class="section-card-sub">${estudiantes.length} estudiante${estudiantes.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="section-card-count">${estudiantes.length}</div>
          </div>
          <div class="section-card-footer">
            <div class="section-card-stat"><strong>${activos}</strong> activos</div>
            <div class="section-card-stat"><strong>${estudiantes.length - activos}</strong> inactivos</div>
          </div>
        </div>`;
    }).join("");
  } catch (e) {
    grilla.innerHTML = `<p style="color:#b91c1c;">Error: ${escaparHtml(e.message)}</p>`;
  }
}

function verEstudiantesSeccion(nombreSeccion) {
  const estudiantes = _estudiantesCache.filter(e => (e.seccion || "Sin seccion") === nombreSeccion);
  document.getElementById("estudiantesVistaSecciones").classList.add("oculto");
  document.getElementById("estudiantesVistaLista").classList.remove("oculto");
  document.getElementById("estudiantesSeccionTitulo").textContent = `Seccion: ${nombreSeccion} (${estudiantes.length} estudiantes)`;

  const tabla = document.getElementById("tablaEstudiantesSeccion");
  if (estudiantes.length === 0) {
    tabla.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:16px;">Sin estudiantes en esta seccion.</td></tr>';
    return;
  }
  tabla.innerHTML = estudiantes.map(e => `
    <tr>
      <td><strong>${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</strong></td>
      <td>${escaparHtml(e.correo || "-")}</td>
      <td>${e.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
    </tr>`).join("");
}

function volverSeccionesEstudiantes() {
  document.getElementById("estudiantesVistaSecciones").classList.remove("oculto");
  document.getElementById("estudiantesVistaLista").classList.add("oculto");
}

// ═══════════════════════════════════════════════════════════════
//  PSICÓLOGOS — Administración
// ═══════════════════════════════════════════════════════════════

async function crearPsicologoAdmin() {
  const nombres = document.getElementById("adminPsiNombre").value.trim();
  const apellidos = document.getElementById("adminPsiApellido").value.trim();
  const correo = document.getElementById("adminPsiCorreo").value.trim();
  const password = document.getElementById("adminPsiPassword").value;
  const confirm = document.getElementById("adminPsiPasswordConfirm")?.value || "";
  const msg = document.getElementById("msgAdminPsi");

  if (!nombres || !apellidos || !correo || !password) {
    msg.textContent = "Completa todos los campos del psicólogo.";
    return;
  }
  if (password !== confirm) { msg.textContent = "Las contraseñas no coinciden"; return; }
  const pwErr = validarPasswordFuerte(password);
  if (pwErr) { msg.textContent = pwErr; return; }
  const username = nombres.split(/\s+/)[0].toLowerCase() + "." + apellidos.split(/\s+/)[0].toLowerCase();
  try {
    await apiFetch("/admin/psicologos", { method: "POST", body: { nombres, apellidos, username, correo, password } });
    msg.className = "msg-ok";
    msg.textContent = "Psicólogo registrado correctamente. (byCrypto bcrypt)";
    ["adminPsiNombre", "adminPsiApellido", "adminPsiCorreo", "adminPsiPassword", "adminPsiPasswordConfirm"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
    const pautasEl=document.getElementById("pautasPsi"); if(pautasEl) pautasEl.innerHTML="";
    await cargarPsicologosAdmin();
  } catch (e) { msg.className = "msg-err"; msg.textContent = "Error: " + e.message; }
}

async function solicitarCodigoPsicologo() {
  const nombres = document.getElementById("adminPsiNombre").value.trim();
  const apellidos = document.getElementById("adminPsiApellido").value.trim();
  const correo = document.getElementById("adminPsiCorreo").value.trim();
  const password = document.getElementById("adminPsiPassword").value;
  const confirm = document.getElementById("adminPsiPasswordConfirm")?.value || "";
  const msg = document.getElementById("msgAdminPsi");
  if (!nombres || !apellidos || !correo || !password) { msg.textContent="Completa todos los campos"; return; }
  if (password !== confirm) { msg.textContent="Las contraseñas no coinciden"; return; }
  const pwErr = validarPasswordFuerte(password);
  if (pwErr) { msg.textContent = pwErr; return; }
  msg.textContent = "Verificando correo y enviando código...";
  try {
    const okCorreo = await verificarCorreoEnCreacion("adminPsiCorreo","msgAdminPsi");
    if (okCorreo === false) return;
    const resp = await apiFetch("/verification/solicitar", { method: "POST", body: { email: correo, tipo: "psicologo", datos: { nombres, apellidos, correo, password, tipo: "psicologo" } } });
    msg.className="msg-ok"; msg.textContent=resp.mensaje || "Código enviado. Revisa tu correo";
    document.getElementById("codigoPsiBox")?.classList.remove("oculto");
    document.getElementById("codigoPsiEmail").textContent=correo;
    document.getElementById("btnSolicitarPsi")?.classList.add("oculto");
    if(resp.codigoDemo) { document.getElementById("msgAdminPsi").textContent += ` (Demo: ${resp.codigoDemo})`; document.getElementById("codigoPsi").value=resp.codigoDemo; }
  } catch(e){ msg.className="msg-err"; msg.textContent="Error: "+e.message; }
}

async function verificarYCrearPsicologo() {
  const correo = document.getElementById("adminPsiCorreo").value.trim();
  const codigo = document.getElementById("codigoPsi").value.trim();
  const msg = document.getElementById("msgAdminPsi");
  if(!codigo){ msg.textContent="Ingresa el código de 6 dígitos"; return; }
  msg.textContent="Verificando código...";
  try {
    const resp = await apiFetch("/verification/verificar", { method: "POST", body: { email: correo, codigo } });
    msg.className="msg-ok"; msg.textContent=resp.mensaje || "Psicólogo creado tras verificar correo";
    ["adminPsiNombre","adminPsiApellido","adminPsiCorreo","adminPsiPassword","adminPsiPasswordConfirm","codigoPsi"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";});
    document.getElementById("pautasPsi") && (document.getElementById("pautasPsi").innerHTML="");
    document.getElementById("codigoPsiBox")?.classList.add("oculto");
    document.getElementById("btnSolicitarPsi")?.classList.remove("oculto");
    await cargarPsicologosAdmin();
  } catch(e){ msg.className="msg-err"; msg.textContent="Error: "+e.message; }
}

async function solicitarCodigoDocente() {
  const nombres = document.getElementById("adminDocNombre").value.trim();
  const apellidos = document.getElementById("adminDocApellido").value.trim();
  const correo = document.getElementById("adminDocCorreo").value.trim();
  const password = document.getElementById("adminDocPassword").value;
  const confirm = document.getElementById("adminDocPasswordConfirm")?.value || "";
  const esTutor = document.getElementById("adminDocEsTutor").checked;
  const msg = document.getElementById("msgAdminDoc");
  if (!nombres || !apellidos || !correo || !password) { msg.textContent="Completa todos los campos"; return; }
  if (password !== confirm) { msg.textContent="Las contraseñas no coinciden"; return; }
  const pwErr = validarPasswordFuerte(password);
  if (pwErr) { msg.textContent = pwErr; return; }
  if (_cursosDocenteAdmin.length === 0) { msg.textContent="Agrega al menos un curso"; return; }
  msg.textContent="Verificando correo y preparando secciones...";
  try {
    const okCorreo = await verificarCorreoEnCreacion("adminDocCorreo","msgAdminDoc");
    if (okCorreo === false) return;
    // Prepara secciones (crea las que no existan) para incluir en pending
    const secciones = [];
    for (const curso of _cursosDocenteAdmin) {
      const nivel = ["1ro","2do"].includes(curso.grado) ? "Primaria" : "Secundaria";
      let seccion = _seccionesCache.find(s => s.nivel===nivel && s.grado===curso.grado && s.letra===curso.letra);
      if (!seccion) {
        try { seccion = await apiFetch("/postgres/secciones", { method:"POST", body:{nivel, grado:curso.grado, letra:curso.letra}}); _seccionesCache.push(seccion); } catch(e){ msg.textContent="Error creando sección: "+e.message; return; }
      }
      secciones.push({ seccionId: seccion.id, asignaturasNuevas: curso.nombres });
    }
    const resp = await apiFetch("/verification/solicitar", { method:"POST", body:{ email: correo, tipo:"docente", datos:{ nombres, apellidos, correo, password, esTutor, secciones, tipo:"docente" } } });
    msg.className="msg-ok"; msg.textContent=resp.mensaje||"Código enviado. Revisa tu correo";
    document.getElementById("codigoDocenteBox")?.classList.remove("oculto");
    document.getElementById("codigoDocenteEmail").textContent=correo;
    document.getElementById("btnSolicitarDocente")?.classList.add("oculto");
    if(resp.codigoDemo){ msg.textContent+=` (Demo: ${resp.codigoDemo})`; document.getElementById("codigoDocente").value=resp.codigoDemo; }
  } catch(e){ msg.className="msg-err"; msg.textContent="Error: "+e.message; }
}

async function verificarYCrearDocente() {
  const correo = document.getElementById("adminDocCorreo").value.trim();
  const codigo = document.getElementById("codigoDocente").value.trim();
  const msg = document.getElementById("msgAdminDoc");
  if(!codigo){ msg.textContent="Ingresa el código"; return; }
  msg.textContent="Verificando...";
  try {
    const resp = await apiFetch("/verification/verificar", { method:"POST", body:{ email: correo, codigo } });
    msg.className="msg-ok"; msg.textContent=resp.mensaje||"Docente creado tras verificar";
    ["adminDocNombre","adminDocApellido","adminDocCorreo","adminDocPassword","adminDocPasswordConfirm","codigoDocente"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";});
    document.getElementById("pautasDoc") && (document.getElementById("pautasDoc").innerHTML="");
    document.getElementById("adminDocEsTutor").checked=false;
    document.getElementById("adminDocGradoSel").value="";
    _cursosDocenteAdmin=[]; renderCursosDocenteAdmin(document.getElementById("adminDocCursosAgregados"));
    document.getElementById("codigoDocenteBox")?.classList.add("oculto");
    document.getElementById("btnSolicitarDocente")?.classList.remove("oculto");
    await cargarDocentesAdmin();
    const statEl=document.getElementById("statDocentes"); if(statEl) statEl.textContent=String(Number(statEl.textContent||0)+1);
  } catch(e){ msg.className="msg-err"; msg.textContent="Error: "+e.message; }
}

async function cargarPsicologosAdmin() {
  const tabla = document.getElementById("tablaPsicologosAdmin");
  if (!tabla) return;
  try {
    const psicologos = await apiFetch("/admin/psicologos");
    tabla.innerHTML = psicologos.length === 0
      ? '<tr><td colspan="2" style="text-align:center;color:#6b7280;padding:16px;">Sin psicólogos registrados.</td></tr>'
      : psicologos.map(p => `
        <tr>
          <td><strong>${escaparHtml(p.nombres)} ${escaparHtml(p.apellidos)}</strong></td>
          <td>${escaparHtml(p.correo)}</td>
        </tr>`).join("");
  } catch (e) {
    tabla.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#b91c1c;padding:16px;">Error: ' + escaparHtml(e.message) + '</td></tr>';
  }
}

// ═══════════════════════════════════════════════════════════════
//  DOCENTES — Importación masiva Excel
// ═══════════════════════════════════════════════════════════════
let _excelDocentes = [];

function descargarPlantillaDocentes(){
  const header = ["Nombres","Apellidos","Correo","Contraseña","Es Tutor","Grado","Sección","Curso"];
  const ejemplos = [
    ["Docente","Ejemplo Uno","ejemplo.uno@ofelia.edu.pe","Ejemplo123*","SI","4to","D","Matemática"],
    ["Docente","Ejemplo Dos","ejemplo.dos@ofelia.edu.pe","Ejemplo123*","NO","4to","D","Ciencia y Tecnología"],
    ["Docente","Ejemplo Tres","ejemplo.tres@ofelia.edu.pe","Ejemplo123*","SI","3ro","A","Comunicación"]
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...ejemplos]);
  // anchos
  ws['!cols'] = [{wch:14},{wch:16},{wch:26},{wch:14},{wch:9},{wch:7},{wch:8},{wch:16}];
  // header style
  const range = XLSX.utils.decode_range(ws['!ref']);
  for(let c=range.s.c; c<=range.e.c; c++){
    const addr = XLSX.utils.encode_cell({r:0,c});
    if(ws[addr]) ws[addr].s = { font:{bold:true, color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:"063B91"}}, alignment:{horizontal:"center"} };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Docentes");
  XLSX.writeFile(wb, "plantilla_docentes.xlsx");
  // también ofrece CSV rápido si XLSX falta
  if(window.mostrarToastGlobal) mostrarToastGlobal("Plantilla descargada: plantilla_docentes.xlsx","ok");
}

function buscarClaveDocente(fila, regex){
  for(const k of Object.keys(fila)){
    const nk = String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    if(regex.test(nk)) return k;
  }
  return null;
}

function procesarExcelDocentes(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = e.target.result;
      const wb = XLSX.read(data, {type:'array'});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(sheet, {defval:""});
      if(!filas.length){ alert("El Excel está vacío."); return; }
      // mapear con tolerancia a mayúsculas/espacios/acentos
      const norm = s => String(s||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      const kNombres = buscarClaveDocente(filas[0], /nombres?/);
      const kApellidos = buscarClaveDocente(filas[0], /apellidos?/);
      const kCorreo = buscarClaveDocente(filas[0], /correo|email/);
      const kPass = buscarClaveDocente(filas[0], /contrasena|password|clave/);
      const kTutor = buscarClaveDocente(filas[0], /tutor/);
      const kGrado = buscarClaveDocente(filas[0], /^grado$/);
      const kSecc = buscarClaveDocente(filas[0], /seccion/);
      const kCurso = buscarClaveDocente(filas[0], /curso|asignatura|materia/);
      if(!kNombres || !kApellidos || !kCorreo){
        alert("Faltan columnas obligatorias: Nombres, Apellidos, Correo. Usa la plantilla.");
        return;
      }
      function normGrado(g){
        let s=String(g||"").trim().toLowerCase();
        if(!s) return "";
        if(/^[1-6]$/.test(s)) return s+"ro";
        if(/^1ro?$/.test(s)) return "1ro";
        if(/^2do?$/.test(s)) return "2do";
        if(/^3ro?$/.test(s)) return "3ro";
        if(/^4to?$/.test(s)) return "4to";
        if(/^5to?$/.test(s)) return "5to";
        if(/^6to?$/.test(s)) return "6to";
        // si viene "4to D" en grado, corta
        const m=s.match(/^([1-6])\s*(ro|do|to)?\s*([a-c])$/i);
        if(m) return m[1]+"ro";
        return s.charAt(0).toUpperCase()+s.slice(1);
      }
      function normSeccion(s, gradoRaw){
        let sec=String(s||"").trim().toUpperCase();
        if(sec && /^[A-Z]$/.test(sec)) return sec;
        // si grado trae "4to D", extrae D
        const combined = String(gradoRaw||"").trim();
        const m2 = combined.match(/([A-Z])$/i);
        if(m2) return m2[1].toUpperCase();
        return sec;
      }
      const mapeados = [];
      filas.forEach((f, idx)=>{
        const nombres = String(f[kNombres]||"").trim();
        const apellidos = String(f[kApellidos]||"").trim();
        const correo = String(f[kCorreo]||"").trim().toLowerCase();
        if(!nombres && !correo) return;
        let pass = String(kPass ? f[kPass] : "").trim();
        if(!pass && correo) pass = correo.split("@")[0].replace(/[^a-zA-Z0-9]/g,"") + "2026A";
        if(pass && !/[A-Z]/.test(pass)) pass = pass.charAt(0).toUpperCase() + pass.slice(1);
        const tutorRaw = String(kTutor ? f[kTutor] : "").trim().toLowerCase();
        const esTutor = ["si","sí","1","true","tutor"].includes(tutorRaw);
        let gradoRaw = kGrado ? String(f[kGrado]||"").trim() : "";
        let seccionRaw = kSecc ? String(f[kSecc]||"").trim() : "";
        // parsear si grado trae sección pegada
        let grado = normGrado(gradoRaw);
        let seccion = normSeccion(seccionRaw, gradoRaw);
        // si grado aún vacío pero seccion tiene grado (ej. "4to D" en seccion), intenta split
        if(!grado && seccionRaw){
          const m=String(seccionRaw).trim().match(/^([1-6]\s*ro|1ro|2do|3ro|4to|5to|6to)\s*([A-Z])$/i);
          if(m){ grado=normGrado(m[1]); seccion=m[2].toUpperCase(); }
        }
        const cursoRaw = kCurso ? String(f[kCurso]||"").trim() : "";
        // split cursos por coma / punto y coma
        const cursos = cursoRaw ? cursoRaw.split(/[,;]+/).map(s=>s.trim()).filter(Boolean) : [""];
        cursos.forEach(curso=>{
          mapeados.push({ fila: idx+2, nombres, apellidos, correo, password: pass, esTutor, grado, seccion, curso, estado:"Pendiente" });
        });
      });
      // validación rápida
      const sinCorreo = mapeados.filter(r=> !r.correo || !r.correo.includes("@"));
      if(sinCorreo.length){ alert(`Hay ${sinCorreo.length} filas sin correo válido (ej. fila ${sinCorreo[0].fila}).`); }
      _excelDocentes = mapeados;
      renderVistaPreviaDocentes();
      event.target.value="";
    }catch(err){ alert("Error leyendo Excel: "+err.message); }
  };
  if(file.name.endsWith(".csv")) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function renderVistaPreviaDocentes(){
  const cont = document.getElementById("vistaPreviaExcelDocentes");
  const btn = document.getElementById("btnRegistrarExcelDocentes");
  if(!cont) return;
  if(!_excelDocentes.length){ cont.innerHTML=""; btn?.classList.add("oculto"); return; }
  cont.innerHTML = `
    <div style="background:white; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <div style="padding:10px 14px; background:#f9fafb; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:13px;">Vista previa (${_excelDocentes.length} filas)</strong>
        <span style="font-size:11px; color:#6b7280;">Editable: corrige antes de registrar — Grado/Sección obligatorios si hay Curso</span>
      </div>
      <div style="overflow-x:auto; max-height:320px;">
        <table class="admin-table" style="font-size:12px;">
          <thead><tr><th>#</th><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Contraseña</th><th>Tutor</th><th>Grado/Secc/Curso</th><th>Estado</th></tr></thead>
          <tbody>
            ${_excelDocentes.map((d,i)=>{
              const faltaSeccion = d.curso && (!d.grado || !d.seccion);
              const incompleto = !d.nombres || !d.correo || faltaSeccion;
              return `
              <tr data-fila="${i}" style="${faltaSeccion ? 'background:#fff5f5;' : ''}">
                <td>${d.fila}</td>
                <td><input value="${escaparHtml(d.nombres)}" oninput="editarFilaDocente(${i},'nombres',this.value)" style="width:110px; padding:4px 6px; border:1px solid ${!d.nombres?'#fca5a5':'#d1d5db'}; border-radius:6px; font-size:11px;"></td>
                <td><input value="${escaparHtml(d.apellidos)}" oninput="editarFilaDocente(${i},'apellidos',this.value)" style="width:110px; padding:4px 6px; border:1px solid #d1d5db; border-radius:6px; font-size:11px;"></td>
                <td><input value="${escaparHtml(d.correo)}" oninput="editarFilaDocente(${i},'correo',this.value)" style="width:160px; padding:4px 6px; border:1px solid ${!d.correo?'#fca5a5':'#d1d5db'}; border-radius:6px; font-size:11px;"></td>
                <td><input value="${escaparHtml(d.password)}" oninput="editarFilaDocente(${i},'password',this.value)" style="width:110px; padding:4px 6px; border:1px solid #d1d5db; border-radius:6px; font-size:11px;" placeholder="auto"></td>
                <td style="text-align:center;">${d.esTutor?'<span class="badge badge-blue">SI</span>':'<span class="badge badge-gray">NO</span>'}</td>
                <td style="font-size:10.5px; color:${faltaSeccion?'#b91c1c':'#374151'};">
                  <div style="display:flex; gap:4px;">
                    <input value="${escaparHtml(d.grado)}" placeholder="Grado" oninput="editarFilaDocente(${i},'grado',this.value)" style="width:50px; padding:3px 6px; border:1px solid ${faltaSeccion?'#fca5a5':'#d1d5db'}; border-radius:6px; font-size:10.5px;">
                    <input value="${escaparHtml(d.seccion)}" placeholder="Sec" maxlength="1" oninput="editarFilaDocente(${i},'seccion',this.value.toUpperCase())" style="width:36px; padding:3px 6px; border:1px solid ${faltaSeccion?'#fca5a5':'#d1d5db'}; border-radius:6px; font-size:10.5px; text-transform:uppercase;">
                    <input value="${escaparHtml(d.curso)}" placeholder="Curso" oninput="editarFilaDocente(${i},'curso',this.value)" style="flex:1; padding:3px 6px; border:1px solid #d1d5db; border-radius:6px; font-size:10.5px;">
                  </div>
                  ${faltaSeccion ? '<div style="color:#b91c1c; font-size:10px; margin-top:2px;">Falta Grado/Sección</div>' : ''}
                </td>
                <td class="excel-estado" style="font-size:10.5px; font-weight:600; color:${incompleto?'#b91c1c':'#6b7280'};">${faltaSeccion ? '<svg viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Falta seccion' : d.estado}</td>
              </tr>
            `}).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  const btnL = document.getElementById("btnLimpiarExcelDocentes");
  if(btn){ btn.classList.remove("oculto"); btn.textContent=`Registrar todos (${_excelDocentes.length})`; }
  if(btnL) btnL.classList.remove("oculto");
  if(!_excelDocentes.length){
    btn?.classList.add("oculto");
    btnL?.classList.add("oculto");
  }
}

function editarFilaDocente(idx, campo, valor){
  if(_excelDocentes[idx]) _excelDocentes[idx][campo]=valor;
  // re-render para actualizar validación visual si cambia grado/seccion
  if(["grado","seccion","curso"].includes(campo)) renderVistaPreviaDocentes();
}
function limpiarVistaPreviaDocentes(){
  _excelDocentes=[];
  document.getElementById("vistaPreviaExcelDocentes").innerHTML="";
  document.getElementById("btnRegistrarExcelDocentes")?.classList.add("oculto");
  document.getElementById("btnLimpiarExcelDocentes")?.classList.add("oculto");
  const inp=document.getElementById("excelDocentesInput");
  if(inp) inp.value="";
}
function limpiarVistaPreviaDocentes(){
  _excelDocentes=[];
  document.getElementById("vistaPreviaExcelDocentes").innerHTML="";
  document.getElementById("btnRegistrarExcelDocentes")?.classList.add("oculto");
  document.getElementById("btnLimpiarExcelDocentes")?.classList.add("oculto");
  const inp=document.getElementById("excelDocentesInput");
  if(inp) inp.value="";
}

async function registrarTodosDocentesExcel(){
  if(!_excelDocentes.length) return;
  const btn = document.getElementById("btnRegistrarExcelDocentes");
  btn.disabled=true; btn.textContent="Registrando...";
  // Asegurar cache de secciones (si está vacío, el POST de secciones fallará por duplicado)
  if(!_seccionesCache.length){
    try{ _seccionesCache = await apiFetch("/postgres/secciones"); }catch(e){ _seccionesCache=[]; }
  }
  // Agrupar por correo para docentes con múltiples cursos/secciones
  const grupos = {};
  _excelDocentes.forEach(d=>{
    const key = d.correo.toLowerCase();
    if(!grupos[key]) grupos[key]={ nombres:d.nombres, apellidos:d.apellidos, correo:d.correo, password:d.password, esTutor:d.esTutor, cursos:[] };
    if(d.grado && d.seccion){
      const texto = `${d.grado} ${d.seccion}`;
      let g = grupos[key].cursos.find(c=>c.seccionTexto===texto);
      if(g){ if(d.curso) g.nombres.push(d.curso); }
      else grupos[key].cursos.push({ grado:d.grado, letra:d.seccion, seccionTexto:texto, nombres: d.curso ? [d.curso] : [] });
    }
  });
  // pre-validación: filas con Curso pero sin Grado/Sección
  const filasInvalidas = _excelDocentes.filter(d=> d.curso && (!d.grado || !d.seccion));
  if(filasInvalidas.length){
    const ej = filasInvalidas[0];
    if(window.mostrarToastGlobal) mostrarToastGlobal(`Fila ${ej.fila}: si pones Curso "${ej.curso}" debes poner Grado y Sección (ej. 4to D). Corrige en la vista previa.`, "warn");
    else alert(`Fila ${ej.fila}: falta Grado/Sección para Curso "${ej.curso}"`);
    btn.disabled=false; btn.textContent=`Registrar todos (${_excelDocentes.length})`;
    renderVistaPreviaDocentes();
    return;
  }
  let ok=0, fail=0;
  for(const key of Object.keys(grupos)){
    const d = grupos[key];
    const idxs = _excelDocentes.map((x,i)=> x.correo.toLowerCase()===key ? i : -1).filter(i=>i!==-1);
    const celdas = idxs.map(i=> document.querySelector(`#vistaPreviaExcelDocentes tr[data-fila="${i}"] .excel-estado`)).filter(Boolean);
    try{
      // validar
      if(!d.nombres || !d.apellidos || !d.correo) throw new Error("Faltan nombres/correo");
      const pwErr = validarPasswordFuerte(d.password);
      if(pwErr) throw new Error(pwErr);
      if(!d.cursos.length) throw new Error("Asigna al menos una sección (Grado+Sección+Curso)");
      // crear secciones si no existen (reusa _seccionesCache)
      const secciones=[];
      for(const curso of d.cursos){
        const nivel = ["1ro","2do"].includes(curso.grado) ? "Primaria" : "Secundaria";
        let seccion = _seccionesCache.find(s=>s.nivel===nivel && s.grado===curso.grado && s.letra===curso.letra);
        if(!seccion){
          try{
            seccion = await apiFetch("/postgres/secciones",{method:"POST", body:{nivel, grado:curso.grado, letra:curso.letra}});
            _seccionesCache.push(seccion);
          }catch(e){
            const msg=String(e.message||"");
            if(msg.toLowerCase().includes("existe") || msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("ya existe")){
              try{ _seccionesCache = await apiFetch("/postgres/secciones"); }catch(_){}
              seccion = _seccionesCache.find(s=>s.nivel===nivel && s.grado===curso.grado && s.letra===curso.letra);
              if(!seccion) throw e;
            } else throw e;
          }
        }
        secciones.push({ seccionId: seccion.id, asignaturas:[], asignaturasNuevas: curso.nombres });
      }
      await apiFetch("/admin/docentes",{method:"POST", body:{ nombres:d.nombres, apellidos:d.apellidos, correo:d.correo, password:d.password, esTutor:d.esTutor, secciones }});
      ok++;
      celdas.forEach(c=>{ c.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px;"><path d="M20 6L9 17l-5-5"/></svg>Registrado'; c.style.color="#059669"; });
      _excelDocentes.filter(x=>x.correo.toLowerCase()===key).forEach(x=>x.estado="OK");
    }catch(e){
      const msg = String(e.message||"Error");
      const esDuplicado = msg.toLowerCase().includes("ya existe") || msg.toLowerCase().includes("existe") || msg.toLowerCase().includes("duplicate");
      fail++;
      celdas.forEach(c=>{ c.innerHTML=(esDuplicado?'<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Ya existe':`<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> `)+msg.slice(0,38); c.style.color= esDuplicado ? "#d97706" : "#dc2626"; });
      _excelDocentes.filter(x=>x.correo.toLowerCase()===key).forEach(x=>x.estado= esDuplicado ? "Ya existe" : "Error");
    }
  }
  btn.disabled=false; btn.textContent=`Registrar todos (${_excelDocentes.length})`;
  if(window.mostrarToastGlobal) mostrarToastGlobal(`Docentes: ${ok} registrados, ${fail} con error.` , fail? "warn":"ok");
  else alert(`Docentes: ${ok} registrados, ${fail} con error.`);
  await cargarDocentesAdmin();
  await cargarPanelDirector();
  // Auto-limpiar si todo OK
  if(ok>0 && fail===0){
    setTimeout(()=>{ limpiarVistaPreviaDocentes(); if(window.mostrarToastGlobal) mostrarToastGlobal("Vista previa limpiada automáticamente.","ok"); }, 1200);
  }
}
// ═══════════════════════════════════════════════════════════════

// ── Auditoría de accesos (ISO 27001 A.8.15, solo dirección) ──
async function cargarAuditoria() {
  const tabla = document.getElementById("tablaAuditoria");
  if (!tabla) return;
  const accion = document.getElementById("audAccion")?.value || "";
  const estId = document.getElementById("audEstudiante")?.value || "";
  tabla.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Cargando...</td></tr>';
  try {
    const params = new URLSearchParams({ limite: "100" });
    if (accion) params.set("accion", accion);
    if (estId) params.set("estudiante_id", estId);
    const rows = await apiFetch("/admin/auditoria?" + params.toString());
    if (!rows.length) {
      tabla.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Sin registros.</td></tr>';
      return;
    }
    tabla.innerHTML = rows.map(r => `
      <tr>
        <td>${String(r.fecha || "").slice(0, 16).replace("T", " ")}</td>
        <td>${r.usuario_correo || ("#" + (r.usuario_id ?? "?"))}</td>
        <td>${r.rol || "-"}</td>
        <td><strong>${r.accion}</strong></td>
        <td>${r.estudiante_nombre || (r.estudiante_id ? "#" + r.estudiante_id : "-")}</td>
        <td>${r.detalle || "-"}</td>
      </tr>`).join("");
  } catch (e) {
    tabla.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#b91c1c;">Error: ${e.message}</td></tr>`;
  }
}
