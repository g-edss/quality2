import * as unidadesService from '../services/unidadesmedida.service.js';

export async function listar(_req, res, next) {
  try {
    const unidades = await unidadesService.listarActivas();
    res.json(unidades);
  } catch (err) {
    next(err);
  }
}

function datosValidos(body) {
  const nombre = String(body.nombre || '').trim();
  const simbolo = String(body.simbolo || '').trim();
  const descripcion = String(body.descripcion || '').trim();
  const tipo_dato = String(body.tipo_dato || '').trim();
  if (!nombre || nombre.length > 100 || simbolo.length > 20 || descripcion.length > 2000 || !['numero', 'porcentaje', 'texto'].includes(tipo_dato) || typeof body.activo !== 'boolean') {
    const error = new Error('Revisa el nombre, símbolo, tipo de dato, descripción y estado de la unidad.');
    error.status = 400;
    error.publico = error.message;
    throw error;
  }
  return { nombre, simbolo, tipo_dato, descripcion, activo: body.activo };
}

function responderError(error, res, next) {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una unidad con ese nombre.' });
  return next(error);
}

export async function listarTodas(_req, res, next) {
  try { res.json(await unidadesService.listarTodas()); } catch (error) { next(error); }
}

export async function crear(req, res, next) {
  try { res.status(201).json(await unidadesService.crear(datosValidos(req.body))); }
  catch (error) { responderError(error, res, next); }
}

export async function actualizar(req, res, next) {
  try { res.json(await unidadesService.actualizar(req.params.id, datosValidos(req.body))); }
  catch (error) { responderError(error, res, next); }
}

export async function desactivar(req, res, next) {
  try { res.json(await unidadesService.desactivar(req.params.id)); }
  catch (error) { next(error); }
}
