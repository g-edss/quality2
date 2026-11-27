import { buscar } from '../services/busqueda.service.js';

export async function resultados(req, res, next) {
  try {
    const texto = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (texto.length < 2 || texto.length > 100) {
      return res.status(400).json({ error: 'Escribe entre 2 y 100 caracteres para buscar.' });
    }
    res.json(await buscar(texto, Number(req.auth.sub)));
  } catch (error) {
    next(error);
  }
}
