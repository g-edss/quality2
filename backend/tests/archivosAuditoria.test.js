import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp, readFile, rmdir } from "node:fs/promises";
import { pool } from "../src/config/db.js";

test("los archivos se guardan fuera de rutas públicas y se descargan solo desde su hallazgo", async () => {
  const directorio = await mkdtemp(path.join(os.tmpdir(), "web360-auditoria-"));
  const almacenamientoAnterior = process.env.STORAGE_DIR;
  process.env.STORAGE_DIR = directorio;
  const { guardarArchivoAuditoria, limpiarArchivosAuditoria, obtenerArchivoAuditoria } =
    await import("../src/services/archivosAuditoria.service.js");
  const rutas = [];
  const original = pool.query;

  try {
    const guardado = await guardarArchivoAuditoria({
      originalname: "evidencia.pdf",
      buffer: Buffer.from("archivo de prueba"),
    }, rutas);
    assert.equal(guardado.nombre, "evidencia.pdf");
    assert.match(guardado.rutaRelativa, /^auditorias\/[\w-]+\.pdf$/);
    assert.equal((await readFile(rutas[0], "utf8")), "archivo de prueba");

    pool.query = async (_sql, params) => {
      assert.deepEqual(params, [5, 4, 3]);
      return { rows: [{ archivo_url: guardado.rutaRelativa, nombre_archivo: guardado.nombre }] };
    };
    const archivo = await obtenerArchivoAuditoria(3, 4, 5);
    assert.equal(archivo.rutaAbsoluta, rutas[0]);

    pool.query = async () => ({ rows: [] });
    await assert.rejects(() => obtenerArchivoAuditoria(3, 4, 5), error => error.status === 404);

    pool.query = async () => ({
      rows: [{ archivo_url: "../fuera.pdf", nombre_archivo: "fuera.pdf" }],
    });
    await assert.rejects(() => obtenerArchivoAuditoria(3, 4, 5), error => error.status === 400);
  } finally {
    pool.query = original;
    await limpiarArchivosAuditoria(rutas);
    await rmdir(path.join(directorio, "auditorias"));
    await rmdir(directorio);
    if (almacenamientoAnterior === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = almacenamientoAnterior;
    await pool.end();
  }
});
