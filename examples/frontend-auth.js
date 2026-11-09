const API_URL = "http://localhost:3000/api/auth";

async function registrarUsuarioBackend() {
  const datos = {
    fullName: document.getElementById("nombreCompleto").value,
    email: document.getElementById("correo").value,
    username: document.getElementById("nuevoUsuario").value,
    password: document.getElementById("nuevaPassword").value,
    role: document.getElementById("rol").value
  };

  const respuesta = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();
  alert(resultado.mensaje);
}

async function iniciarSesionBackend() {
  const datos = {
    identifier: document.getElementById("usuario").value,
    password: document.getElementById("password").value
  };

  const respuesta = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    document.getElementById("mensajeLogin").textContent = resultado.mensaje;
    return;
  }

  localStorage.setItem("usuarioSAT", JSON.stringify(resultado.usuario));
  localStorage.setItem("rol", resultado.usuario.role);

  if (resultado.usuario.role === "docente") {
    window.location.href = "pages/docente.html";
  } else if (resultado.usuario.role === "psicologo") {
    window.location.href = "pages/psicologa.html";
  } else {
    window.location.href = "pages/estudiante.html";
  }
}
