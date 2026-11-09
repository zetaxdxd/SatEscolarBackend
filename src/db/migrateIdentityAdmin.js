// db/migrateIdentityAdmin.js
// Agrega soporte para el superusuario (director) y para docentes tutores.

const { pool, closePool } = require("../config/postgres");

async function migrarIdentidadAdministrativa() {
  await pool.query(`
    ALTER TABLE docentes
      ADD COLUMN IF NOT EXISTS es_tutor BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS nombres VARCHAR(120)
  `);

  await pool.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS apellidos VARCHAR(120)
  `);

  await pool.query(`
    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check
  `);

  await pool.query(`
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('estudiante', 'docente', 'psicologo', 'director'))
  `);

  console.log("Identidad administrativa migrada (rol director + docentes tutores)");
}

migrarIdentidadAdministrativa()
  .catch(error => {
    console.error("Error migrando la identidad administrativa:", error.message);
    process.exitCode = 1;
  })
  .finally(closePool);