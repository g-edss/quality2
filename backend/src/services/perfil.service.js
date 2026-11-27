import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { obtenerPermisos } from './permisos.service.js';

export async function obtenerPerfil(usuarioId) {
  const { rows } = await query(`
    SELECT u.id, u.nombre, u.correo, u.telefono,
      r.nombre AS rol, r.clave AS rol_clave
    FROM usuarios u JOIN roles r ON r.id = u.rol_id
    WHERE u.id = $1 AND u.activo = TRUE
  `, [usuarioId]);
  if (!rows[0]) {
    const error = new Error('Usuario no disponible');
    error.status = 404;
    error.publico = 'La cuenta ya no está disponible.';
    throw error;
  }
  return {
    ...rows[0],
    permisos: await obtenerPermisos(rows[0].id, rows[0].rol_clave),
  };
}

export async function actualizarTelefono(usuarioId, telefono) {
  await query(`
    UPDATE usuarios SET telefono = $2
    WHERE id = $1 AND activo = TRUE
  `, [usuarioId, telefono || null]);
  return obtenerPerfil(usuarioId);
}

export async function cambiarPassword(usuarioId, actual, nueva) {
  const { rows } = await query(`
    SELECT password_hash FROM usuarios WHERE id = $1 AND activo = TRUE
  `, [usuarioId]);
  const hashActual = rows[0]?.password_hash;
  if (!hashActual || !(await bcrypt.compare(actual, hashActual))) {
    const error = new Error('Contraseña actual incorrecta');
    error.status = 401;
    error.publico = 'La contraseña actual es incorrecta.';
    throw error;
  }
  if (await bcrypt.compare(nueva, hashActual)) {
    const error = new Error('Contraseña sin cambios');
    error.status = 400;
    error.publico = 'La contraseña nueva debe ser diferente a la actual.';
    throw error;
  }
  const hashNuevo = await bcrypt.hash(nueva, 12);
  const { rows: actualizados } = await query(`
    UPDATE usuarios SET password_hash = $3, debe_cambiar_password = FALSE
    WHERE id = $1 AND activo = TRUE AND password_hash = $2
    RETURNING id
  `, [usuarioId, hashActual, hashNuevo]);
  if (!actualizados[0]) {
    const error = new Error('Contraseña modificada simultáneamente');
    error.status = 409;
    error.publico = 'La contraseña cambió durante la operación. Vuelve a iniciar sesión e inténtalo de nuevo.';
    throw error;
  }
  return { actualizado: true };
}
