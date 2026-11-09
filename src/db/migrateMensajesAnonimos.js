// db/migrateMensajesAnonimos.js
// Chat anónimo entre estudiantes/docentes y el psicólogo, con eliminación
// protegida por contraseña + código OTP (patrón OmniCash).

const { pool, closePool } = require("../config/postgres");

async function migrarMensajesAnonimos() {
  await pool.query(`
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
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mensajes_anonimos_remitente
      ON mensajes_anonimos(remitente_tipo, estudiante_id, docente_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mensajes_anonimos_psicologo
      ON mensajes_anonimos(psicologo_id, creado_en);
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_codigos_verificacion_destino
      ON codigos_verificacion(destino, proposito, usado, expira_en);
  `);

  console.log("Chat anónimo + códigos OTP configurados");
}

migrarMensajesAnonimos()
  .catch(error => {
    console.error("Error migrando el chat anónimo:", error.message);
    process.exitCode = 1;
  })
  .finally(closePool);