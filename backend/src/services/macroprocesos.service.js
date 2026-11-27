import { query } from '../config/db.js';

function crearError(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function listar() {
  const { rows } = await query(
    `SELECT m.id, m.nombre, m.descripcion, m.activo, m.creado_en,
            COUNT(p.id) FILTER (WHERE p.estatus = 'activo')::integer AS procesos_activos
     FROM macroprocesos m
     LEFT JOIN procesos p ON p.macroproceso_id = m.id
     GROUP BY m.id ORDER BY m.nombre`
  );
  return rows;
}

export async function crear({ nombre, descripcion }) {
  const { rows } = await query(
    `INSERT INTO macroprocesos (nombre, descripcion)
     VALUES ($1, $2) RETURNING *`,
    [nombre, descripcion]
  );
  return rows[0];
}

export async function actualizar(id, { nombre, descripcion, activo }) {
  const { rows } = await query(
    `UPDATE macroprocesos m
     SET nombre = $2, descripcion = $3, activo = $4
     WHERE m.id = $1
       AND ($4 = TRUE OR NOT EXISTS (
         SELECT 1 FROM procesos p
         WHERE p.macroproceso_id = m.id AND p.estatus = 'activo'
       ))
     RETURNING *`,
    [id, nombre, descripcion, activo]
  );
  if (rows[0]) return rows[0];
  const actual = await query('SELECT id FROM macroprocesos WHERE id = $1', [id]);
  if (!actual.rows[0]) throw crearError('El macroproceso no existe.', 404);
  throw crearError('No se puede desactivar un macroproceso con procesos activos.', 409);
}

export async function desactivar(id) {
  const { rows } = await query(
    `UPDATE macroprocesos m SET activo = FALSE
     WHERE m.id = $1 AND NOT EXISTS (
       SELECT 1 FROM procesos p
       WHERE p.macroproceso_id = m.id AND p.estatus = 'activo'
     ) RETURNING *`,
    [id]
  );
  if (rows[0]) return rows[0];
  const actual = await query('SELECT id FROM macroprocesos WHERE id = $1', [id]);
  if (!actual.rows[0]) throw crearError('El macroproceso no existe.', 404);
  throw crearError('No se puede desactivar un macroproceso con procesos activos.', 409);
}
