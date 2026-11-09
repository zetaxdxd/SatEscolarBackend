// Evaluación académica y panel del docente (competencias, calificaciones, navegación) — SAT Escolar

let _docenteNotaSecciones = [];

let _docentePeriodosAcademicos = [];

let _docenteAsignaturas = [];

let _docenteEvaluacionActual = null;

let _docenteNotasCargando = false;

let _portalDocenteSecciones = [];

let _portalDocentePeriodos = [];

async function cargarPanelDocente() {
  try {
    const user = getUser();
    const nombre = user.fullName || "Docente";
    const primerNombre = nombre.split(" ")[0] || nombre;
    const saludo = document.getElementById("saludoDocente");
    const topbar = document.getElementById("nombreDocenteTopbar");
    const fecha = document.getElementById("fechaDocente");

    cargarSidebarUsuario();

    if (saludo) saludo.textContent = "Portal docente";
    if (topbar) topbar.textContent = nombre;
    if (fecha) fecha.textContent = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

    await cargarFiltrosSalonDocente();
    await actualizarResumenEvidenciasDocente();
    await actualizarResumenCuestionariosDocente();
    await inicializarNotasDocente();
    await cargarPortalDocente();
  } catch (e) {
    console.error("Error cargando panel:", e);
  }
}


async function inicializarPanelDocente() {
  const user = getUser();
  if (user.esTutor) {
    document.querySelectorAll(".solo-tutor").forEach(el => el.style.display = "");
  } else {
    document.querySelectorAll(".solo-tutor").forEach(el => el.style.display = "none");
  }
  mostrarSeccionDocente("doc-salones");
  await cargarPanelDocente();
}


function gradoDocente() {
  return _docenteSalonActual?.grado || "";
}


function seccionDocente() {
  return _docenteSalonActual?.seccion || "";
}


async function inicializarNotasDocente() {
  const seccionEl = document.getElementById("notaSeccion");
  const periodoEl = document.getElementById("notaPeriodo");
  const asignaturaEl = document.getElementById("notaAsignatura");
  if (!seccionEl || !periodoEl || !asignaturaEl) return;
  if (_docenteNotasCargando) return;
  _docenteNotasCargando = true;

  seccionEl.innerHTML = '<option value="">Cargando secciones...</option>';
  periodoEl.innerHTML = '<option value="">Cargando periodos...</option>';
  asignaturaEl.innerHTML = '<option value="">Cargando asignaturas...</option>';

  try {
    const [seccionesResult, periodosResult, asignaturasResult] = await Promise.allSettled([
      apiFetch("/postgres/secciones"),
      apiFetch("/postgres/periodos-academicos"),
      apiFetch("/postgres/asignaturas")
    ]);

    _docenteNotaSecciones = seccionesResult.status === "fulfilled"
      ? seccionesResult.value.map(s => ({
          seccion_id: s.id,
          nivel: s.nivel,
          grado: s.grado,
          letra: s.letra
        }))
      : [];
    _docentePeriodosAcademicos = periodosResult.status === "fulfilled" ? periodosResult.value : [];
    _docenteAsignaturas = asignaturasResult.status === "fulfilled" ? asignaturasResult.value : [];

    seccionEl.innerHTML = _docenteNotaSecciones.length
      ? _docenteNotaSecciones.map(s => `<option value="${s.seccion_id}">${escaparHtml(s.nivel)} - ${escaparHtml(s.grado)} ${escaparHtml(s.letra)}</option>`).join("")
      : '<option value="">Sin salones registrados</option>';
    periodoEl.innerHTML = _docentePeriodosAcademicos.length
      ? _docentePeriodosAcademicos.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)} ${p.anio}</option>`).join("")
      : '<option value="">Sin periodos activos</option>';
    asignaturaEl.innerHTML = _docenteAsignaturas.length
      ? _docenteAsignaturas.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join("")
      : '<option value="">Sin asignaturas</option>';

    const fecha = document.getElementById("notaEvaluacionFecha");
    if (fecha && !fecha.value) fecha.value = fechaLocalISO();
    seccionEl.onchange = async () => {
      await cargarAsignaturasNotasDocente();
      await cargarEvaluacionesDocente();
    };
    periodoEl.onchange = cargarEvaluacionesDocente;
    asignaturaEl.onchange = cargarEvaluacionesDocente;
    if (periodosResult.status === "rejected" || asignaturasResult.status === "rejected") {
      limpiarTablaNotasDocente("No se pudieron cargar todos los datos académicos. Revisa que el backend esté encendido y la base esté inicializada.");
      return;
    }
    await cargarAsignaturasNotasDocente();
    await cargarEvaluacionesDocente();
  } catch (error) {
    seccionEl.innerHTML = '<option value="">Error al cargar secciones</option>';
    periodoEl.innerHTML = '<option value="">Error al cargar periodos</option>';
    asignaturaEl.innerHTML = '<option value="">Error al cargar asignaturas</option>';
    document.getElementById("tablaNotasDocente").innerHTML = `<tr><td colspan="4" class="teacher-v2-empty">No se pudo preparar el registro de notas: ${escaparHtml(error.message)}</td></tr>`;
  } finally {
    _docenteNotasCargando = false;
  }
}


async function cargarAsignaturasNotasDocente() {
  const seccionId = document.getElementById("notaSeccion")?.value;
  const asignaturaEl = document.getElementById("notaAsignatura");
  if (!asignaturaEl) return;
  if (!seccionId) {
    asignaturaEl.innerHTML = '<option value="">Selecciona una sección</option>';
    return;
  }

  asignaturaEl.innerHTML = '<option value="">Cargando asignaturas...</option>';
  try {
    _docenteAsignaturas = await apiFetch(`/postgres/asignaturas?seccionId=${encodeURIComponent(seccionId)}`);
    asignaturaEl.innerHTML = _docenteAsignaturas.length
      ? _docenteAsignaturas.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join("")
      : '<option value="">Sin asignaturas asignadas</option>';
  } catch (error) {
    asignaturaEl.innerHTML = '<option value="">Error al cargar asignaturas</option>';
    throw error;
  }
}


function asegurarInicializacionNotasDocente() {
  const notasVisible = !document.getElementById("doc-notas")?.classList.contains("oculto");
  if (notasVisible && !_cursoCompetenciaActual) inicializarNotasDocente();
}


async function cargarEvaluacionesDocente(evaluacionPreferida = null) {
  const select = document.getElementById("notaEvaluacionSelect");
  if (!select) return;
  const seccionId = document.getElementById("notaSeccion")?.value;
  const periodoId = document.getElementById("notaPeriodo")?.value;
  const asignaturaId = document.getElementById("notaAsignatura")?.value;
  if (!seccionId || !periodoId || !asignaturaId) {
    select.innerHTML = '<option value="">Sin evaluaciones registradas</option>';
    limpiarTablaNotasDocente("Completa los datos académicos para continuar.");
    return;
  }

  try {
    const evaluaciones = await apiFetch(
      `/postgres/evaluaciones-academicas?seccionId=${encodeURIComponent(seccionId)}&periodoId=${encodeURIComponent(periodoId)}&asignaturaId=${encodeURIComponent(asignaturaId)}`
    );
    if (evaluaciones.length === 0) {
      select.innerHTML = '<option value="">Sin evaluaciones registradas</option>';
      limpiarTablaNotasDocente("Crea la primera evaluación para este salón.");
      return;
    }

    select.innerHTML = evaluaciones.map(ev => `
      <option value="${ev.id}">${escaparHtml(ev.nombre)} - ${String(ev.fecha || "").slice(0, 10)}</option>
    `).join("");
    const idPreferido = String(evaluacionPreferida || "");
    select.value = evaluaciones.some(ev => String(ev.id) === idPreferido)
      ? idPreferido
      : String(evaluaciones[0].id);
    await cargarNotasEvaluacionDocente(select.value);
  } catch (error) {
    limpiarTablaNotasDocente("No se pudieron cargar las evaluaciones.");
  }
}


function limpiarTablaNotasDocente(mensaje) {
  _docenteEvaluacionActual = null;
  const tabla = document.getElementById("tablaNotasDocente");
  if (tabla) tabla.innerHTML = `<tr><td colspan="4" class="teacher-v2-empty">${escaparHtml(mensaje)}</td></tr>`;
  const guardar = document.getElementById("btnGuardarNotasDocente");
  if (guardar) guardar.disabled = true;
}


async function crearEvaluacionDocente() {
  const boton = document.getElementById("btnCrearEvaluacion");
  const nombre = document.getElementById("notaEvaluacionNombre")?.value.trim();
  const seccionId = Number(document.getElementById("notaSeccion")?.value);
  const periodoId = Number(document.getElementById("notaPeriodo")?.value);
  const asignaturaId = Number(document.getElementById("notaAsignatura")?.value);
  const fecha = document.getElementById("notaEvaluacionFecha")?.value;
  const peso = Number(document.getElementById("notaEvaluacionPeso")?.value || 1);

  if (!nombre || !seccionId || !periodoId || !asignaturaId || !fecha) {
    alert("Completa sección, periodo, asignatura, nombre y fecha.");
    return;
  }
  if (!Number.isFinite(peso) || peso <= 0 || peso > 100) {
    alert("El peso debe ser mayor que 0 y menor o igual a 100.");
    return;
  }

  try {
    if (boton) { boton.disabled = true; boton.textContent = "Creando..."; }
    const evaluacion = await apiFetch("/postgres/evaluaciones-academicas", {
      method: "POST",
      body: { seccionId, periodoId, asignaturaId, nombre, fecha, peso }
    });
    document.getElementById("notaEvaluacionNombre").value = "";
    await cargarEvaluacionesDocente(evaluacion.id);
  } catch (error) {
    alert("No se pudo crear la evaluación: " + error.message);
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = "Crear evaluación"; }
  }
}


async function cargarNotasEvaluacionDocente(evaluacionId) {
  if (!evaluacionId) {
    limpiarTablaNotasDocente("Selecciona o crea una evaluación.");
    return;
  }
  const tabla = document.getElementById("tablaNotasDocente");
  try {
    const estudiantes = await apiFetch(`/postgres/evaluaciones-academicas/${evaluacionId}/notas`);
    _docenteEvaluacionActual = Number(evaluacionId);
    if (estudiantes.length === 0) {
      limpiarTablaNotasDocente("La sección no tiene estudiantes registrados.");
      return;
    }

    tabla.innerHTML = estudiantes.map((e, index) => {
      const nombre = `${e.nombres || ""} ${e.apellidos || ""}`.trim();
      const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
      const valor = e.valor === null || e.valor === undefined ? "" : Number(e.valor);
      return `
        <tr data-estudiante-id="${e.estudiante_id}">
          <td>
            <div class="teacher-v2-student-cell">
              <span class="teacher-v2-row-number">${String(index + 1).padStart(2, "0")}</span>
              <span class="teacher-v2-avatar">${escaparHtml(iniciales || "ES")}</span>
              <span><strong>${escaparHtml(nombre)}</strong></span>
            </div>
          </td>
          <td><span class="teacher-v2-email">${escaparHtml(e.correo)}</span></td>
          <td><input class="teacher-v2-grade-input" type="number" min="0" max="20" step="0.01" value="${valor}" placeholder="0-20"></td>
          <td><input class="teacher-v2-grade-observation" type="text" maxlength="300" value="${escaparHtml(e.observacion || "")}" placeholder="Opcional"></td>
        </tr>`;
    }).join("");
    document.getElementById("btnGuardarNotasDocente").disabled = false;
  } catch (error) {
    limpiarTablaNotasDocente("No se pudieron cargar los estudiantes de la evaluación.");
  }
}


async function guardarNotasDocente() {
  if (!_docenteEvaluacionActual) return;
  const boton = document.getElementById("btnGuardarNotasDocente");
  const filas = [...document.querySelectorAll("#tablaNotasDocente tr[data-estudiante-id]")];
  const registros = [];

  for (const fila of filas) {
    const input = fila.querySelector(".teacher-v2-grade-input");
    if (!input || input.value === "") continue;
    const valor = Number(input.value);
    if (!Number.isFinite(valor) || valor < 0 || valor > 20) {
      input.focus();
      alert("Todas las notas deben estar entre 0 y 20.");
      return;
    }
    registros.push({
      estudianteId: Number(fila.dataset.estudianteId),
      valor,
      observacion: fila.querySelector(".teacher-v2-grade-observation")?.value.trim() || null
    });
  }

  if (registros.length === 0) {
    alert("Ingresa al menos una nota antes de guardar.");
    return;
  }

  try {
    boton.disabled = true;
    boton.textContent = "Guardando...";
    await apiFetch(`/postgres/evaluaciones-academicas/${_docenteEvaluacionActual}/notas`, {
      method: "POST",
      body: { registros }
    });
    alert(`${registros.length} nota${registros.length === 1 ? "" : "s"} guardada${registros.length === 1 ? "" : "s"} correctamente.`);
    await cargarNotasEvaluacionDocente(_docenteEvaluacionActual);
  } catch (error) {
    alert("No se pudieron guardar las notas: " + error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Guardar notas";
  }
}

// -- NOTAS POR COMPETENCIAS -------------------------------------------------


let _productoCompetenciaActual = null;

let _nivelesLogroDisponibles = [];


async function inicializarNotasDocente() {
  const seccionEl = document.getElementById("notaSeccion");
  const trimestreEl = document.getElementById("notaTrimestre");
  if (!seccionEl || !trimestreEl || _docenteNotasCargando) return;

  _docenteNotasCargando = true;
  try {
    const anio = Number(document.getElementById("portalDocenteAnio")?.value || new Date().getFullYear());
    const [secciones, trimestres, niveles] = await Promise.all([
      apiFetch("/postgres/docentes/me/secciones"),
      apiFetch(`/postgres/trimestres-academicos?anio=${anio}`),
      apiFetch("/postgres/niveles-logro")
    ]);
    _docenteNotaSecciones = secciones;
    _nivelesLogroDisponibles = niveles;

    const seccionActual = seccionEl.value;
    seccionEl.innerHTML = secciones.length
      ? secciones.map(s => `<option value="${s.seccion_id}">${escaparHtml(s.grado)} ${escaparHtml(s.letra)} · ${escaparHtml(s.nivel)}</option>`).join("")
      : '<option value="">Sin secciones asignadas</option>';
    if (secciones.some(s => String(s.seccion_id) === seccionActual)) seccionEl.value = seccionActual;

    const trimestreActual = trimestreEl.value;
    trimestreEl.innerHTML = trimestres.length
      ? trimestres.map(t => `<option value="${t.id}">${escaparHtml(t.nombre)} · ${t.anio}</option>`).join("")
      : '<option value="">Sin bimestres configurados</option>';
    if (trimestres.some(t => String(t.id) === trimestreActual)) trimestreEl.value = trimestreActual;

    renderNivelesLogro();
    await cargarAsignaturasNotasDocente();
    await cargarCompetenciasCurso();
    await cargarProductosCompetencia();
  } catch (error) {
    const tabla = document.getElementById("tablaProductosCompetencia");
    if (tabla) tabla.innerHTML = `<tr><td colspan="5" class="teacher-v2-empty">No se pudo preparar la evaluación por competencias: ${escaparHtml(error.message)}</td></tr>`;
  } finally {
    _docenteNotasCargando = false;
  }
}


async function cargarAsignaturasNotasDocente(asignaturaPreferida = null) {
  const seccionId = document.getElementById("notaSeccion")?.value;
  const asignaturaEl = document.getElementById("notaAsignatura");
  if (!asignaturaEl) return;
  if (!seccionId) {
    asignaturaEl.innerHTML = '<option value="">Selecciona una sección</option>';
    return;
  }

  const actual = String(asignaturaPreferida || asignaturaEl.value || "");
  asignaturaEl.innerHTML = '<option value="">Cargando cursos...</option>';
  _docenteAsignaturas = await apiFetch(`/postgres/asignaturas?seccionId=${encodeURIComponent(seccionId)}`);
  asignaturaEl.innerHTML = _docenteAsignaturas.length
    ? _docenteAsignaturas.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join("")
    : '<option value="">Sin cursos asignados</option>';
  if (_docenteAsignaturas.some(a => String(a.id) === actual)) asignaturaEl.value = actual;
  actualizarContextoCursoCompetencia();
}


async function cambiarCursoCompetencia() {
  const asignaturaActual = document.getElementById("notaAsignatura")?.value;
  await cargarAsignaturasNotasDocente(asignaturaActual);
  await cargarCompetenciasCurso();
  await cargarProductosCompetencia();
  cerrarCalificacionesCompetencia();
}


async function cargarCompetenciasCurso() {
  const asignaturaId = document.getElementById("notaAsignatura")?.value;
  const competenciaEl = document.getElementById("notaCompetencia");
  if (!competenciaEl) return;
  if (!asignaturaId) {
    competenciaEl.innerHTML = '<option value="">Selecciona un curso</option>';
    return;
  }
  const competencias = await apiFetch(`/postgres/asignaturas/${asignaturaId}/competencias`);
  competenciaEl.innerHTML = competencias.length
    ? competencias.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join("")
    : '<option value="">Sin competencias configuradas</option>';
  actualizarContextoCursoCompetencia();
}


function actualizarContextoCursoCompetencia() {
  const seccionId = document.getElementById("notaSeccion")?.value;
  const asignaturaId = document.getElementById("notaAsignatura")?.value;
  const seccion = _docenteNotaSecciones.find(s => String(s.seccion_id) === String(seccionId));
  const asignatura = _docenteAsignaturas.find(a => String(a.id) === String(asignaturaId));
  const cursoNombre = asignatura?.nombre || "Selecciona un curso";
  const seccionNombre = seccion ? `${seccion.grado} ${seccion.letra}` : "-";

  const titulo = document.getElementById("competencyCourseTitle");
  const subtitulo = document.getElementById("competencyCourseSubtitle");
  const formulaCurso = document.getElementById("formulaCurso");
  const formulaSeccion = document.getElementById("formulaSeccion");
  if (titulo) titulo.textContent = `Detalle de calificación: ${cursoNombre}`;
  if (subtitulo) subtitulo.textContent = seccion ? `${seccion.nivel} · ${seccionNombre}` : "Selecciona una sección";
  if (formulaCurso) formulaCurso.textContent = cursoNombre;
  if (formulaSeccion) formulaSeccion.textContent = seccionNombre;
}


function renderNivelesLogro() {
  const contenedor = document.getElementById("nivelesLogroGrid");
  if (!contenedor) return;
  const textosBase = {
    AD: ["Logro destacado", "El estudiante evidencia un nivel superior a lo esperado respecto a la competencia y demuestra aprendizajes que van más allá del nivel esperado."],
    A: ["Logro esperado", "El estudiante evidencia el nivel esperado respecto a la competencia, demostrando manejo satisfactorio en las tareas propuestas y en el tiempo programado."],
    B: ["En proceso", "El estudiante está próximo o cerca al nivel esperado respecto a la competencia y requiere acompañamiento durante un tiempo razonable para lograrlo."],
    C: ["En inicio", "El estudiante muestra un progreso mínimo en la competencia, evidencia dificultades y necesita mayor tiempo de acompañamiento e intervención docente."]
  };
  const niveles = ["AD", "A", "B", "C"].map(codigo => {
    const registrado = _nivelesLogroDisponibles.find(nivel => nivel.codigo === codigo);
    return registrado || { codigo, nombre: textosBase[codigo][0], descripcion: textosBase[codigo][1] };
  });
  contenedor.innerHTML = niveles.map(nivel => `
    <article class="achievement-level achievement-${claseNivelLogro(nivel.codigo)}">
      <span>${escaparHtml(nivel.codigo)}</span>
      <div>
        <h3>${escaparHtml(nivel.nombre)}</h3>
        <p>${escaparHtml(nivel.descripcion)}</p>
      </div>
    </article>
  `).join("");
}


function toggleEscalaLogro() {
  const cuerpo = document.getElementById("achievementFormulaBody");
  const chevron = document.getElementById("achievementFormulaChevron");
  if (!cuerpo) return;
  cuerpo.classList.toggle("oculto");
  if (chevron) chevron.textContent = cuerpo.classList.contains("oculto") ? "⌄" : "⌃";
}


async function crearProductoCompetencia() {
  const boton = document.getElementById("btnCrearProducto");
  const body = {
    seccionId: Number(document.getElementById("notaSeccion")?.value),
    trimestreId: Number(document.getElementById("notaTrimestre")?.value),
    asignaturaId: Number(document.getElementById("notaAsignatura")?.value),
    competenciaId: Number(document.getElementById("notaCompetencia")?.value),
    nombre: document.getElementById("notaProductoNombre")?.value.trim()
  };
  if (!body.seccionId || !body.trimestreId || !body.asignaturaId || !body.competenciaId || !body.nombre) {
    alert("Selecciona bimestre y competencia, y escribe el producto o evidencia.");
    return;
  }
  try {
    boton.disabled = true;
    boton.textContent = "Agregando...";
    await apiFetch("/postgres/productos-evaluacion", { method: "POST", body });
    document.getElementById("notaProductoNombre").value = "";
    await cargarProductosCompetencia();
  } catch (error) {
    alert("No se pudo agregar el producto: " + error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Agregar producto";
  }
}


async function cargarProductosCompetencia() {
  const tabla = document.getElementById("tablaProductosCompetencia");
  const seccionId = document.getElementById("notaSeccion")?.value;
  const asignaturaId = document.getElementById("notaAsignatura")?.value;
  const trimestreId = document.getElementById("notaTrimestre")?.value;
  if (!tabla) return;
  if (!seccionId || !asignaturaId || !trimestreId) {
    tabla.innerHTML = '<tr><td colspan="5" class="teacher-v2-empty">Selecciona curso y bimestre.</td></tr>';
    return;
  }
  try {
    const productos = await apiFetch(`/postgres/productos-evaluacion?seccionId=${encodeURIComponent(seccionId)}&asignaturaId=${encodeURIComponent(asignaturaId)}&trimestreId=${encodeURIComponent(trimestreId)}`);
    tabla.innerHTML = productos.length ? productos.map(producto => `
      <tr>
        <td><span class="competency-trimester-badge">${escaparHtml(producto.trimestre)}</span></td>
        <td>${escaparHtml(producto.competencia)}</td>
        <td><strong>${escaparHtml(producto.nombre)}</strong></td>
        <td>${producto.total_calificaciones}</td>
        <td><button class="teacher-v2-small-btn" onclick="abrirCalificacionesCompetencia(${producto.id})">Calificar</button></td>
      </tr>
    `).join("") : '<tr><td colspan="5" class="teacher-v2-empty">Todavía no hay productos registrados para este bimestre.</td></tr>';
  } catch (error) {
    tabla.innerHTML = '<tr><td colspan="5" class="teacher-v2-empty">No se pudieron cargar los productos.</td></tr>';
  }
}


async function abrirCalificacionesCompetencia(productoId) {
  const panel = document.getElementById("panelCalificacionesCompetencia");
  const tabla = document.getElementById("tablaCalificacionesCompetencia");
  if (!panel || !tabla) return;
  tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">Cargando estudiantes...</td></tr>';
  panel.classList.remove("oculto");
  try {
    const estudiantes = await apiFetch(`/postgres/productos-evaluacion/${productoId}/calificaciones`);
    _productoCompetenciaActual = Number(productoId);
    const primero = estudiantes[0];
    document.getElementById("tituloCalificacionesCompetencia").textContent = primero.producto;
    document.getElementById("subtituloCalificacionesCompetencia").textContent = `${primero.competencia} · ${primero.trimestre}`;
    tabla.innerHTML = estudiantes.map((e, index) => `
      <tr data-estudiante-id="${e.estudiante_id}">
        <td>
          <div class="teacher-v2-student-cell">
            <span class="teacher-v2-row-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="teacher-v2-avatar">${inicialesEstudiante(e.nombres, e.apellidos)}</span>
            <span><strong>${escaparHtml(`${e.nombres} ${e.apellidos}`)}</strong><small>${escaparHtml(e.correo)}</small></span>
          </div>
        </td>
        <td>
          <select class="achievement-grade-select level-${claseNivelLogro(e.nivel_logro)}" onchange="actualizarColorNivelLogro(this)">
            <option value="">Sin calificar</option>
            ${_nivelesLogroDisponibles.map(n => `<option value="${n.codigo}" ${e.nivel_logro === n.codigo ? "selected" : ""}>${n.codigo} · ${escaparHtml(n.nombre)}</option>`).join("")}
          </select>
        </td>
        <td><input class="achievement-observation" type="text" maxlength="300" value="${escaparHtml(e.observacion || "")}" placeholder="Observación opcional"></td>
      </tr>
    `).join("");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    tabla.innerHTML = `<tr><td colspan="3" class="teacher-v2-empty">${escaparHtml(error.message)}</td></tr>`;
  }
}


function actualizarColorNivelLogro(select) {
  select.className = `achievement-grade-select level-${claseNivelLogro(select.value)}`;
}


async function guardarCalificacionesCompetencia() {
  if (!_productoCompetenciaActual) return;
  const boton = document.getElementById("btnGuardarCompetencias");
  const filas = [...document.querySelectorAll("#tablaCalificacionesCompetencia tr[data-estudiante-id]")];
  const registros = filas.map(fila => ({
    estudianteId: Number(fila.dataset.estudianteId),
    nivelLogro: fila.querySelector(".achievement-grade-select")?.value,
    observacion: fila.querySelector(".achievement-observation")?.value.trim() || null
  })).filter(registro => registro.nivelLogro);
  if (registros.length === 0) {
    alert("Califica al menos a un estudiante con AD, A, B o C.");
    return;
  }
  try {
    boton.disabled = true;
    boton.textContent = "Guardando...";
    await apiFetch(`/postgres/productos-evaluacion/${_productoCompetenciaActual}/calificaciones`, {
      method: "POST",
      body: { registros }
    });
    await cargarProductosCompetencia();
    alert("Niveles de logro guardados correctamente.");
  } catch (error) {
    alert("No se pudieron guardar las calificaciones: " + error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Guardar niveles de logro";
  }
}


function cerrarCalificacionesCompetencia() {
  _productoCompetenciaActual = null;
  document.getElementById("panelCalificacionesCompetencia")?.classList.add("oculto");
}

// -- CALIFICACIÓN DIRECTA POR COMPETENCIA Y TRIMESTRE -----------------------


let _cursoCompetenciaActual = null;

let _calificacionTrimestralActual = null;

let _trimestresCompetenciaDisponibles = [];


async function prepararCursoCompetencia(seccionPreferida = null, asignaturaPreferida = null) {
  const anio = Number(document.getElementById("portalDocenteAnio")?.value || new Date().getFullYear());
  const [secciones, trimestres, niveles] = await Promise.all([
    apiFetch("/postgres/docentes/me/secciones"),
    apiFetch(`/postgres/trimestres-academicos?anio=${anio}`),
    apiFetch("/postgres/niveles-logro")
  ]);
  _docenteNotaSecciones = secciones;
  _trimestresCompetenciaDisponibles = trimestres;
  _nivelesLogroDisponibles = niveles;

  const seccionIdSolicitada = String(seccionPreferida || _cursoCompetenciaActual?.seccionId || "");
  const seccion = secciones.find(s => String(s.seccion_id) === seccionIdSolicitada) || secciones[0];
  if (!seccion) throw new Error("No tienes secciones asignadas");

  _docenteAsignaturas = await apiFetch(`/postgres/asignaturas?seccionId=${encodeURIComponent(seccion.seccion_id)}`);
  const asignaturaIdSolicitada = String(asignaturaPreferida || _cursoCompetenciaActual?.asignaturaId || "");
  const asignatura = _docenteAsignaturas.find(a => String(a.id) === asignaturaIdSolicitada) || _docenteAsignaturas[0];
  if (!asignatura) throw new Error("No tienes cursos asignados en esta sección");

  _cursoCompetenciaActual = {
    seccionId: Number(seccion.seccion_id),
    asignaturaId: Number(asignatura.id),
    seccion,
    asignatura,
    anio
  };
  actualizarContextoCursoCompetencia();
  renderNivelesLogro();
}


async function inicializarNotasDocente() {
  if (_docenteNotasCargando) return;
  _docenteNotasCargando = true;
  try {
    await cargarSeccionesNotasSimples();
  } catch (error) {
    console.error("Error inicializando notas:", error);
  } finally {
    _docenteNotasCargando = false;
  }
}


function actualizarContextoCursoCompetencia() {
  const contexto = _cursoCompetenciaActual;
  const cursoNombre = contexto?.asignatura?.nombre || "Selecciona un curso";
  const seccionNombre = contexto?.seccion ? `${contexto.seccion.grado} ${contexto.seccion.letra}` : "-";
  const titulo = document.getElementById("competencyCourseTitle");
  const subtitulo = document.getElementById("competencyCourseSubtitle");
  const formulaCurso = document.getElementById("formulaCurso");
  const formulaSeccion = document.getElementById("formulaSeccion");
  if (titulo) titulo.textContent = `Detalle de calificación: ${cursoNombre}`;
  if (subtitulo) subtitulo.textContent = contexto?.seccion ? `${contexto.seccion.nivel} · ${seccionNombre}` : "";
  if (formulaCurso) formulaCurso.textContent = cursoNombre;
  if (formulaSeccion) formulaSeccion.textContent = seccionNombre;
}


function renderNivelesLogro() {
  const contenedor = document.getElementById("nivelesLogroGrid");
  if (!contenedor) return;
  const textosBase = {
    AD: ["Logro destacado", "El estudiante evidencia un nivel superior a lo esperado respecto a la competencia y demuestra aprendizajes que van más allá del nivel esperado."],
    A: ["Logro esperado", "El estudiante evidencia el nivel esperado respecto a la competencia, demostrando manejo satisfactorio en las tareas propuestas y el tiempo programado."],
    B: ["En proceso", "El estudiante está próximo al nivel esperado y requiere acompañamiento durante un tiempo razonable para lograrlo."],
    C: ["En inicio", "El estudiante muestra un progreso mínimo, evidencia dificultades y necesita mayor acompañamiento e intervención docente."]
  };
  const niveles = ["AD", "A", "B", "C"].map(codigo => {
    const registrado = _nivelesLogroDisponibles.find(nivel => nivel.codigo === codigo);
    return registrado || { codigo, nombre: textosBase[codigo][0], descripcion: textosBase[codigo][1] };
  });
  contenedor.innerHTML = niveles.map(nivel => `
    <article class="achievement-level achievement-${claseNivelLogro(nivel.codigo)}">
      <span>${nivel.codigo}</span>
      <div><h3>${escaparHtml(nivel.nombre)}</h3><p>${escaparHtml(nivel.descripcion)}</p></div>
    </article>
  `).join("");
}


async function cargarResumenCompetenciasTrimestrales() {
  const tabla = document.getElementById("tablaResumenCompetencias");
  const contexto = _cursoCompetenciaActual;
  if (!tabla || !contexto) return;
  tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">Cargando competencias...</td></tr>';
  try {
    const [filas, bimestres] = await Promise.all([
      apiFetch(`/postgres/calificaciones-trimestrales/resumen?seccionId=${contexto.seccionId}&asignaturaId=${contexto.asignaturaId}&anio=${contexto.anio}`),
      apiFetch(`/postgres/trimestres-academicos?anio=${contexto.anio}`)
    ]);
    const head = document.getElementById("tablaResumenCompetenciasHead");
    if (head) {
      head.innerHTML = `
        <tr>
          <th>Competencia</th>
          ${bimestres.map(b => `<th>${escaparHtml(b.nombre)}</th>`).join("")}
        </tr>`;
    }
    const competencias = new Map();
    filas.forEach(fila => {
      if (!competencias.has(fila.competencia_id)) {
        competencias.set(fila.competencia_id, { id: fila.competencia_id, nombre: fila.competencia, trimestres: new Map() });
      }
      competencias.get(fila.competencia_id).trimestres.set(Number(fila.trimestre_orden), fila);
    });
    if (competencias.size === 0) {
      tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">No hay competencias configuradas para este curso.</td></tr>';
      return;
    }
    tabla.innerHTML = [...competencias.values()].map(competencia => `
      <tr>
        <td><strong>${escaparHtml(competencia.nombre)}</strong></td>
        ${bimestres.map(b => renderCeldaTrimestreCompetencia(competencia, competencia.trimestres.get(Number(b.orden)))).join("")}
      </tr>
    `).join("");
  } catch (error) {
    tabla.innerHTML = `<tr><td colspan="4" class="teacher-v2-empty">${escaparHtml(error.message)}</td></tr>`;
  }
}


function renderCeldaTrimestreCompetencia(competencia, trimestre) {
  if (!trimestre) return '<td><span class="competency-unavailable">No configurado</span></td>';
  const total = Number(trimestre.total_estudiantes || 0);
  const calificados = Number(trimestre.total_calificados || 0);
  return `
    <td>
      <div class="competency-term-cell">
        <span><strong>${calificados}</strong> / ${total} calificados</span>
        <button type="button" onclick="abrirCalificacionTrimestral(${competencia.id}, ${trimestre.trimestre_id})">
          ${calificados > 0 ? "Editar calificativos" : "Agregar calificativos"}
        </button>
      </div>
    </td>`;
}


async function abrirCalificacionTrimestral(competenciaId, trimestreId) {
  const contexto = _cursoCompetenciaActual;
  const panel = document.getElementById("panelCalificacionesCompetencia");
  const tabla = document.getElementById("tablaCalificacionesCompetencia");
  if (!contexto || !panel || !tabla) return;
  panel.classList.remove("oculto");
  tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">Cargando estudiantes...</td></tr>';
  try {
    const estudiantes = await apiFetch(`/postgres/calificaciones-trimestrales?seccionId=${contexto.seccionId}&competenciaId=${competenciaId}&trimestreId=${trimestreId}`);
    const primero = estudiantes[0];
    if (!primero) {
      _calificacionTrimestralActual = null;
      tabla.innerHTML = '<tr><td colspan="3" class="teacher-v2-empty">No hay estudiantes activos en esta sección.</td></tr>';
      return;
    }
    _calificacionTrimestralActual = { competenciaId, trimestreId, seccionId: contexto.seccionId };
    document.getElementById("tituloCalificacionesCompetencia").textContent = primero.competencia;
    document.getElementById("subtituloCalificacionesCompetencia").textContent = `${primero.trimestre} · ${primero.asignatura} · ${primero.grado} ${primero.letra}`;
    tabla.innerHTML = estudiantes.map((e, index) => `
      <tr data-estudiante-id="${e.estudiante_id}">
        <td><div class="teacher-v2-student-cell"><span class="teacher-v2-row-number">${String(index + 1).padStart(2, "0")}</span><span class="teacher-v2-avatar">${inicialesEstudiante(e.nombres, e.apellidos)}</span><span><strong>${escaparHtml(`${e.nombres} ${e.apellidos}`)}</strong><small>${escaparHtml(e.correo)}</small></span></div></td>
        <td><select class="achievement-grade-select level-${claseNivelLogro(e.nivel_logro)}" onchange="actualizarColorNivelLogro(this)"><option value="">Sin calificar</option>${["AD", "A", "B", "C"].map(codigo => { const nivel = _nivelesLogroDisponibles.find(n => n.codigo === codigo); return `<option value="${codigo}" ${e.nivel_logro === codigo ? "selected" : ""}>${codigo} · ${escaparHtml(nivel?.nombre || "")}</option>`; }).join("")}</select></td>
        <td><input class="achievement-observation" type="text" maxlength="300" value="${escaparHtml(e.observacion || "")}" placeholder="Observación opcional"></td>
      </tr>
    `).join("");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    tabla.innerHTML = `<tr><td colspan="3" class="teacher-v2-empty">${escaparHtml(error.message)}</td></tr>`;
  }
}


async function guardarCalificacionesCompetencia() {
  if (!_calificacionTrimestralActual) return;
  const boton = document.getElementById("btnGuardarCompetencias");
  const registros = [...document.querySelectorAll("#tablaCalificacionesCompetencia tr[data-estudiante-id]")].map(fila => ({
    estudianteId: Number(fila.dataset.estudianteId),
    nivelLogro: fila.querySelector(".achievement-grade-select")?.value,
    observacion: fila.querySelector(".achievement-observation")?.value.trim() || null
  })).filter(registro => registro.nivelLogro);
  if (registros.length === 0) {
    alert("Agrega al menos un calificativo AD, A, B o C.");
    return;
  }
  try {
    boton.disabled = true;
    boton.textContent = "Guardando...";
    await apiFetch("/postgres/calificaciones-trimestrales", {
      method: "POST",
      body: { ..._calificacionTrimestralActual, registros }
    });
    await cargarResumenCompetenciasTrimestrales();
    alert("Calificativos guardados correctamente.");
  } catch (error) {
    alert("No se pudieron guardar los calificativos: " + error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Guardar niveles de logro";
  }
}


function cerrarCalificacionesCompetencia() {
  _productoCompetenciaActual = null;
  _calificacionTrimestralActual = null;
  document.getElementById("panelCalificacionesCompetencia")?.classList.add("oculto");
}


// Cuestionarios removidos del docente - solo el psicologo ve respuestas


async function cargarMisSeccionesDocente() {
  return cargarPortalDocente();
}


async function cargarPortalDocente() {
  const cursosEl = document.getElementById("docCursosGrid");
  const anioEl = document.getElementById("portalDocenteAnio");
  const salonEl = document.getElementById("portalDocenteGrado");
  if (!cursosEl || !anioEl || !salonEl) return;

  cursosEl.innerHTML = '<p class="teacher-portal-empty">Cargando tus cursos...</p>';
  try {
    [_portalDocenteSecciones, _portalDocentePeriodos] = await Promise.all([
      apiFetch("/postgres/docentes/me/secciones"),
      apiFetch("/postgres/periodos-academicos?todos=1")
    ]);

    const anioActual = String(new Date().getFullYear());
    const anios = [...new Set(_portalDocentePeriodos.map(p => String(p.anio)))].sort((a, b) => b.localeCompare(a));
    anioEl.innerHTML = (anios.length ? anios : [anioActual])
      .map(anio => `<option value="${anio}">${anio}</option>`).join("");
    anioEl.value = anios.includes(anioActual) ? anioActual : (anios[0] || anioActual);

    salonEl.innerHTML = _portalDocenteSecciones.length
      ? _portalDocenteSecciones
          .map(seccion => `<option value="${seccion.seccion_id}">${escaparHtml(`${seccion.grado} ${seccion.letra}`)}</option>`)
          .join("")
      : '<option value="">Sin salones asignados</option>';

    actualizarSemanaPortalDocente();
    await filtrarPortalDocente();
  } catch (error) {
    cursosEl.innerHTML = `<p class="teacher-portal-empty">No se pudieron cargar tus cursos: ${escaparHtml(error.message)}</p>`;
  }
}


async function filtrarPortalDocente() {
  const cursosEl = document.getElementById("docCursosGrid");
  const totalEl = document.getElementById("portalDocenteTotalCursos");
  const seccionId = document.getElementById("portalDocenteGrado")?.value;
  if (!cursosEl) return;

  const secciones = _portalDocenteSecciones.filter(s => !seccionId || String(s.seccion_id) === String(seccionId));
  cursosEl.innerHTML = '<p class="teacher-portal-empty">Actualizando cursos...</p>';

  try {
    const resultados = await Promise.all(secciones.map(async seccion => ({
      seccion,
      asignaturas: await apiFetch(`/postgres/asignaturas?seccionId=${encodeURIComponent(seccion.seccion_id)}`)
    })));

    const cursos = resultados.flatMap(({ seccion, asignaturas }) =>
      asignaturas.map(asignatura => ({ seccion, asignatura }))
    );
    if (totalEl) totalEl.textContent = cursos.length;

    if (cursos.length === 0) {
      cursosEl.innerHTML = '<p class="teacher-portal-empty">No tienes cursos asignados para este salón.</p>';
      return;
    }

    cursosEl.innerHTML = cursos.map(({ seccion, asignatura }) => `
      <article class="teacher-course-card">
        <div class="teacher-course-card-top">
          <span class="teacher-course-code">${escaparHtml(asignatura.codigo || "CUR")}</span>
          <span class="teacher-course-section">${escaparHtml(seccion.grado)} ${escaparHtml(seccion.letra)}</span>
        </div>
        <h3>${escaparHtml(asignatura.nombre)}</h3>
        <p>${escaparHtml(seccion.nivel)} · ${escaparHtml(document.getElementById("portalDocenteAnio")?.value || "")}</p>
        <div class="teacher-course-actions">
          <button type="button" class="is-primary" onclick="abrirAsistenciaCurso('${seccion.nivel}', '${seccion.grado}', '${seccion.letra}')">Asistencia</button>
          <button type="button" onclick="abrirNotasCurso(${seccion.seccion_id}, ${asignatura.id})">Notas</button>
          <button type="button" onclick="mostrarSeccionDocente('doc-cuestionarios')">Cuestionarios</button>
        </div>
      </article>
    `).join("");
  } catch (error) {
    if (totalEl) totalEl.textContent = "0";
    cursosEl.innerHTML = '<p class="teacher-portal-empty">No se pudieron cargar los cursos asignados.</p>';
  }
}


function actualizarSemanaPortalDocente() {
  const etiqueta = document.getElementById("portalSemanaActual");
  if (!etiqueta) return;
  const hoy = new Date();
  const dia = hoy.getDay() || 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - dia + 1);
  const sabado = new Date(lunes);
  sabado.setDate(lunes.getDate() + 5);
  const formato = { day: "numeric", month: "short" };
  etiqueta.textContent = `${lunes.toLocaleDateString("es-PE", formato)} - ${sabado.toLocaleDateString("es-PE", { ...formato, year: "numeric" })}`;
}


async function abrirAsistenciaCurso(nivel, grado, seccion) {
  _docenteSalonActual = { nivel, grado, seccion };
  mostrarSeccionDocente("doc-inicio");
  await cargarSalonDocente(_docenteSalonActual);
  if (_docenteEstudiantesActuales.length > 0) {
    _docenteModoAsistencia = true;
    actualizarControlesAsistenciaDocente();
  }
}


async function abrirNotasCurso(seccionId, asignaturaId) {
  mostrarSeccionDocente("doc-notas");
  await prepararNotasSimples(seccionId, asignaturaId);
  const card = document.querySelector(".notas-simples-card");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── NOTAS SIMPLES (campos con nombre + nota visual AD/A/B/C) ─────────────────


async function seleccionarSeccionDocente(nivel, grado, seccion) {
  _docenteSalonActual = { nivel, grado, seccion };
  mostrarSeccionDocente("doc-inicio");
  cargarSalonDocente(_docenteSalonActual);
}


// Funciones de cuestionarios removidas - solo el psicologo accede a respuestas


// Funcion removida - docente ya no crea cuestionarios


async function actualizarResumenCuestionariosDocente() {
  let formularios = [];
  try {
    formularios = await apiFetch("/postgres/docentes/me/formularios");
  } catch (e) {}

  const activos = formularios.filter(f => f.activo).length;
  const pendientes = formularios.filter(f => !f.activo).length;
  const elActivos = document.getElementById("docCuestionariosActivosVista");
  const elPendientes = document.getElementById("docCuestionariosFinalizadosVista");
  if (elActivos) elActivos.textContent = activos;
  if (elPendientes) elPendientes.textContent = pendientes;

  renderFormulariosDocente(formularios);
}


function renderFormulariosDocente(formularios) {
  const tabla = document.getElementById("tablaFormulariosDocente");
  if (!tabla) return;

  if (!formularios || formularios.length === 0) {
    tabla.innerHTML = '<tr><td colspan="6" class="teacher-v2-empty">Sin formularios asignados.</td></tr>';
    return;
  }

  tabla.innerHTML = formularios.map(f => `
    <tr>
      <td>${f.titulo}</td>
      <td>${f.grado} ${f.seccion}</td>
      <td>${f.total_preguntas}</td>
      <td><span class="badge ${f.habilitado ? "badge-bajo" : "badge-medio"}">${f.habilitado ? "Habilitado" : "Pendiente"}</span></td>
      <td>${f.habilitado ? `${f.respuestas_count} de ${f.total_estudiantes} respondieron` : ''}</td>
      <td>
        ${f.habilitado
          ? '<span class="teacher-v2-muted">Ya habilitado</span>'
          : `<button class="teacher-v2-filter-btn" onclick="habilitarFormularioDocente(${f.id})">Habilitar</button>`}
      </td>
    </tr>
  `).join("");
}


async function habilitarFormularioDocente(formularioId) {
  try {
    await apiFetch(`/postgres/docentes/me/formularios/${formularioId}/habilitar`, { method: "POST" });
    alert("Formulario habilitado para los estudiantes de la sección.");
    actualizarResumenCuestionariosDocente();
  } catch (e) {
    alert("No se pudo habilitar el formulario: " + e.message);
  }
}


function abrirResumenEvidenciasDocente() {
  actualizarResumenEvidenciasDocente();
  document.getElementById("modalResumenEvidenciasDocente")?.classList.remove("oculto");
}


function actualizarContextoPanelDocente(idSeccion) {
  const vistas = {
    "doc-salones": "barraDocSalones",
    "doc-inicio": "barraDocAsistencia",
    "doc-notas": "barraDocNotas",
    "doc-cuestionarios": "barraDocCuestionarios",
    "doc-evidencias": "barraDocEvidencias"
  };
  document.querySelectorAll(".teacher-commandbar-view").forEach(vista => vista.classList.add("oculto"));
  document.getElementById(vistas[idSeccion] || "barraDocSalones")?.classList.remove("oculto");
}


function mostrarSeccionDocente(idSeccion) {
  document.querySelectorAll(".seccion-docente").forEach(s => s.classList.add("oculto"));
  document.getElementById(idSeccion)?.classList.remove("oculto");
  document.querySelectorAll(".sidebar-nav a, .teacher-v2-nav a, .nav a").forEach(l => l.classList.remove("active"));
  document.querySelectorAll(".sidebar-nav a, .teacher-v2-nav a, .nav a").forEach(l => {
    const onclick = l.getAttribute("onclick") || "";
    if (onclick.includes(idSeccion) || l.dataset.section === idSeccion || l.getAttribute("data-section") === idSeccion) l.classList.add("active");
  });
  actualizarContextoPanelDocente(idSeccion);
  if (idSeccion === "formulario") cargarRespuestasFormulario();
  if (idSeccion === "doc-inicio") {
    actualizarResumenEvidenciasDocente();
  }
  if (idSeccion === "doc-evidencias") actualizarResumenEvidenciasDocente();
  if (idSeccion === "doc-cuestionarios") actualizarResumenCuestionariosDocente();
  if (idSeccion === "doc-salones") {
    if (_portalDocenteSecciones.length === 0) cargarPortalDocente();
  }
  if (idSeccion === "doc-tutoria") cargarSeccionesTutor();
  if (idSeccion === "doc-asistencias" && typeof initRegistroAsistencias === "function") initRegistroAsistencias();
}


document.addEventListener("click", event => {
  if (event.target.closest?.('[onclick*="abrirModuloNotasDocente"]')) {
    setTimeout(() => inicializarNotasDocente(), 0);
  }
});


document.addEventListener("focusin", event => {
  if (["notaSeccion", "notaAsignatura", "notaTrimestre", "notaCompetencia"].includes(event.target.id)) {
    asegurarInicializacionNotasDocente();
  }
});


document.addEventListener("DOMContentLoaded", () => {
  setTimeout(asegurarInicializacionNotasDocente, 150);
});


