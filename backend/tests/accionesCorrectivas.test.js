import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { crear, registrarSeguimiento, revisar } from '../src/controllers/accionesCorrectivas.controller.js';
import * as service from '../src/services/accionesCorrectivas.service.js';

const datos = {
  titulo: ' Acción de prueba ', descripcion: ' Corregir el problema ',
  proceso_id: 1, responsable_id: 2, tipo: 'Correctiva', tipo_hallazgo: 'No Conformidad menor',
  afecta_otros_procesos: false, procesos_afectados: [],
  origen: '', fecha_ocurrencia: '2026-09-28', fecha_compromiso: '2026-10-01',
};

test('validaciones y guardado sin insertar datos de prueba', async () => {
  const originalConnect = pool.connect;
  const consultas = [];
  let liberaciones = 0;
  let procesosActivos = [{ id: 1 }];
  let filasInsertadas = [{ id: 123 }];
  pool.connect = async () => ({
    query: async (sql, valores) => {
      consultas.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
      if (/FROM procesos/.test(sql) && !/INSERT/.test(sql)) return { rows: procesosActivos };
      if (/INSERT INTO acciones_correctivas\s*\(/.test(sql)) {
        assert.equal(valores[1], 'Acción de prueba');
        assert.equal(valores[5], 9);
        assert.equal(valores[7], 'No Conformidad menor');
        return { rows: filasInsertadas };
      }
      return { rows: [] };
    },
    release: () => { liberaciones++; },
  });
  try {
    for (const cambio of [
      { titulo: ' ' }, { descripcion: '' }, { proceso_id: -1 },
      { responsable_id: '2' }, { tipo: 'Otro' }, { tipo_hallazgo: 'Grave' },
      { afecta_otros_procesos: 'no' }, { afecta_otros_procesos: true, procesos_afectados: [] },
      { procesos_afectados: [3] },
      { fecha_ocurrencia: '2026-02-30' }, { fecha_compromiso: '2026-09-27' },
      { fecha_compromiso: 0 }, { origen: {} }, { titulo: 'a'.repeat(201) },
    ]) {
      let codigo;
      const res = { status(valor) { codigo = valor; return this; }, json() {} };
      await crear({ body: { ...datos, ...cambio }, auth: { sub: '9' } }, res, error => { throw error; });
      assert.equal(codigo, 400, JSON.stringify(cambio));
    }
    assert.equal(consultas.length, 0);

    let codigo;
    let respuesta;
    const res = { status(valor) { codigo = valor; return this; }, json(valor) { respuesta = valor; } };
    await crear({ body: { ...datos, creado_por: 1000 }, auth: { sub: '9' } }, res, error => { throw error; });
    assert.equal(codigo, 201);
    assert.deepEqual(respuesta, { id: 123 });
    assert.equal(consultas[0], 'BEGIN');
    assert.equal(consultas.at(-1), 'COMMIT');

    filasInsertadas = [];
    const limpios = { ...datos, titulo: 'Acción de prueba', descripcion: 'Corregir el problema' };
    await assert.rejects(() => service.crear(limpios, 9), error => error.status === 400);
    assert.equal(consultas.at(-1), 'ROLLBACK');
    assert.equal(liberaciones, 2);
  } finally {
    pool.connect = originalConnect;
  }
});

test('seguimiento: validaciones del controlador sin acceder a la base', async () => {
  for (const [id, body] of [
    ['0', { comentario: 'Avance', enviar_revision: false }],
    ['1', { comentario: ' ', enviar_revision: false }],
    ['1', { comentario: 'a'.repeat(10001), enviar_revision: false }],
    ['1', { comentario: 'Avance', enviar_revision: 'true' }],
  ]) {
    let codigo;
    const res = { status(valor) { codigo = valor; return this; }, json() {} };
    await registrarSeguimiento({ params: { id }, body, auth: { sub: '9' } }, res, error => { throw error; });
    assert.equal(codigo, 400);
  }
});

test('seguimiento: transacciones, autor asignado y envío único a revisión', async () => {
  const original = pool.connect;
  try {
    for (const caso of [
      { accion: { responsable_id: 9, estado: 'propuesta' }, enviar: false, estado: 'en_seguimiento' },
      { accion: { responsable_id: 9, estado: 'en_seguimiento' }, enviar: true, estado: 'en_revision' },
      { accion: null, error: 404 },
      { accion: { responsable_id: 10, estado: 'propuesta' }, error: 403 },
      { accion: { responsable_id: 9, estado: 'en_revision' }, error: 409 },
      { accion: { responsable_id: 9, estado: 'aceptada' }, error: 409 },
      { accion: { responsable_id: 9, estado: 'propuesta' }, inactivo: true, error: 403 },
      { accion: { responsable_id: 9, estado: 'propuesta' }, fallo: true, error: 500 },
    ]) {
      const consultas = [];
      let liberado = false;
      pool.connect = async () => ({
        async query(sql, valores) {
          consultas.push(sql);
          if (sql.includes('FOR UPDATE')) return { rows: caso.accion ? [caso.accion] : [] };
          if (sql.startsWith('SELECT id FROM usuarios')) return { rows: caso.inactivo ? [] : [{ id: 9 }] };
          if (sql.includes('INSERT INTO seguimientos')) {
            if (caso.fallo) throw Object.assign(new Error('Fallo simulado'), { status: 500 });
            assert.deepEqual(valores, [1, 9, 'Trabajo realizado', caso.estado]);
            return { rows: [{ id: 2, creado_en: '2026-09-28' }] };
          }
          if (sql.startsWith('UPDATE acciones')) assert.deepEqual(valores, [1, caso.estado]);
          return { rows: [] };
        },
        release() { liberado = true; },
      });
      if (caso.error) {
        await assert.rejects(() => service.registrarSeguimiento(1, 9, 'Trabajo realizado', !!caso.enviar), error => error.status === caso.error);
        assert.ok(consultas.includes('ROLLBACK'));
        assert.ok(!consultas.includes('COMMIT'));
        assert.ok(!consultas.some(sql => sql.startsWith('UPDATE acciones')));
      } else {
        const resultado = await service.registrarSeguimiento(1, 9, 'Trabajo realizado', caso.enviar);
        assert.equal(resultado.estado, caso.estado);
        assert.ok(consultas.includes('COMMIT'));
      }
      assert.equal(consultas[0], 'BEGIN');
      assert.ok(liberado);
    }
  } finally {
    pool.connect = original;
  }
});

test('revisión: decisión válida y comentario obligatorio al devolver', async () => {
  for (const [id, body] of [
    ['0', { decision: 'aceptar' }], ['1', { decision: 'cerrar' }],
    ['1', { decision: 'correcciones', comentario: ' ' }],
    ['1', { decision: 'aceptar', comentario: {} }],
    ['1', { decision: 'aceptar', comentario: 'a'.repeat(10001) }],
  ]) {
    let codigo;
    const res = { status(valor) { codigo = valor; return this; }, json() {} };
    await revisar({ params: { id }, body, auth: { sub: '9' } }, res, error => { throw error; });
    assert.equal(codigo, 400);
  }
});

test('revisión: cierre, devolución, administrador activo y transacción', async () => {
  const original = pool.connect;
  try {
    for (const caso of [
      { estado: 'en_revision', decision: 'aceptar', resultado: 'cerrada' },
      { estado: 'en_revision', decision: 'correcciones', resultado: 'en_seguimiento' },
      { estado: 'en_revision', sinAdmin: true, error: 403 },
      { estado: null, error: 404 },
      { estado: 'cerrada', error: 409 },
      { estado: 'propuesta', error: 409 },
      { estado: 'en_seguimiento', error: 409 },
      { estado: 'en_revision', fallo: true, error: 500 },
    ]) {
      const consultas = [];
      let liberado = false;
      pool.connect = async () => ({
        async query(sql, valores) {
          consultas.push(sql);
          if (sql.includes('JOIN roles')) return { rows: caso.sinAdmin ? [] : [{ id: 9 }] };
          if (sql.includes('FOR UPDATE')) return { rows: caso.estado ? [{ id: 1, estado: caso.estado }] : [] };
          if (sql.includes('INSERT INTO seguimientos')) {
            assert.equal(valores[1], 9);
            assert.equal(valores[4], caso.decision === 'correcciones' ? 'correcciones' : 'aceptacion');
            return { rows: [] };
          }
          if (sql.includes('UPDATE acciones_correctivas')) {
            if (caso.fallo) throw Object.assign(new Error('Fallo simulado'), { status: 500 });
            assert.deepEqual(valores, [1, caso.resultado, caso.decision === 'aceptar', 9]);
            return { rows: [{ id: 1, estado: caso.resultado }] };
          }
          return { rows: [] };
        },
        release() { liberado = true; },
      });
      if (caso.error) {
        await assert.rejects(() => service.revisar(1, 9, caso.decision || 'aceptar', 'Comentario'), error => error.status === caso.error);
        assert.ok(consultas.includes('ROLLBACK'));
        assert.ok(!consultas.includes('COMMIT'));
      } else {
        assert.equal((await service.revisar(1, 9, caso.decision, 'Comentario')).estado, caso.resultado);
        assert.ok(consultas.includes('COMMIT'));
      }
      assert.equal(consultas[0], 'BEGIN');
      assert.ok(liberado);
    }
  } finally {
    pool.connect = original;
  }
});

test('migraciones aplicadas y consulta real disponible', async () => {
  try {
    const { rows } = await pool.query("SELECT nombre FROM schema_migrations WHERE nombre = '017_acciones_correctivas_generales.sql'");
    assert.equal(rows.length, 1);
    const { rows: seguimiento } = await pool.query("SELECT nombre FROM schema_migrations WHERE nombre = '018_seguimiento_acciones_correctivas.sql'");
    assert.equal(seguimiento.length, 1);
    const { rows: revision } = await pool.query("SELECT nombre FROM schema_migrations WHERE nombre = '019_revision_acciones_correctivas.sql'");
    assert.equal(revision.length, 1);
    const { rows: evidencias } = await pool.query("SELECT nombre FROM schema_migrations WHERE nombre = '020_evidencias_acciones_correctivas.sql'");
    assert.equal(evidencias.length, 1);
    assert.ok(Array.isArray(await service.listar()));
  } finally {
    await pool.end();
  }
});
