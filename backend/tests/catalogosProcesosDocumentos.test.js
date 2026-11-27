import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import * as macroprocesos from '../src/services/macroprocesos.service.js';
import * as procesos from '../src/services/procesos.service.js';
import * as tiposDocumento from '../src/services/tiposDocumento.service.js';

test('los procesos conservan asociación opcional y los nuevos exigen macroproceso activo', async () => {
  const original = pool.query;
  const consultas = [];
  pool.query = async (sql, params) => {
    consultas.push({ sql, params });
    return sql.includes('INSERT INTO procesos') ? { rows: [] } : { rows: [] };
  };
  try {
    await procesos.listar();
    assert.match(consultas[0].sql, /LEFT JOIN macroprocesos/);
    await assert.rejects(
      () => procesos.crear({ nombre: 'Prueba', responsable_id: 2, macroproceso_id: 5, descripcion: '', creado_por: 1 }),
      (error) => error.status === 400,
    );
    assert.match(consultas[1].sql, /JOIN macroprocesos m ON m.id = \$7 AND m.activo = TRUE/);
    assert.equal(consultas[1].params[6], 5);
  } finally {
    pool.query = original;
  }
});

test('no se desactiva un macroproceso con procesos activos', async () => {
  const original = pool.query;
  const consultas = [];
  pool.query = async (sql) => {
    consultas.push(sql);
    return sql.includes('SELECT id FROM macroprocesos')
      ? { rows: [{ id: 5 }] }
      : { rows: [] };
  };
  try {
    await assert.rejects(() => macroprocesos.desactivar(5), (error) => error.status === 409);
    assert.match(consultas[0], /NOT EXISTS/);
    assert.match(consultas[0], /p.estatus = 'activo'/);
  } finally {
    pool.query = original;
  }
});

test('el tipo Registro se protege y un tipo en uso no se renombra', async () => {
  const original = pool.query;
  let nombreActual = 'Registro';
  pool.query = async (sql) => sql.includes('SELECT nombre FROM tipos_documento')
    ? { rows: [{ nombre: nombreActual }] }
    : { rows: [] };
  try {
    await assert.rejects(
      () => tiposDocumento.actualizar(3, { nombre: 'Otro', activo: true }),
      (error) => error.status === 409 && /Registro/.test(error.message),
    );
    nombreActual = 'Instructivo';
    await assert.rejects(
      () => tiposDocumento.actualizar(5, { nombre: 'Otro', activo: true }),
      (error) => error.status === 409 && /asociado/.test(error.message),
    );
  } finally {
    pool.query = original;
  }
});

test('el catálogo documental consulta la tabla real y conserva el historial', async () => {
  const original = pool.query;
  const consultas = [];
  pool.query = async (sql, params) => {
    consultas.push({ sql, params });
    return { rows: [{ id: 9, nombre: 'Guía técnica', activo: true }] };
  };
  try {
    await tiposDocumento.listarTodos();
    await tiposDocumento.crear('Guía técnica');
    await tiposDocumento.desactivar(9);
    assert.match(consultas[0].sql, /FROM tipos_documento/);
    assert.match(consultas[1].sql, /INSERT INTO tipos_documento/);
    assert.match(consultas[2].sql, /SET activo = FALSE/);
    assert.doesNotMatch(consultas[2].sql, /DELETE FROM/);
  } finally {
    pool.query = original;
  }
});
