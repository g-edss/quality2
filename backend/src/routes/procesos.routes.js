import { Router } from 'express';
import * as controller from '../controllers/procesos.controller.js';
import * as evaluacionesCriteriosController from '../controllers/evaluacionesCriterios.controller.js';
import { requireAuth, requirePermiso } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, controller.listar);
router.get('/:id', requireAuth, controller.obtener);
router.post('/', requireAuth, requirePermiso('catalogo.procesos'), controller.crear);
router.put('/:id', requireAuth, requirePermiso('catalogo.procesos'), controller.actualizar);
router.delete('/:id', requireAuth, requirePermiso('catalogo.procesos'), controller.desactivar);
router.get(
  '/:procesoId/evaluaciones-normas',
  requireAuth,
  evaluacionesCriteriosController.obtenerChecklist
);
router.post(
  '/:procesoId/evaluaciones-normas/:criterioId',
  requireAuth,
  evaluacionesCriteriosController.registrarEvaluacion
);
export default router;
