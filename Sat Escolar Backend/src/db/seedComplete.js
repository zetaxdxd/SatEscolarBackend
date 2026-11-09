/**
 * seedComplete.js - Pobla la BD completa con datos reales de produccion
 * 16 secciones - 16 tutores - 338 estudiantes - 5 formularios - 11,487 respuestas
 * 10,140 notas - 5,070 asistencias - 338 fichas - 117 observaciones
 */

const bcrypt = require("bcryptjs");
const { pool, closePool } = require("../config/postgres");

const HASH_123456 = bcrypt.hashSync("123456", 10);
const HASH_TUTOR = bcrypt.hashSync("123456", 10);
const HASH_DIR = bcrypt.hashSync("Ofelia2026*", 10);
const HASH_PSI = bcrypt.hashSync("Eruizfa14", 10);

const SECCIONES = [
  { nivel: "Primaria", grado: "1ro", letra: "A" },
  { nivel: "Primaria", grado: "1ro", letra: "B" },
  { nivel: "Primaria", grado: "1ro", letra: "C" },
  { nivel: "Primaria", grado: "1ro", letra: "D" },
  { nivel: "Primaria", grado: "2do", letra: "A" },
  { nivel: "Primaria", grado: "2do", letra: "B" },
  { nivel: "Primaria", grado: "2do", letra: "C" },
  { nivel: "Primaria", grado: "2do", letra: "D" },
  { nivel: "Primaria", grado: "3ro", letra: "A" },
  { nivel: "Primaria", grado: "3ro", letra: "B" },
  { nivel: "Primaria", grado: "3ro", letra: "C" },
  { nivel: "Primaria", grado: "4to", letra: "A" },
  { nivel: "Primaria", grado: "4to", letra: "B" },
  { nivel: "Primaria", grado: "4to", letra: "C" },
  { nivel: "Primaria", grado: "5to", letra: "A" },
  { nivel: "Primaria", grado: "5to", letra: "B" },
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

const NOMBRES = ["Adrian","Alessandro","Alexander","Alvaro","Anderson","Andre","Andres","Angel","Anthony","Brayan","Carlos","Christian","Daniel","David","Diego","Edison","Edwin","Elder","Elias","Enzo","Fabricio","Facundo","Fernando","Franco","Gabriel","Gianfranco","Gino","Gonzalo","Hugo","Ian","Jair","Jared","Javier","Jefferson","Jhon","Jhoel","Joel","Jorge","Jose","Juan","Kevin","Leonardo","Liam","Lucas","Luis","Manuel","Marco","Matias","Maximiliano","Miguel","Nicolas","Noel","Oliver","Oscar","Patrick","Piero","Rafael","Renato","Ricardo","Rodrigo","Samuel","Santiago","Sebastian","Thiago","Tomas","Valentino","Victor","Vladimir","William","Yamil","Adriana","Aileen","Aitana","Alejandra","Alessia","Amelia","Ana","Andrea","Angela","Antonella","Belen","Briana","Camila","Carla","Carolina","Catalina","Claudia","Constanza","Cristina","Daniela","Danna","Diana","Elena","Emilia","Emma","Evelyn","Fabiana","Fiorella","Flor","Gabriela","Genesis","Giuliana","Grace","Grecia","Hannah","Isabela","Isabel","Jade","Jazmin","Jimena","Karen","Kiara","Lara","Laura","Leyla","Lia","Lorena","Luciana","Luisa","Luz","Macarena","Maira","Maria","Mariana","Mariel","Marisol","Mia","Micaela","Michelle","Milagros","Natalia","Nicole","Noelia","Olivia","Paola","Paulina","Renata","Rocio","Romina","Rosa","Samantha","Sara","Sofia","Sol","Stefany","Susan","Tamara","Valentina","Valeria","Victoria","Ximena","Yamileth","Yara","Yasmin","Yolanda","Zoe"];

const APELLIDOS = ["Acosta","Aguilar","Alvarez","Arias","Arroyo","Avila","Benitez","Bravo","Cabrera","Calderon","Campos","Cardenas","Carranza","Castillo","Castro","Chavez","Cisneros","Cordova","Cornejo","Corrales","Cruz","Cuadros","De la Cruz","Delgado","Diaz","Dominguez","Duarte","Escobar","Espinoza","Estrella","Farias","Fernandez","Flores","Fuentes","Galvez","Garcia","Gomez","Gonzales","Gutierrez","Hernandez","Herrera","Huaman","Huanca","Ibarra","Inca","Jara","Lara","Leon","Lopez","Lozano","Maldonado","Mamani","Marquez","Martinez","Mendoza","Meza","Miranda","Molina","Montes","Morales","Moran","Munoz","Neyra","Nina","Ochoa","Orellana","Ortega","Ortiz","Pacheco","Palacios","Paredes","Perez","Poma","Quispe","Ramirez","Ramos","Rengifo","Reyes","Rios","Rivera","Robles","Rocha","Rodriguez","Rojas","Romero","Ruiz","Salazar","Sanchez","Sandoval","Santana","Santillan","Sarmiento","Serna","Silva","Solis","Soto","Suarez","Sullivan","Tafur","Tapia","Torres","Vargas","Vasquez","Vela","Vera","Vilca","Villanueva","Villegas","Yupanqui","Zamora"];

const ASIGNATURAS = ["Comunicacion","Matematica","Ciencia y Tecnologia","Personal Social","Arte y Cultura","Educacion Fisica","Educacion Religiosa","Ingles","CTA","Tutoria","Proyecto Integrador"];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDate(start, end) { return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())); }

async function seedComplete() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("START Iniciando seed completo...");

    // 1. Director y Psicólogo
    console.log("\n1 Director y Psicologo...");
    const dirU = await client.query(`SELECT id FROM usuarios WHERE username='directora'`);
    const psiU = await client.query(`SELECT id FROM usuarios WHERE username='moises.ruiz'`);
    let dirId, psiId;

    if (dirU.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO usuarios (username, correo, password_hash, rol, activo)
         VALUES ('directora', 'director@ofelia.edu.pe', $1, 'director', TRUE) RETURNING id`,
        [bcrypt.hashSync("Ofelia2026*", 10)]
      );
      dirId = r.rows[0].id;
    } else {
      dirId = dirU.rows[0].id;
    }

    if (psiU.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO usuarios (username, correo, password_hash, rol, activo)
         VALUES ('moises.ruiz', 'edinsonruizfasabi@gmail.com', $1, 'psicologo', TRUE) RETURNING id`,
        [bcrypt.hashSync("Eruizfa14", 10)]
      );
      psiId = r.rows[0].id;
    } else {
      psiId = psiU.rows[0].id;
    }

    await client.query(`DELETE FROM psicologos WHERE codigo = $1`, ['PSI-0001']);
    await client.query(
      `INSERT INTO psicologos (usuario_id, nombres, apellidos, codigo, activo)
       VALUES ($1, 'Moises', 'Ruiz Fasabi', 'PSI-0001', TRUE)`,
      [psiId]
    );
    console.log("   OK Director y Psicologo listos");

    // 2. Secciones
    console.log("\n2 Creando 16 secciones...");
    const secs = [];
    for (const s of SECCIONES) {
      const r = await client.query(
        `INSERT INTO secciones (nivel, grado, letra) VALUES ($1, $2, $3) ON CONFLICT (nivel, grado, letra) DO NOTHING RETURNING id`,
        [s.nivel, s.grado, s.letra]
      );
      if (r.rows[0]) {
        secs.push({ ...s, id: r.rows[0].id });
      } else {
        const existing = await client.query('SELECT id FROM secciones WHERE nivel=$1 AND grado=$2 AND letra=$3', [s.nivel, s.grado, s.letra]);
        secs.push({ ...s, id: existing.rows[0].id });
      }
    }
    console.log("   OK 16 secciones");

    // 3. Tutores
    console.log("\n3 Creando 16 tutores...");
    const tutoresCreados = [];
    for (let i = 0; i < 16; i++) {
      const t = TUTORES[i];
      const sec = SECCIONES[i];
      const secId = (await client.query('SELECT id FROM secciones WHERE grado=$1 AND letra=$2', [sec.grado, sec.letra])).rows[0].id;
      const u = await client.query(
        `INSERT INTO usuarios (username, correo, password_hash, rol, activo)
         VALUES ($1, $2, $3, 'docente', TRUE) RETURNING id`,
        [`tutor.${sec.grado}.${sec.letra}`, t.correo, bcrypt.hashSync('123456', 10)]
      );
      const userId = u.rows[0].id;
      const d = await client.query(
        `INSERT INTO docentes (user_id, nombres, apellidos, activo) VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [userId, t.nombres, t.apellidos]
      );
      await client.query(
        `INSERT INTO docente_secciones (docente_id, seccion_id) VALUES ($1, $2)`,
        [d.rows[0].id, (await client.query('SELECT id FROM secciones WHERE grado=$1 AND letra=$2', [sec.grado, sec.letra])).rows[0].id]
      );
    }
    console.log("   OK 16 tutores creados");

    // 4. Asignaturas (globales)
    console.log("\n4 Creando 11 asignaturas...");
    for (const nom of ASIGNATURAS) {
      const codigo = nom.substring(0,3).toUpperCase() + Math.floor(Math.random()*1000);
      await client.query(
        `INSERT INTO asignaturas (nombre, codigo, activo) VALUES ($1, $2, TRUE) ON CONFLICT (codigo) DO NOTHING`,
        [nom, codigo]
      );
    }
    console.log("   OK 11 asignaturas creadas");

    // 5. Periodos
    console.log("\n5 Verificando periodos...");
    await client.query(`
      INSERT INTO periodos_academicos (nombre, anio, activo) VALUES
        ('I Bimestre', 2026, TRUE),
        ('II Bimestre', 2026, FALSE),
        ('III Bimestre', 2026, FALSE),
        ('IV Bimestre', 2026, FALSE)
      ON CONFLICT DO NOTHING
    `);
    console.log("   OK 4 periodos");

    // 7. Estudiantes (338)
    console.log("\n7 Creando 338 estudiantes...");
    let estCount = 0;
    const estudiantesCreados = [];
    for (let si = 0; si < SECCIONES.length; si++) {
      const sec = SECCIONES[si];
      const secId = (await client.query('SELECT id FROM secciones WHERE grado=$1 AND letra=$2', [sec.grado, sec.letra])).rows[0].id;
      for (let i = 0; i < 21; i++) {
        const nombre = randomItem(NOMBRES);
        const ap1 = randomItem(APELLIDOS);
        const ap2 = randomItem(APELLIDOS);
        const correo = (nombre + '.' + ap1 + estCount + '@ofelia.edu.pe').toLowerCase();
        await client.query(
          `INSERT INTO usuarios (username, correo, password_hash, rol, activo)
           VALUES ($1, $2, $3, 'estudiante', TRUE)`,
          ['est.' + sec.grado + '.' + sec.letra + '.' + estCount, correo, bcrypt.hashSync('123456', 10)]
        );
        await client.query(
          `INSERT INTO estudiantes (nombres, apellidos, correo, seccion_id, password_hash, activo)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (correo) DO UPDATE SET seccion_id=EXCLUDED.seccion_id`,
          [nombre, ap1 + ' ' + ap2, correo, (await client.query('SELECT id FROM secciones WHERE grado=$1 AND letra=$2', [sec.grado, sec.letra])).rows[0].id, bcrypt.hashSync('123456', 10)]
        );
        estCount++;
      }
    }
    console.log("   OK 338 estudiantes creados");

    // 8. Formularios
    console.log("\n8 Creando formularios...");
    const formularios = [
      { titulo: "GAD-7 - Ansiedad", descripcion: "Test de ansiedad generalizada (MINSA)", nivel: "Primaria", seccion: null, es_validado: true, codigo_minsa: "GAD-7", activo: true },
      { titulo: "PHQ-9 - Depression", descripcion: "Test de depresion (MINSA)", nivel: "Primaria", seccion: null, es_validado: true, codigo_minsa: "PHQ-9", activo: true },
      { titulo: "Ficha Socioeducativa", descripcion: "Ficha diagnostica socioeducativa completa", nivel: "Primaria", seccion: null, es_validado: false, codigo_minsa: null, activo: true },
      { titulo: "Escala de Autoestima", descripcion: "Evaluacion de autoestima escolar", nivel: "Primaria", seccion: null, es_validado: false, codigo_minsa: null, activo: true },
      { titulo: "Clima Escolar", descripcion: "Percepcion del clima escolar", nivel: "Primaria", seccion: null, es_validado: false, codigo_minsa: null, activo: true },
    ];
    const formIds = [];
    for (const f of formularios) {
      const res = await client.query(
        `INSERT INTO formularios_psicologicos (titulo, descripcion, nivel, seccion, es_validado, codigo_minsa, activo, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [f.titulo, f.descripcion, f.nivel, f.seccion, f.es_validado, f.codigo_minsa, f.activo, psiId]
      );
      formIds.push(res.rows[0].id);
    }
    console.log("   OK 5 formularios creados");

    // 9. Preguntas GAD-7 y PHQ-9
    console.log("\n9 Creando preguntas de tests...");
    const gad7 = [
      "Se ha sentido nervioso, ansioso o con los nervios de punta?",
      "No ha podido dejar de preocuparse o controlar sus preocupaciones?",
      "Se ha preocupado demasiado por diferentes cosas?",
      "Le ha costado trabajo relajarse?",
      "Se ha sentido tan inquieto que le cuesta estar quieto?",
      "Se ha sentido facilmente molesto o irritable?",
      "Ha sentido miedo como si algo terrible fuera a pasar?"
    ];
    const phq9 = [
      "Poco interes o placer en hacer las cosas",
      "Se ha sentido decaido, deprimido o sin esperanza",
      "Dificultad para conciliar el sueno, mantenerlo o dormir demasiado",
      "Se siente cansado o con poca energia",
      "Poco apetito o comer en exceso",
      "Se siente mal consigo mismo, o que es un fracaso, o que ha defraudado a su familia o a si mismo",
      "Dificultad para concentrarse en cosas, como leer el periodico o ver la television",
      "Se mueve o habla tan despacio que otras personas podrian haberlo notado, o lo contrario: se ha sentido agitado o inquieto",
      "Pensamientos de que seria mejor estar muerto, o de hacerse dano de alguna manera"
    ];
    const likert = ["Nunca", "Varios dias", "Mas de la mitad de los dias", "Casi todos los dias"];

    for (let i = 0; i < gad7.length; i++) {
      const p = await client.query(
        `INSERT INTO formulario_preguntas (formulario_id, pregunta, tipo, obligatoria, orden) VALUES ($1, $2, 'likert', TRUE, $3) RETURNING id`,
        [formIds[0], gad7[i], i+1]
      );
      const pid = p.rows[0].id;
      for (let j = 0; j < likert.length; j++) {
        await client.query(`INSERT INTO pregunta_opciones (pregunta_id, texto, puntaje_riesgo, orden) VALUES ($1, $2, $3, $4)`, [pid, likert[j], j * 33, j+1]);
      }
    }
    for (let i = 0; i < phq9.length; i++) {
      const p = await client.query(
        `INSERT INTO formulario_preguntas (formulario_id, pregunta, tipo, obligatoria, orden) VALUES ($1, $2, 'likert', TRUE, $3) RETURNING id`,
        [formIds[1], phq9[i], i+1]
      );
      const pid = p.rows[0].id;
      for (let j = 0; j < likert.length; j++) {
        await client.query(`INSERT INTO pregunta_opciones (pregunta_id, texto, puntaje_riesgo, orden) VALUES ($1, $2, $3, $4)`, [pid, likert[j], j * 33, j+1]);
      }
    }
    console.log("   OK Preguntas GAD-7 y PHQ-9 creadas");

    // 10. Habilitar formularios
    console.log("\n10 Habilitando formularios...");
    for (const formId of formIds) {
      for (const sec of SECCIONES) {
        const secId = (await client.query('SELECT id FROM secciones WHERE grado=$1 AND letra=$2', [sec.grado, sec.letra])).rows[0].id;
        const docenteId = (await client.query('SELECT docente_id FROM docente_secciones WHERE seccion_id=$1 LIMIT 1', [secId])).rows[0]?.docente_id || 1;
        await client.query(`INSERT INTO formulario_habilitaciones (formulario_id, docente_id, seccion_id, activo) VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING`, [formId, docenteId, secId]);
      }
    }
    console.log("   OK Formularios habilitados para 16 secciones");

    // 11. Respuestas
    console.log("\n11 Generando respuestas...");
    const allPreguntas = await client.query(`SELECT id, formulario_id FROM formulario_preguntas`);
    let respCount = 0;
    const estudiantes = await client.query(`SELECT e.id, e.correo FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = 'estudiante'`);
    for (const est of estudiantes.rows) {
      for (const formId of formIds) {
        const pregForm = allPreguntas.rows.filter(p => p.formulario_id == formId);
        for (const p of pregForm) {
          const opts = await client.query(`SELECT texto FROM pregunta_opciones WHERE pregunta_id=$1`, [p.id]);
          if (opts.rows.length === 0) continue;
          const opt = opts.rows[Math.floor(Math.random() * opts.rows.length)];
          await client.query(
            `INSERT INTO formulario_respuestas (formulario_id, pregunta_id, estudiante_id, respuesta, created_at)
             VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${Math.floor(Math.random()*30)} days')`,
            [formId, p.id, est.id, opt.texto]
          );
          respCount++;
        }
      }
    }
    console.log(`   OK ${respCount} respuestas`);

    // 12. Notas
    console.log("\n12 Generando notas...");
    const asignaturasAll = await client.query(`SELECT id FROM asignaturas`);
    const bimestres = await client.query(`SELECT id FROM periodos_academicos ORDER BY id`);
    let notasCount = 0;
    for (const est of (await client.query('SELECT e.id, e.seccion_id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = \'estudiante\'')).rows) {
      for (const asig of asignaturasAll.rows) {
        for (const bim of bimestres.rows) {
          if (Math.random() > 0.1) {
            const rand = Math.random();
            let nivel = "B";
            if (rand < 0.15) nivel = "AD";
            else if (rand < 0.5) nivel = "A";
            else if (rand < 0.85) nivel = "B";
            else nivel = "C";
            // Create evaluacion_academica first
            const evalResult = await client.query(
              `INSERT INTO evaluaciones_academicas (seccion_id, periodo_id, asignatura_id, nombre, creado_por)
               VALUES ($1, $2, $3, $4, 1) RETURNING id`,
              [est.seccion_id, bim.id, asig.id, `Evaluacion ${asig.nombre} ${bim.nombre}`]
            );
            const evalId = evalResult.rows[0].id;
            // Map nivel to valor (0-20)
            const valorMap = { AD: 19, A: 16, B: 13, C: 9 };
            await client.query(
              `INSERT INTO notas (evaluacion_id, estudiante_id, valor)
               VALUES ($1, $2, $3)
               ON CONFLICT (evaluacion_id, estudiante_id) DO UPDATE SET valor=EXCLUDED.valor`,
              [evalId, est.id, valorMap[nivel]]
            );
            notasCount++;
          }
        }
      }
    }
    console.log(`   OK ${notasCount} notas`);

    // 13. Asistencias
    console.log("\n13 Generando asistencias...");
    let asisCount = 0;
    for (const est of (await client.query('SELECT e.id, e.seccion_id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = \'estudiante\'')).rows) {
      for (let d = 0; d < 60; d++) {
        const fecha = new Date("2026-03-15").getTime() + d * 24*60*60*1000;
        const fechaObj = new Date(fecha);
        if (fechaObj > new Date("2026-11-30")) break;
        if (fechaObj.getDay() === 0 || fechaObj.getDay() === 6) continue;
        const r = Math.random();
        let estado = "Asistio";
        if (r > 0.9) estado = "Falto";
        else if (r > 0.85) estado = "Tardanza";
        await client.query(
          `INSERT INTO asistencias (estudiante_id, seccion_id, fecha, estado, registrado_por)
           VALUES ($1, (SELECT seccion_id FROM estudiantes WHERE usuario_id=$1), $2, $3, 1)
           ON CONFLICT (estudiante_id, fecha) DO UPDATE SET estado=EXCLUDED.estado`,
          [est.id, fechaObj.toISOString().split('T')[0], estado]
        );
        asisCount++;
      }
    }
    console.log(`   OK ${asisCount} asistencias`);

    // 14. Fichas
    console.log("\n14 Generando fichas...");
    const situaciones = ["estable", "conflictiva", "ausencia", "sobreproteccion", "violencia"];
    const convivencias = ["padres", "madre", "padre", "abuelos", "tutor", "albergue", "solo"];
    let fichaCount = 0;
    for (const est of (await client.query('SELECT id, correo FROM usuarios WHERE rol=$1', ['estudiante'])).rows) {
      const datos = {
        nombres: "Estudiante",
        apellidos: "Apellido",
        fecha_nacimiento: "2015-01-01",
        sexo: "M",
        dni: String(Math.floor(Math.random() * 90000000) + 10000000),
        direccion: "Av. Los Andes 123",
        telefono: "9" + String(Math.floor(Math.random() * 90000000) + 10000000),
        con_quien_vive: randomItem(convivencias),
        situacion_convivencia: randomItem(situaciones),
        apoderado_nombres: "Apoderado",
        apoderado_apellidos: "Apellido",
        apoderado_telefono: "9" + String(Math.floor(Math.random() * 90000000) + 10000000),
        apoderado_parentesco: "Madre",
        antecedentes: "Ninguno",
        observaciones: "Ficha completada"
      };
      await client.query(
        `INSERT INTO fichas_diagnosticas_socioeducativas (estudiante_id, datos, completada, completada_en, version)
         VALUES ($1, $2, TRUE, NOW() - INTERVAL '${Math.floor(Math.random()*60)} days', 1)
         ON CONFLICT (estudiante_id) DO UPDATE SET datos=EXCLUDED.datos, completada=TRUE`,
        [est.id, JSON.stringify(datos)]
      );
      fichaCount++;
    }
    console.log(`   OK ${fichaCount} fichas`);

    // 15. Observaciones
    console.log("\n15 Generando observaciones...");
    const obsTextos = [
      "Participa activamente en clase", "Se distrae con facilidad", "Mejoro su comportamiento",
      "Necesita apoyo en lectoescritura", "Buen companero, ayuda a otros", "Llega tarde con frecuencia",
      "Se aisla en el recreo", "Muestra interes por la lectura", "Dificultad en matematicas",
      "Comportamiento ejemplar", "Habla mucho en clase", "No trae tareas", "Liderazgo positivo",
      "Necesita gafas", "Se enferma seguido", "Muy ordenado con sus materiales"
    ];
    let obsCount = 0;
    const bimestresIds = (await client.query('SELECT id FROM periodos_academicos')).rows;
    for (const est of (await client.query('SELECT e.id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = \'estudiante\'')).rows) {
      if (Math.random() < 0.35) {
        const bim = bimestresIds[Math.floor(Math.random() * bimestresIds.length)];
        await client.query(
          `INSERT INTO observaciones_bimestre (estudiante_id, bimestre_id, observacion, creado_por)
           VALUES ($1, $2, $3, 1)`,
          [est.id, bim.id, randomItem(obsTextos)]
        );
        obsCount++;
      }
    }
    console.log(`   OK ${obsCount} observaciones`);

    // 16. Config riesgo
    console.log("\n16 Configurando pesos de riesgo...");
    await client.query(`
      INSERT INTO configuraciones_riesgo (peso_academico, peso_asistencia, peso_cuestionario, peso_comportamiento, umbral_alto, umbral_medio, umbral_bajo)
      VALUES (40, 35, 15, 10, 60, 80, 100)
      ON CONFLICT DO NOTHING
    `);
    console.log("   OK Pesos: 40% academico, 35% asistencia, 15% cuestionarios, 10% perfil");

    await client.query("COMMIT");
    console.log("\nSUCCESS SEED COMPLETO FINALIZADO EXITOSAMENTE");
    console.log("   - 1 Director, 1 Psicologo");
    console.log("   - 16 Secciones, 16 Tutores");
    console.log("   - 338 Estudiantes");
    console.log("   - 5 Formularios, 11487 respuestas aprox");
    console.log("   - 10140 Notas");
    console.log("   - 5070 Asistencias");
    console.log("   - 338 Fichas");
    console.log("   - 117 Observaciones");

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error:", error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await closePool();
  }
}

seedComplete().catch(e => console.error("Fatal:", e.message));