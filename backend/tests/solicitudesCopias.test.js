import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import * as controller from '../src/controllers/solicitudesCopias.controller.js';
import * as service from '../src/services/solicitudesCopias.service.js';
import { crearCopiaControlada, confirmarEntregaCopiaControlada } from '../src/services/documentos.service.js';
import * as documentosController from '../src/controllers/documentos.controller.js';

test('solicitud: valida entradas y guarda sin generar la copia', async () => {
  const original = pool.query;
  let consultas = 0;
  pool.query = async (sql, valores) => {
    consultas++;
    assert.match(sql, /INSERT INTO solicitudes_copias_controladas/);
    assert.doesNotMatch(sql, /INSERT INTO copias_controladas/);
    assert.deepEqual(valores, [7, 'Laboratorio', 'Consulta en sitio', 9]);
    return { rows: [{ id: 1, estado: 'pendiente' }] };
  };
  try {
    for (const body of [
      { documento_id: 0, destinatario_nombre: 'Laboratorio', motivo: 'Consulta' },
      { documento_id: 7, destinatario_nombre: '', motivo: 'Consulta' },
      { documento_id: 7, destinatario_nombre: 'Laboratorio', motivo: '' },
      { documento_id: 7, destinatario_nombre: 'a'.repeat(201), motivo: 'Consulta' },
    ]) {
      let codigo;
      await controller.crear({ body, auth: { sub: 9 } }, {
        status(valor) { codigo = valor; return this; }, json() {},
      }, error => { throw error; });
      assert.equal(codigo, 400);
    }
    assert.equal(consultas, 0);
    let codigo;
    await controller.crear({
      body: { documento_id: 7, destinatario_nombre: ' Laboratorio ', motivo: ' Consulta en sitio ' },
      auth: { sub: 9 },
    }, { status(valor) { codigo = valor; return this; }, json() {} }, error => { throw error; });
    assert.equal(codigo, 201);
    assert.equal(consultas, 1);
  } finally {
    pool.query = original;
  }
});

test('autorización: no genera una copia si la versión solicitada ya cambió', async () => {
  const consultas = [];
  const clienteExterno = {
    async query(sql) {
      consultas.push(sql);
      if (sql.includes('FOR UPDATE OF documento')) {
        return { rows: [{ id: 7, codigo: 'DOC-7', version_documento_id: 12, archivo_pdf_url: 'pdf/actual.pdf' }] };
      }
      return { rows: [] };
    },
  };
  await assert.rejects(() => crearCopiaControlada({
    documentoId: 7, usuarioId: 2, destinatarioNombre: 'Laboratorio',
    comentarios: '', versionDocumentoIdEsperada: 11, clienteExterno,
  }), error => error.status === 409);
  assert.equal(consultas.length, 1);
  assert.ok(!consultas.includes('COMMIT'));
});

test('rechazo: exige motivo y solo resuelve solicitudes pendientes', async () => {
  const original = pool.connect;
  let consultas = [];
  pool.connect = async () => ({
    async query(sql) {
      consultas.push(sql);
      if (sql.includes('FOR UPDATE')) {
        return { rows: [{ id: 1, estado: 'pendiente' }] };
      }
      if (sql.includes('UPDATE solicitudes_copias_controladas')) {
        return { rows: [{ id: 1, estado: 'rechazada', copia_controlada_id: null }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  try {
    let codigo;
    await controller.resolver({
      params: { id: '1' }, body: { decision: 'rechazada', comentario: '' },
      auth: { sub: 2 },
    }, { status(valor) { codigo = valor; return this; }, json() {} }, error => { throw error; });
    assert.equal(codigo, 400);
    assert.deepEqual(consultas, []);
    const resultado = await service.resolverSolicitud({
      solicitudId: 1, usuarioId: 2, decision: 'rechazada', comentario: 'No se requiere.',
    });
    assert.equal(resultado.estado, 'rechazada');
    assert.ok(consultas.includes('COMMIT'));
    assert.ok(!consultas.some(sql => sql.includes('INSERT INTO copias_controladas')));
  } finally {
    pool.connect = original;
  }
});

test('entrega: exige confirmación y nombre del receptor', async () => {
  for (const body of [
    { recibida_por_nombre: 'Laboratorio', confirmada: false },
    { recibida_por_nombre: '', confirmada: true },
    { recibida_por_nombre: 'X'.repeat(201), confirmada: true },
  ]) {
    let codigo;
    await documentosController.confirmarEntregaCopiaControlada({
      params: { id: '7', copiaId: '3' }, body, auth: { sub: 2 },
    }, {
      status(valor) { codigo = valor; return this; }, json() {},
    }, error => { throw error; });
    assert.equal(codigo, 400);
  }
});

test('entrega: activa una copia pendiente y registra quién la recibió', async () => {
  const original = pool.connect;
  const consultas = [];
  pool.connect = async () => ({
    async query(sql, valores) {
      consultas.push({ sql, valores });
      if (sql.includes('FROM documentos WHERE id')) return { rows: [{ estado: 'vigente' }] };
      if (sql.includes('FROM copias_controladas copia')) {
        return { rows: [{ id: 3, estado: 'pendiente_entrega', version_vigente: true }] };
      }
      if (sql.includes('UPDATE copias_controladas')) {
        return { rows: [{ id: 3, estado: 'activa', recibida_por_nombre: 'Laboratorio' }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  try {
    const copia = await confirmarEntregaCopiaControlada({
      documentoId: 7, copiaId: 3, usuarioId: 2,
      recibidaPorNombre: 'Laboratorio', observaciones: 'Recepción',
    });
    assert.equal(copia.estado, 'activa');
    assert.deepEqual(consultas.find(item => item.sql.includes('UPDATE copias_controladas')).valores,
      [2, 'Laboratorio', 'Recepción', 3]);
    assert.equal(consultas.at(-1).sql, 'COMMIT');
  } finally {
    pool.connect = original;
  }
});

test('entrega: rechaza la copia si el documento ya cambió', async () => {
  const original = pool.connect;
  const consultas = [];
  pool.connect = async () => ({
    async query(sql) {
      consultas.push(sql);
      if (sql.includes('FROM documentos WHERE id')) return { rows: [{ estado: 'vigente' }] };
      if (sql.includes('FROM copias_controladas copia')) {
        return { rows: [{ id: 3, estado: 'pendiente_entrega', version_vigente: false }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  try {
    await assert.rejects(() => confirmarEntregaCopiaControlada({
      documentoId: 7, copiaId: 3, usuarioId: 2, recibidaPorNombre: 'Laboratorio',
    }), error => error.status === 409);
    assert.ok(consultas.includes('ROLLBACK'));
    assert.ok(!consultas.some(sql => sql.includes('UPDATE copias_controladas')));
  } finally {
    pool.connect = original;
  }
});
