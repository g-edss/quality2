import { Router } from "express";

import * as controller from "../controllers/solicitudes.controller.js";

import { subirArchivosSolicitud } from "../middlewares/uploadDocumento.js";

import { requireAuth, requireRole, requirePermiso } from "../middlewares/auth.js";

const router = Router();

const PERMISO_POR_TIPO = {
    cambio: "solicitudes.solicitarCambio",
    baja: "solicitudes.solicitarBaja",
};

function permisoSegunTipo(req, res, next) {
    const tipo = String(req.body?.tipoClave || "").trim().toLowerCase();
    const permiso = PERMISO_POR_TIPO[tipo];

    if (!permiso) return next();
    return requirePermiso(permiso)(req, res, next);
}

router.get("/", requireAuth, controller.listar);

router.get("/:id/historial", requireAuth, controller.historial);
router.post(
    "/:id/cancelar",
    requireAuth,
    requirePermiso("solicitudes.cancelar"),
    controller.cancelar,
);

router.post(
    "/:id/reenviar",
    requireAuth,
    requirePermiso("solicitudes.reenviar"),
    subirArchivosSolicitud,
    controller.reenviar,
);

router.post(
    "/",
    requireAuth,
    subirArchivosSolicitud,
    permisoSegunTipo,
    controller.crear,
);

router.get(
    "/:id/archivos/:archivoId",
    requireAuth,
    controller.descargarArchivo,
);

router.post(
    "/:id/aprobar",
    requireAuth,
    requireRole("aprobador"),
    controller.aprobar,
);

router.post(
    "/:id/avanzar",
    requireAuth,
    requireRole("responsable", "revisor"),
    controller.avanzar,
);

router.post(
    "/:id/correcciones",
    requireAuth,
    requireRole("responsable", "revisor", "aprobador"),
    controller.devolver,
);

router.post(
    "/:id/rechazar",
    requireAuth,
    requireRole("responsable", "revisor", "aprobador"),
    controller.rechazar,
);

export default router;
