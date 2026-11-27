import { query } from '../config/db.js';

export async function buscar(texto, usuarioId) {
  const patron = `%${texto}%`;
  const [documentos, procesos, solicitudes] = await Promise.all([
    query(`
      SELECT d.id, 'documentos' AS modulo, 'Documento' AS tipo,
        COALESCE(d.codigo || ' · ', '') || d.nombre AS titulo,
        td.nombre AS detalle
      FROM documentos d
      JOIN tipos_documento td ON td.id = d.tipo_documento_id
      WHERE d.nombre ILIKE $1 OR d.codigo ILIKE $1
      ORDER BY d.creado_en DESC, d.id DESC LIMIT 6
    `, [patron]),
    query(`
      SELECT p.id, 'procesos' AS modulo, 'Proceso' AS tipo,
        p.nombre AS titulo, COALESCE(p.descripcion, '') AS detalle
      FROM procesos p
      WHERE p.nombre ILIKE $1 OR p.descripcion ILIKE $1
      ORDER BY p.nombre LIMIT 6
    `, [patron]),
    query(`
      SELECT s.id, 'solicitudes' AS modulo, 'Solicitud' AS tipo,
        'SOL-' || s.id::text || ' · ' || t.nombre AS titulo,
        COALESCE(d.nombre, r.nombre, p.nombre, '') AS detalle
      FROM solicitudes s
      JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
      LEFT JOIN documentos d ON d.id = s.documento_id
      LEFT JOIN registros r ON r.id = s.registro_id
      LEFT JOIN procesos p ON p.id = s.proceso_id
      WHERE $2 IN (s.solicitante_id, s.responsable_asignado_id,
        s.revisor_asignado_id, s.aprobador_asignado_id)
        AND (('SOL-' || s.id::text) ILIKE $1 OR t.nombre ILIKE $1
          OR d.nombre ILIKE $1 OR r.nombre ILIKE $1 OR p.nombre ILIKE $1)
      ORDER BY s.actualizado_en DESC, s.id DESC LIMIT 6
    `, [patron, usuarioId]),
  ]);
  return [...documentos.rows, ...procesos.rows, ...solicitudes.rows];
}
