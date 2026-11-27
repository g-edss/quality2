import { Router } from 'express';
import { requireAuth, requirePermiso } from '../middlewares/auth.js';
import * as controller from '../controllers/indicadores.controller.js';

const router = Router();
const permisoCatalogo = [requireAuth, requirePermiso('catalogo.indicadores')];

router.get('/', ...permisoCatalogo, controller.listar);
router.post('/', ...permisoCatalogo, controller.crear);
router.put('/:id', ...permisoCatalogo, controller.actualizar);
router.delete('/:id', ...permisoCatalogo, controller.desactivar);

export default router;