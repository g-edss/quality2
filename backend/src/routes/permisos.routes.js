import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { catalogoParaFrontend } from '../config/permisos.js';

const router = Router();

router.get('/catalogo', requireAuth, (_req, res) => {
  res.json(catalogoParaFrontend());
});

export default router;
