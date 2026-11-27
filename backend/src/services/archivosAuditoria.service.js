import path from "node:path";
import { randomUUID } from "node:crypto";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { query } from "../config/db.js";

const directorioRaiz = path.resolve(process.env.STORAGE_DIR || "/app/storage");
const directorioAuditorias = path.join(directorioRaiz, "auditorias");

function errorArchivo(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  error.publico = mensaje;
  return error;
}

export async function guardarArchivoAuditoria(archivo, rutasCreadas) {
  if (!archivo.buffer?.length || archivo.originalname.length > 255) {
    throw errorArchivo(400, "El archivo está vacío o su nombre supera 255 caracteres.");
  }

  await mkdir(directorioAuditorias, { recursive: true });
  const nombreInterno = `${randomUUID()}${path.extname(archivo.originalname).toLowerCase()}`;
  const rutaAbsoluta = path.join(directorioAuditorias, nombreInterno);
  rutasCreadas.push(rutaAbsoluta);

  try {
    await writeFile(rutaAbsoluta, archivo.buffer, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") rutasCreadas.pop();
    throw error;
  }

  return {
    nombre: path.basename(archivo.originalname.replaceAll("\\", "/"))
      .replace(/[\x00-\x1f\x7f]/g, "_"),
    rutaRelativa: `auditorias/${nombreInterno}`,
  };
}

export async function limpiarArchivosAuditoria(rutasCreadas) {
  for (const ruta of rutasCreadas) {
    try {
      await unlink(ruta);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("No se pudo limpiar un archivo de auditoría:", error.code);
      }
    }
  }
}

export async function obtenerArchivoAuditoria(auditoriaId, hallazgoId, archivoId) {
  const { rows } = await query(`
    SELECT f.archivo_url, f.nombre_archivo
    FROM archivos_hallazgos f
    JOIN hallazgos h ON h.id = f.hallazgo_id
    WHERE f.id = $1 AND h.id = $2 AND h.auditoria_id = $3
  `, [archivoId, hallazgoId, auditoriaId]);

  if (!rows[0]) {
    throw errorArchivo(404, "El archivo no pertenece a este hallazgo.");
  }

  const rutaAbsoluta = path.resolve(directorioRaiz, rows[0].archivo_url);
  if (!rutaAbsoluta.startsWith(`${directorioAuditorias}${path.sep}`)) {
    throw errorArchivo(400, "La ruta del archivo no es válida.");
  }

  try {
    await access(rutaAbsoluta);
  } catch {
    throw errorArchivo(404, "El archivo no está disponible.");
  }

  return { rutaAbsoluta, nombreArchivo: rows[0].nombre_archivo };
}
