// Portal del estudiante: formularios, historial e incidentes — SAT Escolar

async function cargarFormularioEstudiante() {
  try {
    const user = getUser();
    const formulario = await apiFetch("/postgres/estudiantes/me/formulario-activo");

    const contenido    = document.getElementById("contenidoFormulario");
    const sinFormulario= document.getElementById("sinFormulario");
    const tituloActivo = document.getElementById("estadoCuestionarioTitulo");
    const detalleActivo = document.getElementById("detalleCuestionarioActivo");
    const badgeActivo = document.getElementById("estadoCuestionarioBadge");
    const btnResponder = document.getElementById("btnResponderCuestionario");
    const resumenActivo = document.getElementById("estadoCuestionarioResumen");
    const preguntasContainer = document.getElementById("preguntasFormularioEstudiante");

    if (!formulario) {
      contenido?.classList.add("oculto");
      sinFormulario?.classList.remove("oculto");
      if (preguntasContainer) preguntasContainer.innerHTML = "";
      if (tituloActivo) tituloActivo.textContent = "Sin cuestionario activo";
      if (detalleActivo) detalleActivo.innerHTML = "Cuando tu docente o psicólogo habilite un formulario, aparecerá aquí.";
      if (resumenActivo) resumenActivo.textContent = "No tienes formularios pendientes por responder.";
      if (badgeActivo) {
        badgeActivo.textContent = "Sin actividad";
        badgeActivo.classList.add("is-empty");
      }
      btnResponder?.classList.add("oculto");
      cargarHistorialEstudiante();
      return;
    }

    contenido?.classList.remove("oculto");
    sinFormulario?.classList.add("oculto");
    if (resumenActivo) resumenActivo.textContent = "Tienes 1 formulario pendiente por responder.";
    const nombreCuestionario = formulario.titulo || `Cuestionario Socioemocional - ${formatearMesAnio(formulario.fecha_habilitacion)}`;
    if (tituloActivo) tituloActivo.textContent = nombreCuestionario;
    if (detalleActivo) {
      detalleActivo.innerHTML = `
        <p>Habilitado por: ${formulario.habilitado_por || "Prof. SAT Escolar"}</p>
        <p>Fecha límite: <span style="color:#ea580c;font-weight:800;">${calcularFechaLimite(formulario.fecha_habilitacion || formulario.created_at)}</span></p>`;
    }
    if (badgeActivo) {
      badgeActivo.textContent = "Pendiente";
      badgeActivo.classList.remove("is-empty");
    }
    btnResponder?.classList.remove("oculto");

    const grupoInfo = document.getElementById("grupoInfo");
    if (grupoInfo) grupoInfo.textContent = `${user.nivel || formulario.nivel || ""} ${user.grado || formulario.grado || ""} ${user.seccion || formulario.seccion || ""}`.trim();

    localStorage.setItem("sat_formulario_activo", JSON.stringify(formulario));

    if (preguntasContainer) {
      preguntasContainer.innerHTML = (formulario.preguntas || []).map((p, index) => {
        if (p.tipo === "cerrada" || p.tipo === "likert") {
          const opciones = Array.isArray(p.opciones) ? p.opciones : [];
          return `
            <div class="form-group student-question" data-pregunta-id="${p.id}" data-tipo="${p.tipo}">
              <label>${index + 1}. ${p.pregunta}</label>
              <select class="respuesta-estudiante" data-pregunta-id="${p.id}">
                <option value="">Selecciona una opción</option>
                ${opciones.map(op => `<option value="${op}">${op}</option>`).join("")}
              </select>
            </div>`;
        }
        return `
          <div class="form-group student-question" data-pregunta-id="${p.id}" data-tipo="abierta">
            <label>${index + 1}. ${p.pregunta}</label>
            <textarea class="respuesta-estudiante" data-pregunta-id="${p.id}" placeholder="Escribe tu respuesta aquí..."></textarea>
          </div>`;
      }).join("");
    }

    await cargarHistorialEstudiante();
  } catch (e) { console.error("Error cargando formulario:", e); }
}


async function enviarFormularioEstudiante() {
  const formulario = JSON.parse(localStorage.getItem("sat_formulario_activo") || "null");
  if (!formulario) { alert("No hay formulario activo."); return; }

  const controles = [...document.querySelectorAll(".respuesta-estudiante")];
  const respuestas = controles.map(el => ({
    preguntaId: Number(el.dataset.preguntaId),
    respuesta: el.value.trim()
  }));
  if (respuestas.length === 0 || respuestas.some(r => !r.preguntaId || !r.respuesta)) {
    alert("Completa todas las preguntas antes de enviar.");
    return;
  }

  try {
    await apiFetch(`/postgres/estudiantes/me/formularios/${formulario.id}/respuestas`, {
      method: "POST",
      body: { respuestas }
    });

    alert("Respuestas enviadas correctamente. Gracias por responder con sinceridad.");
    controles.forEach(el => { el.value = ""; });
    cargarFormularioEstudiante();
  } catch (e) { alert("Error: " + e.message); }
}


async function inicializarPanelEstudiante() {
  const user = getUser();
  const nombre = user.fullName || "Estudiante";
  const primerNombre = nombre.split(" ")[0] || nombre;
  const saludo = document.getElementById("saludoEstudiante");
  const perfil = document.getElementById("nombreEstudiantePerfil");

  cargarSidebarUsuario();

  if (saludo) saludo.textContent = `Hola, ${primerNombre}!`;
  if (perfil) perfil.textContent = nombre;

  mostrarSeccionEstudiante("est-inicio");
  await verificarPerfilObligatorio();
  await cargarFormularioEstudiante();
}

async function verificarPerfilObligatorio(){
  try{
    const data = await apiFetch("/postgres/ficha-diagnostica");
    const m = document.getElementById("modalPerfilObligatorio");
    const btn = document.getElementById("btnResponderCuestionario");
    if(!data.completada){
      // OBLIGATORIO: modal bloqueante con colores del sistema (#063b91/#03275f/#f2b51d).
      // Sin botón cerrar: solo se oculta al guardar la ficha.
      if(m) { m.style.display = "flex"; m.classList.remove("oculto"); }
      document.body.style.overflow = "hidden";
      // Bloquear cuestionarios hasta completar la ficha socioeducativa
      if(btn){ btn.disabled = true; btn.title = "Completa tu ficha socioeducativa primero"; btn.classList.add("oculto"); }
      const resumen = document.getElementById("estadoCuestionarioResumen");
      if (resumen) resumen.textContent = "Primero completa tu Ficha Diagnóstica Socioeducativa (obligatoria).";
    } else {
      if(m) { m.style.display = "none"; }
      document.body.style.overflow = "";
      if(btn){ btn.disabled = false; btn.title = ""; }
    }
    return data;
  }catch(e){ console.warn("ficha check", e.message); return null; }
}


async function cargarHistorialEstudiante() {
  const tabla = document.getElementById("tablaHistorialEstudiante");
  if (!tabla) return;

  try {
    const respuestas = await apiFetch("/postgres/estudiantes/me/formularios/historial");

    localStorage.setItem("sat_historial_estudiante", JSON.stringify(respuestas));
    if (respuestas.length === 0) {
      tabla.innerHTML = '<tr><td colspan="4" class="student-empty">Sin cuestionarios respondidos todavía.</td></tr>';
      return;
    }

    tabla.innerHTML = respuestas.slice(0, 6).map(r => `
      <tr>
        <td>${r.titulo}</td>
        <td>${formatearFechaLarga(r.fecha_respondida)}</td>
        <td><span class="student-complete-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;vertical-align:-1px;margin-right:3px;"><path d="M20 6L9 17l-5-5"/></svg>Completado</span></td>
        <td><button class="student-eye-btn" onclick="verDetalleHistorialEstudiante(${r.id})" title="Ver detalle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
      </tr>`).join("");
  } catch (e) {
    tabla.innerHTML = '<tr><td colspan="4" class="student-empty">No se pudo cargar el historial.</td></tr>';
  }
}


function verDetalleHistorialEstudiante(id) {
  const historial = JSON.parse(localStorage.getItem("sat_historial_estudiante") || "[]");
  const r = historial.find(item => item.id === id);
  if (!r) return;
  alert(`${r.titulo}\nFecha respondida: ${formatearFechaLarga(r.fecha_respondida)}\nEstado: Respondido`);
}


function abrirModalReporteAnonimo() {
  document.getElementById("modalReporteAnonimo")?.classList.remove("oculto");
}


function guardarEstudianteSeleccionado() {
  const user = getUser();
  if (user.studentId) localStorage.setItem("sat_estudiante_id", user.studentId);
}


function mostrarSeccionEstudiante(idSeccion) {
  document.querySelectorAll(".seccion-estudiante").forEach(s => s.classList.add("oculto"));
  document.getElementById(idSeccion)?.classList.remove("oculto");
  document.querySelectorAll(".sidebar-nav a, .student-nav a, .nav a").forEach(l => l.classList.remove("active"));
  document.querySelectorAll(".sidebar-nav a, .student-nav a, .nav a").forEach(l => {
    if (l.getAttribute("onclick")?.includes(idSeccion)) l.classList.add("active");
  });
  if (idSeccion === "est-inicio" || idSeccion === "est-cuestionarios" || idSeccion === "est-formulario") cargarFormularioEstudiante();
  if (idSeccion === "est-perfil" && typeof cargarMiHistorial === "function") cargarMiHistorial();
  if (idSeccion === "est-incidente")  cargarSelectEstudianteIncidente();
  if (idSeccion === "est-chat") cargarChatAnonimoMio();
}

// ── MODALES ───────────────────────────────────────────────────────────────────

