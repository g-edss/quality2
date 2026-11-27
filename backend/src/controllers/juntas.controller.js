import * as service from "../services/juntas.service.js";

function validarDatos(datos) {
  for (const [campo, limite, obligatorio] of [
    ["nombre", 200, true],
    ["agenda", 10000, true],
    ["notas", 5000, false],
  ]) {
    if (
      typeof datos[campo] !== "string" ||
      (obligatorio && !datos[campo].trim()) ||
      datos[campo].length > limite
    ) {
      return `Revisa ${campo}; máximo ${limite} caracteres.`;
    }
  }
  if (!["Ordinaria", "Extraordinaria", "Seguimiento"].includes(datos.tipo)) {
    return "Selecciona un tipo de junta válido.";
  }
  if (!["Presencial", "Virtual", "Híbrida"].includes(datos.modalidad)) {
    return "Selecciona una modalidad válida.";
  }
  if (
    !Array.isArray(datos.participantes_ids) ||
    datos.participantes_ids.length > 100 ||
    datos.participantes_ids.some(
      (id) => !Number.isSafeInteger(id) || id <= 0,
    ) ||
    new Set(datos.participantes_ids).size !== datos.participantes_ids.length
  ) {
    return "Selecciona participantes válidos, sin repetir.";
  }
  if (
    typeof datos.fecha !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(datos.fecha) ||
    Number.isNaN(Date.parse(datos.fecha))
  ) {
    return "Selecciona una fecha y hora válidas.";
  }
  return null;
}

function limpiarDatos(datos) {
  return {
    nombre: datos.nombre.trim(),
    fecha: datos.fecha,
    tipo: datos.tipo,
    modalidad: datos.modalidad,
    participantes_ids: datos.participantes_ids,
    agenda: datos.agenda.trim(),
    notas: datos.notas.trim(),
  };
}

function idValido(valor) {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function textoValido(valor, limite) {
  return (
    typeof valor === "string" &&
    valor.trim().length > 0 &&
    valor.length <= limite
  );
}

function fechaValida(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor))
    return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

export async function listar(_req, res, next) {
  try {
    res.json(await service.listar());
  } catch (error) {
    next(error);
  }
}

export async function catalogos(_req, res, next) {
  try {
    res.json(await service.catalogos());
  } catch (error) {
    next(error);
  }
}

export async function crear(req, res, next) {
  try {
    const datos = { notas: "", ...req.body };
    const error = validarDatos(datos);
    if (error) return res.status(400).json({ error });
    const junta = await service.crear(
      limpiarDatos(datos),
      Number(req.auth.sub),
    );
    res.status(201).json(junta);
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ error: "La junta seleccionada no es válida." });
    }
    const error = validarDatos(req.body || {});
    if (error) return res.status(400).json({ error });
    res.json(
      await service.actualizar(
        id,
        limpiarDatos(req.body),
        Number(req.auth.sub),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function iniciar(req, res, next) {
  try {
    const id = idValido(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ error: "La junta seleccionada no es válida." });
    res.json(await service.iniciar(id));
  } catch (error) {
    next(error);
  }
}

export async function guardarMinuta(req, res, next) {
  try {
    const id = idValido(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ error: "La junta seleccionada no es válida." });
    if (!textoValido(req.body?.contenido, 20000)) {
      return res
        .status(400)
        .json({ error: "Escribe la minuta; máximo 20000 caracteres." });
    }
    res.json(
      await service.guardarMinuta(
        id,
        req.body.contenido.trim(),
        Number(req.auth.sub),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function guardarAsistentes(req, res, next) {
  try {
    const id = idValido(req.params.id);
    const usuarioIds = req.body?.usuario_ids;
    if (!id)
      return res
        .status(400)
        .json({ error: "La junta seleccionada no es válida." });
    if (
      !Array.isArray(usuarioIds) ||
      usuarioIds.length > 100 ||
      usuarioIds.some((valor) => !Number.isSafeInteger(valor) || valor <= 0) ||
      new Set(usuarioIds).size !== usuarioIds.length
    ) {
      return res
        .status(400)
        .json({ error: "Selecciona asistentes válidos, sin repetir." });
    }
    res.json(await service.guardarAsistentes(id, usuarioIds));
  } catch (error) {
    next(error);
  }
}

export async function guardarAccionesCorrectivas(req, res, next) {
  try {
    const id = idValido(req.params.id);
    const accionIds = req.body?.accion_ids;

    if (!id) {
      return res
        .status(400)
        .json({ error: "La junta seleccionada no es válida." });
    }

    if (
      !Array.isArray(accionIds) ||
      accionIds.length > 200 ||
      accionIds.some((valor) => !Number.isSafeInteger(valor) || valor <= 0) ||
      new Set(accionIds).size !== accionIds.length
    ) {
      return res.status(400).json({
        error: "Selecciona acciones correctivas válidas, sin repetir.",
      });
    }

    res.json(
      await service.guardarAccionesCorrectivas(
        id,
        accionIds,
        Number(req.auth.sub),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function crearCompromiso(req, res, next) {
  try {
    const id = idValido(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ error: "La junta seleccionada no es válida." });
    const { descripcion, responsable_id, fecha_compromiso } = req.body || {};
    if (
      !textoValido(descripcion, 10000) ||
      !Number.isSafeInteger(responsable_id) ||
      responsable_id <= 0 ||
      !fechaValida(fecha_compromiso)
    ) {
      return res.status(400).json({
        error: "Completa el acuerdo, responsable y fecha compromiso.",
      });
    }
    res.status(201).json(
      await service.crearCompromiso(id, {
        descripcion: descripcion.trim(),
        responsable_id,
        fecha_compromiso,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function registrarAvance(req, res, next) {
  try {
    const id = idValido(req.params.id);
    const compromisoId = idValido(req.params.compromisoId);
    if (!id || !compromisoId)
      return res
        .status(400)
        .json({ error: "El acuerdo seleccionado no es válido." });
    if (!textoValido(req.body?.descripcion, 10000)) {
      return res
        .status(400)
        .json({ error: "Describe el avance; máximo 10000 caracteres." });
    }
    res
      .status(201)
      .json(
        await service.registrarAvance(
          id,
          compromisoId,
          req.body.descripcion.trim(),
          Number(req.auth.sub),
        ),
      );
  } catch (error) {
    next(error);
  }
}

export async function cerrarCompromiso(req, res, next) {
  try {
    const id = idValido(req.params.id);
    const compromisoId = idValido(req.params.compromisoId);
    if (!id || !compromisoId)
      return res
        .status(400)
        .json({ error: "El acuerdo seleccionado no es válido." });
    res.json(
      await service.cerrarCompromiso(
        id,
        compromisoId,
        Number(req.auth.sub),
        req.auth.rol,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function cerrar(req, res, next) {
  try {
    const id = idValido(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ error: "La junta seleccionada no es válida." });
    res.json(await service.cerrar(id));
  } catch (error) {
    next(error);
  }
}
