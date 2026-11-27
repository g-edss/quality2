import { query } from "../config/db.js";

function crearError(mensaje, status) {
    const error = new Error(mensaje);
    error.status = status;
    error.publico = mensaje;
    return error;
}

function validarId(valor, nombre) {
    const id = Number(valor);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw crearError(`${nombre} no es válido.`, 400);
    }

    return id;
}

export async function obtenerChecklist(procesoId) {
    const id = validarId(procesoId, "El proceso");

    const proceso = await query("SELECT id FROM procesos WHERE id = $1", [id]);

    if (!proceso.rows[0]) {
        throw crearError("El proceso no existe.", 404);
    }

    const { rows } = await query(
        `SELECT
       n.id AS norma_id,
       n.codigo AS norma_codigo,
       n.nombre AS norma_nombre,
       c.id AS criterio_id,
       c.codigo AS criterio_codigo,
       c.descripcion,
       e.cumple,
       e.observacion,
       e.evaluado_por,
       e.evaluado_en,
       u.nombre AS evaluado_por_nombre
     FROM proceso_normas pn
     JOIN normas n
       ON n.id = pn.norma_id AND n.activo = TRUE
     JOIN norma_criterios nc ON nc.norma_id = n.id
     JOIN criterios_norma c
       ON c.id = nc.criterio_id AND c.activo = TRUE
     LEFT JOIN LATERAL (
       SELECT cumple, observacion, evaluado_por, evaluado_en
       FROM proceso_criterio_evaluaciones
       WHERE proceso_id = pn.proceso_id AND criterio_id = c.id
       ORDER BY evaluado_en DESC, id DESC
       LIMIT 1
     ) e ON TRUE
     LEFT JOIN usuarios u ON u.id = e.evaluado_por
     WHERE pn.proceso_id = $1
     ORDER BY n.codigo, c.codigo`,
        [id],
    );

    return rows;
}

export async function registrarEvaluacion({
    procesoId,
    criterioId,
    cumple,
    observacion,
    evaluadoPor,
}) {
    const proceso = validarId(procesoId, "El proceso");
    const criterio = validarId(criterioId, "El criterio");
    const usuario = validarId(evaluadoPor, "El usuario");

    if (typeof cumple !== "boolean") {
        throw crearError("Indica si el criterio cumple o no cumple.", 400);
    }

    if (observacion != null && typeof observacion !== "string") {
        throw crearError("La observación no es válida.", 400);
    }

    const texto = observacion?.trim() || null;

    if (texto && texto.length > 2000) {
        throw crearError(
            "La observación no puede superar 2000 caracteres.",
            400,
        );
    }

    const { rows } = await query(
        `INSERT INTO proceso_criterio_evaluaciones
        (proceso_id, criterio_id, cumple, observacion, evaluado_por)
        SELECT p.id, c.id, $3, $4, $5
        FROM procesos p
        JOIN proceso_normas pn ON pn.proceso_id = p.id
        JOIN normas n ON n.id = pn.norma_id AND n.activo = TRUE
        JOIN norma_criterios nc ON nc.norma_id = n.id
        JOIN criterios_norma c
        ON c.id = nc.criterio_id AND c.activo = TRUE
        WHERE p.id = $1
        AND p.estatus = 'activo'
        AND c.id = $2
        RETURNING id, proceso_id, criterio_id, cumple, observacion,
                evaluado_por, evaluado_en`,
        [proceso, criterio, cumple, texto, usuario],
    );

    if (!rows[0]) {
        throw crearError(
            "El criterio no está activo o su norma no está vinculada al proceso.",
            400,
        );
    }

    return rows[0];
}
