import * as service from '../services/normas.service.js';

function errorDeValidacion(mensaje) {
  const error = new Error(mensaje);
  error.status = 400;
  error.publico = mensaje;
  return error;
}

function leerId(valor) {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw errorDeValidacion('El identificador no es válido.');
  }
  return id;
}

function leerNorma(body, edicion = false) {
  if (typeof body?.codigo !== 'string' || typeof body?.nombre !== 'string') {
    throw errorDeValidacion('Indica el código y el nombre de la norma.');
  }

  const codigo = body.codigo.trim().toUpperCase();
  const nombre = body.nombre.trim();

  if (!codigo || codigo.length > 80 || !nombre || nombre.length > 200) {
    throw errorDeValidacion('Revisa el código y el nombre de la norma.');
  }

  if (edicion && typeof body.activo !== 'boolean') {
    throw errorDeValidacion('Indica si la norma está activa.');
  }

  return edicion ? { codigo, nombre, activo: body.activo } : { codigo, nombre };
}

function leerCriterio(body, edicion = false) {
  if (typeof body?.codigo !== 'string' || typeof body?.descripcion !== 'string') {
    throw errorDeValidacion('Indica el código y la descripción del criterio.');
  }

  const codigo = body.codigo.trim().toUpperCase();
  const descripcion = body.descripcion.trim();

  if (!codigo || codigo.length > 80 || !descripcion || descripcion.length > 2000) {
    throw errorDeValidacion('Revisa el código y la descripción del criterio.');
  }

  if (edicion && typeof body.activo !== 'boolean') {
    throw errorDeValidacion('Indica si el criterio está activo.');
  }

  return edicion
    ? { codigo, descripcion, activo: body.activo }
    : { codigo, descripcion };
}

function manejarError(error, res, next) {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Ese código ya existe en el catálogo.' });
  }
  return next(error);
}

export async function listarNormas(_req, res, next) {
  try {
    res.json(await service.listarNormas());
  } catch (error) {
    next(error);
  }
}

export async function crearNorma(req, res, next) {
  try {
    res.status(201).json(await service.crearNorma(leerNorma(req.body)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

export async function actualizarNorma(req, res, next) {
  try {
    const id = leerId(req.params.id);
    res.json(await service.actualizarNorma(id, leerNorma(req.body, true)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

export async function listarCriterios(req, res, next) {
  try {
    res.json(await service.listarCriterios(leerId(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function crearCriterio(req, res, next) {
  try {
    const normaId = leerId(req.params.id);
    res.status(201).json(await service.crearCriterio(normaId, leerCriterio(req.body)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

export async function actualizarCriterio(req, res, next) {
  try {
    const normaId = leerId(req.params.id);
    const criterioId = leerId(req.params.criterioId);
    res.json(
      await service.actualizarCriterio(
        normaId,
        criterioId,
        leerCriterio(req.body, true)
      )
    );
  } catch (error) {
    manejarError(error, res, next);
  }
}