import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { crear } from '../src/controllers/auditorias.controller.js';
import * as service from '../src/services/auditorias.service.js';

const datos = { nombre: ' Auditoría de prueba ', alcance: ' Revisar registros ',
  comentarios: '', proceso_id: 1, auditor_catalogo_id: 2, fecha_programada: '2026-10-01',
  tipo_auditoria: 'interna' };

test('validaciones de planeación sin guardar registros ficticios', async () => {
  const originalConnect = pool.connect;
  const consultas = [];
  let liberaciones = 0;
  let filasInsertadas = [{ id: 123, estado: 'planeacion', tipo_auditoria: 'interna', auditor_id: 9 }];
  pool.connect = async () => ({
    query: async (sql, valores) => {
      consultas.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
      if (/INSERT INTO auditorias/.test(sql)) {
        assert.match(sql, /cat.activo = TRUE/);
        assert.match(sql, /u.activo = TRUE/);
        assert.match(sql, /p.estatus = 'activo'/);
        assert.ok(!sql.includes('INSERT INTO auditorias (estado'));
        assert.equal(valores[0], 'Auditoría de prueba');
        assert.equal(valores[3], 9);
        assert.equal(valores[5], 'Revisar registros');
        assert.equal(valores[7], 'interna');
        return { rows: filasInsertadas };
      }
      return { rows: [] };
    },
    release: () => { liberaciones++; },
  });
  try {
    for (const cambio of [
      { nombre: ' ' }, { nombre: 'a'.repeat(201) }, { alcance: '' },
      { alcance: 'a'.repeat(10001) }, { comentarios: {} }, { comentarios: 'a'.repeat(5001) },
      { proceso_id: 0 }, { auditor_catalogo_id: '2' }, { auditor_catalogo_id: -1 },
      { fecha_programada: '2026-02-30' }, { fecha_programada: '' }, { fecha_programada: '2026-13-01' },
      { tipo_auditoria: 'otra' }, { tipo_auditoria: undefined },
    ]) {
      let codigo;
      const res = { status(valor) { codigo = valor; return this; }, json() {} };
      await crear({ body: { ...datos, ...cambio }, auth: { sub: '9' } }, res, error => { throw error; });
      assert.equal(codigo, 400);
    }
    assert.equal(consultas.length, 0);

    let codigo;
    let respuesta;
    const res = { status(valor) { codigo = valor; return this; }, json(valor) { respuesta = valor; } };
    await crear({ body: { ...datos, creada_por: 1000, estado: 'cerrada' }, auth: { sub: '9' } }, res, error => { throw error; });
    assert.equal(codigo, 201);
    assert.deepEqual(respuesta, filasInsertadas[0]);
    assert.deepEqual(consultas, ['BEGIN', 'INSERT INTO auditorias', 'COMMIT']);

    filasInsertadas = [];
    const limpios = { ...datos, nombre: 'Auditoría de prueba', alcance: 'Revisar registros' };
    await assert.rejects(() => service.crear(limpios, 9), error => error.status === 400);
    assert.equal(consultas.at(-1), 'ROLLBACK');
    assert.equal(liberaciones, 2);
  } finally {
    pool.connect = originalConnect;
  }
});

test('migración aplicada, consultas reales y auditores de usuarios activos', async () => {
  try {
    const { rows } = await pool.query("SELECT nombre FROM schema_migrations WHERE nombre = '021_planeacion_auditorias.sql'");
    assert.equal(rows.length, 1);
    assert.ok(Array.isArray(await service.listar()));
    const catalogos = await service.catalogos();
    assert.ok(Array.isArray(catalogos.procesos));
    assert.ok(Array.isArray(catalogos.auditores));
    const { rows: activos } = await pool.query(`SELECT a.id FROM auditores a JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.activo = TRUE AND u.activo = TRUE`);
    assert.deepEqual(catalogos.auditores.map(a => a.id).sort((a, b) => a - b), activos.map(a => a.id).sort((a, b) => a - b));
  } finally {
    await pool.end();
  }
});
