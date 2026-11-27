import test from 'node:test';
import assert from 'node:assert/strict';
import { cerrarSesionRevocada } from '../src/utils/sesion.mjs';

test('solo una sesión revocada elimina el acceso y muestra el inicio de sesión', () => {
  const almacenamientoOriginal = globalThis.localStorage;
  const ventanaOriginal = globalThis.window;
  const datos = new Map([
    ['web360_token', 'token-anterior'],
    ['web360_user', '{"id":7}'],
  ]);
  const destinos = [];
  globalThis.localStorage = {
    getItem: clave => datos.get(clave) ?? null,
    removeItem: clave => datos.delete(clave),
  };
  globalThis.window = { location: { replace: destino => destinos.push(destino) } };
  try {
    assert.equal(cerrarSesionRevocada(401, { error: 'Contraseña incorrecta' }, 'token-anterior'), false);
    assert.equal(cerrarSesionRevocada(403, { code: 'SESSION_REVOKED' }, 'token-anterior'), false);
    assert.equal(cerrarSesionRevocada(401, { code: 'SESSION_REVOKED' }, 'token-reemplazado'), false);
    assert.equal(datos.has('web360_token'), true);
    assert.equal(destinos.length, 0);

    assert.equal(cerrarSesionRevocada(401, { code: 'SESSION_REVOKED' }, 'token-anterior'), true);
    assert.equal(datos.has('web360_token'), false);
    assert.equal(datos.has('web360_user'), false);
    assert.deepEqual(destinos, ['/login?sesion=restablecida']);

    datos.set('web360_token', 'token-caducado');
    datos.set('web360_user', '{"id":7}');
    assert.equal(cerrarSesionRevocada(401, { code: 'SESSION_EXPIRED' }, 'token-caducado'), true);
    assert.equal(datos.has('web360_token'), false);
    assert.deepEqual(destinos, ['/login?sesion=restablecida', '/login?sesion=expirada']);
  } finally {
    if (almacenamientoOriginal === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = almacenamientoOriginal;
    if (ventanaOriginal === undefined) delete globalThis.window;
    else globalThis.window = ventanaOriginal;
  }
});
