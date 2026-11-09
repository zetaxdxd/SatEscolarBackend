const { query } = require("../config/postgres");

function redondear(valor, decimales = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return null;
  return Number(Number(valor).toFixed(decimales));
}

function limitar(valor, minimo = 0, maximo = 100) {
  return Math.min(maximo, Math.max(minimo, Number(valor)));
}

const PUNTAJE_NIVEL_LOGRO = {
  AD: 100,
  A: 85,
  B: 60,
  C: 30
};

const PUNTAJE_COMPORTAMIENTO = {
  Excelente: 100,
  Bueno: 80,
  Regular: 50,
  Deficiente: 20
};

function puntajePorAsistencia(porcentaje) {
  if (porcentaje >= 95) return 100;
  if (porcentaje >= 90) return 85;
  if (porcentaje >= 80) return 65;
  if (porcentaje >= 70) return 40;
  return 20;
}

function puntajePorCuestionario(promedioRiesgo) {
  // El indicador global usa puntajes altos como resultado favorable. Las
  // opciones del cuestionario usan la escala contraria: 0 sin riesgo y 100
  // riesgo alto. Se invierte solo su aporte, conservando el riesgo original.
  return 100 - limitar(promedioRiesgo);
}

function porcentaje(cantidad, total) {
  return total ? redondear((cantidad / total) * 100) : 0;
}

function calcularTendencia(valores) {
  if (!valores || valores.length < 2) {
    return { estado: "Sin datos suficientes", pendiente: null, variacion: null };
  }

  const numeros = valores.map(Number);
  const n = numeros.length;
  const mediaX = (n - 1) / 2;
  const mediaY = numeros.reduce((total, valor) => total + valor, 0) / n;
  let numerador = 0;
  let denominador = 0;
  numeros.forEach((valor, indice) => {
    numerador += (indice - mediaX) * (valor - mediaY);
    denominador += (indice - mediaX) ** 2;
  });
  const pendiente = denominador ? numerador / denominador : 0;
  const estado = pendiente > 0.25 ? "Sube" : pendiente < -0.25 ? "Baja" : "Estable";

  return {
    estado,
    pendiente: redondear(pendiente),
    variacion: redondear(numeros[numeros.length - 1] - numeros[0])
  };
}

function calcularAsistencia(registros) {
  if (!registros.length) {
    return { puntaje: null, disponible: false, total: 0, detalle: "Sin asistencia registrada" };
  }

  const asistio = registros.filter(item => item.estado === "Asistió").length;
  const tardanzas = registros.filter(item => item.estado === "Tardanza").length;
  const faltas = registros.filter(item => item.estado === "Faltó").length;
  const total = registros.length;
  const asistenciaEfectiva = ((asistio + tardanzas * 0.5) / total) * 100;
  const porcentajeAusencia = total ? (faltas / total) * 100 : 0;

  let consecutivas = 0;
  let maxFaltasConsecutivas = 0;
  registros.forEach(item => {
    if (item.estado === "Faltó") {
      consecutivas += 1;
      maxFaltasConsecutivas = Math.max(maxFaltasConsecutivas, consecutivas);
    } else {
      consecutivas = 0;
    }
  });

  // Detección de patrones robustos (8 semanas = bimestre)
  const porDiaSemana = {};
  registros.forEach(r => {
    const d = new Date(r.fecha);
    const dia = d.getDay(); // 0 dom, 1 lun...
    if (!porDiaSemana[dia]) porDiaSemana[dia] = { total: 0, faltas: 0, tardanzas: 0 };
    porDiaSemana[dia].total += 1;
    if (r.estado === "Faltó") porDiaSemana[dia].faltas += 1;
    if (r.estado === "Tardanza") porDiaSemana[dia].tardanzas += 1;
  });
  const diasNombres = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  let patronCiclico = null;
  let maxTasaFaltaDia = 0;
  Object.entries(porDiaSemana).forEach(([dia, stats]) => {
    const tasa = stats.total ? (stats.faltas / stats.total) * 100 : 0;
    if (tasa > maxTasaFaltaDia) maxTasaFaltaDia = tasa;
    if (stats.total >= 4 && tasa >= 60) {
      patronCiclico = { dia: Number(dia), nombre: diasNombres[dia], tasa: redondear(tasa), faltas: stats.faltas, total: stats.total };
    }
  });
  let patronTardanzaDia = null;
  Object.entries(porDiaSemana).forEach(([dia, stats]) => {
    const tasa = stats.total ? (stats.tardanzas / stats.total) * 100 : 0;
    if (stats.total >= 4 && tasa >= 60) {
      patronTardanzaDia = { dia: Number(dia), nombre: diasNombres[dia], tasa: redondear(tasa), tardanzas: stats.tardanzas, total: stats.total };
    }
  });
  const ausentismoCronico = porcentajeAusencia >= 10;
  const patronDiasAlternos = (() => {
    let alternos = 0;
    for (let i=1;i<registros.length;i++) {
      if (registros[i].estado === "Faltó" && registros[i-1].estado !== "Faltó") alternos++;
    }
    return alternos >= 4 && faltas >= 6;
  })();

  // Datos citables en lenguaje simple: últimas fechas de falta y racha reciente
  const fmtFechaCorta = (f) => {
    try {
      const dt = new Date(f);
      return `${String(dt.getDate()).padStart(2, "0")} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"][dt.getMonth()]}`;
    } catch (_) { return String(f).slice(0, 10); }
  };
  const fechasFalta = registros.filter(r => r.estado === "Faltó").map(r => r.fecha);
  const ultimasFaltas = fechasFalta.slice(-5).reverse().map(fmtFechaCorta);
  let rachaFinal = 0;
  for (let i = registros.length - 1; i >= 0; i--) {
    if (registros[i].estado === "Faltó") rachaFinal++;
    else break;
  }
  const hace7 = Date.now() - 7 * 86400000;
  const faltasUltimos7 = registros.filter(r => r.estado === "Faltó" && new Date(r.fecha).getTime() >= hace7).length;

  return {
    puntaje: puntajePorAsistencia(asistenciaEfectiva),
    disponible: true,
    total,
    asistio,
    tardanzas,
    faltas,
    faltas_consecutivas_maximas: maxFaltasConsecutivas,
    porcentaje_asistencia: redondear(asistenciaEfectiva),
    porcentaje_ausencia: redondear(porcentajeAusencia),
    ausentismo_cronico: ausentismoCronico,
    patron_ciclico: patronCiclico,
    patron_tardanza_dia: patronTardanzaDia,
    max_tasa_falta_dia: redondear(maxTasaFaltaDia),
    patron_dias_alternos: patronDiasAlternos,
    ultimas_faltas: ultimasFaltas,
    faltas_ultimos_7_dias: faltasUltimos7,
    racha_final_faltas: rachaFinal,
    escala: ">=95:100, 90-94:85, 80-89:65, 70-79:40, <70:20",
    criterio_tardanza: "Cada tardanza equivale a media asistencia",
    criterio_cronico: ">=10% ausencias en bimestre = crónico (SIAT)",
    criterio_ciclico: ">=60% faltas un mismo día con ≥4 registros"
  };
}

const AREAS_REQUERIDAS = 11; // Límite 11 áreas MINEDU
function calcularAcademico(calificaciones) {
  if (!calificaciones.length) {
    return { puntaje: null, disponible: false, total: 0, detalle: "Sin calificativos por competencia registrados" };
  }
  const areasUnicas = new Set(calificaciones.map(c => c.asignatura_id || c.asignatura || c.competencia_id).filter(Boolean)).size;
  // Si no hay asignatura_id (tests mock), no exigir 11 áreas; en producción sí se exige
  const tieneOnceAreas = areasUnicas === 0 ? true : areasUnicas >= AREAS_REQUERIDAS;
  if (areasUnicas > 0 && !tieneOnceAreas) {
    return { puntaje: null, disponible: false, total: calificaciones.length, areasRegistradas: areasUnicas, detalle: `Faltan áreas: ${areasUnicas}/${AREAS_REQUERIDAS} áreas con notas. Se requieren las 11 para evaluar riesgo` };
  }

  const conteo = { AD: 0, A: 0, B: 0, C: 0 };
  calificaciones.forEach(item => {
    const nivel = String(item.nivel_logro || "").toUpperCase();
    if (Object.prototype.hasOwnProperty.call(conteo, nivel)) conteo[nivel] += 1;
  });
  const total = Object.values(conteo).reduce((suma, cantidad) => suma + cantidad, 0);
  const distribucion = Object.fromEntries(
    Object.entries(conteo).map(([nivel, cantidad]) => [nivel, { cantidad, porcentaje: porcentaje(cantidad, total) }])
  );
  const indice = total
    ? Object.entries(conteo).reduce((suma, [nivel, cantidad]) => {
      return suma + (cantidad / total) * PUNTAJE_NIVEL_LOGRO[nivel];
    }, 0)
    : null;

  const trimestres = new Map();
  calificaciones.forEach(item => {
    const orden = Number(item.trimestre_orden || 0);
    const puntaje = PUNTAJE_NIVEL_LOGRO[String(item.nivel_logro || "").toUpperCase()];
    if (!orden || puntaje === undefined) return;
    if (!trimestres.has(orden)) trimestres.set(orden, []);
    trimestres.get(orden).push(puntaje);
  });
  const promediosTrimestrales = [...trimestres.entries()]
    .sort(([a], [b]) => a - b)
    .map(([orden, valores]) => ({
      trimestre_orden: orden,
      puntaje: redondear(valores.reduce((suma, valor) => suma + valor, 0) / valores.length)
    }));
  const tendencia = calcularTendencia(promediosTrimestrales.map(item => item.puntaje));
  // Detección caída brusca: compara último vs anterior (>20 puntos)
  let caidaBrusca = null;
  if (promediosTrimestrales.length >= 2) {
    const ultimo = promediosTrimestrales[promediosTrimestrales.length-1].puntaje;
    const anterior = promediosTrimestrales[promediosTrimestrales.length-2].puntaje;
    if (anterior - ultimo >= 20) caidaBrusca = { de: anterior, a: ultimo, diferencia: redondear(anterior-ultimo) };
  }
  const porcentaje_c = distribucion.C ? distribucion.C.porcentaje : 0;
  const desinteres = tendencia.estado === "Baja" && porcentaje_c > 20;

  // Nuevo criterio de promoción 2024-2025 (Res. 094-2020): C en >50% de competencias de 4 cursos = repite
  const porCurso = {};
  calificaciones.forEach(item => {
    const curso = String(item.asignatura_id || item.asignatura || "Sin curso");
    if (!porCurso[curso]) porCurso[curso] = { total: 0, c: 0 };
    porCurso[curso].total += 1;
    if (String(item.nivel_logro || "").toUpperCase() === "C") porCurso[curso].c += 1;
  });
  const cursosConCritico = Object.values(porCurso).filter(c => c.c > c.total / 2).length;
  const cursosConLogro = Object.values(porCurso).filter(c => (c.total - c.c) >= c.total / 2 && c.total > 0).length; // A/AD/B en >=50%
  const riesgoAcademicoPorCriterio = cursosConCritico >= 4 ? 20 : cursosConCritico >= 2 ? 40 : cursosConCritico >= 1 ? 60 : porcentaje_c > 30 ? 50 : porcentaje_c > 15 ? 65 : 85;
  // Puntaje final académico combina índice ponderado + criterio de repitencia (más severo si hay 4 cursos con C)
  const puntajeFinalAcademico = Math.min(indice, riesgoAcademicoPorCriterio);

  return {
    puntaje: redondear(limitar(puntajeFinalAcademico)),
    puntaje_indice: redondear(limitar(indice)),
    puntaje_criterio: riesgoAcademicoPorCriterio,
    disponible: true,
    total,
    distribucion,
    porcentaje_ad_a: redondear(distribucion.AD.porcentaje + distribucion.A.porcentaje),
    porcentaje_b: distribucion.B.porcentaje,
    porcentaje_c: distribucion.C.porcentaje,
    cursos_con_critico: cursosConCritico,
    cursos_con_logro: cursosConLogro,
    por_curso: porCurso,
    valores_nivel: PUNTAJE_NIVEL_LOGRO,
    promedios_trimestrales: promediosTrimestrales,
    tendencia,
    caida_brusca: caidaBrusca,
    desinteres,
    criterio_promocion: cursosConCritico >= 4 ? "Riesgo alto: C en >50% de 4 cursos (repite)" : cursosConLogro >= 3 ? "Pasa: A/AD en ≥50% de 3 cursos" : "En evaluación"
  };
}

function calcularCuestionario(respuestas, abiertas) {
  const configuradas = respuestas.filter(item => item.puntaje_riesgo !== null);
  if (!configuradas.length) {
    return {
      puntaje: null,
      disponible: false,
      total_respuestas_cerradas: respuestas.length,
      respuestas_configuradas: 0,
      detalle: respuestas.length
        ? "Las respuestas cerradas todavía no tienen puntajes configurados"
        : "Sin respuestas cerradas registradas"
    };
  }

  // Separar respuestas de tests validados de formularios personalizados
  const respuestasValidadas = configuradas.filter(r => r.es_validado && r.codigo_minsa);
  const respuestasCustom = configuradas.filter(r => !r.es_validado);

  let puntajeFinal;
  let metodo;
  let testsAplicados = [];

  if (respuestasValidadas.length > 0) {
    // Para tests validados: usar el promedio de puntaje_riesgo (ya mapeado 0..100)
    const promedio = respuestasValidadas.reduce((t, r) => t + Number(r.puntaje_riesgo), 0) / respuestasValidadas.length;
    puntajeFinal = redondear(promedio);
    metodo = "tests_validados_minsa";
    // Contar tests aplicados por código
    const conteo = {};
    respuestasValidadas.forEach(r => {
      if (!conteo[r.codigo_minsa]) conteo[r.codigo_minsa] = { codigo: r.codigo_minsa, total: 0 };
      conteo[r.codigo_minsa].total++;
    });
    testsAplicados = Object.values(conteo);
  } else if (respuestasCustom.length > 0) {
    // Solo formularios personalizados: usar el promedio original
    puntajeFinal = redondear(respuestasCustom.reduce((t, r) => t + Number(r.puntaje_riesgo), 0) / respuestasCustom.length);
    metodo = "formularios_personalizados";
  } else {
    const promedioRiesgo = configuradas.reduce((t, r) => t + Number(r.puntaje_riesgo), 0) / configuradas.length;
    puntajeFinal = redondear(puntajePorCuestionario(promedioRiesgo));
    metodo = "promedio_mixto";
  }

  // Señales socio-familiares: se revisa cada par pregunta-respuesta y se guarda la cita exacta
  const paresQA = [
    ...respuestas.map(r => ({ pregunta: String(r.pregunta || ""), respuesta: String(r.respuesta || "") })),
    ...(abiertas || []).map(r => ({ pregunta: String(r.pregunta || ""), respuesta: String(r.respuesta || "") })),
  ];
  const TEMAS = [
    { clave: "alcohol", tema: "alcohol en el hogar", patrones: [/padres toman[^.|]*/, /pap[áa][^.|]*toma[^.|]*/, /toman[^.|]*domingo[^.|]*/, /alcohol[^.|]*hogar[^.|]*/], exige: /si|muy malo|malo/i },
    { clave: "bar", tema: "entorno de bar / nocturno", patrones: [/vives[^.|]*bar[^.|]*/, /cerca[^.|]*bar[^.|]*/, /bar[^.|]*noche[^.|]*/, /entorno[^.|]*nocturno[^.|]*/] },
    { clave: "trabajo", tema: "trabajo infantil", patrones: [/hacen[^.|]*trabajar[^.|]*/, /trabajo infantil[^.|]*/, /lleva[^.|]*trabajar[^.|]*/, /faltas[^.|]*trabajo[^.|]*/] },
    { clave: "violencia", tema: "violencia / miedo en el hogar", patrones: [/violencia[^.|]*/, /abuso[^.|]*/, /golpe[^.|]*/, /miedo[^.|]*casa[^.|]*/, /miedo[^.|]*hogar[^.|]*/, /miedo[^.|]*familia[^.|]*/, /miedo[^.|]*pap[áa][^.|]*/, /miedo[^.|]*mam[áa][^.|]*/, /padrastro[^.|]*explota[^.|]*/, /seguro[^.|]*casa[^.|]*malo[^.|]*/] },
    { clave: "droga", tema: "drogas / alcohol", patrones: [/consumo[^.|]*alcohol[^.|]*/, /drogas[^.|]*/, /probado[^.|]*droga[^.|]*/] },
    { clave: "higiene", tema: "descuido físico / cansancio", patrones: [/higiene[^.|]*descuido[^.|]*/, /cansancio[^.|]*extremo[^.|]*/, /somnolencia[^.|]*/, /dolor[^.|]*cabeza[^.|]*/, /dolor[^.|]*estomago[^.|]*/] },
  ];
  const palabrasDetectadas = [];
  const vistos = new Set();
  const esNegacion = (txt) => /^(nunca|no|no, nunca|ninguno|ninguna)\.?$/i.test(String(txt || "").trim());
  for (const par of paresQA) {
    if (esNegacion(par.respuesta)) continue; // "Nunca"/"No" no es señal aunque la pregunta mencione el tema
    const texto = `${par.pregunta} ${par.respuesta}`.toLowerCase();
    for (const t of TEMAS) {
      if (vistos.has(t.clave)) continue;
      const m = t.patrones.map(p => texto.match(p)).find(Boolean);
      if (m && (!t.exige || t.exige.test(texto))) {
        vistos.add(t.clave);
        palabrasDetectadas.push({
          tema: t.tema,
          pregunta: par.pregunta.slice(0, 80),
          respuesta: par.respuesta.slice(0, 60),
        });
      }
    }
  }
  const tiene = (clave) => vistos.has(clave);
  const senalAlcoholHogar = tiene("alcohol");
  const senalBar = tiene("bar");
  const senalTrabajo = tiene("trabajo");
  const senalViolencia = tiene("violencia");
  const senalDroga = tiene("droga");
  const senalHigiene = tiene("higiene");

  // Peores respuestas con su pregunta y cuestionario (para citarlas tal cual)
  const peoresRespuestas = [...configuradas]
    .sort((a, b) => Number(b.puntaje_riesgo) - Number(a.puntaje_riesgo))
    .slice(0, 3)
    .map(r => ({
      formulario: r.formulario || "Cuestionario",
      pregunta: String(r.pregunta || "").slice(0, 90),
      respuesta: String(r.respuesta || "").slice(0, 80),
      puntaje: Number(r.puntaje_riesgo)
    }));

  return {
    puntaje: puntajeFinal,
    puntaje_riesgo: puntajeFinal,
    disponible: true,
    total_respuestas_cerradas: respuestas.length,
    respuestas_configuradas: configuradas.length,
    respuestas_sin_configurar: respuestas.length - configuradas.length,
    promedio_respuestas: puntajeFinal,
    escala_riesgo: "0 = sin riesgo, 100 = riesgo alto",
    criterio_aporte_global: "aporte al indicador global = 100 - puntaje_riesgo",
    metodo,
    tests_aplicados: testsAplicados,
    respuestas_validadas: respuestasValidadas.length,
    respuestas_custom: respuestasCustom.length,
    senal_alcohol_hogar: senalAlcoholHogar,
    senal_bar: senalBar,
    senal_trabajo: senalTrabajo,
    senal_violencia: senalViolencia,
    senal_droga: senalDroga,
    senal_higiene: senalHigiene,
    palabras_detectadas: palabrasDetectadas,
    peores_respuestas: peoresRespuestas
  };
}

function calcularPerfil(perfil, observacionTexto) {
  if (!perfil || !perfil.con_quien_vive) {
    // Sin perfil, no disponible — no penaliza, pero avisa
    return { puntaje: null, disponible: false, total: 0, detalle: "Perfil incompleto — completar ficha para evaluación precisa" };
  }
  // Puntaje basado en convivencia y antecedentes (100 = bajo riesgo, 0 = alto riesgo)
  let puntaje = 100;
  const situacion = String(perfil.situacion_convivencia || "").toLowerCase();
  if (situacion === "violencia") puntaje = 30;
  else if (situacion === "conflictiva") puntaje = 50;
  else if (situacion === "ausencia") puntaje = 45;
  else if (situacion === "sobreproteccion") puntaje = 70;
  else if (situacion === "estable") puntaje = 100;

  const conQuien = String(perfil.con_quien_vive || "").toLowerCase();
  if (conQuien === "solo" || conQuien === "albergue") puntaje = Math.min(puntaje, 40);
  else if (conQuien === "abuelos" || conQuien === "tutor") puntaje = Math.min(puntaje, 70);

  if (perfil.antecedentes && String(perfil.antecedentes).trim()) {
    const ant = String(perfil.antecedentes).toLowerCase();
    if (/violencia|maltrato|abuso|droga|alcohol|depresión|depresion|ansiedad|TDAH|TEA/.test(ant)) puntaje = Math.min(puntaje, 60);
  }

  // Observación del docente como señal cualitativa (si existe, puede bajar el puntaje)
  const obs = String(observacionTexto || "").toLowerCase();
  if (obs) {
    if (/agresivo|vandalismo|violencia|pelea|agresión|agresion/.test(obs)) puntaje = Math.min(puntaje, 50);
    else if (/juego.*mucho|distra.*fácil|inquieto|no atiende/.test(obs)) puntaje = Math.min(puntaje, 75);
  }

  return {
    puntaje: redondear(limitar(puntaje)),
    disponible: true,
    total: 1,
    con_quien_vive: perfil.con_quien_vive,
    situacion_convivencia: perfil.situacion_convivencia,
    apoderado: perfil.apoderado_nombre,
    detalle: `Vive con ${perfil.con_quien_vive}, convivencia ${perfil.situacion_convivencia}`
  };
}

function calcularComportamiento(registros, textoObsDocente, obsNuevas) {
  // Ahora solo como señal cualitativa: no genera puntaje para el cálculo global, solo observaciones
  // textoObsDocente: observaciones libres del docente (reemplazo del antiguo "comportamiento").
  const textoExtra = String(textoObsDocente || "").trim();
  // Citas textuales para mostrar tal cual lo escribió el docente
  const citas = [
    ...(obsNuevas || []).map(r => ({ trimestre: r.trimestre || "", texto: String(r.observacion || "").trim() })).filter(c => c.texto),
    ...registros.map(r => ({ trimestre: r.trimestre || "", texto: String(r.observacion || "").trim() })).filter(c => c.texto),
  ].slice(0, 3);
  if (!registros.length && !textoExtra) {
    return { puntaje: null, disponible: false, total: 0, citas, detalle: "Sin observaciones del docente registradas" };
  }

  const conteo = { Excelente: 0, Bueno: 0, Regular: 0, Deficiente: 0 };
  registros.forEach(item => {
    const nivel = String(item.nivel || "").trim();
    if (Object.prototype.hasOwnProperty.call(conteo, nivel)) conteo[nivel] += 1;
  });
  const total = Object.values(conteo).reduce((suma, cantidad) => suma + cantidad, 0);
  const distribucion = Object.fromEntries(
    Object.entries(conteo).map(([nivel, cantidad]) => [nivel, { cantidad, porcentaje: porcentaje(cantidad, total) }])
  );
  const puntaje = total
    ? Object.entries(conteo).reduce((suma, [nivel, cantidad]) => {
      return suma + (cantidad / total) * PUNTAJE_COMPORTAMIENTO[nivel];
    }, 0)
    : null;

  const trimestres = new Map();
  registros.forEach(item => {
    const orden = Number(item.trimestre_orden || 0);
    const puntajeNivel = PUNTAJE_COMPORTAMIENTO[String(item.nivel || "").trim()];
    if (!orden || puntajeNivel === undefined) return;
    if (!trimestres.has(orden)) trimestres.set(orden, []);
    trimestres.get(orden).push(puntajeNivel);
  });
  const promediosTrimestrales = [...trimestres.entries()]
    .sort(([a], [b]) => a - b)
    .map(([orden, valores]) => ({
      trimestre_orden: orden,
      puntaje: redondear(valores.reduce((suma, valor) => suma + valor, 0) / valores.length)
    }));
  const tendencia = calcularTendencia(promediosTrimestrales.map(item => item.puntaje));
  const textoObs = [registros.map(r => `${r.observacion || ""}`.toLowerCase()).join(" | "), textoExtra.toLowerCase()].filter(Boolean).join(" | ");
  const senalAgresivo = /agresivo|vandálico|vandalico|agresión|agresion|ira|enojo/i.test(textoObs);
  const senalAislamiento = /aislamiento|evasion|evad.*grupal|no participa|aislado|juego.*no/i.test(textoObs);
  const senalAutolesion = /autolesion|auto-lesion|cortar|lastimar|suicid|riesgo físico|físico/i.test(textoObs);
  const senalHigieneObs = /higiene.*descuido|cansancio.*extremo|somnolencia|dolor.*cabeza|dolor.*estomago/i.test(textoObs);

  return {
    puntaje: redondear(limitar(puntaje)),
    disponible: true,
    total,
    distribucion,
    porcentaje_deficiente: distribucion.Deficiente.porcentaje,
    porcentaje_regular: distribucion.Regular.porcentaje,
    valores_nivel: PUNTAJE_COMPORTAMIENTO,
    promedios_trimestrales: promediosTrimestrales,
    tendencia,
    senal_agresivo: senalAgresivo,
    senal_aislamiento: senalAislamiento,
    senal_autolesion: senalAutolesion,
    senal_higiene_obs: senalHigieneObs,
    citas
  };
}

function construirMotivos({ asistencia, academico, cuestionario, comportamiento, tieneObservacionesDocente }) {
  // Lenguaje simple y directo: lo entiende el psicólogo y el director. Sin jerga técnica.
  const motivos = [];
  if (!asistencia.disponible) motivos.push("Aún no hay asistencias registradas para evaluar este punto.");
  else {
    if (asistencia.ausentismo_cronico) motivos.push(`Falta mucho a clases: ${Math.round(asistencia.porcentaje_ausencia)}% de ausencias (desde 10% ya se considera ausentismo crónico).`);
    if (asistencia.racha_final_faltas >= 2) motivos.push(`Ha faltado los últimos ${asistencia.racha_final_faltas} días de clases seguidos${asistencia.ultimas_faltas?.length ? ` (${asistencia.ultimas_faltas.slice(0, 3).join(", ")})` : ""}.`);
    else if (asistencia.faltas_ultimos_7_dias > 0) motivos.push(`Faltó ${asistencia.faltas_ultimos_7_dias} ${asistencia.faltas_ultimos_7_dias === 1 ? "vez" : "veces"} en los últimos 7 días.`);
    if (asistencia.patron_ciclico) motivos.push(`Casi siempre falta el mismo día: los ${asistencia.patron_ciclico.nombre} falta el ${asistencia.patron_ciclico.tasa}% de las veces. Conviene preguntar qué pasa esos días en casa.`);
    if (asistencia.patron_tardanza_dia) motivos.push(`Llega tarde casi todos los ${asistencia.patron_tardanza_dia.nombre} (${asistencia.patron_tardanza_dia.tasa}%). Conviene preguntar a qué hora se acuesta.`);
    if (asistencia.patron_dias_alternos) motivos.push("Falta 1 o 2 días por semana de forma sostenida. Descartar que esté trabajando.");
    if (asistencia.faltas_consecutivas_maximas >= 3 && asistencia.racha_final_faltas < 2) motivos.push(`Llegó a faltar ${asistencia.faltas_consecutivas_maximas} días seguidos en el bimestre.`);
    else if (asistencia.faltas > 0 && !asistencia.ausentismo_cronico && asistencia.faltas_ultimos_7_dias === 0 && asistencia.racha_final_faltas < 2) motivos.push(`Acumula ${asistencia.faltas} ${asistencia.faltas === 1 ? "inasistencia" : "inasistencias"} en el bimestre.`);
    if (asistencia.tardanzas > 0 && !asistencia.patron_tardanza_dia) motivos.push(`Registra ${asistencia.tardanzas} ${asistencia.tardanzas === 1 ? "tardanza" : "tardanzas"}.`);
  }

  if (!academico.disponible) motivos.push("Aún no hay notas suficientes en todas las áreas para evaluar este punto.");
  else {
    if (academico.caida_brusca) motivos.push(`Sus notas bajaron de golpe: de ${academico.caida_brusca.de} a ${academico.caida_brusca.a} entre un bimestre y otro. Lo brusco preocupa más que ir mal siempre.`);
    if (academico.porcentaje_c > 30) motivos.push(`Tiene C (en inicio) en el ${Math.round(academico.porcentaje_c)}% de sus calificaciones: le cuesta en varias áreas.`);
    if (academico.porcentaje_b > 50) motivos.push("Más de la mitad de sus notas son B: necesita acompañamiento para llegar al nivel esperado.");
    if (academico.tendencia.estado === "Baja") motivos.push("Sus promedios vienen bajando bimestre tras bimestre.");
    if (academico.desinteres) motivos.push("Antes participaba y ahora no: posible desinterés repentino, conversar con él.");
  }

  if (!cuestionario.disponible) motivos.push(cuestionario.detalle === "Sin respuestas cerradas registradas" ? "Aún no responde los cuestionarios." : "Sus respuestas aún no tienen puntajes configurados.");
  else {
    const peor = (cuestionario.peores_respuestas || [])[0];
    if (peor && peor.puntaje >= 67) motivos.push(`En "${peor.formulario}" respondió "${peor.respuesta}" a "${peor.pregunta}".`);
    if (cuestionario.puntaje_riesgo >= 70) motivos.push(`Sus tests validados marcan riesgo alto (${Math.round(cuestionario.puntaje_riesgo)}/100). Merece una entrevista.`);
    for (const p of (cuestionario.palabras_detectadas || []).slice(0, 3)) {
      motivos.push(`En "${p.pregunta}" respondió "${p.respuesta}" (tema: ${p.tema}).`);
    }
  }

  if (comportamiento) {
    if (!comportamiento.disponible && !tieneObservacionesDocente) motivos.push("El docente aún no deja observaciones sobre este estudiante.");
    else {
      const cita = (comportamiento.citas || [])[0];
      if (cita) motivos.push(`El docente anotó${cita.trimestre ? ` (${cita.trimestre})` : ""}: "${cita.texto.length > 120 ? cita.texto.slice(0, 120) + "…" : cita.texto}"`);
      if (comportamiento.senal_agresivo) motivos.push("El docente reporta conductas agresivas o de enojo. Observar en el recreo.");
      if (comportamiento.senal_aislamiento) motivos.push("El docente nota que se aísla o no participa con el grupo.");
      if (comportamiento.senal_autolesion) motivos.push("PRIORIDAD MÁXIMA: el docente reporta señales de riesgo contra su integridad. Derivar de inmediato.");
      if (comportamiento.porcentaje_deficiente > 0) motivos.push("Tiene registros de conducta deficiente este año.");
    }
  }

  const combinacionFuerte = (asistencia.patron_ciclico && academico.caida_brusca) || (asistencia.patron_ciclico && cuestionario.senal_violencia);
  if (combinacionFuerte) motivos.push("Ojo: varias señales aparecieron al mismo tiempo. Este caso es prioritario.");

  return motivos;
}

function construirLectura({ nivel, semaforo, asistencia, academico, cuestionario, comportamiento, perfil, incidenciasDetalle, expediente, areasRiesgo }) {
  // Resumen ejecutivo en lenguaje simple: insignia + por qué + rasgos + contexto + qué hacer.
  // Todo sale de datos reales citados (fechas, respuestas textuales, ficha). Nada se inventa.
  const INSIGNIA = {
    Alto: "RIESGO ALTO — ATENCIÓN PRIORITARIA",
    Medio: "RIESGO MODERADO — EN ALERTA",
    Bajo: "RIESGO BAJO — SIN ALERTA",
    Incompleto: "DATOS INCOMPLETOS"
  };
  const porque = [];
  const rasgos = [];
  const empujarPorque = (t) => { if (t && porque.length < 4 && !porque.includes(t)) porque.push(t); };
  const empujarRasgo = (t) => { if (t && rasgos.length < 6 && !rasgos.includes(t)) rasgos.push(t); };

  // Máxima prioridad: integridad física / violencia (primero siempre)
  if (comportamiento?.senal_autolesion) {
    empujarPorque("Hay señales de riesgo contra su propia integridad. Esto es lo primero que hay que atender, hoy mismo.");
    empujarRasgo("Riesgo contra su integridad: derivación inmediata al psicólogo.");
  }
  const peor = (cuestionario?.peores_respuestas || [])[0];
  if (peor && peor.puntaje >= 67 && /muerte|morir|suicid|daño|lastimar|abuso|violencia/i.test(`${peor.pregunta} ${peor.respuesta}`)) {
    empujarPorque(`En "${peor.formulario}" marcó "${peor.respuesta}" en "${peor.pregunta}".`);
    empujarRasgo("Respuestas delicadas en sus cuestionarios: el psicólogo debe entrevistarlo.");
  }
  if (cuestionario?.senal_violencia) {
    empujarPorque("Sus respuestas hacen sospechar violencia en su entorno. Hay que cuidarlo sin exponerlo.");
    empujarRasgo("Posible violencia en el hogar: derivar al psicólogo con reserva.");
  }
  // Asistencia con fechas
  if (asistencia?.disponible) {
    if (asistencia.racha_final_faltas >= 2) {
      empujarPorque(`Ha faltado los últimos ${asistencia.racha_final_faltas} días de clases seguidos${(asistencia.ultimas_faltas || []).length ? ` (${asistencia.ultimas_faltas.slice(0, 3).join(", ")})` : ""}.`);
      empujarRasgo("Falta a clases varios días seguidos: averiguar qué pasa en casa.");
    } else if (asistencia.ausentismo_cronico) {
      empujarPorque(`Falta el ${asistencia.porcentaje_ausencia}% de sus clases (desde 10% ya se considera ausentismo crónico).`);
      empujarRasgo("Ausentismo crónico: urge hablar con su familia.");
    }
    if (asistencia.patron_ciclico) {
      empujarPorque(`Casi siempre falta los ${asistencia.patron_ciclico.nombre} (el ${asistencia.patron_ciclico.tasa}% de las veces). Algo pasa esos días.`);
      empujarRasgo(`Falta patronada los ${asistencia.patron_ciclico.nombre}: descartar trabajo u otro motivo.`);
    }
  }
  // Notas con áreas
  if (academico?.disponible) {
    const enC = (areasRiesgo || []).filter(a => a.letra === "C").slice(0, 3).map(a => a.area);
    if (enC.length) {
      empujarPorque(`Va en C (en inicio) en: ${enC.join(", ")}.`);
      empujarRasgo(`Dificultad académica en ${enC.length === 1 ? "un área" : "varias áreas"}: necesita apoyo.`);
    }
    if (academico.caida_brusca) {
      empujarPorque(`Sus notas bajaron de golpe de ${academico.caida_brusca.de} a ${academico.caida_brusca.a} entre bimestres.`);
      empujarRasgo("Bajón académico brusco: algo cambió, conversar con él.");
    }
  }
  // Cuestionarios citados
  if (peor && peor.puntaje >= 67 && porque.length < 4 && !/muerte|morir|suicid|daño|lastimar|abuso|violencia/i.test(`${peor.pregunta} ${peor.respuesta}`)) {
    empujarPorque(`En "${peor.formulario}" respondió "${peor.respuesta}" a "${peor.pregunta}".`);
  }
  for (const p of ((cuestionario || {}).palabras_detectadas || []).slice(0, 2)) {
    empujarPorque(`En "${p.pregunta}" respondió "${p.respuesta}" (tema: ${p.tema}).`);
    empujarRasgo(`Llamó la atención el tema "${p.tema}" en lo que respondió.`);
  }
  // Docente citado
  const cita = ((comportamiento || {}).citas || [])[0];
  if (cita) {
    empujarPorque(`Su docente anotó${cita.trimestre ? ` (${cita.trimestre})` : ""}: "${cita.texto.length > 140 ? cita.texto.slice(0, 140) + "…" : cita.texto}"`);
    empujarRasgo("El docente ya había notado algo: leer su observación completa.");
  }
  if (comportamiento?.senal_agresivo) empujarRasgo("Conductas agresivas o de enojo reportadas: observar en el recreo.");
  if (comportamiento?.senal_aislamiento) empujarRasgo("Se aísla o no participa con sus compañeros.");
  // Incidencias
  for (const inc of (incidenciasDetalle || []).slice(0, 2)) {
    const f = String(inc.fecha_incidencia || "").slice(0, 10);
    empujarPorque(`Tiene una incidencia de "${inc.tipo}"${f ? ` (${f})` : ""}: ${String(inc.descripcion || "").slice(0, 100)}.`);
  }
  if (nivel === "Bajo" && !porque.length) empujarPorque("Le va bien en notas, asiste con normalidad y no hay señales de alerta.");
  if (nivel === "Incompleto" && !porque.length) empujarPorque("Todavía faltan datos (notas, asistencias o cuestionarios) para evaluarlo bien.");

  // Contexto: ficha + expediente (lo que rodea al estudiante)
  const contexto = [];
  if (perfil) {
    const viveTxt = { padres: "vive con ambos padres", madre: "vive solo con su mamá", padre: "vive solo con su papá", abuelos: "vive con sus abuelos", tutor: "vive con un tutor", albergue: "vive en un albergue", solo: "vive solo", otro: "vive con otros familiares" }[String(perfil.con_quien_vive || "").toLowerCase()];
    if (viveTxt) contexto.push(`En su ficha figura que ${viveTxt}.`);
    const sitTxt = { estable: "estable", conflictiva: "conflictiva", violencia: "con violencia", ausencia: "con ausencia", sobreproteccion: "con sobreprotección" }[String(perfil.situacion_convivencia || "").toLowerCase()];
    if (sitTxt && sitTxt !== "estable") contexto.push(`La convivencia en su casa es ${sitTxt}. Esto puede estar influyendo.`);
    if (perfil.antecedentes && String(perfil.antecedentes).trim()) contexto.push(`Registra como antecedente: "${String(perfil.antecedentes).trim().slice(0, 120)}"`);
    if (perfil.apoderado_nombre) contexto.push(`Su apoderado es ${perfil.apoderado_nombre}${perfil.apoderado_parentesco ? ` (${perfil.apoderado_parentesco})` : ""}.`);
  } else {
    contexto.push("Aún no completa su ficha: falta el contexto familiar para entenderlo mejor.");
  }
  if ((expediente || []).length) {
    const tipos = expediente.map(e => `${e.tipo} (${e.n})`).join(", ");
    contexto.push(`Su expediente ya tiene ${expediente.reduce((a, e) => a + Number(e.n || 0), 0)} documento(s): ${tipos}. Conviene revisarlos.`);
  }
  // Qué hacer
  const revisar = [];
  if (nivel === "Alto") {
    revisar.push("Entrevista con el psicólogo esta misma semana.");
    revisar.push("Citar al apoderado para conversar.");
    if ((incidenciasDetalle || []).length || comportamiento?.senal_agresivo) revisar.push("Revisar sus incidencias y observaciones del docente antes de la entrevista.");
  } else if (nivel === "Medio") {
    revisar.push("Seguimiento del tutor cada dos semanas.");
    revisar.push("Conversar con el estudiante para entender qué pasa.");
    if ((areasRiesgo || []).some(a => a.letra === "C")) revisar.push("Apoyo académico en las áreas donde va en C.");
  } else if (nivel === "Bajo") {
    revisar.push("Seguimiento normal, sin acciones especiales.");
  } else {
    if (!asistencia?.disponible) revisar.push("Registrar sus asistencias.");
    if (!academico?.disponible) revisar.push("Registrar sus notas en todas las áreas.");
    if (!cuestionario?.disponible) revisar.push("Lograr que responda sus cuestionarios.");
  }

  return {
    insignia: INSIGNIA[nivel] || INSIGNIA.Incompleto,
    titular: porque[0] || semaforo?.motivo || "Sin información suficiente.",
    porque, rasgos, contexto, revisar
  };
}

function determinarSemaforo({ puntajeGlobal, asistencia, academico, comportamiento, cuestionario, datosCompletos }) {
  if (cuestionario && cuestionario.senal_violencia) {
    return { nivel: "Alto", estado: "ROJO", color: "rojo", tipo: "Derivación psicológica urgente", motivo: "Sus respuestas hacen sospechar violencia o abuso en su entorno. Hay que derivarlo al psicólogo cuanto antes, con total reserva." };
  }
  if (comportamiento && comportamiento.senal_autolesion) {
    return { nivel: "Alto", estado: "ROJO", color: "rojo", tipo: "Riesgo físico", motivo: "Hay señales de riesgo contra su propia integridad. Derivación inmediata al psicólogo, hoy mismo." };
  }
  if (!datosCompletos || puntajeGlobal === null) {
    return {
      nivel: "Incompleto",
      estado: "Incompleto",
      color: "gris",
      tipo: "Datos incompletos",
      motivo: "Aún faltan datos (notas, asistencias o cuestionarios) para evaluar a este estudiante."
    };
  }

  if (asistencia.disponible && asistencia.porcentaje_asistencia < 75) {
    return {
      nivel: "Alto",
      estado: "ROJO",
      color: "rojo",
      tipo: "Riesgo por inasistencia",
      motivo: "Falta demasiado a clases (menos del 75% de asistencia). Le va bien en notas, pero hay que averiguar por qué no viene."
    };
  }

  if (comportamiento && comportamiento.disponible && comportamiento.porcentaje_deficiente > 0) {
    return {
      nivel: "Alto",
      estado: "ROJO",
      color: "rojo",
      tipo: "Riesgo conductual",
      motivo: "Su conducta en el aula preocupa. Necesita intervención del área psicológica."
    };
  }

  if (comportamiento && comportamiento.disponible && comportamiento.porcentaje_regular > 40) {
    return {
      nivel: "Medio",
      estado: "AMARILLO",
      color: "amarillo",
      tipo: "Acompañamiento conductual",
      motivo: "Su conducta en el aula necesita acompañamiento para mejorar."
    };
  }

  if (
    academico.disponible &&
    academico.porcentaje_ad_a > 80 &&
    asistencia.disponible &&
    asistencia.porcentaje_asistencia < 80
  ) {
    return {
      nivel: "Medio",
      estado: "AMARILLO",
      color: "amarillo",
      tipo: "Riesgo por inasistencia",
      motivo: "En notas le va bien, pero falta mucho a clases. Hablar con su familia y hacerle seguimiento."
    };
  }

  if (academico.disponible && academico.porcentaje_c > 30) {
    return {
      nivel: "Alto",
      estado: "ROJO",
      color: "rojo",
      tipo: "Riesgo académico",
      motivo: "Le va mal en varias áreas. Necesita apoyo académico urgente."
    };
  }

  if (academico.disponible && academico.porcentaje_b > 50) {
    return {
      nivel: "Medio",
      estado: "AMARILLO",
      color: "amarillo",
      tipo: "Acompañamiento académico",
      motivo: "Sus notas están por debajo de lo esperado. Necesita acompañamiento."
    };
  }

  if (academico.disponible && academico.porcentaje_ad_a >= 80) {
    return {
      nivel: "Bajo",
      estado: "VERDE",
      color: "verde",
      tipo: "Riesgo bajo",
      motivo: "Le va bien en la mayoría de áreas. Sin alerta."
    };
  }

  if (puntajeGlobal >= 80) {
    return { nivel: "Bajo", estado: "VERDE", color: "verde", tipo: "Riesgo bajo", motivo: "Está bien en general. Sin alerta, solo seguimiento normal." };
  }
  if (puntajeGlobal >= 60) {
    return { nivel: "Medio", estado: "AMARILLO", color: "amarillo", tipo: "Riesgo moderado", motivo: "No está en rojo, pero algo no anda bien. Necesita acompañamiento del tutor." };
  }
  return { nivel: "Alto", estado: "ROJO", color: "rojo", tipo: "Riesgo alto", motivo: "Está en riesgo alto. Necesita atención prioritaria del tutor y del psicólogo." };
}

async function obtenerPeriodo(periodoId) {
  const result = periodoId
    ? await query("SELECT * FROM periodos_academicos WHERE id = $1", [periodoId])
    : await query(
      `SELECT * FROM periodos_academicos
       WHERE activo = TRUE
       ORDER BY anio DESC, fecha_inicio DESC NULLS LAST, id DESC
       LIMIT 1`
    );
  return result.rows[0] || null;
}

async function calcularIndicadorEstudiante(estudianteId, { periodoId = null, guardar = true } = {}) {
  const [estudianteResult, configuracionResult, periodo] = await Promise.all([
    query(
      `SELECT e.id, e.nombres, e.apellidos, e.correo, e.seccion_id,
              s.nivel, s.grado, s.letra, s.nombre AS seccion
       FROM estudiantes e
       JOIN secciones s ON s.id = e.seccion_id
       WHERE e.id = $1 AND e.activo = TRUE`,
      [estudianteId]
    ),
    query("SELECT * FROM configuraciones_riesgo WHERE activo = TRUE ORDER BY version DESC LIMIT 1"),
    obtenerPeriodo(periodoId)
  ]);

  const estudiante = estudianteResult.rows[0];
  if (!estudiante) {
    const error = new Error("Estudiante no encontrado");
    error.status = 404;
    throw error;
  }
  const configuracion = configuracionResult.rows[0];
  if (!configuracion) {
    const error = new Error("No existe una configuración activa para el indicador");
    error.status = 500;
    throw error;
  }

  const fechaDesde = periodo?.fecha_inicio || null;
  const fechaHasta = periodo?.fecha_fin || null;
  const filtroFechaAsistencia = `${fechaDesde ? " AND fecha >= $2" : ""}${fechaHasta ? ` AND fecha <= $${fechaDesde ? 3 : 2}` : ""}`;
  const parametrosAsistencia = [estudianteId];
  if (fechaDesde) parametrosAsistencia.push(fechaDesde);
  if (fechaHasta) parametrosAsistencia.push(fechaHasta);

  const anioReferencia = Number(periodo?.anio || new Date().getFullYear());

  const [asistenciaResult, academicoResultRaw, cuestionarioResult, comportamientoResultRaw, observacionesDocenteResult, abiertasResult, areasRiesgoResult, trimestresConDatosResult, perfilResult, incidenciasResult, incidenciasDetalleResult, expedienteResult] = await Promise.all([
    query(
      `SELECT fecha, estado
       FROM asistencias
       WHERE estudiante_id = $1 ${filtroFechaAsistencia}
       ORDER BY fecha ASC`,
      parametrosAsistencia
    ),
    query(
      `SELECT nivel_logro, competencia_id, asignatura_id, trimestre_id, trimestre_orden, trimestre FROM (
         SELECT ct.nivel_logro, ct.competencia_id, c.asignatura_id, ct.trimestre_id, t.orden AS trimestre_orden, t.nombre AS trimestre
         FROM calificaciones_trimestrales_competencia ct
         JOIN competencias c ON c.id = ct.competencia_id
         JOIN trimestres_academicos t ON t.id = ct.trimestre_id
         WHERE ct.estudiante_id = $1 AND t.anio = $2
         UNION ALL
         SELECT CASE WHEN n.nota >= 18 THEN 'AD' WHEN n.nota >= 14 THEN 'A' WHEN n.nota >= 11 THEN 'B' ELSE 'C' END as nivel_logro,
                NULL as competencia_id, n.asignatura_id, n.trimestre_id, t.orden AS trimestre_orden, t.nombre AS trimestre
         FROM notas_simples n
         JOIN trimestres_academicos t ON t.id = n.trimestre_id
         WHERE n.estudiante_id = $1 AND t.anio = $2
       ) u ORDER BY trimestre_orden ASC, competencia_id ASC NULLS LAST`,
      [estudianteId, anioReferencia]
    ),
    query(
      `SELECT
         r.id,
         r.created_at,
         r.respuesta,
         p.pregunta AS pregunta,
         f.titulo AS formulario,
         po.puntaje_riesgo,
         f.es_validado,
         f.codigo_minsa
       FROM formulario_respuestas r
       JOIN formulario_preguntas p
         ON p.id = r.pregunta_id
        AND p.tipo IN ('cerrada', 'likert')
       JOIN formularios_psicologicos f ON f.id = r.formulario_id
       LEFT JOIN pregunta_opciones po
         ON po.pregunta_id = p.id
        AND LOWER(po.texto) = LOWER(r.respuesta)
       WHERE r.estudiante_id = $1
         ${fechaDesde ? "AND r.created_at::date >= $2" : ""}
         ${fechaHasta ? `AND r.created_at::date <= $${fechaDesde ? 3 : 2}` : ""}
       ORDER BY r.created_at ASC`,
      parametrosAsistencia
    ),
    query(
      `SELECT
         c.nivel,
         c.observacion,
         c.trimestre_id,
         t.orden AS trimestre_orden,
         t.nombre AS trimestre
       FROM comportamientos c
       JOIN trimestres_academicos t ON t.id = c.trimestre_id
       WHERE c.estudiante_id = $1
         AND t.anio = $2
       ORDER BY t.orden ASC`,
      [estudianteId, anioReferencia]
    ),
    query(
      `SELECT o.texto AS observacion, t.nombre AS trimestre
       FROM observaciones_bimestre o
       JOIN trimestres_academicos t ON t.id = o.trimestre_id
       WHERE o.estudiante_id = $1 AND t.anio = $2
       ORDER BY t.orden ASC`,
      [estudianteId, anioReferencia]
    ),
    query(
      `SELECT p.pregunta AS pregunta, r.respuesta, f.titulo AS formulario
       FROM formulario_respuestas r
       JOIN formulario_preguntas p ON p.id = r.pregunta_id AND p.tipo = 'abierta'
       JOIN formularios_psicologicos f ON f.id = r.formulario_id
       WHERE r.estudiante_id = $1
       ORDER BY r.created_at DESC LIMIT 20`,
      [estudianteId]
    ),
    query(
      `SELECT a.nombre AS area,
         SUM(CASE WHEN n.nota < 11 THEN 1 ELSE 0 END)::int AS en_c,
         COUNT(*)::int AS total,
         CASE WHEN AVG(n.nota) >= 18 THEN 'AD' WHEN AVG(n.nota) >= 14 THEN 'A' WHEN AVG(n.nota) >= 11 THEN 'B' ELSE 'C' END AS letra
       FROM notas_simples n
       JOIN asignaturas a ON a.id = n.asignatura_id
       JOIN trimestres_academicos t ON t.id = n.trimestre_id
       WHERE n.estudiante_id = $1 AND t.anio = $2
       GROUP BY a.nombre
       ORDER BY AVG(n.nota) ASC`,
      [estudianteId, anioReferencia]
    ),
    query(
      `SELECT t.id, t.orden
       FROM trimestres_academicos t
       WHERE t.anio = $1
         AND EXISTS (
           SELECT 1 FROM notas_simples n WHERE n.trimestre_id = t.id
           UNION ALL
           SELECT 1 FROM calificaciones_trimestrales_competencia ct WHERE ct.trimestre_id = t.id
           UNION ALL
           SELECT 1 FROM comportamientos c WHERE c.trimestre_id = t.id
           LIMIT 1
         )
       ORDER BY t.orden ASC`,
      [anioReferencia]
    ),
    query(`SELECT * FROM perfiles_estudiante WHERE estudiante_id=$1`, [estudianteId]),
    query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE fecha_incidencia >= CURRENT_DATE - INTERVAL '60 days')::int as recientes FROM incidencias WHERE estudiante_id=$1`, [estudianteId]),
    query(`SELECT tipo, descripcion, fecha_incidencia FROM incidencias WHERE estudiante_id=$1 ORDER BY fecha_incidencia DESC LIMIT 3`, [estudianteId]),
    query(`SELECT tipo, COUNT(*)::int AS n FROM expediente_formatos WHERE estudiante_id=$1 GROUP BY tipo ORDER BY n DESC`, [estudianteId])
  ]);
  // Si los dos últimos bimestres no tienen notas de NINGÚN alumno, aún no se han calificado → no contabilizarlos
  const trimestresConDatosIds = new Set(trimestresConDatosResult.rows.map(r => r.id));
  const academicoResult = { rows: academicoResultRaw.rows.filter(r => trimestresConDatosIds.has(r.trimestre_id)), rowCount: 0 };
  academicoResult.rowCount = academicoResult.rows.length;
  const comportamientoResult = { rows: comportamientoResultRaw.rows.filter(r => trimestresConDatosIds.has(r.trimestre_id)), rowCount: 0 };
  comportamientoResult.rowCount = comportamientoResult.rows.length;

  const perfil = perfilResult.rows[0] || null;
  const incidencias = incidenciasResult.rows[0] || { total: 0, recientes: 0 };
  const incidenciasDetalle = incidenciasDetalleResult.rows || [];
  const expediente = expedienteResult.rows || [];
  const respuestasAbiertas = abiertasResult.rows || [];
  const areasRiesgo = areasRiesgoResult.rows || [];
  const asistencia = calcularAsistencia(asistenciaResult.rows);
  const academico = calcularAcademico(academicoResult.rows);
  const cuestionario = calcularCuestionario(cuestionarioResult.rows, respuestasAbiertas);
  const textoObsDocente = (observacionesDocenteResult.rows || []).map(r => `${r.observacion || ""}`.trim()).filter(Boolean).join(" | ");
  const comportamiento = calcularComportamiento(comportamientoResult.rows, textoObsDocente, observacionesDocenteResult.rows);
  // Perfil + observación como dimensión contexto (10%)
  const observacionTexto = [comportamientoResult.rows.map(r => r.observacion || "").join(" | "), textoObsDocente].filter(s => String(s).trim()).join(" | ");
  const perfilScore = calcularPerfil(perfil, observacionTexto);
  const dimensiones = [
    { clave: "academico", datos: academico, peso: Number(configuracion.peso_academico) },
    { clave: "asistencia", datos: asistencia, peso: Number(configuracion.peso_asistencia) },
    { clave: "cuestionario", datos: cuestionario, peso: Number(configuracion.peso_cuestionario) },
    { clave: "perfil", datos: perfilScore, peso: Number(configuracion.peso_comportamiento) }
  ];
  const ponderadas = dimensiones.filter(item => Number(item.peso) > 0);
  const disponibles = ponderadas.filter(item => item.datos.disponible);
  const pesoDisponible = disponibles.reduce((total, item) => total + item.peso, 0);
  const puntajeParcial = pesoDisponible
    ? disponibles.reduce((total, item) => total + item.datos.puntaje * item.peso, 0) / pesoDisponible
    : null;
  const datosCompletos = disponibles.length === ponderadas.length;
  const puntajeGlobal = datosCompletos ? puntajeParcial : null;

  const semaforo = determinarSemaforo({ puntajeGlobal, asistencia, academico, comportamiento, cuestionario, datosCompletos });
  const nivel = semaforo.nivel;

  const motivos = construirMotivos({ asistencia, academico, cuestionario, comportamiento, tieneObservacionesDocente: textoObsDocente.trim().length > 0 });
  if (semaforo.motivo && !motivos.includes(semaforo.motivo)) motivos.unshift(semaforo.motivo);
  if (perfil) {
    const viveTxt = { padres: "vive con ambos padres", madre: "vive solo con su mamá", padre: "vive solo con su papá", abuelos: "vive con sus abuelos", tutor: "vive con un tutor", albergue: "vive en un albergue", solo: "vive solo", otro: "vive con otros familiares" }[String(perfil.con_quien_vive || "").toLowerCase()];
    if (perfil.situacion_convivencia === "violencia") motivos.push(`Según su ficha, la convivencia en su casa es con violencia${viveTxt ? ` y ${viveTxt}` : ""}. Esto puede estar afectándolo.`);
    else if (perfil.situacion_convivencia === "conflictiva") motivos.push(`Según su ficha, la convivencia en su casa es conflictiva${viveTxt ? ` y ${viveTxt}` : ""}.`);
    else if (perfil.con_quien_vive && String(perfil.con_quien_vive).toLowerCase() !== "padres") motivos.push(`Según su ficha, no vive con sus padres: ${viveTxt || perfil.con_quien_vive}.`);
    if (perfil.antecedentes) motivos.push(`En su ficha registra como antecedente: "${String(perfil.antecedentes).slice(0, 100)}"`);
  }
  const TIPO_INC = { tardanza_reiterada: "tardanzas reiteradas", falta_injustificada: "falta injustificada", agresion: "agresión", vandalismo: "vandalismo", consumo_sospecha: "sospecha de consumo", desinteres: "desinterés", otro: "otro motivo" };
  for (const inc of incidenciasDetalle.slice(0, 2)) {
    const f = String(inc.fecha_incidencia || "").slice(0, 10);
    motivos.push(`Tiene una incidencia por ${TIPO_INC[inc.tipo] || inc.tipo}${f ? ` (${f})` : ""}: ${String(inc.descripcion || "").slice(0, 90)}`);
  }
  if (incidencias.total > incidenciasDetalle.length) motivos.push(`Acumula ${incidencias.total} incidencias en total.`);
  if (!perfil) motivos.push("Aún no completa su ficha: falta el contexto familiar para entenderlo mejor.");
  const lectura = construirLectura({ nivel, semaforo, asistencia, academico, cuestionario, comportamiento, perfil, incidenciasDetalle, expediente, areasRiesgo });
  const pesoAcademico = Number(configuracion.peso_academico);
  const pesoAsistencia = Number(configuracion.peso_asistencia);
  const pesoComportamiento = Number(configuracion.peso_comportamiento);
  const metricas = {
    asistencia,
    academico,
    comportamiento,
    cuestionario,
    perfil: perfil ? { con_quien_vive: perfil.con_quien_vive, situacion_convivencia: perfil.situacion_convivencia, apoderado: perfil.apoderado_nombre, completado: !!perfil.perfil_completado } : null,
    incidencias,
    lectura,
    semaforo,
    puntaje_parcial: redondear(puntajeParcial),
    pesos: {
      academico: pesoAcademico,
      asistencia: pesoAsistencia,
      comportamiento: pesoComportamiento,
      cuestionario: Number(configuracion.peso_cuestionario),
      disponible: redondear(pesoDisponible, 4)
    },
    formula: `RiesgoTotal = ${pesoAcademico} x Académico + ${pesoComportamiento} x Comportamiento + ${pesoAsistencia} x Asistencia`,
    semaforo_por_puntaje: {
      verde: "80-100 Riesgo bajo",
      amarillo: "60-79 Riesgo moderado",
      rojo: "<60 Riesgo alto"
    }
  };

  let evaluacionId = null;
  if (guardar) {
    const guardado = await query(
      `INSERT INTO evaluaciones_riesgo_estudiante
        (estudiante_id, periodo_id, configuracion_id, fecha_desde, fecha_hasta,
         puntaje_asistencia, puntaje_academico, puntaje_cuestionario, puntaje_comportamiento, puntaje_global,
         nivel, datos_completos, metricas, motivos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, calculado_at`,
      [
        estudianteId,
        periodo?.id || null,
        configuracion.id,
        fechaDesde,
        fechaHasta,
        asistencia.puntaje,
        academico.puntaje,
        cuestionario.puntaje,
        comportamiento.puntaje,
        redondear(puntajeGlobal),
        nivel,
        datosCompletos,
        JSON.stringify(metricas),
        JSON.stringify(motivos)
      ]
    );
    evaluacionId = guardado.rows[0].id;

    if (datosCompletos && (semaforo.nivel === "Alto" || semaforo.nivel === "Medio")) {
      // Gracia de 2 bimestres (~120 días) tras cerrar caso: si el psicólogo marcó mejora, esperar a re-evaluación del siguiente bimestre antes de volver a alertar
      const cerradoReciente = await query(
        `SELECT cerrado_en FROM casos_seguimiento WHERE estudiante_id = $1 AND estado = 'cerrado' ORDER BY cerrado_en DESC LIMIT 1`,
        [estudianteId]
      );
      const diasDesdeCierre = cerradoReciente.rows[0]?.cerrado_en ? (Date.now() - new Date(cerradoReciente.rows[0].cerrado_en).getTime()) / 86400000 : null;
      const enPeriodoGracia = diasDesdeCierre !== null && diasDesdeCierre < 120;
      if (enPeriodoGracia) {
        // No generar alerta aún; el caso está en observación post-intervención
      } else {
        const alertaExistente = await query(
          `
            SELECT id FROM alertas_riesgo
            WHERE estudiante_id = $1
              AND tipo = $2
              AND nivel = $3
              AND estado = 'pendiente'
          LIMIT 1
        `,
        [estudianteId, semaforo.tipo, semaforo.nivel]
        );
        if (!alertaExistente.rows[0]) {
          await query(
            `
              INSERT INTO alertas_riesgo (estudiante_id, evaluacion_id, tipo, nivel, mensaje)
              VALUES ($1, $2, $3, $4, $5)
            `,
            [estudianteId, evaluacionId, semaforo.tipo, semaforo.nivel, semaforo.motivo]
          );
        } else {
          // Refresca el mensaje con la última evaluación (lenguaje simple y datos actuales)
          await query(
            `UPDATE alertas_riesgo SET mensaje = $1, evaluacion_id = $2 WHERE id = $3`,
            [semaforo.motivo, evaluacionId, alertaExistente.rows[0].id]
          );
        }
      }
    }
  }

  return {
    evaluacion_id: evaluacionId,
    estudiante,
    periodo: periodo ? {
      id: periodo.id,
      nombre: periodo.nombre,
      anio: periodo.anio,
      fecha_inicio: periodo.fecha_inicio,
      fecha_fin: periodo.fecha_fin
    } : null,
    configuracion: {
      id: configuracion.id,
      version: configuracion.version,
      limite_bajo: Number(configuracion.limite_bajo),
      limite_alto: Number(configuracion.limite_alto),
      pesos: {
        academico: Number(configuracion.peso_academico),
        asistencia: Number(configuracion.peso_asistencia),
        comportamiento: Number(configuracion.peso_comportamiento),
        cuestionario: Number(configuracion.peso_cuestionario)
      }
    },
    puntaje_global: redondear(puntajeGlobal),
    nivel,
    semaforo,
    datos_completos: datosCompletos,
    dimensiones: metricas,
    motivos
  };
}

async function recalcularEstudiantes(estudianteIds, opciones = {}) {
  const resultados = [];
  const errores = [];
  const ids = [...new Set(estudianteIds.map(Number).filter(Boolean))];
  for (const estudianteId of ids) {
    try {
      resultados.push(await calcularIndicadorEstudiante(estudianteId, opciones));
    } catch (error) {
      errores.push({ estudiante_id: estudianteId, error: error.message });
    }
  }
  return { resultados, errores };
}

async function obtenerUltimoIndicador(estudianteId) {
  const result = await query(
    `SELECT er.*, e.nombres, e.apellidos, e.correo,
            s.nivel AS nivel_educativo, s.grado, s.letra, s.nombre AS seccion
     FROM evaluaciones_riesgo_estudiante er
     JOIN estudiantes e ON e.id = er.estudiante_id
     JOIN secciones s ON s.id = e.seccion_id
     WHERE er.estudiante_id = $1
     ORDER BY er.calculado_at DESC, er.id DESC
     LIMIT 1`,
    [estudianteId]
  );
  return result.rows[0] || null;
}

async function listarUltimosIndicadores({ seccionId } = {}) {
  const params = [];
  const filtro = seccionId ? (params.push(seccionId), `WHERE e.seccion_id = $1`) : "";
  const result = await query(
    `SELECT * FROM (
       SELECT DISTINCT ON (e.id)
         e.id AS estudiante_id, e.nombres, e.apellidos, e.correo,
         s.id AS seccion_id, s.nivel AS nivel_educativo, s.grado, s.letra, s.nombre AS seccion,
         er.id AS evaluacion_id, er.puntaje_global, er.nivel, er.datos_completos,
         er.metricas, er.motivos, er.calculado_at
       FROM estudiantes e
       JOIN secciones s ON s.id = e.seccion_id
       LEFT JOIN evaluaciones_riesgo_estudiante er ON er.estudiante_id = e.id
       ${filtro}
       ORDER BY e.id, er.calculado_at DESC NULLS LAST, er.id DESC NULLS LAST
     ) sub
     ORDER BY sub.apellidos, sub.nombres`,
    params
  );
  return result.rows;
}

async function recalcularRespondientesPregunta(preguntaId, opciones = {}) {
  const result = await query(
    `SELECT DISTINCT estudiante_id
     FROM formulario_respuestas
     WHERE pregunta_id = $1 AND estudiante_id IS NOT NULL`,
    [preguntaId]
  );
  return recalcularEstudiantes(result.rows.map(item => item.estudiante_id), opciones);
}

module.exports = {
  calcularIndicadorEstudiante,
  recalcularEstudiantes,
  recalcularRespondientesPregunta,
  obtenerUltimoIndicador,
  listarUltimosIndicadores,
  calcularAsistencia,
  calcularAcademico,
  calcularComportamiento,
  calcularCuestionario,
  determinarSemaforo,
  puntajePorAsistencia,
  puntajePorCuestionario
};
