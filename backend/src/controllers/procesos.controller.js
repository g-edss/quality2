import * as procesosService from '../services/procesos.service.js';

export async function listar(_req, res, next) {
  try {
    const procesos = await procesosService.listar();
    res.json(procesos);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const proceso = await procesosService.obtenerPorId(req.params.id);
    if (!proceso) return res.status(404).json({ error: 'Proceso no encontrado' });
    res.json(proceso);
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, responsable_id, descripcion, macroproceso_id, norma_ids, codigo_area, codigo_proceso } = req.body;

    if (
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      !Number.isInteger(Number(responsable_id)) ||
      !Number.isInteger(Number(macroproceso_id)) || Number(macroproceso_id) <= 0 ||
      !/^[A-Z0-9]{2,8}$/.test(String(codigo_area || '').trim().toUpperCase()) ||
      !/^[A-Z0-9]{1,8}$/.test(String(codigo_proceso || '').trim().toUpperCase())
    ) {
      return res.status(400).json({
        error: 'Nombre, responsable y macroproceso son obligatorios',
      });
    }

    const nuevo = await procesosService.crear({
      nombre: nombre.trim(),
      responsable_id: Number(responsable_id),
      macroproceso_id: Number(macroproceso_id),
      codigo_area: String(codigo_area).trim().toUpperCase(),
      codigo_proceso: String(codigo_proceso).trim().toUpperCase(),
      norma_ids,
      descripcion: typeof descripcion === 'string' ? descripcion.trim() || null : null,
      creado_por: req.auth.sub,
    });

    res.status(201).json(nuevo);
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'procesos_codigo_area_proceso_key') {
      return res.status(409).json({ error: 'Ya existe un proceso con esa combinación de claves de área y proceso.' });
    }
    next(err);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { nombre, responsable_id, descripcion, estatus, macroproceso_id, norma_ids, codigo_area, codigo_proceso } = req.body;

    if (
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      !Number.isInteger(Number(responsable_id))
      || !/^[A-Z0-9]{2,8}$/.test(String(codigo_area || '').trim().toUpperCase())
      || !/^[A-Z0-9]{1,8}$/.test(String(codigo_proceso || '').trim().toUpperCase())
    ) {
      return res.status(400).json({
        error: 'Nombre y responsable son obligatorios',
      });
    }

    if (!['activo', 'inactivo'].includes(estatus)) {
      return res.status(400).json({
        error: 'El estatus debe ser activo o inactivo',
      });
    }

    const macroprocesoId = macroproceso_id === null || macroproceso_id === '' || macroproceso_id === undefined
      ? null
      : Number(macroproceso_id);
    if (macroprocesoId !== null && (!Number.isInteger(macroprocesoId) || macroprocesoId <= 0)) {
      return res.status(400).json({ error: 'El macroproceso seleccionado no es válido.' });
    }

    const proceso = await procesosService.actualizar(req.params.id, {
      nombre: nombre.trim(),
      responsable_id: Number(responsable_id),
      macroproceso_id: macroprocesoId,
      codigo_area: String(codigo_area).trim().toUpperCase(),
      codigo_proceso: String(codigo_proceso).trim().toUpperCase(),
      norma_ids,
      descripcion: typeof descripcion === 'string' ? descripcion.trim() || null : null,
      estatus,
    });

    res.json(proceso);
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'procesos_codigo_area_proceso_key') {
      return res.status(409).json({ error: 'Ya existe un proceso con esa combinación de claves de área y proceso.' });
    }
    next(err);
  }
}

export async function desactivar(req, res, next) {
  try {
    const proceso = await procesosService.desactivar(req.params.id);
    res.json(proceso);
  } catch (err) {
    next(err);
  }
}
