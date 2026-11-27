import { query } from '../config/db.js';

export async function listarActivas() {
  const { rows } = await query(
    `SELECT
       id,
       nombre,
       simbolo,
       tipo_dato,
       descripcion
     FROM unidades_medida
     WHERE activo = TRUE
     ORDER BY nombre ASC`
  );

  return rows;
}

export async function listarTodas() {
  const { rows } = await query(
    `SELECT id, nombre, simbolo, tipo_dato, descripcion, activo
     FROM unidades_medida ORDER BY nombre ASC`
  );
  return rows;
}

function crearError(mensaje, status = 400) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function crear({ nombre, simbolo, tipo_dato, descripcion, activo }) {
  const { rows } = await query(
    `INSERT INTO unidades_medida (nombre, simbolo, tipo_dato, descripcion, activo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, simbolo, tipo_dato, descripcion, activo`,
    [nombre, simbolo, tipo_dato, descripcion, activo]
  );
  return rows[0];
}

export async function actualizar(id, { nombre, simbolo, tipo_dato, descripcion, activo }) {
  const { rows } = await query(
    `UPDATE unidades_medida
     SET nombre = $2, simbolo = $3, tipo_dato = $4, descripcion = $5, activo = $6
     WHERE id = $1
     RETURNING id, nombre, simbolo, tipo_dato, descripcion, activo`,
    [id, nombre, simbolo, tipo_dato, descripcion, activo]
  );
  if (!rows[0]) throw crearError('La unidad de medida no existe.', 404);
  return rows[0];
}

export async function desactivar(id) {
  const { rows } = await query(
    `UPDATE unidades_medida SET activo = FALSE WHERE id = $1
     RETURNING id, nombre, simbolo, tipo_dato, descripcion, activo`,
    [id]
  );
  if (!rows[0]) throw crearError('La unidad de medida no existe.', 404);
  return rows[0];
}
