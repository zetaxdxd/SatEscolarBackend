// Reporte de incidentes (estudiante y psicología) — SAT Escolar

let _streamCamara = null;
let _fotoBase64   = null;


function cargarSelectEstudianteIncidente() {}


function previsualizarFoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _fotoBase64 = e.target.result;
    document.getElementById("previewFoto").src = _fotoBase64;
    document.getElementById("previewFotoContainer").classList.remove("oculto");
  };
  reader.readAsDataURL(file);
}


async function abrirCamara() {
  try {
    _streamCamara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
    const video = document.getElementById("videoCamara");
    video.srcObject = _streamCamara;
    video.style.display = "block";
    document.getElementById("btnAbrirCamara").classList.add("oculto");
    document.getElementById("btnCapturar").classList.remove("oculto");
    document.getElementById("btnDetenerCamara").classList.remove("oculto");
  } catch (e) { alert("No se pudo acceder a la cámara. Adjunta una foto desde galería."); }
}


function capturarFoto() {
  const video  = document.getElementById("videoCamara");
  const canvas = document.getElementById("canvasCaptura");
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  _fotoBase64 = canvas.toDataURL("image/jpeg", 0.85);
  document.getElementById("previewFoto").src = _fotoBase64;
  document.getElementById("previewFotoContainer").classList.remove("oculto");
  detenerCamara();
}


function detenerCamara() {
  if (_streamCamara) { _streamCamara.getTracks().forEach(t => t.stop()); _streamCamara = null; }
  const video = document.getElementById("videoCamara");
  video.style.display = "none";
  video.srcObject = null;
  document.getElementById("btnAbrirCamara").classList.remove("oculto");
  document.getElementById("btnCapturar").classList.add("oculto");
  document.getElementById("btnDetenerCamara").classList.add("oculto");
}


function limpiarFoto() {
  _fotoBase64 = null;
  document.getElementById("previewFotoContainer").classList.add("oculto");
  document.getElementById("previewFoto").src = "";
  const fileInput = document.getElementById("fotoIncidenteFile");
  if (fileInput) fileInput.value = "";
}


async function reportarIncidente() {
  const descripcion = document.getElementById("descripcionIncidente").value.trim();
  if (!descripcion) { alert("Escribe una descripción del incidente."); return; }
  try {
    await apiFetch("/estudiantes/incidente", {
      method: "POST",
      body: { descripcion, fotoBase64: _fotoBase64 || null }
    });
    alert("Reporte enviado de forma anónima. Será revisado por el área psicopedagógica.");
    document.getElementById("descripcionIncidente").value = "";
    limpiarFoto();
    cerrarModal("modalReporteAnonimo");
  } catch (e) { alert("Error al reportar: " + e.message); }
}


async function actualizarBadgeIncidentes() {
  try {
    const incidentes = await apiFetch("/estudiantes/incidentes?nuevos=1");
    const noLeidos   = incidentes.length;
    const badge = document.getElementById("badgeIncidentes");
    if (!badge) return;
    badge.style.display = noLeidos > 0 ? "flex" : "none";
    badge.textContent   = noLeidos > 0 ? noLeidos : "";
  } catch (e) {}
}


async function abrirModalIncidentes() {
  try {
    const incidentes = await apiFetch("/estudiantes/incidentes");
    const noLeidos   = incidentes.filter(i => !i.leido);
    const titulo = document.getElementById("modalIncidentesTitulo");
    const body   = document.getElementById("modalIncidentesBody");

    if (noLeidos.length > 0) {
      if (titulo) titulo.textContent = "Nuevo incidente reportado";
      body.innerHTML = _renderIncidenteCard(noLeidos[0]) +
        `<div style="margin-top:16px;">
          <button class="btn btn-secondary" onclick="mostrarListaIncidentes()">Ver todos los incidentes</button>
        </div>`;
      await apiFetch("/estudiantes/incidentes/leer", { method: "POST" });
      actualizarBadgeIncidentes();
    } else {
      if (titulo) titulo.textContent = "Incidentes reportados";
      await mostrarListaIncidentes();
    }

    document.getElementById("modalIncidentes").classList.remove("oculto");
    localStorage.setItem("sat_incidentes_cache", JSON.stringify(incidentes));
  } catch (e) { alert("Error: " + e.message); }
}


async function mostrarListaIncidentes() {
  const titulo = document.getElementById("modalIncidentesTitulo");
  const body   = document.getElementById("modalIncidentesBody");
  if (titulo) titulo.textContent = "Incidentes reportados";

  try {
    const incidentes = await apiFetch("/estudiantes/incidentes");
    localStorage.setItem("sat_incidentes_cache", JSON.stringify(incidentes));

    if (incidentes.length === 0) {
      body.innerHTML = '<p style="color:#888;text-align:center;padding:24px;">Sin incidentes reportados.</p>';
      return;
    }

    body.innerHTML = incidentes.map(i => `
      <div class="incident-list-item" onclick="verDetalleIncidente(${i.id})">
        <div class="info">
          <h4>${i.nombre_estudiante || "Anónimo"}</h4>
          <p>${i.fecha?.slice(0,16) || ""}</p>
          <p style="margin-top:4px;color:#374151;">${i.descripcion.substring(0,90)}${i.descripcion.length > 90 ? "…" : ""}</p>
        </div>
        <span class="chevron">›</span>
      </div>`).join("");
  } catch (e) { body.innerHTML = '<p style="color:red;">Error al cargar incidentes.</p>'; }
}


function verDetalleIncidente(id) {
  const cache = JSON.parse(localStorage.getItem("sat_incidentes_cache") || "[]");
  const i = cache.find(x => x.id === id);
  if (!i) return;
  const body = document.getElementById("modalDetalleRespuestaBody");
  const titulo = document.getElementById("modalDetalleRespuestaTitulo");
  const modal = document.getElementById("modalDetalleRespuestaPs");
  if (body && modal) {
    if (titulo) titulo.textContent = "Detalle del incidente";
    body.innerHTML = _renderIncidenteCard(i);
    modal.classList.remove("oculto");
  } else {
    alert(`Incidente #${i.id}\n${i.fecha ? i.fecha.slice(0, 16) + "\n" : ""}${i.descripcion || ""}`);
  }
}

