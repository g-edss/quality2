import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import * as tipos from '../src/services/tiposIndicador.service.js';
import * as unidades from '../src/services/unidadesmedida.service.js';
import { cancelarSolicitud } from '../src/services/solicitudes.service.js';

test('los catálogos consultan las tablas reales y conservan el estado', async () => {
  const original = pool.query;
  const consultas = [];
  pool.query = async (sql, params) => {
    consultas.push({ sql, params });
    return { rows: [{ id: 3, activo: true }] };
  };
  try {
    await tipos.listar();
    await tipos.crear({ codigo: 'TI-001', nombre: 'Eficacia', descripcion: '', activo: true });
    await tipos.actualizar(3, { codigo: 'TI-001', nombre: 'Eficacia', descripcion: '', activo: true });
    await tipos.desactivar(3);
    await unidades.listarTodas();
    await unidades.crear({ nombre: 'Horas', simbolo: 'h', tipo_dato: 'numero', descripcion: '', activo: true });
    await unidades.actualizar(3, { nombre: 'Horas', simbolo: 'h', tipo_dato: 'numero', descripcion: '', activo: true });
    await unidades.desactivar(3);
    assert.match(consultas[0].sql, /FROM tipos_indicador/);
    assert.match(consultas[1].sql, /INSERT INTO tipos_indicador/);
    assert.match(consultas[2].sql, /UPDATE tipos_indicador/);
    assert.match(consultas[3].sql, /activo = FALSE/);
    assert.match(consultas[4].sql, /FROM unidades_medida/);
    assert.match(consultas[5].sql, /INSERT INTO unidades_medida/);
    assert.match(consultas[6].sql, /UPDATE unidades_medida/);
    assert.match(consultas[7].sql, /activo = FALSE/);
  } finally {
    pool.query = original;
  }
});

test('solo el solicitante cancela una solicitud abierta y queda historial', async () => {
  const original = pool.connect;
  const consultas = [];
  const solicitud = {
    id: 7, estado: 'en_revisor', solicitante_id: 9,
    documento_id: 4, registro_id: null, tipo_clave: 'alta',
    revisor_asignado_id: 11,
  };
  pool.connect = async () => ({
    query: async (sql, params) => {
      consultas.push({ sql, params });
      return sql.includes('FROM solicitudes s')
        ? { rows: [solicitud] }
        : { rows: [] };
    },
    release() {},
  });
  try {
    await assert.rejects(
      () => cancelarSolicitud({ solicitudId: 7, usuarioId: 8, motivo: '' }),
      (error) => error.status === 403,
    );
    assert.equal(consultas.some(({ sql }) => sql.includes("SET estado = 'cancelada'")), false);
    consultas.length = 0;
    assert.deepEqual(
      await cancelarSolicitud({ solicitudId: 7, usuarioId: 9, motivo: 'Ya no se requiere.' }),
      { id: 7, estado: 'cancelada' },
    );
    assert.ok(consultas.some(({ sql }) => sql.includes("SET estado = 'cancelada'")));
    assert.ok(consultas.some(({ sql }) => sql.includes("SET estado = 'borrador'")));
    assert.ok(consultas.some(({ sql }) => sql.includes('INSERT INTO solicitud_historial')));
    assert.ok(consultas.some(({ sql }) => sql.includes('INSERT INTO notificaciones')));
    assert.equal(consultas.at(-1).sql, 'COMMIT');
  } finally {
    pool.connect = original;
  }
});

test('una solicitud resuelta no se puede cancelar', async () => {
  const original = pool.connect;
  const consultas = [];
  pool.connect = async () => ({
    query: async (sql) => {
      consultas.push(sql);
      return sql.includes('FROM solicitudes s')
        ? { rows: [{ id: 7, estado: 'aprobada', solicitante_id: 9 }] }
        : { rows: [] };
    },
    release() {},
  });
  try {
    await assert.rejects(
      () => cancelarSolicitud({ solicitudId: 7, usuarioId: 9, motivo: '' }),
      (error) => error.status === 409,
    );
    assert.equal(consultas.some((sql) => sql.includes("SET estado = 'cancelada'")), false);
  } finally {
    pool.connect = original;
  }
});

test('cancelar un cambio deja el documento vigente y cancelar un registro lo devuelve a borrador', async () => {
  const original = pool.connect;
  const consultas = [];
  let solicitud;
  pool.connect = async () => ({
    query: async (sql) => {
      consultas.push(sql);
      return sql.includes('FROM solicitudes s') ? { rows: [solicitud] } : { rows: [] };
    },
    release() {},
  });
  try {
    solicitud = {
      id: 8, estado: 'en_responsable', solicitante_id: 9,
      documento_id: 4, registro_id: null, tipo_clave: 'cambio',
      responsable_asignado_id: 11,
    };
    await cancelarSolicitud({ solicitudId: 8, usuarioId: 9, motivo: '' });
    assert.equal(consultas.some((sql) => sql.includes('UPDATE documentos')), false);
    assert.equal(consultas.some((sql) => sql.includes('UPDATE registros')), false);

    consultas.length = 0;
    solicitud = { ...solicitud, id: 9, documento_id: null, registro_id: 5, tipo_clave: 'registro' };
    await cancelarSolicitud({ solicitudId: 9, usuarioId: 9, motivo: '' });
    assert.equal(consultas.some((sql) => sql.includes('UPDATE documentos')), false);
    assert.ok(consultas.some((sql) => sql.includes("UPDATE registros SET estado = 'borrador'")));
  } finally {
    pool.connect = original;
  }
});
