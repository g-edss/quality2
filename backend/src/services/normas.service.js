import { query } from "../config/db.js";

function crearError(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function listarNormas() {
  const { rows } = await query(
    `SELECT
       n.id,
       n.codigo,
       n.nombre,
       n.activo,
       COUNT(c.id)::integer AS total_criterios
     FROM normas n
     LEFT JOIN norma_criterios nc ON nc.norma_id = n.id
     LEFT JOIN criterios_norma c
       ON c.id = nc.criterio_id AND c.activo = TRUE
     GROUP BY n.id
     ORDER BY n.codigo`,
  );

  return rows;
}

export async function crearNorma({ codigo, nombre }) {
  const { rows } = await query(
    `INSERT INTO normas (codigo, nombre)
     VALUES ($1, $2)
     RETURNING id, codigo, nombre, activo`,
    [codigo, nombre],
  );

  return rows[0];
}

export async function actualizarNorma(id, { codigo, nombre, activo }) {
  const { rows } = await query(
    `UPDATE normas
     SET codigo = $2, nombre = $3, activo = $4
     WHERE id = $1
     RETURNING id, codigo, nombre, activo`,
    [id, codigo, nombre, activo],
  );

  if (!rows[0]) throw crearError("La norma no existe.", 404);

  return rows[0];
}

export async function listarCriterios(normaId) {
  const { rows } = await query(
    `SELECT id, norma_id, codigo, descripcion, activo, creado_en
     FROM norma_criterios
     WHERE norma_id = $1
     ORDER BY codigo`,
    [normaId],
  );

  return rows;
}

export async function crearCriterio(normaId, { codigo, descripcion }) {
  const { rows } = await query(
    `INSERT INTO norma_criterios (norma_id, codigo, descripcion)
     SELECT id, $2, $3
     FROM normas
     WHERE id = $1 AND activo = TRUE
     RETURNING id, norma_id, codigo, descripcion, activo`,
    [normaId, codigo, descripcion],
  );

  if (!rows[0]) {
    throw crearError("La norma no existe o está inactiva.", 400);
  }

  return rows[0];
}

export async function actualizarCriterio(
  normaId,
  criterioId,
  { codigo, descripcion, activo },
) {
  const { rows } = await query(
    `UPDATE norma_criterios
     SET codigo = $3, descripcion = $4, activo = $5
     WHERE norma_id = $1 AND id = $2
     RETURNING id, norma_id, codigo, descripcion, activo`,
    [normaId, criterioId, codigo, descripcion, activo],
  );

  if (!rows[0]) throw crearError("El criterio no existe en esa norma.", 404);

  return rows[0];
}
