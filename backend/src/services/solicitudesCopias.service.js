import { pool } from '../config/db.js';
import {
  crearCopiaControlada,
  eliminarPdfCopiaControlada,
} from './documentos.service.js';

function errorPublico(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function listarSolicitudes(usuarioId, esAdmin) {
  const { rows } = await pool.query(`
    SELECT s.id, s.documento_id, s.version_documento_id,
      s.destinatario_nombre, s.motivo, s.estado, s.solicitada_en,
      s.resuelta_en, s.comentario_resolucion, s.copia_controlada_id,
      d.codigo, d.nombre AS documento_nombre, v.version,
      solicitante.nombre AS solicitada_por,
      resolvedor.nombre AS resuelta_por, c.folio,
      c.estado AS copia_estado, c.entregada_en, c.recibida_por_nombre
    FROM solicitudes_copias_controladas s
    JOIN documentos d ON d.id = s.documento_id
    JOIN documento_versiones v ON v.id = s.version_documento_id
    JOIN usuarios solicitante ON solicitante.id = s.solicitada_por
    LEFT JOIN usuarios resolvedor ON resolvedor.id = s.resuelta_por
    LEFT JOIN copias_controladas c ON c.id = s.copia_controlada_id
    WHERE ($1::boolean OR s.solicitada_por = $2)
    ORDER BY (s.estado = 'pendiente') DESC, s.solicitada_en DESC, s.id DESC
  `, [esAdmin, usuarioId]);
  return rows;
}

export async function crearSolicitud({ documentoId, usuarioId, destinatarioNombre, motivo }) {
  try {
    const { rows } = await pool.query(`
      INSERT INTO solicitudes_copias_controladas (
        documento_id, version_documento_id, destinatario_nombre,
        motivo, solicitada_por
      )
      SELECT d.id, v.id, $2, $3, $4
      FROM documentos d
      JOIN LATERAL (
        SELECT id FROM documento_versiones
        WHERE documento_id = d.id AND vigente = TRUE
          AND archivo_pdf_url IS NOT NULL
        ORDER BY creado_en DESC, id DESC LIMIT 1
      ) v ON TRUE
      WHERE d.id = $1 AND d.estado = 'vigente'
        AND NOT EXISTS (
          SELECT 1 FROM usuario_documentos_ocultos oculto
           WHERE oculto.usuario_id = $4 AND oculto.documento_id = d.id
        )
      RETURNING id, estado
    `, [documentoId, destinatarioNombre, motivo, usuarioId]);
    if (!rows[0]) {
      throw errorPublico('El documento no está vigente o no tiene PDF disponible.', 409);
    }
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw errorPublico('Ya tienes una solicitud pendiente para esa copia.', 409);
    }
    throw error;
  }
}

export async function resolverSolicitud({ solicitudId, usuarioId, decision, comentario }) {
  const client = await pool.connect();
  let copiaCreada = null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, documento_id, version_documento_id,
        destinatario_nombre, motivo, estado
      FROM solicitudes_copias_controladas WHERE id = $1 FOR UPDATE
    `, [solicitudId]);
    const solicitud = rows[0];
    if (!solicitud) throw errorPublico('La solicitud no existe.', 404);
    if (solicitud.estado !== 'pendiente') {
      throw errorPublico('Esta solicitud ya fue resuelta.', 409);
    }

    if (decision === 'aprobada') {
      copiaCreada = await crearCopiaControlada({
        documentoId: solicitud.documento_id,
        usuarioId,
        destinatarioNombre: solicitud.destinatario_nombre,
        comentarios: solicitud.motivo,
        versionDocumentoIdEsperada: solicitud.version_documento_id,
        clienteExterno: client,
      });
    }

    const { rows: actualizadas } = await client.query(`
      UPDATE solicitudes_copias_controladas
      SET estado = $2, resuelta_por = $3, resuelta_en = NOW(),
        comentario_resolucion = $4, copia_controlada_id = $5
      WHERE id = $1
      RETURNING id, estado, copia_controlada_id
    `, [solicitudId, decision, usuarioId, comentario || null, copiaCreada?.id || null]);
    await client.query('COMMIT');
    return { ...actualizadas[0], folio: copiaCreada?.folio || null };
  } catch (error) {
    await client.query('ROLLBACK');
    if (copiaCreada?.archivo_pdf_url) {
      await eliminarPdfCopiaControlada(copiaCreada.archivo_pdf_url);
    }
    throw error;
  } finally {
    client.release();
  }
}
