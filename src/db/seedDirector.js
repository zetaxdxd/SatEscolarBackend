// db/seedDirector.js
// Crea (o actualiza) la cuenta de superusuario: la directora del colegio.

const bcrypt = require("bcryptjs");
require("dotenv").config();

const { pool, closePool } = require("../config/postgres");

const DIRECTORA = {
  username: "directora",
  correo: "directora@ofelia.edu.pe",
  nombres: "Laura Felicia",
  apellidos: "Velázquez",
  password: "Directora2026!"
};

async function seedDirectora() {
  const passwordHash = await bcrypt.hash(DIRECTORA.password, 10);

  await pool.query(
    `
      INSERT INTO usuarios (username, correo, password_hash, rol, activo, nombres, apellidos)
      VALUES ($1, $2, $3, 'director', TRUE, $4, $5)
      ON CONFLICT (username) DO UPDATE SET
        correo = EXCLUDED.correo,
        password_hash = EXCLUDED.password_hash,
        rol = 'director',
        activo = TRUE,
        nombres = EXCLUDED.nombres,
        apellidos = EXCLUDED.apellidos,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      DIRECTORA.username,
      DIRECTORA.correo,
      passwordHash,
      DIRECTORA.nombres,
      DIRECTORA.apellidos
    ]
  );

  console.log(`Directora creada: ${DIRECTORA.username} (${DIRECTORA.correo})`);
}

seedDirectora()
  .catch(error => {
    console.error("Error creando la directora:", error.message);
    process.exitCode = 1;
  })
  .finally(closePool);