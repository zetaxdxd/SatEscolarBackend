/**
 * ═══════════════════════════════════════════════════════════════
 *  MOTOR DE EVALUACIÓN DE RIESGO — SAT ESCOLAR
 *  Evalúa a cada estudiante en 4 dimensiones y genera un nivel
 *  de riesgo global con justificación para el psicólogo/docente.
 * ═══════════════════════════════════════════════════════════════
 *
 *  DIMENSIONES (peso en puntaje final 0–100):
 *   1. Académico       — notas promedio         (peso 30%)
 *   2. Asistencia      — % de faltas            (peso 30%)
 *   3. Conductual      — conducta registrada     (peso 20%)
 *   4. Socioemocional  — formulario + incidentes (peso 20%)
 *
 *  NIVELES DE RIESGO:
 *   • Excelente   0–19   → verde oscuro
 *   • Bien        20–39  → verde
 *   • Regular     40–59  → amarillo
 *   • En riesgo   60–79  → naranja
 *   • Alto riesgo 80–100 → rojo
 */

// ── PALABRAS CLAVE SOCIOEMOCIONALES ──────────────────────────────────────────

const PALABRAS_RIESGO_ALTO = [
  "bullying", "acoso", "violencia", "golpe", "golpea", "golpearon",
  "triste", "tristeza", "llorar", "lloro", "llorando",
  "solo", "sola", "soledad", "aislado", "aislada", "nadie me habla",
  "miedo", "terror", "amenaza", "amenazado",
  "maltrato", "maltratan", "maltrata",
  "problemas familiares", "mi familia", "mis padres pelean", "violencia en casa",
  "no quiero estudiar", "no quiero ir", "odio el colegio",
  "me siento mal", "me siento muy mal", "me hace daño",
  "deprimido", "deprimida", "depresión",
  "quiero desaparecer", "no quiero estar aquí", "no vale la pena"
];

const PALABRAS_RIESGO_MEDIO = [
  "cansado", "cansada", "agotado", "agotada",
  "estresado", "estresada", "estrés",
  "preocupado", "preocupada", "preocupación",
  "discusión", "pelea", "discutí", "peleé",
  "bajas notas", "notas malas", "jalé", "desaprobé",
  "no entiendo", "me cuesta", "difícil", "muy difícil",
  "aburrido", "aburrida", "no me gusta",
  "me ignoran", "no tengo amigos", "pocos amigos"
];

/**
 * Analiza texto libre y devuelve { puntaje (0–100), alertas[] }
 */
function analizarTextoSocio(textos) {
  const texto = textos.join(" ").toLowerCase();
  let puntaje = 0;
  const alertas = [];

  PALABRAS_RIESGO_ALTO.forEach(p => {
    if (texto.includes(p)) {
      puntaje += 15;
      alertas.push({ nivel: "alto", frase: p });
    }
  });

  PALABRAS_RIESGO_MEDIO.forEach(p => {
    if (texto.includes(p)) {
      puntaje += 6;
      alertas.push({ nivel: "medio", frase: p });
    }
  });

  return { puntaje: Math.min(puntaje, 100), alertas };
}

// ── CÁLCULO POR DIMENSIÓN ─────────────────────────────────────────────────────

/**
 * Dimensión académica. Recibe arreglo de notas (números 0–20).
 * Retorna puntaje de riesgo 0–100 (100 = mayor riesgo).
 */
function calcularRiesgoAcademico(notas) {
  if (!notas || notas.length === 0) return { puntaje: 0, promedio: null, detalle: "Sin registros académicos" };

  const promedio = notas.reduce((a, b) => a + b, 0) / notas.length;

  let puntaje;
  if (promedio >= 18) puntaje = 0;
  else if (promedio >= 16) puntaje = 15;
  else if (promedio >= 14) puntaje = 30;
  else if (promedio >= 12) puntaje = 50;
  else if (promedio >= 10) puntaje = 70;
  else puntaje = 90;

  // Penalizar si hay notas muy bajas individuales
  const notasCriticas = notas.filter(n => n < 11).length;
  if (notasCriticas >= 2) puntaje = Math.min(puntaje + 10, 100);

  return {
    puntaje,
    promedio: +promedio.toFixed(1),
    detalle: `Promedio ${promedio.toFixed(1)} con ${notas.length} evaluación(es) registrada(s)`
  };
}

/**
 * Dimensión asistencia. Recibe arreglo de strings "Asistió" | "Faltó".
 * Retorna puntaje de riesgo 0–100.
 */
function calcularRiesgoAsistencia(registros) {
  if (!registros || registros.length === 0) return { puntaje: 0, porcentajeFaltas: null, detalle: "Sin registros de asistencia" };

  const faltas = registros.filter(r => r === "Faltó").length;
  const total = registros.length;
  const porcentajeFaltas = (faltas / total) * 100;

  let puntaje;
  if (porcentajeFaltas === 0) puntaje = 0;
  else if (porcentajeFaltas <= 5) puntaje = 10;
  else if (porcentajeFaltas <= 15) puntaje = 30;
  else if (porcentajeFaltas <= 25) puntaje = 55;
  else if (porcentajeFaltas <= 40) puntaje = 75;
  else puntaje = 95;

  // Faltas consecutivas agravan el riesgo
  let consecutivas = 0, maxConsecutivas = 0;
  registros.forEach(r => {
    if (r === "Faltó") { consecutivas++; maxConsecutivas = Math.max(maxConsecutivas, consecutivas); }
    else consecutivas = 0;
  });
  if (maxConsecutivas >= 3) puntaje = Math.min(puntaje + 15, 100);

  return {
    puntaje,
    porcentajeFaltas: +porcentajeFaltas.toFixed(1),
    faltas,
    total,
    detalle: `${faltas} falta(s) de ${total} día(s) registrado(s) (${porcentajeFaltas.toFixed(0)}%)`
  };
}

/**
 * Dimensión conductual. Recibe arreglo de strings "Buena" | "Regular" | "Mala".
 * Retorna puntaje de riesgo 0–100.
 */
function calcularRiesgoConducial(conductasArr) {
  if (!conductasArr || conductasArr.length === 0) return { puntaje: 0, detalle: "Sin registros de conducta" };

  const map = { "Buena": 0, "Regular": 50, "Mala": 100 };
  const promedio = conductasArr.reduce((acc, c) => acc + (map[c] ?? 50), 0) / conductasArr.length;

  const malas = conductasArr.filter(c => c === "Mala").length;
  let puntaje = promedio;
  if (malas >= 2) puntaje = Math.min(puntaje + 15, 100);

  const resumen = {
    Buena: conductasArr.filter(c => c === "Buena").length,
    Regular: conductasArr.filter(c => c === "Regular").length,
    Mala: conductasArr.filter(c => c === "Mala").length
  };

  return {
    puntaje: +puntaje.toFixed(1),
    resumen,
    detalle: `B:${resumen.Buena} R:${resumen.Regular} M:${resumen.Mala} en ${conductasArr.length} registro(s)`
  };
}

/**
 * Dimensión socioemocional. Recibe arreglo de objetos respuesta + cantidad de incidentes.
 */
function calcularRiesgoSocio(respuestas, numIncidentes = 0) {
  if ((!respuestas || respuestas.length === 0) && numIncidentes === 0) {
    return { puntaje: 0, detalle: "Sin formularios ni incidentes" };
  }

  // Promedio de puntajes ya calculados al guardar respuestas
  let puntajeFormulario = 0;
  if (respuestas && respuestas.length > 0) {
    puntajeFormulario = respuestas.reduce((acc, r) => acc + (r.puntaje_socio || 0), 0) / respuestas.length;
  }

  // Incidentes suman directamente al riesgo
  const bonusIncidentes = Math.min(numIncidentes * 20, 40);
  const puntajeFinal = Math.min(puntajeFormulario + bonusIncidentes, 100);

  return {
    puntaje: +puntajeFinal.toFixed(1),
    detalle: `${respuestas?.length || 0} formulario(s) + ${numIncidentes} incidente(s)`
  };
}

// ── EVALUACIÓN GLOBAL ─────────────────────────────────────────────────────────

/**
 * Calcula el nivel de riesgo global ponderado.
 *
 * @param {object} datos - {
 *   notas: number[],
 *   asistencias: string[],
 *   conductas: string[],
 *   respuestasSocio: object[],
 *   numIncidentes: number
 * }
 * @returns {object} resultado completo
 */
function evaluarEstudiante(datos) {
  const academico  = calcularRiesgoAcademico(datos.notas);
  const asistencia = calcularRiesgoAsistencia(datos.asistencias);
  const conducta   = calcularRiesgoConducial(datos.conductas);
  const socio      = calcularRiesgoSocio(datos.respuestasSocio, datos.numIncidentes || 0);

  // Puntaje ponderado (pesos: académico 30, asistencia 30, conducta 20, socio 20)
  const puntajeTotal = (
    academico.puntaje  * 0.30 +
    asistencia.puntaje * 0.30 +
    conducta.puntaje   * 0.20 +
    socio.puntaje      * 0.20
  );

  // Nivel de riesgo según puntaje
  let nivel, color, recomendacion;
  if (puntajeTotal < 20) {
    nivel = "Excelente"; color = "#16a34a";
    recomendacion = "El estudiante muestra un desarrollo óptimo en todas las dimensiones evaluadas. Mantener el acompañamiento regular.";
  } else if (puntajeTotal < 40) {
    nivel = "Bien"; color = "#65a30d";
    recomendacion = "El estudiante presenta un desarrollo adecuado. Se recomienda reforzar alguna dimensión de manera preventiva.";
  } else if (puntajeTotal < 60) {
    nivel = "Regular"; color = "#ca8a04";
    recomendacion = "Se detectan señales de alerta moderadas. Se recomienda entrevista de seguimiento con el estudiante y comunicación con la familia.";
  } else if (puntajeTotal < 80) {
    nivel = "En riesgo"; color = "#ea580c";
    recomendacion = "El estudiante presenta múltiples indicadores de riesgo. Requiere intervención psicopedagógica prioritaria y coordinación con padres.";
  } else {
    nivel = "Alto riesgo"; color = "#dc2626";
    recomendacion = "ALERTA CRÍTICA: El estudiante presenta indicadores de riesgo severo. Se requiere intervención inmediata, entrevista con familia y protocolo de protección si es necesario.";
  }

  // Señales de alerta específicas para el reporte
  const senales = [];
  if (academico.promedio !== null && academico.promedio < 12) senales.push("⚠️ Promedio académico crítico (" + academico.promedio + ")");
  if (asistencia.porcentajeFaltas !== null && asistencia.porcentajeFaltas > 20) senales.push("⚠️ Alto porcentaje de inasistencias (" + asistencia.porcentajeFaltas + "%)");
  if (conducta.resumen?.Mala > 0) senales.push("⚠️ Registros de conducta negativa (" + conducta.resumen.Mala + " vez/veces)");
  if (datos.numIncidentes > 0) senales.push("⚠️ " + datos.numIncidentes + " incidente(s) reportado(s)");

  return {
    nivelRiesgo: nivel,
    color,
    puntajeTotal: +puntajeTotal.toFixed(1),
    dimensiones: {
      academico: { ...academico, peso: "30%" },
      asistencia: { ...asistencia, peso: "30%" },
      conducta: { ...conducta, peso: "20%" },
      socio: { ...socio, peso: "20%" }
    },
    senalesAlerta: senales,
    recomendacion
  };
}

module.exports = {
  evaluarEstudiante,
  analizarTextoSocio,
  calcularRiesgoAcademico,
  calcularRiesgoAsistencia,
  calcularRiesgoConducial,
  calcularRiesgoSocio
};
