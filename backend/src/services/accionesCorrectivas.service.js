import { pool, query } from "../config/db.js";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";

const DIRECTORIO_RAIZ = path.resolve(process.env.STORAGE_DIR || "/app/storage");
const DIRECTORIO_EVIDENCIAS = path.join(
  DIRECTORIO_RAIZ,
  "acciones-correctivas",
);

export async function listar() {
  const { rows } = await query(`
    SELECT a.id, COALESCE(a.titulo, 'Acción ' || a.id) AS titulo,
           a.descripcion, a.estado, a.tipo, a.prioridad, a.origen,
           a.proceso_id, a.responsable_id, a.hallazgo_id,
            a.tipo_hallazgo, a.afecta_otros_procesos,
            COALESCE((
              SELECT json_agg(
                json_build_object('id', proceso_afectado.id, 'nombre', proceso_afectado.nombre)
                ORDER BY proceso_afectado.nombre
              )
              FROM acciones_correctivas_procesos_afectados relacion
              JOIN procesos proceso_afectado
                ON proceso_afectado.id = relacion.proceso_id
              WHERE relacion.accion_id = a.id
            ), '[]'::json) AS procesos_afectados,
           a.fecha_ocurrencia::text, a.fecha_compromiso::text, a.creado_en, a.cerrado_en,
           cierre.nombre AS cerrado_por_nombre,
           p.nombre AS proceso, u.nombre AS responsable, c.nombre AS solicitante,
           COALESCE((SELECT json_agg(json_build_object(
             'id', s.id, 'fecha', s.creado_en, 'usuario', actor.nombre,
             'comentario', s.comentario, 'estado', s.estado_resultante, 'tipo', s.tipo_evento,
             'evidencias', COALESCE((SELECT json_agg(json_build_object(
               'id', e.id, 'nombre', e.nombre_archivo, 'tamano_bytes', e.tamano_bytes,
               'fecha', e.creado_en
             ) ORDER BY e.id) FROM evidencias_acciones_correctivas e
               WHERE e.seguimiento_id = s.id), '[]'::json)
           ) ORDER BY s.creado_en, s.id)
             FROM seguimientos_acciones_correctivas s
             JOIN usuarios actor ON actor.id = s.usuario_id
            WHERE s.accion_id = a.id), '[]'::json) AS seguimientos
      FROM acciones_correctivas a
      LEFT JOIN procesos p ON p.id = a.proceso_id
      LEFT JOIN usuarios u ON u.id = a.responsable_id
      LEFT JOIN usuarios c ON c.id = a.creado_por
      LEFT JOIN usuarios cierre ON cierre.id = a.cerrado_por
     ORDER BY a.creado_en DESC, a.id DESC`);
  return rows;
}

export async function crear(datos, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (datos.procesos_afectados.includes(datos.proceso_id)) {
      throw errorPublico(
        400,
        "El proceso principal no debe aparecer en la lista de otros procesos afectados.",
      );
    }

    const idsProcesos = [datos.proceso_id, ...datos.procesos_afectados];

    const { rows: procesosValidos } = await client.query(
      `
      SELECT id
      FROM procesos
      WHERE id = ANY($1::int[])
        AND estatus = 'activo'
      `,
      [idsProcesos],
    );

    if (procesosValidos.length !== idsProcesos.length) {
      throw errorPublico(
        400,
        "El proceso principal o alguno de los procesos afectados no existe o está inactivo.",
      );
    }

    const { rows } = await client.query(
      `
      INSERT INTO acciones_correctivas (
      hallazgo_id,
      titulo,
      descripcion,
      proceso_id,
      responsable_id,
      creado_por,
      tipo,
      tipo_hallazgo,
      afecta_otros_procesos,
      origen,
      fecha_ocurrencia,
      fecha_compromiso
    )
    SELECT
      $1,
      $2,
      $3,
      p.id,
      u.id,
      c.id,
      $7,
      $8,
      $9,
      $10,
      $11::date,
      $12::date
    FROM procesos p, usuarios u, usuarios c
    WHERE p.id = $4
      AND p.estatus = 'activo'
      AND u.id = $5
      AND u.activo = TRUE
      AND c.id = $6
      AND c.activo = TRUE
      AND (
        $1::integer IS NULL
        OR EXISTS (
          SELECT 1
          FROM hallazgos h
          JOIN auditorias auditoria ON auditoria.id = h.auditoria_id
          WHERE h.id = $1
            AND auditoria.proceso_id = p.id
        )
      )
    RETURNING id
    `,
      [
        datos.hallazgo_id,
        datos.titulo,
        datos.descripcion,
        datos.proceso_id,
        datos.responsable_id,
        usuarioId,
        datos.tipo,
        datos.tipo_hallazgo,
        datos.afecta_otros_procesos,
        datos.origen,
        datos.fecha_ocurrencia,
        datos.fecha_compromiso,
      ],
    );

    if (!rows[0]) {
      throw errorPublico(
        400,
        "El proceso, responsable o solicitante no existe o está inactivo.",
      );
    }

    for (const procesoId of datos.procesos_afectados) {
      await client.query(
        `
        INSERT INTO acciones_correctivas_procesos_afectados (
          accion_id,
          proceso_id
        )
        VALUES ($1, $2)
        `,
        [rows[0].id, procesoId],
      );
    }

    if (Number(datos.responsable_id) !== Number(usuarioId)) {
      await client.query(
        `INSERT INTO notificaciones (usuario_id, mensaje, enlace)
        VALUES ($1, $2, $3)`,
        [
          Number(datos.responsable_id),
          `Se te asignó la acción correctiva AC-${rows[0].id}: ${datos.titulo}.`,
          "/acciones-correctivas",
        ],
      );
    }

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function vincularConHallazgo(accionId, hallazgoId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: acciones } = await client.query(
      `SELECT id, hallazgo_id, proceso_id
       FROM acciones_correctivas
       WHERE id = $1
       FOR UPDATE`,
      [accionId],
    );

    const accion = acciones[0];

    if (!accion) {
      throw errorPublico(404, "La acción correctiva no existe.");
    }

    const { rows: hallazgos } = await client.query(
      `SELECT h.id, auditoria.proceso_id
       FROM hallazgos h
       JOIN auditorias auditoria ON auditoria.id = h.auditoria_id
       WHERE h.id = $1
       FOR UPDATE OF h`,
      [hallazgoId],
    );

    const hallazgo = hallazgos[0];

    if (!hallazgo) {
      throw errorPublico(404, "El hallazgo de auditoría no existe.");
    }

    if (Number(accion.proceso_id) !== Number(hallazgo.proceso_id)) {
      throw errorPublico(
        400,
        "La acción y el hallazgo deben pertenecer al mismo proceso.",
      );
    }

    if (
      accion.hallazgo_id !== null &&
      Number(accion.hallazgo_id) !== hallazgoId
    ) {
      throw errorPublico(
        409,
        "La acción ya está relacionada con otro hallazgo.",
      );
    }

    const { rows: actualizadas } = await client.query(
      `UPDATE acciones_correctivas
       SET hallazgo_id = $2
       WHERE id = $1
       RETURNING id, hallazgo_id, titulo, estado`,
      [accionId, hallazgoId],
    );

    await client.query("COMMIT");
    return actualizadas[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function actualizar(accionId, datos, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: actuales } = await client.query(
      `SELECT id, estado, responsable_id
         FROM acciones_correctivas
        WHERE id = $1
        FOR UPDATE`,
      [accionId],
    );
    const actual = actuales[0];

    if (!actual) {
      throw errorPublico(404, "La acción correctiva no existe.");
    }

    if (!["propuesta", "en_seguimiento"].includes(actual.estado)) {
      throw errorPublico(
        409,
        "Solo se pueden modificar acciones levantadas o en seguimiento.",
      );
    }

    const { rows: responsables } = await client.query(
      "SELECT id FROM usuarios WHERE id = $1 AND activo = TRUE",
      [datos.responsable_id],
    );
    if (!responsables[0]) {
      throw errorPublico(400, "El responsable no existe o está inactivo.");
    }

    const { rows } = await client.query(
      `UPDATE acciones_correctivas
          SET titulo = $2,
              descripcion = $3,
              origen = $4,
              tipo = $5,
              tipo_hallazgo = $6,
              responsable_id = $7,
              fecha_ocurrencia = $8::date,
              fecha_compromiso = $9::date
        WHERE id = $1
        RETURNING id, titulo, estado`,
      [
        accionId,
        datos.titulo,
        datos.descripcion,
        datos.origen,
        datos.tipo,
        datos.tipo_hallazgo,
        datos.responsable_id,
        datos.fecha_ocurrencia,
        datos.fecha_compromiso,
      ],
    );

    const cambioResponsable =
      Number(actual.responsable_id) !== Number(datos.responsable_id);

    if (
      cambioResponsable &&
      Number(datos.responsable_id) !== Number(usuarioId)
    ) {
      await client.query(
        `INSERT INTO notificaciones (usuario_id, mensaje, enlace)
         VALUES ($1, $2, $3)`,
        [
          Number(datos.responsable_id),
          `Se te asignó la acción correctiva AC-${accionId}: ${datos.titulo}.`,
          "/acciones-correctivas",
        ],
      );
    }

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function errorPublico(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function registrarSeguimiento(
  accionId,
  usuarioId,
  comentario,
  enviarRevision,
  archivos = [],
) {
  const client = await pool.connect();
  const rutasCreadas = [];
  let confirmado = false;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT id, responsable_id, estado FROM acciones_correctivas WHERE id = $1 FOR UPDATE",
      [accionId],
    );
    const accion = rows[0];
    if (!accion) throw errorPublico(404, "La acción no existe.");
    if (accion.responsable_id !== usuarioId) {
      throw errorPublico(
        403,
        "Solo el responsable asignado puede registrar el seguimiento.",
      );
    }
    const { rows: usuarios } = await client.query(
      "SELECT id FROM usuarios WHERE id = $1 AND activo = TRUE",
      [usuarioId],
    );
    if (!usuarios[0]) throw errorPublico(403, "El usuario está inactivo.");
    if (!["propuesta", "en_seguimiento"].includes(accion.estado)) {
      throw errorPublico(
        409,
        "La acción ya fue enviada a revisión o no admite nuevos avances. Actualiza la lista.",
      );
    }
    const estado = enviarRevision ? "en_revision" : "en_seguimiento";
    const { rows: historial } = await client.query(
      `
      INSERT INTO seguimientos_acciones_correctivas (accion_id, usuario_id, comentario, estado_resultante)
      VALUES ($1, $2, $3, $4) RETURNING id, creado_en`,
      [accionId, usuarioId, comentario, estado],
    );
    for (const archivo of archivos) {
      const evidencia = await guardarEvidencia(archivo, rutasCreadas);
      await client.query(
        `
        INSERT INTO evidencias_acciones_correctivas (seguimiento_id, nombre_archivo, archivo_url, tipo_mime, tamano_bytes)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          historial[0].id,
          evidencia.nombre,
          evidencia.rutaRelativa,
          archivo.mimetype,
          archivo.size,
        ],
      );
    }
    await client.query(
      "UPDATE acciones_correctivas SET estado = $2 WHERE id = $1",
      [accionId, estado],
    );
    if (enviarRevision) {
      await client.query(
        `INSERT INTO notificaciones (usuario_id, mensaje, enlace)
          SELECT DISTINCT u.id, $2, $3
          FROM usuarios u
          JOIN roles r ON r.id = u.rol_id
          WHERE u.activo = TRUE
            AND u.id <> $1
            AND (
              r.clave = 'admin_general'
              OR EXISTS (
                SELECT 1
                FROM usuario_permisos p
                WHERE p.usuario_id = u.id
                  AND p.permiso = 'accionesCorrectivas.revisar'
              )
            )`,
        [
          usuarioId,
          `La acción correctiva AC-${accionId} fue enviada a revisión.`,
          "/acciones-correctivas",
        ],
      );
    }
    await client.query("COMMIT");
    confirmado = true;
    return { ...historial[0], accion_id: accionId, estado };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    if (!confirmado) await limpiarEvidencias(rutasCreadas);
  }
}

async function guardarEvidencia(archivo, rutasCreadas) {
  if (!archivo.buffer?.length || archivo.originalname.length > 255) {
    throw errorPublico(
      400,
      "La evidencia está vacía o el nombre supera 255 caracteres.",
    );
  }
  await mkdir(DIRECTORIO_EVIDENCIAS, { recursive: true });
  const nombreInterno = `${randomUUID()}${path.extname(archivo.originalname).toLowerCase()}`;
  const rutaAbsoluta = path.join(DIRECTORIO_EVIDENCIAS, nombreInterno);
  rutasCreadas.push(rutaAbsoluta);
  try {
    await writeFile(rutaAbsoluta, archivo.buffer, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") rutasCreadas.pop();
    throw error;
  }
  return {
    nombre: path
      .basename(archivo.originalname.replaceAll("\\", "/"))
      .replace(/[\x00-\x1f\x7f]/g, "_"),
    rutaRelativa: `acciones-correctivas/${nombreInterno}`,
  };
}

async function limpiarEvidencias(rutas) {
  for (const ruta of rutas) {
    try {
      await unlink(ruta);
    } catch (error) {
      if (error.code !== "ENOENT")
        console.error(
          "No se pudo limpiar una evidencia de una carga fallida:",
          error.code,
        );
    }
  }
}

export async function obtenerEvidencia(accionId, evidenciaId) {
  const { rows } = await query(
    `
    SELECT e.archivo_url, e.nombre_archivo
    FROM evidencias_acciones_correctivas e
    JOIN seguimientos_acciones_correctivas s ON s.id = e.seguimiento_id
    WHERE e.id = $1 AND s.accion_id = $2`,
    [evidenciaId, accionId],
  );
  if (!rows[0])
    throw errorPublico(404, "La evidencia no existe para esta acción.");
  const rutaAbsoluta = path.resolve(DIRECTORIO_RAIZ, rows[0].archivo_url);
  if (!rutaAbsoluta.startsWith(`${DIRECTORIO_EVIDENCIAS}${path.sep}`)) {
    throw errorPublico(400, "La ruta de la evidencia no es válida.");
  }
  try {
    await access(rutaAbsoluta);
  } catch {
    throw errorPublico(404, "El archivo de evidencia no está disponible.");
  }
  return { rutaAbsoluta, nombreArchivo: rows[0].nombre_archivo };
}

export async function revisar(accionId, usuarioId, decision, comentario) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: usuarios } = await client.query(
      `
      SELECT u.id, r.clave AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id
      WHERE u.id = $1 AND u.activo = TRUE
        AND (r.clave = 'admin_general' OR EXISTS (
          SELECT 1 FROM usuario_permisos p
           WHERE p.usuario_id = u.id AND p.permiso = 'accionesCorrectivas.revisar'))`,
      [usuarioId],
    );
    if (!usuarios[0])
      throw errorPublico(403, "No tienes permiso para revisar la acción.");
    const { rows } = await client.query(
      "SELECT id, estado, responsable_id FROM acciones_correctivas WHERE id = $1 FOR UPDATE",
      [accionId],
    );
    if (!rows[0]) throw errorPublico(404, "La acción no existe.");
    if (
      usuarios[0].rol !== "admin_general" &&
      Number(rows[0].responsable_id) === Number(usuarioId)
    ) {
      throw errorPublico(
        403,
        "No puedes revisar una acción de la que eres responsable. Debe revisarla otra persona.",
      );
    }
    if (rows[0].estado !== "en_revision") {
      throw errorPublico(
        409,
        "La acción ya fue revisada o todavía no está en revisión. Actualiza la lista.",
      );
    }
    const aceptar = decision === "aceptar";
    const estado = aceptar ? "cerrada" : "en_seguimiento";
    const tipo = aceptar ? "aceptacion" : "correcciones";
    await client.query(
      `
      INSERT INTO seguimientos_acciones_correctivas (accion_id, usuario_id, comentario, estado_resultante, tipo_evento)
      VALUES ($1, $2, $3, $4, $5)`,
      [
        accionId,
        usuarioId,
        comentario || "Acción aceptada y cerrada por el administrador.",
        estado,
        tipo,
      ],
    );
    const { rows: actualizadas } = await client.query(
      `
      UPDATE acciones_correctivas SET estado = $2,
        cerrado_en = CASE WHEN $3::boolean THEN NOW() ELSE NULL END,
        cerrado_por = CASE WHEN $3::boolean THEN $4::integer ELSE NULL END
      WHERE id = $1 RETURNING id, estado, cerrado_en`,
      [accionId, estado, aceptar, usuarioId],
    );
    if (Number(rows[0].responsable_id) !== Number(usuarioId)) {
      const mensaje = aceptar
        ? `La acción correctiva AC-${accionId} fue aceptada y cerrada.`
        : `La acción correctiva AC-${accionId} fue devuelta para correcciones.`;

      await client.query(
        `INSERT INTO notificaciones (usuario_id, mensaje, enlace)
         VALUES ($1, $2, $3)`,
        [Number(rows[0].responsable_id), mensaje, "/acciones-correctivas"],
      );
    }
    await client.query("COMMIT");
    return actualizadas[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
