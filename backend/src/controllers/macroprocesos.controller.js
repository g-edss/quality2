import * as service from '../services/macroprocesos.service.js';

function datosValidos(body) {
  const nombre = String(body.nombre || '').trim();
  const descripcion = String(body.descripcion || '').trim();
  if (!nombre || nombre.length > 160 || descripcion.length > 2000) {
    const error = new Error('El nombre es obligatorio y la descripción debe tener máximo 2000 caracteres.');
    error.status = 400;
    error.publico = error.message;
    throw error;
  }
  return { nombre, descripcion };
}

function responderError(error, res, next) {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un macroproceso con ese nombre.' });
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
  try {
    const datos = datosValidos(req.body);
    if (typeof req.body.activo !== 'boolean') return res.status(400).json({ error: 'El estado no es válido.' });
    res.json(await service.actualizar(req.params.id, { ...datos, activo: req.body.activo }));
  } catch (error) { responderError(error, res, next); }
}

export async function desactivar(req, res, next) {
  try { res.json(await service.desactivar(req.params.id)); } catch (error) { next(error); }
}
