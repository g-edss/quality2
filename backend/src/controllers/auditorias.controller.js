import * as service from "../services/auditorias.service.js";
import { obtenerArchivoAuditoria } from "../services/archivosAuditoria.service.js";

function esFechaValida(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor))
    return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    anio >= 1900 &&
    anio <= 9999 &&
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

export async function listar(req, res, next) {
  try {
    res.json(await service.listar());
  } catch (error) {
    next(error);
  }
}

export async function catalogos(req, res, next) {
  try {
    res.json(await service.catalogos());
  } catch (error) {
    next(error);
  }
}

export async function crear(req, res, next) {
  try {
    const datos = req.body || {};
    for (const [campo, limite, obligatorio] of [
      ["nombre", 200, true],
      ["alcance", 10000, true],
      ["comentarios", 5000, false],
    ]) {
      if (
        (datos[campo] !== undefined && typeof datos[campo] !== "string") ||
        (obligatorio && !datos[campo]?.trim()) ||
        (datos[campo]?.length || 0) > limite
      ) {
        return res
          .status(400)
          .json({ error: `Revisa ${campo}; máximo ${limite} caracteres.` });
      }
    }
    if (
      ![datos.proceso_id, datos.auditor_catalogo_id].every(
        (id) => Number.isSafeInteger(id) && id > 0,
      )
    ) {
      return res
        .status(400)
        .json({ error: "Selecciona un proceso y un auditor del catálogo." });
    }
    if (!["interna", "externa"].includes(datos.tipo_auditoria)) {
      return res.status(400).json({
        error: "Selecciona si la auditoría es interna o externa.",
      });
    }
    if (!esFechaValida(datos.fecha_programada)) {
      return res
        .status(400)
        .json({ error: "Selecciona una fecha programada válida." });
    }
    res.status(201).json(
      await service.crear(
        {
          ...datos,
          nombre: datos.nombre.trim(),
          alcance: datos.alcance.trim(),
          comentarios: datos.comentarios?.trim() || "",
        },
        Number(req.auth.sub),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function iniciarEjecucion(req, res, next) {
  try {
    const auditoriaId = Number(req.params.id);

    if (!Number.isSafeInteger(auditoriaId) || auditoriaId <= 0) {
      return res.status(400).json({
        error: "La auditoría seleccionada no es válida.",
      });
    }

    const auditoria = await service.iniciarEjecucion(
      auditoriaId,
      Number(req.auth.sub),
    );

    res.json(auditoria);
  } catch (error) {
    next(error);
  }
}

export async function finalizarInforme(req, res, next) {
  try {
    const auditoriaId = Number(req.params.id);
    const { conclusion } = req.body || {};

    if (!Number.isSafeInteger(auditoriaId) || auditoriaId <= 0) {
      return res
        .status(400)
        .json({ error: "La auditoría seleccionada no es válida." });
    }

    if (
      typeof conclusion !== "string" ||
      !conclusion.trim() ||
      conclusion.length > 10000
    ) {
      return res.status(400).json({
        error: "Escribe la conclusión del informe; máximo 10000 caracteres.",
      });
    }

    res.json(
      await service.finalizarInforme(
        auditoriaId,
        Number(req.auth.sub),
        conclusion.trim(),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function registrarHallazgo(req, res, next) {
  try {
    const auditoriaId = Number(req.params.id);
    const { descripcion, criterio, evidencia_observada } = req.body || {};
    const responsable_id = req.is?.("multipart/form-data")
      ? Number(req.body?.responsable_id)
      : req.body?.responsable_id;
    const norma_id = req.body?.norma_id ? Number(req.body.norma_id) : null;
    const criterio_id = req.body?.criterio_id
      ? Number(req.body.criterio_id)
      : null;

    if (!Number.isSafeInteger(auditoriaId) || auditoriaId <= 0) {
      return res.status(400).json({
        error: "La auditoría seleccionada no es válida.",
      });
    }

    if (
      typeof descripcion !== "string" ||
      !descripcion.trim() ||
      descripcion.length > 10000
    ) {
      return res.status(400).json({
        error: "Describe el hallazgo; máximo 10000 caracteres.",
      });
    }

    if (
      typeof criterio !== "string" ||
      !criterio.trim() ||
      criterio.length > 10000
    ) {
      return res.status(400).json({
        error: "Indica la regla o criterio revisado; máximo 10000 caracteres.",
      });
    }

    if (
      typeof evidencia_observada !== "string" ||
      !evidencia_observada.trim() ||
      evidencia_observada.length > 10000
    ) {
      return res.status(400).json({
        error: "Describe la evidencia observada; máximo 10000 caracteres.",
      });
    }

    if (!Number.isSafeInteger(responsable_id) || responsable_id <= 0) {
      return res.status(400).json({
        error: "Selecciona un responsable válido.",
      });
    }

    if (
      (norma_id !== null &&
        (!Number.isSafeInteger(norma_id) || norma_id <= 0)) ||
      (criterio_id !== null &&
        (!Number.isSafeInteger(criterio_id) || criterio_id <= 0))
    ) {
      return res.status(400).json({
        error: "La norma o el criterio seleccionado no es válido.",
      });
    }

    if ((norma_id === null) !== (criterio_id === null)) {
      return res.status(400).json({
        error:
          "Selecciona tanto la norma como el criterio, o deja ambos vacíos.",
      });
    }

    const hallazgo = await service.registrarHallazgo(
      auditoriaId,
      {
        descripcion: descripcion.trim(),
        criterio: criterio.trim(),
        evidencia_observada: evidencia_observada.trim(),
        responsable_id,
        norma_id,
        criterio_id,
      },
      Number(req.auth.sub),
      req.files || [],
    );

    res.status(201).json(hallazgo);
  } catch (error) {
    next(error);
  }
}

export async function registrarSeguimientoHallazgo(req, res, next) {
  try {
    const auditoriaId = Number(req.params.id);
    const hallazgoId = Number(req.params.hallazgoId);
    const { comentario } = req.body || {};

    if (
      ![auditoriaId, hallazgoId].every(
        (id) => Number.isSafeInteger(id) && id > 0,
      )
    ) {
      return res.status(400).json({
        error: "La auditoría o el hallazgo seleccionado no es válido.",
      });
    }

    if (
      typeof comentario !== "string" ||
      !comentario.trim() ||
      comentario.length > 10000
    ) {
      return res.status(400).json({
        error: "Describe el avance; máximo 10000 caracteres.",
      });
    }

    const seguimiento = await service.registrarSeguimientoHallazgo(
      auditoriaId,
      hallazgoId,
      Number(req.auth.sub),
      comentario.trim(),
      req.files || [],
    );

    res.status(201).json(seguimiento);
  } catch (error) {
    next(error);
  }
}

export async function descargarArchivoHallazgo(req, res, next) {
  try {
    const ids = [
      req.params.id,
      req.params.hallazgoId,
      req.params.archivoId,
    ].map(Number);
    if (!ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
      return res
        .status(400)
        .json({ error: "El archivo seleccionado no es válido." });
    }

    const archivo = await obtenerArchivoAuditoria(...ids);
    res.download(archivo.rutaAbsoluta, archivo.nombreArchivo, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
}

export async function enviarHallazgoARevision(req, res, next) {
  try {
    const auditoriaId = Number(req.params.id);
    const hallazgoId = Number(req.params.hallazgoId);

    if (
      ![auditoriaId, hallazgoId].every(
        (id) => Number.isSafeInteger(id) && id > 0,
      )
    ) {
      return res.status(400).json({
        error: "La auditoría o el hallazgo seleccionado no es válido.",
      });
    }

    const hallazgo = await service.enviarHallazgoARevision(
      auditoriaId,
      hallazgoId,
      Number(req.auth.sub),
    );

    res.json(hallazgo);
  } catch (error) {
    next(error);
  }
}

export async function revisarHallazgo(req, res, next) {
  try {
    const auditoriaId = Number(req.params.id);
    const hallazgoId = Number(req.params.hallazgoId);
    const { decision, comentario = "" } = req.body || {};

    if (
      ![auditoriaId, hallazgoId].every(
        (id) => Number.isSafeInteger(id) && id > 0,
      )
    ) {
      return res.status(400).json({
        error: "La auditoría o el hallazgo seleccionado no es válido.",
      });
    }

    if (!["aceptar", "correcciones"].includes(decision)) {
      return res.status(400).json({
        error: "Selecciona aceptar o solicitar correcciones.",
      });
    }

    if (
      typeof comentario !== "string" ||
      comentario.length > 10000 ||
      (decision === "correcciones" && !comentario.trim())
    ) {
      return res.status(400).json({
        error:
          "Para solicitar correcciones escribe qué falta; máximo 10000 caracteres.",
      });
    }

    const hallazgo = await service.revisarHallazgo(
      auditoriaId,
      hallazgoId,
      Number(req.auth.sub),
      decision,
      comentario.trim(),
    );

    res.json(hallazgo);
  } catch (error) {
    next(error);
  }
}
