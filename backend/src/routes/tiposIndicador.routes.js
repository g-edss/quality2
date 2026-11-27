import { Router } from 'express';
import { requireAuth, requirePermiso, requireAnyPermiso } from '../middlewares/auth.js';
import * as controller from '../controllers/tiposIndicador.controller.js';

const router = Router();
const permisoLectura = [
  requireAuth,
  requireAnyPermiso('catalogo.indicadores', 'indicadores.tiposIndicador'),
];
const permisoTipos = [requireAuth, requirePermiso('indicadores.tiposIndicador')];

router.get('/', ...permisoLectura, controller.listar);
router.post('/', ...permisoTipos, controller.crear);
router.put('/:id', ...permisoTipos, controller.actualizar);
router.delete('/:id', ...permisoTipos, controller.desactivar);

export default router;