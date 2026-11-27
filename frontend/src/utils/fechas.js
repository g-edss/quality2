const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function convertirAFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function mostrarFecha(valor, vacio = '—') {
  const fecha = convertirAFecha(valor);
  return fecha ? FORMATO_FECHA.format(fecha) : vacio;
}

export function mostrarFechaHora(valor, vacio = '—') {
  const fecha = convertirAFecha(valor);
  return fecha ? FORMATO_FECHA_HORA.format(fecha) : vacio;
}

export function hoyLocal() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export function diaLocal(valor) {
  const fecha = convertirAFecha(valor);
  if (!fecha) return '';
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function estaVencida(fecha) {
  return Boolean(fecha) && fecha < hoyLocal();
}

export function diasDeAtraso(fecha) {
  if (!estaVencida(fecha)) return 0;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [anioHoy, mesHoy, diaHoy] = hoyLocal().split('-').map(Number);
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.UTC(anioHoy, mesHoy - 1, diaHoy) - Date.UTC(anio, mes - 1, dia)) / MS_POR_DIA,
  );
}

export function textoAtraso(fecha, palabra = 'Vencido') {
  const dias = diasDeAtraso(fecha);
  return `${palabra} hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}
