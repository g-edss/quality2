import { Router } from "express";
import { requireAuth, requirePermiso } from "../middlewares/auth.js";
import * as controller from "../controllers/medicionesIndicadores.controller.js";

const router = Router();
const puede = (accion) => [
    requireAuth,
    requirePermiso(`indicadores.${accion}`),
];

router.get(
    "/:indicadorId/mediciones",
    requireAuth,
    requirePermiso("catalogo.indicadores"),
    controller.listarPorIndicador,
);
router.post(
    "/:indicadorId/mediciones",
    puede("capturarMediciones"),
    controller.crear,
);
router.put(
    "/:indicadorId/mediciones/:medicionId",
    puede("editarMediciones"),
    controller.actualizar,
);
router.delete(
    "/:indicadorId/mediciones/:medicionId",
    puede("eliminarMediciones"),
    controller.eliminar,
);

export default router;
