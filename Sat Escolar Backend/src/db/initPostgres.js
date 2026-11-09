// src/db/initPostgres.js

const fs = require("fs");
const path = require("path");
const { query, closePool } = require("../config/postgres");

async function initPostgres() {
  const schemaPath = path.join(__dirname, "postgres-schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  await query(schema);
  console.log("✅ Tablas PostgreSQL creadas correctamente");
}

initPostgres()
  .catch(error => {
    console.error("❌ Error inicializando PostgreSQL:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
