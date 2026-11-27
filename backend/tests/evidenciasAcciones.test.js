import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { pool } from '../src/config/db.js';
import { subirArchivosSolicitud } from '../src/middlewares/uploadDocumento.js';

test('archivos: persistencia, descarga vinculada y limpieza tras fallo', async () => {
  const temporal = await mkdtemp(path.join(os.tmpdir(), 'web360-evidencias-test-'));
  const anteriorStorage = process.env.STORAGE_DIR;
  process.env.STORAGE_DIR = temporal;
  const service = await import('../src/services/accionesCorrectivas.service.js?prueba-evidencias');
  if (anteriorStorage === undefined) delete process.env.STORAGE_DIR;
  else process.env.STORAGE_DIR = anteriorStorage;
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const buffer = Buffer.from('contenido de prueba');
  const archivo = { originalname: '../evidencia.pdf', buffer, mimetype: 'application/pdf', size: buffer.length };
  let metadatos;
  let fallo = false;
  let estado = 'en_seguimiento';
  let confirmaciones = 0;
  let reversiones = 0;
  pool.connect = async () => ({
    async query(sql, valores) {
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: 1, responsable_id: 9, estado }] };
      if (sql.startsWith('SELECT id FROM usuarios')) return { rows: [{ id: 9 }] };
      if (sql.includes('INSERT INTO seguimientos')) return { rows: [{ id: 55 }] };
      if (sql.includes('INSERT INTO evidencias')) {
        if (fallo) throw new Error('Fallo simulado');
        metadatos = valores;
      }
      if (sql === 'COMMIT') confirmaciones++;
      if (sql === 'ROLLBACK') reversiones++;
      return { rows: [] };
    },
    release() {},
  });
  try {
    await service.registrarSeguimiento(1, 9, 'Avance', false, [archivo]);
    assert.equal(confirmaciones, 1);
    assert.equal(metadatos[0], 55);
    assert.equal(metadatos[1], 'evidencia.pdf');
    assert.equal(metadatos[4], buffer.length);
    assert.deepEqual(await readFile(path.join(temporal, metadatos[2])), buffer);
    pool.query = async (_sql, valores) => {
      assert.deepEqual(valores, [10, 1]);
      return { rows: [{ archivo_url: metadatos[2], nombre_archivo: metadatos[1] }] };
    };
    assert.equal((await service.obtenerEvidencia(1, 10)).nombreArchivo, 'evidencia.pdf');
    pool.query = async () => ({ rows: [] });
    await assert.rejects(() => service.obtenerEvidencia(2, 10), error => error.status === 404);
    pool.query = async () => ({ rows: [{ archivo_url: '../fuera.pdf' }] });
    await assert.rejects(() => service.obtenerEvidencia(1, 10), error => error.status === 400);
    fallo = true;
    await assert.rejects(() => service.registrarSeguimiento(1, 9, 'Avance', false, [archivo]), /Fallo simulado/);
    assert.equal((await readdir(path.join(temporal, 'acciones-correctivas'))).length, 1);
    estado = 'cerrada';
    await assert.rejects(() => service.registrarSeguimiento(1, 9, 'Avance', false, [archivo]), error => error.status === 409);
    assert.equal((await readdir(path.join(temporal, 'acciones-correctivas'))).length, 1);
    assert.equal(confirmaciones, 1);
    assert.equal(reversiones, 2);
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await pool.end();
    await rm(temporal, { recursive: true, force: true });
  }
});

test('carga multipart: archivos opcionales, formatos, cantidad y tamaño', async () => {
  const app = express();
  app.post('/', subirArchivosSolicitud, (req, res) => res.json({ cantidad: req.files.length, enviar: req.body.enviar_revision }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.publico }));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const caso of [
      { cantidad: 0, status: 200 }, { cantidad: 2, status: 200 },
      { cantidad: 6, status: 400 }, { cantidad: 1, nombre: 'archivo.exe', status: 400 },
      { cantidad: 1, grande: true, status: 400 },
    ]) {
      const form = new FormData();
      form.append('comentario', 'Avance');
      form.append('enviar_revision', 'false');
      for (let i = 0; i < caso.cantidad; i++) form.append('archivos', new Blob([
        caso.grande ? new Uint8Array(25 * 1024 * 1024 + 1) : 'archivo de prueba',
      ], { type: 'application/pdf' }), caso.nombre || `evidencia${i}.pdf`);
      const respuesta = await fetch(url, { method: 'POST', body: form });
      assert.equal(respuesta.status, caso.status);
      const datos = await respuesta.json();
      if (caso.status === 200) assert.equal(datos.cantidad, caso.cantidad);
      else assert.ok(datos.error);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
