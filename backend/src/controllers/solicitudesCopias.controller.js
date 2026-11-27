import * as service from '../services/solicitudesCopias.service.js';
import { tienePermiso } from '../services/permisos.service.js';

export async function listar(req, res, next) {
  try {
    const puedeResolver = await tienePermiso(
      Number(req.auth.sub), req.auth.rol, 'visorDocumental.resolverCopias',
    );
    res.json(await service.listarSolicitudes(Number(req.auth.sub), puedeResolver));
  } catch (error) {
    next(error);
  }
}

export async function crear(req, res, next) {
  try {
    const documentoId = Number(req.body?.documento_id);
    const destinatarioNombre = String(req.body?.destinatario_nombre || '').trim();
    const motivo = String(req.body?.motivo || '').trim();
    if (!Number.isInteger(documentoId) || documentoId <= 0 ||
        !destinatarioNombre || destinatarioNombre.length > 200 ||
        !motivo || motivo.length > 2000) {
      return res.status(400).json({
        error: 'Selecciona un documento e indica destinatario y motivo (máximo 200 y 2000 caracteres).',
      });
    }
    const solicitud = await service.crearSolicitud({
      documentoId, usuarioId: Number(req.auth.sub), destinatarioNombre, motivo,
    });
    res.status(201).json({ mensaje: 'Solicitud de copia enviada para su autorización.', solicitud });
  } catch (error) {
    next(error);
  }
}

export async function resolver(req, res, next) {
  try {
    const solicitudId = Number(req.params.id);
    const { decision } = req.body || {};
    const comentario = String(req.body?.comentario || '').trim();
    if (!Number.isInteger(solicitudId) || solicitudId <= 0 ||
        !['aprobada', 'rechazada'].includes(decision) ||
        comentario.length > 2000 || (decision === 'rechazada' && !comentario)) {
      return res.status(400).json({
        error: 'Indica una decisión válida y explica el rechazo (máximo 2000 caracteres).',
      });
    }
    const solicitud = await service.resolverSolicitud({
      solicitudId, usuarioId: Number(req.auth.sub), decision, comentario,
    });
    res.json({ mensaje: decision === 'aprobada'
      ? `Copia autorizada y generada: ${solicitud.folio}.`
      : 'Solicitud de copia rechazada.', solicitud });
  } catch (error) {
    next(error);
  }
}
