import { Router } from 'express';
import { requireAuth, requirePermiso } from '../middlewares/auth.js';
import * as controller from '../controllers/accionesCorrectivas.controller.js';
import { subirArchivosSolicitud } from '../middlewares/uploadDocumento.js';

const router = Router();
const puede = (accion) => [requireAuth, requirePermiso(`accionesCorrectivas.${accion}`)];

router.get('/', requireAuth, controller.listar);
router.post('/', puede('levantar'), controller.crear);
router.put('/:id', puede('modificar'), controller.actualizar);
router.patch('/:id/hallazgo', puede('levantar'), controller.vincularConHallazgo);
router.post('/:id/seguimientos', puede('seguimiento'), subirArchivosSolicitud, controller.registrarSeguimiento);
router.get('/:id/evidencias/:evidenciaId/archivo', requireAuth, controller.descargarEvidencia);
router.post('/:id/revision', puede('revisar'), controller.revisar);
export default router;
