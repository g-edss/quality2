import * as service from "../services/criteriosNorma.service.js";

function crearError(mensaje) {
    const error = new Error(mensaje);
    error.status = 400;
    error.publico = mensaje;
    return error;
}

function leerId(valor, nombre) {
    const id = Number(valor);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw crearError(`${nombre} no es válido.`);
    }

    return id;
}

function leerCriterio(body, edicion = false) {
    if (
        typeof body?.codigo !== "string" ||
        typeof body?.descripcion !== "string"
    ) {
        throw crearError("Indica el código y la descripción del criterio.");
    }

    const codigo = body.codigo.trim().toUpperCase();
    const descripcion = body.descripcion.trim();

    if (
        !codigo ||
        codigo.length > 80 ||
        !descripcion ||
        descripcion.length > 2000
    ) {
        throw crearError("Revisa el código y la descripción del criterio.");
    }

    if (edicion && typeof body.activo !== "boolean") {
        throw crearError("Indica si el criterio está activo.");
    }

    return edicion
        ? { codigo, descripcion, activo: body.activo }
        : { codigo, descripcion };
}

function leerListaCriterios(body) {
    if (!Array.isArray(body?.criterio_ids)) {
        throw crearError("Selecciona la lista de criterios de la norma.");
    }

    return body.criterio_ids.map((id) => leerId(id, "El criterio"));
}

export async function listarCriterios(_req, res, next) {
    try {
        res.json(await service.listarCriterios());
    } catch (error) {
        next(error);
    }
}

export async function crearCriterio(req, res, next) {
    try {
        res.status(201).json(
            await service.crearCriterio(leerCriterio(req.body)),
        );
    } catch (error) {
        next(error);
    }
}

export async function actualizarCriterio(req, res, next) {
    try {
        const id = leerId(req.params.criterioId, "El criterio");
        res.json(
            await service.actualizarCriterio(id, leerCriterio(req.body, true)),
        );
    } catch (error) {
        next(error);
    }
}

export async function listarCriteriosDeNorma(req, res, next) {
    try {
        const normaId = leerId(req.params.id, "La norma");
        res.json(await service.listarCriteriosDeNorma(normaId));
    } catch (error) {
        next(error);
    }
}

export async function guardarCriteriosDeNorma(req, res, next) {
    try {
        const normaId = leerId(req.params.id, "La norma");
        const criterioIds = leerListaCriterios(req.body);
        res.json(await service.guardarCriteriosDeNorma(normaId, criterioIds));
    } catch (error) {
        next(error);
    }
}
