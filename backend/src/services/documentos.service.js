import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

import { pool } from "../config/db.js";

const DIRECTORIO_RAIZ = process.env.STORAGE_DIR || "/app/storage";
const DIRECTORIO_ORIGINALES = path.join(DIRECTORIO_RAIZ, "originales");
const DIRECTORIO_PDF = path.join(DIRECTORIO_RAIZ, "pdf");
const DIRECTORIO_COPIAS_CONTROLADAS = path.join(
    DIRECTORIO_PDF,
    "copias-controladas",
);

const EXTENSIONES_OFFICE = new Set([
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
]);

const EXTENSIONES_IMAGEN = new Set([".png", ".jpg", ".jpeg"]);

function crearError(mensaje, status = 500) {
    const error = new Error(mensaje);
    error.status = status;
    error.publico = mensaje;
    return error;
}

function obtenerPrefijoDocumento(nombreTipo, origen) {
    if (origen === "externo") return "DE";

    const nombreNormalizado = String(nombreTipo || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLocaleLowerCase("es");

    const prefijos = new Map([
        ["manual de calidad", "MAN"],
        ["procedimiento de trabajo", "PRO"],
        ["registro", "REC"],
        ["ayuda visual", "AVI"],
        ["apoyo visual", "AVI"],
        ["instructivo", "INS"],
        ["politica", "POL"],
        ["politica de calidad", "POL"],
        ["documento externo", "DE"],
    ]);

    const prefijo =
        prefijos.get(nombreNormalizado) ||
        nombreNormalizado
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 3)
            .toUpperCase();

    if (!prefijo) {
        throw crearError(
            "No se pudo determinar el prefijo del tipo de documento.",
            400,
        );
    }

    return prefijo;
}

async function generarCodigoDocumento(client, tipoDocumento, origen, proceso) {
    const prefijo = obtenerPrefijoDocumento(tipoDocumento.nombre, origen);
    const resultadoSecuencia = await client.query(
        `INSERT INTO documento_codigo_secuencias (
            prefijo,
            codigo_area,
            codigo_proceso,
            ultimo_numero
        )
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (prefijo, codigo_area, codigo_proceso)
        DO UPDATE SET ultimo_numero = documento_codigo_secuencias.ultimo_numero + 1
        RETURNING ultimo_numero`,
        [prefijo, proceso.codigo_area, proceso.codigo_proceso],
    );

    const numero = String(resultadoSecuencia.rows[0].ultimo_numero).padStart(
        2,
        "0",
    );
    return `${prefijo}-${proceso.codigo_area}-${numero}-${proceso.codigo_proceso}`;
}

async function validarParticipante(
    client,
    usuarioId,
    rolEsperado,
    obligatorio = false,
) {
    if (usuarioId === null || usuarioId === undefined) {
        if (obligatorio) {
            throw crearError(`Debes seleccionar un ${rolEsperado}.`, 400);
        }

        return null;
    }

    const { rows } = await client.query(
        `SELECT u.id
     FROM usuarios u
     JOIN roles r
       ON r.id = u.rol_id
     WHERE u.id = $1
       AND u.activo = TRUE
       AND r.clave = $2`,
        [usuarioId, rolEsperado],
    );

    if (!rows[0]) {
        throw crearError(
            `El usuario seleccionado no es un ${rolEsperado} activo.`,
            400,
        );
    }

    return rows[0].id;
}

async function prepararDirectorios() {
    await Promise.all([
        mkdir(DIRECTORIO_ORIGINALES, { recursive: true }),
        mkdir(DIRECTORIO_PDF, { recursive: true }),
        mkdir(DIRECTORIO_COPIAS_CONTROLADAS, { recursive: true }),
    ]);
}

function ajustarTextoPdf(fuente, texto, tamano, anchoMaximo) {
    let resultado = String(texto || "");

    while (
        resultado.length > 1 &&
        fuente.widthOfTextAtSize(resultado, tamano) > anchoMaximo
    ) {
        resultado = resultado.slice(0, -1);
    }

    return resultado === texto ? resultado : `${resultado.slice(0, -3)}...`;
}

async function generarPdfCopiaControlada({
    archivoPdfUrl,
    folio,
    codigo,
    version,
    destinatarioNombre,
    fechaVigenciaTexto,
}) {
    await prepararDirectorios();

    const archivoOrigen = await readFile(resolverRutaSegura(archivoPdfUrl));
    const pdf = await PDFDocument.load(archivoOrigen);
    const fuente = await pdf.embedFont(StandardFonts.Helvetica);
    const fuenteNegrita = await pdf.embedFont(StandardFonts.HelveticaBold);

    for (const pagina of pdf.getPages()) {
        const { width, height } = pagina.getSize();
        const marca = "COPIA CONTROLADA";
        const tamanoMarca = Math.max(28, Math.min(54, width / 9));
        const anchoMarca = fuenteNegrita.widthOfTextAtSize(marca, tamanoMarca);
        const anguloMarca = 35;
        const radianesMarca = (anguloMarca * Math.PI) / 180;
        const desplazamientoCentroX =
            (Math.cos(radianesMarca) * anchoMarca) / 2 -
            (Math.sin(radianesMarca) * tamanoMarca) / 2;
        const desplazamientoCentroY =
            (Math.sin(radianesMarca) * anchoMarca) / 2 +
            (Math.cos(radianesMarca) * tamanoMarca) / 2;

        pagina.drawText(marca, {
            x: width / 2 - desplazamientoCentroX,
            y: height / 2 - desplazamientoCentroY,
            size: tamanoMarca,
            font: fuenteNegrita,
            color: rgb(0.05, 0.38, 0.2),
            opacity: 0.12,
            rotate: degrees(anguloMarca),
        });

        pagina.drawRectangle({
            x: 0,
            y: 0,
            width,
            height: 30,
            color: rgb(1, 1, 1),
            opacity: 0.92,
        });

        pagina.drawLine({
            start: { x: 18, y: 29 },
            end: { x: width - 18, y: 29 },
            thickness: 0.8,
            color: rgb(0.05, 0.38, 0.2),
        });

        pagina.drawText(`${folio} · ${codigo} · v${version}`, {
            x: 18,
            y: 17,
            size: 8,
            font: fuenteNegrita,
            color: rgb(0.05, 0.38, 0.2),
        });

        const datosEntrega = ajustarTextoPdf(
            fuente,
            `Entregada a: ${destinatarioNombre} · Vigencia: ${fechaVigenciaTexto}`,
            7.5,
            width - 36,
        );

        pagina.drawText(datosEntrega, {
            x: 18,
            y: 7,
            size: 7.5,
            font: fuente,
            color: rgb(0.16, 0.22, 0.19),
        });
    }

    const nombreArchivo = `${randomUUID()}.pdf`;
    const rutaRelativa = path.posix.join(
        "pdf",
        "copias-controladas",
        nombreArchivo,
    );

    await writeFile(resolverRutaSegura(rutaRelativa), await pdf.save());

    return rutaRelativa;
}

function calcularHash(buffer) {
    return createHash("sha256").update(buffer).digest("hex");
}

function crearNombreSeguro(extension) {
    return `${randomUUID()}${extension}`;
}

function resolverRutaSegura(rutaRelativa) {
    const raizAbsoluta = path.resolve(DIRECTORIO_RAIZ);
    const rutaAbsoluta = path.resolve(DIRECTORIO_RAIZ, rutaRelativa);

    if (
        rutaAbsoluta !== raizAbsoluta &&
        !rutaAbsoluta.startsWith(`${raizAbsoluta}${path.sep}`)
    ) {
        throw crearError("La ruta del archivo no es válida.", 400);
    }

    return rutaAbsoluta;
}

async function convertirOfficeAPdf(archivo) {
    const gotenbergUrl = process.env.GOTENBERG_URL;

    if (!gotenbergUrl) {
        throw crearError(
            "El servicio de conversión de documentos no está configurado.",
            503,
        );
    }

    const formulario = new FormData();

    formulario.append(
        "files",
        new Blob([archivo.buffer], { type: archivo.mimetype }),
        archivo.originalname,
    );

    let respuesta;

    try {
        respuesta = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
            method: "POST",
            body: formulario,
            signal: AbortSignal.timeout(120000),
        });
    } catch (error) {
        console.error("No fue posible comunicarse con Gotenberg:", error);
        throw crearError("El servicio de conversión no está disponible.", 503);
    }

    if (!respuesta.ok) {
        const detalle = await respuesta.text();

        console.error(`Gotenberg respondió ${respuesta.status}: ${detalle}`);

        throw crearError("No se pudo convertir el documento a PDF.", 422);
    }

    return Buffer.from(await respuesta.arrayBuffer());
}

async function convertirImagenAPdf(archivo, extension) {
    const gotenbergUrl = process.env.GOTENBERG_URL;

    if (!gotenbergUrl) {
        throw crearError(
            "El servicio de conversión de documentos no está configurado.",
            503,
        );
    }

    const nombreImagen = `imagen${extension}`;

    const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }

          html,
          body {
            height: 100%;
            margin: 0;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${nombreImagen}" alt="Documento convertido">
      </body>
    </html>
  `;

    const formulario = new FormData();

    formulario.append(
        "files",
        new Blob([html], { type: "text/html" }),
        "index.html",
    );

    formulario.append(
        "files",
        new Blob([archivo.buffer], { type: archivo.mimetype }),
        nombreImagen,
    );

    let respuesta;

    try {
        respuesta = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
            method: "POST",
            body: formulario,
            signal: AbortSignal.timeout(120000),
        });
    } catch (error) {
        console.error("No fue posible comunicarse con Gotenberg:", error);
        throw crearError("El servicio de conversión no está disponible.", 503);
    }

    if (!respuesta.ok) {
        const detalle = await respuesta.text();

        console.error(`Gotenberg respondió ${respuesta.status}: ${detalle}`);

        throw crearError("No se pudo convertir la imagen a PDF.", 422);
    }

    return Buffer.from(await respuesta.arrayBuffer());
}

export async function guardarArchivoDocumento(archivo) {
    if (!archivo?.buffer) {
        throw crearError("Debes seleccionar un archivo.", 400);
    }

    const extension = path.extname(archivo.originalname).toLowerCase();

    const esPdf = extension === ".pdf";
    const esOffice = EXTENSIONES_OFFICE.has(extension);
    const esImagen = EXTENSIONES_IMAGEN.has(extension);

    if (!esPdf && !esOffice && !esImagen) {
        throw crearError("El formato del archivo no está permitido.", 400);
    }

    await prepararDirectorios();

    const nombreOriginalSeguro = crearNombreSeguro(extension);
    const identificador = path.parse(nombreOriginalSeguro).name;
    const nombrePdf = `${identificador}.pdf`;

    const rutaOriginalRelativa = path.posix.join(
        "originales",
        nombreOriginalSeguro,
    );

    const rutaPdfRelativa = esPdf
        ? rutaOriginalRelativa
        : path.posix.join("pdf", nombrePdf);

    const rutaOriginalAbsoluta = path.join(
        DIRECTORIO_RAIZ,
        rutaOriginalRelativa,
    );

    await writeFile(rutaOriginalAbsoluta, archivo.buffer);

    let estadoConversion = "no_requerida";
    let errorConversion = null;

    if (!esPdf) {
        try {
            const pdfBuffer = esOffice
                ? await convertirOfficeAPdf(archivo)
                : await convertirImagenAPdf(archivo, extension);

            await writeFile(
                path.join(DIRECTORIO_RAIZ, rutaPdfRelativa),
                pdfBuffer,
            );

            estadoConversion = "completada";
        } catch (error) {
            estadoConversion = "error";
            errorConversion =
                error.publico || "No se pudo generar el archivo PDF.";
        }
    }

    return {
        archivoOriginalUrl: rutaOriginalRelativa,
        archivoPdfUrl: estadoConversion === "error" ? null : rutaPdfRelativa,
        nombreOriginal: path.basename(archivo.originalname),
        tipoMime: archivo.mimetype,
        extensionOriginal: extension,
        tamanoBytes: archivo.size,
        hashSha256: calcularHash(archivo.buffer),
        estadoConversion,
        errorConversion,
    };
}

async function eliminarArchivoSiExiste(rutaRelativa) {
    if (!rutaRelativa) {
        return;
    }

    try {
        await unlink(path.join(DIRECTORIO_RAIZ, rutaRelativa));
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                `No se pudo limpiar el archivo ${rutaRelativa}:`,
                error,
            );
        }
    }
}

export async function limpiarArchivosGuardados(datosArchivo) {
    const rutas = new Set([
        datosArchivo.archivoOriginalUrl,
        datosArchivo.archivoPdfUrl,
    ]);

    await Promise.all([...rutas].map((ruta) => eliminarArchivoSiExiste(ruta)));
}

export async function crearDocumentoConArchivo({
    nombre,
    tipoDocumentoId,
    origen,
    procesoId,
    version,
    elaboradorId,
    creadoPorId,
    justificacion,
    revisionProgramada,
    revisionCadaMeses,
    proximaRevision,
    normaIds,
    documentosRelacionadosIds,
    registroConfig,
    archivo,
}) {
    const datosArchivo = await guardarArchivoDocumento(archivo);

    let client;
    let transaccionIniciada = false;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transaccionIniciada = true;

        const resultadoTipo = await client.query(
            `SELECT
                id,
                nombre
            FROM tipos_documento
            WHERE id = $1
              AND activo = TRUE`,
            [tipoDocumentoId],
        );

        const tipoDocumento = resultadoTipo.rows[0];

        if (!tipoDocumento) {
            throw crearError(
                "El tipo de documento seleccionado no está disponible.",
                400,
            );
        }

        if (procesoId === null) {
            throw crearError(
                "Debes seleccionar el proceso del documento.",
                400,
            );
        }

        const resultadoProceso = await client.query(
            `SELECT id, codigo_area, codigo_proceso
            FROM procesos
            WHERE id = $1
              AND estatus = 'activo'`,
            [procesoId],
        );

        const proceso = resultadoProceso.rows[0];

        if (!proceso) {
            throw crearError(
                "El proceso seleccionado no está disponible.",
                400,
            );
        }

        const resultadoElaborador = await client.query(
            `SELECT id
            FROM usuarios
            WHERE id = $1
              AND activo = TRUE`,
            [elaboradorId],
        );

        if (!resultadoElaborador.rows[0]) {
            throw crearError(
                "El elaborador seleccionado no está disponible.",
                400,
            );
        }

        const nombreTipo = String(tipoDocumento.nombre || "")
            .trim()
            .toLocaleLowerCase("es");

        const codigo = await generarCodigoDocumento(
            client,
            tipoDocumento,
            origen,
            proceso,
        );

        const esRegistro = origen === "interno" && nombreTipo === "registro";

        const protegerImpresion = !esRegistro;

        const permiteDescargaOriginal = esRegistro || origen === "externo";

        if (esRegistro) {
            const camposRegistro = [
                registroConfig.dondeConserva,
                registroConfig.quienConserva,
                registroConfig.frecuenciaUso,
                registroConfig.almacenamientoProteccion,
                registroConfig.tiempoRetencion,
                registroConfig.disposicionFinal,
            ];

            if (camposRegistro.some((valor) => !String(valor || "").trim())) {
                throw crearError(
                    "Completa los seis datos de conservación del Registro.",
                    400,
                );
            }

            if (
                registroConfig.dondeConserva.length > 255 ||
                registroConfig.quienConserva.length > 255 ||
                registroConfig.frecuenciaUso.length > 160 ||
                registroConfig.tiempoRetencion.length > 160
            ) {
                throw crearError(
                    "Uno de los datos del Registro supera la longitud permitida.",
                    400,
                );
            }
        }

        if (!esRegistro) {
            const contieneDatosRegistro = Object.values(registroConfig).some(
                (valor) => Boolean(String(valor || "").trim()),
            );

            if (contieneDatosRegistro) {
                throw crearError(
                    "La configuración de conservación solo corresponde a documentos de tipo Registro.",
                    400,
                );
            }
        }

        if (normaIds.length > 0) {
            const resultadoNormas = await client.query(
                `SELECT id
                FROM normas
                WHERE id = ANY($1::integer[])
                  AND activo = TRUE`,
                [normaIds],
            );

            if (resultadoNormas.rows.length !== normaIds.length) {
                throw crearError(
                    "Una de las normas seleccionadas no está disponible.",
                    400,
                );
            }
        }

        if (documentosRelacionadosIds.length > 0) {
            const resultadoRelacionados = await client.query(
                `SELECT id
                    FROM documentos
                    WHERE id = ANY($1::integer[])
                      AND activo = TRUE`,
                [documentosRelacionadosIds],
            );

            if (
                resultadoRelacionados.rows.length !==
                documentosRelacionadosIds.length
            ) {
                throw crearError(
                    "Uno de los documentos relacionados no está disponible.",
                    400,
                );
            }
        }

        const { rows: documentosRepetidos } = await client.query(
            `SELECT codigo
               FROM documentos
              WHERE proceso_id = $1
                AND LOWER(TRIM(nombre)) = LOWER(TRIM($2))
                AND estado IN ('borrador', 'en_revision', 'vigente')
              LIMIT 1`,
            [procesoId, nombre],
        );

        if (documentosRepetidos[0]) {
            throw crearError(
                `Ya existe un documento con el nombre "${nombre}" en este proceso ` +
                    `(${documentosRepetidos[0].codigo || "código pendiente"}). ` +
                    "Usa otro nombre o da de baja el documento anterior.",
                409,
            );
        }

        const resultadoDocumento = await client.query(
            `INSERT INTO documentos (
                codigo,
                nombre,
                tipo_documento_id,
                origen,
                estado,
                elaborador_id,
                proceso_id,
                justificacion,
                proteger_impresion,
                permite_descarga_original,
                revision_programada,
                revision_cada_meses,
                proxima_revision
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'borrador',
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12
            )
            RETURNING *`,
            [
                codigo,
                nombre,
                tipoDocumentoId,
                origen,
                elaboradorId,
                procesoId,
                justificacion,
                protegerImpresion,
                permiteDescargaOriginal,
                revisionProgramada,
                revisionCadaMeses,
                proximaRevision,
            ],
        );

        const documento = resultadoDocumento.rows[0];

        const resultadoVersion = await client.query(
            `INSERT INTO documento_versiones (
                documento_id,
                version,
                archivo_original_url,
                archivo_pdf_url,
                nombre_original,
                tipo_mime,
                extension_original,
                tamano_bytes,
                hash_sha256,
                creado_por,
                estado_conversion,
                error_conversion,
                vigente
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                FALSE
            )
            RETURNING *`,
            [
                documento.id,
                version,
                datosArchivo.archivoOriginalUrl,
                datosArchivo.archivoPdfUrl,
                datosArchivo.nombreOriginal,
                datosArchivo.tipoMime,
                datosArchivo.extensionOriginal,
                datosArchivo.tamanoBytes,
                datosArchivo.hashSha256,
                creadoPorId,
                datosArchivo.estadoConversion,
                datosArchivo.errorConversion,
            ],
        );

        if (normaIds.length > 0) {
            await client.query(
                `INSERT INTO documento_normas (
                    documento_id,
                    norma_id
                )
                SELECT
                    $1,
                    norma_id
                FROM UNNEST($2::integer[]) AS norma_id`,
                [documento.id, normaIds],
            );
        }

        if (documentosRelacionadosIds.length > 0) {
            await client.query(
                `INSERT INTO documentos_relacionados (
                    documento_id,
                    documento_relacionado_id
                )
                SELECT
                    $1,
                    documento_relacionado_id
                FROM UNNEST(
                    $2::integer[]
                ) AS documento_relacionado_id`,
                [documento.id, documentosRelacionadosIds],
            );
        }

        if (esRegistro) {
            await client.query(
                `INSERT INTO documento_registro_config (
                    documento_id,
                    donde_conserva,
                    quien_conserva,
                    frecuencia_uso,
                    almacenamiento_proteccion,
                    tiempo_retencion,
                    disposicion_final
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )`,
                [
                    documento.id,
                    registroConfig.dondeConserva,
                    registroConfig.quienConserva,
                    registroConfig.frecuenciaUso,
                    registroConfig.almacenamientoProteccion,
                    registroConfig.tiempoRetencion,
                    registroConfig.disposicionFinal,
                ],
            );
        }

        await client.query("COMMIT");
        transaccionIniciada = false;

        return {
            ...documento,
            tipo: tipoDocumento.nombre,
            version_actual: resultadoVersion.rows[0],
            registro_config: esRegistro ? registroConfig : null,
        };
    } catch (error) {
        if (client && transaccionIniciada) {
            await client.query("ROLLBACK");
        }

        await limpiarArchivosGuardados(datosArchivo);

        if (
            error.code === "23505" &&
            error.constraint === "documentos_codigo_key"
        ) {
            throw crearError("Ya existe un documento con ese código.", 409);
        }

        throw error;
    } finally {
        client?.release();
    }
}

export async function listarTiposDocumento() {
    const { rows } = await pool.query(
        `SELECT
            id,
            nombre
            FROM tipos_documento
            WHERE activo = TRUE
            ORDER BY nombre`,
    );

    return rows;
}

export async function esDocumentoRegistro(documentoId) {
    const { rows } = await pool.query(
        `SELECT 1
         FROM documentos d
         JOIN tipos_documento td
           ON td.id = d.tipo_documento_id
         WHERE d.id = $1
           AND LOWER(BTRIM(td.nombre)) = 'registro'`,
        [documentoId],
    );

    return Boolean(rows[0]);
}

export async function listarNormasDocumento() {
    const { rows } = await pool.query(
        `SELECT
            id,
            codigo,
            nombre
        FROM normas
        WHERE activo = TRUE
        ORDER BY codigo, nombre`,
    );

    return rows;
}

export async function listarDocumentosControl() {
    const { rows } = await pool.query(
        `SELECT
       d.id,
       COALESCE(d.codigo, 'Pendiente') AS codigo,
       d.nombre,
       d.origen,
       d.estado,
        d.creado_en,
        d.revision_programada,
        d.revision_cada_meses,
        d.proxima_revision,
        td.nombre AS tipo,
       p.nombre AS proceso,
       u.nombre AS elaborador,
       dv.id AS version_id,
        dv.version,
        dv.nombre_original,
        dv.estado_conversion,
        dv.creado_en AS version_creada_en,
        (
        SELECT solicitud.estado
        FROM solicitudes solicitud
        WHERE solicitud.documento_id = d.id
            AND solicitud.version_documento_id = dv.id
        ORDER BY solicitud.id DESC
        LIMIT 1
        ) AS solicitud_estado
     FROM documentos d
     JOIN tipos_documento td
       ON td.id = d.tipo_documento_id
     JOIN usuarios u
       ON u.id = d.elaborador_id
     LEFT JOIN procesos p
       ON p.id = d.proceso_id
     LEFT JOIN LATERAL (
       SELECT
         version_documento.id,
         version_documento.version,
         version_documento.nombre_original,
         version_documento.estado_conversion,
         version_documento.creado_en
       FROM documento_versiones version_documento
       WHERE version_documento.documento_id = d.id
       ORDER BY
         version_documento.creado_en DESC,
         version_documento.id DESC
       LIMIT 1
     ) dv ON TRUE
     ORDER BY d.creado_en DESC, d.id DESC`,
    );

    return rows;
}

export async function listarReporteDocumental() {
    const { rows } = await pool.query(
        `SELECT
            documento.id,
            COALESCE(documento.codigo, 'Pendiente') AS codigo,
            documento.nombre,
            documento.estado,
            documento.origen,
            documento.revision_programada,
            documento.proxima_revision,
            tipo.nombre AS tipo,
            proceso.nombre AS proceso,
            version.id AS version_id,
            version.version,
            version.estado_conversion,
            solicitud.id AS solicitud_id,
            solicitud.estado AS solicitud_estado,
            solicitud.tipo AS solicitud_tipo,
            solicitud.actualizado_en AS solicitud_actualizada_en,
            historial.comentario AS ultimo_comentario,
            historial.creado_en AS comentario_creado_en,
            historial.actor AS comentario_actor,
            COALESCE(copias.activas, 0)::integer AS copias_activas,
            COALESCE(copias.requieren_retiro, 0)::integer
                AS copias_requieren_retiro
        FROM documentos documento
        JOIN tipos_documento tipo
            ON tipo.id = documento.tipo_documento_id
        LEFT JOIN procesos proceso
            ON proceso.id = documento.proceso_id
        LEFT JOIN LATERAL (
            SELECT
                version_documento.id,
                version_documento.version,
                version_documento.estado_conversion
            FROM documento_versiones version_documento
            WHERE version_documento.documento_id = documento.id
            ORDER BY
                version_documento.creado_en DESC,
                version_documento.id DESC
            LIMIT 1
        ) version ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                solicitud_actual.id,
                solicitud_actual.estado,
                tipo_solicitud.nombre AS tipo,
                solicitud_actual.actualizado_en
            FROM solicitudes solicitud_actual
            JOIN tipos_solicitud tipo_solicitud
                ON tipo_solicitud.id = solicitud_actual.tipo_solicitud_id
            WHERE solicitud_actual.documento_id = documento.id
            ORDER BY
                solicitud_actual.actualizado_en DESC,
                solicitud_actual.id DESC
            LIMIT 1
        ) solicitud ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                solicitud_historial.comentario,
                solicitud_historial.creado_en,
                usuario.nombre AS actor
            FROM solicitud_historial
            LEFT JOIN usuarios usuario
                ON usuario.id = solicitud_historial.actor_id
            WHERE solicitud_historial.solicitud_id = solicitud.id
                AND NULLIF(TRIM(solicitud_historial.comentario), '')
                    IS NOT NULL
            ORDER BY
                solicitud_historial.creado_en DESC,
                solicitud_historial.id DESC
            LIMIT 1
        ) historial ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*) FILTER (
                    WHERE copia.estado = 'activa'
                ) AS activas,
                COUNT(*) FILTER (
                    WHERE copia.estado = 'requiere_retiro'
                ) AS requieren_retiro
            FROM copias_controladas copia
            WHERE copia.documento_id = documento.id
        ) copias ON TRUE
        ORDER BY documento.creado_en DESC, documento.id DESC`,
    );

    return rows;
}

export async function listarHistorialRevisiones(documentoId) {
    const { rows } = await pool.query(
        `SELECT
            revision.id,
            revision.resultado,
            revision.comentario,
            revision.proxima_revision_anterior,
            revision.proxima_revision_nueva,
            revision.creado_en,
            usuario.nombre AS revisado_por,
            version.version
        FROM documento_revisiones_programadas revision
        JOIN usuarios usuario
            ON usuario.id = revision.revisado_por
        JOIN documento_versiones version
            ON version.id =
                revision.version_documento_id
        WHERE revision.documento_id = $1
        ORDER BY
            revision.creado_en DESC,
            revision.id DESC`,
        [documentoId],
    );

    return rows;
}

export async function listarHistorialVersiones(documentoId) {
    const documento = await pool.query(
        `SELECT id
        FROM documentos
        WHERE id = $1`,
        [documentoId],
    );

    if (!documento.rows[0]) {
        throw crearError("El documento no existe.", 404);
    }

    const { rows } = await pool.query(
        `SELECT
            version.id,
            version.version,
            version.creado_en,
            version.estado_conversion,
            version.vigente,
            version.archivo_pdf_url IS NOT NULL AS pdf_disponible,
            usuario.nombre AS subido_por,
            (
                SELECT solicitud.estado
                FROM solicitudes solicitud
                WHERE solicitud.documento_id = documento.id
                  AND solicitud.version_documento_id = version.id
                ORDER BY solicitud.id DESC
                LIMIT 1
            ) AS estado_solicitud
        FROM documentos documento
        JOIN documento_versiones version
          ON version.documento_id = documento.id
        LEFT JOIN usuarios usuario
          ON usuario.id = version.creado_por
        WHERE documento.id = $1
        ORDER BY version.creado_en DESC, version.id DESC`,
        [documentoId],
    );

    return rows;
}

export async function confirmarRevisionProgramada({
    documentoId,
    usuarioId,
    comentario,
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `SELECT
                d.id,
                d.estado,
                d.revision_programada,
                d.revision_cada_meses,
                d.proxima_revision,
                version_actual.id AS version_documento_id,
                (
                    d.proxima_revision <=
                    (
                        CURRENT_TIMESTAMP AT TIME ZONE
                        'America/Mexico_City'
                    )::date + INTERVAL '30 days'
                ) AS disponible
            FROM documentos d
            JOIN LATERAL (
                SELECT version.id
                FROM documento_versiones version
                WHERE version.documento_id = d.id
                    AND version.vigente = TRUE
                ORDER BY
                    version.creado_en DESC,
                    version.id DESC
                LIMIT 1
            ) version_actual
                ON TRUE
            WHERE d.id = $1
            FOR UPDATE OF d`,
            [documentoId],
        );

        const documento = rows[0];

        if (!documento) {
            throw crearError(
                "El documento no existe o no tiene una versión vigente.",
                404,
            );
        }

        if (documento.estado !== "vigente") {
            throw crearError(
                "El documento debe estar vigente para completar su revisión.",
                409,
            );
        }

        if (
            !documento.revision_programada ||
            !documento.proxima_revision ||
            !documento.revision_cada_meses
        ) {
            throw crearError(
                "El documento no tiene una revisión programada válida.",
                409,
            );
        }

        if (!documento.disponible) {
            throw crearError(
                "La revisión todavía no está dentro del periodo de 30 días.",
                409,
            );
        }

        const resultadoFecha = await client.query(
            `SELECT (
                (
                    CURRENT_TIMESTAMP AT TIME ZONE
                    'America/Mexico_City'
                )::date +
                make_interval(months => $1)
            )::date AS proxima_revision`,
            [documento.revision_cada_meses],
        );

        const proximaRevision = resultadoFecha.rows[0].proxima_revision;

        const resultadoHistorial = await client.query(
            `INSERT INTO documento_revisiones_programadas (
                documento_id,
                version_documento_id,
                revisado_por,
                resultado,
                comentario,
                proxima_revision_anterior,
                proxima_revision_nueva
            )
            VALUES (
                $1,
                $2,
                $3,
                'sin_cambios',
                $4,
                $5,
                $6
            )
            RETURNING *`,
            [
                documento.id,
                documento.version_documento_id,
                usuarioId,
                comentario || null,
                documento.proxima_revision,
                proximaRevision,
            ],
        );

        await client.query(
            `UPDATE documentos
            SET proxima_revision = $1
            WHERE id = $2`,
            [proximaRevision, documento.id],
        );

        await client.query("COMMIT");

        return resultadoHistorial.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function listarCopiasControladas(documentoId) {
    const { rows } = await pool.query(
        `SELECT
            copia.id,
            copia.folio,
            copia.destinatario_nombre,
            copia.comentarios,
            copia.fecha_vigencia,
            copia.estado,
            copia.creada_en,
            copia.entregada_en,
            copia.recibida_por_nombre,
            copia.observaciones_entrega,
            copia.retirada_en,
            copia.motivo_retiro,
            copia.archivo_pdf_url,
            documento.codigo,
            documento.nombre AS documento_nombre,
            version.version,
            creador.nombre AS creada_por,
            entregador.nombre AS entregada_por,
            retirador.nombre AS retirada_por
        FROM copias_controladas copia
        JOIN documentos documento
            ON documento.id = copia.documento_id
        JOIN documento_versiones version
            ON version.id = copia.version_documento_id
        JOIN usuarios creador
            ON creador.id = copia.creada_por
        LEFT JOIN usuarios entregador
            ON entregador.id = copia.entregada_por
        LEFT JOIN usuarios retirador
            ON retirador.id = copia.retirada_por
        WHERE copia.documento_id = $1
        ORDER BY copia.creada_en DESC, copia.id DESC`,
        [documentoId],
    );

    return rows;
}

export async function crearCopiaControlada({
    documentoId,
    usuarioId,
    destinatarioNombre,
    comentarios,
    versionDocumentoIdEsperada = null,
    clienteExterno = null,
}) {
    const client = clienteExterno || (await pool.connect());
    let archivoCopiaUrl = null;

    try {
        if (!clienteExterno) await client.query("BEGIN");

        const { rows } = await client.query(
            `SELECT
                documento.id,
                documento.codigo,
                documento.nombre,
                version.id AS version_documento_id,
                version.version,
                version.archivo_pdf_url
            FROM documentos documento
            JOIN LATERAL (
                SELECT
                    version_actual.id,
                    version_actual.version,
                    version_actual.archivo_pdf_url
                FROM documento_versiones version_actual
                WHERE version_actual.documento_id = documento.id
                    AND version_actual.vigente = TRUE
                ORDER BY
                    version_actual.creado_en DESC,
                    version_actual.id DESC
                LIMIT 1
            ) version
                ON TRUE
            WHERE documento.id = $1
                AND documento.estado = 'vigente'
            FOR UPDATE OF documento`,
            [documentoId],
        );

        const documento = rows[0];

        if (!documento) {
            throw crearError(
                "El documento no existe o todavía no tiene una versión vigente.",
                404,
            );
        }

        if (
            versionDocumentoIdEsperada !== null &&
            documento.version_documento_id !== versionDocumentoIdEsperada
        ) {
            throw crearError(
                "La versión del documento cambió. Solicita una copia de la versión vigente.",
                409,
            );
        }

        if (!documento.archivo_pdf_url) {
            throw crearError(
                "La versión vigente todavía no tiene un PDF disponible.",
                409,
            );
        }

        const resultadoFolio = await client.query(
            `SELECT
                nextval('copias_controladas_folio_seq') AS numero,
                EXTRACT(
                    YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE
                    'America/Mexico_City'
                )::integer AS anio,
                (
                    CURRENT_TIMESTAMP AT TIME ZONE
                    'America/Mexico_City'
                )::date AS fecha_vigencia,
                TO_CHAR(
                    CURRENT_TIMESTAMP AT TIME ZONE
                    'America/Mexico_City',
                    'DD/MM/YYYY'
                ) AS fecha_vigencia_texto`,
        );

        const {
            numero,
            anio,
            fecha_vigencia: fechaVigencia,
            fecha_vigencia_texto: fechaVigenciaTexto,
        } = resultadoFolio.rows[0];
        const folio = `CC-${anio}-${String(numero).padStart(6, "0")}`;

        archivoCopiaUrl = await generarPdfCopiaControlada({
            archivoPdfUrl: documento.archivo_pdf_url,
            folio,
            codigo: documento.codigo,
            version: documento.version,
            destinatarioNombre,
            fechaVigenciaTexto,
        });

        const resultadoCopia = await client.query(
            `INSERT INTO copias_controladas (
                folio,
                documento_id,
                version_documento_id,
                destinatario_nombre,
                comentarios,
                fecha_vigencia,
                creada_por,
                archivo_pdf_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                folio,
                documento.id,
                documento.version_documento_id,
                destinatarioNombre,
                comentarios || null,
                fechaVigencia,
                usuarioId,
                archivoCopiaUrl,
            ],
        );

        if (!clienteExterno) await client.query("COMMIT");

        return {
            ...resultadoCopia.rows[0],
            codigo: documento.codigo,
            documento_nombre: documento.nombre,
            version: documento.version,
        };
    } catch (error) {
        if (!clienteExterno) await client.query("ROLLBACK");

        if (archivoCopiaUrl) {
            await eliminarArchivoSiExiste(archivoCopiaUrl);
        }

        throw error;
    } finally {
        if (!clienteExterno) client.release();
    }
}

export async function eliminarPdfCopiaControlada(rutaRelativa) {
    if (rutaRelativa) await eliminarArchivoSiExiste(rutaRelativa);
}

export async function confirmarEntregaCopiaControlada({
    documentoId,
    copiaId,
    usuarioId,
    recibidaPorNombre,
    observaciones,
}) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows: documentos } = await client.query(
            `SELECT estado FROM documentos WHERE id = $1 FOR UPDATE`,
            [documentoId],
        );
        if (!documentos[0]) throw crearError("El documento no existe.", 404);
        const { rows } = await client.query(
            `SELECT copia.id, copia.estado, version.vigente AS version_vigente
            FROM copias_controladas copia
            JOIN documento_versiones version ON version.id = copia.version_documento_id
            WHERE copia.id = $1 AND copia.documento_id = $2
            FOR UPDATE OF copia`,
            [copiaId, documentoId],
        );
        const copia = rows[0];
        if (!copia) throw crearError("La copia controlada no existe.", 404);
        if (copia.estado !== "pendiente_entrega") {
            throw crearError("Esta copia no está pendiente de entrega.", 409);
        }
        if (documentos[0].estado !== "vigente" || !copia.version_vigente) {
            throw crearError(
                "El documento cambió o dejó de estar vigente. No entregues esta copia.",
                409,
            );
        }
        const resultado = await client.query(
            `UPDATE copias_controladas SET estado = 'activa',
                entregada_por = $1, entregada_en = NOW(),
                recibida_por_nombre = $2, observaciones_entrega = $3
            WHERE id = $4 RETURNING *`,
            [usuarioId, recibidaPorNombre, observaciones || null, copiaId],
        );
        await client.query("COMMIT");
        return resultado.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function generarPdfCopiaControladaExistente({
    documentoId,
    copiaId,
}) {
    const client = await pool.connect();
    let archivoCopiaUrl = null;

    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `SELECT
                copia.id,
                copia.folio,
                copia.destinatario_nombre,
                copia.fecha_vigencia,
                copia.archivo_pdf_url,
                documento.codigo,
                version.version,
                version.archivo_pdf_url AS archivo_version_url,
                TO_CHAR(copia.fecha_vigencia, 'DD/MM/YYYY')
                    AS fecha_vigencia_texto
            FROM copias_controladas copia
            JOIN documentos documento
                ON documento.id = copia.documento_id
            JOIN documento_versiones version
                ON version.id = copia.version_documento_id
            WHERE copia.id = $1
                AND copia.documento_id = $2
            FOR UPDATE OF copia`,
            [copiaId, documentoId],
        );

        const copia = rows[0];

        if (!copia) {
            throw crearError("La copia controlada no existe.", 404);
        }

        if (copia.archivo_pdf_url) {
            await client.query("COMMIT");
            return copia;
        }

        if (!copia.archivo_version_url) {
            throw crearError(
                "La versión utilizada no tiene un PDF disponible.",
                409,
            );
        }

        archivoCopiaUrl = await generarPdfCopiaControlada({
            archivoPdfUrl: copia.archivo_version_url,
            folio: copia.folio,
            codigo: copia.codigo,
            version: copia.version,
            destinatarioNombre: copia.destinatario_nombre,
            fechaVigenciaTexto: copia.fecha_vigencia_texto,
        });

        const resultado = await client.query(
            `UPDATE copias_controladas
            SET archivo_pdf_url = $1
            WHERE id = $2
            RETURNING *`,
            [archivoCopiaUrl, copia.id],
        );

        await client.query("COMMIT");

        return resultado.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");

        if (archivoCopiaUrl) {
            await eliminarArchivoSiExiste(archivoCopiaUrl);
        }

        throw error;
    } finally {
        client.release();
    }
}

export async function obtenerPdfCopiaControlada({ documentoId, copiaId }) {
    const { rows } = await pool.query(
        `SELECT
            copia.folio,
            copia.archivo_pdf_url
        FROM copias_controladas copia
        WHERE copia.id = $1
            AND copia.documento_id = $2`,
        [copiaId, documentoId],
    );

    const copia = rows[0];

    if (!copia) {
        throw crearError("La copia controlada no existe.", 404);
    }

    if (!copia.archivo_pdf_url) {
        throw crearError(
            "La copia controlada todavía no tiene un PDF disponible.",
            409,
        );
    }

    const rutaAbsoluta = resolverRutaSegura(copia.archivo_pdf_url);

    try {
        await access(rutaAbsoluta);
    } catch {
        throw crearError(
            "El archivo de la copia controlada no está disponible.",
            404,
        );
    }

    return {
        rutaAbsoluta,
        nombreDescarga: `${copia.folio}.pdf`,
    };
}

export async function retirarCopiaControlada({
    documentoId,
    copiaId,
    usuarioId,
    accion,
    comentario,
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `SELECT id, estado
            FROM copias_controladas
            WHERE id = $1
                AND documento_id = $2
            FOR UPDATE`,
            [copiaId, documentoId],
        );

        const copia = rows[0];

        if (!copia) {
            throw crearError("La copia controlada no existe.", 404);
        }

        if (copia.estado !== "requiere_retiro") {
            throw crearError(
                "La copia controlada no está pendiente de retiro.",
                409,
            );
        }

        const descripcionAccion =
            accion === "conservada_obsoleta"
                ? "Conservada e identificada físicamente como OBSOLETA."
                : "Retirada del punto de uso.";
        const motivoRetiro = comentario
            ? `${descripcionAccion} ${comentario}`
            : descripcionAccion;

        const resultado = await client.query(
            `UPDATE copias_controladas
            SET
                estado = 'retirada',
                retirada_por = $1,
                retirada_en = NOW(),
                motivo_retiro = $2
            WHERE id = $3
            RETURNING *`,
            [usuarioId, motivoRetiro, copia.id],
        );

        await client.query("COMMIT");

        return resultado.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function obtenerArchivoDocumento({
    documentoId,
    versionId,
    tipo,
    rol,
    usuarioId = null,
}) {
    if (!["original", "pdf"].includes(tipo)) {
        throw crearError("El tipo de descarga no es válido.", 400);
    }

    const { rows } = await pool.query(
        `SELECT
       d.estado,
       d.permite_descarga_original,
       dv.vigente AS version_vigente,
       dv.archivo_original_url,
       dv.archivo_pdf_url,
       dv.nombre_original,
       dv.tipo_mime,
       dv.estado_conversion,
       EXISTS (
         SELECT 1 FROM usuario_documentos_ocultos oculto
          WHERE oculto.usuario_id = $3
            AND oculto.documento_id = d.id
       ) AS oculto_para_usuario,
       EXISTS (
         SELECT 1 FROM usuario_permisos permiso
          WHERE permiso.usuario_id = $3
            AND permiso.permiso = 'visorDocumental.descargarOriginal'
       ) AS puede_descargar_original
     FROM documentos d
     JOIN documento_versiones dv
       ON dv.documento_id = d.id
     WHERE d.id = $1
       AND dv.id = $2`,
        [documentoId, versionId, usuarioId],
    );

    const registro = rows[0];

    if (!registro) {
        throw crearError("El documento o la versión no existen.", 404);
    }

    if (
        rol !== "admin_general" &&
        registro.version_vigente &&
        registro.oculto_para_usuario
    ) {
        throw crearError(
            "No tienes permiso para consultar este documento.",
            403,
        );
    }

    if (
        rol === "visor" &&
        (registro.estado !== "vigente" || !registro.version_vigente)
    ) {
        throw crearError("No tienes permiso para consultar esta versión.", 403);
    }

    if (
        rol !== "admin_general" &&
        tipo === "original" &&
        registro.version_vigente &&
        !registro.puede_descargar_original
    ) {
        throw crearError(
            "No tienes permiso para descargar el archivo original.",
            403,
        );
    }

    if (
        rol === "visor" &&
        tipo === "original" &&
        !registro.permite_descarga_original
    ) {
        throw crearError(
            "Este documento no permite la descarga en formato original.",
            403,
        );
    }

    const esPdf = tipo === "pdf";

    const rutaRelativa = esPdf
        ? registro.archivo_pdf_url
        : registro.archivo_original_url;

    if (!rutaRelativa) {
        throw crearError(
            esPdf
                ? "La versión PDF todavía no está disponible."
                : "El archivo original no está disponible.",
            409,
        );
    }

    const rutaAbsoluta = resolverRutaSegura(rutaRelativa);

    try {
        await access(rutaAbsoluta);
    } catch {
        throw crearError(
            "El archivo ya no está disponible en el almacenamiento.",
            404,
        );
    }

    const nombreOriginal = path
        .basename(registro.nombre_original || "documento")
        .replace(/[\r\n"]/g, "_");

    const nombreDescarga = esPdf
        ? `${path.parse(nombreOriginal).name}.pdf`
        : nombreOriginal;

    return {
        rutaAbsoluta,
        nombreDescarga,
        tipoMime: esPdf ? "application/pdf" : registro.tipo_mime,
    };
}

export async function listarDocumentosVisor({ usuarioId = null } = {}) {
    const { rows } = await pool.query(
        `SELECT
       d.id,
       d.codigo,
       d.nombre,
       d.origen,
       d.estado,
       td.id AS tipo_documento_id,
       td.nombre AS tipo,
       p.id AS proceso_id,
       p.nombre AS proceso,
       dv.id AS version_id,
       dv.version,
       dv.nombre_original
     FROM documentos d
     JOIN tipos_documento td
       ON td.id = d.tipo_documento_id
     LEFT JOIN procesos p
       ON p.id = d.proceso_id
     JOIN LATERAL (
       SELECT
         version_documento.id,
         version_documento.version,
         version_documento.nombre_original
       FROM documento_versiones version_documento
       WHERE version_documento.documento_id = d.id
         AND version_documento.vigente = TRUE
         AND version_documento.archivo_pdf_url IS NOT NULL
       ORDER BY
         version_documento.creado_en DESC,
         version_documento.id DESC
       LIMIT 1
     ) dv ON TRUE
     WHERE d.estado = 'vigente'
       AND (
         $1::int IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM usuario_documentos_ocultos oculto
            WHERE oculto.usuario_id = $1
              AND oculto.documento_id = d.id
         )
       )
     ORDER BY d.nombre`,
        [usuarioId],
    );

    return rows;
}

export async function listarParticipantesFlujo() {
    const { rows } = await pool.query(
        `SELECT
       u.id,
       u.nombre,
       u.correo,
       r.clave AS rol_clave,
       r.nombre AS rol
     FROM usuarios u
     JOIN roles r
       ON r.id = u.rol_id
     WHERE u.activo = TRUE
       AND r.clave IN (
         'responsable',
         'revisor',
         'aprobador'
       )
     ORDER BY r.nombre, u.nombre`,
    );

    return rows;
}

export async function enviarARevision({
    documentoId,
    versionId,
    solicitanteId,
    solicitanteRol,
    responsableId,
    revisorId,
    aprobadorId,
    comentario,
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const resultadoDocumento = await client.query(
            `SELECT
         d.id,
         d.estado,
         d.proceso_id,
         d.elaborador_id,
         p.responsable_id AS responsable_proceso_id,
         dv.id AS version_id,
         dv.estado_conversion
       FROM documentos d
       JOIN documento_versiones dv
         ON dv.documento_id = d.id
       LEFT JOIN procesos p
         ON p.id = d.proceso_id
       WHERE d.id = $1
         AND dv.id = $2
       FOR UPDATE OF d`,
            [documentoId, versionId],
        );

        const documento = resultadoDocumento.rows[0];

        if (!documento) {
            throw crearError("El documento o la versión no existen.", 404);
        }

        const puedeEnviar =
            solicitanteRol === "admin_general" ||
            documento.elaborador_id === solicitanteId ||
            documento.responsable_proceso_id === solicitanteId;

        if (!puedeEnviar) {
            throw crearError(
                "No tienes permiso para enviar este borrador.",
                403,
            );
        }

        if (documento.estado !== "borrador") {
            throw crearError(
                "Solo se pueden enviar documentos en borrador.",
                409,
            );
        }

        if (
            !["completada", "no_requerida"].includes(
                documento.estado_conversion,
            )
        ) {
            throw crearError("El documento no tiene un PDF disponible.", 409);
        }

        const solicitudActiva = await client.query(
            `SELECT id
       FROM solicitudes
       WHERE documento_id = $1
         AND version_documento_id = $2
         AND estado IN (
           'pendiente',
           'en_responsable',
           'en_revisor',
           'en_aprobador'
         )
       LIMIT 1`,
            [documentoId, versionId],
        );

        if (solicitudActiva.rows[0]) {
            throw crearError(
                "Esta versión ya tiene una solicitud activa.",
                409,
            );
        }

        const responsableValidado = await validarParticipante(
            client,
            responsableId,
            "responsable",
        );

        const revisorValidado = await validarParticipante(
            client,
            revisorId,
            "revisor",
        );

        const aprobadorValidado = await validarParticipante(
            client,
            aprobadorId,
            "aprobador",
            true,
        );

        const estadoInicial = responsableValidado
            ? "en_responsable"
            : revisorValidado
              ? "en_revisor"
              : "en_aprobador";

        const destinatarioInicial =
            responsableValidado || revisorValidado || aprobadorValidado;

        const resultadoTipo = await client.query(
            `SELECT id
       FROM tipos_solicitud
       WHERE clave = 'alta'`,
        );

        const tipoSolicitudId = resultadoTipo.rows[0]?.id;

        if (!tipoSolicitudId) {
            throw crearError(
                "No está configurado el tipo de solicitud de alta.",
                500,
            );
        }

        const resultadoSolicitud = await client.query(
            `INSERT INTO solicitudes (
         tipo_solicitud_id,
         documento_id,
         version_documento_id,
         proceso_id,
         solicitante_id,
         estado,
         fecha_modificacion,
         responsable_asignado_id,
         revisor_asignado_id,
         aprobador_asignado_id,
         actualizado_en
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, CURRENT_DATE,
         $7, $8, $9, now()
       )
       RETURNING *`,
            [
                tipoSolicitudId,
                documentoId,
                versionId,
                documento.proceso_id,
                solicitanteId,
                estadoInicial,
                responsableValidado,
                revisorValidado,
                aprobadorValidado,
            ],
        );

        const solicitud = resultadoSolicitud.rows[0];

        await client.query(
            `INSERT INTO solicitud_historial (
                solicitud_id,
                estado,
                actor_id,
                comentario
            )
            VALUES ($1, $2, $3, $4)`,
            [
                solicitud.id,
                estadoInicial,
                solicitanteId,
                comentario || "Documento enviado al flujo de revisión.",
            ],
        );

        await client.query(
            `INSERT INTO notificaciones (
                usuario_id,
                mensaje,
                enlace
            )
            SELECT $1, format('Tienes el documento "%s" pendiente de revisión.', nombre), $2
              FROM documentos
             WHERE id = $3`,
            [
                destinatarioInicial,
                "/solicitudes",
                documentoId,
            ],
        );

        await client.query(
            `UPDATE documentos
       SET estado = 'en_revision'
       WHERE id = $1`,
            [documentoId],
        );

        await client.query("COMMIT");

        return solicitud;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function reemplazarArchivoCorregido({
    documentoId,
    versionId,
    usuarioId,
    usuarioRol,
    archivo,
}) {
    if (!archivo) {
        throw crearError("Debes seleccionar el archivo corregido.", 400);
    }

    const datosArchivo = await guardarArchivoDocumento(archivo);

    if (
        !["completada", "no_requerida"].includes(datosArchivo.estadoConversion)
    ) {
        await limpiarArchivosGuardados(datosArchivo);

        throw crearError(
            datosArchivo.errorConversion ||
                "No se pudo generar el archivo PDF.",
            422,
        );
    }

    const client = await pool.connect();
    let transaccionIniciada = false;

    try {
        await client.query("BEGIN");
        transaccionIniciada = true;
        const resultado = await client.query(
            `SELECT
                d.id,
                d.estado,
                d.elaborador_id,
                p.responsable_id AS responsable_proceso_id,
                dv.id AS version_id,
                dv.vigente,
                dv.archivo_original_url,
                dv.archivo_pdf_url,
                s.id AS solicitud_id,
                s.estado AS solicitud_estado,
                s.responsable_asignado_id,
                s.revisor_asignado_id,
                s.aprobador_asignado_id
            FROM documentos d
            JOIN documento_versiones dv
                ON dv.documento_id = d.id
            LEFT JOIN procesos p
                ON p.id = d.proceso_id
            LEFT JOIN LATERAL (
                SELECT
                    solicitud.id,
                    solicitud.estado,
                    solicitud.responsable_asignado_id,
                    solicitud.revisor_asignado_id,
                    solicitud.aprobador_asignado_id
                FROM solicitudes solicitud
                WHERE solicitud.documento_id = d.id
                AND solicitud.version_documento_id = dv.id
                ORDER BY solicitud.id DESC
                LIMIT 1
            ) s ON TRUE
            WHERE d.id = $1
                AND dv.id = $2
            FOR UPDATE OF d, dv`,
            [documentoId, versionId],
        );

        const documento = resultado.rows[0];
        if (!documento) {
            throw crearError("El documento o la versión no existen.", 404);
        }

        const puedeCorregir =
            usuarioRol === "admin_general" ||
            documento.elaborador_id === usuarioId ||
            documento.responsable_proceso_id === usuarioId;

        if (!puedeCorregir) {
            throw crearError(
                "No tienes permiso para corregir este documento.",
                403,
            );
        }

        if (
            documento.estado !== "borrador" ||
            documento.solicitud_estado !== "correcciones"
        ) {
            throw crearError(
                "El documento no está pendiente de correcciones.",
                409,
            );
        }

        if (documento.vigente) {
            throw crearError(
                "No se puede reemplazar una versión vigente.",
                409,
            );
        }

        const estadoReenvio = documento.responsable_asignado_id
            ? "en_responsable"
            : documento.revisor_asignado_id
              ? "en_revisor"
              : "en_aprobador";

        const destinatarioReenvio =
            documento.responsable_asignado_id ||
            documento.revisor_asignado_id ||
            documento.aprobador_asignado_id;

        if (!destinatarioReenvio) {
            throw crearError(
                "La solicitud no tiene participantes asignados.",
                409,
            );
        }

        const resultadoVersion = await client.query(
            `UPDATE documento_versiones
            SET archivo_original_url = $1,
                archivo_pdf_url = $2,
                nombre_original = $3,
                tipo_mime = $4,
                extension_original = $5,
                tamano_bytes = $6,
                hash_sha256 = $7,
                creado_por = $8,
                estado_conversion = $9,
                error_conversion = $10
            WHERE id = $11
                AND documento_id = $12
            RETURNING *`,
            [
                datosArchivo.archivoOriginalUrl,
                datosArchivo.archivoPdfUrl,
                datosArchivo.nombreOriginal,
                datosArchivo.tipoMime,
                datosArchivo.extensionOriginal,
                datosArchivo.tamanoBytes,
                datosArchivo.hashSha256,
                usuarioId,
                datosArchivo.estadoConversion,
                datosArchivo.errorConversion,
                versionId,
                documentoId,
            ],
        );

        await client.query(
            `UPDATE solicitudes
            SET estado = $1,
                actualizado_en = now()
            WHERE id = $2`,
            [estadoReenvio, documento.solicitud_id],
        );

        await client.query(
            `UPDATE documentos
            SET estado = 'en_revision'
            WHERE id = $1`,
            [documentoId],
        );

        await client.query(
            `INSERT INTO solicitud_historial (
                solicitud_id,
                estado,
                actor_id,
                comentario
            )
            VALUES ($1, $2, $3, $4)`,
            [
                documento.solicitud_id,
                estadoReenvio,
                usuarioId,
                "Se cargó el archivo corregido y se reenvió a revisión.",
            ],
        );

        await client.query(
            `INSERT INTO notificaciones (
                usuario_id,
                mensaje,
                enlace
            )
            SELECT $1, format('Se recibió el documento "%s" corregido para revisión.', nombre), $2
              FROM documentos
             WHERE id = $3`,
            [
                destinatarioReenvio,
                "/solicitudes",
                documentoId,
            ],
        );

        await client.query("COMMIT");
        transaccionIniciada = false;

        await limpiarArchivosGuardados({
            archivoOriginalUrl: documento.archivo_original_url,
            archivoPdfUrl: documento.archivo_pdf_url,
        });

        return resultadoVersion.rows[0];
    } catch (error) {
        if (transaccionIniciada) {
            await client.query("ROLLBACK");
        }

        await limpiarArchivosGuardados(datosArchivo);
        throw error;
    } finally {
        client.release();
    }
}
