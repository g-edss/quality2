import { Router } from 'express';
import { requireAuth, requirePermiso } from '../middlewares/auth.js';
import * as controller from '../controllers/solicitudesCopias.controller.js';

const router = Router();
const puede = (accion) => [
  requireAuth,
  requirePermiso('modulo.visorDocumental'),
  requirePermiso(`visorDocumental.${accion}`),
];

router.get('/solicitudes', requireAuth, controller.listar);
router.post('/solicitudes', puede('solicitarCopia'), controller.crear);
router.patch('/solicitudes/:id/resolver', puede('resolverCopias'), controller.resolver);
export default router;
