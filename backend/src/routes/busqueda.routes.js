import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { resultados } from '../controllers/busqueda.controller.js';

const router = Router();
router.get('/', requireAuth, resultados);

export default router;
