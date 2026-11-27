import * as service from '../services/tiposDocumento.service.js';

function nombreValido(body) {
  const nombre = String(body.nombre || '').trim();
  if (!nombre || nombre.length > 120) {
    const error = new Error('El nombre del tipo es obligatorio y debe tener máximo 120 caracteres.');
    error.status = 400;
    error.publico = error.message;
    throw error;
  }
  return nombre;
}

function responderError(error, res, next) {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un tipo de documento con ese nombre.' });
  return next(error);
}

export async function listarTodos(_req, res, next) {
  try { res.json(await service.listarTodos()); } catch (error) { next(error); }
}

export async function crear(req, res, next) {
  try { res.status(201).json(await service.crear(nombreValido(req.body))); }
  catch (error) { responderError(error, res, next); }
}

export async function actualizar(req, res, next) {
  try {
    const nombre = nombreValido(req.body);
    if (typeof req.body.activo !== 'boolean') return res.status(400).json({ error: 'El estado no es válido.' });
    res.json(await service.actualizar(req.params.id, { nombre, activo: req.body.activo }));
  } catch (error) { responderError(error, res, next); }
}

export async function desactivar(req, res, next) {
  try { res.json(await service.desactivar(req.params.id)); } catch (error) { next(error); }
}
