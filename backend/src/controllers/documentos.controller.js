import * as documentosService from "../services/documentos.service.js";

function crearErrorValidacion(mensaje) {
    const error = new Error(mensaje);

    error.status = 400;
    error.publico = mensaje;

    return error;
}

function obtenerTexto(valor) {
    return typeof valor === "string" ? valor.trim() : "";
}

function obtenerIdOpcional(valor) {
    if (valor === undefined || valor === null || valor === "") {
        return null;
    }

    const id = Number(valor);

    if (!Number.isInteger(id) || id <= 0) {
        throw crearErrorValidacion("Se recibió un identificador no válido.");
    }

    return id;
}

function obtenerBooleano(valor) {
    if (valor === true || valor === "true" || valor === "1") {
        return true;
    }

    if (
        valor === false ||
        valor === "false" ||
        valor === "0" ||
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return false;
    }

    throw crearErrorValidacion("Se recibió un valor booleano no válido.");
}

function obtenerListaIds(valor, nombreCampo) {
    if (valor === undefined || valor === null || valor === "") {
        return [];
    }

    let elementos;

    try {
        elementos = JSON.parse(valor);
    } catch {
        throw crearErrorValidacion(
            `El campo ${nombreCampo} no tiene un formato válido.`,
        );
    }

    if (!Array.isArray(elementos)) {
        throw crearErrorValidacion(
            `El campo ${nombreCampo} debe ser una lista.`,
        );
    }

    const ids = elementos.map(Number);

    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw crearErrorValidacion(
            `El campo ${nombreCampo} contiene elementos no válidos.`,
        );
    }

    return [...new Set(ids)];
}

function esFechaIsoValida(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }

    const fecha = new Date(`${valor}T00:00:00.000Z`);

    return (
        !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === valor
    );
}

export async function listarTipos(_req, res, next) {
    try {
        const tipos = await documentosService.listarTiposDocumento();

        res.json(tipos);
    } catch (error) {
        next(error);
    }
}

export async function listarNormas(_req, res, next) {
    try {
        const normas = await documentosService.listarNormasDocumento();

        res.json(normas);
    } catch (error) {
        next(error);
    }
}

export async function listarParticipantes(_req, res, next) {
    try {
        const participantes =
            await documentosService.listarParticipantesFlujo();

        res.json(participantes);
    } catch (error) {
        next(error);
    }
}

export async function listarControl(_req, res, next) {
    try {
        const documentos = await documentosService.listarDocumentosControl();

        res.json(documentos);
    } catch (error) {
        next(error);
    }
}

export async function listarReporteDocumental(_req, res, next) {
    try {
        const reporte = await documentosService.listarReporteDocumental();

        res.json(reporte);
    } catch (error) {
        next(error);
    }
}

export async function listarHistorialRevisiones(req, res, next) {
    try {
        const documentoId = Number(req.params.id);

        if (!Number.isInteger(documentoId) || documentoId <= 0) {
            return res.status(400).json({
                error: "El documento no es válido.",
            });
        }

        const historial =
            await documentosService.listarHistorialRevisiones(documentoId);

        res.json(historial);
    } catch (error) {
        next(error);
    }
}

export async function listarHistorialVersiones(req, res, next) {
    try {
        const documentoId = Number(req.params.id);

        if (!Number.isInteger(documentoId) || documentoId <= 0) {
            return res
                .status(400)
                .json({ error: "El documento no es válido." });
        }

        const historial =
            await documentosService.listarHistorialVersiones(documentoId);
        res.json(historial);
    } catch (error) {
        next(error);
    }
}

export async function confirmarRevisionProgramada(req, res, next) {
    try {
        const documentoId = Number(req.params.id);

        if (!Number.isInteger(documentoId) || documentoId <= 0) {
            return res.status(400).json({
                error: "El documento no es válido.",
            });
        }

        const comentario =
            typeof req.body.comentario === "string"
                ? req.body.comentario.trim()
                : "";

        if (comentario.length > 2000) {
            return res.status(400).json({
                error: "El comentario debe tener máximo 2000 caracteres.",
            });
        }

        const revision = await documentosService.confirmarRevisionProgramada({
            documentoId,
            usuarioId: Number(req.auth.sub),
            comentario,
        });

        res.json({
            mensaje:
                "La revisión fue registrada y se calculó la próxima fecha.",
            revision,
        });
    } catch (error) {
        next(error);
    }
}

export async function listarCopiasControladas(req, res, next) {
    try {
        const documentoId = Number(req.params.id);

        if (!Number.isInteger(documentoId) || documentoId <= 0) {
            return res.status(400).json({
                error: "El documento no es válido.",
            });
        }

        const copias =
            await documentosService.listarCopiasControladas(documentoId);

        res.json(copias);
    } catch (error) {
        next(error);
    }
}

export async function descargarPdfCopiaControlada(req, res, next) {
    try {
        const documentoId = Number(req.params.id);
        const copiaId = Number(req.params.copiaId);

        if (
            !Number.isInteger(documentoId) ||
            documentoId <= 0 ||
            !Number.isInteger(copiaId) ||
            copiaId <= 0
        ) {
            return res.status(400).json({
                error: "El documento o la copia controlada no son válidos.",
            });
        }

        const archivo = await documentosService.obtenerPdfCopiaControlada({
            documentoId,
            copiaId,
        });

        res.type("application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${archivo.nombreDescarga}"`,
        );

        res.sendFile(archivo.rutaAbsoluta, (error) => {
            if (error && !res.headersSent) {
                next(error);
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function generarPdfCopiaControlada(req, res, next) {
    try {
        const documentoId = Number(req.params.id);
        const copiaId = Number(req.params.copiaId);

        if (
            !Number.isInteger(documentoId) ||
            documentoId <= 0 ||
            !Number.isInteger(copiaId) ||
            copiaId <= 0
        ) {
            return res.status(400).json({
                error: "El documento o la copia controlada no son válidos.",
            });
        }

        const copia =
            await documentosService.generarPdfCopiaControladaExistente({
                documentoId,
                copiaId,
            });

        res.json({
            mensaje:
                "El PDF de la copia controlada fue generado correctamente.",
            copia,
        });
    } catch (error) {
        next(error);
    }
}

export async function confirmarEntregaCopiaControlada(req, res, next) {
    try {
        const documentoId = Number(req.params.id);
        const copiaId = Number(req.params.copiaId);
        const nombre = req.body?.recibida_por_nombre;
        const observaciones = req.body?.observaciones;
        if (
            !Number.isInteger(documentoId) ||
            documentoId <= 0 ||
            !Number.isInteger(copiaId) ||
            copiaId <= 0 ||
            typeof nombre !== "string" ||
            !nombre.trim() ||
            nombre.trim().length > 200 ||
            (observaciones !== undefined &&
                (typeof observaciones !== "string" ||
                    observaciones.length > 2000)) ||
            req.body?.confirmada !== true
        ) {
            return res.status(400).json({
                error: "Confirma la entrega e indica quién recibió la copia (máximo 200 caracteres).",
            });
        }
        const copia = await documentosService.confirmarEntregaCopiaControlada({
            documentoId,
            copiaId,
            usuarioId: Number(req.auth.sub),
            recibidaPorNombre: nombre.trim(),
            observaciones: observaciones?.trim() || "",
        });
        res.json({
            mensaje: "Entrega física registrada correctamente.",
            copia,
        });
    } catch (error) {
        next(error);
    }
}

export async function retirarCopiaControlada(req, res, next) {
    try {
        const documentoId = Number(req.params.id);
        const copiaId = Number(req.params.copiaId);

        if (
            !Number.isInteger(documentoId) ||
            documentoId <= 0 ||
            !Number.isInteger(copiaId) ||
            copiaId <= 0
        ) {
            return res.status(400).json({
                error: "El documento o la copia controlada no son válidos.",
            });
        }

        const accion = obtenerTexto(req.body.accion);
        const comentario = obtenerTexto(req.body.comentario);

        if (!["retirada", "conservada_obsoleta"].includes(accion)) {
            return res.status(400).json({
                error: "Selecciona qué ocurrió con la copia impresa.",
            });
        }

        if (comentario.length > 2000) {
            return res.status(400).json({
                error: "El comentario debe tener máximo 2000 caracteres.",
            });
        }

        const copia = await documentosService.retirarCopiaControlada({
            documentoId,
            copiaId,
            usuarioId: Number(req.auth.sub),
            accion,
            comentario,
        });

        res.json({
            mensaje: "El retiro de la copia fue registrado correctamente.",
            copia,
        });
    } catch (error) {
        next(error);
    }
}

export async function listarVisor(req, res, next) {
    try {
        const documentos = await documentosService.listarDocumentosVisor({
            usuarioId:
                req.auth.rol === "admin_general" ? null : Number(req.auth.sub),
        });

        res.json(documentos);
    } catch (error) {
        next(error);
    }
}

export async function crear(req, res, next) {
    try {
        const nombre = obtenerTexto(req.body.nombre);

        const version = obtenerTexto(req.body.version) || "1.0";

        const origen = obtenerTexto(req.body.origen);

        const justificacion = obtenerTexto(req.body.justificacion);

        const tipoDocumentoId = obtenerIdOpcional(req.body.tipo_documento_id);

        const procesoId = obtenerIdOpcional(req.body.proceso_id);

        const elaboradorId = obtenerIdOpcional(req.body.elaborador_id);

        const revisionProgramada = obtenerBooleano(
            req.body.revision_programada,
        );

        const revisionCadaMeses = revisionProgramada
            ? Number(req.body.revision_cada_meses)
            : null;

        const proximaRevision = revisionProgramada
            ? obtenerTexto(req.body.proxima_revision)
            : null;

        const normaIds = obtenerListaIds(req.body.norma_ids, "norma_ids");

        const documentosRelacionadosIds = obtenerListaIds(
            req.body.documentos_relacionados_ids,
            "documentos_relacionados_ids",
        );

        const registroConfig = {
            dondeConserva: obtenerTexto(req.body.registro_donde_conserva),

            quienConserva: obtenerTexto(req.body.registro_quien_conserva),

            frecuenciaUso: obtenerTexto(req.body.registro_frecuencia_uso),

            almacenamientoProteccion: obtenerTexto(
                req.body.registro_almacenamiento_proteccion,
            ),

            tiempoRetencion: obtenerTexto(req.body.registro_tiempo_retencion),

            disposicionFinal: obtenerTexto(req.body.registro_disposicion_final),
        };

        if (!nombre || nombre.length > 200) {
            return res.status(400).json({
                error: "El nombre es obligatorio y debe tener máximo 200 caracteres.",
            });
        }

        if (tipoDocumentoId === null) {
            return res.status(400).json({
                error: "Selecciona un tipo de documento válido.",
            });
        }

        if (elaboradorId === null) {
            return res.status(400).json({
                error: "Selecciona al elaborador del documento.",
            });
        }

        if (!["interno", "externo"].includes(origen)) {
            return res.status(400).json({
                error: "Selecciona un origen válido.",
            });
        }

        if (!version || version.length > 20) {
            return res.status(400).json({
                error: "La versión es obligatoria y debe tener máximo 20 caracteres.",
            });
        }

        if (!justificacion || justificacion.length > 2000) {
            return res.status(400).json({
                error: "La justificación es obligatoria y debe tener máximo 2000 caracteres.",
            });
        }

        if (revisionProgramada) {
            if (
                !Number.isInteger(revisionCadaMeses) ||
                revisionCadaMeses <= 0
            ) {
                return res.status(400).json({
                    error: "Indica cada cuántos meses debe revisarse el documento.",
                });
            }

            if (!esFechaIsoValida(proximaRevision)) {
                return res.status(400).json({
                    error: "Selecciona una próxima revisión válida.",
                });
            }
        }

        if (!req.file) {
            return res.status(400).json({
                error: "Debes seleccionar el archivo original.",
            });
        }

        const documento = await documentosService.crearDocumentoConArchivo({
            nombre,
            tipoDocumentoId,
            origen,
            procesoId,
            version,
            elaboradorId,
            creadoPorId: Number(req.auth.sub),
            justificacion,
            revisionProgramada,
            revisionCadaMeses,
            proximaRevision,
            normaIds,
            documentosRelacionadosIds,
            registroConfig,
            archivo: req.file,
        });

        const conversionFallida =
            documento.version_actual.estado_conversion === "error";

        res.status(201).json({
            mensaje: conversionFallida
                ? "El original se guardó, pero no fue posible generar el PDF."
                : "Documento y versión guardados correctamente.",
            documento,
        });
    } catch (error) {
        next(error);
    }
}

export async function crearFormatoRegistro(req, res, next) {
    try {
        const tipos = await documentosService.listarTiposDocumento();
        const tipoRegistro = tipos.find(
            (tipo) =>
                tipo.nombre.trim().toLocaleLowerCase("es-MX") === "registro",
        );

        if (!tipoRegistro) {
            return res.status(404).json({
                error: "No existe un tipo de documento Registro activo.",
            });
        }

        req.body.tipo_documento_id = String(tipoRegistro.id);
        req.body.elaborador_id = String(req.auth.sub);

        await crear(req, res, next);
    } catch (error) {
        next(error);
    }
}

function obtenerIdentificadores(req) {
    const documentoId = Number(req.params.id);
    const versionId = Number(req.params.versionId);

    if (
        !Number.isInteger(documentoId) ||
        documentoId <= 0 ||
        !Number.isInteger(versionId) ||
        versionId <= 0
    ) {
        return null;
    }

    return {
        documentoId,
        versionId,
    };
}

export async function verPdf(req, res, next) {
    try {
        const identificadores = obtenerIdentificadores(req);

        if (!identificadores) {
            return res.status(400).json({
                error: "El documento o la versión no son válidos.",
            });
        }

        const archivo = await documentosService.obtenerArchivoDocumento({
            ...identificadores,
            tipo: "pdf",
            rol: req.auth.rol,
            usuarioId: Number(req.auth.sub),
        });

        res.type("application/pdf");

        res.sendFile(archivo.rutaAbsoluta, (error) => {
            if (error && !res.headersSent) {
                next(error);
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function verPdfHistorial(req, res, next) {
    return verPdf(req, res, next);
}

export async function descargarOriginal(req, res, next) {
    try {
        const identificadores = obtenerIdentificadores(req);

        if (!identificadores) {
            return res.status(400).json({
                error: "El documento o la versión no son válidos.",
            });
        }

        const archivo = await documentosService.obtenerArchivoDocumento({
            ...identificadores,
            tipo: "original",
            rol: req.auth.rol,
            usuarioId: Number(req.auth.sub),
        });

        res.download(archivo.rutaAbsoluta, archivo.nombreDescarga, (error) => {
            if (error && !res.headersSent) {
                next(error);
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function enviarRevision(req, res, next) {
    try {
        const identificadores = obtenerIdentificadores(req);

        if (!identificadores) {
            return res.status(400).json({
                error: "El documento o la versión no son válidos.",
            });
        }

        function idOpcional(valor) {
            if (valor === undefined || valor === null || valor === "") {
                return null;
            }

            return Number(valor);
        }

        const responsableId = idOpcional(req.body.responsable_id);

        const revisorId = idOpcional(req.body.revisor_id);

        const aprobadorId = idOpcional(req.body.aprobador_id);

        const ids = [responsableId, revisorId, aprobadorId].filter(
            (id) => id !== null,
        );

        if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
            return res.status(400).json({
                error: "Uno de los participantes no es válido.",
            });
        }

        if (aprobadorId === null) {
            return res.status(400).json({
                error: "Debes seleccionar un aprobador.",
            });
        }

        const comentario =
            typeof req.body.comentario === "string"
                ? req.body.comentario.trim()
                : "";

        if (comentario.length > 2000) {
            return res.status(400).json({
                error: "El comentario debe tener máximo 2000 caracteres.",
            });
        }

        const solicitud = await documentosService.enviarARevision({
            ...identificadores,
            solicitanteId: Number(req.auth.sub),
            solicitanteRol: req.auth.rol,
            responsableId,
            revisorId,
            aprobadorId,
            comentario,
        });

        res.status(201).json({
            mensaje: "El documento fue enviado al flujo de revisión.",
            solicitud,
        });
    } catch (error) {
        next(error);
    }
}

export async function enviarRevisionFormatoRegistro(req, res, next) {
    try {
        const documentoId = Number(req.params.id);

        if (
            !Number.isInteger(documentoId) ||
            documentoId <= 0 ||
            !(await documentosService.esDocumentoRegistro(documentoId))
        ) {
            return res.status(404).json({
                error: "No se encontró el formato de Registro.",
            });
        }

        await enviarRevision(req, res, next);
    } catch (error) {
        next(error);
    }
}

export async function reemplazarCorreccion(req, res, next) {
    try {
        const documentoId = Number(req.params.id);
        const versionId = Number(req.params.versionId);

        if (
            !Number.isInteger(documentoId) ||
            documentoId <= 0 ||
            !Number.isInteger(versionId) ||
            versionId <= 0
        ) {
            return res.status(400).json({
                error: "El documento o la versión no son válidos.",
            });
        }

        const version = await documentosService.reemplazarArchivoCorregido({
            documentoId,
            versionId,
            usuarioId: Number(req.auth.sub),
            usuarioRol: req.auth.rol,
            archivo: req.file,
        });

        const conversionFallida = version.estado_conversion === "error";

        res.json({
            mensaje: conversionFallida
                ? "El archivo se guardó, pero no se pudo generar el PDF."
                : "El archivo corregido se guardó correctamente.",
            version,
        });
    } catch (error) {
        next(error);
    }
}
