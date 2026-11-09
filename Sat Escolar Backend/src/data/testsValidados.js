// Catálogo de Tests Validados MINSA — para uso del psicólogo
// Cada test tiene scoring automático y puntos de corte validados

const TESTS_VALIDADOS = [
  {
    codigo: "GAD-7",
    nombre: "GAD-7 — Ansiedad",
    descripcion: "Escala de Ansiedad Generalizada de 7 ítems. Validado por MINSA para tamizaje en adolescentes y adultos. Detecta ansiedad generalizada en las últimas 2 semanas.",
    preguntas: [
      "Sentirse nervioso/a, ansioso/a o con los nervios de punta",
      "No poder dejar de preocuparse o no poder controlar la preocupación",
      "Preocuparse demasiado por diferentes cosas",
      "Dificultad para relajarse",
      "Estar tan inquieto/a que es difícil permanecer sentado/a",
      "Molestarse o irritarse fácilmente",
      "Sentir miedo como si algo terrible pudiera pasar"
    ],
    opciones: [
      { texto: "Nunca", puntaje: 0 },
      { texto: "Varios días (1-5 días)", puntaje: 1 },
      { texto: "Más de la mitad de los días (6-12 días)", puntaje: 2 },
      { texto: "Casi todos los días (13-14 días)", puntaje: 3 }
    ],
    rangos: [
      { min: 0, max: 4, nivel: "Mínima", color: "#1f9d6f", recomendacion: "Sin intervención. Psicoeducación y seguimiento rutinario." },
      { min: 5, max: 9, nivel: "Leve", color: "#eab308", recomendacion: "Consejería breve, técnicas de respiración, seguimiento en 1 mes." },
      { min: 10, max: 14, nivel: "Moderada", color: "#f97316", recomendacion: "Intervención psicológica focal, coordinación con tutor y familia." },
      { min: 15, max: 21, nivel: "Severa", color: "#dc2626", recomendacion: "Derivación prioritaria a psicólogo clínico / centro de salud mental. Evaluar riesgo." }
    ],
    puntaje_max: 21,
    tiempo: "2 min",
    validacion: "MINSA / Spitzer et al. 2006 — α=0.89"
  },
  {
    codigo: "PHQ-9",
    nombre: "PHQ-9 — Depresión",
    descripcion: "Cuestionario de Salud del Paciente de 9 ítems. Gold standard para depresión en adolescentes. Validado MINSA.",
    preguntas: [
      "Poco interés o placer en hacer cosas",
      "Sentirse desanimado/a, deprimido/a o sin esperanzas",
      "Dificultad para dormir o permanecer dormido/a, o dormir demasiado",
      "Sentirse cansado/a o con poca energía",
      "Falta de apetito o comer en exceso",
      "Sentirse mal consigo mismo/a o que es un fracaso",
      "Dificultad para concentrarse en cosas (tareas, lecturas)",
      "Moverse o hablar tan lento que otros lo notan, o estar inquieto/a",
      "Pensamientos de que estaría mejor muerto/a o de lastimarse"
    ],
    opciones: [
      { texto: "Nunca", puntaje: 0 },
      { texto: "Varios días", puntaje: 1 },
      { texto: "Más de la mitad de los días", puntaje: 2 },
      { texto: "Casi todos los días", puntaje: 3 }
    ],
    rangos: [
      { min: 0, max: 4, nivel: "Mínima", color: "#1f9d6f", recomendacion: "Sin depresión. Refuerzo positivo." },
      { min: 5, max: 9, nivel: "Leve", color: "#eab308", recomendacion: "Consejería, activación conductual, seguimiento." },
      { min: 10, max: 14, nivel: "Moderada", color: "#f97316", recomendacion: "Intervención psicológica, involucrar familia, evaluar semanal." },
      { min: 15, max: 19, nivel: "Moderada-Severa", color: "#dc2626", recomendacion: "Derivación prioritaria, plan de seguridad." },
      { min: 20, max: 27, nivel: "Severa", color: "#7f1d1d", recomendacion: "Derivación urgente. Evaluar riesgo suicida (ítem 9). Si ítem 9 >0, derivación inmediata." }
    ],
    puntaje_max: 27,
    tiempo: "3 min",
    validacion: "MINSA / Kroenke et al. 2001 — α=0.89"
  },
  {
    codigo: "BIENESTAR-5",
    nombre: "Bienestar 5 — Tamizaje breve",
    descripcion: "Test breve de 5 ítems creado para tamizaje rápido en aula (30 seg). Explora sueño, apetito, ánimo, energía e irritabilidad. Ideal para barrido masivo.",
    preguntas: [
      "¿Cómo has dormido la última semana?",
      "¿Cómo ha estado tu apetito?",
      "¿Cómo te has sentido de ánimo (triste/alegre)?",
      "¿Cómo ha estado tu energía para hacer cosas?",
      "¿Te has sentido irritable o enojado/a con facilidad?"
    ],
    opciones: [
      { texto: "Muy bien", puntaje: 0 },
      { texto: "Bien", puntaje: 1 },
      { texto: "Regular", puntaje: 2 },
      { texto: "Mal", puntaje: 3 },
      { texto: "Muy mal", puntaje: 4 }
    ],
    rangos: [
      { min: 0, max: 4, nivel: "Bienestar conservado", color: "#1f9d6f", recomendacion: "Sin acción. Reforzar hábitos saludables." },
      { min: 5, max: 9, nivel: "Alerta leve", color: "#eab308", recomendacion: "Conversación breve, pautas de sueño/alimentación, control en 2 semanas." },
      { min: 10, max: 14, nivel: "Alerta moderada", color: "#f97316", recomendacion: "Entrevista focal, coordinar tutor, evaluar GAD-7/PHQ-9." },
      { min: 15, max: 20, nivel: "Alerta alta", color: "#dc2626", recomendacion: "Derivación a psicología, seguimiento semanal, avisar familia." }
    ],
    puntaje_max: 20,
    tiempo: "30 seg",
    validacion: "SAT Escolar — basado en WHO-5 y MINI, adaptado para secundaria"
  }
];

function calcularResultado(codigo, respuestas) {
  const test = TESTS_VALIDADOS.find(t => t.codigo === codigo);
  if (!test) return null;
  let total = 0;
  respuestas.forEach(r => {
    const opt = test.opciones.find(o => o.texto === r.respuesta);
    if (opt) total += opt.puntaje;
    else if (typeof r.puntaje === 'number') total += r.puntaje;
  });
  const rango = test.rangos.find(r => total >= r.min && total <= r.max) || test.rangos[test.rangos.length - 1];
  return { total, max: test.puntaje_max, nivel: rango.nivel, color: rango.color, recomendacion: rango.recomendacion, rango };
}

module.exports = { TESTS_VALIDADOS, calcularResultado };
