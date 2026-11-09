/**
 * seedPart3.js - Notas, Asistencias, Fichas, Observaciones, Config
 */

const bcrypt = require("bcryptjs");
const { pool, closePool } = require("../config/postgres");

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function seedPart3() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("=== Parte 3: Notas, Asistencias, Fichas, Observaciones ===");

    // 12. Notas
    console.log("\n12 Generando notas...");
    const asignaturasAll = await pool.query(`SELECT id FROM asignaturas`);
    const bimestres = await pool.query(`SELECT id FROM periodos_academicos ORDER BY id`);
    let notasCount = 0;
    const estudiantesNotas = await pool.query(`SELECT e.id, e.seccion_id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = 'estudiante'`);
    const valorMap = { AD: 19, A: 16, B: 13, C: 9 };
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
          [est.id, est.seccion_id, new Date("2026-03-15").toISOString().split('T')[0], estado]
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
        con_quien_vive: ["padres", "madre", "padre", "abuelos", "tutor", "albergue", "solo"][Math.floor(Math.random() * 7)],
        situacion_convivencia: ["estable", "conflictiva", "ausencia", "sobreproteccion", "violencia"][Math.floor(Math.random() * 5)],
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
    for (const est of (await pool.query('SELECT e.id FROM estudiantes e JOIN usuarios u ON u.correo = e.correo WHERE u.rol = \'estudiante\'')).rows) {
      if (Math.random() < 0.35) {
        const bim = (await pool.query('SELECT id FROM periodos_academicos')).rows[Math.floor(Math.random() * 4)];
        await pool.query(
          `INSERT INTO observaciones_bimestre (estudiante_id, bimestre_id, observacion, creado_por)
           VALUES ($1, $2, $3, 1)`,
          [est.id, bim.id, ["Participa activamente en clase", "Se distrae con facilidad", "Mejoro su comportamiento", "Necesita apoyo en lectoescritura", "Buen companero, ayuda a otros", "Llega tarde con frecuencia", "Se aisla en el recreo", "Muestra interes por la lectura", "Dificultad en matematicas", "Comportamiento ejemplar", "Habla mucho en clase", "No trae tareas", "Liderazgo positivo", "Necesita gafas", "Se enferma seguido", "Muy ordenado con sus materiales"][Math.floor(Math.random() * 16)]]
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
    console.log("\nSUCCESS SEED PARTE 3 COMPLETADO");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error:", error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

require("../config/postgres").pool.query("SELECT 1").then(() => {
  const { pool } = require("../config/postgres");
  require("../config/postgres").pool = require("pg").Pool.prototype.constructor({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  // Just run the function
  require("./seedPart3").seedPart3();
}).catch(e => console.error(e));

module.exports = { seedPart3: async () => {
  const { pool } = require("../config/postgres");
} };