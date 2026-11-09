// Chat anónimo del estudiante — SAT Escolar

let _chatConversacionAbierta = null;


async function cargarChatAnonimoMio() {
  const contenedor = document.getElementById("chatAnonimoConversacion");
  if (!contenedor) return;
  try {
    const data = await apiFetch("/postgres/mensajes/mios");
    contenedor.innerHTML = data.mensajes.length === 0
      ? '<div class="ps-empty-state">Aún no has conversado con el psicólogo. Escribe un mensaje anónimo.</div>'
      : data.mensajes.map(m => `
        <div style="background:${m.remitente === "psicólogo" ? "#dbeafe" : "#f9fafb"}; border-radius:10px; padding:10px 14px; margin-bottom:8px; max-width:80%; ${m.remitente === "psicólogo" ? "" : "margin-left:auto;"}">
          <small style="color:#6b7280;">${m.remitente === "psicólogo" ? "Psicóloga" : "Tú"}</small>
          <p style="margin:4px 0 0;">${escaparHtml(m.contenido)}</p>
          <small style="color:#9ca3af;">${formatearFechaLarga(m.creado_en)}</small>
          ${m.remitente !== "psicólogo" ? `<button class="btn-admin small gray" style="margin-top:6px;" onclick="solicitarEliminarMensajeChat(${m.id})">Eliminar (clave + código)</button>` : ""}
        </div>`).join("");
  } catch (e) {
    contenedor.innerHTML = '<div class="ps-empty-state">Error: ' + escaparHtml(e.message) + '</div>';
  }
}


async function enviarMensajeChatAnonimo() {
  const input = document.getElementById("chatAnonimoTexto");
  if (!input) return;
  const contenido = input.value.trim();
  if (!contenido) return;
  try {
    await apiFetch("/postgres/mensajes", { method: "POST", body: { contenido } });
    input.value = "";
    await cargarChatAnonimoMio();
  } catch (e) { alert("Error: " + e.message); }
}

// ── Eliminación protegida (contraseña + código OTP) ──────────────


let _eliminacionChatPendiente = { accion: null, mensajeId: null, codigoDev: null };


function mostrarModalEliminacionChat() {
  _eliminacionChatPendiente = { accion: "borrar-chat", mensajeId: null, codigoDev: null };
  document.getElementById("modalEliminarChatPaso").textContent = "Paso 1: confirma tu contraseña";
  document.getElementById("modalEliminarChatDescripcion").textContent =
    "Para eliminar todo tu chat con el psicólogo necesitamos verificar tu identidad con tu contraseña y un código de verificación.";
  document.getElementById("modalEliminarChatPass").value = "";
  document.getElementById("modalEliminarChatCodigo").value = "";
  document.getElementById("modalEliminarChatPassWrap").classList.remove("oculto");
  document.getElementById("modalEliminarChatCodigoWrap").classList.add("oculto");
  document.getElementById("modalEliminarChatAccion").classList.remove("oculto");
  document.getElementById("modalEliminarChatPaso2").classList.add("oculto");
  abrirModal("modalEliminarChat");
}


async function solicitarEliminarMensajeChat(mensajeId) {
  _eliminacionChatPendiente = { accion: "mensaje", mensajeId, codigoDev: null };
  document.getElementById("modalEliminarChatPaso").textContent = "Paso 1: confirma tu contraseña";
  document.getElementById("modalEliminarChatDescripcion").textContent =
    "Para eliminar este mensaje necesitamos verificar tu identidad con tu contraseña y un código de verificación.";
  document.getElementById("modalEliminarChatPass").value = "";
  document.getElementById("modalEliminarChatCodigo").value = "";
  document.getElementById("modalEliminarChatPassWrap").classList.remove("oculto");
  document.getElementById("modalEliminarChatCodigoWrap").classList.add("oculto");
  document.getElementById("modalEliminarChatAccion").classList.remove("oculto");
  document.getElementById("modalEliminarChatPaso2").classList.add("oculto");
  abrirModal("modalEliminarChat");
}


async function paso1EliminarChat() {
  const contrasena = document.getElementById("modalEliminarChatPass").value;
  const pendiente = _eliminacionChatPendiente;
  if (!contrasena) { alert("Ingresa tu contraseña."); return; }

  const ruta = pendiente.accion === "mensaje"
    ? `/postgres/mensajes/${pendiente.mensajeId}/eliminar/solicitar`
    : "/postgres/mensajes/borrar-chat/solicitar";

  try {
    const data = await apiFetch(ruta, { method: "POST", body: { contrasena } });
    pendiente.codigoDev = data.codigo_dev || null;
    document.getElementById("modalEliminarChatPaso").textContent = "Paso 2: ingresa el código de verificación";
    document.getElementById("modalEliminarChatDescripcion").textContent =
      `Enviamos un código a ${data.enviado_a}. ${data.modo === "dev" ? "Como el correo no está configurado, el código se muestra en la consola del servidor." : "Revisa tu bandeja de correo."}`;
    document.getElementById("modalEliminarChatPassWrap").classList.add("oculto");
    document.getElementById("modalEliminarChatCodigoWrap").classList.remove("oculto");
    document.getElementById("modalEliminarChatAccion").classList.add("oculto");
    document.getElementById("modalEliminarChatPaso2").classList.remove("oculto");
  } catch (e) {
    alert("Error: " + e.message);
  }
}


async function paso2EliminarChat() {
  const codigo = document.getElementById("modalEliminarChatCodigo").value.trim();
  const pendiente = _eliminacionChatPendiente;
  if (!codigo) { alert("Ingresa el código de verificación."); return; }

  const ruta = pendiente.accion === "mensaje"
    ? `/postgres/mensajes/${pendiente.mensajeId}/eliminar/confirmar`
    : "/postgres/mensajes/borrar-chat/confirmar";

  try {
    await apiFetch(ruta, { method: "POST", body: { codigo } });
    cerrarModal("modalEliminarChat");
    alert(pendiente.accion === "mensaje" ? "Mensaje eliminado correctamente." : "Chat eliminado correctamente.");
    await cargarChatAnonimoMio();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
 

