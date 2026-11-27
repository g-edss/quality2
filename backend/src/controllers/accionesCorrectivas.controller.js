import * as service from "../services/accionesCorrectivas.service.js";

function esFechaValida(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor))
    return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  if (anio < 1900 || anio > 9999) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
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

export async function crear(req, res, next) {
  try {
    const datos = req.body || {};
    const hallazgoId =
      datos.hallazgo_id == null || datos.hallazgo_id === ""
        ? null
        : Number(datos.hallazgo_id);

    if (
      hallazgoId !== null &&
      (!Number.isSafeInteger(hallazgoId) || hallazgoId <= 0)
    ) {
      return res
        .status(400)
        .json({ error: "El hallazgo seleccionado no es válido." });
    }
    const afectaOtrosProcesos = datos.afecta_otros_procesos;
    const procesosAfectados = datos.procesos_afectados;
    for (const [campo, limite, obligatorio] of [
      ["titulo", 200, true],
      ["descripcion", 10000, true],
      ["origen", 5000, false],
    ]) {
      if (
        (datos[campo] !== undefined && typeof datos[campo] !== "string") ||
        (obligatorio && !datos[campo]?.trim()) ||
        (datos[campo]?.length || 0) > limite
      ) {
        return res.status(400).json({
          error: `Revisa el campo ${campo}; máximo ${limite} caracteres.`,
        });
      }
    }
    if (
      ![datos.proceso_id, datos.responsable_id].every(
        (id) => Number.isSafeInteger(id) && id > 0,
      )
    ) {
      return res
        .status(400)
        .json({ error: "Selecciona un proceso y un responsable válidos." });
    }
    const tiposHallazgoValidos = [
      "No Conformidad mayor",
      "No Conformidad menor",
      "Oportunidad de Mejora",
      "Fortaleza",
    ];

    if (
      !["Correctiva", "Preventiva"].includes(datos.tipo) ||
      !tiposHallazgoValidos.includes(datos.tipo_hallazgo)
    ) {
      return res.status(400).json({
        error: "Selecciona el tipo de acción y el tipo de hallazgo.",
      });
    }

    if (
      typeof afectaOtrosProcesos !== "boolean" ||
      !Array.isArray(procesosAfectados) ||
      procesosAfectados.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(procesosAfectados).size !== procesosAfectados.length
    ) {
      return res.status(400).json({
        error: "Indica si afecta otros procesos y selecciona procesos válidos.",
      });
    }

    if (afectaOtrosProcesos && procesosAfectados.length === 0) {
      return res.status(400).json({
        error: "Selecciona al menos un proceso afectado.",
      });
    }

    if (!afectaOtrosProcesos && procesosAfectados.length > 0) {
      return res.status(400).json({
        error:
          "No puedes indicar procesos afectados si respondiste que no afecta otros procesos.",
      });
    }
    if (
      (datos.fecha_compromiso != null &&
        typeof datos.fecha_compromiso !== "string") ||
      !esFechaValida(datos.fecha_ocurrencia) ||
      (datos.fecha_compromiso && !esFechaValida(datos.fecha_compromiso)) ||
      (datos.fecha_compromiso &&
        datos.fecha_compromiso < datos.fecha_ocurrencia)
    ) {
      return res.status(400).json({
        error:
          "La fecha de ocurrencia es obligatoria y el compromiso no puede ser anterior.",
      });
    }
    const accion = await service.crear(
      {
        ...datos,
        hallazgo_id: hallazgoId,
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        origen: datos.origen?.trim() || "",
        fecha_compromiso: datos.fecha_compromiso || null,
      },
      Number(req.auth.sub),
    );
    res.status(201).json(accion);
  } catch (error) {
    next(error);
  }
}
export async function vincularConHallazgo(req, res, next) {
  try {
    const accionId = Number(req.params.id);
    const hallazgoId = Number(req.body?.hallazgo_id);

    if (
      !Number.isSafeInteger(accionId) ||
      accionId <= 0 ||
      !Number.isSafeInteger(hallazgoId) ||
      hallazgoId <= 0
    ) {
      return res.status(400).json({
        error: "La acción o el hallazgo seleccionado no es válido.",
      });
    }

    res.json(await service.vincularConHallazgo(accionId, hallazgoId));
  } catch (error) {
    next(error);
  }
}

export async function registrarSeguimiento(req, res, next) {
  try {
    const accionId = Number(req.params.id);
    const { comentario } = req.body || {};
    const valorRevision = req.body?.enviar_revision;
    const enviar_revision = req.is?.("multipart/form-data")
      ? { true: true, false: false }[valorRevision]
      : valorRevision;
    if (!Number.isSafeInteger(accionId) || accionId <= 0) {
      return res
        .status(400)
        .json({ error: "La acción seleccionada no es válida." });
    }
    if (
      typeof comentario !== "string" ||
      !comentario.trim() ||
      comentario.length > 10000
    ) {
      return res.status(400).json({
        error: "Describe el avance realizado; máximo 10000 caracteres.",
      });
    }
    if (typeof enviar_revision !== "boolean") {
      return res.status(400).json({
        error: "Indica si deseas guardar el avance o enviarlo a revisión.",
      });
    }
    res
      .status(201)
      .json(
        await service.registrarSeguimiento(
          accionId,
          Number(req.auth.sub),
          comentario.trim(),
          enviar_revision,
          req.files || [],
        ),
      );
  } catch (error) {
    next(error);
  }
}

export async function revisar(req, res, next) {
  try {
    const accionId = Number(req.params.id);
    const { decision, comentario = "" } = req.body || {};
    if (!Number.isSafeInteger(accionId) || accionId <= 0) {
      return res
        .status(400)
        .json({ error: "La acción seleccionada no es válida." });
    }
    if (!["aceptar", "correcciones"].includes(decision)) {
      return res
        .status(400)
        .json({ error: "Selecciona aceptar o solicitar correcciones." });
    }
    if (
      typeof comentario !== "string" ||
      comentario.length > 10000 ||
      (decision === "correcciones" && !comentario.trim())
    ) {
      return res.status(400).json({
        error:
          "Para solicitar correcciones debes escribir qué debe corregirse; máximo 10000 caracteres.",
      });
    }
    res.json(
      await service.revisar(
        accionId,
        Number(req.auth.sub),
        decision,
        comentario.trim(),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function descargarEvidencia(req, res, next) {
  try {
    const accionId = Number(req.params.id);
    const evidenciaId = Number(req.params.evidenciaId);
    if (
      ![accionId, evidenciaId].every((id) => Number.isSafeInteger(id) && id > 0)
    ) {
      return res
        .status(400)
        .json({ error: "La evidencia seleccionada no es válida." });
    }
    const archivo = await service.obtenerEvidencia(accionId, evidenciaId);
    res.download(archivo.rutaAbsoluta, archivo.nombreArchivo, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req, res, next) {
  try {
    const accionId = Number(req.params.id);
    const datos = req.body || {};

    if (!Number.isSafeInteger(accionId) || accionId <= 0) {
      return res
        .status(400)
        .json({ error: "La acción seleccionada no es válida." });
    }

    for (const [campo, limite, obligatorio] of [
      ["titulo", 200, true],
      ["descripcion", 10000, true],
      ["origen", 5000, false],
    ]) {
      if (
        (datos[campo] !== undefined && typeof datos[campo] !== "string") ||
        (obligatorio && !datos[campo]?.trim()) ||
        (datos[campo]?.length || 0) > limite
      ) {
        return res.status(400).json({
          error: `Revisa el campo ${campo}; máximo ${limite} caracteres.`,
        });
      }
    }

    if (
      !Number.isSafeInteger(datos.responsable_id) ||
      datos.responsable_id <= 0
    ) {
      return res
        .status(400)
        .json({ error: "Selecciona un responsable válido." });
    }

    const tiposHallazgoValidos = [
      "No Conformidad mayor",
      "No Conformidad menor",
      "Oportunidad de Mejora",
      "Fortaleza",
    ];
    if (
      !["Correctiva", "Preventiva"].includes(datos.tipo) ||
      !tiposHallazgoValidos.includes(datos.tipo_hallazgo)
    ) {
      return res.status(400).json({
        error: "Selecciona el tipo de acción y el tipo de hallazgo.",
      });
    }

    if (
      !esFechaValida(datos.fecha_ocurrencia) ||
      (datos.fecha_compromiso && !esFechaValida(datos.fecha_compromiso)) ||
      (datos.fecha_compromiso &&
        datos.fecha_compromiso < datos.fecha_ocurrencia)
    ) {
      return res.status(400).json({
        error:
          "La fecha de ocurrencia es obligatoria y el compromiso no puede ser anterior.",
      });
    }

    const accion = await service.actualizar(
      accionId,
      {
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        origen: datos.origen?.trim() || "",
        tipo: datos.tipo,
        tipo_hallazgo: datos.tipo_hallazgo,
        responsable_id: datos.responsable_id,
        fecha_ocurrencia: datos.fecha_ocurrencia,
        fecha_compromiso: datos.fecha_compromiso || null,
      },
      Number(req.auth.sub),
    );
    res.json(accion);
  } catch (error) {
    next(error);
  }
}
