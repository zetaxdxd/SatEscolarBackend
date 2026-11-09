const app  = require("./app");
const fs   = require("fs");
const path = require("path");
const { query, closePool } = require("./config/postgres");

const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || "sat_escolar_secret_2025";
if (process.env.NODE_ENV === "production" &&
    (JWT_SECRET === "sat_escolar_secret_2025" || JWT_SECRET === "cambia_esto_por_una_clave_segura_2025")) {
  console.error("\n⚠️  SEGURIDAD: JWT_SECRET no está configurado con un valor seguro en producción.\n" +
                "   Define JWT_SECRET con una clave fuerte y aleatoria en las variables de entorno.\n");
}

async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, "db", "postgres-schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await query(schema);
    console.log("✅ Tablas PostgreSQL inicializadas correctamente");
  } catch (error) {
    console.error("⚠️ Error inicializando tablas:", error.message);
  }
  // Migraciones aisladas: cada una con su propio try/catch para que un fallo
  // del lote principal no impida aplicarlas
  const migracionesAisladas = [
    ["dia_tutoria", "ALTER TABLE secciones ADD COLUMN IF NOT EXISTS dia_tutoria SMALLINT"],
    ["predicciones_ia", `
      CREATE TABLE IF NOT EXISTS predicciones_ia (
        id BIGSERIAL PRIMARY KEY,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        psicologo_id INTEGER REFERENCES psicologos(id) ON UPDATE CASCADE ON DELETE SET NULL,
        modelo VARCHAR(50) NOT NULL DEFAULT 'gemini-3.5-flash',
        nivel_riesgo_predicho VARCHAR(15) NOT NULL CHECK (nivel_riesgo_predicho IN ('Bajo', 'Medio', 'Alto')),
        comportamientos_predichos JSONB NOT NULL DEFAULT '[]'::jsonb,
        factores_contribuyentes JSONB NOT NULL DEFAULT '[]'::jsonb,
        recomendaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
        confianza NUMERIC(5,2) CHECK (confianza BETWEEN 0 AND 100),
        resumen TEXT,
        datos_entrada JSONB NOT NULL DEFAULT '{}'::jsonb,
        token_usage INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_predicciones_ia_estudiante ON predicciones_ia(estudiante_id, created_at DESC);
    `],
    ["predicciones_ia_fix_nullable", "ALTER TABLE predicciones_ia ALTER COLUMN psicologo_id DROP NOT NULL"],
    ["seguimiento_evidencia", `
      ALTER TABLE seguimientos_psicopedagogicos ADD COLUMN IF NOT EXISTS evidencia_base64 TEXT;
      ALTER TABLE seguimientos_psicopedagogicos ADD COLUMN IF NOT EXISTS evidencia_tipo VARCHAR(50);
    `],
    ["prediccion_rasgos", `ALTER TABLE predicciones_ia ADD COLUMN IF NOT EXISTS rasgos_adolescente TEXT;`],
    ["seguimiento_rasgos", `ALTER TABLE seguimientos_psicopedagogicos ADD COLUMN IF NOT EXISTS rasgos_adolescente TEXT;`],
    ["caso_observacion", `ALTER TABLE casos_seguimiento ADD COLUMN IF NOT EXISTS observacion_cambio TEXT;`],
    ["tests_validados_flag", `
      ALTER TABLE formularios_psicologicos ADD COLUMN IF NOT EXISTS es_validado BOOLEAN DEFAULT FALSE;
      ALTER TABLE formularios_psicologicos ADD COLUMN IF NOT EXISTS codigo_minsa VARCHAR(30);
    `],
    ["tests_personalizados", `
      CREATE TABLE IF NOT EXISTS tests_personalizados (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT DEFAULT '',
        preguntas JSONB NOT NULL DEFAULT '[]',
        opciones JSONB NOT NULL DEFAULT '[]',
        rangos JSONB DEFAULT '[]',
        puntaje_max INTEGER DEFAULT 0,
        tiempo VARCHAR(20) DEFAULT '2 min',
        validacion VARCHAR(200) DEFAULT 'Personalizado',
        autor VARCHAR(200) DEFAULT '',
        activo BOOLEAN DEFAULT TRUE,
        creado_por INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `],
    ["tests_autor_column", `
      ALTER TABLE tests_personalizados ADD COLUMN IF NOT EXISTS autor VARCHAR(200) DEFAULT '';
    `],
    ["config_riesgo_v4", `
      UPDATE configuraciones_riesgo SET activo = FALSE WHERE version != 4;
      INSERT INTO configuraciones_riesgo (version, peso_asistencia, peso_academico, peso_cuestionario, peso_comportamiento, limite_bajo, limite_alto, activo)
      VALUES (4, 0.3500, 0.4000, 0.1500, 0.1000, 60, 80, TRUE)
      ON CONFLICT (version) DO UPDATE SET peso_asistencia=EXCLUDED.peso_asistencia, peso_academico=EXCLUDED.peso_academico, peso_cuestionario=EXCLUDED.peso_cuestionario, peso_comportamiento=EXCLUDED.peso_comportamiento, limite_bajo=EXCLUDED.limite_bajo, limite_alto=EXCLUDED.limite_alto, activo=TRUE;
      UPDATE configuraciones_riesgo SET activo = FALSE WHERE version != 4;
    `],
    ["perfiles_estudiante", `
      CREATE TABLE IF NOT EXISTS perfiles_estudiante (
        id SERIAL PRIMARY KEY,
        estudiante_id INTEGER UNIQUE NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        dni VARCHAR(20),
        fecha_nacimiento DATE,
        direccion TEXT,
        telefono VARCHAR(20),
        con_quien_vive VARCHAR(30) CHECK (con_quien_vive IN ('padres','madre','padre','abuelos','tutor','albergue','solo','otro')),
        situacion_convivencia VARCHAR(30) CHECK (situacion_convivencia IN ('estable','conflictiva','violencia','ausencia','sobreproteccion')),
        antecedentes TEXT,
        apoderado_nombre VARCHAR(120),
        apoderado_dni VARCHAR(20),
        apoderado_parentesco VARCHAR(30),
        apoderado_telefono VARCHAR(20),
        apoderado_ocupacion VARCHAR(80),
        perfil_completado BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_perfiles_estudiante_estudiante ON perfiles_estudiante(estudiante_id);
    `],
    ["auditoria_accesos", `
      CREATE TABLE IF NOT EXISTS auditoria_accesos (
        id BIGSERIAL PRIMARY KEY,
        fecha TIMESTAMP DEFAULT NOW(),
        usuario_id INTEGER,
        rol VARCHAR(20),
        accion VARCHAR(60) NOT NULL,
        estudiante_id INTEGER,
        detalle TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_accesos(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_auditoria_estudiante ON auditoria_accesos(estudiante_id);
    `],
    ["incidencias", `
      CREATE TABLE IF NOT EXISTS incidencias (
        id BIGSERIAL PRIMARY KEY,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('tardanza_reiterada','falta_injustificada','agresion','vandalismo','consumo_sospecha','desinteres','otro')),
        descripcion TEXT NOT NULL,
        observacion TEXT,
        creado_por INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
        rol_creador VARCHAR(20) CHECK (rol_creador IN ('docente','tutor','psicologo','director')),
        fecha_incidencia DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_incidencias_estudiante ON incidencias(estudiante_id, fecha_incidencia DESC);
    `],
    ["derivaciones", `
      CREATE TABLE IF NOT EXISTS derivaciones (
        id BIGSERIAL PRIMARY KEY,
        incidencia_id BIGINT REFERENCES incidencias(id) ON UPDATE CASCADE ON DELETE SET NULL,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        origen_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
        origen_rol VARCHAR(20) CHECK (origen_rol IN ('docente','tutor','psicologo','director')),
        destino VARCHAR(20) NOT NULL CHECK (destino IN ('psicologo','tutor','direccion')),
        motivo TEXT NOT NULL,
        informe TEXT,
        expediente JSONB DEFAULT '{}'::jsonb,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','atendida','archivada')),
        fecha_derivacion TIMESTAMP DEFAULT NOW(),
        atendida_en TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_derivaciones_destino ON derivaciones(destino, estado, fecha_derivacion DESC);
      CREATE INDEX IF NOT EXISTS idx_derivaciones_estudiante ON derivaciones(estudiante_id, fecha_derivacion DESC);
    `],
    ["expediente_formatos", `
      CREATE TABLE IF NOT EXISTS expediente_formatos (
        id BIGSERIAL PRIMARY KEY,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('ficha_diagnostica','consentimiento','acta_compromiso','entrevista_estudiante','entrevista_padre','ficha_estudiante','visita_domiciliaria','derivacion_externa','seguimiento')),
        correlativo INTEGER NOT NULL,
        datos JSONB NOT NULL DEFAULT '{}'::jsonb,
        archivo_base64 TEXT,
        archivo_tipo VARCHAR(100),
        archivo_nombre VARCHAR(220),
        estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','archivado')),
        creado_por INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
        fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (estudiante_id, tipo, correlativo)
      );
      CREATE INDEX IF NOT EXISTS idx_expediente_estudiante ON expediente_formatos(estudiante_id, tipo, correlativo);
      CREATE INDEX IF NOT EXISTS idx_expediente_fecha ON expediente_formatos(estudiante_id, fecha_registro DESC);
    `],
    ["charlas_aula", `
      CREATE TABLE IF NOT EXISTS charlas_aula (
        id BIGSERIAL PRIMARY KEY,
        seccion_id INTEGER REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE SET NULL,
        grado VARCHAR(10),
        seccion VARCHAR(5),
        fecha DATE NOT NULL DEFAULT CURRENT_DATE,
        tema VARCHAR(200) NOT NULL,
        motivo TEXT,
        descripcion TEXT,
        participantes INTEGER,
        psicologo_id INTEGER REFERENCES psicologos(id) ON UPDATE CASCADE ON DELETE SET NULL,
        creado_por INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_charlas_fecha ON charlas_aula(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_charlas_seccion ON charlas_aula(seccion_id, fecha DESC);
    `],
    ["ficha_diagnostica_socioeducativa", `
      CREATE TABLE IF NOT EXISTS fichas_diagnosticas_socioeducativas (
        id BIGSERIAL PRIMARY KEY,
        estudiante_id INTEGER UNIQUE NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        datos JSONB NOT NULL DEFAULT '{}'::jsonb,
        completada BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fichas_diagnosticas_estudiante ON fichas_diagnosticas_socioeducativas(estudiante_id);
    `],
    ["evaluaciones_anuales", `
      CREATE TABLE IF NOT EXISTS evaluaciones_anuales (
        id BIGSERIAL PRIMARY KEY,
        anio INTEGER NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT,
        tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('habilidades_socioemocionales','contexto_emocional','ideacion_suicida','consumo_drogas','general')),
        estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cerrada','archivada')),
        creado_por INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (anio, nombre)
      );
      CREATE TABLE IF NOT EXISTS evaluacion_anual_respuestas (
        id BIGSERIAL PRIMARY KEY,
        evaluacion_id INTEGER NOT NULL REFERENCES evaluaciones_anuales(id) ON UPDATE CASCADE ON DELETE CASCADE,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
        puntaje_total INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (evaluacion_id, estudiante_id)
      );
      CREATE INDEX IF NOT EXISTS idx_eval_anual_respuestas_eval ON evaluacion_anual_respuestas(evaluacion_id);
      CREATE INDEX IF NOT EXISTS idx_eval_anual_respuestas_est ON evaluacion_anual_respuestas(estudiante_id);
    `],
    ["nee_perfil", `
      ALTER TABLE perfiles_estudiante ADD COLUMN IF NOT EXISTS nee VARCHAR(30) DEFAULT 'ninguna' CHECK (nee IN ('ninguna','TDAH','TEA','discapacidad_intelectual','trastorno_lenguaje','otro'));
      ALTER TABLE perfiles_estudiante ADD COLUMN IF NOT EXISTS nee_detalle TEXT;
      ALTER TABLE casos_seguimiento ADD COLUMN IF NOT EXISTS estado_caso VARCHAR(30) DEFAULT 'en_psicologia' CHECK (estado_caso IN ('en_psicologia','en_direccion','derivado_externo','cerrado'));
    `]
  ];
  for (const [nombre, sql] of migracionesAisladas) {
    try {
      await query(sql);
      console.log(`✅ Migración ${nombre} verificada`);
    } catch (error) {
      console.error(`⚠️ Migración ${nombre}:`, error.message);
    }
  }
  // Limpiar predicciones antiguas (>30 días) al arrancar
  try {
    const res = await query(
      "DELETE FROM predicciones_ia WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id"
    );
    if (res.rowCount > 0) console.log(`🧹 ${res.rowCount} predicciones antiguas eliminadas`);
  } catch (_) {}
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 SAT Escolar Backend corriendo en http://localhost:${PORT}`);
    console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  });
});