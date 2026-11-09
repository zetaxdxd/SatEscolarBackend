const { query } = require("../../config/postgres");

async function buscarUsuarioSistemaPorIdentificador(identificador) {
  const result = await query(
    `
      SELECT
        u.id AS usuario_id,
        u.username,
        u.correo,
        u.password_hash,
        u.rol,
        u.activo,
        p.id AS psicologo_id,
        p.nombres,
        p.apellidos,
        p.codigo AS psicologo_codigo
      FROM usuarios u
      LEFT JOIN psicologos p
        ON p.usuario_id = u.id
       AND p.activo = TRUE
      WHERE (LOWER(u.username) = LOWER($1) OR LOWER(u.correo) = LOWER($1))
        AND u.activo = TRUE
      LIMIT 1
    `,
    [identificador]
  );

  return result.rows[0] || null;
}

module.exports = { buscarUsuarioSistemaPorIdentificador, listarCorreosUsuariosSistema };

async function listarCorreosUsuariosSistema() {
  const result = await query(
    `
      SELECT correo, username, rol
      FROM usuarios
      WHERE activo = TRUE
      ORDER BY correo
    `
  );
  return result.rows;
}
