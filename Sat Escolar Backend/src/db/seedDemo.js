const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const bcrypt = require("bcryptjs");
const { pool, closePool } = require("../config/postgres");

const YEAR = 2026;
const DEMO_PASSWORD = "123456";
const DIRECTOR_PASSWORD = "Ofelia2026*";
const PSYCHOLOGIST_PASSWORD = "Psicologo123!";

const SECCIONES = [
  { nivel: "Primaria", grado: "1ro", letra: "A", diaTutoria: 1, estudiantes: 21 },
  { nivel: "Primaria", grado: "1ro", letra: "B", diaTutoria: 2, estudiantes: 21 },
  { nivel: "Primaria", grado: "1ro", letra: "C", diaTutoria: 3, estudiantes: 21 },
  { nivel: "Primaria", grado: "1ro", letra: "D", diaTutoria: 4, estudiantes: 21 },
  { nivel: "Primaria", grado: "2do", letra: "A", diaTutoria: 1, estudiantes: 21 },
  { nivel: "Primaria", grado: "2do", letra: "B", diaTutoria: 2, estudiantes: 21 },
  { nivel: "Primaria", grado: "2do", letra: "C", diaTutoria: 3, estudiantes: 21 },
  { nivel: "Primaria", grado: "2do", letra: "D", diaTutoria: 4, estudiantes: 21 },
  { nivel: "Primaria", grado: "3ro", letra: "A", diaTutoria: 1, estudiantes: 21 },
  { nivel: "Primaria", grado: "3ro", letra: "B", diaTutoria: 2, estudiantes: 21 },
  { nivel: "Primaria", grado: "3ro", letra: "C", diaTutoria: 3, estudiantes: 21 },
  { nivel: "Primaria", grado: "4to", letra: "A", diaTutoria: 1, estudiantes: 21 },
  { nivel: "Primaria", grado: "4to", letra: "B", diaTutoria: 2, estudiantes: 21 },
  { nivel: "Primaria", grado: "4to", letra: "C", diaTutoria: 3, estudiantes: 21 },
  { nivel: "Primaria", grado: "5to", letra: "A", diaTutoria: 1, estudiantes: 21 },
  { nivel: "Primaria", grado: "5to", letra: "B", diaTutoria: 2, estudiantes: 21 },
  { nivel: "Secundaria", grado: "4to", letra: "F", diaTutoria: 5, estudiantes: 0 },
  { nivel: "Secundaria", grado: "5to", letra: "A", diaTutoria: 5, estudiantes: 0 },
];

const TUTORES = [
  { nombres: "Gilma", apellidos: "Torres Tuesta", correo: "gilma.torres@ofelia.edu.pe" },
  { nombres: "Maria Edith", apellidos: "Navarro Pinedo", correo: "maria.navarro@ofelia.edu.pe" },
  { nombres: "Juan Natanael", apellidos: "Zambrano Romero", correo: "juan.zambrano@ofelia.edu.pe" },
  { nombres: "Milagros", apellidos: "Castillo Sanchez", correo: "milagros.castillo@ofelia.edu.pe" },
  { nombres: "Nerlin", apellidos: "Flores Perez", correo: "nerlin.flores@ofelia.edu.pe" },
  { nombres: "Jose Wilson", apellidos: "Mego Macedo", correo: "jose.mego@ofelia.edu.pe" },
  { nombres: "Marco Anthony", apellidos: "Del Aguila Morey", correo: "marco.delaguila@ofelia.edu.pe" },
  { nombres: "Roxana Milagros", apellidos: "Oliva Rojas", correo: "roxana.oliva@ofelia.edu.pe" },
  { nombres: "Sindy Marisela", apellidos: "Romero Tejada", correo: "sindy.romero@ofelia.edu.pe" },
  { nombres: "Marcia Rosanna", apellidos: "Perez Rodriguez", correo: "marcia.perez@ofelia.edu.pe" },
  { nombres: "Beatriz", apellidos: "Canario Tello", correo: "beatriz.canario@ofelia.edu.pe" },
  { nombres: "Marina", apellidos: "Grandez Gonzales", correo: "marina.grandez@ofelia.edu.pe" },
  { nombres: "Maria Rogelia", apellidos: "Vela Mego", correo: "maria.vela@ofelia.edu.pe" },
  { nombres: "Weider", apellidos: "Viena Flores", correo: "weider.viena@ofelia.edu.pe" },
  { nombres: "Eudes Guillermo", apellidos: "Paredes Torres", correo: "eudes.paredes@ofelia.edu.pe" },
  { nombres: "Cesar Felix", apellidos: "Cabanillas Becerra", correo: "cesar.cabanillas@ofelia.edu.pe" },
];

const ASIGNATURAS = [
  { nombre: "General", codigo: "GENERAL" },
  { nombre: "Matemática", codigo: "MAT" },
  { nombre: "Comunicación", codigo: "COM" },
  { nombre: "Ciencia y Tecnología", codigo: "CYT" },
  { nombre: "Ciencias Sociales", codigo: "CCSS" },
  { nombre: "Desarrollo Personal, Ciudadanía y Cívica", codigo: "DPCC" },
  { nombre: "Inglés", codigo: "ING" },
  { nombre: "Educación Física", codigo: "EF" },
  { nombre: "Arte y Cultura", codigo: "ARTE" },
  { nombre: "Educación Religiosa", codigo: "REL" },
  { nombre: "Tutoría", codigo: "TUT" },
];

const CAMPOS = ["Práctica calificada", "Examen bimestral", "Participación en clase"];
const TRIMESTRES = [
  { nombre: "I Bimestre", orden: 1 },
  { nombre: "II Bimestre", orden: 2 },
  { nombre: "III Bimestre", orden: 3 },
  { nombre: "IV Bimestre", orden: 4 },
];
const PERIODOS = [
  { nombre: "Año escolar", inicio: "2026-03-01", fin: "2026-12-15", activo: true },
  { nombre: "I Bimestre", inicio: "2026-03-01", fin: "2026-05-15", activo: false },
  { nombre: "II Bimestre", inicio: "2026-05-18", fin: "2026-07-24", activo: false },
  { nombre: "III Bimestre", inicio: "2026-08-10", fin: "2026-10-16", activo: false },
  { nombre: "IV Bimestre", inicio: "2026-10-19", fin: "2026-12-15", activo: false },
];

const NOMBRES = ["Adrian","Alessandro","Alexander","Alvaro","Anderson","Andre","Andres","Angel","Anthony","Brayan","Carlos","Christian","Daniel","David","Diego","Edison","Edwin","Elder","Elias","Enzo","Fabricio","Facundo","Fernando","Franco","Gabriel","Gianfranco","Gino","Gonzalo","Hugo","Ian","Jair","Jared","Javier","Jefferson","Jhon","Jhoel","Joel","Jorge","Jose","Juan","Kevin","Leonardo","Liam","Lucas","Luis","Manuel","Marco","Matias","Maximiliano","Miguel","Nicolas","Noel","Oliver","Oscar","Patrick","Piero","Rafael","Renato","Ricardo","Rodrigo","Samuel","Santiago","Sebastian","Thiago","Tomas","Valentino","Victor","Vladimir","William","Yamil","Adriana","Aileen","Aitana","Alejandra","Alessia","Amelia","Ana","Andrea","Angela","Antonella","Belen","Briana","Camila","Carla","Carolina","Catalina","Claudia","Constanza","Cristina","Daniela","Danna","Diana","Elena","Emilia","Emma","Evelyn","Fabiana","Fiorella","Flor","Gabriela","Genesis","Giuliana","Grace","Grecia","Hannah","Isabela","Isabel","Jade","Jazmin","Jimena","Karen","Kiara","Lara","Laura","Leyla","Lia","Lorena","Luciana","Luisa","Luz","Macarena","Maira","Maria","Mariana","Mariel","Marisol","Mia","Micaela","Michelle","Milagros","Natalia","Nicole","Noelia","Olivia","Paola","Paulina","Renata","Rocio","Romina","Rosa","Samantha","Sara","Sofia","Sol","Stefany","Susan","Tamara","Valentina","Valeria","Victoria","Ximena","Yamileth","Yara","Yasmin","Yolanda","Zoe"];
const APELLIDOS = ["Acosta","Aguilar","Alvarez","Arias","Arroyo","Avila","Benitez","Bravo","Cabrera","Calderon","Campos","Cardenas","Carranza","Castillo","Castro","Chavez","Cisneros","Cordova","Cornejo","Corrales","Cruz","Cuadros","De la Cruz","Delgado","Diaz","Dominguez","Duarte","Escobar","Espinoza","Estrella","Farias","Fernandez","Flores","Fuentes","Galvez","Garcia","Gomez","Gonzales","Gutierrez","Hernandez","Herrera","Huaman","Huanca","Ibarra","Inca","Jara","Lara","Leon","Lopez","Lozano","Maldonado","Mamani","Marquez","Martinez","Mendoza","Meza","Miranda","Molina","Montes","Morales","Moran","Munoz","Neyra","Nina","Ochoa","Orellana","Ortega","Ortiz","Pacheco","Palacios","Paredes","Perez","Poma","Quispe","Ramirez","Ramos","Rengifo","Reyes","Rios","Rivera","Robles","Rocha","Rodriguez","Rojas","Romero","Ruiz","Salazar","Sanchez","Sandoval","Santana","Santillan","Sarmiento","Serna","Silva","Solis","Soto","Suarez","Sullivan","Tafur","Tapia","Torres","Vargas","Vasquez","Vela","Vera","Vilca","Villanueva","Villegas","Yupanqui","Zamora"];

const LIKERT = [
  { texto: "Nunca", puntaje: 0 },
  { texto: "Varios días", puntaje: 33 },
  { texto: "Más de la mitad de los días", puntaje: 66 },
  { texto: "Casi todos los días", puntaje: 100 },
];

const GAD7 = [
  "¿Se ha sentido nervioso, ansioso o con los nervios de punta?",
  "¿No ha podido dejar de preocuparse o controlar sus preocupaciones?",
  "¿Se ha preocupado demasiado por diferentes cosas?",
  "¿Le ha costado trabajo relajarse?",
  "¿Se ha sentido tan inquieto que le cuesta estar quieto?",
  "¿Se ha sentido fácilmente molesto o irritable?",
  "¿Ha sentido miedo como si algo terrible fuera a pasar?",
];

const PHQ9 = [
  "¿Ha tenido poco interés o placer en hacer las cosas?",
  "¿Se ha sentido decaído, deprimido o sin esperanza?",
  "¿Ha tenido dificultad para conciliar el sueño, mantenerlo o dormir demasiado?",
  "¿Se ha sentido cansado o con poca energía?",
  "¿Ha tenido poco apetito o ha comido en exceso?",
  "¿Se ha sentido mal consigo mismo, o que es un fracaso, o que ha defraudado a su familia o a sí mismo?",
  "¿Ha tenido dificultad para concentrarse en cosas, como leer el periódico o ver la televisión?",
  "¿Se ha movido o hablado tan despacio que otras personas podrían haberlo notado, o lo contrario: se ha sentido agitado o inquieto?",
  "¿Ha tenido pensamientos de que sería mejor estar muerto, o de hacerse daño de alguna manera?",
];

const FORMULARIOS = [
  {
    titulo: "GAD-7 - Ansiedad",
    descripcion: "Test validado de ansiedad generalizada (MINSA)",
    esValidado: true,
    codigoMinsa: "GAD-7",
    preguntas: GAD7.map((pregunta, i) => ({ tipo: "likert", pregunta, opciones: LIKERT, orden: i + 1 })),
  },
  {
    titulo: "PHQ-9 - Depresión",
    descripcion: "Test validado de depresión (MINSA)",
    esValidado: true,
    codigoMinsa: "PHQ-9",
    preguntas: PHQ9.map((pregunta, i) => ({ tipo: "likert", pregunta, opciones: LIKERT, orden: i + 1 })),
  },
  {
    titulo: "Ficha Socioeducativa",
    descripcion: "Ficha de contexto familiar y socioeducativo",
    esValidado: false,
    codigoMinsa: null,
    preguntas: [
      { tipo: "cerrada", pregunta: "¿Con quién vives?", opciones: [
        { texto: "Ambos padres", puntaje: 0 }, { texto: "Solo mi mamá", puntaje: 20 },
        { texto: "Solo mi papá", puntaje: 25 }, { texto: "Abuelos", puntaje: 40 },
        { texto: "Otro familiar", puntaje: 50 },
      ] },
      { tipo: "cerrada", pregunta: "¿Cómo es la convivencia en tu casa?", opciones: [
        { texto: "Tranquila", puntaje: 0 }, { texto: "A veces discutimos", puntaje: 30 },
        { texto: "Hay conflictos frecuentes", puntaje: 60 }, { texto: "Hay violencia", puntaje: 100 },
      ] },
      { tipo: "cerrada", pregunta: "¿Alguien consume alcohol o drogas en tu hogar?", opciones: [
        { texto: "No", puntaje: 0 }, { texto: "A veces", puntaje: 50 },
        { texto: "Sí, frecuentemente", puntaje: 100 },
      ] },
      { tipo: "cerrada", pregunta: "¿Te hacen trabajar fuera de casa?", opciones: [
        { texto: "No", puntaje: 0 }, { texto: "A veces", puntaje: 50 },
        { texto: "Sí, todos los días", puntaje: 100 },
      ] },
      { tipo: "cerrada", pregunta: "¿Te sientes seguro en tu barrio?", opciones: [
        { texto: "Sí", puntaje: 0 }, { texto: "A veces no", puntaje: 40 },
        { texto: "No", puntaje: 80 },
      ] },
      { tipo: "abierta", pregunta: "¿Qué haces en tu tiempo libre?", opciones: [] },
      { tipo: "abierta", pregunta: "¿Hay algo que te preocupe en casa?", opciones: [] },
      { tipo: "abierta", pregunta: "¿Cómo te sientes físicamente?", opciones: [] },
    ].map((p, i) => ({ ...p, orden: i + 1 })),
  },
  {
    titulo: "Escala de Autoestima",
    descripcion: "Percepción que el estudiante tiene de sí mismo",
    esValidado: false,
    codigoMinsa: null,
    preguntas: [
      { tipo: "likert", pregunta: "Siento que soy una persona valiosa.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "A veces", puntaje: 66 },
        { texto: "Casi siempre", puntaje: 33 }, { texto: "Siempre", puntaje: 0 },
      ] },
      { tipo: "likert", pregunta: "Me siento orgulloso de mis logros.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "A veces", puntaje: 66 },
        { texto: "Casi siempre", puntaje: 33 }, { texto: "Siempre", puntaje: 0 },
      ] },
      { tipo: "likert", pregunta: "Confío en mis capacidades.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "A veces", puntaje: 66 },
        { texto: "Casi siempre", puntaje: 33 }, { texto: "Siempre", puntaje: 0 },
      ] },
      { tipo: "likert", pregunta: "Me acepto tal como soy.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "A veces", puntaje: 66 },
        { texto: "Casi siempre", puntaje: 33 }, { texto: "Siempre", puntaje: 0 },
      ] },
      { tipo: "likert", pregunta: "Siento que no le importo a nadie.", opciones: [
        { texto: "Nunca", puntaje: 0 }, { texto: "A veces", puntaje: 33 },
        { texto: "Casi siempre", puntaje: 66 }, { texto: "Siempre", puntaje: 100 },
      ] },
      { tipo: "likert", pregunta: "Pienso que todo me sale mal.", opciones: [
        { texto: "Nunca", puntaje: 0 }, { texto: "A veces", puntaje: 33 },
        { texto: "Casi siempre", puntaje: 66 }, { texto: "Siempre", puntaje: 100 },
      ] },
      { tipo: "likert", pregunta: "Me cuesta hacer amigos.", opciones: [
        { texto: "Nunca", puntaje: 0 }, { texto: "A veces", puntaje: 33 },
        { texto: "Casi siempre", puntaje: 66 }, { texto: "Siempre", puntaje: 100 },
      ] },
      { tipo: "likert", pregunta: "Me siento solo en el colegio.", opciones: [
        { texto: "Nunca", puntaje: 0 }, { texto: "A veces", puntaje: 33 },
        { texto: "Casi siempre", puntaje: 66 }, { texto: "Siempre", puntaje: 100 },
      ] },
    ].map((p, i) => ({ ...p, orden: i + 1 })),
  },
  {
    titulo: "Clima Escolar",
    descripcion: "Percepción de la convivencia y seguridad en el colegio",
    esValidado: false,
    codigoMinsa: null,
    preguntas: [
      { tipo: "likert", pregunta: "He visto peleas o discusiones fuertes en el colegio.", opciones: LIKERT.map(o => ({ ...o, puntaje: o.puntaje })) },
      { tipo: "likert", pregunta: "Me siento inseguro en el recreo.", opciones: LIKERT.map(o => ({ ...o, puntaje: o.puntaje })) },
      { tipo: "likert", pregunta: "Algún compañero se burla de mí.", opciones: LIKERT.map(o => ({ ...o, puntaje: o.puntaje })) },
      { tipo: "likert", pregunta: "Siento que los profesores no me escuchan.", opciones: LIKERT.map(o => ({ ...o, puntaje: o.puntaje })) },
      { tipo: "likert", pregunta: "Me llevo bien con mis compañeros.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "Varios días", puntaje: 66 },
        { texto: "Más de la mitad de los días", puntaje: 33 }, { texto: "Casi todos los días", puntaje: 0 },
      ] },
      { tipo: "likert", pregunta: "Me siento parte de mi salón.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "Varios días", puntaje: 66 },
        { texto: "Más de la mitad de los días", puntaje: 33 }, { texto: "Casi todos los días", puntaje: 0 },
      ] },
      { tipo: "likert", pregunta: "Puedo pedir ayuda a un profesor cuando la necesito.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "Varios días", puntaje: 66 },
        { texto: "Más de la mitad de los días", puntaje: 33 }, { texto: "Casi todos los días", puntaje: 0 },
      ] },
      { tipo: "likert", pregunta: "Me gusta venir al colegio.", opciones: [
        { texto: "Nunca", puntaje: 100 }, { texto: "Varios días", puntaje: 66 },
        { texto: "Más de la mitad de los días", puntaje: 33 }, { texto: "Casi todos los días", puntaje: 0 },
      ] },
    ].map((p, i) => ({ ...p, orden: i + 1 })),
  },
];

const OPEN_ANSWERS = {
  bajo: [
    "Juego con mis amigos y leo cuentos.",
    "No, nada. Estoy bien.",
    "Me siento bien y con energía.",
  ],
  medio: [
    "A veces me quedo solo en casa.",
    "Me preocupa que mi familia tenga problemas de dinero.",
    "A veces me siento cansado y me duele la cabeza.",
  ],
  alto: [
    "Ayudo a mi familia en el mercado.",
    "Hay problemas y discusiones en casa.",
    "Me siento cansado, tengo somnolencia y dolor de cabeza.",
  ],
  violencia: [
    "Casi no salgo porque en mi casa hay problemas.",
    "Hay violencia y me da miedo estar en casa.",
    "Me siento cansado y con miedo.",
  ],
  autolesion: [
    "No me gusta estar en casa, me siento solo.",
    "A veces no quiero estar en el colegio.",
    "Me siento triste y sin energía.",
  ],
};

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function oneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

function weekdays(start, end) {
  const dates = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(fmtDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function insertMany(client, table, columns, rows, chunkSize = 800) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const text = [];
    const params = [];
    let p = 1;
    for (const row of chunk) {
      text.push(`(${row.map(() => `$${p++}`).join(",")})`);
      params.push(...row);
    }
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${text.join(",")}`,
      params
    );
  }
}

async function existingTables(client, names) {
  const result = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [names]
  );
  return result.rows.map((r) => r.tablename);
}

async function truncateAll(client) {
  const names = [
    "usuarios", "psicologos", "docentes", "estudiantes", "secciones",
    "asignaturas", "competencias", "campos_nota", "niveles_logro",
    "periodos_academicos", "trimestres_academicos", "configuraciones_riesgo",
    "formularios_psicologicos", "formulario_preguntas", "pregunta_opciones",
    "formulario_respuestas", "formulario_habilitaciones", "formularios_activos",
    "notas_simples", "notas", "evaluaciones_academicas",
    "calificaciones_competencia", "calificaciones_trimestrales_competencia", "productos_evaluacion",
    "asistencias", "comportamientos", "observaciones_bimestre",
    "perfiles_estudiante", "fichas_diagnosticas_socioeducativas",
    "incidencias", "derivaciones", "expediente_formatos", "charlas_aula",
    "casos_seguimiento", "seguimientos_psicopedagogicos",
    "alertas_riesgo", "evaluaciones_riesgo_estudiante", "evaluaciones_riesgo",
    "reportes_anonimos", "reporte_archivos", "mensajes_anonimos",
    "codigos_verificacion", "verification_codes", "pending_registrations",
    "auditoria_accesos", "tests_personalizados", "evaluaciones_anuales",
    "evaluacion_anual_respuestas", "predicciones_ia",
  ];
  const found = await existingTables(client, names);
  if (found.length) {
    await client.query(`TRUNCATE TABLE ${found.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  return found.length;
}

function perfilRiesgo(globalIndex, seccionIndex) {
  const marca = (globalIndex * 7 + seccionIndex * 3) % 20;
  if (marca < 12) return "bajo";
  if (marca < 17) return "medio";
  return "alto";
}

function datosPerfil(estudiante, perfil, rng) {
  if (perfil === "bajo") {
    return {
      conQuien: pick(rng, ["padres", "padres", "madre", "padre"]),
      situacion: "estable",
      antecedentes: rng() < 0.15 ? "Ninguno relevante" : null,
    };
  }
  if (perfil === "medio") {
    return {
      conQuien: pick(rng, ["madre", "padre", "abuelos", "tutor"]),
      situacion: pick(rng, ["conflictiva", "ausencia", "sobreproteccion"]),
      antecedentes: rng() < 0.4 ? "Ansiedad o dificultades de atención reportadas por la familia" : null,
    };
  }
  if (estudiante.critical === "violencia") {
    return {
      conQuien: pick(rng, ["madre", "abuelos", "tutor", "solo"]),
      situacion: "violencia",
      antecedentes: "Violencia familiar reportada en la ficha",
    };
  }
  if (estudiante.critical === "autolesion") {
    return {
      conQuien: pick(rng, ["solo", "tutor", "albergue"]),
      situacion: "ausencia",
      antecedentes: "Antecedente de tristeza persistente y aislamiento",
    };
  }
  return {
    conQuien: pick(rng, ["solo", "abuelos", "tutor", "albergue"]),
    situacion: pick(rng, ["violencia", "ausencia", "conflictiva"]),
    antecedentes: "Antecedentes familiares de riesgo psicosocial",
  };
}

async function main() {
  const started = Date.now();
  const client = await pool.connect();

  try {
    const info = await client.query(
      `SELECT current_database() AS db, current_user AS usuario,
              COALESCE(inet_server_addr()::text, 'local') AS host,
              inet_server_port() AS puerto`
    );
    const { db, usuario, host, puerto } = info.rows[0];
    const esLocal = host === "local" || host === "localhost" || host.startsWith("127.") || host.startsWith("::1");
    console.log(`Destino: db=${db} usuario=${usuario} host=${host}:${puerto || "n/a"}`);
    if (!esLocal && process.env.ALLOW_REMOTE_SEED !== "true") {
      throw new Error(
        "La base de datos destino no es local. Define ALLOW_REMOTE_SEED=true para confirmar que deseas sobrescribirla."
      );
    }

    await client.query("BEGIN");

    const tablas = await truncateAll(client);
    console.log(`Limpieza: ${tablas} tablas reiniciadas`);

    const hashDirector = bcrypt.hashSync(DIRECTOR_PASSWORD, 10);
    const hashPsicologo = bcrypt.hashSync(PSYCHOLOGIST_PASSWORD, 10);
    const hashDocente = bcrypt.hashSync(DEMO_PASSWORD, 10);
    const hashEstudiante = bcrypt.hashSync(DEMO_PASSWORD, 10);

    const dir = await client.query(
      `INSERT INTO usuarios (username, correo, password_hash, rol, activo, nombres, apellidos)
       VALUES ('directora', 'director@ofelia.edu.pe', $1, 'director', TRUE, 'Laura Felicia', 'Velázquez')
       RETURNING id`,
      [hashDirector]
    );
    const directorUserId = dir.rows[0].id;

    const psiUser = await client.query(
      `INSERT INTO usuarios (username, correo, password_hash, rol, activo, nombres, apellidos)
       VALUES ('carlos.pineda', 'carlos.pineda@ofelia.edu.pe', $1, 'psicologo', TRUE, 'Carlos', 'Pineda Torres')
       RETURNING id`,
      [hashPsicologo]
    );
    const psicologoUserId = psiUser.rows[0].id;
    const psi = await client.query(
      `INSERT INTO psicologos (usuario_id, nombres, apellidos, codigo, activo)
       VALUES ($1, 'Carlos', 'Pineda Torres', 'PSI-0001', TRUE)
       RETURNING id`,
      [psicologoUserId]
    );
    const psicologoId = psi.rows[0].id;

    const seccionIds = [];
    for (const seccion of SECCIONES) {
      const result = await client.query(
        `INSERT INTO secciones (nivel, grado, letra, dia_tutoria)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (nivel, grado, letra)
         DO UPDATE SET dia_tutoria = EXCLUDED.dia_tutoria
         RETURNING id`,
        [seccion.nivel, seccion.grado, seccion.letra, seccion.diaTutoria]
      );
      seccionIds.push(result.rows[0].id);
    }
    console.log(`Secciones: ${seccionIds.length}`);

    const periodos = [];
    for (const periodo of PERIODOS) {
      const result = await client.query(
        `INSERT INTO periodos_academicos (nombre, anio, fecha_inicio, fecha_fin, activo)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (anio, nombre)
         DO UPDATE SET fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin, activo = EXCLUDED.activo
         RETURNING id`,
        [periodo.nombre, YEAR, periodo.inicio, periodo.fin, periodo.activo]
      );
      periodos.push({ ...periodo, id: result.rows[0].id });
    }

    const trimestres = [];
    for (const trimestre of TRIMESTRES) {
      const result = await client.query(
        `INSERT INTO trimestres_academicos (nombre, anio, orden, activo)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (anio, orden)
         DO UPDATE SET nombre = EXCLUDED.nombre, activo = TRUE
         RETURNING id`,
        [trimestre.nombre, YEAR, trimestre.orden]
      );
      trimestres.push({ ...trimestre, id: result.rows[0].id });
    }

    await client.query(
      `INSERT INTO niveles_logro (codigo, nombre, descripcion, orden) VALUES
        ('AD', 'Logro destacado', 'Evidencia un nivel superior al esperado.', 1),
        ('A', 'Logro esperado', 'Evidencia el nivel esperado respecto a la competencia.', 2),
        ('B', 'En proceso', 'Está próximo al nivel esperado y requiere acompañamiento.', 3),
        ('C', 'En inicio', 'Muestra progreso mínimo y necesita mayor acompañamiento.', 4)
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, orden = EXCLUDED.orden`
    );

    const asignaturas = [];
    for (const asignatura of ASIGNATURAS) {
      const result = await client.query(
        `INSERT INTO asignaturas (nombre, codigo, activo)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, activo = TRUE
         RETURNING id`,
        [asignatura.nombre, asignatura.codigo]
      );
      asignaturas.push({ ...asignatura, id: result.rows[0].id });
    }

    const camposNota = [];
    for (const asignatura of asignaturas) {
      for (let i = 0; i < CAMPOS.length; i += 1) {
        const result = await client.query(
          `INSERT INTO campos_nota (asignatura_id, nombre, orden)
           VALUES ($1, $2, $3)
           ON CONFLICT (asignatura_id, nombre) DO UPDATE SET orden = EXCLUDED.orden
           RETURNING id, nombre`,
          [asignatura.id, CAMPOS[i], i + 1]
        );
        camposNota.push({ asignaturaId: asignatura.id, nombre: result.rows[0].nombre });
      }
    }

    await client.query(`UPDATE configuraciones_riesgo SET activo = FALSE`);
    await client.query(
      `INSERT INTO configuraciones_riesgo
        (version, peso_asistencia, peso_academico, peso_cuestionario, peso_comportamiento, limite_bajo, limite_alto, activo)
       VALUES (4, 0.3500, 0.4000, 0.1500, 0.1000, 60, 80, TRUE)
       ON CONFLICT (version) DO UPDATE SET
         peso_asistencia = EXCLUDED.peso_asistencia,
         peso_academico = EXCLUDED.peso_academico,
         peso_cuestionario = EXCLUDED.peso_cuestionario,
         peso_comportamiento = EXCLUDED.peso_comportamiento,
         limite_bajo = EXCLUDED.limite_bajo,
         limite_alto = EXCLUDED.limite_alto,
         activo = TRUE`
    );

    const tutores = [];
    for (let i = 0; i < TUTORES.length; i += 1) {
      const tutor = TUTORES[i];
      const seccionId = seccionIds[i];
      const result = await client.query(
        `INSERT INTO docentes (user_id, nombres, apellidos, correo, password_hash, debe_cambiar_password, es_tutor, activo)
         VALUES (NULL, $1, $2, $3, $4, FALSE, TRUE, TRUE)
         RETURNING id`,
        [tutor.nombres, tutor.apellidos, tutor.correo.toLowerCase(), hashDocente]
      );
      const docenteId = result.rows[0].id;
      tutores.push({ ...tutor, docenteId, seccionId });

      await client.query(
        `INSERT INTO docente_secciones (docente_id, seccion_id) VALUES ($1, $2)`,
        [docenteId, seccionId]
      );

      const asignaturasSeccion = [];
      for (const asignatura of asignaturas) {
        asignaturasSeccion.push([docenteId, asignatura.id, seccionId]);
      }
      await insertMany(
        client,
        "docente_asignaturas_secciones",
        ["docente_id", "asignatura_id", "seccion_id"],
        asignaturasSeccion
      );
    }
    console.log(`Docentes tutores: ${tutores.length}`);

    const docentePorSeccion = new Map(tutores.map((t) => [t.seccionId, t.docenteId]));

    const estudiantes = [];
    let globalIndex = 0;
    let altos = 0;

    for (let seccionIndex = 0; seccionIndex < SECCIONES.length; seccionIndex += 1) {
      const seccion = SECCIONES[seccionIndex];
      const seccionId = seccionIds[seccionIndex];
      for (let i = 0; i < seccion.estudiantes; i += 1) {
        const rng = mulberry32(20260000 + seccionIndex * 1000 + i);
        const nombres = pick(rng, NOMBRES);
        const apellidos = `${pick(rng, APELLIDOS)} ${pick(rng, APELLIDOS)}`;
        const correo = `est.${seccion.grado}.${seccion.letra}.${i}@ofelia.edu.pe`.toLowerCase();
        const perfil = perfilRiesgo(globalIndex, seccionIndex);

        let critical = null;
        if (perfil === "alto") {
          if (altos < 3) critical = "violencia";
          else if (altos === 3) critical = "autolesion";
          altos += 1;
        }

        const dni = String(40000000 + ((globalIndex * 137) % 39999999) + 10000000);
        const anioNacimiento = 2019 - (["1ro", "2do", "3ro", "4to", "5to"].indexOf(seccion.grado));
        const fechaNacimiento = `${anioNacimiento}-${String((globalIndex % 12) + 1).padStart(2, "0")}-${String((globalIndex % 27) + 1).padStart(2, "0")}`;
        const telefono = `9${String(10000000 + ((globalIndex * 7919) % 89999999)).slice(0, 8)}`;
        const direccion = `Av. Los Andes ${100 + (globalIndex % 400)}, ${seccion.grado} ${seccion.letra}`;
        const baseAbility = perfil === "bajo" ? 17.2 : perfil === "medio" ? 12.6 : 9.0;
        const declining = rng() < (perfil === "alto" ? 0.6 : perfil === "medio" ? 0.35 : 0.08);

        const result = await client.query(
          `INSERT INTO estudiantes (nombres, apellidos, correo, seccion_id, password_hash, activo)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           RETURNING id`,
          [nombres, apellidos, correo, seccionId, hashEstudiante]
        );

        estudiantes.push({
          id: result.rows[0].id,
          nombres,
          apellidos,
          correo,
          seccionIndex,
          seccionId,
          perfil,
          critical,
          rng,
          baseAbility,
          declining,
          dni,
          fechaNacimiento,
          telefono,
          direccion,
          docenteId: docentePorSeccion.get(seccionId) || null,
        });

        globalIndex += 1;
      }
    }
    console.log(`Estudiantes: ${estudiantes.length}`);

    const filasPerfil = [];
    const filasFicha = [];
    for (const estudiante of estudiantes) {
      const datos = datosPerfil(estudiante, estudiante.perfil, estudiante.rng);
      const apoderadoNombre = `${pick(estudiante.rng, NOMBRES)} ${pick(estudiante.rng, APELLIDOS)}`;
      const observaciones = estudiante.critical
        ? "Ficha completada. Se recomienda seguimiento prioritario."
        : "Ficha completada en la entrevista inicial.";

      filasPerfil.push([
        estudiante.id,
        estudiante.dni,
        estudiante.fechaNacimiento,
        estudiante.direccion,
        estudiante.telefono,
        datos.conQuien,
        datos.situacion,
        datos.antecedentes,
        apoderadoNombre,
        String(40000000 + ((estudiante.id * 313) % 39999999) + 10000000),
        pick(estudiante.rng, ["Madre", "Padre", "Abuela", "Tío", "Tutora"]),
        estudiante.telefono,
        pick(estudiante.rng, ["Ama de casa", "Comerciante", "Agricultor", "Taxista", "Docente"]),
        true,
        "ninguna",
      ]);

      filasFicha.push([
        estudiante.id,
        JSON.stringify({
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          fecha_nacimiento: estudiante.fechaNacimiento,
          sexo: pick(estudiante.rng, ["M", "F"]),
          dni: estudiante.dni,
          direccion: estudiante.direccion,
          telefono: estudiante.telefono,
          con_quien_vive: datos.conQuien,
          situacion_convivencia: datos.situacion,
          apoderado_nombres: apoderadoNombre.split(" ")[0],
          apoderado_apellidos: apoderadoNombre.split(" ").slice(1).join(" "),
          apoderado_telefono: estudiante.telefono,
          apoderado_parentesco: "Madre",
          antecedentes: datos.antecedentes,
          observaciones,
        }),
        true,
      ]);
    }

    await insertMany(
      client,
      "perfiles_estudiante",
      [
        "estudiante_id", "dni", "fecha_nacimiento", "direccion", "telefono",
        "con_quien_vive", "situacion_convivencia", "antecedentes",
        "apoderado_nombre", "apoderado_dni", "apoderado_parentesco",
        "apoderado_telefono", "apoderado_ocupacion", "perfil_completado", "nee",
      ],
      filasPerfil
    );
    await insertMany(
      client,
      "fichas_diagnosticas_socioeducativas",
      ["estudiante_id", "datos", "completada"],
      filasFicha
    );
    console.log(`Perfiles y fichas: ${filasPerfil.length}`);

    const filasNotas = [];
    const notaSimplePorClave = new Map();
    for (const estudiante of estudiantes) {
      const subjectOffsets = asignaturas.map(() => (estudiante.rng() - 0.5) * (estudiante.perfil === "alto" ? 2.4 : estudiante.perfil === "medio" ? 1.6 : 1.8));
      for (let asignaturaIndex = 0; asignaturaIndex < asignaturas.length; asignaturaIndex += 1) {
        const asignatura = asignaturas[asignaturaIndex];
        for (let trimestreIndex = 0; trimestreIndex < trimestres.length; trimestreIndex += 1) {
          const trimestre = trimestres[trimestreIndex];
          const trend = estudiante.declining ? -0.9 * trimestreIndex : estudiante.perfil === "bajo" ? 0.12 * trimestreIndex : 0;
          let base = estudiante.baseAbility + subjectOffsets[asignaturaIndex] + trend;
          for (let campoIndex = 0; campoIndex < CAMPOS.length; campoIndex += 1) {
            let nota = base + (estudiante.rng() - 0.5) * 1.1;
            if (estudiante.perfil === "bajo") nota = Math.max(nota, 14.2);
            if (estudiante.perfil === "medio") {
              nota = Math.min(nota, 13.9);
              nota = Math.max(nota, 11.0);
            }
            if (estudiante.perfil === "alto") {
              if (estudiante.rng() < 0.1) nota = 11.0 + estudiante.rng() * 1.8;
              else nota = Math.min(nota, 10.9);
              nota = Math.max(nota, 5.5);
            }
            const notaFinal = oneDecimal(clamp(nota, 0, 20));
            const clave = `${estudiante.id}|${asignatura.id}|${trimestre.id}|${CAMPOS[campoIndex]}`;
            notaSimplePorClave.set(clave, notaFinal);
            filasNotas.push([
              estudiante.id,
              asignatura.id,
              trimestre.id,
              CAMPOS[campoIndex],
              notaFinal,
            ]);
          }
        }
      }
    }
    await insertMany(
      client,
      "notas_simples",
      ["estudiante_id", "asignatura_id", "trimestre_id", "campo", "nota"],
      filasNotas,
      1000
    );
    console.log(`Notas: ${filasNotas.length}`);

    const estudiantesPorSeccion = new Map();
    for (const estudiante of estudiantes) {
      if (!estudiantesPorSeccion.has(estudiante.seccionId)) estudiantesPorSeccion.set(estudiante.seccionId, []);
      estudiantesPorSeccion.get(estudiante.seccionId).push(estudiante);
    }
    const periodosBimestre = periodos
      .filter((periodo) => periodo.nombre.includes("Bimestre"))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    const conjuntosPeriodo = [
      { periodo: periodos.find((periodo) => periodo.nombre === "Año escolar"), trimestres },
      ...periodosBimestre.map((periodo, index) => ({
        periodo,
        trimestres: trimestres.filter((trimestre) => trimestre.orden === index + 1),
      })),
    ].filter((item) => item.periodo && item.trimestres.length > 0);
    let totalEvaluaciones = 0;
    let totalNotasEvaluacion = 0;
    for (const [seccionId, alumnos] of estudiantesPorSeccion.entries()) {
      const docenteId = docentePorSeccion.get(seccionId) || null;
      for (const { periodo, trimestres: trimestresPeriodo } of conjuntosPeriodo) {
        const fechaEvaluacion = periodo.fin > "2026-11-06" ? "2026-11-06" : periodo.fin;
        for (const asignatura of asignaturas) {
          for (const campo of CAMPOS) {
            const evaluacion = await client.query(
              `INSERT INTO evaluaciones_academicas
                 (seccion_id, periodo_id, asignatura_id, nombre, fecha, peso, creado_por)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [seccionId, periodo.id, asignatura.id, `${campo} (${periodo.nombre})`, fechaEvaluacion, 1, docenteId]
            );
            const evaluacionId = evaluacion.rows[0].id;
            const filasNotasEvaluacion = [];
            for (const alumno of alumnos) {
              const notasPeriodo = trimestresPeriodo
                .map((trimestre) => notaSimplePorClave.get(`${alumno.id}|${asignatura.id}|${trimestre.id}|${campo}`))
                .filter((valor) => valor !== undefined)
                .map(Number);
              if (!notasPeriodo.length) continue;
              const nota = oneDecimal(notasPeriodo.reduce((total, valor) => total + valor, 0) / notasPeriodo.length);
              filasNotasEvaluacion.push([evaluacionId, alumno.id, nota, null]);
            }
            if (filasNotasEvaluacion.length) {
              await insertMany(
                client,
                "notas",
                ["evaluacion_id", "estudiante_id", "valor", "observacion"],
                filasNotasEvaluacion,
                1000
              );
              totalNotasEvaluacion += filasNotasEvaluacion.length;
            }
            totalEvaluaciones += 1;
          }
        }
      }
    }
    console.log(`Evaluaciones: ${totalEvaluaciones} | Notas de evaluación: ${totalNotasEvaluacion}`);

    const diasClase = weekdays("2026-08-17", "2026-11-06");
    const filasAsistencia = [];
    for (const estudiante of estudiantes) {
      for (let diaIndex = 0; diaIndex < diasClase.length; diaIndex += 1) {
        const r = estudiante.rng();
        let estado;
        if (estudiante.perfil === "bajo") {
          estado = r < 0.985 ? "Asistió" : r < 0.995 ? "Tardanza" : "Faltó";
        } else if (estudiante.perfil === "medio") {
          estado = r < 0.78 ? "Asistió" : r < 0.88 ? "Tardanza" : "Faltó";
        } else {
          estado = r < 0.55 ? "Asistió" : r < 0.65 ? "Tardanza" : "Faltó";
        }
        if (estudiante.perfil === "alto" && diaIndex >= diasClase.length - 3) estado = "Faltó";
        const observacion = estado === "Faltó" && estudiante.rng() < 0.25
          ? "Falta justificada por la familia"
          : estado === "Tardanza" && estudiante.rng() < 0.2
            ? "Llegó tarde"
            : null;
        filasAsistencia.push([estudiante.id, diasClase[diaIndex], estado, observacion]);
      }
    }
    await insertMany(
      client,
      "asistencias",
      ["estudiante_id", "fecha", "estado", "observacion"],
      filasAsistencia,
      1000
    );
    console.log(`Asistencias: ${filasAsistencia.length}`);

    const filasComportamiento = [];
    const filasObservaciones = [];
    for (const estudiante of estudiantes) {
      for (let trimestreIndex = 0; trimestreIndex < trimestres.length; trimestreIndex += 1) {
        const trimestre = trimestres[trimestreIndex];
        let nivel;
        let observacion;
        if (estudiante.perfil === "bajo") {
          nivel = trimestreIndex < 2 ? "Bueno" : "Excelente";
          observacion = "Participa con entusiasmo y colabora con sus compañeros.";
        } else if (estudiante.perfil === "medio") {
          nivel = trimestreIndex === 1 || trimestreIndex === 2 ? "Regular" : "Bueno";
          observacion = "Se distrae con facilidad y a veces no trae las tareas.";
        } else {
          nivel = trimestreIndex < 2 ? "Regular" : "Deficiente";
          observacion = estudiante.critical === "autolesion" && trimestreIndex === 2
            ? "El docente reporta que el estudiante ha expresado querer lastimarse; requiere derivación inmediata."
            : "Se aísla en el recreo y muestra poco interés en clase.";
        }
        filasComportamiento.push([
          estudiante.id,
          trimestre.id,
          nivel,
          observacion,
          estudiante.docenteId,
          `2026-${String(4 + trimestreIndex * 2).padStart(2, "0")}-15 10:00:00`,
        ]);
      }

      if (estudiante.perfil === "bajo") {
        filasObservaciones.push([
          estudiante.id,
          trimestres[Math.floor(estudiante.rng() * 2)].id,
          "Participa activamente en clase y se lleva bien con sus compañeros.",
          estudiante.docenteId,
        ]);
      } else if (estudiante.perfil === "medio") {
        const textos = [
          "Se distrae con facilidad; conviene ubicarlo cerca del docente.",
          "A veces no trae las tareas y falta con frecuencia.",
        ];
        filasObservaciones.push([
          estudiante.id,
          trimestres[1 + Math.floor(estudiante.rng() * 2)].id,
          pick(estudiante.rng, textos),
          estudiante.docenteId,
        ]);
      } else {
        const textos = [
          "Se aísla en el recreo y evita participar en actividades grupales.",
          "Presenta higiene descuidada y somnolencia durante la clase.",
        ];
        if (estudiante.critical === "violencia") {
          textos.push("Comenta que en su casa hay discusiones y violencia; se muestra temeroso.");
        }
        if (estudiante.critical === "autolesion") {
          textos.push("El docente reporta que el estudiante ha expresado querer lastimarse; requiere derivación inmediata.");
        }
        filasObservaciones.push([estudiante.id, trimestres[2].id, textos[0], estudiante.docenteId]);
        filasObservaciones.push([estudiante.id, trimestres[3].id, textos[1], estudiante.docenteId]);
        if (textos[2]) filasObservaciones.push([estudiante.id, trimestres[1].id, textos[2], estudiante.docenteId]);
      }
    }

    await insertMany(
      client,
      "comportamientos",
      ["estudiante_id", "trimestre_id", "nivel", "observacion", "registrado_por", "fecha_registro"],
      filasComportamiento
    );
    await insertMany(
      client,
      "observaciones_bimestre",
      ["estudiante_id", "trimestre_id", "texto", "creado_por"],
      filasObservaciones
    );
    console.log(`Comportamientos: ${filasComportamiento.length} | Observaciones: ${filasObservaciones.length}`);

    const formularios = [];
    for (const formulario of FORMULARIOS) {
      const result = await client.query(
        `INSERT INTO formularios_psicologicos
          (titulo, descripcion, nivel, grado, seccion, creado_por, activo, es_validado, codigo_minsa)
         VALUES ($1, $2, 'Primaria', NULL, NULL, $3, TRUE, $4, $5)
         RETURNING id`,
        [formulario.titulo, formulario.descripcion, psicologoUserId, formulario.esValidado, formulario.codigoMinsa]
      );
      const formularioId = result.rows[0].id;
      const preguntas = [];
      for (const pregunta of formulario.preguntas) {
        const opciones = pregunta.tipo === "abierta" ? [] : pregunta.opciones;
        const preguntaResult = await client.query(
          `INSERT INTO formulario_preguntas (formulario_id, tipo, pregunta, opciones, orden, obligatoria)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           RETURNING id`,
          [
            formularioId,
            pregunta.tipo,
            pregunta.pregunta,
            opciones.length ? JSON.stringify(opciones.map((o) => o.texto)) : null,
            pregunta.orden,
          ]
        );
        const preguntaId = preguntaResult.rows[0].id;
        for (let i = 0; i < opciones.length; i += 1) {
          await client.query(
            `INSERT INTO pregunta_opciones (pregunta_id, texto, puntaje_riesgo, orden)
             VALUES ($1, $2, $3, $4)`,
            [preguntaId, opciones[i].texto, opciones[i].puntaje, i + 1]
          );
        }
        preguntas.push({ ...pregunta, id: preguntaId, opciones });
      }
      formularios.push({ ...formulario, id: formularioId, preguntas });
    }
    console.log(`Formularios: ${formularios.length}`);

    const habilitaciones = [];
    for (const formulario of formularios) {
      for (let i = 0; i < TUTORES.length; i += 1) {
        habilitaciones.push([formulario.id, tutores[i].docenteId, seccionIds[i], true]);
      }
    }
    await insertMany(
      client,
      "formulario_habilitaciones",
      ["formulario_id", "docente_id", "seccion_id", "activo"],
      habilitaciones
    );

    const filasRespuestas = [];
    for (let estudianteIndex = 0; estudianteIndex < estudiantes.length; estudianteIndex += 1) {
      const estudiante = estudiantes[estudianteIndex];
      const fechaRespuesta = `2026-09-${String(10 + (estudianteIndex % 18)).padStart(2, "0")} 09:30:00`;
      const respuestasAbiertas = OPEN_ANSWERS[estudiante.critical || estudiante.perfil];

      for (const formulario of formularios) {
        if (formulario.titulo === "Clima Escolar" && estudianteIndex % 5 === 0) continue;
        for (const pregunta of formulario.preguntas) {
          if (pregunta.tipo === "abierta") {
            const respuesta = respuestasAbiertas[(pregunta.orden + estudianteIndex) % respuestasAbiertas.length];
            filasRespuestas.push([formulario.id, pregunta.id, estudiante.id, respuesta, fechaRespuesta]);
            continue;
          }

          const opciones = [...pregunta.opciones].sort((a, b) => Number(a.puntaje) - Number(b.puntaje));
          const totalOpciones = opciones.length;
          if (!totalOpciones) continue;
          let indice;
          if (formulario.esValidado) {
            if (estudiante.critical === "autolesion" && formulario.codigoMinsa === "PHQ-9" && pregunta.orden === PHQ9.length) {
              indice = totalOpciones - 1;
            } else if (estudiante.perfil === "bajo") {
              indice = estudiante.rng() < 0.8 ? 0 : 1;
            } else if (estudiante.perfil === "medio") {
              const r = estudiante.rng();
              indice = r < 0.1 ? 0 : r < 0.5 ? 1 : r < 0.9 ? 2 : 3;
            } else {
              const r = estudiante.rng();
              indice = r < 0.1 ? 1 : r < 0.5 ? 2 : 3;
            }
          } else if (estudiante.critical === "violencia" && formulario.titulo === "Ficha Socioeducativa") {
            if (pregunta.pregunta.includes("convivencia") || pregunta.pregunta.includes("alcohol") || pregunta.pregunta.includes("trabajar")) {
              indice = totalOpciones - 1;
            } else {
              indice = Math.min(totalOpciones - 1, 2);
            }
          } else if (estudiante.perfil === "bajo") {
            indice = estudiante.rng() < 0.8 ? 0 : 1;
          } else if (estudiante.perfil === "medio") {
            const r = estudiante.rng();
            indice = r < 0.2 ? 0 : r < 0.7 ? 1 : 2;
          } else {
            const r = estudiante.rng();
            indice = r < 0.1 ? 1 : r < 0.5 ? 2 : 3;
          }

          if (formulario.titulo === "Ficha Socioeducativa" && pregunta.pregunta.includes("convivencia") && estudiante.critical !== "violencia") {
            indice = Math.min(indice, 2);
          }
          if (estudiante.critical === "autolesion" && formulario.titulo === "Escala de Autoestima") {
            indice = totalOpciones - 1;
          }

          filasRespuestas.push([
            formulario.id,
            pregunta.id,
            estudiante.id,
            opciones[Math.min(indice, totalOpciones - 1)].texto,
            fechaRespuesta,
          ]);
        }
      }
    }
    await insertMany(
      client,
      "formulario_respuestas",
      ["formulario_id", "pregunta_id", "estudiante_id", "respuesta", "created_at"],
      filasRespuestas,
      1000
    );
    console.log(`Respuestas de formularios: ${filasRespuestas.length}`);

    const filasIncidencias = [];
    const filasExpediente = [];
    const estudiantesAltos = estudiantes.filter((e) => e.perfil === "alto");
    const estudiantesMedios = estudiantes.filter((e) => e.perfil === "medio");

    for (let i = 0; i < estudiantesAltos.length; i += 1) {
      const estudiante = estudiantesAltos[i];
      const tipos = ["tardanza_reiterada", "falta_injustificada", "desinteres", "agresion"];
      const tipo = i < 4 && estudiante.critical ? "agresion" : tipos[i % tipos.length];
      const descripcion = tipo === "agresion"
        ? "Participó en una discusión con empujones durante el recreo."
        : tipo === "falta_injustificada"
          ? "Faltó dos días seguidos sin justificación de la familia."
          : tipo === "tardanza_reiterada"
            ? "Llegó tarde en varias oportunidades durante la semana."
            : "Se muestra desinteresado y no entrega las tareas.";
      filasIncidencias.push([
        estudiante.id,
        tipo,
        descripcion,
        "Se conversó con el estudiante y se comunicó a la familia.",
        psicologoUserId,
        "psicologo",
        `2026-${String(9 + (i % 2)).padStart(2, "0")}-${String(10 + (i % 18)).padStart(2, "0")}`,
      ]);

      const formatos = ["ficha_diagnostica", "entrevista_estudiante", "acta_compromiso"];
      for (let f = 0; f < formatos.length; f += 1) {
        filasExpediente.push([
          estudiante.id,
          formatos[f],
          f + 1,
          JSON.stringify({
            fecha: `2026-10-${String(5 + f * 7).padStart(2, "0")}`,
            responsable: "Carlos Pineda Torres",
            detalle: `${formatos[f]} generado para el seguimiento del estudiante.`,
          }),
          psicologoUserId,
          `2026-10-${String(5 + f * 7).padStart(2, "0")}`,
        ]);
      }
    }

    for (let i = 0; i < estudiantesMedios.length; i += 1) {
      const estudiante = estudiantesMedios[i];
      if (i % 3 === 0) {
        filasIncidencias.push([
          estudiante.id,
          "desinteres",
          "No entrega las tareas con regularidad.",
          "El tutor conversó con el estudiante.",
          psicologoUserId,
          "psicologo",
          `2026-10-${String(10 + (i % 15)).padStart(2, "0")}`,
        ]);
      }
      if (i % 4 === 0) {
        filasExpediente.push([
          estudiante.id,
          "ficha_diagnostica",
          1,
          JSON.stringify({
            fecha: "2026-09-20",
            responsable: "Carlos Pineda Torres",
            detalle: "Ficha diagnóstica inicial.",
          }),
          psicologoUserId,
          "2026-09-20",
        ]);
      }
    }

    await insertMany(
      client,
      "incidencias",
      ["estudiante_id", "tipo", "descripcion", "observacion", "creado_por", "rol_creador", "fecha_incidencia"],
      filasIncidencias
    );
    await insertMany(
      client,
      "expediente_formatos",
      ["estudiante_id", "tipo", "correlativo", "datos", "creado_por", "fecha_registro"],
      filasExpediente
    );
    console.log(`Incidencias: ${filasIncidencias.length} | Expedientes: ${filasExpediente.length}`);

    const casos = [];
    for (let i = 0; i < Math.min(7, estudiantesAltos.length); i += 1) {
      const estudiante = estudiantesAltos[i];
      const critico = Boolean(estudiante.critical);
      const result = await client.query(
        `INSERT INTO casos_seguimiento
          (estudiante_id, psicologo_id, estado, nivel_prioridad, fecha_creacion, fecha_actualizacion, estado_caso)
         VALUES ($1, $2, $3, $4, '2026-09-28 09:00:00', '2026-11-04 10:30:00', 'en_psicologia')
         RETURNING id`,
        [
          estudiante.id,
          psicologoId,
          critico ? "abierto" : "en_seguimiento",
          critico ? "critica" : "alta",
        ]
      );
      casos.push({ id: result.rows[0].id, estudiante });

      await client.query(
        `INSERT INTO seguimientos_psicopedagogicos
          (caso_id, estudiante_id, psicologo_id, tipo_intervencion, descripcion, acuerdos, estado_emocional, fecha_intervencion, proxima_fecha)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-10-02 11:00:00', '2026-11-20')`,
        [
          result.rows[0].id,
          estudiante.id,
          psicologoId,
          "Entrevista inicial",
          "Se realizó la entrevista inicial y se identificaron factores de riesgo familiares y escolares.",
          "El estudiante se compromete a asistir con regularidad y el tutor hará seguimiento semanal.",
          "Se muestra reservado, con dificultad para expresar sus emociones.",
        ]
      );
    }
    console.log(`Casos de seguimiento: ${casos.length}`);

    const filasDerivaciones = [];
    for (let i = 0; i < Math.min(5, estudiantesAltos.length); i += 1) {
      const estudiante = estudiantesAltos[i];
      filasDerivaciones.push([
        null,
        estudiante.id,
        directorUserId,
        "director",
        "psicologo",
        "Derivación por riesgo alto detectado en el indicador socioemocional.",
        "Se adjunta el reporte del motor de riesgo.",
        JSON.stringify({ nivel: "Alto", origen: "direccion" }),
        i < 3 ? "pendiente" : "atendida",
      ]);
    }
    await insertMany(
      client,
      "derivaciones",
      ["incidencia_id", "estudiante_id", "origen_id", "origen_rol", "destino", "motivo", "informe", "expediente", "estado"],
      filasDerivaciones
    );

    const filasReportes = [];
    for (let i = 0; i < 6; i += 1) {
      const estudiante = estudiantes[(i * 37) % estudiantes.length];
      filasReportes.push([
        estudiante.id,
        estudiante.seccionId,
        [
          "Un compañero está siendo molestado en el recreo.",
          "Se escuchan comentarios ofensivos hacia una compañera.",
          "Un estudiante llegó con golpes y no quiere hablar.",
          "Hay un grupo que se burla de otro por su forma de hablar.",
          "Se encontró a un estudiante llorando en el baño.",
          "Un compañero no quiere venir al colegio por miedo.",
        ][i],
        i < 4 ? "pendiente" : "revisado",
      ]);
    }
    await insertMany(
      client,
      "reportes_anonimos",
      ["estudiante_id", "seccion_id", "descripcion", "estado"],
      filasReportes
    );
    console.log(`Reportes anónimos: ${filasReportes.length}`);

    const filasMensajes = [];
    for (let i = 0; i < 12; i += 1) {
      const estudiante = estudiantes[(i * 53) % estudiantes.length];
      filasMensajes.push([
        "estudiante",
        estudiante.id,
        null,
        null,
        estudiante.seccionId,
        [
          "Hola, quiero conversar con alguien sobre lo que pasa en mi casa.",
          "Me siento triste y no sé con quién hablar.",
          "Un compañero me está molestando y no me animo a decirlo en clase.",
          "¿Puedo pedir una cita con la psicóloga?",
          "En mi salón hay mucha burla hacia una compañera.",
          "Me cuesta concentrarme y no sé por qué.",
        ][i % 6],
        i >= 7,
      ]);
    }
    for (let i = 0; i < 3; i += 1) {
      const estudiante = estudiantes[(i * 71) % estudiantes.length];
      filasMensajes.push([
        "psicologo",
        estudiante.id,
        null,
        psicologoUserId,
        estudiante.seccionId,
        "Gracias por escribir. Podemos conversar en la hora de tutoría; tu mensaje es confidencial.",
        true,
      ]);
    }
    await insertMany(
      client,
      "mensajes_anonimos",
      ["remitente_tipo", "estudiante_id", "docente_id", "psicologo_id", "seccion_id", "contenido", "leido"],
      filasMensajes
    );

    const temasCharlas = [
      "Buen trato y convivencia escolar",
      "Prevención del acoso escolar",
      "Manejo de emociones y estrés",
      "Uso responsable de redes sociales",
      "Prevención del consumo de alcohol y drogas",
      "Proyecto de vida y autoestima",
    ];
    const filasCharlas = [];
    for (let i = 0; i < temasCharlas.length; i += 1) {
      const seccion = SECCIONES[i % TUTORES.length];
      filasCharlas.push([
        seccionIds[i % TUTORES.length],
        seccion.grado,
        seccion.letra,
        `2026-10-${String(6 + i * 3).padStart(2, "0")}`,
        temasCharlas[i],
        "Prevención y promoción del bienestar socioemocional",
        "Se realizó una charla participativa con dinámicas grupales y espacio de preguntas.",
        21 + (i % 3),
        psicologoId,
        psicologoUserId,
      ]);
    }
    await insertMany(
      client,
      "charlas_aula",
      ["seccion_id", "grado", "seccion", "fecha", "tema", "motivo", "descripcion", "participantes", "psicologo_id", "creado_por"],
      filasCharlas
    );

    await client.query("COMMIT");
    console.log(`Datos base insertados en ${((Date.now() - started) / 1000).toFixed(1)}s`);

    client.release();

    const { calcularIndicadorEstudiante } = require("../services/riesgoEstudianteService");
    console.log("Calculando indicador de riesgo para los estudiantes...");
    for (let i = 0; i < estudiantes.length; i += 1) {
      await calcularIndicadorEstudiante(estudiantes[i].id, { guardar: true });
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${estudiantes.length}`);
    }

    const resumen = await pool.query(
      `SELECT nivel, COUNT(*)::int AS total
       FROM evaluaciones_riesgo_estudiante
       GROUP BY nivel
       ORDER BY nivel`
    );
    const totales = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM estudiantes)::int AS estudiantes,
         (SELECT COUNT(*) FROM docentes)::int AS docentes,
         (SELECT COUNT(*) FROM secciones)::int AS secciones,
         (SELECT COUNT(*) FROM formularios_psicologicos)::int AS formularios,
         (SELECT COUNT(*) FROM formulario_respuestas)::int AS respuestas,
         (SELECT COUNT(*) FROM notas_simples)::int AS notas,
         (SELECT COUNT(*) FROM asistencias)::int AS asistencias,
         (SELECT COUNT(*) FROM perfiles_estudiante)::int AS perfiles,
         (SELECT COUNT(*) FROM alertas_riesgo)::int AS alertas`
    );

    console.log("Resumen:");
    for (const fila of resumen.rows) console.log(`  Riesgo ${fila.nivel}: ${fila.total}`);
    console.log(`  ${JSON.stringify(totales.rows[0])}`);
    console.log(`Tiempo total: ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log("");
    console.log("Accesos de demostración:");
    console.log(`  Director:    director@ofelia.edu.pe / ${DIRECTOR_PASSWORD} (usuario: directora)`);
    console.log(`  Psicólogo:   carlos.pineda@ofelia.edu.pe / ${PSYCHOLOGIST_PASSWORD} (usuario: carlos.pineda)`);
    console.log(`  Tutor:       gilma.torres@ofelia.edu.pe / ${DEMO_PASSWORD}`);
    console.log(`  Estudiante:  est.1ro.a.0@ofelia.edu.pe / ${DEMO_PASSWORD}`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("Error en el seed de demostración:", error.message);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    try {
      client.release();
    } catch (_) {}
    await closePool();
  }
}

main();
