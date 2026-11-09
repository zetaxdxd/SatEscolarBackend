/**
 * seedPart2.js - Continue seeding from step 7 (students onwards)
 * Run after steps 1-6 are done
 */

const bcrypt = require("bcryptjs");
const { pool, closePool } = require("../config/postgres");

const HASH = bcrypt.hashSync("123456", 10);

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
  { nivel: "Primaria", grado: "5to", letra: "B" }
];

const NOMBRES = ["Adrian","Alessandro","Alexander","Alvaro","Anderson","Andre","Andres","Angel","Anthony","Brayan","Carlos","Christian","Daniel","David","Diego","Edison","Edwin","Elder","Elias","Enzo","Fabricio","Facundo","Fernando","Franco","Gabriel","Gianfranco","Gino","Gonzalo","Hugo","Ian","Jair","Jared","Javier","Jefferson","Jhon","Jhoel","Joel","Jorge","Jose","Juan","Kevin","Leonardo","Liam","Lucas","Luis","Manuel","Marco","Matias","Maximiliano","Miguel","Nicolas","Noel","Oliver","Oscar","Patrick","Piero","Rafael","Renato","Ricardo","Rodrigo","Samuel","Santiago","Sebastian","Thiago","Tomas","Valentino","Victor","Vladimir","William","Yamil","Adriana","Aileen","Aitana","Alejandra","Alessia","Amelia","Ana","Andrea","Angela","Antonella","Belen","Briana","Camila","Carla","Carolina","Catalina","Claudia","Constanza","Cristina","Daniela","Danna","Diana","Elena","Emilia","Emma","Evelyn","Fabiana","Fiorella","Flor","Gabriela","Genesis","Giuliana","Grace","Grecia","Hannah","Isabela","Isabel","Jade","Jazmin","Jimena","Karen","Kiara","Lara","Laura","Leyla","Lia","Lorena","Luciana","Luisa","Luz","Macarena","Maira","Maria","Mariana","Mariel","Marisol","Mia","Micaela","Michelle","Milagros","Natalia","Nicole","Noelia","Olivia","Paola","Paulina","Renata","Rocio","Romina","Rosa","Samantha","Sara","Sofia","Sol","Stefany","Susan","Tamara","Valentina","Valeria","Victoria","Ximena","Yamileth","Yara","Yasmin","Yolanda","Zoe"];

const APELLIDOS = ["Acosta","Aguilar","Alvarez","Arias","Arroyo","Avila","Benitez","Bravo","Cabrera","Calderon","Campos","Cardenas","Carranza","Castillo","Castro","Chavez","Cisneros","Cordova","Cornejo","Corrales","Cruz","Cuadros","De la Cruz","Delgado","Diaz","Dominguez","Duarte","Escobar","Espinoza","Estrella","Farias","Fernandez","Flores","Fuentes","Galvez","Garcia","Gomez","Gonzales","Gutierrez","Hernandez","Herrera","Huaman","Huanca","Ibarra","Inca","Jara","Lara","Leon","Lopez","Lozano","Maldonado","Mamani","Marquez","Martinez","Mendoza","Meza","Miranda","Molina","Montes","Morales","Moran","Munoz","Neyra","Nina","Ochoa","Orellana","Ortega","Ortiz","Pacheco","Palacios","Paredes","Perez","Poma","Quispe","Ramirez","Ramos","Rengifo","Reyes","Rios","Rivera","Robles","Rocha","Rodriguez","Rojas","Romero","Ruiz","Salazar","Sanchez","Sandoval","Santana","Santillan","Sarmiento","Serna","Silva","Solis","Soto","Suarez","Sullivan","Tafur","Tapia","Torres","Vargas","Vasquez","Vela","Vera","Vilca","Villanueva","Villegas","Yupanqui","Zamora"];

const OBS_TEXTOS = [
  "Participa activamente en clase", "Se distrae con facilidad", "Mejoro su comportamiento",
  "Necesita apoyo en lectoescritura", "Buen companero, ayuda a otros", "Llega tarde con frecuencia",
  "Se aisla en el recreo", "Muestra interes por la lectura", "Dificultad en matematicas",
  "Comportamiento ejemplar", "Habla mucho en clase", "No trae tareas", "Liderazgo positivo",
  "Necesita gafas", "Se enferma seguido", "Muy ordenado con sus materiales"
];

const SITUACIONES = ["estable", "conflictiva", "ausencia", "sobreproteccion", "violencia"];
const CONVIVENCIAS = ["padres", "madre", "padre", "abuelos", "tutor", "albergue", "solo"];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seedPart2() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("=== Parte 2: Estudiantes en adelante ===");

    // 7. Estudiantes (338)
    console.log("\n7 Creando 338 estudiantes...");
    let estCount = 0;
    for (let si = 0; si < 16; si++) {
      const sec = { grado: SECCIONES[si].grado, letra: SECCIONES[si].letra };
      const secId = (await pool.query('SELECT id FROM secciones WHERE grado=$1 AND letra=$2', [SECCIONES[si].grado, SECCIONES[si].letra])).rows[0].id;
      for (let i = 0; i < 21; i++) {
        const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
        const ap1 = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
        const ap2 = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
        const correo = (nombre.toLowerCase() + '.' + ap1.toLowerCase() + estCount + '@ofelia.edu.pe').replace(/\s+/g, '');
        await pool.query(
          `INSERT INTO usuarios (username, correo, password_hash, rol, activo)
           VALUES ($1, $2, $3, 'estudiante', TRUE)`,
          ['est.' + SECCIONES[si].grado + '.' + SECCIONES[si].letra + '.' + estCount, correo.toLowerCase(), bcrypt.hashSync('123456', 10)]
        );
        await pool.query(
          `INSERT INTO estudiantes (nombres, apellidos, correo, seccion_id, password_hash, activo)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (correo) DO UPDATE SET seccion_id=EXCLUDED.seccion_id`,
          [nombre, ap1 + ' ' + ap2, correo.toLowerCase(), secId, bcrypt.hashSync('123456', 10)]
        );
        estCount++;
      }
    }
    console.log(`   OK ${estCount} estudiantes`);

    // 8. Formularios
    console.log("\n8 Creando formularios...");
    const psiId = (await pool.query(`SELECT id FROM psicologos LIMIT 1`)).rows[0].id;
    const formularios = [
      { titulo: "GAD-7 - Ansiedad", descripcion: "Test de ansiedad generalizada (MINSA)", nivel: "Primaria", seccion: null, es_validado: true, codigo_minsa: "GAD-7", activo: true },
      { titulo: "PHQ-9 - Depresion", descripcion: "Test de depresion (MINSA)", nivel: "Primaria", seccion: null, es_validado: true, codigo_minsa: "PHQ-9", activo: true },
      { titulo: "Ficha Socioeducativa", descripcion: "Ficha diagnostica socioeducativa completa", nivel: "Primaria", seccion: null, es_validado: false, codigo_minsa: null, activo: true },
      { titulo: "Escala de Autoestima", descripcion: "Evaluacion de autoestima escolar", nivel: "Primaria", seccion: null, es_validado: false, codigo_minsa: null, activo: true },
      { titulo: "Clima Escolar", descripcion: "Percepcion del clima escolar", nivel: "Primaria", seccion: null, es_validado: false, codigo_minsa: null, activo: true },
    ];
    const formIds = [];
    for (const f of formularios) {
      const res = await pool.query(
        `INSERT INTO formularios_psicologicos (titulo, descripcion, nivel, seccion, es_validado, codigo_minsa, activo, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [f.titulo, f.descripcion, f.nivel, f.seccion, f.es_validado, f.codigo_minsa, f.activo, (await pool.query('SELECT id FROM psicologos LIMIT 1')).rows[0].id]
      );
      formIds.push(res.rows[0].id);
    }
    console.log(`   OK ${formIds.length} formularios`);

    // 9. Preguntas
    console.log("\n9 Preguntas GAD-7 y PHQ-9...");
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
      const p = await pool.query(
        `INSERT INTO formulario_preguntas (formulario_id, pregunta, tipo, obligatoria, orden) VALUES ($1, $2, 'likert', TRUE, $3) RETURNING id`,
        [formIds[0], gad7[i], i+1]
      );
      const pid = p.rows[0].id;
      for (let j = 0; j < likert.length; j++) {
        await pool.query(`INSERT INTO pregunta_opciones (pregunta_id, texto, puntaje_riesgo, orden) VALUES ($1, $2, $3, $4)`, [pid, likert[j], j * 33, j+1]);
      }
    }
    for (let i = 0; i < phq9.length; i++) {
      const p = await pool.query(
        `INSERT INTO formulario_preguntas (formulario_id, pregunta, tipo, obligatoria, orden) VALUES ($1, $2, 'likert', TRUE, $3) RETURNING id`,
        [formIds[1], phq9[i], i+1]
      );
      const pid = p.rows[0].id;
      for (let j = 0; j < likert.length; j++) {
        await pool.query(`INSERT INTO pregunta_opciones (pregunta_id, texto, puntaje_riesgo, orden) VALUES ($1, $2, $3, $4)`, [pid, likert[j], j * 33, j+1]);
      }
    }
    console.log("   OK Preguntas");

    // 10. Habilitar
    console.log("\n10 Habilitando formularios...");
    for (const formId of formIds) {
      for (const sec of SECCIONES) {
        const secId = (await pool.query('SELECT id FROM secciones WHERE grado=$1 AND letra=$2', [sec.grado, sec.letra])).rows[0].id;
        const docenteId = (await pool.query('SELECT docente_id FROM docente_secciones WHERE seccion_id=$1 LIMIT 1', [secId])).rows[0]?.docente_id || 1;
        await pool.query(`INSERT INTO formulario_habilitaciones (formulario_id, docente_id, seccion_id, activo) VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING`, [formId, docenteId, secId]);
      }
    }
    console.log("   OK Habilitados");

    // 11. Respuestas
    console.log("\n11 Respuestas...");
    const allPreguntas = await pool.query(`SELECT id, formulario_id FROM formulario_preguntas`);
    let respCount = 0;
    const estudiantes = await pool.query(`SELECT e.id, e.correo FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = 'estudiante'`);
    for (const est of estudiantes.rows) {
      for (const formId of formIds) {
        const pregForm = allPreguntas.rows.filter(p => p.formulario_id == formId);
        for (const p of pregForm) {
          const opts = await pool.query(`SELECT texto FROM pregunta_opciones WHERE pregunta_id=$1`, [p.id]);
          if (opts.rows.length === 0) continue;
          const opt = opts.rows[Math.floor(Math.random() * opts.rows.length)];
          await pool.query(
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
    console.log("\n12 Notas...");
    const asignaturasAll = await pool.query(`SELECT id FROM asignaturas`);
    const bimestres = await pool.query(`SELECT id FROM periodos_academicos ORDER BY id`);
    let notasCount = 0;
    const estudiantesNotas = await pool.query(`SELECT e.id, e.seccion_id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = 'estudiante'`);
    for (const est of estudiantesNotas.rows) {
      for (const asig of (await pool.query('SELECT id FROM asignaturas')).rows) {
        for (const bim of (await pool.query('SELECT id FROM periodos_academicos ORDER BY id')).rows) {
          if (Math.random() > 0.1) {
            const rand = Math.random();
            let nivel = "B";
            if (rand < 0.15) nivel = "AD";
            else if (rand < 0.5) nivel = "A";
            else if (rand < 0.85) nivel = "B";
            else nivel = "C";
            const evalResult = await pool.query(
              `INSERT INTO evaluaciones_academicas (seccion_id, periodo_id, asignatura_id, nombre, creado_por)
               VALUES ($1, $2, $3, $4, 1) RETURNING id`,
              [est.seccion_id, bim.id, asig.id, `Evaluacion ${bim.id} ${asig.id}`]
            );
            const evalId = evalResult.rows[0].id;
            const valorMap = { AD: 19, A: 16, B: 13, C: 9 };
            await pool.query(
              `INSERT INTO notas (evaluacion_id, estudiante_id, valor)
               VALUES ($1, $2, $3)
               ON CONFLICT (evaluacion_id, estudiante_id) DO UPDATE SET valor=EXCLUDED.valor`,
              [evalId, est.id, { AD: 19, A: 16, B: 13, C: 9 }[nivel]]
            );
            notasCount++;
          }
        }
      }
    }
    console.log(`   OK ${notasCount} notas`);

    // 13. Asistencias
    console.log("\n13 Asistencias...");
    let asisCount = 0;
    for (const est of (await pool.query(`SELECT e.id, e.seccion_id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = 'estudiante'`)).rows) {
      for (let d = 0; d < 60; d++) {
        const fecha = new Date("2026-03-15").getTime() + d * 24*60*60*1000;
        const fechaObj = new Date(fecha);
        if (fechaObj > new Date("2026-11-30")) break;
        if (fechaObj.getDay() === 0 || fechaObj.getDay() === 6) continue;
        const r = Math.random();
        let estado = "Asistio";
        if (r > 0.9) estado = "Falto";
        else if (r > 0.85) estado = "Tardanza";
        await pool.query(
          `INSERT INTO asistencias (estudiante_id, seccion_id, fecha, estado, registrado_por)
           VALUES ($1, $2, $3, $4, 1)
           ON CONFLICT (estudiante_id, fecha) DO UPDATE SET estado=EXCLUDED.estado`,
          [est.id, est.seccion_id, new Date(new Date("2026-03-15").getTime() + Math.floor(Math.random()*200)*24*60*60*1000).toISOString().split('T')[0], estado]
        );
        asisCount++;
      }
    }
    console.log(`   OK ${asisCount} asistencias`);

    // 14. Fichas
    console.log("\n14 Fichas...");
    const situaciones = ["estable", "conflictiva", "ausencia", "sobreproteccion", "violencia"];
    const convivencias = ["padres", "madre", "padre", "abuelos", "tutor", "albergue", "solo"];
    let fichaCount = 0;
    for (const est of (await pool.query('SELECT e.id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = \'estudiante\'')).rows) {
      const datos = {
        nombres: "Estudiante", apellidos: "Apellido", fecha_nacimiento: "2015-01-01",
        sexo: "M", dni: String(Math.floor(Math.random() * 90000000) + 10000000),
        direccion: "Av. Los Andes 123", telefono: "9" + String(Math.floor(Math.random() * 90000000) + 10000000),
        con_quien_vive: randomItem(["padres", "madre", "padre", "abuelos", "tutor", "albergue", "solo"]),
        situacion_convivencia: randomItem(["estable", "conflictiva", "ausencia", "sobreproteccion", "violencia"]),
        apoderado_nombres: "Apoderado", apoderado_apellidos: "Apellido",
        apoderado_telefono: "9" + String(Math.floor(Math.random() * 90000000) + 10000000),
        apoderado_parentesco: "Madre", antecedentes: "Ninguno", observaciones: "Ficha completada"
      };
      await pool.query(
        `INSERT INTO fichas_diagnosticas_socioeducativas (estudiante_id, datos, completada, completada_en, version)
         VALUES ($1, $2, TRUE, NOW() - INTERVAL '${Math.floor(Math.random()*60)} days', 1)
         ON CONFLICT (estudiante_id) DO UPDATE SET datos=EXCLUDED.datos, completada=TRUE`,
        [est.id, JSON.stringify(datos)]
      );
      fichaCount++;
    }
    console.log(`   OK ${fichaCount} fichas`);

    // 15. Observaciones
    console.log("\n15 Observaciones...");
    const obsTextos = ["Participa activamente en clase", "Se distrae con facilidad", "Mejoro su comportamiento", "Necesita apoyo en lectoescritura", "Buen companero, ayuda a otros", "Llega tarde con frecuencia", "Se aisla en el recreo", "Muestra interes por la lectura", "Dificultad en matematicas", "Comportamiento ejemplar", "Habla mucho en clase", "No trae tareas", "Liderazgo positivo", "Necesita gafas", "Se enferma seguido", "Muy ordenado con sus materiales"];
    let obsCount = 0;
    for (const est of (await pool.query(`SELECT e.id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = 'estudiante'`)).rows) {
      if (Math.random() < 0.35) {
        const bim = (await pool.query('SELECT id FROM periodos_academicos')).rows[Math.floor(Math.random() * 4)];
        await pool.query(
          `INSERT INTO observaciones_bimestre (estudiante_id, bimestre_id, observacion, creado_por)
           VALUES ($1, $2, $3, 1)`,
          [est.id, bim.id, randomItem(["Participa activamente en clase", "Se distrae con facilidad", "Mejoro su comportamiento", "Necesita apoyo en lectoescritura", "Buen companero, ayuda a otros", "Llega tarde con frecuencia", "Se aisla en el recreo", "Muestra interes por la lectura", "Dificultad en matematicas", "Comportamiento ejemplar", "Habla mucho en clase", "No trae tareas", "Liderazgo positivo", "Necesita gafas", "Se enferma seguido", "Muy ordenado con sus materiales"])]
        );
        obsCount++;
      }
    }
    console.log(`   OK ${obsCount} observaciones`);

    // 16. Config riesgo
    console.log("\n16 Config riesgo...");
    await pool.query(`
      INSERT INTO configuraciones_riesgo (peso_academico, peso_asistencia, peso_cuestionario, peso_comportamiento, umbral_alto, umbral_medio, umbral_bajo)
      VALUES (40, 35, 15, 10, 60, 80, 100)
      ON CONFLICT DO NOTHING
    `);
    console.log("   OK Pesos: 40/35/15/10");

    await pool.query("COMMIT");
    console.log("\nSUCCESS SEED PARTE 2 COMPLETADO");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error:", error.message);
    console.error(error.stack);
  } finally {
    await closePool();
  }
}

seedPart2().catch(e => console.error("Fatal:", e.message));