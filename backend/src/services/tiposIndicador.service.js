import { query } from "../config/db.js";

function crearError(mensaje, status = 400) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function listar() {
  const { rows } = await query(
    `SELECT
       t.id,
       t.codigo,
       t.nombre,
       t.descripcion,
       t.activo,
       COALESCE(
         (
           SELECT ARRAY_AGG(i.codigo ORDER BY i.codigo)
           FROM indicadores i
           WHERE i.tipo_indicador_id = t.id
         ),
         ARRAY[]::text[]
       ) AS indicadores_codigos
     FROM tipos_indicador t
     ORDER BY t.nombre ASC`,
  );

  return rows;
}

export async function crear({ codigo, nombre, descripcion, activo }) {
  const { rows } = await query(
    `INSERT INTO tipos_indicador (codigo, nombre, descripcion, activo)
     VALUES ($1, $2, $3, $4)
     RETURNING id, codigo, nombre, descripcion, activo`,
    [codigo, nombre, descripcion, activo],
  );
  return rows[0];
}

export async function actualizar(id, { codigo, nombre, descripcion, activo }) {
  const { rows } = await query(
    `UPDATE tipos_indicador
     SET codigo = $2, nombre = $3, descripcion = $4, activo = $5,
         actualizado_en = NOW()
     WHERE id = $1
     RETURNING id, codigo, nombre, descripcion, activo`,
    [id, codigo, nombre, descripcion, activo],
  );
  if (!rows[0]) throw crearError("El tipo de indicador no existe.", 404);
  return rows[0];
}

export async function desactivar(id) {
  const { rows } = await query(
    `UPDATE tipos_indicador SET activo = FALSE, actualizado_en = NOW()
     WHERE id = $1
     RETURNING id, codigo, nombre, descripcion, activo`,
    [id],
  );
  if (!rows[0]) throw crearError("El tipo de indicador no existe.", 404);
  return rows[0];
}
