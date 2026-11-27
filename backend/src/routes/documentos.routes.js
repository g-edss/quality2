import { Router } from "express";

import * as controller from "../controllers/documentos.controller.js";
import * as tiposController from "../controllers/tiposDocumento.controller.js";
import {
    requireAuth,
    requireRole,
    requirePermiso,
} from "../middlewares/auth.js";
import { subirDocumento } from "../middlewares/uploadDocumento.js";

const router = Router();

const verModulo = [requireAuth, requirePermiso("modulo.documentos")];
const puede = (accion) => [
    ...verModulo,
    requirePermiso(`documentos.${accion}`),
];

const rolesArchivos = [
    "admin_general",
    "responsable",
    "revisor",
    "aprobador",
    "visor",
];

router.get("/tipos", requireAuth, controller.listarTipos);
router.get(
    "/tipos/todos",
    puede("tiposDocumento"),
    tiposController.listarTodos,
);
router.post("/tipos", puede("tiposDocumento"), tiposController.crear);
router.put("/tipos/:id", puede("tiposDocumento"), tiposController.actualizar);
router.delete(
    "/tipos/:id",
    puede("tiposDocumento"),
    tiposController.desactivar,
);

router.get("/normas", requireAuth, controller.listarNormas);

router.get("/participantes", requireAuth, controller.listarParticipantes);

router.get("/visor", requireAuth, controller.listarVisor);

router.post(
    "/formato-registro",
    requireAuth,
    requirePermiso("almacenRegistros.crearFormato"),
    subirDocumento,
    controller.crearFormatoRegistro,
);

router.post(
    "/formato-registro/:id/versiones/:versionId/enviar-revision",
    requireAuth,
    requirePermiso("almacenRegistros.crearFormato"),
    controller.enviarRevisionFormatoRegistro,
);

router.get("/reporte", puede("reportes"), controller.listarReporteDocumental);

router.get(
    "/:id/revisiones-programadas",
    verModulo,
    controller.listarHistorialRevisiones,
);

router.get(
    "/:id/historial-versiones",
    requireAuth,
    requireRole("admin_general"),
    controller.listarHistorialVersiones,
);

router.get(
    "/:id/historial-versiones/:versionId/pdf",
    requireAuth,
    requireRole("admin_general"),
    controller.verPdfHistorial,
);

router.post(
    "/:id/revisiones-programadas/confirmar",
    puede("confirmarRevision"),
    controller.confirmarRevisionProgramada,
);

router.get(
    "/:id/copias-controladas",
    puede("copiasControladas"),
    controller.listarCopiasControladas,
);
router.get(
    "/:id/copias-controladas/:copiaId/pdf",
    puede("copiasControladas"),
    controller.descargarPdfCopiaControlada,
);
router.post(
    "/:id/copias-controladas/:copiaId/generar-pdf",
    puede("copiasControladas"),
    controller.generarPdfCopiaControlada,
);
router.patch(
    "/:id/copias-controladas/:copiaId/entregar",
    puede("copiasControladas"),
    controller.confirmarEntregaCopiaControlada,
);
router.patch(
    "/:id/copias-controladas/:copiaId/retirar",
    puede("copiasControladas"),
    controller.retirarCopiaControlada,
);

router.get("/", verModulo, controller.listarControl);

router.get(
    "/:id/versiones/:versionId/pdf",
    requireAuth,
    requireRole(...rolesArchivos),
    controller.verPdf,
);

router.get(
    "/:id/versiones/:versionId/original",
    requireAuth,
    requireRole(...rolesArchivos),
    controller.descargarOriginal,
);

router.post(
    "/:id/versiones/:versionId/correccion",
    puede("crear"),
    subirDocumento,
    controller.reemplazarCorreccion,
);

router.post(
    "/:id/versiones/:versionId/enviar-revision",
    puede("crear"),
    controller.enviarRevision,
);

router.post("/", puede("crear"), subirDocumento, controller.crear);

export default router;
