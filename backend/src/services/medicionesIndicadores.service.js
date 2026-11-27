import { pool, query } from "../config/db.js";

export async function listarPorIndicador(indicadorId, { usuario_id, rol }) {
  const { rows } = await query(
    `SELECT
       m.id,
       m.indicador_id,
       m.fecha_medicion,
       m.resultado,
       m.observaciones,
       m.capturado_por,
       u.nombre AS capturado_por_nombre,
       m.creado_en,
       m.actualizado_en
     FROM mediciones_indicadores m
     JOIN indicadores i
       ON i.id = m.indicador_id
     JOIN procesos p
       ON p.id = i.proceso_id
     JOIN usuarios u
       ON u.id = m.capturado_por
     WHERE m.indicador_id = $1
       AND (
         $3 = 'admin_general'
         OR p.responsable_id = $2
         OR EXISTS (
           SELECT 1
           FROM indicador_usuarios iu
           WHERE iu.indicador_id = i.id
             AND iu.usuario_id = $2
         )
       )
     ORDER BY m.fecha_medicion ASC`,
    [indicadorId, usuario_id, rol],
  );

  return rows;
}

export async function crear({
  indicador_id,
  fecha_medicion,
  resultado,
  observaciones,
  capturado_por,
  rol,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO mediciones_indicadores (
         indicador_id,
         fecha_medicion,
         resultado,
         observaciones,
         capturado_por
       )
       SELECT
         i.id,
         $2,
         $3,
         $4,
         $5
       FROM indicadores i
       WHERE i.id = $1
         AND i.activo = TRUE
         AND (
           $6 = 'admin_general'
           OR EXISTS (
             SELECT 1
             FROM indicador_usuarios iu
             WHERE iu.indicador_id = i.id
               AND iu.usuario_id = $5
               AND iu.puede_capturar = TRUE
           )
         )
       RETURNING *`,
      [
        indicador_id,
        fecha_medicion,
        resultado,
        observaciones,
        capturado_por,
        rol,
      ],
    );

    const medicion = rows[0];

    if (!medicion) {
      const error = new Error(
        "Indicador inexistente o usuario sin permiso de captura",
      );

      error.status = 403;
      error.publico =
        "No tienes permiso para capturar mediciones de este indicador";

      throw error;
    }

    const { rows: indicadores } = await client.query(
      `SELECT
         codigo,
         nombre,
         responsable_id,
         meta_minima,
         meta_maxima,
         sentido
       FROM indicadores
       WHERE id = $1`,
      [indicador_id],
    );

    const indicador = indicadores[0];
    const valor = Number(resultado);
    const minimo =
      indicador.meta_minima === null ? null : Number(indicador.meta_minima);
    const maximo =
      indicador.meta_maxima === null ? null : Number(indicador.meta_maxima);

    let fueraDeMeta = false;

    if (indicador.sentido === "mayor_mejor") {
      fueraDeMeta = minimo !== null && valor < minimo;
    } else if (indicador.sentido === "menor_mejor") {
      fueraDeMeta = maximo !== null && valor > maximo;
    } else {
      fueraDeMeta =
        (minimo !== null && valor < minimo) ||
        (maximo !== null && valor > maximo);
    }

    const responsableId = Number(indicador.responsable_id);
    const capturistaId = Number(capturado_por);

    if (fueraDeMeta && responsableId !== capturistaId) {
      const metaTexto =
        minimo !== null && maximo !== null
          ? `${minimo} a ${maximo}`
          : minimo !== null
            ? `desde ${minimo}`
            : `hasta ${maximo}`;

      await client.query(
        `INSERT INTO notificaciones (
           usuario_id,
           mensaje,
           enlace
         )
         VALUES ($1, $2, $3)`,
        [
          responsableId,
          `La medición ${valor} del indicador ${indicador.codigo} - ${indicador.nombre} quedó fuera de la meta (${metaTexto}).`,
          "/indicadores",
        ],
      );
    }

    await client.query("COMMIT");

    return medicion;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function actualizar(
  medicionId,
  { indicador_id, fecha_medicion, resultado, observaciones, usuario_id, rol },
) {
  const { rows } = await query(
    `UPDATE mediciones_indicadores m
        SET fecha_medicion = $3,
            resultado = $4,
            observaciones = $5,
            actualizado_en = now()
       FROM indicadores i
      WHERE m.id = $1
        AND m.indicador_id = $2
        AND i.id = m.indicador_id
        AND i.activo = TRUE
        AND (
          $7 = 'admin_general'
          OR EXISTS (
            SELECT 1
            FROM indicador_usuarios iu
            WHERE iu.indicador_id = i.id
              AND iu.usuario_id = $6
              AND iu.puede_capturar = TRUE
          )
        )
      RETURNING m.*`,
    [
      medicionId,
      indicador_id,
      fecha_medicion,
      resultado,
      observaciones,
      usuario_id,
      rol,
    ],
  );

  const medicion = rows[0];

  if (!medicion) {
    const error = new Error("Medición inexistente o usuario sin permiso");

    error.status = 403;
    error.publico = "No tienes permiso para editar esta medición";

    throw error;
  }

  return medicion;
}

export async function eliminar(
  medicionId,
  indicadorId,
  { usuarioId = null, rol = "admin_general" } = {},
) {
  const { rows } = await query(
    `DELETE FROM mediciones_indicadores m
      WHERE m.id = $1
        AND m.indicador_id = $2
        AND (
          $4 = 'admin_general'
          OR EXISTS (
            SELECT 1
            FROM indicador_usuarios iu
            WHERE iu.indicador_id = m.indicador_id
              AND iu.usuario_id = $3
              AND iu.puede_capturar = TRUE
          )
        )
      RETURNING m.*`,
    [medicionId, indicadorId, usuarioId, rol],
  );

  const medicion = rows[0];

  if (!medicion && rol !== "admin_general") {
    const { rows: existe } = await query(
      "SELECT 1 FROM mediciones_indicadores WHERE id = $1 AND indicador_id = $2",
      [medicionId, indicadorId],
    );
    if (existe[0]) {
      const error = new Error("Usuario no asignado al indicador");
      error.status = 403;
      error.publico =
        "Solo puedes eliminar mediciones de indicadores que tienes asignados";
      throw error;
    }
  }

  if (!medicion) {
    const error = new Error("Medición no encontrada");

    error.status = 404;
    error.publico = "La medición no existe o no pertenece al indicador";

    throw error;
  }

  return medicion;
}
