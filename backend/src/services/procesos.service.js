import { pool, query } from '../config/db.js';

function errorDeNormas() {
  const error = new Error('Normas no válidas');
  error.status = 400;
  error.publico = 'Selecciona únicamente normas existentes y activas';
  return error;
}

async function guardarCambio(sql, parametros, normaIds, crearError) {
  if (normaIds === undefined) {
    const { rows } = await query(sql, parametros);
    const proceso = rows[0];

    if (!proceso) throw crearError();

    return proceso;
  }

  if (
    !Array.isArray(normaIds) ||
    normaIds.some((id) => !Number.isInteger(id) || id <= 0) ||
    new Set(normaIds).size !== normaIds.length
  ) {
    throw errorDeNormas();
  }

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    const { rows } = await cliente.query(sql, parametros);
    const proceso = rows[0];

    if (!proceso) throw crearError();

    if (normaIds.length > 0) {
      const { rows: normas } = await cliente.query(
        'SELECT id FROM normas WHERE activo = TRUE AND id = ANY($1::integer[])',
        [normaIds]
      );

      if (normas.length !== normaIds.length) throw errorDeNormas();
    }

    await cliente.query(
      'DELETE FROM proceso_normas WHERE proceso_id = $1',
      [proceso.id]
    );

    if (normaIds.length > 0) {
      await cliente.query(
        `INSERT INTO proceso_normas (proceso_id, norma_id)
         SELECT $1, UNNEST($2::integer[])`,
        [proceso.id, normaIds]
      );
    }

    await cliente.query('COMMIT');

    return { ...proceso, norma_ids: normaIds };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

export async function listar() {
  const { rows } = await query(
    `SELECT
       p.id,
       p.nombre,
       p.codigo_area,
       p.codigo_proceso,
       p.responsable_id,
       p.correo,
       p.descripcion,
       p.estatus,
       p.macroproceso_id,
       m.nombre AS macroproceso,
       p.creado_en,
       u.nombre AS responsable,
       COALESCE(
         (
           SELECT ARRAY_AGG(pn.norma_id ORDER BY pn.norma_id)
           FROM proceso_normas pn
           WHERE pn.proceso_id = p.id
         ),
         ARRAY[]::integer[]
       ) AS norma_ids
     FROM procesos p
     JOIN usuarios u ON u.id = p.responsable_id
     LEFT JOIN macroprocesos m ON m.id = p.macroproceso_id
     ORDER BY p.creado_en DESC`
  );

  return rows;
}

export async function obtenerPorId(id) {
  const { rows } = await query(
    `SELECT
       p.*,
       COALESCE(
         (
           SELECT ARRAY_AGG(pn.norma_id ORDER BY pn.norma_id)
           FROM proceso_normas pn
           WHERE pn.proceso_id = p.id
         ),
         ARRAY[]::integer[]
       ) AS norma_ids
     FROM procesos p
     WHERE p.id = $1`,
    [id]
  );

  return rows[0] || null;
}

export async function crear({
  nombre,
  responsable_id,
  descripcion,
  macroproceso_id,
  codigo_area,
  codigo_proceso,
  creado_por,
  norma_ids,
}) {
  const sql = `INSERT INTO procesos (
       nombre,
       codigo_area,
       codigo_proceso,
       responsable_id,
       correo,
       descripcion,
       macroproceso_id,
       estatus,
       creado_por
     )
     SELECT
       $1,
       $2,
       $3,
       u.id,
       u.correo,
       $4,
       m.id,
       'activo',
       $5
     FROM usuarios u
     JOIN macroprocesos m ON m.id = $7 AND m.activo = TRUE
     WHERE u.id = $6
       AND u.activo = TRUE
     RETURNING *`;

  return guardarCambio(
    sql,
    [nombre, codigo_area, codigo_proceso, descripcion, creado_por, responsable_id, macroproceso_id],
    norma_ids,
    () => {
      const error = new Error('Responsable no válido');
      error.status = 400;
      error.publico = 'El responsable o el macroproceso no existe o está inactivo';
      return error;
    }
  );
}

export async function actualizar(
  id,
  { nombre, responsable_id, descripcion, estatus, macroproceso_id, codigo_area, codigo_proceso, norma_ids }
) {
  const sql = `UPDATE procesos p
        SET nombre = $1,
            codigo_area = $2,
            codigo_proceso = $3,
            responsable_id = u.id,
            correo = u.correo,
            descripcion = $6,
            estatus = $7,
            macroproceso_id = $8
       FROM usuarios u
      WHERE p.id = $4
        AND u.id = $5
        AND u.activo = TRUE
        AND ($8::integer IS NULL OR EXISTS (
          SELECT 1 FROM macroprocesos m
          WHERE m.id = $8 AND m.activo = TRUE
        ))
      RETURNING p.*`;

  return guardarCambio(
    sql,
    [nombre, codigo_area, codigo_proceso, id, responsable_id, descripcion, estatus, macroproceso_id],
    norma_ids,
    () => {
      const error = new Error('Proceso o responsable no válido');
      error.status = 404;
      error.publico = 'El proceso no existe o el responsable o macroproceso está inactivo';
      return error;
    }
  );
}

export async function desactivar(id) {
  const { rows } = await query(
    `UPDATE procesos
        SET estatus = 'inactivo'
      WHERE id = $1
      RETURNING *`,
    [id]
  );

  const proceso = rows[0];

  if (!proceso) {
    const error = new Error('Proceso no encontrado');
    error.status = 404;
    error.publico = 'Proceso no encontrado';
    throw error;
  }

  return proceso;
}
