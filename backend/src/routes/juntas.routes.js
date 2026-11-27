import { Router } from 'express';
import { requireAuth, requirePermiso } from '../middlewares/auth.js';
import * as controller from '../controllers/juntas.controller.js';

const router = Router();
const puede = (accion) => [requireAuth, requirePermiso(`juntas.${accion}`)];

router.get('/', requireAuth, controller.listar);
router.get('/catalogos', requireAuth, controller.catalogos);
router.post('/', puede('convocar'), controller.crear);
router.put('/:id', puede('modificar'), controller.actualizar);
router.post('/:id/iniciar', puede('iniciar'), controller.iniciar);
router.put('/:id/minuta', puede('minutas'), controller.guardarMinuta);
router.put('/:id/asistentes', puede('modificar'), controller.guardarAsistentes);
router.post('/:id/compromisos', puede('compromisos'), controller.crearCompromiso);
router.post('/:id/compromisos/:compromisoId/avances', puede('avances'), controller.registrarAvance);
router.post('/:id/compromisos/:compromisoId/cerrar', puede('revisarAvances'), controller.cerrarCompromiso);
router.post('/:id/cerrar', puede('cerrar'), controller.cerrar);
router.put('/:id/acciones-correctivas', puede('modificar'), controller.guardarAccionesCorrectivas);

export default router;
