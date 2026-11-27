import { pool, query } from "../config/db.js";
import {
  guardarArchivoAuditoria,
  limpiarArchivosAuditoria,
} from "./archivosAuditoria.service.js";

function adminOPermiso(permiso) {
  return `(r.clave = 'admin_general' OR EXISTS (
        SELECT 1 FROM usuario_permisos permiso
         WHERE permiso.usuario_id = u.id AND permiso.permiso = '${permiso}'))`;
}

export async function listar() {
  const { rows } = await query(`
    SELECT a.id, a.nombre, a.tipo_auditoria, a.estado, a.proceso_id, a.auditor_catalogo_id,
      a.fecha_programada::text, a.alcance, a.comentarios, a.creado_en,
      a.iniciada_en, inicio.nombre AS iniciada_por_nombre,
      a.conclusion, a.informe_emitido_en, informe.nombre AS informe_emitido_por_nombre,
      a.cerrada_en, cierre.nombre AS cerrada_por_nombre,
      p.nombre AS proceso, u.nombre AS auditor, cat.codigo AS auditor_codigo,
      c.nombre AS solicitante,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', n.id,
            'codigo', n.codigo,
            'nombre', n.nombre,
            'criterios', COALESCE((
              SELECT json_agg(
                json_build_object(
                  'id', criterio.id,
                  'codigo', criterio.codigo,
                  'descripcion', criterio.descripcion
                )
                ORDER BY criterio.codigo
              )
              FROM norma_criterios nc
              JOIN criterios_norma criterio
                ON criterio.id = nc.criterio_id
                AND criterio.activo = TRUE
              WHERE nc.norma_id = n.id
            ), '[]'::json)
          )
          ORDER BY n.codigo
        )
        FROM proceso_normas pn
        JOIN normas n
          ON n.id = pn.norma_id
          AND n.activo = TRUE
        WHERE pn.proceso_id = a.proceso_id
      ), '[]'::json) AS normas,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', h.id,
          'descripcion', h.descripcion,
          'criterio', h.criterio,
          'norma_id', h.norma_id,
          'criterio_id', h.criterio_id,
          'norma_codigo', norma_hallazgo.codigo,
          'norma_nombre', norma_hallazgo.nombre,
          'criterio_codigo', criterio_hallazgo.codigo,
          'criterio_descripcion', criterio_hallazgo.descripcion,
          'evidencia_observada', h.evidencia_observada,
          'responsable_id', h.responsable_id,
          'responsable', responsable.nombre,
          'estado', h.estado,
          'creado_en', h.creado_en,
          'registrado_por', autor.nombre,
          'archivos', COALESCE((
            SELECT json_agg(json_build_object(
              'id', f.id, 'nombre', f.nombre_archivo,
              'tamano_bytes', f.tamano_bytes, 'creado_en', f.creado_en
            ) ORDER BY f.id)
            FROM archivos_hallazgos f
            WHERE f.hallazgo_id = h.id AND f.seguimiento_id IS NULL
          ), '[]'::json),
          'seguimientos', COALESCE((
            SELECT json_agg(json_build_object(
              'id', s.id,
              'comentario', s.comentario,
              'tipo', s.tipo,
              'usuario', seguidor.nombre,
              'creado_en', s.creado_en,
              'archivos', COALESCE((
                SELECT json_agg(json_build_object(
                  'id', f.id, 'nombre', f.nombre_archivo,
                  'tamano_bytes', f.tamano_bytes, 'creado_en', f.creado_en
                ) ORDER BY f.id)
                FROM archivos_hallazgos f
                WHERE f.seguimiento_id = s.id AND f.hallazgo_id = h.id
              ), '[]'::json)
            ) ORDER BY s.creado_en, s.id)
            FROM seguimientos_hallazgos s
            JOIN usuarios seguidor ON seguidor.id = s.usuario_id
            WHERE s.hallazgo_id = h.id
          ), '[]'::json),
            'acciones_correctivas', COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', ac.id,
                'titulo', ac.titulo,
                'estado', ac.estado
              )
              ORDER BY ac.id
            )
            FROM acciones_correctivas ac
            WHERE ac.hallazgo_id = h.id
          ), '[]'::json)
        ) ORDER BY h.creado_en, h.id)
        FROM hallazgos h
        JOIN usuarios responsable ON responsable.id = h.responsable_id
        LEFT JOIN normas norma_hallazgo
          ON norma_hallazgo.id = h.norma_id
        LEFT JOIN criterios_norma criterio_hallazgo
          ON criterio_hallazgo.id = h.criterio_id
        LEFT JOIN usuarios autor ON autor.id = h.creado_por
        WHERE h.auditoria_id = a.id
      ), '[]'::json) AS hallazgos
    FROM auditorias a
    LEFT JOIN procesos p ON p.id = a.proceso_id
    JOIN usuarios u ON u.id = a.auditor_id
    LEFT JOIN auditores cat ON cat.id = a.auditor_catalogo_id
    JOIN usuarios c ON c.id = a.creada_por
    LEFT JOIN usuarios inicio ON inicio.id = a.iniciada_por
    LEFT JOIN usuarios informe ON informe.id = a.informe_emitido_por
    LEFT JOIN usuarios cierre ON cierre.id = a.cerrada_por
    ORDER BY a.creado_en DESC, a.id DESC`);
  return rows;
}

export async function catalogos() {
  const [procesos, auditores, responsables] = await Promise.all([
    query(
      "SELECT id, nombre FROM procesos WHERE estatus = 'activo' ORDER BY nombre",
    ),
    query(`
      SELECT a.id, a.codigo, u.nombre
      FROM auditores a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.activo = TRUE AND u.activo = TRUE
      ORDER BY a.codigo
    `),
    query(
      "SELECT id, nombre FROM usuarios WHERE activo = TRUE ORDER BY nombre",
    ),
  ]);

  return {
    procesos: procesos.rows,
    auditores: auditores.rows,
    responsables: responsables.rows,
  };
}

export async function crear(datos, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO auditorias (
        nombre,
        tipo_auditoria,
        auditor_id,
        creada_por,
        proceso_id,
        auditor_catalogo_id,
        fecha_programada,
        alcance,
        comentarios
      )
      SELECT $1, $8, u.id, c.id, p.id, cat.id, $5::date, $6, $7
      FROM auditores cat
      JOIN usuarios u ON u.id = cat.usuario_id,
        procesos p,
        usuarios c
      WHERE cat.id = $2
        AND cat.activo = TRUE
        AND u.activo = TRUE
        AND p.id = $3
        AND p.estatus = 'activo'
        AND c.id = $4
        AND c.activo = TRUE
      RETURNING id, estado, tipo_auditoria, auditor_id
      `,
      [
        datos.nombre,
        datos.auditor_catalogo_id,
        datos.proceso_id,
        usuarioId,
        datos.fecha_programada,
        datos.alcance,
        datos.comentarios,
        datos.tipo_auditoria,
      ],
    );

    if (!rows[0]) {
      const error = new Error("Catálogos no disponibles");
      error.status = 400;
      error.publico =
        "El auditor, su usuario, el proceso o el solicitante no existe o está inactivo.";
      throw error;
    }

    if (Number(rows[0].auditor_id) !== Number(usuarioId)) {
      await client.query(
        `INSERT INTO notificaciones (
           usuario_id,
           mensaje,
           enlace
         )
         VALUES ($1, $2, $3)`,
        [
          Number(rows[0].auditor_id),
          `Se te asignó la auditoría AUD-${rows[0].id}: ${datos.nombre}.`,
          "/auditorias",
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

export async function iniciarEjecucion(auditoriaId, usuarioId) {
  const { rows: usuarios } = await query(
    `
    SELECT u.id
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE u.id = $1
      AND u.activo = TRUE
      AND ${adminOPermiso("auditorias.iniciar")}`,
    [usuarioId],
  );

  if (!usuarios[0]) {
    const error = new Error("Administrador no disponible");
    error.status = 403;
    error.publico = "No tienes permiso para iniciar la ejecución.";
    throw error;
  }

  const { rows } = await query(
    `
    UPDATE auditorias a
    SET estado = 'ejecucion',
        iniciada_en = NOW(),
        iniciada_por = u.id
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE a.id = $1
      AND a.estado = 'planeacion'
      AND a.iniciada_en IS NULL
      AND u.id = $2
      AND u.activo = TRUE
      AND ${adminOPermiso("auditorias.iniciar")}
    RETURNING a.id, a.estado, a.iniciada_en`,
    [auditoriaId, usuarioId],
  );

  if (!rows[0]) {
    const { rows: existentes } = await query(
      "SELECT id FROM auditorias WHERE id = $1",
      [auditoriaId],
    );

    const error = new Error("No se pudo iniciar la auditoría");
    error.status = existentes[0] ? 409 : 404;
    error.publico = existentes[0]
      ? "La auditoría ya no está en Planeación o no puede iniciarse. Actualiza la lista."
      : "La auditoría no existe.";
    throw error;
  }

  return rows[0];
}

export async function finalizarInforme(auditoriaId, usuarioId, conclusion) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: administradores } = await client.query(
      `
      SELECT u.id
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.id = $1 AND u.activo = TRUE AND ${adminOPermiso("auditorias.finalizarInforme")}
    `,
      [usuarioId],
    );

    if (!administradores[0]) {
      throw errorHallazgo(403, "No tienes permiso para finalizar el informe.");
    }

    const { rows: auditorias } = await client.query(
      `
      SELECT id, estado
      FROM auditorias
      WHERE id = $1
      FOR UPDATE
    `,
      [auditoriaId],
    );

    if (!auditorias[0]) {
      throw errorHallazgo(404, "La auditoría no existe.");
    }

    if (auditorias[0].estado !== "ejecucion") {
      throw errorHallazgo(
        409,
        "El informe solo puede finalizarse durante la ejecución.",
      );
    }

    const { rows: pendientes } = await client.query(
      `
      SELECT id FROM hallazgos
      WHERE auditoria_id = $1 AND estado <> 'cerrado'
      LIMIT 1
    `,
      [auditoriaId],
    );

    const sinPendientes = !pendientes[0];
    const { rows } = await client.query(
      `
      UPDATE auditorias
      SET conclusion = $2,
          informe_emitido_en = NOW(),
          informe_emitido_por = $3::integer,
          estado = $4,
          cerrada_en = CASE WHEN $5::boolean THEN NOW() ELSE NULL END,
          cerrada_por = CASE WHEN $5::boolean THEN $3::integer ELSE NULL END
      WHERE id = $1
      RETURNING id, estado, informe_emitido_en, cerrada_en
    `,
      [
        auditoriaId,
        conclusion,
        usuarioId,
        sinPendientes ? "cerrada" : "en_seguimiento",
        sinPendientes,
      ],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function errorHallazgo(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function registrarHallazgo(
  auditoriaId,
  datos,
  usuarioId,
  archivos = [],
) {
  const client = await pool.connect();
  const rutasCreadas = [];
  let confirmado = false;

  try {
    await client.query("BEGIN");

    const { rows: administradores } = await client.query(
      `
      SELECT u.id
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.id = $1
        AND u.activo = TRUE
        AND ${adminOPermiso("auditorias.hallazgos")}
    `,
      [usuarioId],
    );

    if (!administradores[0]) {
      throw errorHallazgo(403, "No tienes permiso para registrar hallazgos.");
    }

    const { rows: auditorias } = await client.query(
      `
      SELECT id, estado, proceso_id
      FROM auditorias
      WHERE id = $1
      FOR UPDATE
    `,
      [auditoriaId],
    );

    if (!auditorias[0]) {
      throw errorHallazgo(404, "La auditoría no existe.");
    }

    if (auditorias[0].estado !== "ejecucion") {
      throw errorHallazgo(
        409,
        "Solo puedes registrar hallazgos en una auditoría En ejecución.",
      );
    }

    if (datos.norma_id !== null && datos.criterio_id !== null) {
      const { rows: relacionValida } = await client.query(
        `
          SELECT 1
          FROM proceso_normas pn
          JOIN normas n
            ON n.id = pn.norma_id
            AND n.activo = TRUE
          JOIN norma_criterios nc
            ON nc.norma_id = pn.norma_id
            AND nc.criterio_id = $3
          JOIN criterios_norma c
            ON c.id = nc.criterio_id
            AND c.activo = TRUE
          WHERE pn.proceso_id = $1
            AND pn.norma_id = $2
          `,
        [auditorias[0].proceso_id, datos.norma_id, datos.criterio_id],
      );

      if (!relacionValida[0]) {
        throw errorHallazgo(
          400,
          "El criterio seleccionado no corresponde a una norma activa del proceso auditado.",
        );
      }
    }

    const { rows } = await client.query(
      `
      INSERT INTO hallazgos (
        auditoria_id,
        descripcion,
        criterio,
        evidencia_observada,
        responsable_id,
        creado_por,
        norma_id,
        criterio_id
      )
      SELECT $1, $2, $5, $6, u.id, $4, $7, $8
      FROM usuarios u
      WHERE u.id = $3 AND u.activo = TRUE
      RETURNING
        id,
        auditoria_id,
        criterio,
        evidencia_observada,
        norma_id,
        criterio_id,
        estado,
        creado_en
      `,
      [
        auditoriaId,
        datos.descripcion,
        datos.responsable_id,
        usuarioId,
        datos.criterio,
        datos.evidencia_observada,
        datos.norma_id,
        datos.criterio_id,
      ],
    );

    if (!rows[0]) {
      throw errorHallazgo(400, "El responsable no existe o está inactivo.");
    }

    if (Number(datos.responsable_id) !== Number(usuarioId)) {
      await client.query(
        `INSERT INTO notificaciones (
          usuario_id,
          mensaje,
          enlace
        )
        VALUES ($1, $2, $3)`,
        [
          Number(datos.responsable_id),
          `Se te asignó el hallazgo HAL-${rows[0].id} de la auditoría AUD-${auditoriaId}.`,
          "/auditorias",
        ],
      );
    }

    for (const archivo of archivos) {
      const guardado = await guardarArchivoAuditoria(archivo, rutasCreadas);
      await client.query(
        `
        INSERT INTO archivos_hallazgos
          (hallazgo_id, nombre_archivo, archivo_url, tipo_mime, tamano_bytes)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [
          rows[0].id,
          guardado.nombre,
          guardado.rutaRelativa,
          archivo.mimetype,
          archivo.size,
        ],
      );
    }

    await client.query("COMMIT");
    confirmado = true;
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    if (!confirmado) await limpiarArchivosAuditoria(rutasCreadas);
  }
}

export async function registrarSeguimientoHallazgo(
  auditoriaId,
  hallazgoId,
  usuarioId,
  comentario,
  archivos = [],
) {
  const client = await pool.connect();
  const rutasCreadas = [];
  let confirmado = false;

  try {
    await client.query("BEGIN");

    const { rows: usuarios } = await client.query(
      "SELECT id FROM usuarios WHERE id = $1 AND activo = TRUE",
      [usuarioId],
    );

    if (!usuarios[0]) {
      throw errorHallazgo(403, "Tu usuario no está activo.");
    }

    const { rows: hallazgos } = await client.query(
      `
      SELECT h.id, h.responsable_id, h.estado,
             a.estado AS auditoria_estado
      FROM auditorias a
      JOIN hallazgos h ON h.auditoria_id = a.id
      WHERE a.id = $1 AND h.id = $2
      FOR UPDATE OF a, h
    `,
      [auditoriaId, hallazgoId],
    );

    const hallazgo = hallazgos[0];

    if (!hallazgo) {
      throw errorHallazgo(404, "El hallazgo no pertenece a esta auditoría.");
    }

    if (hallazgo.responsable_id !== usuarioId) {
      throw errorHallazgo(
        403,
        "Solo el responsable asignado puede registrar avances.",
      );
    }

    if (
      !["ejecucion", "en_seguimiento"].includes(hallazgo.auditoria_estado) ||
      hallazgo.estado !== "abierto"
    ) {
      throw errorHallazgo(
        409,
        "Este hallazgo ya no admite nuevos avances. Actualiza la lista.",
      );
    }

    const { rows } = await client.query(
      `
      INSERT INTO seguimientos_hallazgos
        (hallazgo_id, usuario_id, comentario)
      VALUES ($1, $2, $3)
      RETURNING id, hallazgo_id, creado_en
    `,
      [hallazgoId, usuarioId, comentario],
    );

    for (const archivo of archivos) {
      const guardado = await guardarArchivoAuditoria(archivo, rutasCreadas);
      await client.query(
        `
        INSERT INTO archivos_hallazgos
          (hallazgo_id, seguimiento_id, nombre_archivo, archivo_url, tipo_mime, tamano_bytes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          hallazgoId,
          rows[0].id,
          guardado.nombre,
          guardado.rutaRelativa,
          archivo.mimetype,
          archivo.size,
        ],
      );
    }

    await client.query("COMMIT");
    confirmado = true;
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    if (!confirmado) await limpiarArchivosAuditoria(rutasCreadas);
  }
}

export async function enviarHallazgoARevision(
  auditoriaId,
  hallazgoId,
  usuarioId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: hallazgos } = await client.query(
      `
      SELECT h.id, h.responsable_id, h.estado,
             a.estado AS auditoria_estado,
             u.activo AS responsable_activo
      FROM auditorias a
      JOIN hallazgos h ON h.auditoria_id = a.id
      JOIN usuarios u ON u.id = h.responsable_id
      WHERE a.id = $1 AND h.id = $2
      FOR UPDATE OF a, h
    `,
      [auditoriaId, hallazgoId],
    );

    const hallazgo = hallazgos[0];

    if (!hallazgo) {
      throw errorHallazgo(404, "El hallazgo no pertenece a esta auditoría.");
    }

    if (hallazgo.responsable_id !== usuarioId || !hallazgo.responsable_activo) {
      throw errorHallazgo(
        403,
        "Solo el responsable activo puede enviar este hallazgo a revisión.",
      );
    }

    if (
      !["ejecucion", "en_seguimiento"].includes(hallazgo.auditoria_estado) ||
      hallazgo.estado !== "abierto"
    ) {
      throw errorHallazgo(
        409,
        "Este hallazgo ya no puede enviarse a revisión. Actualiza la lista.",
      );
    }

    const { rows: avances } = await client.query(
      `SELECT id FROM seguimientos_hallazgos
       WHERE hallazgo_id = $1 LIMIT 1`,
      [hallazgoId],
    );

    if (!avances[0]) {
      throw errorHallazgo(
        409,
        "Registra al menos un avance antes de enviar el hallazgo a revisión.",
      );
    }

    const { rows } = await client.query(
      `
      UPDATE hallazgos
      SET estado = 'en_revision'
      WHERE id = $1
      RETURNING id, auditoria_id, estado
    `,
      [hallazgoId],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revisarHallazgo(
  auditoriaId,
  hallazgoId,
  usuarioId,
  decision,
  comentario,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: revisores } = await client.query(
      `
      SELECT u.id, r.clave AS rol
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.id = $1
        AND u.activo = TRUE
        AND ${adminOPermiso("auditorias.hallazgos")}
    `,
      [usuarioId],
    );

    if (!revisores[0]) {
      throw errorHallazgo(403, "No tienes permiso para revisar hallazgos.");
    }

    const { rows: hallazgos } = await client.query(
      `
      SELECT h.id, h.estado, h.responsable_id, a.estado AS auditoria_estado
      FROM auditorias a
      JOIN hallazgos h ON h.auditoria_id = a.id
      WHERE a.id = $1 AND h.id = $2
      FOR UPDATE OF a, h
    `,
      [auditoriaId, hallazgoId],
    );

    const hallazgo = hallazgos[0];

    if (!hallazgo) {
      throw errorHallazgo(404, "El hallazgo no pertenece a esta auditoría.");
    }

    if (
      revisores[0].rol !== "admin_general" &&
      Number(hallazgo.responsable_id) === Number(usuarioId)
    ) {
      throw errorHallazgo(
        403,
        "No puedes revisar un hallazgo del que eres responsable. Debe revisarlo otra persona.",
      );
    }

    if (
      !["ejecucion", "en_seguimiento"].includes(hallazgo.auditoria_estado) ||
      hallazgo.estado !== "en_revision"
    ) {
      throw errorHallazgo(
        409,
        "Este hallazgo ya no está En revisión. Actualiza la lista.",
      );
    }

    const nuevoEstado = decision === "aceptar" ? "cerrado" : "abierto";
    const tipo = decision === "aceptar" ? "aceptacion" : "correcciones";
    const texto =
      comentario || "El administrador aceptó el avance y cerró el hallazgo.";

    await client.query(
      `
      INSERT INTO seguimientos_hallazgos
        (hallazgo_id, usuario_id, comentario, tipo)
      VALUES ($1, $2, $3, $4)
    `,
      [hallazgoId, usuarioId, texto, tipo],
    );

    const { rows } = await client.query(
      `
      UPDATE hallazgos
      SET estado = $2
      WHERE id = $1
      RETURNING id, auditoria_id, estado
    `,
      [hallazgoId, nuevoEstado],
    );

    let auditoriaCerrada = false;

    if (
      decision === "aceptar" &&
      hallazgo.auditoria_estado === "en_seguimiento"
    ) {
      const { rows: pendientes } = await client.query(
        `
        SELECT id
        FROM hallazgos
        WHERE auditoria_id = $1 AND estado <> 'cerrado'
        LIMIT 1
      `,
        [auditoriaId],
      );

      if (!pendientes[0]) {
        const { rows: cierres } = await client.query(
          `
          UPDATE auditorias
          SET estado = 'cerrada',
              cerrada_en = NOW(),
              cerrada_por = $2
          WHERE id = $1 AND estado = 'en_seguimiento'
          RETURNING id
        `,
          [auditoriaId, usuarioId],
        );

        auditoriaCerrada = !!cierres[0];
      }
    }

    await client.query("COMMIT");
    return { ...rows[0], auditoria_cerrada: auditoriaCerrada };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
