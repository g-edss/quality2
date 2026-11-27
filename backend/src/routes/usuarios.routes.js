import { Router } from 'express';
import {
  crear, listar, actualizar, eliminar, guardarPermisos,
  listarDocumentosOcultos, guardarDocumentosOcultos,
  obtenerPermisosRegistros, guardarPermisosRegistros,
} from '../controllers/usuarios.controller.js';
import { requireAuth, requireRole, requirePermiso } from '../middlewares/auth.js';
import * as perfil from '../controllers/perfil.controller.js';

const router = Router();
const administraUsuarios = requirePermiso('catalogo.usuarios');

router.get('/perfil', requireAuth, perfil.obtener);
router.put('/perfil', requireAuth, perfil.actualizar);
router.put('/password', requireAuth, perfil.cambiarPassword);
router.get('/', requireAuth, listar);
router.post('/', requireAuth, administraUsuarios, crear);
router.put('/:id', requireAuth, administraUsuarios, actualizar);
router.delete('/:id', requireAuth, requireRole('admin_general'), eliminar);
router.put('/:id/permisos', requireAuth, requireRole('admin_general'), guardarPermisos);
router.get('/:id/documentos-ocultos', requireAuth, requireRole('admin_general'), listarDocumentosOcultos);
router.put('/:id/documentos-ocultos', requireAuth, requireRole('admin_general'), guardarDocumentosOcultos);
router.get('/:id/permisos-registros', requireAuth, requireRole('admin_general'), obtenerPermisosRegistros);
router.put('/:id/permisos-registros', requireAuth, requireRole('admin_general'), guardarPermisosRegistros);

export default router;
