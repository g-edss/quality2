import { obtenerResumen } from '../services/dashboard.service.js';

export async function resumen(req, res, next) {
  try {
    res.json(await obtenerResumen(Number(req.auth.sub)));
  } catch (error) {
    next(error);
  }
}
