import * as authService from '../services/auth.service.js';
import { limpiarIntentos, registrarFallo } from '../middlewares/limiteLogin.js';

export async function login(req, res, next) {
  try {
    const { correo, password } = req.body;

    if (
      typeof correo !== 'string' ||
      typeof password !== 'string' ||
      !correo.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: 'Correo y contraseña son obligatorios',
      });
    }

    const sesion = await authService.iniciarSesion({ correo, password });

    if (!sesion) {
      registrarFallo(correo);
      return res.status(401).json({
        error: 'Correo o contraseña incorrectos',
      });
    }

    limpiarIntentos(correo);
    res.set('Cache-Control', 'no-store');
    res.json(sesion);
  } catch (error) {
    next(error);
  }
}
