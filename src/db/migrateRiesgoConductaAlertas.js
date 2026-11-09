// db/migrateRiesgoConductaAlertas.js
// Añade la dimensión de comportamiento al motor de riesgo, la tabla de
// alertas para el psicólogo y el tipo de pregunta Likert (1-5).

const { pool, closePool } = require("../config/postgres");

async function migrarRiesgoConductaAlertas() {
  await pool.query(`
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
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_comportamientos_estudiante
      ON comportamientos(estudiante_id);
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_alertas_riesgo_estado_estudiante
      ON alertas_riesgo(estado, estudiante_id, creada_en DESC);
  `);

  await pool.query(`
    ALTER TABLE configuraciones_riesgo
      ADD COLUMN IF NOT EXISTS peso_comportamiento NUMERIC(5,4) NOT NULL DEFAULT 0.3000
        CHECK (peso_comportamiento BETWEEN 0 AND 1)
  `);

  await pool.query(`
    ALTER TABLE evaluaciones_riesgo_estudiante
      ADD COLUMN IF NOT EXISTS puntaje_comportamiento NUMERIC(5,2)
        CHECK (puntaje_comportamiento BETWEEN 0 AND 100)
  `);

  await pool.query(`
    ALTER TABLE configuraciones_riesgo DROP CONSTRAINT IF EXISTS configuraciones_riesgo_check
  `);

  await pool.query(`
    UPDATE configuraciones_riesgo
    SET peso_comportamiento = 0.3000,
        peso_academico = 0.4000,
        peso_cuestionario = 0.0000
    WHERE peso_comportamiento = 0.3000
      AND peso_academico = 0.5000
      AND peso_cuestionario = 0.2000
  `);

  await pool.query(`
    ALTER TABLE configuraciones_riesgo
      ADD CONSTRAINT configuraciones_riesgo_check
      CHECK (
        ABS((peso_asistencia + peso_academico + peso_cuestionario + peso_comportamiento) - 1) < 0.0001
      )
  `);

  await pool.query(`
    UPDATE configuraciones_riesgo SET activo = FALSE
  `);

  await pool.query(`
    INSERT INTO configuraciones_riesgo
      (version, peso_asistencia, peso_academico, peso_cuestionario, peso_comportamiento,
       limite_bajo, limite_alto, activo)
    VALUES (2, 0.3000, 0.4000, 0.0000, 0.3000, 60, 80, TRUE)
    ON CONFLICT (version) DO UPDATE SET
      peso_asistencia = EXCLUDED.peso_asistencia,
      peso_academico = EXCLUDED.peso_academico,
      peso_cuestionario = EXCLUDED.peso_cuestionario,
      peso_comportamiento = EXCLUDED.peso_comportamiento,
      limite_bajo = EXCLUDED.limite_bajo,
      limite_alto = EXCLUDED.limite_alto,
      activo = TRUE
  `);

  await pool.query(`
    ALTER TABLE formulario_preguntas DROP CONSTRAINT IF EXISTS formulario_preguntas_tipo_check
  `);

  await pool.query(`
    ALTER TABLE formulario_preguntas
      ADD CONSTRAINT formulario_preguntas_tipo_check
      CHECK (tipo IN ('cerrada', 'abierta', 'likert'))
  `);

  console.log("Dimensión comportamiento + alertas + Likert configuradas (versión 2 de pesos)");
}

migrarRiesgoConductaAlertas()
  .catch(error => {
    console.error("Error migrando riesgo/conducta/alertas:", error.message);
    process.exitCode = 1;
  })
  .finally(closePool);