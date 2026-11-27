import { pool, query } from '../config/db.js';
import {
  ADMIN_ROLE,
  ACCIONES_REGISTRO,
  permisoRegistroPorDefecto,
} from '../config/permisos.js';
import { listarFormatos } from './registros.service.js';

function errorPublico(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

async function obtenerRol(usuarioId, client = { query }) {
  const { rows } = await client.query(
    `SELECT r.clave AS rol_clave
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
      WHERE u.id = $1`,
    [usuarioId]
  );
  return rows[0]?.rol_clave ?? null;
}

async function obtenerExcepciones(usuarioId) {
  const { rows } = await query(
    `SELECT documento_id, accion, permitido
       FROM usuario_registro_permisos
      WHERE usuario_id = $1`,
    [usuarioId]
  );
  const mapa = {};
  for (const fila of rows) {
    (mapa[fila.documento_id] ??= {})[fila.accion] = fila.permitido;
  }
  return mapa;
}

function permisosEfectivos(rolClave, excepciones, documentoId) {
  const propias = excepciones[documentoId] || {};
  return Object.fromEntries(
    ACCIONES_REGISTRO.map((accion) => [
      accion,
      rolClave === ADMIN_ROLE
        ? true
        : propias[accion] ?? permisoRegistroPorDefecto(rolClave, accion),
    ])
  );
}

export async function puede({ usuarioId, rolClave, documentoId, accion }) {
  if (rolClave === ADMIN_ROLE) return true;
  const { rows } = await query(
    `SELECT permitido
       FROM usuario_registro_permisos
      WHERE usuario_id = $1 AND documento_id = $2 AND accion = $3`,
    [usuarioId, documentoId, accion]
  );
  return rows[0]?.permitido ?? permisoRegistroPorDefecto(rolClave, accion);
}

export async function anotarFormatos(formatos, usuarioId, rolClave) {
  const excepciones = rolClave === ADMIN_ROLE ? {} : await obtenerExcepciones(usuarioId);
  return formatos.map((formato) => {
    const efectivos = permisosEfectivos(rolClave, excepciones, formato.documento_registro_id);
    return {
      ...formato,
      ...Object.fromEntries(
        Object.entries(efectivos).map(([accion, valor]) => [`puede_${accion}`, valor])
      ),
    };
  });
}

export async function obtenerMatriz(usuarioId) {
  const rolClave = await obtenerRol(usuarioId);
  if (!rolClave) throw errorPublico('Usuario no encontrado', 404);

  const [formatos, excepciones] = await Promise.all([
    listarFormatos(),
    rolClave === ADMIN_ROLE ? {} : obtenerExcepciones(usuarioId),
  ]);

  return formatos.map((formato) => ({
    documento_id: formato.documento_registro_id,
    ...permisosEfectivos(rolClave, excepciones, formato.documento_registro_id),
  }));
}

export function validarMatriz(matriz) {
  const valida = Array.isArray(matriz) && matriz.every((fila) =>
    fila && Number.isInteger(fila.documento_id) && fila.documento_id > 0 &&
    ACCIONES_REGISTRO.every((accion) => typeof fila[accion] === 'boolean')
  );
  if (!valida) throw errorPublico('Los permisos de registros no son válidos.', 400);
  return matriz;
}

export async function guardarMatriz(usuarioId, matriz) {
  validarMatriz(matriz);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT r.clave AS rol_clave
         FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE u.id = $1
        FOR UPDATE OF u`,
      [usuarioId]
    );
    const rolClave = rows[0]?.rol_clave;
    if (!rolClave) throw errorPublico('Usuario no encontrado', 404);
    if (rolClave === ADMIN_ROLE) {
      throw errorPublico('El Administrador General tiene todos los permisos de registros.', 400);
    }

    const documentos = [];
    const acciones = [];
    const valores = [];
    for (const fila of matriz) {
      for (const accion of ACCIONES_REGISTRO) {
        if (fila[accion] !== permisoRegistroPorDefecto(rolClave, accion)) {
          documentos.push(fila.documento_id);
          acciones.push(accion);
          valores.push(fila[accion]);
        }
      }
    }

    await client.query('DELETE FROM usuario_registro_permisos WHERE usuario_id = $1', [usuarioId]);
    if (documentos.length) {
      await client.query(
        `INSERT INTO usuario_registro_permisos (usuario_id, documento_id, accion, permitido)
         SELECT $1, datos.documento_id, datos.accion, datos.permitido
           FROM UNNEST($2::int[], $3::text[], $4::boolean[])
                AS datos(documento_id, accion, permitido)
           JOIN documentos d ON d.id = datos.documento_id
         ON CONFLICT DO NOTHING`,
        [usuarioId, documentos, acciones, valores]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return obtenerMatriz(usuarioId);
}
