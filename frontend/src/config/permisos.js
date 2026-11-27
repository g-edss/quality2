export const ADMIN_ROLE = "admin_general";

const PERMISO_POR_RUTA = {
  visorDocumental: "modulo.visorDocumental",
  documentos: "modulo.documentos",
  almacenRegistros: "modulo.almacenRegistros",
  solicitudes: "modulo.solicitudes",
  auditorias: "modulo.auditorias",
  accionesCorrectivas: "modulo.accionesCorrectivas",
  juntas: "modulo.juntas",
  indicadores: "catalogo.indicadores",
  usuarios: "catalogo.usuarios",
  procesos: "catalogo.procesos",
  normas: "catalogo.normas",
  auditores: "catalogo.auditores",
  tipoIndicador: "indicadores.tiposIndicador",
  unidadMedida: "indicadores.unidadesMedida",
};

export function tienePermiso(usuario, permiso) {
  if (!usuario) return false;
  if (usuario.rol_clave === ADMIN_ROLE) return true;
  return (usuario.permisos || []).includes(permiso);
}

export function puedeAcceder(usuario, nombreRuta) {
  if (!usuario) return false;
  if (nombreRuta === "dashboard") return true;

  const permiso = PERMISO_POR_RUTA[nombreRuta];
  return permiso ? tienePermiso(usuario, permiso) : false;
}
