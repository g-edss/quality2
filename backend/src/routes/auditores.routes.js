import { Router } from 'express';
import * as controller from '../controllers/auditores.controller.js';
import { requireAuth, requirePermiso } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, controller.listar);
router.post('/', requireAuth, requirePermiso('catalogo.auditores'), controller.crear);
router.put('/:id', requireAuth, requirePermiso('catalogo.auditores'), controller.actualizar);
router.delete('/:id', requireAuth, requirePermiso('catalogo.auditores'), controller.desactivar);

export default router;