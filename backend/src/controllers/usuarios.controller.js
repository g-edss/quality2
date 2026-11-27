import * as usuariosService from '../services/usuarios.service.js';
import * as permisosService from '../services/permisos.service.js';
import * as documentosOcultosService from '../services/documentosOcultos.service.js';
import * as permisosRegistrosService from '../services/permisosRegistros.service.js';
import { ADMIN_ROLE } from '../config/permisos.js';

async function bloquearEscalamiento(req, res, { rolNuevo, usuarioObjetivoId } = {}) {
  if (req.auth.rol === ADMIN_ROLE) return false;

  if (rolNuevo === ADMIN_ROLE) {
    res.status(403).json({ error: 'Solo el Administrador General puede asignar ese rol.' });
    return true;
  }
  if (usuarioObjetivoId !== undefined &&
      (await usuariosService.obtenerRolClave(usuarioObjetivoId)) === ADMIN_ROLE) {
    res.status(403).json({ error: 'Solo el Administrador General puede modificar a otro administrador.' });
    return true;
  }
  return false;
}

function telefonoValido(telefono) {
  return telefono === undefined || (
    typeof telefono === 'string' &&
    telefono.length <= 30 &&
    (!telefono.trim() || /^[0-9+()\-\s]+$/.test(telefono))
  );
}

export async function crear(req, res, next) {
  try {
    const { nombre, correo, telefono, puesto, rol_clave } = req.body;

    if (
      typeof nombre !== 'string' ||
      typeof correo !== 'string' ||
      typeof rol_clave !== 'string' ||
      !nombre.trim() ||
      !correo.trim() ||
      !rol_clave.trim()
    ) {
      return res.status(400).json({
        error: 'Nombre, correo y rol son obligatorios',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        error: 'El correo no tiene un formato válido',
      });
    }

    if (!telefonoValido(telefono)) {
      return res.status(400).json({ error: 'Escribe un teléfono válido de hasta 30 caracteres.' });
    }

    if (await bloquearEscalamiento(req, res, { rolNuevo: rol_clave })) return;

    const usuario = await usuariosService.crear({
      nombre,
      correo,
      telefono,
      puesto: typeof puesto === 'string' ? puesto : null,
      rol_clave,
    });

    res.set('Cache-Control', 'no-store');
    res.status(201).json(usuario);
  } catch (error) {
    next(error);
  }
}

export async function listar(_req, res, next) {
  try {
    const usuarios = await usuariosService.listar();
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { nombre, correo, telefono, puesto, rol_clave, password, estado } = req.body;

    if (correo !== undefined && (typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))) {
      return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    }

    if (!telefonoValido(telefono)) {
      return res.status(400).json({ error: 'Escribe un teléfono válido de hasta 30 caracteres.' });
    }

    if (password !== undefined &&
        (typeof password !== 'string' || password.length < 10 || password.length > 128)) {
      return res.status(400).json({ error: 'La contraseña temporal debe tener entre 10 y 128 caracteres' });
    }

    if (estado !== undefined && req.auth.rol !== ADMIN_ROLE) {
      return res.status(403).json({ error: 'Solo el Administrador General puede activar o desactivar usuarios.' });
    }

    const activo = estado === undefined ? undefined : estado === 'Activo';

    if (await bloquearEscalamiento(req, res, {
      rolNuevo: rol_clave,
      usuarioObjetivoId: req.params.id,
    })) return;

    const usuario = await usuariosService.actualizar(req.params.id, {
      nombre,
      correo,
      telefono,
      puesto,
      rol_clave,
      password: password || undefined,
      activo,
    });

    res.json(usuario);
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req, res, next) {
  try {
    if (await bloquearEscalamiento(req, res, { usuarioObjetivoId: req.params.id })) return;

    await usuariosService.eliminar(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function guardarPermisos(req, res, next) {
  try {
    const permisos = await permisosService.guardarPermisos(
      Number(req.params.id),
      req.body?.permisos
    );
    res.json({ permisos });
  } catch (error) {
    next(error);
  }
}

export async function listarDocumentosOcultos(req, res, next) {
  try {
    const documentos = await documentosOcultosService.listarOcultos(Number(req.params.id));
    res.json({ documentos });
  } catch (error) {
    next(error);
  }
}

export async function guardarDocumentosOcultos(req, res, next) {
  try {
    const documentos = await documentosOcultosService.guardarOcultos(
      Number(req.params.id),
      req.body?.documentos
    );
    res.json({ documentos });
  } catch (error) {
    next(error);
  }
}

export async function obtenerPermisosRegistros(req, res, next) {
  try {
    res.json({ formatos: await permisosRegistrosService.obtenerMatriz(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
}

export async function guardarPermisosRegistros(req, res, next) {
  try {
    const formatos = await permisosRegistrosService.guardarMatriz(
      Number(req.params.id),
      req.body?.formatos
    );
    res.json({ formatos });
  } catch (error) {
    next(error);
  }
}
