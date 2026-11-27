import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { requirePermiso } from '../src/middlewares/auth.js';
import { validarPermisos } from '../src/services/permisos.service.js';
import { PERMISOS_VALIDOS, permisosPorDefecto, soloPermisosVigentes } from '../src/config/permisos.js';

function respuestaFalsa() {
  return {
    codigo: 200,
    cuerpo: null,
    status(codigo) { this.codigo = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; },
  };
}

async function ejecutar(middleware, req) {
  const res = respuestaFalsa();
  let paso = false;
  await middleware(req, res, () => { paso = true; });
  return { paso, res };
}

test('requirePermiso deja pasar al admin sin consultar la base', async () => {
  const consultarOriginal = pool.query;
  let consultas = 0;
  pool.query = async () => { consultas++; return { rows: [] }; };
  try {
    const { paso } = await ejecutar(requirePermiso('modulo.juntas'), {
      auth: { sub: 1, rol: 'admin_general' },
    });
    assert.equal(paso, true);
    assert.equal(consultas, 0);
  } finally {
    pool.query = consultarOriginal;
  }
});

test('requirePermiso revisa el permiso guardado del usuario', async () => {
  const consultarOriginal = pool.query;
  const parametros = [];
  pool.query = async (_sql, params) => {
    parametros.push(params);
    return { rows: params[1] === 'modulo.juntas' ? [{ '?column?': 1 }] : [] };
  };
  try {
    const conPermiso = await ejecutar(requirePermiso('modulo.juntas'), {
      auth: { sub: 5, rol: 'visor' },
    });
    assert.equal(conPermiso.paso, true);
    assert.deepEqual(parametros[0], [5, 'modulo.juntas']);

    const sinPermiso = await ejecutar(requirePermiso('modulo.auditorias'), {
      auth: { sub: 5, rol: 'visor' },
    });
    assert.equal(sinPermiso.paso, false);
    assert.equal(sinPermiso.res.codigo, 403);
  } finally {
    pool.query = consultarOriginal;
  }
});

test('solo se aceptan permisos conocidos y se quitan repetidos', () => {
  assert.deepEqual(
    validarPermisos(['modulo.juntas', 'catalogo.usuarios', 'modulo.juntas']),
    ['catalogo.usuarios', 'modulo.juntas']
  );
  assert.throws(() => validarPermisos(['modulo.inventado']), { status: 400 });
  assert.throws(() => validarPermisos('modulo.juntas'), { status: 400 });
});

test('cada rol arranca con su plantilla de permisos', () => {
  assert.deepEqual(permisosPorDefecto('visor').filter((p) => p.startsWith('modulo.')), ['modulo.visorDocumental']);
  assert.deepEqual(
    permisosPorDefecto('responsable').filter((p) => p.startsWith('modulo.')).sort(),
    ['modulo.almacenRegistros', 'modulo.juntas', 'modulo.solicitudes', 'modulo.visorDocumental'],
  );
  assert.ok(permisosPorDefecto('responsable').includes('catalogo.indicadores'));
  assert.ok(!permisosPorDefecto('revisor').some((p) => p.startsWith('catalogo.') && p !== 'catalogo.indicadores'));
  assert.equal(permisosPorDefecto('admin_general').length, PERMISOS_VALIDOS.size);
  assert.deepEqual(permisosPorDefecto('desconocido'), []);
});

test('quien ve Juntas arranca con todas sus acciones; el visor con ninguna', () => {
  const accionesJuntas = (rol) => permisosPorDefecto(rol).filter((p) => p.startsWith('juntas.'));
  for (const rol of ['responsable', 'revisor', 'aprobador']) {
    assert.equal(accionesJuntas(rol).length, 8, rol);
  }
  assert.equal(accionesJuntas('visor').length, 0);
});

test('los permisos guardados que ya no existen se ignoran', () => {
  assert.deepEqual(
    soloPermisosVigentes(['modulo.juntas', 'auditorias.seguimientoHallazgos', 'solicitudes.aprobar']),
    ['modulo.juntas']
  );
  assert.deepEqual(soloPermisosVigentes(null), []);
});