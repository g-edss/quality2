import { query } from '../config/db.js';

function crearError(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function listarTodos() {
  const { rows } = await query(
    `SELECT t.id, t.nombre, t.activo,
            COUNT(d.id)::integer AS documentos_asociados
     FROM tipos_documento t
     LEFT JOIN documentos d ON d.tipo_documento_id = t.id
     GROUP BY t.id ORDER BY t.nombre`
  );
  return rows;
}

export async function crear(nombre) {
  const { rows } = await query(
    `INSERT INTO tipos_documento (nombre, activo)
     VALUES ($1, TRUE) RETURNING id, nombre, activo`,
    [nombre]
  );
  return rows[0];
}

export async function actualizar(id, { nombre, activo }) {
  const { rows } = await query(
    `UPDATE tipos_documento t
     SET nombre = $2, activo = $3
     WHERE t.id = $1
       AND LOWER(t.nombre) <> 'registro'
       AND (
         t.nombre = $2 OR NOT EXISTS (
           SELECT 1 FROM documentos d WHERE d.tipo_documento_id = t.id
         )
       )
     RETURNING id, nombre, activo`,
    [id, nombre, activo]
  );
  if (rows[0]) return rows[0];
  const actual = await query('SELECT nombre FROM tipos_documento WHERE id = $1', [id]);
  if (!actual.rows[0]) throw crearError('El tipo de documento no existe.', 404);
  if (actual.rows[0].nombre.toLowerCase() === 'registro') {
    throw crearError('El tipo Registro es obligatorio y no se puede modificar.', 409);
  }
  throw crearError('No se puede renombrar un tipo que ya está asociado a documentos.', 409);
}

export async function desactivar(id) {
  const { rows } = await query(
    `UPDATE tipos_documento SET activo = FALSE
     WHERE id = $1 AND LOWER(nombre) <> 'registro'
     RETURNING id, nombre, activo`,
    [id]
  );
  if (rows[0]) return rows[0];
  const actual = await query('SELECT id FROM tipos_documento WHERE id = $1', [id]);
  if (!actual.rows[0]) throw crearError('El tipo de documento no existe.', 404);
  throw crearError('El tipo Registro es obligatorio y no se puede desactivar.', 409);
}
