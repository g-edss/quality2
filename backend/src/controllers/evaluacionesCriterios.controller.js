import * as service from '../services/evaluacionesCriterios.service.js';

function leerId(valor, nombre) {
  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error(`${nombre} no es válido.`);
    error.status = 400;
    error.publico = error.message;
    throw error;
  }

  return id;
}

export async function obtenerChecklist(req, res, next) {
  try {
    const procesoId = leerId(req.params.procesoId, 'El proceso');
    const checklist = await service.obtenerChecklist(procesoId);
    res.json(checklist);
  } catch (error) {
    next(error);
  }
}

export async function registrarEvaluacion(req, res, next) {
  try {
    const procesoId = leerId(req.params.procesoId, 'El proceso');
    const criterioId = leerId(req.params.criterioId, 'El criterio');

    const evaluacion = await service.registrarEvaluacion({
      procesoId,
      criterioId,
      cumple: req.body?.cumple,
      observacion: req.body?.observacion,
      evaluadoPor: req.auth.sub,
    });

    res.status(201).json(evaluacion);
  } catch (error) {
    next(error);
  }
}