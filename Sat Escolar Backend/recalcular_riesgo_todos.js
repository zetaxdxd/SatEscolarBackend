// ════════════════════════════════════════════════════════════════
//  recalcular_riesgo_todos.js
//
//  Calcula el indicador de riesgo (asistencia + académico + cuestionario)
//  para TODOS los estudiantes activos, usando la lógica que ya existe
//  en services/riesgoEstudianteService.js, y lo guarda en la tabla
//  evaluaciones_riesgo_estudiante.
//
//  CÓMO EJECUTARLO:
//  1) Copia este archivo a la raíz de tu proyecto backend
//     (al mismo nivel donde está la carpeta "services" y "config").
//  2) Desde la terminal, en esa carpeta, ejecuta:
//       node recalcular_riesgo_todos.js
//  3) Espera a que termine. Va a imprimir cuántos estudiantes procesó
//     y si hubo errores.
// ════════════════════════════════════════════════════════════════

const { query, pool } = require("./config/postgres");
const riesgoEstudianteService = require("./services/riesgoEstudianteService");

async function main() {
  console.log("Buscando estudiantes activos...");
  const result = await query("SELECT id, nombres, apellidos FROM estudiantes WHERE activo = TRUE ORDER BY id");
  const estudiantes = result.rows;
  console.log(`Encontrados ${estudiantes.length} estudiantes. Calculando indicador de riesgo...\n`);

  let exitosos = 0;
  let fallidos = 0;

  for (const estudiante of estudiantes) {
    try {
      const resultado = await riesgoEstudianteService.calcularIndicadorEstudiante(estudiante.id, {
        periodoId: null,   // usa el periodo activo más reciente automáticamente
        guardar: true
      });
      console.log(
        `✔ ${estudiante.nombres} ${estudiante.apellidos} -> ` +
        `nivel: ${resultado.nivel} | puntaje_global: ${resultado.puntaje_global} | ` +
        `completos: ${resultado.datos_completos}`
      );
      exitosos++;
    } catch (error) {
      console.error(`✘ ${estudiante.nombres} ${estudiante.apellidos} -> ERROR: ${error.message}`);
      fallidos++;
    }
  }

  console.log("\n════════════════════════════════════════");
  console.log(`Listo. Exitosos: ${exitosos} | Fallidos: ${fallidos}`);
  console.log("════════════════════════════════════════");

  await pool.end();
}

main().catch(error => {
  console.error("Error fatal:", error);
  process.exit(1);
});