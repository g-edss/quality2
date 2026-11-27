import { pool, query } from '../config/db.js';
import {
  ADMIN_ROLE,
  PERMISOS_VALIDOS,
  permisosPorDefecto,
  soloPermisosVigentes,
} from '../config/permisos.js';

export async function obtenerPermisos(usuarioId, rolClave) {
  if (rolClave === ADMIN_ROLE) return permisosPorDefecto(ADMIN_ROLE);

  const { rows } = await query(
    'SELECT permiso FROM usuario_permisos WHERE usuario_id = $1 ORDER BY permiso',
    [usuarioId]
  );
  return soloPermisosVigentes(rows.map((fila) => fila.permiso));
}

export function validarPermisos(permisos) {
  if (!Array.isArray(permisos) ||
      permisos.some((permiso) => typeof permiso !== 'string' || !PERMISOS_VALIDOS.has(permiso))) {
    const error = new Error('Permisos no válidos');
    error.status = 400;
    error.publico = 'La lista de permisos contiene valores no válidos.';
    throw error;
  }
  return [...new Set(permisos)].sort();
}

export async function guardarPermisos(usuarioId, permisos) {
  const lista = validarPermisos(permisos);
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
    if (!rows[0]) {
      const error = new Error('Usuario no encontrado');
      error.status = 404;
      error.publico = 'Usuario no encontrado';
      throw error;
    }

    await client.query('DELETE FROM usuario_permisos WHERE usuario_id = $1', [usuarioId]);
    if (lista.length) {
      await client.query(
        `INSERT INTO usuario_permisos (usuario_id, permiso)
         SELECT $1, UNNEST($2::text[])`,
        [usuarioId, lista]
      );
    }

    await client.query('COMMIT');
    return rows[0].rol_clave === ADMIN_ROLE ? permisosPorDefecto(ADMIN_ROLE) : lista;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function tienePermiso(usuarioId, rolClave, permiso) {
  if (rolClave === ADMIN_ROLE) return true;
  const { rows } = await query(
    'SELECT 1 FROM usuario_permisos WHERE usuario_id = $1 AND permiso = $2',
    [usuarioId, permiso]
  );
  return Boolean(rows[0]);
}
