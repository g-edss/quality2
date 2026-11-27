import * as service from '../services/tiposIndicador.service.js';

function datosValidos(body) {
  const codigo = String(body.codigo || '').trim().toUpperCase();
  const nombre = String(body.nombre || '').trim();
  const descripcion = String(body.descripcion || '').trim();
  if (!codigo || codigo.length > 30 || !nombre || nombre.length > 100 || descripcion.length > 2000 || typeof body.activo !== 'boolean') {
    const error = new Error('Revisa el código, nombre, descripción y estado del tipo de indicador.');
    error.status = 400;
    error.publico = error.message;
    throw error;
  }
  return { codigo, nombre, descripcion, activo: body.activo };
}

function responderError(error, res, next) {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un tipo con ese código o nombre.' });
  return next(error);
}

export async function listar(_req, res, next) {
  try { res.json(await service.listar()); } catch (error) { next(error); }
}

export async function crear(req, res, next) {
  try { res.status(201).json(await service.crear(datosValidos(req.body))); }
  catch (error) { responderError(error, res, next); }
}

export async function actualizar(req, res, next) {
  try { res.json(await service.actualizar(req.params.id, datosValidos(req.body))); }
  catch (error) { responderError(error, res, next); }
}

export async function desactivar(req, res, next) {
  try { res.json(await service.desactivar(req.params.id)); }
  catch (error) { next(error); }
}
