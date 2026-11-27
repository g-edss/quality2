import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarBusqueda, filtrarAcciones, celdaCsv, generarCsvAcciones } from '../src/utils/reporteAcciones.mjs';

const acciones = [
  { id: 1, titulo: 'Corregir auditoría', area: 'Gestión de calidad', proceso_id: 10,
    responsable_id: 20, responsableSeguimiento: 'Benito', responsableLevantamiento: 'Administrador',
    estadoInterno: 'cerrada', estado: 'Cerrada', tipo: 'Correctiva', prioridad: 'Media',
    descripcion: 'Revisar, corregir y documentar', fecha_ocurrencia: '2026-09-28',
    creado_en: '2026-09-28T10:00:00Z', cerrado_en: '2026-09-28T12:00:00Z', cerrado_por_nombre: 'Administrador',
    seguimientos: [
      { fecha: '2026-09-28T11:00:00Z', comentario: 'Corregir "el formato"\nAñadir evidencia', tipo: 'correcciones', evidencias: [] },
      { fecha: '2026-09-28T11:30:00Z', comentario: 'Terminado', tipo: 'avance', evidencias: [{ id: 1 }, { id: 2 }] },
      { fecha: '2026-09-28T12:00:00Z', comentario: 'Aceptada', tipo: 'aceptacion', evidencias: [] },
    ] },
  { id: 2, titulo: 'Actualizar formato', area: 'Laboratorio', proceso_id: 11,
    responsable_id: 21, responsableSeguimiento: 'Sandra', estadoInterno: 'en_revision', estado: 'En revisión', seguimientos: [] },
];
const filtros = { busqueda: '', estado: '', proceso: '', responsable: '' };

test('búsqueda por ID, título, proceso y personas sin depender de acentos', () => {
  assert.equal(normalizarBusqueda(' AUDITORÍA '), 'auditoria');
  for (const busqueda of ['ac-1', 'auditoria', 'gestion', 'benito', 'administrador']) {
    assert.deepEqual(filtrarAcciones(acciones, { ...filtros, busqueda }).map(a => a.id), [1]);
  }
  assert.equal(filtrarAcciones(acciones, { ...filtros, busqueda: 'no existe' }).length, 0);
});

test('filtros combinados, IDs del selector y lista original conservada', () => {
  assert.equal(filtrarAcciones(acciones, filtros).length, 2);
  assert.deepEqual(filtrarAcciones(acciones, { ...filtros, estado: 'cerrada', proceso: '10', responsable: '20' }).map(a => a.id), [1]);
  assert.equal(filtrarAcciones(acciones, { ...filtros, estado: 'cerrada', responsable: 21 }).length, 0);
  assert.equal(acciones.length, 2);
  assert.deepEqual(filtrarAcciones([acciones[1]], { ...filtros, busqueda: 'benito' }), []);
});

test('celdas CSV: comillas, comas, saltos y fórmulas', () => {
  assert.equal(celdaCsv('Texto, "citado"\nsegunda línea'), '"Texto, ""citado""\nsegunda línea"');
  assert.equal(celdaCsv(null), '""');
  for (const valor of ['=SUM(A1)', '+cmd', '-cmd', '@SUM(A1)', '  =SUM(A1)', '\ttexto']) {
    assert.ok(celdaCsv(valor).startsWith('"\''));
  }
});

test('CSV contiene solamente los resultados filtrados y resumen del historial', () => {
  const visibles = filtrarAcciones(acciones, { ...filtros, estado: 'cerrada' });
  const csv = generarCsvAcciones(visibles);
  assert.ok(csv.startsWith('\uFEFF"ID","Título"'));
  assert.ok(csv.includes('"AC-1"'));
  assert.ok(!csv.includes('"AC-2"'));
  assert.ok(csv.includes('"Revisar, corregir y documentar"'));
  assert.ok(csv.includes('"2026-09-28T12:00:00Z","Aceptada","Aceptada"'));
  assert.ok(csv.endsWith('"Administrador","3","2"'));
  assert.equal(generarCsvAcciones([]).split('\r\n').length, 1);
});
