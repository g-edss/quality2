import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import * as controller from '../controllers/normas.controller.js';
import * as criteriosController from '../controllers/criteriosNorma.controller.js';

const router = Router();

router.get('/', requireAuth, controller.listarNormas);
router.post('/', requireAuth, requireRole('admin_general'), controller.crearNorma);
router.put('/:id', requireAuth, requireRole('admin_general'), controller.actualizarNorma);

router.get('/criterios', requireAuth, criteriosController.listarCriterios);
router.post('/criterios', requireAuth, requireRole('admin_general'), criteriosController.crearCriterio);
router.put('/criterios/:criterioId', requireAuth, requireRole('admin_general'), criteriosController.actualizarCriterio);

router.get('/:id/criterios', requireAuth, criteriosController.listarCriteriosDeNorma);
router.put('/:id/criterios', requireAuth, requireRole('admin_general'), criteriosController.guardarCriteriosDeNorma);

export default router;