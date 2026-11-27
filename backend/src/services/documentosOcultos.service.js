import { pool, query } from '../config/db.js';
import { ADMIN_ROLE } from '../config/permisos.js';

function errorPublico(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function listarOcultos(usuarioId) {
  const { rows } = await query(
    `SELECT documento_id
       FROM usuario_documentos_ocultos
      WHERE usuario_id = $1
      ORDER BY documento_id`,
    [usuarioId]
  );
  return rows.map((fila) => fila.documento_id);
}

export function validarDocumentos(documentos) {
  if (!Array.isArray(documentos) ||
      documentos.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw errorPublico('La lista de documentos no es válida.', 400);
  }
  return [...new Set(documentos)].sort((a, b) => a - b);
}

export async function guardarOcultos(usuarioId, documentos) {
  const lista = validarDocumentos(documentos);
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
    if (!rows[0]) throw errorPublico('Usuario no encontrado', 404);
    if (rows[0].rol_clave === ADMIN_ROLE) {
      throw errorPublico('El Administrador General ve todos los documentos.', 400);
    }

    await client.query('DELETE FROM usuario_documentos_ocultos WHERE usuario_id = $1', [usuarioId]);
    if (lista.length) {
      await client.query(
        `INSERT INTO usuario_documentos_ocultos (usuario_id, documento_id)
         SELECT $1, d.id FROM documentos d WHERE d.id = ANY($2::int[])`,
        [usuarioId, lista]
      );
    }

    const { rows: guardados } = await client.query(
      'SELECT documento_id FROM usuario_documentos_ocultos WHERE usuario_id = $1 ORDER BY documento_id',
      [usuarioId]
    );
    await client.query('COMMIT');
    return guardados.map((fila) => fila.documento_id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
