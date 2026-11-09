const { pool, query } = require("../../config/postgres");

async function crearReporteAnonimo({ seccionId, descripcion, archivo }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reporteResult = await client.query(
      `INSERT INTO reportes_anonimos (estudiante_id, seccion_id, descripcion)
       VALUES (NULL, $1, $2)
       RETURNING id, estudiante_id, seccion_id, descripcion, estado, fecha_creacion`,
      [seccionId || null, descripcion]
    );
    const reporte = reporteResult.rows[0];

    if (archivo) {
      await client.query(
        `INSERT INTO reporte_archivos
          (reporte_id, nombre_archivo, tipo_mime, contenido_base64)
         VALUES ($1, $2, $3, $4)`,
        [reporte.id, archivo.nombre, archivo.tipoMime, archivo.contenidoBase64]
      );
    }

    await client.query("COMMIT");
    return reporte;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listarReportesAnonimos({ soloPendientes = false } = {}) {
  const result = await query(
    `SELECT
       r.id,
       r.estudiante_id,
       r.seccion_id,
       r.descripcion,
       r.estado,
       (r.estado <> 'pendiente') AS leido,
       r.fecha_creacion AS fecha,
       r.fecha_revision,
       r.revisado_por,
       s.nombre AS seccion,
       a.nombre_archivo,
       a.tipo_mime,
       a.contenido_base64 AS foto_base64,
       NULL::text AS nombre_estudiante
     FROM reportes_anonimos r
     LEFT JOIN secciones s ON s.id = r.seccion_id
     LEFT JOIN LATERAL (
       SELECT nombre_archivo, tipo_mime, contenido_base64
       FROM reporte_archivos
       WHERE reporte_id = r.id
       ORDER BY id
       LIMIT 1
     ) a ON TRUE
     WHERE ($1::boolean = FALSE OR r.estado = 'pendiente')
     ORDER BY r.fecha_creacion DESC`,
    [soloPendientes]
  );
  return result.rows;
}

async function contarReportesPendientes({ seccionIds = null } = {}) {
  const result = await query(
    `SELECT COUNT(*)::int AS total
     FROM reportes_anonimos
     WHERE estado = 'pendiente'
       AND ($1::int[] IS NULL OR seccion_id = ANY($1::int[]))`,
    [seccionIds]
  );
  return result.rows[0]?.total || 0;
}

async function marcarReportesRevisados(revisadoPor = null) {
  const result = await query(
    `UPDATE reportes_anonimos
     SET estado = 'revisado',
         fecha_revision = COALESCE(fecha_revision, CURRENT_TIMESTAMP),
         revisado_por = COALESCE(revisado_por, $1)
     WHERE estado = 'pendiente'
     RETURNING id`,
    [revisadoPor || null]
  );
  return result.rows;
}

module.exports = {
  crearReporteAnonimo,
  listarReportesAnonimos,
  contarReportesPendientes,
  marcarReportesRevisados
};
