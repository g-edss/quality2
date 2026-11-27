import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { permisoRegistroPorDefecto } from '../src/config/permisos.js';
import { puede, validarMatriz } from '../src/services/permisosRegistros.service.js';

test('por defecto todos descargan y solo responsables cargan', () => {
  for (const rol of ['visor', 'revisor', 'aprobador']) {
    assert.equal(permisoRegistroPorDefecto(rol, 'descargar'), true);
    assert.equal(permisoRegistroPorDefecto(rol, 'cargar'), false);
  }
  assert.equal(permisoRegistroPorDefecto('responsable', 'cargar'), true);
  assert.equal(permisoRegistroPorDefecto('admin_general', 'cargar'), true);
});

test('una excepción guardada manda sobre el valor por defecto', async () => {
  const consultarOriginal = pool.query;
  let respuesta = [];
  pool.query = async () => ({ rows: respuesta });
  try {
    respuesta = [];
    assert.equal(await puede({ usuarioId: 3, rolClave: 'visor', documentoId: 9, accion: 'descargar' }), true);
    respuesta = [{ permitido: false }];
    assert.equal(await puede({ usuarioId: 3, rolClave: 'visor', documentoId: 9, accion: 'descargar' }), false);
    respuesta = [{ permitido: true }];
    assert.equal(await puede({ usuarioId: 3, rolClave: 'visor', documentoId: 9, accion: 'cargar' }), true);
  } finally {
    pool.query = consultarOriginal;
  }
});

test('la matriz debe traer cargar y descargar como verdadero o falso', () => {
  const fila = { documento_id: 4, cargar: true, descargar: false };
  assert.doesNotThrow(() => validarMatriz([fila]));
  assert.throws(() => validarMatriz([{ ...fila, descargar: 'no' }]), { status: 400 });
  assert.throws(() => validarMatriz([{ ...fila, documento_id: 0 }]), { status: 400 });
  assert.throws(() => validarMatriz({}), { status: 400 });
});
