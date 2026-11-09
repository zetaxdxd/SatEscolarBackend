// db/migrateLegacyEstudianteToPostgres.js
// Crea en PostgreSQL las tablas que el flujo legacy /api/estudiantes usaba en
// SQLite, para poder eliminar la capa SQLite sin perder funcionalidad.
// Tablas espejadas de models/estudianteModel.js (SQLite).

const { pool, closePool } = require("../config/postgres");

async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros_docente (
      id BIGSERIAL PRIMARY KEY,
      estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
      docente_id    INTEGER REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE SET NULL,
      evaluacion    VARCHAR(40) NOT NULL DEFAULT 'Semanal',
      asistencia    VARCHAR(40),
      nota          NUMERIC(4,2),
      conducta      VARCHAR(40),
      observacion   TEXT,
      fecha         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_registros_docente_estudiante ON registros_docente(estudiante_id, fecha DESC);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS formularios_activos (
      id BIGSERIAL PRIMARY KEY,
      docente_id INTEGER REFERENCES docentes(id) ON UPDATE CASCADE ON DELETE SET NULL,
      grado      VARCHAR(20) NOT NULL,
      seccion    VARCHAR(20) NOT NULL,
      activo     BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_activacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_formularios_activos_grupo ON formularios_activos(grado, seccion);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS respuestas_formulario (
      id BIGSERIAL PRIMARY KEY,
      formulario_id INTEGER NOT NULL REFERENCES formularios_activos(id) ON UPDATE CASCADE ON DELETE CASCADE,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
      pregunta1 TEXT,
      pregunta2 TEXT,
      pregunta3 TEXT,
      pregunta4 TEXT,
      pregunta5 TEXT,
      riesgo_socio VARCHAR(20),
      puntaje_socio NUMERIC(5,2),
      fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (formulario_id, estudiante_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS evaluaciones_riesgo (
      id BIGSERIAL PRIMARY KEY,
      estudiante_id INTEGER NOT NULL UNIQUE REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
      nivel_riesgo       VARCHAR(20),
      puntaje_total      NUMERIC(6,2),
      puntaje_academico  NUMERIC(6,2),
      puntaje_asistencia NUMERIC(6,2),
      puntaje_conducta   NUMERIC(6,2),
      puntaje_socio      NUMERIC(6,2),
      ultima_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Tablas legacy migradas a PostgreSQL (registros_docente, formularios_activos, respuestas_formulario, evaluaciones_riesgo).");
}

migrar()
  .catch(error => { console.error("Error:", error.message); process.exitCode = 1; })
  .finally(closePool);