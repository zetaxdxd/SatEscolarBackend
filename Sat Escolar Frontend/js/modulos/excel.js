// Carga masiva desde Excel (estudiantes y notas) — SAT Escolar

function leerExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX !== "undefined") {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws, { defval: "" }));
        } else {
          const texto = new TextDecoder().decode(e.target.result);
          resolve(parsearCsv(texto));
        }
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}


function parsearCsv(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lineas.length < 2) return [];
  const separar = (linea) => {
    const partes = [];
    let actual = "", entreComillas = false;
    for (const ch of linea) {
      if (ch === '"') entreComillas = !entreComillas;
      else if (ch === "," && !entreComillas) { partes.push(actual); actual = ""; }
      else actual += ch;
    }
    partes.push(actual);
    return partes.map(p => p.trim());
  };
  const cabeceras = separar(lineas[0]).map(h => h.replace(/\ufeff/g, ""));
  return lineas.slice(1).map(linea => {
    const valores = separar(linea);
    const fila = {};
    cabeceras.forEach((h, i) => { fila[h] = valores[i] !== undefined ? valores[i] : ""; });
    return fila;
  });
}


function buscarClaveExcel(fila, regex) {
  return Object.keys(fila).find(k => regex.test(k));
}


function descargarPlantillaEstudiantes() {
  const contenido = "nombres,apellidos,correo,contraseña\nEjemplo,Alumno Uno,ejemplo.alumno.uno@ofelia.edu.pe,Ejemplo123*\nEjemplo,Alumna Dos,ejemplo.alumna.dos@ofelia.edu.pe,Ejemplo123*\n";
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_estudiantes.csv";
  a.click();
  URL.revokeObjectURL(url);
}


let _excelEstudiantes = [];


function subirExcelEstudiantes() {
  const msg = document.getElementById("msgRegistroTutor");
  if (!_tutorSalonActual) { msg.textContent = "Primero selecciona el salón y pulsa Continuar."; return; }
  document.getElementById("excelEstudiantesInput")?.click();
}


async function procesarExcelEstudiantes(evento) {
  const file = evento.target.files[0];
  const msg = document.getElementById("msgRegistroTutor");
  const contenedor = document.getElementById("vistaPreviaExcelEstudiantes");
  if (!file) return;
  try {
    const filas = await leerExcel(file);
    const mapeados = filas.map(f => {
      const kNombre = buscarClaveExcel(f, /nombres|nombre/i);
      const kApellido = buscarClaveExcel(f, /apellidos|apellido/i);
      const kCorreo = buscarClaveExcel(f, /correo|email|e-mail/i);
      const kPass = buscarClaveExcel(f, /contrase|password|clave|pass/i);
      let nombres = kNombre ? String(f[kNombre]).trim() : "";
      let apellidos = kApellido ? String(f[kApellido]).trim() : "";
      if (!nombres && !apellidos) {
        const kFull = buscarClaveExcel(f, /estudiante|alumno|nombre completo|nombre y apellido/i);
        const completo = kFull ? String(f[kFull]).trim() : "";
        const partes = completo.split(/\s+/);
        if (partes.length >= 3) { apellidos = partes.slice(-2).join(" "); nombres = partes.slice(0, -2).join(" "); }
        else if (partes.length === 2) { apellidos = partes[1]; nombres = partes[0]; }
        else nombres = completo;
      }
      return {
        nombres,
        apellidos,
        correo: kCorreo ? String(f[kCorreo]).trim() : "",
        contraseña: kPass ? String(f[kPass]).trim() : ""
      };
    }).filter(e => e.nombres || e.correo);

    if (mapeados.length === 0) {
      msg.className = "msg-err";
      msg.textContent = "No encontré columnas de nombre/correo en el archivo. Usa la plantilla de ejemplo.";
      return;
    }
    // Omitir los que ya están registrados en este salón (no duplicar)
    let omitidos = 0;
    try {
      const actuales = await apiFetch(`/postgres/estudiantes?seccionId=${_tutorSalonActual}`);
      const correos = new Set((actuales || []).map(e => String(e.correo || "").toLowerCase()));
      const antes = mapeados.length;
      mapeados = mapeados.filter(e => !e.correo || !correos.has(e.correo.toLowerCase()));
      omitidos = antes - mapeados.length;
    } catch (_) {}
    _excelEstudiantes = mapeados;
    renderVistaPreviaEstudiantes();
    msg.className = "msg-ok";
    msg.textContent = `Leído ${mapeados.length} estudiantes nuevos del archivo.`
      + (omitidos ? ` ${omitidos} ya estaban registrados y se omitieron.` : "") + " Revisa la lista y corrige lo necesario.";
    if (!mapeados.length && omitidos) {
      msg.textContent = "Todos los del archivo ya estaban registrados. Nada por agregar.";
    }
  } catch (e) {
    msg.className = "msg-err";
    msg.textContent = "No se pudo leer el archivo: " + e.message;
  }
}


function renderVistaPreviaEstudiantes() {
  const contenedor = document.getElementById("vistaPreviaExcelEstudiantes");
  const boton = document.getElementById("btnRegistrarTodosExcel");
  if (!contenedor) return;
  if (_excelEstudiantes.length === 0) { contenedor.innerHTML = ""; if (boton) boton.classList.add("oculto"); return; }
  contenedor.innerHTML = `
    <div class="teacher-v2-table-wrap" style="margin-top:12px;">
      <table class="teacher-v2-table">
        <thead><tr><th>#</th><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Contraseña</th><th>Estado</th></tr></thead>
        <tbody>
          ${_excelEstudiantes.map((e, i) => `
            <tr data-fila="${i}">
              <td>${i + 1}</td>
              <td><input class="form-control excel-edit" data-campo="nombres" value="${escaparHtml(e.nombres)}" oninput="editarFilaExcel(${i}, 'nombres', this.value)"></td>
              <td><input class="form-control excel-edit" data-campo="apellidos" value="${escaparHtml(e.apellidos)}" oninput="editarFilaExcel(${i}, 'apellidos', this.value)"></td>
              <td><input class="form-control excel-edit" data-campo="correo" value="${escaparHtml(e.correo)}" oninput="editarFilaExcel(${i}, 'correo', this.value)"></td>
              <td><input class="form-control excel-edit" data-campo="contraseña" value="${escaparHtml(e.contraseña)}" placeholder="(opcional)" oninput="editarFilaExcel(${i}, 'contraseña', this.value)"></td>
              <td class="excel-estado">Pendiente</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  if (boton) {
    boton.classList.remove("oculto");
    boton.textContent = `Registrar todos (${_excelEstudiantes.length})`;
  }
}


function editarFilaExcel(index, campo, valor) {
  if (_excelEstudiantes[index]) _excelEstudiantes[index][campo] = valor;
}


async function registrarTodosEstudiantesExcel() {
  const boton = document.getElementById("btnRegistrarTodosExcel");
  const seccionId = _tutorSalonActual;
  const msg = document.getElementById("msgRegistroTutor");
  if (!seccionId) return;
  if (!_excelEstudiantes.length) return;

  boton.disabled = true;
  boton.textContent = "Registrando...";
  try {
    const res = await apiFetch("/postgres/docentes/me/estudiantes/masivo", {
      method: "POST",
      body: { seccionId, registros: _excelEstudiantes.map((e, i) => ({ ...e, fila: i + 1 })) }
    });
    _excelEstudiantes.forEach((e, i) => {
      const celda = document.querySelector(`#vistaPreviaExcelEstudiantes tr[data-fila="${i}"] .excel-estado`);
      if (celda) {
        const ok = res.registrados.some(r => r.correo === e.correo);
        if (ok) { celda.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px;"><path d="M20 6L9 17l-5-5"/></svg>Registrado'; celda.style.color = "#059669"; }
        else {
          const err = res.errores.find(x => x.fila === i + 1 || x.correo === e.correo);
          celda.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> ' + (err?.error || "error");
          celda.style.color = "#dc2626";
        }
      }
    });
    msg.className = "msg-ok";
    msg.textContent = `Registrados ${res.registrados.length} estudiantes. Errores: ${res.errores.length}.`;
    await cargarListaEstudiantesTutor();
  } catch (e) {
    msg.className = "msg-err";
    msg.textContent = "Error al registrar: " + e.message;
  } finally {
    boton.disabled = false;
    boton.textContent = `Registrar todos (${_excelEstudiantes.length})`;
  }
}


function subirExcelNotas() {
  document.getElementById("excelNotasInput")?.click();
}


async function procesarExcelNotas(evento) {
  const file = evento.target.files[0];
  const msg = document.getElementById("msgExcelNotas");
  const tabla = document.getElementById("tablaNotasSimples");
  if (!file) return;
  try {
    const filas = await leerExcel(file);
    if (!filas.length || !Object.keys(filas[0]).length) {
      if (msg) msg.textContent = "El archivo está vacío.";
      return;
    }
    const cabeceras = Object.keys(filas[0]);
    const kEstudiante = buscarClaveExcel(filas[0], /estudiante|alumno|nombre|correo|email/i);
    const kComportamiento = buscarClaveExcel(filas[0], /comportamiento/i);
    let campos = cabeceras.filter(h => h !== kEstudiante && h !== kComportamiento && !/correo|email|e-mail/i.test(h));
    // El comportamiento ya no se evalúa: su columna se ignora si viene en el Excel
    if (!kEstudiante || campos.length === 0) {
      if (msg) msg.textContent = "El Excel debe tener una columna de estudiante y al menos una de nota.";
      return;
    }
    _nsCampos = [];
    const asignaturaId = Number(document.getElementById("nsCurso")?.value) || 0;
    // Los campos del Excel se crean al instante en el servidor (si ya existen, se reutilizan)
    for (const nombre of campos) {
      if (!nombre || !asignaturaId) continue;
      try {
        const r = await apiFetch("/postgres/docentes/me/campos", { method: "POST", body: { asignaturaId, nombre } });
        if (r.campo && !_nsCampos.some(c => c.nombre === r.campo.nombre)) _nsCampos.push(r.campo);
      } catch (_) {
        if (!_nsCampos.some(c => c.nombre === nombre)) _nsCampos.push({ nombre });
      }
    }
    renderCamposNotasSimples();
    // Recarga la tabla con las columnas correctas antes de aplicar las notas del archivo
    await cargarNotasSimples();
    if (msg) msg.textContent = `Leído ${filas.length} estudiantes, ${campos.length} campos${kComportamiento ? ' (columna Comportamiento ignorada: ya no se evalúa)' : ''}. Revisa la tabla y guarda.`;
    msg.className = "msg-ok";

    const normalizar = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const filasTabla = [...tabla.querySelectorAll("tr[data-estudiante-id]")];
    let aplicadas = 0;
    let sinCoincidencia = 0;
    filas.forEach(f => {
      const valorEst = String(f[kEstudiante] || "").trim();
      const buscaCorreo = valorEst.includes("@");
      const fila = filasTabla.find(tr => {
        const id = Number(tr.dataset.estudianteId);
        const dato = _nsEstudiantesActuales.find(e => e.id === id);
        if (!dato) return false;
        if (buscaCorreo) return normalizar(dato.correo) === normalizar(valorEst);
        return normalizar(`${dato.nombres} ${dato.apellidos}`) === normalizar(valorEst);
      });
      if (!fila) { sinCoincidencia++; return; }
      campos.forEach((campoNombre) => {
        const valor = String(f[campoNombre] || "").trim();
        if (!valor) return;
        const letra = /^[ABDC][AD]?$/.test(valor.toUpperCase()) ? valor.toUpperCase() : letraDesdeNota(Number(valor));
        // Índice real en la tabla (el orden del archivo puede diferir del servidor)
        const ci = _nsCampos.findIndex(c => c.nombre === campoNombre);
        if (ci < 0) return;
        const select = fila.querySelector(`.nota-cuadrito[data-campo="${ci}"]`);
        if (!select || !letra) return;
        select.value = letra;
        cambiarLetraNota(select);
      });
      aplicadas++;
    });
    if (msg) {
      msg.textContent = sinCoincidencia
        ? `Aplicadas notas de ${aplicadas} estudiantes. ${sinCoincidencia} filas no coincidieron con los estudiantes de la sección.`
        : `Notas aplicadas a ${aplicadas} estudiantes. Revisa y pulsa "Guardar notas".`;
    }
  } catch (e) {
    if (msg) { msg.className = "msg-err"; msg.textContent = "No se pudo leer el archivo: " + e.message; }
  }
}

// ── Verificación interna de correo en creación (estudiantes y docentes) ──────

