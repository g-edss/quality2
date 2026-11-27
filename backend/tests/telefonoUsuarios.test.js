import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import * as usuarios from '../src/services/usuarios.service.js';

test('el teléfono se conserva al crear, listar y editar usuarios', async () => {
  const consultarOriginal = pool.query;
  const consultas = [];

  pool.query = async (sql, params) => {
    consultas.push({ sql, params });
    if (sql.includes('FROM roles WHERE clave')) {
      return { rows: [{ id: 2, nombre: 'Responsable' }] };
    }
    if (sql.includes('INSERT INTO usuarios')) {
      return { rows: [{ id: 7, telefono: '81 1234 5678' }] };
    }
    if (sql.includes('FROM usuarios u')) {
      return { rows: [{ id: 7, telefono: '81 1234 5678' }] };
    }
    if (sql.includes('UPDATE usuarios')) {
      return { rows: [{ id: 7, telefono: '81 8765 4321', rol_id: 2 }] };
    }
    return { rows: [{ clave: 'responsable', nombre: 'Responsable' }] };
  };

  try {
    const creado = await usuarios.crear({
      nombre: 'Persona de prueba',
      correo: 'prueba@uanl.edu.mx',
      telefono: ' 81 1234 5678 ',
      puesto: '',
      rol_clave: 'responsable',
    });
    assert.equal(creado.telefono, '81 1234 5678');
    assert.match(consultas[1].sql, /INSERT INTO usuarios \(nombre, correo, telefono,/);
    assert.equal(consultas[1].params[2], '81 1234 5678');

    const listado = await usuarios.listar();
    assert.equal(listado[0].telefono, '81 1234 5678');
    assert.match(consultas[2].sql, /u\.telefono/);

    const actualizado = await usuarios.actualizar(7, { telefono: ' 81 8765 4321 ' });
    assert.equal(actualizado.telefono, '81 8765 4321');
    assert.match(consultas[3].sql, /telefono = \$1/);
    assert.equal(consultas[3].params[0], '81 8765 4321');
  } finally {
    pool.query = consultarOriginal;
  }
});
