const MOTIVOS = {
  SESSION_REVOKED: 'restablecida',
  SESSION_EXPIRED: 'expirada',
};

export function cerrarSesionRevocada(estado, datos, token) {
  const motivo = MOTIVOS[datos?.code];
  if (estado !== 401 || !motivo || !token || localStorage.getItem('web360_token') !== token) {
    return false;
  }

  localStorage.removeItem('web360_token');
  localStorage.removeItem('web360_user');
  window.location.replace(`/login?sesion=${motivo}`);
  return true;
}
