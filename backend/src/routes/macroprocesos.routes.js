import { Router } from 'express';
import { requireAuth, requirePermiso } from '../middlewares/auth.js';
import * as controller from '../controllers/macroprocesos.controller.js';

const router = Router();
router.get('/', requireAuth, controller.listar);
router.post('/', requireAuth, requirePermiso('catalogo.procesos'), controller.crear);
router.put('/:id', requireAuth, requirePermiso('catalogo.procesos'), controller.actualizar);
router.delete('/:id', requireAuth, requirePermiso('catalogo.procesos'), controller.desactivar);
export default router;
