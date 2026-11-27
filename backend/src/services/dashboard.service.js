import { query } from '../config/db.js';

export async function obtenerResumen(usuarioId) {
  const [conteos, actividad, revisiones] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM solicitudes s
          WHERE (s.estado = 'en_responsable' AND s.responsable_asignado_id = $1)
            OR (s.estado = 'en_revisor' AND s.revisor_asignado_id = $1)
            OR (s.estado = 'en_aprobador' AND s.aprobador_asignado_id = $1)) AS solicitudes,
        (SELECT COUNT(*) FROM hallazgos h
          WHERE h.responsable_id = $1 AND h.estado <> 'cerrado') AS hallazgos,
        (SELECT COUNT(*) FROM acciones_correctivas a
          WHERE a.responsable_id = $1 AND a.estado NOT IN ('cerrada', 'rechazada')) AS acciones,
        (SELECT COUNT(*) FROM compromisos c
          WHERE c.responsable_id = $1 AND c.estado <> 'cerrado') AS acuerdos
    `, [usuarioId]),
    query(`
      SELECT s.id, t.nombre AS tipo,
        COALESCE(d.nombre, r.nombre, p.nombre, 'Solicitud ' || s.id::text) AS asunto,
        solicitante.nombre AS usuario, s.estado, s.actualizado_en
      FROM solicitudes s
      JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
      JOIN usuarios solicitante ON solicitante.id = s.solicitante_id
      LEFT JOIN documentos d ON d.id = s.documento_id
      LEFT JOIN registros r ON r.id = s.registro_id
      LEFT JOIN procesos p ON p.id = s.proceso_id
      WHERE $1 IN (s.solicitante_id, s.responsable_asignado_id,
        s.revisor_asignado_id, s.aprobador_asignado_id)
      ORDER BY s.actualizado_en DESC, s.id DESC
      LIMIT 8
    `, [usuarioId]),
    query(`
      SELECT d.id, d.codigo, d.nombre,
        TO_CHAR(d.proxima_revision, 'YYYY-MM-DD') AS fecha,
        d.revision_cada_meses
      FROM documentos d
      WHERE d.estado = 'vigente'
        AND d.revision_programada = TRUE
        AND d.proxima_revision IS NOT NULL
      ORDER BY d.proxima_revision, d.id
    `),
  ]);

  const fila = conteos.rows[0];
  return {
    pendientes: {
      solicitudes: Number(fila.solicitudes),
      hallazgos: Number(fila.hallazgos),
      acciones: Number(fila.acciones),
      acuerdos: Number(fila.acuerdos),
    },
    actividad: actividad.rows,
    revisiones: revisiones.rows,
  };
}
