import { pool, query } from '../config/db.js';

export async function listar({ usuario_id, rol }) {
  const { rows } = await query(
    `SELECT
       i.id,
       i.codigo,
       i.nombre,
       i.descripcion,
       i.proceso_id,
       p.nombre AS proceso,
       i.responsable_id,
       responsable.nombre AS responsable,
       responsable.puesto AS responsable_puesto,
       responsable.correo AS responsable_correo,
       i.unidad_medida_id,
       i.tipo_indicador_id,
       ti.nombre AS tipo_indicador,
       um.nombre AS unidad_medida,
       um.simbolo AS unidad_simbolo,
       um.tipo_dato,
       i.frecuencia,
       i.meta_minima,
       i.meta_maxima,
       i.sentido,
       ultima.fecha_medicion::text AS ultima_fecha_medicion,
       ultima.resultado AS ultimo_resultado,
       i.activo,
       i.creado_en,
       i.actualizado_en,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'usuario_id', iu.usuario_id,
               'nombre', usuario_asignado.nombre,
               'correo', usuario_asignado.correo,
               'puesto', usuario_asignado.puesto,
               'puede_capturar', iu.puede_capturar
             )
             ORDER BY usuario_asignado.nombre
           )
           FROM indicador_usuarios iu
           JOIN usuarios usuario_asignado
             ON usuario_asignado.id = iu.usuario_id
           WHERE iu.indicador_id = i.id
         ),
         '[]'::json
       ) AS usuarios
       FROM indicadores i
     JOIN procesos p
       ON p.id = i.proceso_id
     JOIN usuarios responsable
       ON responsable.id = i.responsable_id
     JOIN unidades_medida um
       ON um.id = i.unidad_medida_id
     LEFT JOIN tipos_indicador ti
       ON ti.id = i.tipo_indicador_id
     LEFT JOIN LATERAL (
       SELECT m.fecha_medicion, m.resultado
         FROM mediciones_indicadores m
        WHERE m.indicador_id = i.id
        ORDER BY m.fecha_medicion DESC
        LIMIT 1
     ) ultima ON TRUE
      WHERE
        $2 = 'admin_general'
        OR p.responsable_id = $1
        OR i.responsable_id = $1
        OR EXISTS (
          SELECT 1
          FROM indicador_usuarios acceso
          WHERE acceso.indicador_id = i.id
            AND acceso.usuario_id = $1
        )
     ORDER BY i.creado_en DESC`,
    [usuario_id, rol]
  );

  return rows;
}

export async function crear({
  codigo,
  nombre,
  descripcion,
  proceso_id,
  responsable_id,
  unidad_medida_id,
  tipo_indicador_id,
  frecuencia,
  meta_minima,
  meta_maxima,
  sentido,
  creado_por,
  usuarios = [],
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO indicadores (
         codigo,
         nombre,
         descripcion,
         proceso_id,
         responsable_id,
         unidad_medida_id,
         tipo_indicador_id,
         frecuencia,
         meta_minima,
         meta_maxima,
         sentido,
         creado_por
       )
       SELECT
         $1,
         $2,
         $3,
         p.id,
         r.id,
         um.id,
         ti.id,
         $8,
         $9,
         $10,
         $11,
         $12
       FROM procesos p
       CROSS JOIN unidades_medida um
       CROSS JOIN tipos_indicador ti
       CROSS JOIN usuarios r
       WHERE p.id = $4
         AND p.estatus = 'activo'
         AND r.id = $5
         AND r.activo = TRUE
         AND um.id = $6
         AND um.activo = TRUE
         AND ti.id = $7
         AND ti.activo = TRUE
       RETURNING *`,
      [
        codigo,
        nombre,
        descripcion,
        proceso_id,
        responsable_id,
        unidad_medida_id,
        tipo_indicador_id,
        frecuencia,
        meta_minima,
        meta_maxima,
        sentido,
        creado_por,
      ]
    );

    const indicador = rows[0];

    if (!indicador) {
      const error = new Error(
        'Proceso, unidad o tipo de indicador no válidos'
      );

      error.status = 400;
      error.publico =
        'El proceso, la unidad o el tipo de indicador no existen o están inactivos';

      throw error;
    }

    for (const asignacion of usuarios) {
      const resultado = await client.query(
        `INSERT INTO indicador_usuarios (
           indicador_id,
           usuario_id,
           puede_capturar
         )
         SELECT
           $1,
           u.id,
           $3
         FROM usuarios u
         JOIN roles r
           ON r.id = u.rol_id
         WHERE u.id = $2
           AND u.activo = TRUE
           AND r.clave <> 'visor'
         ON CONFLICT (indicador_id, usuario_id)
         DO UPDATE SET
           puede_capturar = EXCLUDED.puede_capturar`,
        [
          indicador.id,
          asignacion.usuario_id,
          asignacion.puede_capturar,
        ]
      );

      if (resultado.rowCount === 0) {
        const error = new Error('Usuario relacionado no válido');
        error.status = 400;
        error.publico =
          'Uno de los usuarios seleccionados no existe, está inactivo o no tiene un rol permitido';
        throw error;
      }
    }

    await client.query('COMMIT');

    return indicador;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizar(
  id,
  {
    codigo,
    nombre,
    descripcion,
    proceso_id,
    responsable_id,
    unidad_medida_id,
    tipo_indicador_id,
    frecuencia,
    meta_minima,
    meta_maxima,
    sentido,
    activo,
    usuarios = [],
  }
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE indicadores i
          SET codigo = $1,
              nombre = $2,
              descripcion = $3,
              proceso_id = p.id,
              responsable_id = r.id,
              unidad_medida_id = um.id,
              tipo_indicador_id = ti.id,
              frecuencia = $8,
              meta_minima = $9,
              meta_maxima = $10,
              sentido = $11,
              activo = $12,
              actualizado_en = now()
         FROM procesos p
         CROSS JOIN unidades_medida um
         CROSS JOIN tipos_indicador ti
         CROSS JOIN usuarios r
         WHERE i.id = $13
          AND p.id = $4
          AND p.estatus = 'activo'
          AND r.id = $5
          AND r.activo = TRUE
          AND um.id = $6
          AND um.activo = TRUE
          AND ti.id = $7
          AND ti.activo = TRUE
        RETURNING i.*`,
      [
        codigo,
        nombre,
        descripcion,
        proceso_id,
        responsable_id,
        unidad_medida_id,
        tipo_indicador_id,
        frecuencia,
        meta_minima,
        meta_maxima,
        sentido,
        activo,
        id,
      ]
    );

    const indicador = rows[0];

    if (!indicador) {
      const error = new Error(
        'Indicador, proceso, unidad o tipo no válidos'
      );

      error.status = 400;
      error.publico =
        'El indicador no existe o seleccionaste un proceso, unidad o tipo inactivos';

      throw error;
    }

    await client.query(
      `DELETE FROM indicador_usuarios
       WHERE indicador_id = $1`,
      [id]
    );

    for (const asignacion of usuarios) {
      const resultado = await client.query(
        `INSERT INTO indicador_usuarios (
           indicador_id,
           usuario_id,
           puede_capturar
         )
         SELECT
           $1,
           u.id,
           $3
         FROM usuarios u
         JOIN roles r
           ON r.id = u.rol_id
         WHERE u.id = $2
           AND u.activo = TRUE
           AND r.clave <> 'visor'`,
        [
          id,
          asignacion.usuario_id,
          asignacion.puede_capturar,
        ]
      );

      if (resultado.rowCount === 0) {
        const error = new Error('Usuario relacionado no válido');
        error.status = 400;
        error.publico =
          'Uno de los usuarios seleccionados no existe, está inactivo o no tiene un rol permitido';
        throw error;
      }
    }

    await client.query('COMMIT');

    return indicador;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function desactivar(id) {
  const { rows } = await query(
    `UPDATE indicadores
        SET activo = FALSE,
            actualizado_en = now()
      WHERE id = $1
      RETURNING *`,
    [id]
  );

  const indicador = rows[0];

  if (!indicador) {
    const error = new Error('Indicador no encontrado');
    error.status = 404;
    error.publico = 'El indicador no existe';
    throw error;
  }

  return indicador;
}
