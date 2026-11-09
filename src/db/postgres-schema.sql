CREATE TABLE IF NOT EXISTS secciones (
  id SERIAL PRIMARY KEY,
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('Primaria', 'Secundaria')),
  grado VARCHAR(20) NOT NULL,
  letra VARCHAR(5) NOT NULL,
  nombre VARCHAR(40) GENERATED ALWAYS AS (grado || ' ' || letra) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (nivel, grado, letra)
);

-- Día de tutoría por sección (1=Lunes .. 6=Sábado, NULL = sin día asignado)
ALTER TABLE secciones ADD COLUMN IF NOT EXISTS dia_tutoria SMALLINT;

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  correo VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('estudiante', 'docente', 'psicologo')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  legacy_sqlite_id INTEGER UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username_lower
  ON usuarios (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo_lower
  ON usuarios (LOWER(correo));

CREATE TABLE IF NOT EXISTS psicologos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  codigo VARCHAR(30) UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estudiantes (
  id SERIAL PRIMARY KEY,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  correo VARCHAR(180) NOT NULL UNIQUE,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  password_hash TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_seccion_id ON estudiantes(seccion_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_apellidos ON estudiantes(apellidos);

CREATE TABLE IF NOT EXISTS reportes_anonimos (
  id BIGSERIAL PRIMARY KEY,
  estudiante_id INTEGER REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  seccion_id INTEGER REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'revisado', 'archivado')),
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_revision TIMESTAMP,
  revisado_por INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  legacy_sqlite_id INTEGER UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_reportes_anonimos_estado_fecha
  ON reportes_anonimos(estado, fecha_creacion DESC);

CREATE TABLE IF NOT EXISTS reporte_archivos (
  id BIGSERIAL PRIMARY KEY,
  reporte_id BIGINT NOT NULL REFERENCES reportes_anonimos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nombre_archivo VARCHAR(220) NOT NULL,
  tipo_mime VARCHAR(100) NOT NULL,
  contenido_base64 TEXT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reporte_id, nombre_archivo)
);

CREATE INDEX IF NOT EXISTS idx_reporte_archivos_reporte_id
  ON reporte_archivos(reporte_id);

CREATE TABLE IF NOT EXISTS casos_seguimiento (
  id BIGSERIAL PRIMARY KEY,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  psicologo_id INTEGER NOT NULL REFERENCES psicologos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  estado VARCHAR(30) NOT NULL DEFAULT 'abierto'
    CHECK (estado IN ('abierto', 'en_seguimiento', 'cerrado')),
  nivel_prioridad VARCHAR(20) NOT NULL DEFAULT 'media'
    CHECK (nivel_prioridad IN ('baja', 'media', 'alta', 'critica')),
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_caso_seguimiento_activo_estudiante
  ON casos_seguimiento(estudiante_id)
  WHERE estado IN ('abierto', 'en_seguimiento');

CREATE INDEX IF NOT EXISTS idx_casos_seguimiento_psicologo
  ON casos_seguimiento(psicologo_id, fecha_actualizacion DESC);

CREATE TABLE IF NOT EXISTS seguimientos_psicopedagogicos (
  id BIGSERIAL PRIMARY KEY,
  caso_id BIGINT NOT NULL REFERENCES casos_seguimiento(id) ON UPDATE CASCADE ON DELETE CASCADE,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  psicologo_id INTEGER NOT NULL REFERENCES psicologos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tipo_intervencion VARCHAR(120) NOT NULL,
  descripcion TEXT NOT NULL,
  acuerdos TEXT,
  apariencia_vestimenta TEXT,
  apariencia_fisica TEXT,
  estado_emocional TEXT,
  observaciones_adicionales TEXT,
  fecha_intervencion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  proxima_fecha DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_sqlite_id INTEGER UNIQUE
);

ALTER TABLE seguimientos_psicopedagogicos ADD COLUMN IF NOT EXISTS apariencia_vestimenta TEXT;
ALTER TABLE seguimientos_psicopedagogicos ADD COLUMN IF NOT EXISTS apariencia_fisica TEXT;
ALTER TABLE seguimientos_psicopedagogicos ADD COLUMN IF NOT EXISTS estado_emocional TEXT;
ALTER TABLE seguimientos_psicopedagogicos ADD COLUMN IF NOT EXISTS observaciones_adicionales TEXT;

CREATE INDEX IF NOT EXISTS idx_seguimientos_psicopedagogicos_caso
  ON seguimientos_psicopedagogicos(caso_id, fecha_intervencion DESC);
CREATE INDEX IF NOT EXISTS idx_seguimientos_psicopedagogicos_estudiante
  ON seguimientos_psicopedagogicos(estudiante_id, fecha_intervencion DESC);

CREATE TABLE IF NOT EXISTS asistencias (
  id SERIAL PRIMARY KEY,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('Asistió', 'Tardanza', 'Faltó')),
  observacion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (estudiante_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_estudiante_id ON asistencias(estudiante_id);

CREATE TABLE IF NOT EXISTS periodos_academicos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  anio SMALLINT NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  fecha_inicio DATE,
  fecha_fin DATE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (anio, nombre),
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS asignaturas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluaciones_academicas (
  id SERIAL PRIMARY KEY,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  periodo_id INTEGER NOT NULL REFERENCES periodos_academicos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre VARCHAR(140) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  peso NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (peso > 0 AND peso <= 100),
  creado_por INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notas (
  id SERIAL PRIMARY KEY,
  evaluacion_id INTEGER NOT NULL REFERENCES evaluaciones_academicas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  valor NUMERIC(4,2) NOT NULL CHECK (valor >= 0 AND valor <= 20),
  observacion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (evaluacion_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_academicas_seccion ON evaluaciones_academicas(seccion_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_academicas_periodo ON evaluaciones_academicas(periodo_id);
CREATE INDEX IF NOT EXISTS idx_notas_estudiante_id ON notas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_notas_evaluacion_id ON notas(evaluacion_id);

CREATE TABLE IF NOT EXISTS trimestres_academicos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  anio SMALLINT NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  orden SMALLINT NOT NULL CHECK (orden BETWEEN 1 AND 4),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (anio, orden)
);

CREATE TABLE IF NOT EXISTS competencias (
  id SERIAL PRIMARY KEY,
  asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden SMALLINT NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (asignatura_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_competencias_asignatura
  ON competencias(asignatura_id, orden);

CREATE TABLE IF NOT EXISTS niveles_logro (
  codigo VARCHAR(2) PRIMARY KEY CHECK (codigo IN ('AD', 'A', 'B', 'C')),
  nombre VARCHAR(40) NOT NULL,
  descripcion TEXT NOT NULL,
  orden SMALLINT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS docentes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  correo VARCHAR(180) UNIQUE,
  password_hash TEXT,
  debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE docentes ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS productos_evaluacion (
  id SERIAL PRIMARY KEY,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  trimestre_id INTEGER NOT NULL REFERENCES trimestres_academicos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  competencia_id INTEGER NOT NULL REFERENCES competencias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre VARCHAR(220) NOT NULL,
  creado_por INTEGER REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_evaluacion_curso
  ON productos_evaluacion(seccion_id, asignatura_id, trimestre_id);

CREATE TABLE IF NOT EXISTS calificaciones_competencia (
  id BIGSERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos_evaluacion(id) ON UPDATE CASCADE ON DELETE CASCADE,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nivel_logro VARCHAR(2) NOT NULL REFERENCES niveles_logro(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
  observacion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (producto_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_calificaciones_competencia_estudiante
  ON calificaciones_competencia(estudiante_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS calificaciones_trimestrales_competencia (
  id BIGSERIAL PRIMARY KEY,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE CASCADE,
  trimestre_id INTEGER NOT NULL REFERENCES trimestres_academicos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  competencia_id INTEGER NOT NULL REFERENCES competencias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nivel_logro VARCHAR(2) NOT NULL REFERENCES niveles_logro(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
  observacion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (seccion_id, trimestre_id, competencia_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_calificaciones_trimestrales_consulta
  ON calificaciones_trimestrales_competencia(seccion_id, competencia_id, trimestre_id);

CREATE TABLE IF NOT EXISTS formularios_psicologicos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL,
  descripcion TEXT,
  nivel VARCHAR(20) CHECK (nivel IN ('Primaria', 'Secundaria')),
  grado VARCHAR(20),
  seccion VARCHAR(5),
  creado_por INTEGER,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formulario_preguntas (
  id SERIAL PRIMARY KEY,
  formulario_id INTEGER NOT NULL REFERENCES formularios_psicologicos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cerrada', 'abierta', 'likert')),
  pregunta TEXT NOT NULL,
  opciones JSONB,
  orden INTEGER NOT NULL DEFAULT 1,
  obligatoria BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formulario_respuestas (
  id SERIAL PRIMARY KEY,
  formulario_id INTEGER NOT NULL REFERENCES formularios_psicologicos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  pregunta_id INTEGER NOT NULL REFERENCES formulario_preguntas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  estudiante_id INTEGER REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  respuesta TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_formulario_preguntas_formulario_id ON formulario_preguntas(formulario_id);
CREATE INDEX IF NOT EXISTS idx_formulario_respuestas_formulario_id ON formulario_respuestas(formulario_id);
CREATE INDEX IF NOT EXISTS idx_formularios_psicologicos_salon ON formularios_psicologicos(nivel, grado, seccion);
CREATE UNIQUE INDEX IF NOT EXISTS idx_formulario_respuestas_unicas
  ON formulario_respuestas(formulario_id, pregunta_id, estudiante_id);

CREATE TABLE IF NOT EXISTS pregunta_opciones (
  id SERIAL PRIMARY KEY,
  pregunta_id INTEGER NOT NULL REFERENCES formulario_preguntas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  texto VARCHAR(240) NOT NULL,
  puntaje_riesgo NUMERIC(5,2) CHECK (puntaje_riesgo >= 0 AND puntaje_riesgo <= 100),
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (pregunta_id, texto)
);

CREATE INDEX IF NOT EXISTS idx_pregunta_opciones_pregunta_id ON pregunta_opciones(pregunta_id);

CREATE TABLE IF NOT EXISTS docente_secciones (
  docente_id INTEGER NOT NULL REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (docente_id, seccion_id)
);

CREATE INDEX IF NOT EXISTS idx_docente_secciones_docente_id ON docente_secciones(docente_id);
CREATE INDEX IF NOT EXISTS idx_docente_secciones_seccion_id ON docente_secciones(seccion_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_docentes_nombre_completo
  ON docentes (LOWER(nombres), LOWER(apellidos));

CREATE TABLE IF NOT EXISTS docente_asignaturas_secciones (
  docente_id INTEGER NOT NULL REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (docente_id, asignatura_id, seccion_id)
);

CREATE INDEX IF NOT EXISTS idx_docente_asignaturas_docente
  ON docente_asignaturas_secciones(docente_id);
CREATE INDEX IF NOT EXISTS idx_docente_asignaturas_asignatura
  ON docente_asignaturas_secciones(asignatura_id);
CREATE INDEX IF NOT EXISTS idx_docente_asignaturas_seccion
  ON docente_asignaturas_secciones(seccion_id);

CREATE TABLE IF NOT EXISTS formulario_habilitaciones (
  id SERIAL PRIMARY KEY,
  formulario_id INTEGER NOT NULL REFERENCES formularios_psicologicos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  docente_id INTEGER NOT NULL REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_habilitacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (formulario_id, docente_id, seccion_id)
);

CREATE INDEX IF NOT EXISTS idx_formulario_habilitaciones_formulario_id ON formulario_habilitaciones(formulario_id);
CREATE INDEX IF NOT EXISTS idx_formulario_habilitaciones_seccion_id ON formulario_habilitaciones(seccion_id);

CREATE TABLE IF NOT EXISTS configuraciones_riesgo (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  peso_asistencia NUMERIC(5,4) NOT NULL DEFAULT 0.3000 CHECK (peso_asistencia BETWEEN 0 AND 1),
  peso_academico NUMERIC(5,4) NOT NULL DEFAULT 0.4000 CHECK (peso_academico BETWEEN 0 AND 1),
  peso_cuestionario NUMERIC(5,4) NOT NULL DEFAULT 0.0000 CHECK (peso_cuestionario BETWEEN 0 AND 1),
  peso_comportamiento NUMERIC(5,4) NOT NULL DEFAULT 0.3000 CHECK (peso_comportamiento BETWEEN 0 AND 1),
  limite_bajo NUMERIC(5,2) NOT NULL DEFAULT 60 CHECK (limite_bajo BETWEEN 0 AND 100),
  limite_alto NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (limite_alto BETWEEN 0 AND 100),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ABS((peso_asistencia + peso_academico + peso_cuestionario + peso_comportamiento) - 1) < 0.0001),
  CHECK (limite_bajo < limite_alto)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracion_riesgo_activa
  ON configuraciones_riesgo(activo)
  WHERE activo = TRUE;

CREATE TABLE IF NOT EXISTS evaluaciones_riesgo_estudiante (
  id BIGSERIAL PRIMARY KEY,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  periodo_id INTEGER REFERENCES periodos_academicos(id) ON UPDATE CASCADE ON DELETE SET NULL,
  configuracion_id INTEGER NOT NULL REFERENCES configuraciones_riesgo(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha_desde DATE,
  fecha_hasta DATE,
  puntaje_asistencia NUMERIC(5,2) CHECK (puntaje_asistencia BETWEEN 0 AND 100),
  puntaje_academico NUMERIC(5,2) CHECK (puntaje_academico BETWEEN 0 AND 100),
  puntaje_cuestionario NUMERIC(5,2) CHECK (puntaje_cuestionario BETWEEN 0 AND 100),
  puntaje_comportamiento NUMERIC(5,2) CHECK (puntaje_comportamiento BETWEEN 0 AND 100),
  puntaje_global NUMERIC(5,2) CHECK (puntaje_global BETWEEN 0 AND 100),
  nivel VARCHAR(15) CHECK (nivel IN ('Bajo', 'Medio', 'Alto', 'Incompleto')),
  datos_completos BOOLEAN NOT NULL DEFAULT FALSE,
  metricas JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivos JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculado_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (fecha_hasta IS NULL OR fecha_desde IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_riesgo_estudiante
  ON evaluaciones_riesgo_estudiante(estudiante_id, calculado_at DESC);

INSERT INTO periodos_academicos (nombre, anio, activo)
VALUES
  ('Año escolar', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, TRUE),
  ('I Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, TRUE),
  ('II Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, TRUE),
  ('III Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, TRUE),
  ('IV Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, TRUE)
ON CONFLICT (anio, nombre) DO NOTHING;

INSERT INTO asignaturas (nombre, codigo)
VALUES
  ('General', 'GENERAL'),
  ('Matemática', 'MAT'),
  ('Comunicación', 'COM'),
  ('Ciencia y Tecnología', 'CYT'),
  ('Ciencias Sociales', 'CCSS'),
  ('Desarrollo Personal, Ciudadanía y Cívica', 'DPCC'),
  ('Inglés', 'ING'),
  ('Educación Física', 'EF'),
  ('Arte y Cultura', 'ARTE'),
  ('Educación Religiosa', 'REL'),
  ('Tutoría', 'TUT')
ON CONFLICT (codigo) DO NOTHING;

UPDATE configuraciones_riesgo SET activo = FALSE WHERE activo = TRUE AND version NOT IN (3,4);
INSERT INTO configuraciones_riesgo
  (version, peso_asistencia, peso_academico, peso_cuestionario, peso_comportamiento,
   limite_bajo, limite_alto, activo)
VALUES (3, 0.3500, 0.3000, 0.1500, 0.2000, 60, 80, FALSE)
ON CONFLICT (version) DO UPDATE SET
  peso_asistencia = EXCLUDED.peso_asistencia,
  peso_academico = EXCLUDED.peso_academico,
  peso_cuestionario = EXCLUDED.peso_cuestionario,
  peso_comportamiento = EXCLUDED.peso_comportamiento,
  limite_bajo = EXCLUDED.limite_bajo,
  limite_alto = EXCLUDED.limite_alto,
  activo = FALSE;
INSERT INTO configuraciones_riesgo
  (version, peso_asistencia, peso_academico, peso_cuestionario, peso_comportamiento,
   limite_bajo, limite_alto, activo)
VALUES (4, 0.3500, 0.4000, 0.1500, 0.1000, 60, 80, TRUE)
ON CONFLICT (version) DO UPDATE SET
  peso_asistencia = EXCLUDED.peso_asistencia,
  peso_academico = EXCLUDED.peso_academico,
  peso_cuestionario = EXCLUDED.peso_cuestionario,
  peso_comportamiento = EXCLUDED.peso_comportamiento,
  limite_bajo = EXCLUDED.limite_bajo,
  limite_alto = EXCLUDED.limite_alto,
  activo = TRUE;

CREATE TABLE IF NOT EXISTS comportamientos (
  id BIGSERIAL PRIMARY KEY,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  trimestre_id INTEGER NOT NULL REFERENCES trimestres_academicos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nivel VARCHAR(20) NOT NULL
    CHECK (nivel IN ('Excelente', 'Bueno', 'Regular', 'Deficiente')),
  observacion TEXT,
  registrado_por INTEGER REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (estudiante_id, trimestre_id)
);

CREATE INDEX IF NOT EXISTS idx_comportamientos_estudiante
  ON comportamientos(estudiante_id);

-- Observaciones libres del docente por estudiante y bimestre
-- (reemplazo del antiguo "comportamiento" como canal cualitativo)
CREATE TABLE IF NOT EXISTS observaciones_bimestre (
  id SERIAL PRIMARY KEY,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  trimestre_id INTEGER NOT NULL REFERENCES trimestres_academicos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  texto TEXT NOT NULL,
  creado_por INTEGER REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (estudiante_id, trimestre_id)
);

CREATE INDEX IF NOT EXISTS idx_observaciones_bimestre_estudiante
  ON observaciones_bimestre(estudiante_id);

-- Campos de evaluación definidos por el docente para cada curso
CREATE TABLE IF NOT EXISTS campos_nota (
  id SERIAL PRIMARY KEY,
  asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (asignatura_id, nombre)
);

CREATE TABLE IF NOT EXISTS alertas_riesgo (
  id BIGSERIAL PRIMARY KEY,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  evaluacion_id BIGINT REFERENCES evaluaciones_riesgo_estudiante(id) ON UPDATE CASCADE ON DELETE SET NULL,
  tipo VARCHAR(40) NOT NULL,
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('Alto', 'Medio')),
  mensaje TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'atendida')),
  creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atendida_en TIMESTAMP,
  atendida_por INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alertas_riesgo_estado_estudiante
  ON alertas_riesgo(estado, estudiante_id, creada_en DESC);

CREATE TABLE IF NOT EXISTS mensajes_anonimos (
  id BIGSERIAL PRIMARY KEY,
  remitente_tipo VARCHAR(20) NOT NULL
    CHECK (remitente_tipo IN ('estudiante', 'docente', 'psicologo')),
  estudiante_id INTEGER REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  docente_id INTEGER REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  psicologo_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  seccion_id INTEGER REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE SET NULL,
  contenido TEXT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  eliminado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (remitente_tipo = 'estudiante' AND estudiante_id IS NOT NULL) OR
    (remitente_tipo = 'docente' AND docente_id IS NOT NULL) OR
    (remitente_tipo = 'psicologo' AND psicologo_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mensajes_anonimos_remitente
  ON mensajes_anonimos(remitente_tipo, estudiante_id, docente_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_anonimos_psicologo
  ON mensajes_anonimos(psicologo_id, creado_en);

CREATE TABLE IF NOT EXISTS codigos_verificacion (
  id BIGSERIAL PRIMARY KEY,
  destino VARCHAR(180) NOT NULL,
  proposito VARCHAR(40) NOT NULL,
  codigo_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expira_en TIMESTAMP NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_codigos_verificacion_destino
  ON codigos_verificacion(destino, proposito, usado, expira_en);

INSERT INTO pregunta_opciones (pregunta_id, texto, orden)
SELECT
  p.id,
  CASE
    WHEN jsonb_typeof(opcion.valor) = 'string' THEN opcion.valor #>> '{}'
    ELSE COALESCE(opcion.valor ->> 'texto', opcion.valor ->> 'label')
  END,
  opcion.orden::INTEGER
FROM formulario_preguntas p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.opciones, '[]'::jsonb))
  WITH ORDINALITY AS opcion(valor, orden)
WHERE p.tipo = 'cerrada'
  AND CASE
    WHEN jsonb_typeof(opcion.valor) = 'string' THEN opcion.valor #>> '{}'
    ELSE COALESCE(opcion.valor ->> 'texto', opcion.valor ->> 'label')
  END IS NOT NULL
ON CONFLICT (pregunta_id, texto) DO NOTHING;

INSERT INTO secciones (nivel, grado, letra)
VALUES
  ('Secundaria', '4to', 'F'),
  ('Secundaria', '5to', 'A')
ON CONFLICT (nivel, grado, letra) DO NOTHING;

-- Secciones personalizadas (ej: 4to D) se mantienen para docentes tutores - no borrar
-- DELETEs removidos para permitir cualquier sección creada por la directora

-- Docentes de demostracion removidos: solo directora solicitada (Maria Vallejos)
-- Los 22 docentes anteriores (Juan Perez, Maria Lopez, Gilma Torres, etc.) fueron eliminados a peticion
-- y ya no se insertan automaticamente. Se mantienen los catalogos de asignaturas y competencias.

INSERT INTO trimestres_academicos (nombre, anio, orden)
VALUES
  ('I Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 1),
  ('II Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 2),
  ('III Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 3),
  ('IV Bimestre', EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, 4)
ON CONFLICT (anio, orden) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  activo = TRUE;

INSERT INTO niveles_logro (codigo, nombre, descripcion, orden)
VALUES
  ('AD', 'Logro destacado', 'El estudiante evidencia un nivel superior a lo esperado respecto a la competencia y demuestra aprendizajes que van más allá del nivel esperado.', 1),
  ('A', 'Logro esperado', 'El estudiante evidencia el nivel esperado respecto a la competencia, demostrando manejo satisfactorio en las tareas propuestas y en el tiempo programado.', 2),
  ('B', 'En proceso', 'El estudiante está próximo o cerca al nivel esperado respecto a la competencia y requiere acompañamiento durante un tiempo razonable para lograrlo.', 3),
  ('C', 'En inicio', 'El estudiante muestra un progreso mínimo en la competencia, evidencia dificultades y necesita mayor tiempo de acompañamiento e intervención docente.', 4)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden;

WITH catalogo(codigo, competencia, orden) AS (
  VALUES
    ('DPCC', 'Construye su identidad', 1),
    ('DPCC', 'Convive y participa democráticamente', 2),
    ('CCSS', 'Construye interpretaciones históricas', 1),
    ('CCSS', 'Gestiona responsablemente el espacio y el ambiente', 2),
    ('CCSS', 'Gestiona responsablemente los recursos económicos', 3),
    ('EPT', 'Gestiona proyectos de emprendimiento económico o social', 1),
    ('EF', 'Se desenvuelve de manera autónoma a través de su motricidad', 1),
    ('EF', 'Asume una vida saludable', 2),
    ('EF', 'Interactúa a través de sus habilidades sociomotrices', 3),
    ('COM', 'Se comunica oralmente en su lengua materna', 1),
    ('COM', 'Lee diversos tipos de textos escritos', 2),
    ('COM', 'Escribe diversos tipos de textos', 3),
    ('ARTE', 'Aprecia de manera crítica manifestaciones artístico-culturales', 1),
    ('ARTE', 'Crea proyectos desde los lenguajes artísticos', 2),
    ('ING', 'Se comunica oralmente en inglés como lengua extranjera', 1),
    ('ING', 'Lee diversos tipos de textos en inglés como lengua extranjera', 2),
    ('ING', 'Escribe diversos tipos de textos en inglés como lengua extranjera', 3),
    ('MAT', 'Resuelve problemas de cantidad', 1),
    ('MAT', 'Resuelve problemas de regularidad, equivalencia y cambio', 2),
    ('MAT', 'Resuelve problemas de movimiento, forma y localización', 3),
    ('MAT', 'Resuelve problemas de gestión de datos e incertidumbre', 4),
    ('CYT', 'Indaga mediante métodos científicos para construir conocimientos', 1),
    ('CYT', 'Explica el mundo natural y artificial en base a conocimientos sobre los seres vivos; materia y energía; biodiversidad, Tierra y Universo', 2),
    ('CYT', 'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno', 3),
    ('REL', 'Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente, comprendiendo la doctrina de su propia religión, abierto al diálogo con las que le son cercanas', 1),
    ('REL', 'Asume la experiencia del encuentro personal y comunitario con Dios en su proyecto de vida en coherencia con su creencia religiosa', 2)
)
INSERT INTO competencias (asignatura_id, nombre, orden)
SELECT a.id, c.competencia, c.orden
FROM catalogo c
JOIN asignaturas a ON a.codigo = c.codigo
ON CONFLICT (asignatura_id, nombre) DO UPDATE SET
  orden = EXCLUDED.orden,
  activo = TRUE;

-- Verificación por código (reutilizado de OmniCash: OTP 6 dígitos, hash SHA256 + salt)
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(180) NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_purpose ON verification_codes(email, purpose);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

CREATE TABLE IF NOT EXISTS pending_registrations (
  email VARCHAR(180) PRIMARY KEY,
  data_json TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Predicciones IA para estudiantes
CREATE TABLE IF NOT EXISTS predicciones_ia (
  id BIGSERIAL PRIMARY KEY,
  estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  psicologo_id INTEGER REFERENCES psicologos(id) ON UPDATE CASCADE ON DELETE SET NULL,
  modelo VARCHAR(50) NOT NULL DEFAULT 'gpt-4o',
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
