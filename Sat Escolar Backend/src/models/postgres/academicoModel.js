const { pool, query } = require("../../config/postgres");

async function listarPeriodos({ soloActivos = true } = {}) {
  const result = await query(
    `
      SELECT id, nombre, anio, fecha_inicio, fecha_fin, activo
      FROM periodos_academicos
      ${soloActivos ? "WHERE activo = TRUE" : ""}
      ORDER BY anio DESC, fecha_inicio NULLS LAST, id DESC
    `
  );
  return result.rows;
}

async function listarAsignaturas({ soloActivas = true, seccionId, userId, userEmail, role } = {}) {
  const params = [];
  const where = [];
  let asignacionesJoin = "";

  if (soloActivas) where.push("a.activo = TRUE");
  if (seccionId || role === "docente") {
    asignacionesJoin = `
      JOIN docente_asignaturas_secciones das ON das.asignatura_id = a.id
    `;
  }
  if (seccionId) {
    params.push(seccionId);
    where.push(`das.seccion_id = $${params.length}`);
  }
  if (role === "docente") {
    params.push(userId);
    const userParam = params.length;
    params.push(userEmail || null);
    const emailParam = params.length;
    asignacionesJoin += `
      JOIN docentes d ON d.id = das.docente_id
    `;
    where.push(`${filtroDocentePorUsuario(userParam, emailParam)} AND d.activo = TRUE`);
  }

  const result = await query(
    `
      SELECT DISTINCT a.id, a.nombre, a.codigo, a.activo
      FROM asignaturas a
      ${asignacionesJoin}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.nombre
    `,
    params
  );
  return result.rows;
}

function filtroDocentePorUsuario(paramUserId, paramEmail) {
  return `(d.user_id = $${paramUserId} OR LOWER(d.correo) = LOWER($${paramEmail}))`;
}

async function crearEvaluacion({ userId, userEmail = null, seccionId, periodoId, asignaturaId, nombre, fecha, peso }) {
  const result = await query(
    `
      INSERT INTO evaluaciones_academicas
        (seccion_id, periodo_id, asignatura_id, nombre, fecha, peso, creado_por)
      SELECT $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, d.id
      FROM docentes d
      JOIN docente_asignaturas_secciones das
        ON das.docente_id = d.id
       AND das.seccion_id = $2
       AND das.asignatura_id = $4
      WHERE ${filtroDocentePorUsuario(1, 8)}
        AND d.activo = TRUE
      LIMIT 1
      RETURNING *
    `,
    [userId, seccionId, periodoId, asignaturaId, nombre, fecha || null, peso, userEmail]
  );
  return result.rows[0] || null;
}

async function listarEvaluaciones({ userId, userEmail = null, role, seccionId, periodoId, asignaturaId }) {
  const params = [];
  const where = [];

  if (seccionId) {
    params.push(seccionId);
    where.push(`ev.seccion_id = $${params.length}`);
  }
  if (periodoId) {
    params.push(periodoId);
    where.push(`ev.periodo_id = $${params.length}`);
  }
  if (asignaturaId) {
    params.push(asignaturaId);
    where.push(`ev.asignatura_id = $${params.length}`);
  }
  if (role === "docente") {
    params.push(userId);
    const userParam = params.length;
    params.push(userEmail);
    const emailParam = params.length;
    where.push(`EXISTS (
      SELECT 1
      FROM docentes d
      JOIN docente_asignaturas_secciones das ON das.docente_id = d.id
      WHERE ${filtroDocentePorUsuario(userParam, emailParam)}
        AND d.activo = TRUE
        AND das.seccion_id = ev.seccion_id
        AND das.asignatura_id = ev.asignatura_id
    )`);
  }

  const result = await query(
    `
      SELECT
        ev.id,
        ev.nombre,
        ev.fecha,
        ev.peso,
        ev.seccion_id,
        s.nivel,
        s.grado,
        s.letra,
        s.nombre AS seccion,
        pa.id AS periodo_id,
        pa.nombre AS periodo,
        pa.anio,
        a.id AS asignatura_id,
        a.nombre AS asignatura,
        COUNT(n.id)::int AS total_notas
      FROM evaluaciones_academicas ev
      JOIN secciones s ON s.id = ev.seccion_id
      JOIN periodos_academicos pa ON pa.id = ev.periodo_id
      JOIN asignaturas a ON a.id = ev.asignatura_id
      LEFT JOIN notas n ON n.evaluacion_id = ev.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY ev.id, s.id, pa.id, a.id
      ORDER BY ev.fecha DESC, ev.id DESC
    `,
    params
  );
  return result.rows;
}

async function guardarNotas({ userId, userEmail = null, evaluacionId, registros }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const acceso = await client.query(
      `
        SELECT ev.id, ev.seccion_id
        FROM evaluaciones_academicas ev
        JOIN docente_asignaturas_secciones das
          ON das.seccion_id = ev.seccion_id
         AND das.asignatura_id = ev.asignatura_id
        JOIN docentes d ON d.id = das.docente_id
        WHERE ev.id = $1
          AND ${filtroDocentePorUsuario(2, 3)}
          AND d.activo = TRUE
        LIMIT 1
      `,
      [evaluacionId, userId, userEmail]
    );

    const evaluacion = acceso.rows[0];
    if (!evaluacion) {
      const error = new Error("La evaluación no pertenece a una sección asignada al docente");
      error.status = 403;
      throw error;
    }

    const guardadas = [];
    for (const registro of registros) {
      const result = await client.query(
        `
          INSERT INTO notas (evaluacion_id, estudiante_id, valor, observacion)
          SELECT $1, e.id, $3, $4
          FROM estudiantes e
          WHERE e.id = $2 AND e.seccion_id = $5 AND e.activo = TRUE
          ON CONFLICT (evaluacion_id, estudiante_id)
          DO UPDATE SET
            valor = EXCLUDED.valor,
            observacion = EXCLUDED.observacion,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `,
        [
          evaluacionId,
          registro.estudianteId,
          registro.valor,
          registro.observacion || null,
          evaluacion.seccion_id
        ]
      );

      if (!result.rows[0]) {
        const error = new Error(`El estudiante ${registro.estudianteId} no pertenece a la sección evaluada`);
        error.status = 400;
        throw error;
      }
      guardadas.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return guardadas;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listarNotasEstudiante({ estudianteId, periodoId }) {
  const params = [estudianteId];
  const where = ["n.estudiante_id = $1"];
  if (periodoId) {
    params.push(periodoId);
    where.push(`ev.periodo_id = $${params.length}`);
  }

  const result = await query(
    `
      SELECT
        n.id,
        n.valor,
        n.observacion,
        ev.id AS evaluacion_id,
        ev.nombre AS evaluacion,
        ev.fecha,
        ev.peso,
        pa.id AS periodo_id,
        pa.nombre AS periodo,
        pa.anio,
        a.id AS asignatura_id,
        a.nombre AS asignatura
      FROM notas n
      JOIN evaluaciones_academicas ev ON ev.id = n.evaluacion_id
      JOIN periodos_academicos pa ON pa.id = ev.periodo_id
      JOIN asignaturas a ON a.id = ev.asignatura_id
      WHERE ${where.join(" AND ")}
      ORDER BY ev.fecha ASC, ev.id ASC
    `,
    params
  );
  return result.rows;
}

async function listarNotasEvaluacion({ userId, userEmail = null, role, evaluacionId }) {
  const params = [evaluacionId];
  let acceso = "";
  if (role === "docente") {
    params.push(userId);
    const userParam = params.length;
    params.push(userEmail);
    const emailParam = params.length;
    acceso = `AND EXISTS (
      SELECT 1
      FROM docentes d
      JOIN docente_asignaturas_secciones das ON das.docente_id = d.id
      WHERE ${filtroDocentePorUsuario(userParam, emailParam)}
        AND d.activo = TRUE
        AND das.seccion_id = ev.seccion_id
        AND das.asignatura_id = ev.asignatura_id
    )`;
  }

  const result = await query(
    `
      SELECT
        ev.id AS evaluacion_id,
        ev.nombre AS evaluacion,
        ev.fecha,
        ev.peso,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        n.id AS nota_id,
        n.valor,
        n.observacion
      FROM evaluaciones_academicas ev
      JOIN estudiantes e ON e.seccion_id = ev.seccion_id AND e.activo = TRUE
      LEFT JOIN notas n
        ON n.evaluacion_id = ev.id
       AND n.estudiante_id = e.id
      WHERE ev.id = $1
        ${acceso}
      ORDER BY e.apellidos, e.nombres
    `,
    params
  );
  return result.rows;
}

async function listarTrimestres({ anio }) {
  const result = await query(
    `
      SELECT id, nombre, anio, orden, activo
      FROM trimestres_academicos
      WHERE activo = TRUE
        AND ($1::smallint IS NULL OR anio = $1)
      ORDER BY anio DESC, orden
    `,
    [anio || null]
  );
  return result.rows;
}

async function listarCompetencias({ asignaturaId }) {
  const result = await query(
    `
      SELECT id, asignatura_id, nombre, orden
      FROM competencias
      WHERE asignatura_id = $1 AND activo = TRUE
      ORDER BY orden, id
    `,
    [asignaturaId]
  );
  return result.rows;
}

async function listarNivelesLogro() {
  const result = await query(
    `SELECT codigo, nombre, descripcion, orden FROM niveles_logro ORDER BY orden`
  );
  return result.rows;
}

async function crearProductoCompetencia({ userId, userEmail, seccionId, trimestreId, asignaturaId, competenciaId, nombre }) {
  const result = await query(
    `
      INSERT INTO productos_evaluacion
        (seccion_id, trimestre_id, asignatura_id, competencia_id, nombre, creado_por)
      SELECT $3, $4, $5, $6, $7, d.id
      FROM docentes d
      JOIN docente_asignaturas_secciones das
        ON das.docente_id = d.id
       AND das.seccion_id = $3
       AND das.asignatura_id = $5
      JOIN competencias c
        ON c.id = $6
       AND c.asignatura_id = $5
       AND c.activo = TRUE
      JOIN trimestres_academicos t
        ON t.id = $4
       AND t.activo = TRUE
      WHERE ${filtroDocentePorUsuario(1, 2)}
        AND d.activo = TRUE
      LIMIT 1
      RETURNING *
    `,
    [userId, userEmail || null, seccionId, trimestreId, asignaturaId, competenciaId, nombre]
  );
  return result.rows[0] || null;
}

async function listarProductosCompetencia({ userId, userEmail, seccionId, asignaturaId, trimestreId }) {
  const result = await query(
    `
      SELECT
        p.id,
        p.nombre,
        p.seccion_id,
        p.asignatura_id,
        p.competencia_id,
        p.trimestre_id,
        t.nombre AS trimestre,
        t.anio,
        c.nombre AS competencia,
        a.nombre AS asignatura,
        s.nivel,
        s.grado,
        s.letra,
        COUNT(cc.id)::int AS total_calificaciones
      FROM productos_evaluacion p
      JOIN trimestres_academicos t ON t.id = p.trimestre_id
      JOIN competencias c ON c.id = p.competencia_id
      JOIN asignaturas a ON a.id = p.asignatura_id
      JOIN secciones s ON s.id = p.seccion_id
      JOIN docente_asignaturas_secciones das
        ON das.seccion_id = p.seccion_id
       AND das.asignatura_id = p.asignatura_id
      JOIN docentes d ON d.id = das.docente_id
      LEFT JOIN calificaciones_competencia cc ON cc.producto_id = p.id
      WHERE ${filtroDocentePorUsuario(1, 2)}
        AND d.activo = TRUE
        AND p.activo = TRUE
        AND ($3::int IS NULL OR p.seccion_id = $3)
        AND ($4::int IS NULL OR p.asignatura_id = $4)
        AND ($5::int IS NULL OR p.trimestre_id = $5)
      GROUP BY p.id, t.id, c.id, a.id, s.id
      ORDER BY t.anio DESC, t.orden, c.orden, p.id
    `,
    [userId, userEmail || null, seccionId || null, asignaturaId || null, trimestreId || null]
  );
  return result.rows;
}

async function listarCalificacionesProducto({ userId, userEmail, productoId }) {
  const result = await query(
    `
      SELECT
        p.id AS producto_id,
        p.nombre AS producto,
        p.seccion_id,
        p.asignatura_id,
        p.competencia_id,
        p.trimestre_id,
        t.nombre AS trimestre,
        c.nombre AS competencia,
        a.nombre AS asignatura,
        s.nivel,
        s.grado,
        s.letra,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        cc.nivel_logro,
        cc.observacion
      FROM productos_evaluacion p
      JOIN trimestres_academicos t ON t.id = p.trimestre_id
      JOIN competencias c ON c.id = p.competencia_id
      JOIN asignaturas a ON a.id = p.asignatura_id
      JOIN secciones s ON s.id = p.seccion_id
      JOIN docente_asignaturas_secciones das
        ON das.seccion_id = p.seccion_id
       AND das.asignatura_id = p.asignatura_id
      JOIN docentes d ON d.id = das.docente_id
      JOIN estudiantes e ON e.seccion_id = p.seccion_id AND e.activo = TRUE
      LEFT JOIN calificaciones_competencia cc
        ON cc.producto_id = p.id
       AND cc.estudiante_id = e.id
      WHERE p.id = $3
        AND ${filtroDocentePorUsuario(1, 2)}
        AND d.activo = TRUE
      ORDER BY e.apellidos, e.nombres
    `,
    [userId, userEmail || null, productoId]
  );
  return result.rows;
}

async function guardarCalificacionesCompetencia({ userId, userEmail, productoId, registros }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const acceso = await client.query(
      `
        SELECT p.id, p.seccion_id
        FROM productos_evaluacion p
        JOIN docente_asignaturas_secciones das
          ON das.seccion_id = p.seccion_id
         AND das.asignatura_id = p.asignatura_id
        JOIN docentes d ON d.id = das.docente_id
        WHERE p.id = $3
          AND ${filtroDocentePorUsuario(1, 2)}
          AND d.activo = TRUE
        LIMIT 1
      `,
      [userId, userEmail || null, productoId]
    );
    const producto = acceso.rows[0];
    if (!producto) {
      const error = new Error("El producto no pertenece a un curso asignado al docente");
      error.status = 403;
      throw error;
    }

    const guardadas = [];
    for (const registro of registros) {
      const result = await client.query(
        `
          INSERT INTO calificaciones_competencia
            (producto_id, estudiante_id, nivel_logro, observacion)
          SELECT $1, e.id, $3, $4
          FROM estudiantes e
          WHERE e.id = $2
            AND e.seccion_id = $5
            AND e.activo = TRUE
          ON CONFLICT (producto_id, estudiante_id)
          DO UPDATE SET
            nivel_logro = EXCLUDED.nivel_logro,
            observacion = EXCLUDED.observacion,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `,
        [productoId, registro.estudianteId, registro.nivelLogro, registro.observacion || null, producto.seccion_id]
      );
      if (!result.rows[0]) {
        const error = new Error(`El estudiante ${registro.estudianteId} no pertenece a la sección del producto`);
        error.status = 400;
        throw error;
      }
      guardadas.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return guardadas;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listarResumenCompetenciasTrimestrales({ userId, userEmail, seccionId, asignaturaId, anio }) {
  const result = await query(
    `
      SELECT
        c.id AS competencia_id,
        c.nombre AS competencia,
        c.orden AS competencia_orden,
        t.id AS trimestre_id,
        t.nombre AS trimestre,
        t.orden AS trimestre_orden,
        COUNT(ct.id)::int AS total_calificados,
        (SELECT COUNT(*)::int FROM estudiantes e WHERE e.seccion_id = $3 AND e.activo = TRUE) AS total_estudiantes
      FROM competencias c
      CROSS JOIN trimestres_academicos t
      LEFT JOIN calificaciones_trimestrales_competencia ct
        ON ct.competencia_id = c.id
       AND ct.trimestre_id = t.id
       AND ct.seccion_id = $3
      WHERE c.asignatura_id = $4
        AND c.activo = TRUE
        AND t.activo = TRUE
        AND t.anio = $5
        AND EXISTS (
          SELECT 1
          FROM docente_asignaturas_secciones das
          JOIN docentes d ON d.id = das.docente_id
          WHERE das.asignatura_id = c.asignatura_id
            AND das.seccion_id = $3
            AND ${filtroDocentePorUsuario(1, 2)}
            AND d.activo = TRUE
        )
      GROUP BY c.id, t.id
      ORDER BY c.orden, t.orden
    `,
    [userId, userEmail || null, seccionId, asignaturaId, anio]
  );
  return result.rows;
}

async function listarCalificacionesTrimestrales({ userId, userEmail, seccionId, competenciaId, trimestreId }) {
  const result = await query(
    `
      SELECT
        c.id AS competencia_id,
        c.nombre AS competencia,
        a.id AS asignatura_id,
        a.nombre AS asignatura,
        t.id AS trimestre_id,
        t.nombre AS trimestre,
        s.id AS seccion_id,
        s.nivel,
        s.grado,
        s.letra,
        e.id AS estudiante_id,
        e.nombres,
        e.apellidos,
        e.correo,
        ct.nivel_logro,
        ct.observacion
      FROM competencias c
      JOIN asignaturas a ON a.id = c.asignatura_id
      JOIN trimestres_academicos t ON t.id = $5 AND t.activo = TRUE
      JOIN secciones s ON s.id = $3
      JOIN docente_asignaturas_secciones das
        ON das.asignatura_id = c.asignatura_id
       AND das.seccion_id = s.id
      JOIN docentes d ON d.id = das.docente_id
      JOIN estudiantes e ON e.seccion_id = s.id AND e.activo = TRUE
      LEFT JOIN calificaciones_trimestrales_competencia ct
        ON ct.seccion_id = s.id
       AND ct.trimestre_id = t.id
       AND ct.competencia_id = c.id
       AND ct.estudiante_id = e.id
      WHERE c.id = $4
        AND c.activo = TRUE
        AND ${filtroDocentePorUsuario(1, 2)}
        AND d.activo = TRUE
      ORDER BY e.apellidos, e.nombres
    `,
    [userId, userEmail || null, seccionId, competenciaId, trimestreId]
  );
  return result.rows;
}

async function guardarCalificacionesTrimestrales({ userId, userEmail, seccionId, competenciaId, trimestreId, registros }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const acceso = await client.query(
      `
        SELECT c.id
        FROM competencias c
        JOIN docente_asignaturas_secciones das
          ON das.asignatura_id = c.asignatura_id
         AND das.seccion_id = $3
        JOIN docentes d ON d.id = das.docente_id
        JOIN trimestres_academicos t ON t.id = $5 AND t.activo = TRUE
        WHERE c.id = $4
          AND c.activo = TRUE
          AND ${filtroDocentePorUsuario(1, 2)}
          AND d.activo = TRUE
        LIMIT 1
      `,
      [userId, userEmail || null, seccionId, competenciaId, trimestreId]
    );
    if (!acceso.rows[0]) {
      const error = new Error("La competencia o sección no pertenece al docente");
      error.status = 403;
      throw error;
    }

    const guardadas = [];
    for (const registro of registros) {
      const result = await client.query(
        `
          INSERT INTO calificaciones_trimestrales_competencia
            (seccion_id, trimestre_id, competencia_id, estudiante_id, nivel_logro, observacion)
          SELECT $1, $2, $3, e.id, $5, $6
          FROM estudiantes e
          WHERE e.id = $4 AND e.seccion_id = $1 AND e.activo = TRUE
          ON CONFLICT (seccion_id, trimestre_id, competencia_id, estudiante_id)
          DO UPDATE SET
            nivel_logro = EXCLUDED.nivel_logro,
            observacion = EXCLUDED.observacion,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `,
        [seccionId, trimestreId, competenciaId, registro.estudianteId, registro.nivelLogro, registro.observacion || null]
      );
      if (!result.rows[0]) {
        const error = new Error(`El estudiante ${registro.estudianteId} no pertenece a la sección`);
        error.status = 400;
        throw error;
      }
      guardadas.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return guardadas;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listarPeriodos,
  listarAsignaturas,
  crearEvaluacion,
  listarEvaluaciones,
  guardarNotas,
  listarNotasEstudiante,
  listarNotasEvaluacion,
  listarTrimestres,
  listarCompetencias,
  listarNivelesLogro,
  crearProductoCompetencia,
  listarProductosCompetencia,
  listarCalificacionesProducto,
  guardarCalificacionesCompetencia,
  listarResumenCompetenciasTrimestrales,
  listarCalificacionesTrimestrales,
  guardarCalificacionesTrimestrales
};
