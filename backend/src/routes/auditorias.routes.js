import { Router } from "express";
import { requireAuth, requirePermiso } from "../middlewares/auth.js";
import * as controller from "../controllers/auditorias.controller.js";
import { subirArchivosSolicitud } from "../middlewares/uploadDocumento.js";

const router = Router();
const puede = (accion) => [requireAuth, requirePermiso(`auditorias.${accion}`)];

router.get("/", requireAuth, controller.listar);
router.get("/catalogos", requireAuth, controller.catalogos);
router.post("/", puede("planear"), controller.crear);
router.post("/:id/iniciar-ejecucion", puede("iniciar"), controller.iniciarEjecucion);
router.post("/:id/finalizar-informe", puede("finalizarInforme"), controller.finalizarInforme);
router.post(
    "/:id/hallazgos",
    puede("hallazgos"),
    subirArchivosSolicitud,
    controller.registrarHallazgo,
);
router.post(
    "/:id/hallazgos/:hallazgoId/seguimientos",
    requireAuth,
    subirArchivosSolicitud,
    controller.registrarSeguimientoHallazgo,
);
router.get(
    "/:id/hallazgos/:hallazgoId/archivos/:archivoId",
    requireAuth,
    controller.descargarArchivoHallazgo,
);
router.post(
    "/:id/hallazgos/:hallazgoId/enviar-revision",
    requireAuth,
    controller.enviarHallazgoARevision,
);
router.post(
    "/:id/hallazgos/:hallazgoId/revision",
    puede("hallazgos"),
    controller.revisarHallazgo,
);
export default router;
