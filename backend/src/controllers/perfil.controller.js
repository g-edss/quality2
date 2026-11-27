import * as service from '../services/perfil.service.js';

export async function obtener(req, res, next) {
  try {
    res.json(await service.obtenerPerfil(Number(req.auth.sub)));
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { telefono } = req.body || {};
    if (typeof telefono !== 'string' || telefono.length > 30 ||
      (telefono.trim() && !/^[0-9+()\-\s]+$/.test(telefono))) {
      return res.status(400).json({ error: 'Escribe un teléfono válido de hasta 30 caracteres.' });
    }
    res.json(await service.actualizarTelefono(Number(req.auth.sub), telefono.trim()));
  } catch (error) {
    next(error);
  }
}

export async function cambiarPassword(req, res, next) {
  try {
    const { actual, nueva } = req.body || {};
    if (typeof actual !== 'string' || !actual || typeof nueva !== 'string' ||
      nueva.length < 10 || nueva.length > 128) {
      return res.status(400).json({ error: 'Indica tu contraseña actual y una nueva de 10 a 128 caracteres.' });
    }
    res.json(await service.cambiarPassword(Number(req.auth.sub), actual, nueva));
  } catch (error) {
    next(error);
  }
}
