import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../src/config/db.js';
import { iniciarSesion } from '../src/services/auth.service.js';
import { actualizar } from '../src/services/usuarios.service.js';
import { requireAuth } from '../src/middlewares/auth.js';

test('el restablecimiento incrementa la versión de sesión junto con la contraseña', async () => {
  const consultaOriginal = pool.query;
  let actualizacion;
  pool.query = async (sql, valores) => {
    if (sql.includes('UPDATE usuarios')) {
      actualizacion = { sql, valores };
      return { rows: [{ id: 7, rol_id: 2, debe_cambiar_password: true }] };
    }
    return { rows: [{ clave: 'responsable', nombre: 'Responsable' }] };
  };
  try {
    const usuario = await actualizar(7, { password: 'TemporalSegura123' });
    assert.match(actualizacion.sql, /version_sesion = version_sesion \+ 1/);
    assert.match(actualizacion.sql, /debe_cambiar_password = TRUE/);
    assert.equal(actualizacion.valores.at(-1), 7);
    assert.equal(await bcrypt.compare('TemporalSegura123', actualizacion.valores[0]), true);
    assert.equal(usuario.debe_cambiar_password, true);
  } finally {
    pool.query = consultaOriginal;
  }
});

test('el inicio de sesión incorpora la versión vigente al token', async () => {
  const consultaOriginal = pool.query;
  const secretoOriginal = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-de-prueba';
  pool.query = async () => ({ rows: [{
    id: 7,
    nombre: 'Usuario',
    correo: 'usuario@ejemplo.mx',
    password_hash: await bcrypt.hash('TemporalSegura123', 4),
    debe_cambiar_password: true,
    version_sesion: 2,
    rol_clave: 'responsable',
    rol: 'Responsable',
  }] });
  try {
    const sesion = await iniciarSesion({ correo: 'USUARIO@EJEMPLO.MX', password: 'TemporalSegura123' });
    assert.equal(jwt.verify(sesion.token, process.env.JWT_SECRET).ver, 2);
    assert.equal(sesion.usuario.debe_cambiar_password, true);
  } finally {
    pool.query = consultaOriginal;
    if (secretoOriginal === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretoOriginal;
  }
});

test('un token anterior al restablecimiento queda inválido', async () => {
  const consultaOriginal = pool.query;
  const secretoOriginal = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-de-prueba';
  pool.query = async () => ({ rows: [{ activo: true, debe_cambiar_password: true, version_sesion: 1 }] });
  const respuesta = {
    codigo: null,
    status(codigo) { this.codigo = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; },
  };
  let paso = false;
  try {
    const tokenAnterior = jwt.sign({ sub: 7, rol: 'responsable', ver: 0 }, process.env.JWT_SECRET);
    await requireAuth({ headers: { authorization: `Bearer ${tokenAnterior}` }, baseUrl: '/api/usuarios', path: '/password' }, respuesta, () => { paso = true; });
    assert.equal(respuesta.codigo, 401);
    assert.equal(respuesta.cuerpo.code, 'SESSION_REVOKED');
    assert.equal(paso, false);

    const tokenNuevo = jwt.sign({ sub: 7, rol: 'responsable', ver: 1 }, process.env.JWT_SECRET);
    await requireAuth({ headers: { authorization: `Bearer ${tokenNuevo}` }, baseUrl: '/api/usuarios', path: '/password' }, respuesta, () => { paso = true; });
    assert.equal(paso, true);
  } finally {
    pool.query = consultaOriginal;
    if (secretoOriginal === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretoOriginal;
  }
});
