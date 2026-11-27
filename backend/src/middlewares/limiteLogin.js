const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

const intentos = new Map();

function normalizarCorreo(correo) {
  return String(correo || '').trim().toLowerCase();
}

export function revisarBloqueo(req, res, next) {
  const registro = intentos.get(normalizarCorreo(req.body?.correo));
  const ahora = Date.now();

  if (registro?.bloqueadoHasta > ahora) {
    const segundos = Math.ceil((registro.bloqueadoHasta - ahora) / 1000);
    const minutos = Math.ceil(segundos / 60);
    res.set('Retry-After', String(segundos));
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} e inténtalo de nuevo.`,
    });
  }

  next();
}

export function registrarFallo(correo) {
  const clave = normalizarCorreo(correo);
  const ahora = Date.now();
  let registro = intentos.get(clave);

  if (!registro || ahora - registro.primerFallo > VENTANA_MS) {
    registro = { fallidos: 0, primerFallo: ahora, bloqueadoHasta: 0 };
  }

  registro.fallidos += 1;
  if (registro.fallidos >= MAX_INTENTOS) {
    registro.bloqueadoHasta = ahora + VENTANA_MS;
  }

  intentos.set(clave, registro);
}

export function limpiarIntentos(correo) {
  intentos.delete(normalizarCorreo(correo));
}

setInterval(() => {
  const ahora = Date.now();
  for (const [clave, registro] of intentos) {
    if (ahora - registro.primerFallo > VENTANA_MS && registro.bloqueadoHasta < ahora) {
      intentos.delete(clave);
    }
  }
}, VENTANA_MS).unref();
