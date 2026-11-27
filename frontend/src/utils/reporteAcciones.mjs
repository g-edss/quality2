export function normalizarBusqueda(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function filtrarAcciones(acciones, filtros) {
  const busqueda = normalizarBusqueda(filtros.busqueda);
  return acciones.filter(accion => {
    if (filtros.estado && accion.estadoInterno !== filtros.estado) return false;
    if (filtros.proceso && String(accion.proceso_id) !== String(filtros.proceso)) return false;
    if (filtros.responsable && String(accion.responsable_id) !== String(filtros.responsable)) return false;
    const texto = [ `AC-${accion.id}`, accion.titulo, accion.area,
      accion.responsableLevantamiento, accion.responsableSeguimiento, accion.descripcion ].join(' ');
    return !busqueda || normalizarBusqueda(texto).includes(busqueda);
  });
}

export function celdaCsv(valor) {
  let texto = String(valor ?? '');
  if (/^\s*[=+\-@]/.test(texto) || /^[\t\r\n]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replaceAll('"', '""')}"`;
}

export function generarCsvAcciones(acciones) {
  const encabezados = ['ID', 'Título', 'Proceso', 'Estado', 'Tipo', 'Prioridad',
    'Solicitante', 'Responsable', 'Fecha de ocurrencia', 'Fecha de registro',
    'Fecha compromiso', 'Origen', 'Descripción', 'Última actualización',
    'Último comentario', 'Último comentario de revisión', 'Fecha de cierre',
    'Cerrada por', 'Entradas de historial', 'Archivos de evidencia'];
  const filas = acciones.map(accion => {
    const historial = accion.seguimientos || [];
    const ultimo = historial.at(-1);
    const revision = historial.filter(item => ['aceptacion', 'correcciones'].includes(item.tipo)).at(-1);
    return [`AC-${accion.id}`, accion.titulo, accion.area, accion.estado, accion.tipo,
      accion.prioridad, accion.responsableLevantamiento, accion.responsableSeguimiento,
      accion.fecha_ocurrencia, accion.creado_en, accion.fecha_compromiso, accion.origen,
      accion.descripcion, ultimo?.fecha || accion.creado_en, ultimo?.comentario,
      revision?.comentario, accion.cerrado_en, accion.cerrado_por_nombre, historial.length,
      historial.reduce((total, item) => total + (item.evidencias?.length || 0), 0)];
  });
  return '\uFEFF' + [encabezados, ...filas].map(fila => fila.map(celdaCsv).join(',')).join('\r\n');
}
