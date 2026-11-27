import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { resumen } from '../controllers/dashboard.controller.js';

const router = Router();
router.get('/', requireAuth, resumen);

export default router;
