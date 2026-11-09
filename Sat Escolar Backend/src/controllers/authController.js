// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const estudiantePgModel = require("../models/postgres/estudianteModel");
const docentePgModel = require("../models/postgres/docenteModel");
const usuarioSistemaPgModel = require("../models/postgres/usuarioSistemaModel");
const { respuestaError } = require("../utils/respuestaError");

const SECRET = process.env.JWT_SECRET;

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Usuario y contraseña requeridos" });

    const usuarioSistema = await usuarioSistemaPgModel.buscarUsuarioSistemaPorIdentificador(username);
    if (usuarioSistema) {
      const ok = await bcrypt.compare(password, usuarioSistema.password_hash);
      if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });

      const fullName = `${usuarioSistema.nombres || usuarioSistema.u_nombres || ""} ${usuarioSistema.apellidos || usuarioSistema.u_apellidos || ""}`.trim() || usuarioSistema.username;
      const payload = {
        id: usuarioSistema.usuario_id,
        role: usuarioSistema.rol,
        fullName,
        email: usuarioSistema.correo,
        username: usuarioSistema.username,
        psychologistId: usuarioSistema.psicologo_id || null,
        psychologistCode: usuarioSistema.psicologo_codigo || null,
        authSource: "postgres"
      };
      const token = jwt.sign(payload, SECRET, { expiresIn: "30d" });
      return res.json({ token, ...payload });
    }

    const docente = await docentePgModel.buscarDocentePorCorreo(username);
    if (docente) {
      const ok = docente.password_hash && await bcrypt.compare(password, docente.password_hash);
      if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });

      const fullName = `${docente.nombres} ${docente.apellidos}`.trim();
      const payload = {
        id: docente.id,
        role: "docente",
        fullName,
        email: docente.correo,
        username: docente.correo,
        authSource: "postgres",
        debeCambiarPassword: docente.debe_cambiar_password,
        esTutor: Boolean(docente.es_tutor)
      };
      const token = jwt.sign(payload, SECRET, { expiresIn: "30d" });
      return res.json({ token, ...payload });
    }

    const estudiante = await estudiantePgModel.buscarEstudiantePorCorreo(username);
    if (estudiante) {
      const claveEsperada = String(username).split("@")[0];
      const claveOk = estudiante.password_hash
        ? await bcrypt.compare(password, estudiante.password_hash)
        : password === claveEsperada;
      if (!claveOk) return res.status(401).json({ error: "Contraseña incorrecta" });

      const fullName = `${estudiante.nombres} ${estudiante.apellidos}`.trim();
      const payload = {
        id: estudiante.id,
        role: "estudiante",
        fullName,
        studentId: estudiante.id,
        seccionId: estudiante.seccion_id,
        nivel: estudiante.nivel,
        grado: estudiante.grado,
        seccion: estudiante.letra,
        correo: estudiante.correo,
        authSource: "postgres"
      };
      const token = jwt.sign(payload, SECRET, { expiresIn: "30d" });
      return res.json({ token, ...payload });
    }

    return res.status(401).json({
      error: "El correo no está registrado en el sistema. Revisa que esté bien escrito."
    });
  } catch (e) { respuestaError(res, e); }
}

function distanciaEdicion(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const filas = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) filas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      filas[i][j] = a[i - 1] === b[j - 1]
        ? filas[i - 1][j - 1]
        : Math.min(filas[i - 1][j], filas[i][j - 1], filas[i - 1][j - 1]) + 1;
    }
  }
  return filas[a.length][b.length];
}

async function listarCorreosRegistrados() {
  const [sistema, docentes, estudiantes] = await Promise.all([
    usuarioSistemaPgModel.listarCorreosUsuariosSistema(),
    docentePgModel.listarCorreosDocentes(),
    estudiantePgModel.listarCorreos()
  ]);
  const lista = [];
  sistema.forEach(u => lista.push({ correo: u.correo, nombre: u.username, rol: u.rol || "usuario" }));
  docentes.forEach(d => lista.push({ correo: d.correo, nombre: `${d.nombres} ${d.apellidos}`.trim(), rol: "docente" }));
  estudiantes.forEach(e => lista.push({ correo: e.correo, nombre: `${e.nombres} ${e.apellidos}`.trim(), rol: "estudiante" }));
  return lista.filter(x => x.correo);
}

async function verificarCorreo(req, res) {
  try {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ error: "Ingresa tu correo electrónico" });

    const email = String(correo).trim().toLowerCase();
    const formatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!formatoValido) {
      return res.status(400).json({ error: "El correo no tiene un formato válido (ej: nombre@ofelia.edu.pe)" });
    }

    const usuarioSistema = await usuarioSistemaPgModel.buscarUsuarioSistemaPorIdentificador(email);
    if (usuarioSistema) return res.json({ existe: true, rol: usuarioSistema.rol });

    const docente = await docentePgModel.buscarDocentePorCorreo(email);
    if (docente) return res.json({ existe: true, rol: "docente" });

    const estudiante = await estudiantePgModel.buscarEstudiantePorCorreo(email);
    if (estudiante) return res.json({ existe: true, rol: "estudiante" });

    return res.json({ existe: false });
  } catch (e) {
    respuestaError(res, e);
  }
}

module.exports = { login, verificarCorreo };