import { pool, query } from "../config/db.js";

export async function listar() {
  const { rows } = await query(`
    SELECT j.id, j.nombre, j.fecha, j.estado, j.tipo, j.modalidad,
      j.participantes, j.agenda, j.notas, j.creado_en,
          COALESCE((SELECT json_agg(
            json_build_object('id', u.id, 'nombre', u.nombre)
            ORDER BY u.nombre
          )
            FROM junta_participantes_convocados jpc
            JOIN usuarios u ON u.id = jpc.usuario_id
            WHERE jpc.junta_id = j.id
          ), '[]'::json) AS participantes_convocados,
      j.creada_por, creador.nombre AS organizador,
      j.responsable_id, responsable.nombre AS responsable,
      (SELECT json_build_object('contenido', m.contenido, 'creado_en', m.creado_en,
        'actualizada_en', m.actualizada_en, 'registrada_por', autor.nombre)
       FROM minutas m LEFT JOIN usuarios autor ON autor.id = m.registrada_por
       WHERE m.junta_id = j.id) AS minuta,
      COALESCE((SELECT json_agg(json_build_object('id', u.id, 'nombre', u.nombre)
        ORDER BY u.nombre) FROM junta_asistentes ja
        JOIN usuarios u ON u.id = ja.usuario_id WHERE ja.junta_id = j.id), '[]'::json) AS asistentes,
      COALESCE((SELECT json_agg(json_build_object(
        'id', c.id, 'descripcion', c.descripcion, 'responsable_id', c.responsable_id,
        'responsable', encargado.nombre, 'estado', c.estado,
        'fecha_compromiso', c.fecha_compromiso::text, 'creado_en', c.creado_en,
        'cerrado_en', c.cerrado_en,
        'avances', COALESCE((SELECT json_agg(json_build_object(
          'id', av.id, 'descripcion', av.descripcion, 'creado_en', av.creado_en,
          'usuario', av_usuario.nombre) ORDER BY av.creado_en, av.id)
          FROM compromiso_avances av LEFT JOIN usuarios av_usuario ON av_usuario.id = av.usuario_id
          WHERE av.compromiso_id = c.id), '[]'::json)
        ) ORDER BY c.id) FROM compromisos c
        JOIN usuarios encargado ON encargado.id = c.responsable_id
        WHERE c.junta_id = j.id), '[]'::json) AS compromisos,
      COALESCE((SELECT json_agg(json_build_object(
        'id', a.id,
        'titulo', COALESCE(a.titulo, 'Acción ' || a.id),
        'descripcion', a.descripcion,
        'estado', a.estado,
        'proceso', proceso.nombre,
        'responsable', responsable_accion.nombre
      ) ORDER BY a.id)
        FROM junta_acciones_correctivas jac
        JOIN acciones_correctivas a ON a.id = jac.accion_id
        LEFT JOIN procesos proceso ON proceso.id = a.proceso_id
        LEFT JOIN usuarios responsable_accion
          ON responsable_accion.id = a.responsable_id
        WHERE jac.junta_id = j.id), '[]'::json) AS acciones_correctivas
    FROM juntas j
    JOIN usuarios creador ON creador.id = j.creada_por
    JOIN usuarios responsable ON responsable.id = j.responsable_id
    ORDER BY j.fecha DESC NULLS LAST, j.id DESC
  `);
  return rows;
}

export async function catalogos() {
  const { rows } = await query(
    "SELECT id, nombre FROM usuarios WHERE activo = TRUE ORDER BY nombre",
  );
  return rows;
}

async function guardarParticipantesConvocados(cliente, juntaId, usuariosIds) {
  const { rows: usuariosActivos } = await cliente.query(
    "SELECT id FROM usuarios WHERE id = ANY($1::int[]) AND activo = TRUE",
    [usuariosIds],
  );

  if (usuariosActivos.length !== usuariosIds.length) {
    const error = new Error("Participantes no disponibles");
    error.status = 400;
    error.publico =
      "Selecciona únicamente usuarios activos como participantes.";
    throw error;
  }

  await cliente.query(
    "DELETE FROM junta_participantes_convocados WHERE junta_id = $1",
    [juntaId],
  );

  for (const usuarioId of usuariosIds) {
    await cliente.query(
      `INSERT INTO junta_participantes_convocados (junta_id, usuario_id)
       VALUES ($1, $2)`,
      [juntaId, usuarioId],
    );
  }
}

export async function crear(datos, usuarioId) {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const { rows } = await cliente.query(
      `
      INSERT INTO juntas
        (nombre, responsable_id, fecha, creada_por, tipo, modalidad, agenda)
      SELECT $1, u.id, $2, u.id, $3, $4, $5
      FROM usuarios u
      WHERE u.id = $6 AND u.activo = TRUE
      RETURNING id
      `,
      [
        datos.nombre,
        datos.fecha,
        datos.tipo,
        datos.modalidad,
        datos.agenda,
        usuarioId,
      ],
    );

    if (!rows[0]) {
      const error = new Error("Usuario no disponible");
      error.status = 403;
      error.publico = "La sesión no corresponde a un usuario activo.";
      throw error;
    }

    await guardarParticipantesConvocados(
      cliente,
      rows[0].id,
      datos.participantes_ids,
    );

    await cliente.query(
      `INSERT INTO notificaciones (usuario_id, mensaje, enlace)
      SELECT convocado.usuario_id, $2, $3
      FROM junta_participantes_convocados convocado
      WHERE convocado.junta_id = $1
        AND convocado.usuario_id <> $4`,
      [
        rows[0].id,
        `Te convocaron a la junta JUN-${rows[0].id}: ${datos.nombre}.`,
        "/juntas",
        usuarioId,
      ],
    );

    await cliente.query("COMMIT");
    return rows[0];
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function actualizar(id, datos, usuarioId) {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const { rows } = await cliente.query(
      `
      UPDATE juntas
      SET nombre = $2, fecha = $3, tipo = $4, modalidad = $5,
        agenda = $6, notas = $7,
        estado = CASE WHEN fecha IS DISTINCT FROM $3::timestamptz
          THEN 'reagendada' ELSE estado END
      WHERE id = $1 AND estado IN ('convocada', 'reagendada')
      RETURNING id
      `,
      [
        id,
        datos.nombre,
        datos.fecha,
        datos.tipo,
        datos.modalidad,
        datos.agenda,
        datos.notas,
      ],
    );

    if (!rows[0]) {
      const { rows: existentes } = await cliente.query(
        "SELECT id FROM juntas WHERE id = $1",
        [id],
      );

      const error = new Error("No se pudo modificar la junta");
      error.status = existentes[0] ? 409 : 404;
      error.publico = existentes[0]
        ? "Solo se pueden modificar juntas convocadas o reagendadas."
        : "La junta no existe.";
      throw error;
    }

    await guardarParticipantesConvocados(cliente, id, datos.participantes_ids);
    await cliente.query(
      `INSERT INTO notificaciones (usuario_id, mensaje, enlace)
      SELECT convocado.usuario_id, $2, $3
      FROM junta_participantes_convocados convocado
      WHERE convocado.junta_id = $1
        AND convocado.usuario_id <> $4`,
      [
        id,
        `Se actualizaron los datos de la junta JUN-${id}: ${datos.nombre}.`,
        "/juntas",
        usuarioId,
      ],
    );
    await cliente.query("COMMIT");
    return rows[0];
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function iniciar(id) {
  const { rows } = await query(
    `
    UPDATE juntas SET estado = 'celebrada'
    WHERE id = $1 AND estado IN ('convocada', 'reagendada')
    RETURNING id, estado
  `,
    [id],
  );
  if (!rows[0])
    await errorJunta(
      id,
      "Solo puede iniciarse una junta convocada o reagendada.",
    );
  return rows[0];
}

export async function guardarMinuta(id, contenido, usuarioId) {
  const { rows } = await query(
    `
    INSERT INTO minutas (junta_id, contenido, registrada_por)
    SELECT j.id, $2, $3 FROM juntas j WHERE j.id = $1 AND j.estado = 'celebrada'
    ON CONFLICT (junta_id) DO UPDATE SET contenido = EXCLUDED.contenido,
      registrada_por = EXCLUDED.registrada_por, actualizada_en = NOW()
    RETURNING id
  `,
    [id, contenido, usuarioId],
  );
  if (!rows[0])
    await errorJunta(
      id,
      "Solo se puede guardar la minuta de una junta en curso.",
    );
  return rows[0];
}

export async function guardarAsistentes(id, usuarioIds) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      "SELECT id FROM juntas WHERE id = $1 AND estado = 'celebrada' FOR UPDATE",
      [id],
    );
    if (!rows[0]) {
      await cliente.query("ROLLBACK");
      await errorJunta(
        id,
        "Solo se pueden registrar asistentes de una junta en curso.",
      );
    }
    const { rows: validos } = await cliente.query(
      "SELECT id FROM usuarios WHERE id = ANY($1::int[]) AND activo = TRUE",
      [usuarioIds],
    );
    if (validos.length !== usuarioIds.length) {
      const error = new Error("Asistentes no válidos");
      error.status = 400;
      error.publico = "Selecciona únicamente usuarios activos como asistentes.";
      throw error;
    }
    await cliente.query("DELETE FROM junta_asistentes WHERE junta_id = $1", [
      id,
    ]);
    for (const usuarioId of usuarioIds) {
      await cliente.query(
        "INSERT INTO junta_asistentes (junta_id, usuario_id) VALUES ($1, $2)",
        [id, usuarioId],
      );
    }
    await cliente.query("COMMIT");
    return { id, asistentes: usuarioIds.length };
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function guardarAccionesCorrectivas(id, accionIds, usuarioId) {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const { rows: juntas } = await cliente.query(
      "SELECT id FROM juntas WHERE id = $1 AND estado = 'celebrada' FOR UPDATE",
      [id],
    );

    if (!juntas[0]) {
      const error = new Error(
        "La junta no está disponible para modificar sus acciones.",
      );
      error.status = 409;
      error.publico =
        "Solo se pueden relacionar acciones durante una junta en curso.";
      throw error;
    }

    const { rows: acciones } = await cliente.query(
      "SELECT id FROM acciones_correctivas WHERE id = ANY($1::int[])",
      [accionIds],
    );

    if (acciones.length !== accionIds.length) {
      const error = new Error("Una o más acciones no existen.");
      error.status = 400;
      error.publico =
        "Actualiza la lista y selecciona acciones correctivas existentes.";
      throw error;
    }

    await cliente.query(
      `DELETE FROM junta_acciones_correctivas
       WHERE junta_id = $1 AND NOT (accion_id = ANY($2::int[]))`,
      [id, accionIds],
    );

    for (const accionId of accionIds) {
      await cliente.query(
        `INSERT INTO junta_acciones_correctivas
          (junta_id, accion_id, vinculada_por)
         VALUES ($1, $2, $3)
         ON CONFLICT (junta_id, accion_id) DO NOTHING`,
        [id, accionId, usuarioId],
      );
    }

    await cliente.query("COMMIT");
    return { junta_id: id, acciones: accionIds.length };
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function crearCompromiso(id, datos) {
  const { rows } = await query(
    `
    INSERT INTO compromisos (junta_id, descripcion, responsable_id, fecha_compromiso)
    SELECT j.id, $2, u.id, $4::date FROM juntas j
    JOIN usuarios u ON u.id = $3 AND u.activo = TRUE
    WHERE j.id = $1 AND j.estado = 'celebrada'
      AND $4::date >= (j.fecha AT TIME ZONE 'America/Monterrey')::date
    RETURNING id
  `,
    [id, datos.descripcion, datos.responsable_id, datos.fecha_compromiso],
  );
  if (!rows[0]) {
    const { rows: juntas } = await query(
      `SELECT estado,
              (fecha AT TIME ZONE 'America/Monterrey')::date::text AS dia
         FROM juntas WHERE id = $1`,
      [id],
    );
    if (juntas[0] && datos.fecha_compromiso < juntas[0].dia) {
      const [anio, mes, dia] = juntas[0].dia.split("-");
      const error = new Error("Fecha compromiso anterior a la junta");
      error.status = 400;
      error.publico = `La fecha compromiso no puede ser anterior a la fecha de la junta (${dia}/${mes}/${anio}).`;
      throw error;
    }
    const error = new Error("No se pudo registrar el acuerdo");
    error.status = juntas[0] ? 409 : 404;
    error.publico = juntas[0]
      ? "La junta debe estar en curso y el responsable debe estar activo."
      : "La junta no existe.";
    throw error;
  }
  return rows[0];
}

export async function registrarAvance(
  id,
  compromisoId,
  descripcion,
  usuarioId,
) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `
      SELECT c.id, c.estado FROM compromisos c
      JOIN juntas j ON j.id = c.junta_id
      WHERE j.id = $1 AND c.id = $2 AND j.estado IN ('celebrada', 'cerrada') FOR UPDATE OF c
    `,
      [id, compromisoId],
    );
    if (!rows[0] || rows[0].estado === "cerrado") {
      const error = new Error("Acuerdo no disponible");
      error.status = 409;
      error.publico =
        "El acuerdo no existe, la junta no se ha iniciado o el acuerdo ya está cerrado.";
      throw error;
    }
    const { rows: avances } = await cliente.query(
      `
      INSERT INTO compromiso_avances (compromiso_id, descripcion, usuario_id)
      VALUES ($1, $2, $3) RETURNING id
    `,
      [compromisoId, descripcion, usuarioId],
    );
    await cliente.query(
      "UPDATE compromisos SET estado = 'en_avance' WHERE id = $1",
      [compromisoId],
    );
    await cliente.query("COMMIT");
    return avances[0];
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function cerrarCompromiso(id, compromisoId, usuarioId, rol) {
  if (rol !== "admin_general") {
    const { rows: acuerdos } = await query(
      "SELECT responsable_id FROM compromisos WHERE id = $1 AND junta_id = $2",
      [compromisoId, id],
    );
    if (Number(acuerdos[0]?.responsable_id) === Number(usuarioId)) {
      const error = new Error("Acuerdo propio");
      error.status = 403;
      error.publico =
        "No puedes marcar como cumplido un acuerdo del que eres responsable. Debe confirmarlo otra persona.";
      throw error;
    }
  }

  const { rows } = await query(
    `
    UPDATE compromisos c SET estado = 'cerrado', cerrado_en = NOW(), cerrado_por = $3
    FROM juntas j WHERE j.id = c.junta_id AND j.id = $1 AND c.id = $2
      AND j.estado IN ('celebrada', 'cerrada') AND c.estado = 'en_avance'
    RETURNING c.id
  `,
    [id, compromisoId, usuarioId],
  );
  if (!rows[0]) {
    const error = new Error("No se pudo cerrar el acuerdo");
    error.status = 409;
    error.publico =
      "Registra al menos un avance antes de marcar el acuerdo como cumplido.";
    throw error;
  }
  return rows[0];
}

export async function cerrar(id) {
  const { rows } = await query(
    `
    UPDATE juntas j SET estado = 'cerrada'
    WHERE j.id = $1 AND j.estado = 'celebrada'
      AND EXISTS (SELECT 1 FROM minutas m WHERE m.junta_id = j.id AND length(trim(m.contenido)) > 0)
    RETURNING j.id, j.estado
  `,
    [id],
  );
  if (!rows[0])
    await errorJunta(
      id,
      "La junta debe estar en curso y tener una minuta antes de cerrarse.",
    );
  return rows[0];
}

async function errorJunta(id, mensaje) {
  const { rows } = await query("SELECT id FROM juntas WHERE id = $1", [id]);
  const error = new Error(mensaje);
  error.status = rows[0] ? 409 : 404;
  error.publico = rows[0] ? mensaje : "La junta no existe.";
  throw error;
}
