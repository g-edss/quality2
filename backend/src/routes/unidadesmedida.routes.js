import { Router } from 'express';
import { requireAuth, requirePermiso, requireAnyPermiso } from '../middlewares/auth.js';
import * as controller from '../controllers/unidadesmedida.controller.js';

const router = Router();
const permisoLectura = [
  requireAuth,
  requireAnyPermiso('catalogo.indicadores', 'indicadores.unidadesMedida'),
];
const permisoUnidades = [requireAuth, requirePermiso('indicadores.unidadesMedida')];

router.get('/', ...permisoLectura, controller.listar);
router.get('/todas', ...permisoUnidades, controller.listarTodas);
router.post('/', ...permisoUnidades, controller.crear);
router.put('/:id', ...permisoUnidades, controller.actualizar);
router.delete('/:id', ...permisoUnidades, controller.desactivar);

export default router;