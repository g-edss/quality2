export const ADMIN_ROLE = "admin_general";

const ROLES = ["responsable", "revisor", "aprobador", "visor"];
const TODOS = "todos";

export const MODULOS = [
  {
    clave: "visorDocumental",
    nombre: "Visor Documental",
    conectado: true,
    acciones: [
      {
        clave: "descargarOriginal",
        nombre: "Descargar archivo original",
        roles: TODOS,
      },
      {
        clave: "solicitarCopia",
        nombre: "Solicitar copia controlada",
        roles: TODOS,
      },
      {
        clave: "resolverCopias",
        nombre: "Resolver solicitudes de copias controladas",
        roles: [],
      },
    ],
  },
  {
    clave: "documentos",
    nombre: "Control de Documentos",
    conectado: true,

    acciones: [
      {
        clave: "crear",
        nombre: "Elaborar documentos (alta, corrección y envío a revisión)",
        roles: ["responsable"],
      },
      {
        clave: "confirmarRevision",
        nombre: "Confirmar revisión programada",
        roles: ["responsable"],
      },
      {
        clave: "reportes",
        nombre: "Ver reportes",
        roles: ["responsable", "revisor", "aprobador"],
      },
      {
        clave: "copiasControladas",
        nombre: "Gestionar copias controladas",
        roles: [],
      },
      {
        clave: "tiposDocumento",
        nombre: "Gestionar tipos de documento",
        roles: [],
      },
    ],
  },
  {
    clave: "almacenRegistros",
    nombre: "Almacén de Registros",
    conectado: true,
    acciones: [
      {
        clave: "crearFormato",
        nombre: "Crear formato de Registro",
        roles: ["responsable"],
      },
    ],
  },
  {
    clave: "solicitudes",
    nombre: "Solicitudes y Cambios",
    conectado: true,

    acciones: [
      { clave: "solicitarCambio", nombre: "Solicitar cambio", roles: TODOS },
      { clave: "solicitarBaja", nombre: "Solicitar baja", roles: TODOS },
      { clave: "cancelar", nombre: "Cancelar solicitud propia", roles: TODOS },
      { clave: "reenviar", nombre: "Reenviar con correcciones", roles: TODOS },
    ],
  },
  {
    clave: "auditorias",
    nombre: "Auditorías",
    conectado: true,

    acciones: [
      { clave: "planear", nombre: "Planear auditoría", roles: [] },
      { clave: "iniciar", nombre: "Iniciar ejecución", roles: [] },
      {
        clave: "hallazgos",
        nombre: "Gestionar hallazgos (registrar y revisar)",
        roles: [],
      },
      { clave: "finalizarInforme", nombre: "Finalizar informe", roles: [] },
      { clave: "reportes", nombre: "Ver reportes", roles: TODOS },
    ],
  },
  {
    clave: "accionesCorrectivas",
    nombre: "Acciones Correctivas",
    conectado: true,
    acciones: [
      { clave: "levantar", nombre: "Levantar acción correctiva", roles: [] },
      { clave: "modificar", nombre: "Modificar acciones", roles: [] },
      { clave: "seguimiento", nombre: "Dar seguimiento", roles: TODOS },
      { clave: "revisar", nombre: "Revisar acciones", roles: [] },
      {
        clave: "reportes",
        nombre: "Ver reportes y descargar CSV",
        roles: TODOS,
      },
    ],
  },
  {
    clave: "juntas",
    nombre: "Juntas y Sesiones",
    conectado: true,
    acciones: [
      { clave: "convocar", nombre: "Convocar junta", roles: TODOS },
      {
        clave: "modificar",
        nombre: "Modificar junta (datos y asistentes)",
        roles: TODOS,
      },
      { clave: "iniciar", nombre: "Iniciar junta", roles: TODOS },
      { clave: "minutas", nombre: "Capturar minutas", roles: TODOS },
      { clave: "compromisos", nombre: "Registrar compromisos", roles: TODOS },
      { clave: "avances", nombre: "Capturar avances", roles: TODOS },
      {
        clave: "revisarAvances",
        nombre: "Revisar avances (marcar cumplido)",
        roles: TODOS,
      },
      { clave: "cerrar", nombre: "Cerrar junta", roles: TODOS },
    ],
  },
  {
    clave: "indicadores",
    nombre: "Indicadores",
    conectado: true,
    mostrarVerModulo: false,
    acciones: [
      { clave: "tiposIndicador", nombre: "Tipos de Indicador", roles: [] },
      { clave: "unidadesMedida", nombre: "Unidades de Medida", roles: [] },
      {
        clave: "capturarMediciones",
        nombre: "Capturar mediciones",
        roles: TODOS,
      },
      { clave: "editarMediciones", nombre: "Editar mediciones", roles: TODOS },
      { clave: "eliminarMediciones", nombre: "Eliminar mediciones", roles: [] },
    ],
  },
];

export const CATALOGOS = [
  { permiso: "catalogo.usuarios", nombre: "Catálogo de Usuarios" },
  { permiso: "catalogo.procesos", nombre: "Catálogo de Procesos" },
  { permiso: "catalogo.auditores", nombre: "Catálogo de Auditores" },
  { permiso: "catalogo.indicadores", nombre: "Catálogo de Indicadores" },
];

const MODULOS_POR_ROL = {
  responsable: [
    "visorDocumental",
    "solicitudes",
    "almacenRegistros",
    "juntas",
    "indicadores",
  ],
  revisor: MODULOS.map((m) => m.clave),
  aprobador: MODULOS.map((m) => m.clave),
  visor: ["visorDocumental"],
};

export const permisoVer = (modulo) => `modulo.${modulo}`;
export const permisoAccion = (modulo, accion) => `${modulo}.${accion}`;

export function tieneAccionPorDefecto(rolClave, accion) {
  return accion.roles === TODOS || accion.roles.includes(rolClave);
}

export const PERMISOS_MODULOS = MODULOS.filter(
  (m) => m.mostrarVerModulo !== false,
).map((m) => permisoVer(m.clave));
export const PERMISOS_CATALOGOS = CATALOGOS.map((c) => c.permiso);
const PERMISOS_ACCIONES = MODULOS.flatMap((m) =>
  m.acciones.map((a) => permisoAccion(m.clave, a.clave)),
);

export const PERMISOS_VALIDOS = new Set([
  ...PERMISOS_MODULOS,
  ...PERMISOS_ACCIONES,
  ...PERMISOS_CATALOGOS,
]);

export function soloPermisosVigentes(permisos) {
  return (permisos || []).filter((permiso) => PERMISOS_VALIDOS.has(permiso));
}

export function permisosPorDefecto(rolClave) {
  if (rolClave === ADMIN_ROLE) return [...PERMISOS_VALIDOS];
  const modulos = MODULOS_POR_ROL[rolClave];
  if (!modulos) return [];

  return [
    ...MODULOS.filter((m) => modulos.includes(m.clave)).flatMap((m) => [
      ...(m.mostrarVerModulo === false ? [] : [permisoVer(m.clave)]),
      ...m.acciones
        .filter((a) => tieneAccionPorDefecto(rolClave, a))
        .map((a) => permisoAccion(m.clave, a.clave)),
    ]),
    ...(modulos.includes("indicadores") ? ["catalogo.indicadores"] : []),
  ];
}

export const ACCIONES_REGISTRO_DETALLE = [
  { clave: "cargar", nombre: "Cargar", roles: ["responsable"] },
  { clave: "descargar", nombre: "Descargar/PDF", roles: TODOS },
];

export const ACCIONES_REGISTRO = ACCIONES_REGISTRO_DETALLE.map((a) => a.clave);

export function permisoRegistroPorDefecto(rolClave, accion) {
  if (rolClave === ADMIN_ROLE) return true;
  const detalle = ACCIONES_REGISTRO_DETALLE.find((a) => a.clave === accion);
  return Boolean(detalle && tieneAccionPorDefecto(rolClave, detalle));
}

export function catalogoParaFrontend() {
  return {
    modulos: MODULOS.map((m) => ({
      clave: m.clave,
      nombre: m.nombre,
      conectado: m.conectado,
      mostrarVerModulo: m.mostrarVerModulo !== false,
      acciones: [
        ...(m.mostrarVerModulo === false
          ? []
          : [{ permiso: permisoVer(m.clave), nombre: "Ver módulo" }]),
        ...m.acciones.map((a) => ({
          permiso: permisoAccion(m.clave, a.clave),
          nombre: a.nombre,
        })),
      ],
    })),
    catalogos: CATALOGOS,
    accionesRegistro: ACCIONES_REGISTRO_DETALLE.map(({ clave, nombre }) => ({
      clave,
      nombre,
    })),
    porRol: Object.fromEntries(
      [ADMIN_ROLE, ...ROLES].map((rol) => [
        rol,
        {
          permisos: permisosPorDefecto(rol),
          registros: Object.fromEntries(
            ACCIONES_REGISTRO.map((a) => [
              a,
              permisoRegistroPorDefecto(rol, a),
            ]),
          ),
        },
      ]),
    ),
  };
}
