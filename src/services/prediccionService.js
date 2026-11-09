const { GoogleGenerativeAI } = require("@google/generative-ai");
const { query } = require("../config/postgres");

const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

// Perfil de tendencia por rama — anticipación basada en señales indirectas (no diagnóstico)
function calcularPerfilTendencia(datos) {
  const rasgos = String(datos.rasgos_adolescente || "").toLowerCase();
  const compObs = (datos.comportamiento || []).map(c => String(c.observacion || "")).join(" ").toLowerCase();
  const texto = rasgos + " " + compObs;
  const tiene = (re) => re.test(texto);
  const cuentaFaltasLunes = (datos.asistencia?.registros || []).filter(a => {
    const d = new Date(a.fecha);
    return a.estado === "Falto" && d.getDay() === 1;
  }).length;
  const es = (fn) => fn ? 1 : 0;

  let alcohol = 0, droga = 0, violencia = 0, vandalismo = 0;

  // Alcohol: olor, bar, cerveza, trago, cansado/sueño lunes, faltas lunes + incidencias
  if (tiene(/alcohol|cerveza|trago|bar|olor/)) alcohol += 35;
  if (tiene(/cansado|somnolencia|sueño|fatiga/)) alcohol += 15;
  if ((datos.incidencias || []).some(i => String(i.tipo||"").toLowerCase().includes("consumo"))) alcohol += 30;
  if (cuentaFaltasLunes >= 2) alcohol += 25;
  if ((datos.asistencia?.faltas || 0) >= 3) alcohol += 10;
  if (compObs.includes("alcohol") || compObs.includes("bar")) alcohol += 20;

  // Droga: marihuana, pbc, inhalante, droga, consumo + incidencias
  if (tiene(/droga|marihuana|pbc|inhalante|coca|consumo|fum/)) droga += 40;
  if ((datos.incidencias || []).some(i => String(i.tipo||"").toLowerCase().includes("consumo"))) droga += 30;
  if (tiene(/se aísla|aislado|pocos amigos|grupo.*mayores/)) droga += 15;
  if ((datos.comportamiento || []).filter(c => c.nivel === "Deficiente" || c.nivel === "Mala").length >= 2) droga += 15;
  if (tiene(/cansado|somnolencia/)) droga += 10;

  // Violencia familiar: mis padres pelean, maltrato, golpe, violencia en casa, familia ausente/conflicto + perfil
  if (tiene(/violencia en casa|mis padres pelean|maltrato|golpe|pegan|violencia familiar/)) violencia += 40;
  if (tiene(/familia ausente|conflicto familiar|no viene.*reuni|padres.*ausente/)) violencia += 25;
  const perfilSituacion = String(datos.perfil?.situacion_convivencia || "").toLowerCase();
  if (perfilSituacion === "violencia") violencia += 30;
  else if (perfilSituacion === "conflictiva") violencia += 20;
  else if (perfilSituacion === "ausencia") violencia += 15;
  if (String(datos.perfil?.con_quien_vive || "").toLowerCase() === "solo") violencia += 15;
  const perfilAntecedentes = String(datos.perfil?.antecedentes || "").toLowerCase();
  if (/violencia|maltrato|agres/.test(perfilAntecedentes)) violencia += 15;
  if ((datos.incidencias || []).some(i => String(i.tipo||"").toLowerCase().includes("agresion") || String(i.tipo||"").toLowerCase().includes("violencia"))) violencia += 20;
  if (tiene(/triste|decaído|aislado|miedo|temor/)) violencia += 15;
  if (compObs.includes("maltrato") || compObs.includes("violencia") || compObs.includes("golpe")) violencia += 20;

  // Vandalismo / violencia escolar: busca pleitos, agresivo, daña, pelea, disruptiva, confrontativo, líder negativo + incidencias
  if (tiene(/busca pleitos|confrontativo|peleón|pelea|agresivo verbal|agresivo/)) vandalismo += 35;
  if (tiene(/daña|vandalismo|disruptiv|rompe|destruye/)) vandalismo += 25;
  if ((datos.incidencias || []).some(i => ["vandalismo","agresion"].includes(String(i.tipo||"").toLowerCase()))) vandalismo += 25;
  if (tiene(/líder.*negativo|seguido por pares.*pelea|inquieto.*distrae/)) vandalismo += 15;
  if ((datos.comportamiento || []).filter(c => c.nivel === "Deficiente" || c.nivel === "Mala").length >= 2) vandalismo += 20;
  if (tiene(/irritable|cambios de humor|impulsivo/)) vandalismo += 10;

  const clamp = (v) => Math.min(100, Math.max(0, Math.round(v)));
  return {
    alcohol: clamp(alcohol),
    droga: clamp(droga),
    violencia_familiar: clamp(violencia),
    vandalismo: clamp(vandalismo),
  };
}

async function callGeminiDirect(modelName, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${geminiKey}`;
  const body = {
    system_instruction: { parts: [{ text: "Eres el/la psicólogo/a titular del Colegio Ofelia Velásquez (secundaria pública, Tarapoto) con 12 años de experiencia clínica y educativa. TÚ eres quien elabora esta predicción para tu propio uso profesional (no la directora). Trabajas con enfoque trauma-informado, ético y basado en evidencia. Usas SIEMPRE lenguaje sencillo, claro y humano, sin tecnicismos. Respondes EXCLUSIVAMENTE con JSON válido, sin markdown, sin backticks, solo el objeto JSON puro. Nunca inventas citas; si no hay dato, lo dices explícitamente." }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.35, maxOutputTokens: 4096, responseMimeType: "application/json" }
  };
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await resp.json();
  if (!resp.ok) {
    const msg = data?.error?.message || JSON.stringify(data).slice(0, 400);
    const err = new Error(`[Direct v1 ${modelName}] ${resp.status} ${msg}`);
    err.status = resp.status;
    throw err;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata || null;
  return { text, usage, raw: data };
}

async function agregarDatosEstudiante(estudianteId) {
  const datos = {};

  // 1. Datos básicos del estudiante
  const estResult = await query(
    `SELECT e.id, e.nombres, e.apellidos, e.correo,
            s.nivel, s.grado, s.letra, s.nombre AS seccion
     FROM estudiantes e
     JOIN secciones s ON s.id = e.seccion_id
     WHERE e.id = $1`,
    [estudianteId]
  );
  if (estResult.rows.length === 0) throw new Error("Estudiante no encontrado");
  datos.estudiante = estResult.rows[0];

  // 2. Asistencia (últimos 60 días)
  const asistenciaResult = await query(
    `SELECT fecha, estado, observacion
     FROM asistencias
     WHERE estudiante_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '60 days'
     ORDER BY fecha DESC`,
    [estudianteId]
  );
  const asistencias = asistenciaResult.rows;
  const totalDias = asistencias.length;
  const faltas = asistencias.filter(a => a.estado === "Falto").length;
  const tardanzas = asistencias.filter(a => a.estado === "Tardanza").length;
  const asistio = asistencias.filter(a => a.estado === "Asistio").length;
  datos.asistencia = {
    total_dias: totalDias,
    faltas,
    tardanzas,
    asistencias: asistio,
    porcentaje_asistencia: totalDias > 0 ? Math.round((asistio / totalDias) * 100) : null,
    porcentaje_faltas: totalDias > 0 ? Math.round((faltas / totalDias) * 100) : null,
    registros: asistencias.slice(0, 30)
  };

  // 3. Notas simples (últimos 2 trimestres)
  const notasResult = await query(
    `SELECT ns.asignatura_id, a.nombre AS asignatura, ns.campo, ns.nota, t.nombre AS trimestre
     FROM notas_simples ns
     JOIN asignaturas a ON a.id = ns.asignatura_id
     JOIN trimestres_academicos t ON t.id = ns.trimestre_id
     WHERE ns.estudiante_id = $1
     ORDER BY t.orden DESC, a.nombre, ns.campo
     LIMIT 100`,
    [estudianteId]
  );
  datos.notas = notasResult.rows;

  // 4. Calificaciones de competencias (últimos 2 trimestres)
  const calificacionesResult = await query(
    `SELECT c.nombre AS competencia, a.nombre AS asignatura,
            ct.nivel_logro, ct.observacion, t.nombre AS trimestre
     FROM calificaciones_trimestrales_competencia ct
     JOIN competencias c ON c.id = ct.competencia_id
     JOIN asignaturas a ON a.id = c.asignatura_id
     JOIN trimestres_academicos t ON t.id = ct.trimestre_id
     WHERE ct.estudiante_id = $1
     ORDER BY t.orden DESC, a.nombre, c.nombre
     LIMIT 50`,
    [estudianteId]
  );
  datos.calificaciones = calificacionesResult.rows;

  // 5. Comportamiento
  const comportResult = await query(
    `SELECT c.nivel, c.observacion, t.nombre AS trimestre, c.fecha_registro
     FROM comportamientos c
     JOIN trimestres_academicos t ON t.id = c.trimestre_id
     WHERE c.estudiante_id = $1
     ORDER BY c.fecha_registro DESC`,
    [estudianteId]
  );
  datos.comportamiento = comportResult.rows;
  // Observaciones libres del docente por bimestre (reemplazo del antiguo "comportamiento")
  try {
    const obsRes = await query(
      `SELECT o.texto AS observacion, t.nombre AS trimestre
       FROM observaciones_bimestre o
       JOIN trimestres_academicos t ON t.id = o.trimestre_id
       WHERE o.estudiante_id = $1
       ORDER BY o.updated_at DESC LIMIT 8`,
      [estudianteId]
    );
    datos.observaciones_docente = obsRes.rows;
  } catch (_) { datos.observaciones_docente = []; }

  // 5b. Perfil detallado + incidencias (para expediente y predicción contextual)
  try {
    const perfilRes = await query(`SELECT * FROM perfiles_estudiante WHERE estudiante_id=$1`, [estudianteId]);
    datos.perfil = perfilRes.rows[0] || null;
  } catch (_) { datos.perfil = null; }
  try {
    const incRes = await query(`SELECT tipo, descripcion, observacion, fecha_incidencia, rol_creador FROM incidencias WHERE estudiante_id=$1 ORDER BY fecha_incidencia DESC LIMIT 5`, [estudianteId]);
    datos.incidencias = incRes.rows;
  } catch (_) { datos.incidencias = []; }

  // 6. Evaluaciones de riesgo históricas
  const riesgoResult = await query(
    `SELECT er.puntaje_global, er.nivel, er.puntaje_asistencia,
            er.puntaje_academico, er.puntaje_cuestionario, er.puntaje_comportamiento,
            er.motivos, er.metricas, er.calculado_at
     FROM evaluaciones_riesgo_estudiante er
     WHERE er.estudiante_id = $1
     ORDER BY er.calculado_at DESC
     LIMIT 10`,
    [estudianteId]
  );
  datos.evaluaciones_riesgo = riesgoResult.rows;

  // 7. Respuestas a cuestionarios psicológicos (incluye tests validados)
  const cuestionariosResult = await query(
    `SELECT fp.titulo AS formulario, fp.descripcion, fp.es_validado, fp.codigo_minsa,
            fr.respuesta, fpq.pregunta AS texto_pregunta, fpq.tipo,
            po.texto AS opcion, po.puntaje_riesgo,
            fr.created_at AS fecha_respuesta
     FROM formulario_respuestas fr
     JOIN formulario_preguntas fpq ON fpq.id = fr.pregunta_id
     JOIN formularios_psicologicos fp ON fp.id = fr.formulario_id
     LEFT JOIN pregunta_opciones po ON po.pregunta_id = fpq.id AND po.texto = fr.respuesta
     WHERE fr.estudiante_id = $1
     ORDER BY fp.es_validado DESC, fr.created_at DESC, fpq.orden
     LIMIT 100`,
    [estudianteId]
  );
  datos.cuestionarios = cuestionariosResult.rows;

  // 8. Historial de seguimientos
  const seguimientoResult = await query(
    `SELECT sp.tipo_intervencion, sp.descripcion, sp.acuerdos,
            sp.estado_emocional, sp.fecha_intervencion,
            cs.estado AS caso_estado, cs.nivel_prioridad
     FROM seguimientos_psicopedagogicos sp
     JOIN casos_seguimiento cs ON cs.id = sp.caso_id
     WHERE sp.estudiante_id = $1
     ORDER BY sp.fecha_intervencion DESC
     LIMIT 20`,
    [estudianteId]
  );
  datos.seguimientos = seguimientoResult.rows;

  // 9. Alertas históricas
  const alertasResult = await query(
    `SELECT tipo, nivel, mensaje, estado, creada_en
     FROM alertas_riesgo
     WHERE estudiante_id = $1
     ORDER BY creada_en DESC
     LIMIT 10`,
    [estudianteId]
  );
  datos.alertas = alertasResult.rows;

  return datos;
}

function construirPrompt(datos) {
  const e = datos.estudiante;
  const seccion = `${e.nivel} ${e.grado}° "${e.letra}"`;
  const pctFaltas = datos.asistencia.porcentaje_faltas ?? 0;

  // --- Análisis cuestionarios para enriquecer prompt ---
  let cuestionarioStats = "";
  if (datos.cuestionarios.length > 0) {
    const conRiesgo = datos.cuestionarios.filter(c => Number(c.puntaje_riesgo) >= 70).length;
    const riesgoMedio = datos.cuestionarios.filter(c => Number(c.puntaje_riesgo) >= 40 && Number(c.puntaje_riesgo) < 70).length;
    const abiertas = datos.cuestionarios.filter(c => c.tipo === 'abierta').length;
    const likertBajas = datos.cuestionarios.filter(c => c.tipo === 'likert' && ['Muy malo','Malo','1','2'].includes(String(c.respuesta))).length;
    cuestionarioStats = `\n  Síntesis: ${datos.cuestionarios.length} respuestas totales — Alto riesgo (≥70): ${conRiesgo}, Riesgo medio: ${riesgoMedio}, Abiertas: ${abiertas}, Likert bajas: ${likertBajas}.`;
    if (conRiesgo >= 3) cuestionarioStats += ` ALERTA: patrón consistente de malestar.`;
  }

  let prompt = `Eres el/la psicólogo/a titular del Colegio Ofelia Velásquez. TÚ generas esta predicción para tu intervención, no la directora. Analiza CON LUPA los datos del adolescente de ${seccion} y responde como en tu informe clínico interno: qué está pasando AHORA (síntomas), qué puede pasar DESPUÉS (pronóstico) y qué hacer YA (plan). Sé clínico, cálido, preciso y útil para ti mismo. Cita datos concretos (ej. "20% faltas", "respuesta 'Me siento solo'" , "observación docente: juega mucho").

## Estudiante
- Nombre: ${e.apellidos}, ${e.nombres}
- Sección: ${seccion}
- Correo: ${e.correo}`;

  if (datos.rasgos_adolescente) {
    prompt += `\n\n## Rasgos del adolescente (observación directa del psicólogo — dato prioritario, incluye texto libre + checks rápidos opcionales)\n${datos.rasgos_adolescente}\n`;
    prompt += `Usa estos rasgos como lente clínico principal: integra apariencia, lenguaje, interacción, contexto descrito para matizar tu lectura. Si el rasgo explica un dato (ej. "juega mucho" + Deficiente pero sin agresividad), dilo. No inventes consumo si no hay señal.`;
  } else {
    prompt += `\n\n## Rasgos del adolescente: (no proporcionados — limita a datos duros)`;
  }

  // Perfil de tendencia por vulnerabilidad — anticipación indirecta, no diagnóstico
  const perfil = calcularPerfilTendencia(datos);
  const compConObs = (datos.comportamiento || []).filter(c => c.observacion && String(c.observacion).trim()).slice(0,4).map(c => `- ${c.trimestre} ${c.nivel}: "${String(c.observacion).trim()}"`).join("\n");
  const obsDocenteTxt = (datos.observaciones_docente || []).filter(o => o.observacion && String(o.observacion).trim()).map(o => `- ${o.trimestre}: "${String(o.observacion).trim()}"`).join("\n");
  const obsDocenteBloque = [compConObs, obsDocenteTxt].filter(Boolean).join("\n");
  prompt += `\n\n## Observaciones del docente en comportamiento (evaluadas como señal indirecta — no etiqueta)\n${obsDocenteBloque || "(sin observaciones — limitación para discriminar vandalismo/violencia)"}`;
  prompt += `\n\n## Perfil de tendencia por vulnerabilidad (anticipación basada en señales indirectas — NO es diagnóstico, solo indica hacia qué rama deriva)`;
  prompt += `\n- Alcoholismo: ${perfil.alcohol}/100 — señales: rasgos + observación docente + faltas lunes`;
  prompt += `\n- Drogadicción: ${perfil.droga}/100`;
  prompt += `\n- Violencia familiar: ${perfil.violencia_familiar}/100`;
  prompt += `\n- Vandalismo / violencia escolar: ${perfil.vandalismo}/100`;
  prompt += `\nInstrucción: usa estos scores solo como indicio. Si un score <30 dilo como "sin señal clara". Si 30-60 "señal moderada, requiere entrevista". Si >60 "señal consistente, prioriza esa rama en recomendaciones". Nunca etiquetes al alumno; di "tendencia a..." con cautela y con dato que lo sustenta.`;

  prompt += `

## Asistencia (últimos 60 días) — pesa 35%
- Días con registro: ${datos.asistencia.total_dias}
- Asistió: ${datos.asistencia.asistencias} (${datos.asistencia.porcentaje_asistencia ?? '-'}%)
- Faltó: ${datos.asistencia.faltas} (${pctFaltas}%)
- Tardanzas: ${datos.asistencia.tardanzas}`;

  if (datos.asistencia.registros.length > 0) {
    const faltas = datos.asistencia.registros.filter(a => a.estado === "Falto").slice(0, 6).map(a => `  - ${String(a.fecha).slice(0,10)}: Falto${a.observacion ? ' — ' + a.observacion : ''}`).join("\n");
    if (faltas) prompt += `\n  Últimas faltas:\n${faltas}`;
    const tard = datos.asistencia.registros.filter(a => a.estado === "Tardanza").slice(0, 3).map(a => String(a.fecha).slice(0,10)).join(", ");
    if (tard) prompt += `\n  Tardanzas recientes: ${tard}`;
  }

  if (datos.notas.length > 0) {
    const porAsig = {};
    datos.notas.forEach(n => { if (!porAsig[n.asignatura]) porAsig[n.asignatura]=[]; porAsig[n.asignatura].push(n); });
    prompt += `\n\n## Notas por Asignatura (últimos 2 bimestres)`;
    for (const [asig, notas] of Object.entries(porAsig)) {
      prompt += `\n### ${asig}`;
      notas.slice(0, 8).forEach(n => { prompt += `\n  - ${n.campo}: ${n.nota} (${n.trimestre})`; });
    }
  } else {
    prompt += `\n\n## Notas: SIN REGISTRO en últimos 2 bimestres (vacío = falta de info, no “bien”).`;
  }

  if (datos.calificaciones.length > 0) {
    prompt += `\n\n## Competencias (AD/A/B/C)`;
    datos.calificaciones.slice(0, 15).forEach(c => {
      prompt += `\n- ${c.asignatura} / ${c.competencia}: ${c.nivel_logro}${c.observacion ? ' — ' + c.observacion : ''} [${c.trimestre}]`;
    });
  }

  if (datos.perfil) {
    prompt += `\n\n## Perfil del estudiante (expediente — datos familiares y apoderado)`;
    prompt += `\n- Vive con: ${datos.perfil.con_quien_vive || "-"} | Convivencia: ${datos.perfil.situacion_convivencia || "-"}${datos.perfil.antecedentes ? ` | Antecedentes: ${datos.perfil.antecedentes}` : ""}`;
    prompt += `\n- Apoderado: ${datos.perfil.apoderado_nombre || "-"} (${datos.perfil.apoderado_parentesco || ""}) — ${datos.perfil.apoderado_telefono || ""}`;
    if (!datos.perfil.perfil_completado) prompt += ` (incompleto)`;
  } else {
    prompt += `\n\n## Perfil: SIN FICHA COMPLETA (limitación: falta contexto familiar — el estudiante aún no completó su ficha obligatoria)`;
  }
  if (datos.incidencias && datos.incidencias.length > 0) {
    prompt += `\n\n## Incidencias recientes (últimas 5, con fecha, tipo, observación y quién la registró)`;
    datos.incidencias.forEach(i => { prompt += `\n- ${String(i.fecha_incidencia).slice(0,10)} [${i.tipo}] ${i.descripcion}${i.observacion ? ` — ${i.observacion}` : ""} (por ${i.rol_creador || "?"})`; });
  } else {
    prompt += `\n\n## Incidencias: Sin incidencias registradas en últimos registros`;
  }

  if (datos.comportamiento.length > 0) {
    prompt += `\n\n## Comportamiento`;
    datos.comportamiento.forEach(c => { prompt += `\n- ${c.trimestre}: ${c.nivel}${c.observacion ? ' — ' + c.observacion : ''} (${String(c.fecha_registro).slice(0,10)})`; });
  } else {
    prompt += `\n\n## Comportamiento: SIN REGISTRO (ya no se evalúa; ver Observaciones del docente)`;
  }
  if ((datos.observaciones_docente || []).length > 0) {
    prompt += `\n\n## Observaciones del docente por bimestre`;
    datos.observaciones_docente.forEach(o => { prompt += `\n- ${o.trimestre}: ${o.observacion}`; });
  }

  if (datos.evaluaciones_riesgo.length > 0) {
    prompt += `\n\n## Evaluaciones de Riesgo previas (motor SAT)`;
    datos.evaluaciones_riesgo.forEach(er => {
      prompt += `\n- ${String(er.calculado_at).slice(0,10)}: ${er.puntaje_global ?? '—'}/100 — ${er.nivel} | Asist:${er.puntaje_asistencia ?? '-'} Acad:${er.puntaje_academico ?? '-'} Cuest:${er.puntaje_cuestionario ?? '-'} Comp:${er.puntaje_comportamiento ?? '-'}`;
      if (er.motivos && Array.isArray(er.motivos) && er.motivos.length) prompt += `\n  Motivos: ${er.motivos.join("; ")}`;
    });
  } else {
    prompt += `\n\n## Riesgo previo: SIN CÁLCULO (estudiante sin historial).`;
  }

  if (datos.cuestionarios.length > 0) {
    const validados = datos.cuestionarios.filter(c => c.es_validado && c.codigo_minsa);
    const custom = datos.cuestionarios.filter(c => !c.es_validado);
    
    // Stats de tests validados MINSA
    if (validados.length > 0) {
      const testsAgrupados = {};
      validados.forEach(c => {
        if (!testsAgrupados[c.codigo_minsa]) testsAgrupados[c.codigo_minsa] = { codigo: c.codigo_minsa, respuestas: [], maxScore: 0 };
        testsAgrupados[c.codigo_minsa].respuestas.push(c);
      });
      prompt += `\n\n## 🧪 TESTS VALIDADOS MINSA — ANÁLISIS OBLIGATORIO`;
      for (const [codigo, test] of Object.entries(testsAgrupados)) {
        const puntajeMax = Math.max(...test.respuestas.map(r => Number(r.puntaje_riesgo) || 0));
        const puntajeProm = test.respuestas.reduce((t, r) => t + (Number(r.puntaje_riesgo) || 0), 0) / test.respuestas.length;
        const nivelClasico = puntajeProm >= 70 ? 'SEVERO' : puntajeProm >= 50 ? 'MODERADO' : puntajeProm >= 30 ? 'LEVE' : 'MÍNIMO';
        prompt += `\n\n### ${codigo} (${test.respuestas.length} respuestas)`;
        prompt += `\n- Puntaje promedio: ${Math.round(puntajeProm)}/100 → Nivel: ${nivelClasico}`;
        prompt += `\n- Puntaje máximo individual: ${puntajeMax}/100`;
        prompt += `\n- Interpretación: ${codigo === 'GAD-7' ? 'Ansiedad generalizada (últimas 2 semanas)' : codigo === 'PHQ-9' ? 'Depresión (últimas 2 semanas)' : 'Bienestar general'}`;
        test.respuestas.slice(0, 15).forEach(r => {
          const riesgo = Number(r.puntaje_riesgo) || 0;
          const riesgoTag = riesgo >= 70 ? ' ⚠️ ALTO' : riesgo >= 50 ? ' ⚡ MEDIO' : '';
          prompt += `\n  - P: ${r.texto_pregunta}`;
          prompt += `\n    R: "${r.respuesta}" [riesgo ${riesgo}/100${riesgoTag}]`;
        });
      }
      prompt += `\n\n  ⚠️ INSTRUCCIÓN CRÍTICA: Tests validados tienen peso CLÍNICO ALTO. Si ≥3 respuestas con riesgo ≥70 en un test, es SEÑAL DE ALARMA. Cita los scores en tu justificación.`;
    }

    // Stats de formularios custom
    if (custom.length > 0) {
      const conRiesgo = custom.filter(c => Number(c.puntaje_riesgo) >= 70).length;
      const riesgoMedio = custom.filter(c => Number(c.puntaje_riesgo) >= 40 && Number(c.puntaje_riesgo) < 70).length;
      const abiertas = custom.filter(c => c.tipo === 'abierta').length;
      prompt += `\n\n## Cuestionarios psicológicos — LEER CON ATENCIÓN (peso 15% pero alto valor clínico)`;
      prompt += `\n  Síntesis: ${custom.length} respuestas totales — Alto riesgo (≥70): ${conRiesgo}, Riesgo medio: ${riesgoMedio}, Abiertas: ${abiertas}.`;
      if (conRiesgo >= 3) prompt += ` ALERTA: patrón consistente de malestar.`;
      const porFormulario = {};
      custom.forEach(c => { if (!porFormulario[c.formulario]) porFormulario[c.formulario]=[]; porFormulario[c.formulario].push(c); });
      for (const [form, respuestas] of Object.entries(porFormulario)) {
        prompt += `\n\n### Formulario: ${form}`;
        if (respuestas[0]?.descripcion) prompt += ` — ${respuestas[0].descripcion}`;
        respuestas.slice(0, 25).forEach(r => {
          const tipoTag = r.tipo==='abierta' ? 'ABIERTA' : r.tipo==='likert' ? 'LIKERT' : 'CERRADA';
          const riesgo = (r.puntaje_riesgo!=null) ? ` [riesgo ${r.puntaje_riesgo}/100${Number(r.puntaje_riesgo)>=70?' ⚠️ ALTO':''}]` : '';
          const fecha = r.fecha_respuesta ? ` (${String(r.fecha_respuesta).slice(0,10)})` : '';
          prompt += `\n  - [${tipoTag}] P: ${r.texto_pregunta}${fecha}`;
          prompt += `\n    R: "${r.respuesta}"${riesgo}`;
          if (r.opcion && r.opcion !== r.respuesta) prompt += ` (opción: ${r.opcion})`;
        });
      }
      prompt += `\n\n  INSTRUCCIÓN: Si hay respuestas abiertas con texto emocional ("solo", "triste", "miedo", "pegan", "no quiero ir"), CÍTALAS literal entre comillas en tu justificación. Si hay Likert 1-2 o cerradas con riesgo alto, úsalas como evidencia principal.`;
    }
  } else {
    prompt += `\n\n## Cuestionarios: SIN RESPUESTAS (limitación: no puedes inferir estado emocional interno; dilo explícitamente en el análisis).`;
  }

  if (datos.seguimientos.length > 0) {
    prompt += `\n\n## Seguimientos psicopedagógicos`;
    datos.seguimientos.forEach(s => {
      prompt += `\n- ${String(s.fecha_intervencion).slice(0,10)} [${s.tipo_intervencion}] — Caso ${s.caso_estado} (${s.nivel_prioridad})`;
      prompt += `\n  Desc: ${s.descripcion}`;
      if (s.estado_emocional) prompt += ` | Emocional: ${s.estado_emocional}`;
      if (s.acuerdos) prompt += ` | Acuerdos: ${s.acuerdos}`;
    });
  } else {
    prompt += `\n\n## Seguimientos: SIN INTERVENCIONES PREVIAS`;
  }

  if (datos.alertas.length > 0) {
    prompt += `\n\n## Alertas`;
    datos.alertas.forEach(a => { prompt += `\n- [${a.nivel}] ${a.tipo}: ${a.mensaje} (${a.estado}, ${String(a.creada_en).slice(0,10)})`; });
  }

  prompt += `
 
 ---

 ## TU TAREA — Responde EXCLUSIVAMENTE con JSON válido (sin markdown, sin backticks) con esta estructura EXACTA:

 IMPORTANTE — LENGUAJE: Escribe TODO en lenguaje sencillo, claro y humano, como si le explicaras a otro psicólogo sin tecnicismos innecesarios. Usa frases cortas y directas. Evita jerga clínica compleja. El psicólogo debe entenderlo al primer vistazo.

 EVALUACIÓN INTEGRAL: Analiza al adolescente de forma integral, usando TODA la información disponible (asistencia, notas por cursos, calificaciones, observaciones del docente, ficha socioeducativa completa, expediente, incidencias, cuestionarios completos con respuestas abiertas y cerradas, puntajes de tests validados, alertas, seguimientos). No te quedes solo con un dato: conecta todo.

 {
   "nivel_riesgo_predicho": "Bajo" | "Medio" | "Alto",
   "confianza": 0-100,
   "tendencia_principal": {
     "rama": "alcoholismo" | "drogadicción" | "violencia_familiar" | "vandalismo" | "sin_señal_clara",
     "confianza": 0-100,
     "justificacion": "por qué deriva más a esa rama: conecta Rasgos + observación docente + faltas/notas de forma sencilla (ej. 'Es inquieto y busca pleitos, tiene 2 observaciones de \"daña carpeta\" y falta seguido → por eso la tendencia a vandalismo es 65')"
   },
   "tendencias": {
     "alcohol": 0-100,
     "droga": 0-100,
     "violencia_familiar": 0-100,
     "vandalismo": 0-100
   },
   "resumen": "3 a 4 oraciones sencillas que respondan QUÉ ESTÁ PASANDO AHORA: integra de forma clara y humana asistencia+notas+comportamiento+cuestionarios+perfil, citando 1-2 datos concretos con comillas. Si no hay cuestionarios/rasgos, dilo: 'sin auto-reporte, limitación'. Añade disclaimer 'anticipación, no diagnóstico'. Tono: cercano, profesional pero fácil de leer.",
   "comportamientos_predichos": [
     {
       "comportamiento": "qué puede pasar DESPUÉS, en lenguaje MUY sencillo y cercano (ej. 'Puede empezar a faltar más los lunes y alejarse de sus amigos en el recreo', 'Podría bajar más sus notas si no recibe apoyo'). Que cualquier psicólogo lo entienda sin esfuerzo",
       "probabilidad": "Alta" | "Media" | "Baja",
       "horizonte": "1 trimestre" | "2 trimestres" | "1 año",
       "justificación": "por qué lo predices, también en lenguaje sencillo: conecta de forma integral y clara TODOS los datos del adolescente (notas, asistencia, respuestas de cuestionarios, observaciones, ficha, incidencias) y cita 1-2 datos concretos con comillas"
     }
   ],
  "factores_contribuyentes": [
    {
      "factor": "causa raíz (ej. 'Malestar emocional no verbalizado')",
      "impacto": "Alto" | "Medio" | "Bajo",
      "descripcion": "cómo contribuye hoy, con evidencia citada"
    }
  ],
  "recomendaciones": [
    {
      "prioridad": "Alta" | "Media" | "Baja",
      "accion": "qué hacer concreto y medible (ej. 'Entrevista focal 30 min + aplicar PHQ-A + visita domiciliaria')",
      "responsable": "Psicólogo" | "Docente" | "Dirección" | "Familia",
      "plazo": "inmediato" | "1 semana" | "1 mes" | "trimestre"
    }
  ]
}

METODOLOGÍA YA APLICADA (úsala como evidencia, no la repitas como lista):
1) Notas y comportamiento: solo de bimestres con datos (si un bimestre futuro no tiene notas de nadie, no se contabilizó). 2) Asistencia 60 días con patrones. 3) Cuestionarios: leídos y puntuados (cerradas/likert + abiertas literales). 4) Observaciones docentes de comportamiento (ej. “juega mucho” matiza un C) y rasgos del psicólogo (si los diste). Tú integras TODO.

 REGLAS DE ORO (para que tu predicción sea realmente usable por ti mismo como psicólogo):
 - LENGUAJE: Usa SIEMPRE lenguaje sencillo, humano y directo. Nada de tecnicismos innecesarios. Frases cortas. Ej. en lugar de "presenta sintomatología ansioso-depresiva con ideación" di "se muestra muy ansioso y triste, dice que no quiere ir al colegio".
 - QUÉ ESTÁ PASANDO (resumen): describe en palabras simples qué le pasa al adolescente ahora. Si ves indicios de posible consumo, violencia familiar, ansiedad/depresión, dilo con cautela y con dato concreto que lo sustenta (ej. “3 respuestas con riesgo 85 + observación ‘se aísla’ + rasgo ‘cansado’ → podría estar consumiendo, conviene evaluarlo”). Si no hay cuestionarios, dilo como limitación.
 - QUÉ PUEDE PASAR: pronostica 2-3 escenarios concretos y fáciles de entender (ej. "podría faltar más los lunes", "podría bajar a C en varios cursos", "podría aislarse de sus amigos") con probabilidad y horizonte, siempre con dato real que lo respalde (no genérico).
 - CAUSAS: en factores, explica la cadena de forma sencilla y clara, siempre citando evidencia con comillas. Ej. “Falta seguido los lunes (60% de sus faltas son lunes) + dice que ‘trabaja fines de semana’ + notas con 12 → parece que trabaja y llega cansado”.
 - CÓMO SE INVESTIGÓ: en justificaciones deja rastro simple de qué revisaste (ej. “Revisé sus notas del II bimestre (5 de 11 cursos), 20% de faltas, 5 respuestas del cuestionario Bienestar, lo que anotó su tutor ‘juega mucho’ y lo que tú observaste ‘es conversador’”).
 - RECOMENDACIONES: 3-4 máximo, pero muy concretas, prácticas y con lenguaje claro para TI: "conversa 30 min a solas con él", "aplica un test breve de ansiedad", "visita su casa", "habla con su tutor y familia", "si sospechas consumo o violencia, coordina con posta". Indica responsable (Psicólogo/Docente/Familia/Dirección) y plazo real (inmediato/1 semana/1 mes).
 - CITA: usa comillas para respuestas/observaciones/rasgos tal cual los escribió la persona; si no hay dato no inventes.
 - Nivel: Alto si ≥2 señales fuertes (faltas >20% O C + O ≥3 respuestas alto riesgo O alerta + rasgo preocupante). Medio si 1 señal. Bajo si >90% asist y cuestionarios tranquilos.
 - Confianza: 85-95 datos completos + cuestionarios + rasgos; 60-75 Incompleto/sin cuestionarios; 50 casi sin datos.
 - Tono: cercano, cálido y profesional, como colega a colega, sin etiquetar al alumno, enfocado en “podemos ayudarlo ahora”.
`;

  return prompt;
}

function extraerJsonRobusto(contenido) {
  if (!contenido || typeof contenido !== "string") return null;
  let s = contenido.trim();
  // quitar BOM
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  // quitar thinking tags (gemini-2.5)
  s = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  // quitar markdown fences ```json ... ```  y  ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  // a veces viene "json\n{...}" sin fences
  s = s.replace(/^(?:json)?\s*\n/i, (m) => m.toLowerCase().includes("json") ? "" : m).trim();
  // extraer del primer { al último }
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b > a) s = s.substring(a, b + 1);
  // reparar trailing commas } , ]  -> } ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

function normalizarNivel(nivel) {
  const m = String(nivel || "").trim().toLowerCase();
  if (m === "bajo") return "Bajo";
  if (m === "medio") return "Medio";
  if (m === "alto") return "Alto";
  if (m.includes("crit") || m.includes("muy alto")) return "Alto";
  if (m.includes("incompleto")) return "Medio";
  return "Medio";
}
function construirFallback(datos, motivo) {
  const e = datos.estudiante;
  const pctFaltas = datos.asistencia.porcentaje_faltas ?? 0;
  const pctAsist = datos.asistencia.porcentaje_asistencia ?? 100;
  const ultRiesgo = datos.evaluaciones_riesgo[0];
  let nivel = "Bajo";
  if (ultRiesgo?.nivel) nivel = normalizarNivel(ultRiesgo.nivel);
  else if (pctFaltas > 20) nivel = "Alto";
  else if (pctFaltas > 10) nivel = "Medio";
  const comportNivel = (datos.comportamiento[0]?.nivel || "").toLowerCase();
  if (comportNivel.includes("deficiente") || comportNivel.includes("malo")) nivel = "Alto";
  else if (comportNivel.includes("regular") && nivel === "Bajo") nivel = "Medio";
  nivel = normalizarNivel(nivel);
  return {
    nivel_riesgo_predicho: nivel,
    confianza: 60,
    resumen: `Predicción generada en modo local (fallback) porque la IA no respondió con JSON válido: ${motivo}. Estudiante ${e.apellidos}, ${e.nombres} — asistencia ${pctAsist}%, faltas ${pctFaltas}%. Revisar manualmente.`,
    comportamientos_predichos: [
      { comportamiento: pctFaltas > 15 ? "Riesgo de ausentismo persistente" : "Mantener asistencia regular", probabilidad: pctFaltas > 15 ? "Alta" : "Media", horizonte: "1 trimestre", justificación: `Basado en ${pctFaltas}% de faltas en últimos 60 días` },
      { comportamiento: nivel === "Alto" ? "Posible descenso de rendimiento académico" : "Rendimiento estable si se mantiene apoyo", probabilidad: "Media", horizonte: "1 trimestre", justificación: ultRiesgo ? `Último riesgo: ${ultRiesgo.nivel} (${ultRiesgo.puntaje_global}/100)` : "Sin evaluación de riesgo previa" }
    ],
    factores_contribuyentes: [
      { factor: "Asistencia", impacto: pctFaltas > 20 ? "Alto" : pctFaltas > 10 ? "Medio" : "Bajo", descripcion: `${pctFaltas}% faltas, ${datos.asistencia.tardanzas} tardanzas en 60 días` },
      ...(ultRiesgo ? [{ factor: "Historial de riesgo", impacto: ultRiesgo.nivel === "Alto" ? "Alto" : "Medio", descripcion: ultRiesgo.motivos?.join("; ") || `Puntaje global ${ultRiesgo.puntaje_global}` }] : [])
    ],
    recomendaciones: [
      { prioridad: nivel === "Alto" ? "Alta" : "Media", accion: "Seguimiento de asistencia semanal con tutor", responsable: "Docente", plazo: "1 semana" },
      { prioridad: "Media", accion: "Entrevista psicopedagógica para descartar factores familiares", responsable: "Psicólogo", plazo: "1 mes" }
    ]
  };
}

async function generarPrediccionIA(estudianteId, psicologoId, rasgosAdolescente = null) {
  if (!genAI) {
    throw new Error("API key de Gemini no configurada. Agrega GEMINI_API_KEY en .env");
  }

  const datos = await agregarDatosEstudiante(estudianteId);
  if (rasgosAdolescente) datos.rasgos_adolescente = rasgosAdolescente;
  const prompt = construirPrompt(datos);

  const modelosCandidatos = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  let ultimoError = null;
  let prediccion = null;
  let modeloUsado = modelosCandidatos[0];
  let usage = null;

  async function intentarModeloSDK(modeloNombre, intento) {
    modeloUsado = modeloNombre;
    const model = genAI.getGenerativeModel({
      model: modeloNombre,
      systemInstruction: "Eres el/la psicólogo/a titular del Colegio Ofelia Velásquez. TÚ generas este informe para tu uso, no la directora. Usas SIEMPRE lenguaje sencillo, claro y humano, sin tecnicismos innecesarios. Evalúas al adolescente de forma integral con toda su información. Respondes EXCLUSIVAMENTE con JSON válido, sin markdown, sin backticks, solo JSON puro. Citas textual cuestionarios y rasgos cuando existan."
    });
    const configs = [
      { temperature: 0.35, maxOutputTokens: 4096, responseMimeType: "application/json" },
      { temperature: 0.35, maxOutputTokens: 4096 }
    ];
    for (const cfg of configs) {
      try {
        const geminiResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: cfg
        });
        const contenido = geminiResult.response.text() || "";
        const cand = geminiResult.response.candidates?.[0];
        if (cand?.finishReason && cand.finishReason !== "STOP" && cand.finishReason !== "MAX_TOKENS") {
          console.warn(`[prediccion] modelo=${modeloNombre} finishReason=${cand.finishReason} intento=${intento}`);
        }
        usage = geminiResult.response.usageMetadata || null;
        if (!contenido.trim()) throw new Error(`Respuesta vacía (finishReason=${cand?.finishReason || "?"})`);
        return contenido;
      } catch (e) {
        const msg = String(e.message || e);
        if (msg.includes("responseMimeType") && cfg.responseMimeType) {
          console.warn(`[prediccion] responseMimeType no soportado ${modeloNombre}, reintento sin él`);
          continue;
        }
        throw e;
      }
    }
    throw new Error("No se obtuvo contenido de Gemini");
  }

  for (let intento = 0; intento < 2; intento++) {
    for (const modeloNombre of modelosCandidatos) {
      let contenido = null;
      try {
        // 1) intento SDK v1beta
        try {
          contenido = await intentarModeloSDK(modeloNombre, intento);
        } catch (sdkErr) {
          const m = String(sdkErr.message || sdkErr);
          // Si 404 / not found en v1beta, probar fetch directo v1 (muchos modelos solo en v1)
          if (m.includes("404") || m.includes("not found") || m.includes("v1beta") || m.includes("is not supported")) {
            console.warn(`[prediccion] SDK v1beta falló ${modeloNombre}: ${m.slice(0,180)} -> probando v1 directo`);
            const r = await callGeminiDirect(modeloNombre, prompt);
            contenido = r.text;
            usage = r.usage;
            if (!contenido.trim()) throw new Error("Respuesta vacía v1");
          } else {
            throw sdkErr;
          }
        }
        const jsonStr = extraerJsonRobusto(contenido);
        try {
          prediccion = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error(`[prediccion] JSON inválido intento ${intento} modelo ${modeloNombre}:`, contenido.substring(0, 800));
          ultimoError = parseErr;
          continue;
        }
        if (!prediccion.nivel_riesgo_predicho || !Array.isArray(prediccion.comportamientos_predichos)) {
          console.error("[prediccion] estructura inválida:", JSON.stringify(prediccion).slice(0, 500));
          ultimoError = new Error("Estructura inesperada");
          prediccion = null;
          continue;
        }
        ultimoError = null;
        break;
      } catch (e) {
        const full = e.message ? `${e.message} | status:${e.status || "?"} | ${JSON.stringify(e.errorDetails || e.cause || "").slice(0,300)}` : String(e);
        console.error(`[prediccion] error modelo=${modeloNombre} intento=${intento}:`, full.slice(0, 800));
        if (e.stack) console.error(e.stack.split("\n").slice(0,3).join(" | "));
        ultimoError = new Error(full);
        if (full.includes("API key") || full.includes("API_KEY") || full.includes("quota") || full.includes("429") || full.includes("403")) break;
      }
    }
    if (prediccion) break;
    if (intento < 1) await new Promise(r => setTimeout(r, 900));
  }

  if (!prediccion) {
    const detalle = String(ultimoError?.message || ultimoError || "respuesta no parseable").slice(0, 500);
    console.warn("[prediccion] usando fallback heurístico tras fallos:", detalle);
    prediccion = construirFallback(datos, detalle.slice(0, 300));
    // Guardar detalle del error en resumen para diagnóstico visible en UI
    prediccion.resumen = `[FALLBACK] ${detalle.slice(0, 250)} — ` + prediccion.resumen;
    modeloUsado = `${modeloUsado}-fallback`;
  } else {
    prediccion.nivel_riesgo_predicho = normalizarNivel(prediccion.nivel_riesgo_predicho);
  }

  // Guardar en base de datos (rasgos_adolescente si existe — tolera si columna aún no existe)
  let result;
  try {
    result = await query(
      `INSERT INTO predicciones_ia
         (estudiante_id, psicologo_id, modelo, nivel_riesgo_predicho,
          comportamientos_predichos, factores_contribuyentes, recomendaciones,
          confianza, resumen, datos_entrada, token_usage, rasgos_adolescente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        estudianteId,
        psicologoId,
        modeloUsado,
        prediccion.nivel_riesgo_predicho,
        JSON.stringify(prediccion.comportamientos_predichos || []),
        JSON.stringify(prediccion.factores_contribuyentes || []),
        JSON.stringify(prediccion.recomendaciones || []),
        prediccion.confianza || null,
        prediccion.resumen || null,
        JSON.stringify(datos),
        usage?.totalTokenCount || usage?.total_token_count || null,
        datos.rasgos_adolescente || null
      ]
    );
  } catch (e) {
    // fallback si columna aún no migrada
    if (String(e.message).includes("rasgos_adolescente")) {
      result = await query(
        `INSERT INTO predicciones_ia
           (estudiante_id, psicologo_id, modelo, nivel_riesgo_predicho,
            comportamientos_predichos, factores_contribuyentes, recomendaciones,
            confianza, resumen, datos_entrada, token_usage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          estudianteId,
          psicologoId,
          modeloUsado,
          prediccion.nivel_riesgo_predicho,
          JSON.stringify(prediccion.comportamientos_predichos || []),
          JSON.stringify(prediccion.factores_contribuyentes || []),
          JSON.stringify(prediccion.recomendaciones || []),
          prediccion.confianza || null,
          prediccion.resumen || null,
          JSON.stringify(datos),
          usage?.totalTokenCount || usage?.total_token_count || null
        ]
      );
    } else throw e;
  }

  return {
    prediccion: result.rows[0],
    datos_entrada: datos
  };
}

async function obtenerPrediccionesEstudiante(estudianteId, limite = 30) {
  const result = await query(
    `SELECT p.*, e.nombres, e.apellidos
     FROM predicciones_ia p
     JOIN estudiantes e ON e.id = p.estudiante_id
     WHERE p.estudiante_id = $1
       AND p.created_at >= NOW() - INTERVAL '30 days'
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [estudianteId, limite]
  );
  return result.rows;
}

async function obtenerPrediccionesPorSeccion(seccionId) {
  const result = await query(
    `SELECT DISTINCT ON (p.estudiante_id)
       p.id, p.estudiante_id, p.nivel_riesgo_predicho, p.confianza,
       p.resumen, p.created_at,
       e.nombres, e.apellidos
     FROM predicciones_ia p
     JOIN estudiantes e ON e.id = p.estudiante_id
     WHERE e.seccion_id = $1 AND e.activo = TRUE
     ORDER BY p.estudiante_id, p.created_at DESC`,
    [seccionId]
  );
  return result.rows;
}

async function eliminarPrediccion(prediccionId) {
  const result = await query(
    "DELETE FROM predicciones_ia WHERE id = $1 RETURNING id",
    [prediccionId]
  );
  return result.rows[0] || null;
}

async function limpiarPrediccionesAntiguas(dias = 30) {
  const result = await query(
    `DELETE FROM predicciones_ia
     WHERE created_at < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [dias]
  );
  return result.rowCount;
}

async function obtenerPrediccionesHoy(limite = 30) {
  // Trae las últimas y filtra por fecha de Lima (America/Lima) para que "hoy" sea el día del colegio
  const result = await query(
    `SELECT p.*, e.nombres, e.apellidos, s.grado, s.letra, s.nivel, s.nombre AS seccion_nombre
     FROM predicciones_ia p
     JOIN estudiantes e ON e.id = p.estudiante_id
     JOIN secciones s ON s.id = e.seccion_id
     ORDER BY p.created_at DESC
     LIMIT 100`
  );
  const hoyLima = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const hoy = result.rows.filter(r => {
    try {
      const d = new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
      return d === hoyLima;
    } catch (_) { return false; }
  }).slice(0, limite);
  return hoy;
}

module.exports = {
  agregarDatosEstudiante,
  generarPrediccionIA,
  obtenerPrediccionesEstudiante,
  obtenerPrediccionesPorSeccion,
  obtenerPrediccionesHoy,
  eliminarPrediccion,
  limpiarPrediccionesAntiguas
};
