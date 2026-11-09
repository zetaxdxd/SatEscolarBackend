// seedFresh.js — Elimina todos los usuarios y crea solo director + psicólogo
const bcrypt = require("bcryptjs");
const { pool, closePool } = require("../config/postgres");

const HASH_DIRECTORA = bcrypt.hashSync("Directora2026!", 10);
const HASH_PSICOLOGO = bcrypt.hashSync("Psicologo123!", 10);

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Eliminar datos dependientes (orden correcto de foreign keys)
    await client.query(`
      DELETE FROM docente_asignaturas_secciones;
      DELETE FROM docente_secciones;
      DELETE FROM asignaturas;
      DELETE FROM productos_evaluacion;
      DELETE FROM competencias;
      DELETE FROM niveles_logro;
      DELETE FROM trimestres_academicos;
      DELETE FROM evaluaciones_academicas;
      DELETE FROM calificaciones_trimestrales_competencia;
      DELETE FROM calificaciones_competencia;
      DELETE FROM notas_simples;
      DELETE FROM notas;
      DELETE FROM formulario_respuestas;
      DELETE FROM formulario_habilitaciones;
      DELETE FROM formulario_preguntas;
      DELETE FROM pregunta_opciones;
      DELETE FROM formularios_psicologicos;
      DELETE FROM formularios_activos;
      DELETE FROM comportamientos;
      DELETE FROM alertas_riesgo;
      DELETE FROM evaluaciones_riesgo_estudiante;
      DELETE FROM configuraciones_riesgo;
      DELETE FROM evaluaciones_riesgo;
      DELETE FROM seguimientos_psicopedagogicos;
      DELETE FROM casos_seguimiento;
      DELETE FROM asistencias;
      DELETE FROM reporte_archivos;
      DELETE FROM reportes_anonimos;
      DELETE FROM mensajes_anonimos;
      DELETE FROM codigos_verificacion;
      DELETE FROM respuestas_formulario;
      DELETE FROM registros_docente;
      DELETE FROM psicologos;
      DELETE FROM docentes;
      DELETE FROM estudiantes;
      DELETE FROM periodos_academicos;
      DELETE FROM secciones;
      DELETE FROM usuarios;
    `);
    console.log("✅ Todos los datos eliminados");

    // Reiniciar secuencias
    await client.query(`
      ALTER SEQUENCE usuarios_id_seq RESTART WITH 1;
      ALTER SEQUENCE psicologos_id_seq RESTART WITH 1;
      ALTER SEQUENCE docentes_id_seq RESTART WITH 1;
      ALTER SEQUENCE estudiantes_id_seq RESTART WITH 1;
      ALTER SEQUENCE secciones_id_seq RESTART WITH 1;
      ALTER SEQUENCE asignaturas_id_seq RESTART WITH 1;
      ALTER SEQUENCE periodos_academicos_id_seq RESTART WITH 1;
    `);
    console.log("✅ Secuencias reiniciadas");

    // Crear director
    const dirResult = await client.query(
      `INSERT INTO usuarios (username, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, 'director', TRUE) RETURNING id`,
      ["directora", "directora@ofelia.edu.pe", HASH_DIRECTORA]
    );
    console.log(`✅ Director creado (id=${dirResult.rows[0].id}): directora@ofelia.edu.pe / Directora2026!`);

    // Crear psicólogo
    const psiUser = await client.query(
      `INSERT INTO usuarios (username, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, 'psicologo', TRUE) RETURNING id`,
      ["carlos.pineda", "carlos.pineda@ofelia.edu.pe", HASH_PSICOLOGO]
    );
    const psiId = psiUser.rows[0].id;
    await client.query(
      `INSERT INTO psicologos (usuario_id, nombres, apellidos, codigo, activo)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [psiId, "Carlos", "Pineda Torres", "PSI-0001"]
    );
    console.log(`✅ Psicólogo creado (id=${psiId}): carlos.pineda@ofelia.edu.pe / Psicologo123!`);

    // Crear secciones de prueba
    await client.query(`
      INSERT INTO secciones (nivel, grado, letra) VALUES 
        ('Primaria', '1ro', 'A'),
        ('Primaria', '2do', 'B'),
        ('Secundaria', '3ro', 'A'),
        ('Secundaria', '4to', 'B'),
        ('Secundaria', '5to', 'A')
      ON CONFLICT (nivel, grado, letra) DO NOTHING;
    `);
    console.log("✅ 5 secciones creadas");

    // Crear periodos académicos
    await client.query(`
      INSERT INTO periodos_academicos (nombre, anio, activo) VALUES
        ('I Bimestre', 2026, TRUE),
        ('II Bimestre', 2026, FALSE),
        ('III Bimestre', 2026, FALSE),
        ('IV Bimestre', 2026, FALSE)
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ 4 periodos académicos creados");

    await client.query("COMMIT");
    console.log("\n🎉 Base de datos reiniciada correctamente");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", error.message);
  } finally {
    await closePool();
  }
}

seed();
