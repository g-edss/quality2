import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { validarDocumentos } from '../src/services/documentosOcultos.service.js';
import { listarDocumentosVisor } from '../src/services/documentos.service.js';

test('solo se aceptan IDs enteros positivos y sin repetir', () => {
  assert.deepEqual(validarDocumentos([5, 2, 5]), [2, 5]);
  assert.deepEqual(validarDocumentos([]), []);
  assert.throws(() => validarDocumentos(['3']), { status: 400 });
  assert.throws(() => validarDocumentos([0]), { status: 400 });
  assert.throws(() => validarDocumentos(7), { status: 400 });
});

test('el Visor excluye los documentos ocultos del usuario', async () => {
  const consultarOriginal = pool.query;
  const llamadas = [];
  pool.query = async (sql, params) => {
    llamadas.push({ sql, params });
    return { rows: [] };
  };
  try {
    await listarDocumentosVisor({ usuarioId: 8 });
    await listarDocumentosVisor();
    assert.match(llamadas[0].sql, /usuario_documentos_ocultos/);
    assert.deepEqual(llamadas[0].params, [8]);
    assert.deepEqual(llamadas[1].params, [null]);
  } finally {
    pool.query = consultarOriginal;
  }
});
