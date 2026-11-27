<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import BaseCard from '@/components/BaseCard.vue';
import AppIcon from '@/components/AppIcon.vue';
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth';
import { ADMIN_ROLE, tienePermiso } from '@/config/permisos';

const auth = useAuthStore();

const esAdmin = computed(() => auth.usuario?.rol_clave === ADMIN_ROLE);
const puedeAdministrar = computed(() => tienePermiso(auth.usuario, 'catalogo.usuarios'));
const avisoPermisos = ref('');

const usuarios = ref([]);

const cargando = ref(false);
const errorCarga = ref('');
const falloCarga = ref(false);

async function cargarUsuarios() {
  cargando.value = true;
  errorCarga.value = '';
  falloCarga.value = false;
  try {
    const datos = await api.get('/usuarios');
    usuarios.value = datos.map((u) => ({
      ...u,
      estado: u.activo === false ? 'Inactivo' : 'Activo',
    }));
  } catch (e) {
    usuarios.value = [];
    falloCarga.value = true;
    errorCarga.value = 'No se pudieron cargar los usuarios. Intenta de nuevo cuando el servidor esté disponible.';
  } finally {
    cargando.value = false;
  }
}

onMounted(cargarUsuarios);

/* ---------- Catálogo de permisos (viene del backend, única fuente) ---------- */
const catalogo = ref(null);
const errorCatalogo = ref('');
let cargaCatalogo = null;

function cargarCatalogo() {
  cargaCatalogo ??= api.get('/permisos/catalogo')
    .then((datos) => { catalogo.value = datos; })
    .catch(() => {
      errorCatalogo.value = 'No se pudo cargar el catálogo de permisos. Recarga la página.';
      cargaCatalogo = null;
    });
  return cargaCatalogo;
}

onMounted(cargarCatalogo);

const catalogosPermisos = computed(() => catalogo.value?.catalogos ?? []);
const accionesRegistro = computed(() => catalogo.value?.accionesRegistro ?? []);

const modulosPermisos = computed(() =>
  (catalogo.value?.modulos ?? []).map((m) => ({
    ...m,
    visibles: m.conectado ? m.acciones : m.acciones.slice(0, 1),
  }))
);

function permisosPorDefecto(rolClave) {
  return [...(catalogo.value?.porRol?.[rolClave]?.permisos ?? [])];
}

function permisoRegistroPorDefecto(rolClave, accion) {
  return Boolean(catalogo.value?.porRol?.[rolClave]?.registros?.[accion]);
}

const ROLES = [
  { clave: 'admin_general', nombre: 'Administrador General' },
  { clave: 'responsable', nombre: 'Responsable' },
  { clave: 'revisor', nombre: 'Revisor' },
  { clave: 'aprobador', nombre: 'Aprobador' },
  { clave: 'visor', nombre: 'Visor' },
];

function nombreRol(clave) {
  return ROLES.find((r) => r.clave === clave)?.nombre || clave;
}

/* ---------- Búsqueda y paginación ---------- */
const busqueda = ref('');
const filasPorPagina = ref(10);
const pagina = ref(1);

const usuariosFiltrados = computed(() => {
  const t = busqueda.value.trim().toLowerCase();
  if (!t) return usuarios.value;
  return usuarios.value.filter((u) =>
    [u.nombre, u.correo, u.telefono, u.puesto, nombreRol(u.rol_clave), u.estado].join(' ').toLowerCase().includes(t)
  );
});

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(usuariosFiltrados.value.length / filasPorPagina.value))
);
const usuariosPagina = computed(() =>
  usuariosFiltrados.value.slice(
    (pagina.value - 1) * filasPorPagina.value,
    pagina.value * filasPorPagina.value
  )
);

/* ---------- Modal ---------- */
const modalUsuario = ref(null);
const usuarioABorrar = ref(null);
const errores = ref({});
const guardando = ref(false);
const accesoNuevo = ref(null);

const esNuevo = computed(() => modalUsuario.value === 'nuevo');

/* ---------- Permisos ---------- */
const TABS_PERMISOS = [
  { clave: 'catalogos', nombre: 'Catálogos' },
  { clave: 'modulos', nombre: 'Módulos' },

  { clave: 'documentos', nombre: 'Documentos', soloAdmin: true },
  { clave: 'registros', nombre: 'Almacén de Registros', soloAdmin: true },
];

const tabPermisos = ref('catalogos');
const tabsVisibles = computed(() => TABS_PERMISOS.filter((t) => !t.soloAdmin || esAdmin.value));
const opcionesTab = computed(() => (tabPermisos.value === 'catalogos' ? catalogosPermisos.value : []));

const permisos = ref([]);
const permisosOriginales = ref([]);

const permisosFijos = computed(() => form.value.rol_clave === ADMIN_ROLE);
const permisosEditables = computed(() => esAdmin.value && !permisosFijos.value);

function permisoActivo(permiso) {
  return permisosFijos.value || permisos.value.includes(permiso);
}

function alternarPermiso(permiso) {
  if (!permisosEditables.value) return;
  permisos.value = permisos.value.includes(permiso)
    ? permisos.value.filter((p) => p !== permiso)
    : [...permisos.value, permiso];
}

/* ---------- Pestaña Módulos: lista desplegable + acciones ---------- */
const moduloSeleccionado = ref('');
const moduloActual = computed(
  () => modulosPermisos.value.find((m) => m.clave === moduloSeleccionado.value) ?? modulosPermisos.value[0]
);

function contarActivas(modulo) {
  return modulo.visibles.filter((a) => permisoActivo(a.permiso)).length;
}

const moduloCompleto = computed(
  () => Boolean(moduloActual.value) && contarActivas(moduloActual.value) === moduloActual.value.visibles.length
);

function accionesAlEncender(modulo) {
  const deModulo = modulo.acciones.map((a) => a.permiso);
  const ocultasPorDefecto = modulo.conectado
    ? []
    : permisosPorDefecto(form.value.rol_clave).filter((p) => deModulo.includes(p));
  const permisoVer = modulo.mostrarVerModulo === false
    ? []
    : [modulo.acciones[0].permiso];

  return [...permisoVer, ...ocultasPorDefecto];
}

function alternarAccionModulo(permiso) {
  if (!permisosEditables.value) return;

  const modulo = moduloActual.value;
  const permisoVer = modulo.mostrarVerModulo === false
    ? null
    : modulo.acciones[0]?.permiso;
  const deModulo = modulo.acciones.map((a) => a.permiso);
  const encendida = permisos.value.includes(permiso);

  if (encendida && permisoVer && permiso === permisoVer) {
    permisos.value = permisos.value.filter((p) => !deModulo.includes(p));
  } else if (encendida) {
    permisos.value = permisos.value.filter((p) => p !== permiso);
  } else {
    permisos.value = [
      ...new Set([...permisos.value, permiso, ...accionesAlEncender(modulo)]),
    ];
  }
}

function alternarTodoModulo() {
  if (!permisosEditables.value) return;
  const modulo = moduloActual.value;
  const deModulo = modulo.acciones.map((a) => a.permiso);
  const encender = modulo.conectado ? deModulo : accionesAlEncender(modulo);
  permisos.value = moduloCompleto.value
    ? permisos.value.filter((p) => !deModulo.includes(p))
    : [...new Set([...permisos.value, ...encender])];
}

function alCambiarRol() {
  if (!esAdmin.value) return;
  permisos.value = permisosPorDefecto(form.value.rol_clave);
  if (formatosCargados.value) matrizRegistros.value = matrizPorDefecto(form.value.rol_clave);
}

function mismosPermisos(a, b) {
  return [...a].sort().join() === [...b].sort().join();
}

async function guardarPermisosSiCambiaron(usuarioId, permisosActuales) {
  if (!esAdmin.value || permisosFijos.value) return permisosActuales;
  if (mismosPermisos(permisos.value, permisosActuales)) return permisosActuales;

  const { permisos: guardados } = await api.put(`/usuarios/${usuarioId}/permisos`, {
    permisos: permisos.value,
  });
  return guardados;
}

/* ---------- Documentos visibles en el Visor ---------- */
const documentosVisor = ref([]);
const documentosCargados = ref(false);
const cargandoDocumentos = ref(false);
const errorDocumentos = ref('');
const busquedaDocumentos = ref('');
const ocultos = ref([]);
const ocultosOriginales = ref([]);

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const documentosFiltrados = computed(() => {
  const termino = normalizar(busquedaDocumentos.value.trim());
  if (!termino) return documentosVisor.value;
  return documentosVisor.value.filter((d) =>
    normalizar([d.proceso, d.tipo, d.codigo, d.nombre].join(' ')).includes(termino)
  );
});

const totalVisibles = computed(
  () => documentosVisor.value.filter((d) => documentoVisible(d.id)).length
);

const todosFiltradosVisibles = computed(
  () => documentosFiltrados.value.length > 0 &&
    documentosFiltrados.value.every((d) => documentoVisible(d.id))
);

function documentoVisible(id) {
  return permisosFijos.value || !ocultos.value.includes(id);
}

function alternarDocumento(id) {
  if (!permisosEditables.value) return;
  ocultos.value = ocultos.value.includes(id)
    ? ocultos.value.filter((x) => x !== id)
    : [...ocultos.value, id];
}

function alternarFiltrados() {
  if (!permisosEditables.value) return;
  const ids = documentosFiltrados.value.map((d) => d.id);
  ocultos.value = todosFiltradosVisibles.value
    ? [...new Set([...ocultos.value, ...ids])]
    : ocultos.value.filter((id) => !ids.includes(id));
}

async function cargarDocumentosDelUsuario(usuario) {
  if (!esAdmin.value) return;
  cargandoDocumentos.value = true;
  errorDocumentos.value = '';
  try {
    const [lista, ocultosUsuario] = await Promise.all([
      documentosCargados.value ? documentosVisor.value : api.get('/documentos/visor'),
      usuario && usuario.rol_clave !== ADMIN_ROLE
        ? api.get(`/usuarios/${usuario.id}/documentos-ocultos`)
        : { documentos: [] },
    ]);
    documentosVisor.value = lista;
    documentosCargados.value = true;

    if (modalUsuario.value === (usuario || 'nuevo')) {
      ocultosOriginales.value = ocultosUsuario.documentos;
      ocultos.value = [...ocultosUsuario.documentos];
    }
  } catch {
    errorDocumentos.value = 'No se pudieron cargar los documentos.';
  } finally {
    cargandoDocumentos.value = false;
  }
}

async function guardarOcultosSiCambiaron(usuarioId) {
  if (!esAdmin.value || permisosFijos.value || errorDocumentos.value) return;
  if (mismosPermisos(ocultos.value, ocultosOriginales.value)) return;
  await api.put(`/usuarios/${usuarioId}/documentos-ocultos`, { documentos: ocultos.value });
}

/* ---------- Almacén de Registros (permisos por formato) ---------- */
const formatosRegistro = ref([]);
const formatosCargados = ref(false);
const cargandoRegistros = ref(false);
const errorRegistros = ref('');
const busquedaRegistros = ref('');

const matrizRegistros = ref({});
const matrizRegistrosOriginal = ref({});

function matrizPorDefecto(rolClave) {
  return Object.fromEntries(
    formatosRegistro.value.map((f) => [
      f.documento_registro_id,
      Object.fromEntries(
        accionesRegistro.value.map((a) => [a.clave, permisoRegistroPorDefecto(rolClave, a.clave)])
      ),
    ])
  );
}

const formatosFiltrados = computed(() => {
  const termino = normalizar(busquedaRegistros.value.trim());
  if (!termino) return formatosRegistro.value;
  return formatosRegistro.value.filter((f) =>
    normalizar([f.proceso, f.codigo, f.nombre].join(' ')).includes(termino)
  );
});

function permisoRegistro(documentoId, accion) {
  return permisosFijos.value || Boolean(matrizRegistros.value[documentoId]?.[accion]);
}

function alternarPermisoRegistro(documentoId, accion) {
  if (!permisosEditables.value) return;
  const fila = matrizRegistros.value[documentoId] || {};
  matrizRegistros.value = {
    ...matrizRegistros.value,
    [documentoId]: { ...fila, [accion]: !fila[accion] },
  };
}

function columnaCompleta(accion) {
  return formatosFiltrados.value.length > 0 &&
    formatosFiltrados.value.every((f) => permisoRegistro(f.documento_registro_id, accion));
}

function alternarColumna(accion) {
  if (!permisosEditables.value) return;
  const valor = !columnaCompleta(accion);
  const nueva = { ...matrizRegistros.value };
  for (const f of formatosFiltrados.value) {
    nueva[f.documento_registro_id] = { ...nueva[f.documento_registro_id], [accion]: valor };
  }
  matrizRegistros.value = nueva;
}

async function cargarRegistrosDelUsuario(usuario) {
  if (!esAdmin.value) return;
  cargandoRegistros.value = true;
  errorRegistros.value = '';
  try {
    if (!formatosCargados.value) {
      formatosRegistro.value = await api.get('/registros/formatos');
      formatosCargados.value = true;
    }
    let matriz = matrizPorDefecto(usuario ? usuario.rol_clave : form.value.rol_clave);
    if (usuario && usuario.rol_clave !== ADMIN_ROLE) {
      const { formatos } = await api.get(`/usuarios/${usuario.id}/permisos-registros`);
      matriz = Object.fromEntries(formatos.map(({ documento_id, ...acciones }) => [documento_id, acciones]));
    }

    if (modalUsuario.value === (usuario || 'nuevo')) {
      matrizRegistrosOriginal.value = matriz;
      matrizRegistros.value = JSON.parse(JSON.stringify(matriz));
    }
  } catch {
    errorRegistros.value = 'No se pudieron cargar los formatos de registro.';
  } finally {
    cargandoRegistros.value = false;
  }
}

async function guardarPermisosRegistrosSiCambiaron(usuarioId) {
  if (!esAdmin.value || permisosFijos.value || errorRegistros.value || !formatosCargados.value) return;
  if (JSON.stringify(matrizRegistros.value) === JSON.stringify(matrizRegistrosOriginal.value)) return;
  await api.put(`/usuarios/${usuarioId}/permisos-registros`, {
    formatos: formatosRegistro.value.map((f) => ({
      documento_id: f.documento_registro_id,
      ...Object.fromEntries(
        accionesRegistro.value.map((a) => [a.clave, permisoRegistro(f.documento_registro_id, a.clave)])
      ),
    })),
  });
}

const rolesDisponibles = computed(() =>
  esAdmin.value ? ROLES : ROLES.filter((r) => r.clave !== ADMIN_ROLE)
);

function puedeModificar(usuario) {
  return puedeAdministrar.value && (esAdmin.value || usuario.rol_clave !== ADMIN_ROLE);
}

const form = ref({
  id: null, nombre: '', correo: '', telefono: '',
  puesto: '', rol_clave: 'visor', contrasena: '', estado: 'Activo',
});

watch(modalUsuario, async (val) => {
  errores.value = {};
  tabPermisos.value = 'catalogos';

  if (val && !catalogo.value) await cargarCatalogo();
  if (modalUsuario.value !== val) return;
  moduloSeleccionado.value = modulosPermisos.value[0]?.clave ?? '';
  if (val === 'nuevo') {
    form.value = { id: null, nombre: '', correo: '', telefono: '', puesto: '', rol_clave: 'visor', contrasena: '', estado: 'Activo' };
    permisosOriginales.value = permisosPorDefecto('visor');
  } else if (val && typeof val === 'object') {
    form.value = { ...val, telefono: val.telefono || '', puesto: val.puesto || '', contrasena: '' };
    permisosOriginales.value = [...(val.permisos || [])];
  }
  permisos.value = [...permisosOriginales.value];
  busquedaDocumentos.value = '';
  ocultos.value = [];
  ocultosOriginales.value = [];
  busquedaRegistros.value = '';
  matrizRegistros.value = {};
  matrizRegistrosOriginal.value = {};
  if (val) {
    cargarDocumentosDelUsuario(val === 'nuevo' ? null : val);
    cargarRegistrosDelUsuario(val === 'nuevo' ? null : val);
  }
});

function cerrarModal() { modalUsuario.value = null; errores.value = {}; }

function validar() {
  const e = {};
  if (!form.value.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
  if (!form.value.correo.trim()) e.correo = 'El correo es obligatorio.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.correo)) e.correo = 'Correo inválido.';
  if (!form.value.rol_clave) e.rol_clave = 'Selecciona un rol.';
  if (form.value.telefono.length > 30 ||
    (form.value.telefono.trim() && !/^[0-9+()\-\s]+$/.test(form.value.telefono))) {
    e.telefono = 'Escribe un teléfono válido de hasta 30 caracteres.';
  }
  if (!esNuevo.value && form.value.contrasena && form.value.contrasena.length < 10) {
    e.contrasena = 'La contraseña temporal debe tener al menos 10 caracteres.';
  }
  errores.value = e;
  return Object.keys(e).length === 0;
}

async function guardar() {
  if (!validar()) return;
  guardando.value = true;
  avisoPermisos.value = '';
  let usuarioGuardado = null;

  try {
    if (esNuevo.value) {
      const nuevo = await api.post('/usuarios', {
        nombre: form.value.nombre.trim(),
        correo: form.value.correo.trim(),
        telefono: form.value.telefono.trim(),
        puesto: form.value.puesto.trim() || null,
        rol_clave: form.value.rol_clave,
      });
      const { password_temporal, ...usuario } = nuevo;
      usuarioGuardado = { ...usuario, estado: 'Activo' };
      usuarios.value.unshift(usuarioGuardado);
      accesoNuevo.value = { correo: nuevo.correo, password: password_temporal };
    } else {
      const actualizado = await api.put(`/usuarios/${form.value.id}`, {
        nombre: form.value.nombre.trim(),
        correo: form.value.correo.trim(),
        telefono: form.value.telefono.trim(),
        puesto: form.value.puesto.trim() || null,
        rol_clave: form.value.rol_clave,

        ...(esAdmin.value ? { estado: form.value.estado } : {}),

        ...(form.value.contrasena.trim() ? { password: form.value.contrasena.trim() } : {}),
      });
      usuarioGuardado = {
        ...actualizado,
        permisos: permisosOriginales.value,
        estado: actualizado.activo === false ? 'Inactivo' : 'Activo',
      };
      usuarios.value = usuarios.value.map((u) => (u.id === actualizado.id ? usuarioGuardado : u));
    }

    try {
      usuarioGuardado.permisos = await guardarPermisosSiCambiaron(
        usuarioGuardado.id,
        usuarioGuardado.permisos || []
      );
      await guardarOcultosSiCambiaron(usuarioGuardado.id);
      await guardarPermisosRegistrosSiCambiaron(usuarioGuardado.id);
      usuarios.value = usuarios.value.map((u) => (u.id === usuarioGuardado.id ? { ...usuarioGuardado } : u));
    } catch {
      avisoPermisos.value = `Se guardaron los datos de ${usuarioGuardado.nombre}, pero no sus permisos. Ábrelo de nuevo para intentarlo.`;
    }
    cerrarModal();
  } catch (e) {
    errores.value = {
      general: e.message?.includes('409')
        ? 'Ya existe un usuario con ese correo.'
        : e.message || 'No se pudo guardar. Verifica los datos o que tu sesión siga activa.',
    };
  } finally {
    guardando.value = false;
  }
}

async function confirmarBorrado() {
  if (!usuarioABorrar.value) return;

  try {
    await api.del(`/usuarios/${usuarioABorrar.value.id}`);

    usuarios.value = usuarios.value.map((u) =>
      u.id === usuarioABorrar.value.id ? { ...u, estado: 'Inactivo' } : u
    );
  } catch (e) {
    errorCarga.value = 'No se pudo desactivar el usuario. Intenta de nuevo.';
  } finally {
    usuarioABorrar.value = null;
  }
}

/* ---------- Exportar CSV ---------- */
function exportarCSV() {
  const enc = ['Nombre', 'Correo', 'Teléfono', 'Puesto', 'Rol', 'Estado'];
  const filas = usuariosFiltrados.value.map((u) => [u.nombre, u.correo, u.telefono, u.puesto, nombreRol(u.rol_clave), u.estado]);
  const txt = [enc, ...filas].map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + txt], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'usuarios.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function iniciales(nombre) {
  return (nombre || '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div>
        <h1>Usuarios</h1>
        <p>Catálogo de usuarios del sistema y sus permisos.</p>
      </div>
      <button v-if="puedeAdministrar" class="btn btn-primary" @click="modalUsuario = 'nuevo'">
        <AppIcon name="plus" :size="16" /> Nuevo usuario
      </button>
    </div>

    <div v-if="avisoPermisos" class="error-banner">{{ avisoPermisos }}</div>

    <div v-if="errorCarga" class="error-banner">
      {{ errorCarga }}
      <button class="btn btn-ghost btn-sm" type="button" :disabled="cargando"
        @click="cargarUsuarios">Reintentar</button>
    </div>

    <BaseCard>
      <!-- Toolbar -->
      <div class="toolbar">
        <label class="search-wrap">
          <AppIcon name="search" :size="15" />
          <input v-model="busqueda" type="text" placeholder="Buscar…" @input="pagina = 1" />
        </label>
        <div class="toolbar-right">
          <label class="rows-select">
            Mostrar
            <select v-model.number="filasPorPagina" @change="pagina = 1">
              <option v-for="n in [5, 10, 25, 50]" :key="n" :value="n">{{ n }}</option>
            </select>
            filas
          </label>
          <button class="btn btn-ghost btn-sm" :disabled="cargando || falloCarga || !usuariosFiltrados.length"
            @click="exportarCSV">Exportar CSV</button>
        </div>
      </div>

      <!-- Tabla -->
      <div class="tabla-scroll">
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Teléfono</th>
            <th>Puesto</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="8" class="empty-row">Cargando usuarios…</td>
          </tr>
          <tr v-for="u in usuariosPagina" :key="u.id">
            <td>
              <div class="avatar-circle">{{ iniciales(u.nombre) }}</div>
            </td>
            <td><strong>{{ u.nombre }}</strong></td>
            <td class="muted">{{ u.correo }}</td>
            <td class="muted">{{ u.telefono || '—' }}</td>
            <td>{{ u.puesto || '—' }}</td>
            <td>{{ nombreRol(u.rol_clave) }}</td>
            <td>
              <span class="badge" :class="u.estado === 'Activo' ? 'badge-ok' : 'badge-muted'">
                {{ u.estado }}
              </span>
            </td>
            <td>
              <div v-if="puedeModificar(u)" class="row-actions">
                <button class="action-btn edit" title="Editar" @click="modalUsuario = u">
                  <span aria-hidden="true">✎</span>
                </button>
                <button v-if="esAdmin" class="action-btn del" title="Desactivar" @click="usuarioABorrar = u">
                  <AppIcon name="plus" :size="14" style="transform:rotate(45deg)" />
                </button>
              </div>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="!cargando && usuariosPagina.length === 0">
            <td colspan="8" class="empty-row">{{ falloCarga ? 'No hay usuarios disponibles mientras falla la conexión.'
              : 'No se encontraron usuarios.' }}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <!-- Paginación -->
      <div class="pagination">
        <span class="muted">Página {{ pagina }} de {{ totalPaginas }}</span>
        <div class="row" style="gap:8px">
          <button class="btn btn-ghost btn-sm" :disabled="pagina <= 1" @click="pagina--">Anterior</button>
          <button class="btn btn-ghost btn-sm" :disabled="pagina >= totalPaginas" @click="pagina++">Siguiente</button>
        </div>
      </div>
    </BaseCard>

    <!-- ===== MODAL USUARIO ===== -->
    <Teleport to="body">
      <div v-if="modalUsuario" class="overlay" @click="cerrarModal">
        <div class="modal modal-lg" @click.stop>
          <div class="modal-head">
            <h2>{{ esNuevo ? 'Nuevo usuario' : 'Editar usuario' }}</h2>
            <button class="modal-close" @click="cerrarModal">×</button>
          </div>
          <div class="modal-body">
            <div v-if="errores.general" class="error-banner">{{ errores.general }}</div>
            <div v-else-if="Object.keys(errores).length" class="error-banner">
              Revisa los campos marcados.
            </div>

            <label class="field">
              <span>Nombre</span>
              <input v-model="form.nombre" type="text" :class="{ 'input-error': errores.nombre }" />
              <small v-if="errores.nombre" class="err">{{ errores.nombre }}</small>
            </label>

            <label class="field">
              <span>Correo electrónico</span>
              <input v-model="form.correo" type="email" :class="{ 'input-error': errores.correo }" />
              <small v-if="errores.correo" class="err">{{ errores.correo }}</small>
            </label>

            <label class="field">
              <span>Teléfono</span>
              <input v-model="form.telefono" type="tel" maxlength="30" :class="{ 'input-error': errores.telefono }" />
              <small v-if="errores.telefono" class="err">{{ errores.telefono }}</small>
            </label>

            <label class="field">
              <span>Puesto</span>
              <input v-model="form.puesto" type="text" placeholder="Ej. Coordinador de Calidad" />
            </label>

            <label class="field">
              <span>Rol</span>
              <select v-model="form.rol_clave" :class="{ 'input-error': errores.rol_clave }" @change="alCambiarRol">
                <option v-for="r in rolesDisponibles" :key="r.clave" :value="r.clave">{{ r.nombre }}</option>
              </select>
              <small v-if="errores.rol_clave" class="err">{{ errores.rol_clave }}</small>
            </label>

            <p v-if="esNuevo" class="muted">El sistema generará una contraseña temporal. Se mostrará una sola vez al
              guardar.</p>

            <label v-if="!esNuevo" class="field">
              <span>Restablecer contraseña temporal (opcional)</span>
              <input v-model="form.contrasena" type="password" name="password-temporal-reset"
                autocomplete="new-password" placeholder="Dejar en blanco para no cambiarla"
                :class="{ 'input-error': errores.contrasena }" />
              <small v-if="errores.contrasena" class="err">{{ errores.contrasena }}</small>
              <small>Si la cambias, la persona tendrá que elegir una nueva al iniciar sesión.</small>
            </label>

            <label v-if="!esNuevo && esAdmin" class="field">
              <span>Estado</span>
              <select v-model="form.estado">
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>

            <section class="permisos">
              <h3 class="permisos-titulo">Permisos</h3>
              <div v-if="errorCatalogo" class="error-banner">{{ errorCatalogo }}</div>

              <div class="permisos-tabs" role="tablist">
                <button v-for="tab in tabsVisibles" :key="tab.clave" type="button" role="tab" class="permisos-tab"
                  :class="{ active: tabPermisos === tab.clave }" :aria-selected="tabPermisos === tab.clave"
                  @click="tabPermisos = tab.clave">
                  {{ tab.nombre }}
                </button>
              </div>

              <p v-if="permisosFijos" class="permisos-nota">El Administrador General tiene todos los permisos.</p>
              <p v-else-if="!esAdmin" class="permisos-nota">Solo el Administrador General puede cambiar los permisos.
              </p>
              <p v-else-if="esNuevo" class="permisos-nota">Se cargan los permisos del rol; puedes ajustarlos.</p>

              <div v-if="tabPermisos === 'catalogos'" class="permisos-grid" role="tabpanel">
                <div v-for="op in opcionesTab" :key="op.permiso" class="permiso-item">
                  <span :id="`permiso-${op.permiso}`">{{ op.nombre }}</span>
                  <button type="button" role="switch" class="switch" :class="{ on: permisoActivo(op.permiso) }"
                    :aria-checked="permisoActivo(op.permiso)" :aria-labelledby="`permiso-${op.permiso}`"
                    :disabled="!permisosEditables" @click="alternarPermiso(op.permiso)">
                    <span class="switch-knob"></span>
                  </button>
                </div>
              </div>

              <div v-else-if="tabPermisos === 'modulos' && moduloActual" class="modulos-panel" role="tabpanel">
                <select v-model="moduloSeleccionado" class="modulos-select" aria-label="Módulo">
                  <option v-for="m in modulosPermisos" :key="m.clave" :value="m.clave">
                    {{ m.nombre }} ({{ contarActivas(m) }}/{{ m.visibles.length }})
                  </option>
                </select>
                <p class="modulos-ayuda">Selecciona los permisos</p>

                <div class="modulos-todo">
                  <span id="permiso-todo-modulo">Seleccionar todo</span>
                  <button type="button" role="switch" class="switch" :class="{ on: moduloCompleto }"
                    :aria-checked="moduloCompleto" aria-labelledby="permiso-todo-modulo" :disabled="!permisosEditables"
                    @click="alternarTodoModulo">
                    <span class="switch-knob"></span>
                  </button>
                </div>

                <div class="modulos-lista">
                  <div v-for="a in moduloActual.visibles" :key="a.permiso" class="permiso-item">
                    <span :id="`permiso-${a.permiso}`">{{ a.nombre }}</span>
                    <button type="button" role="switch" class="switch" :class="{ on: permisoActivo(a.permiso) }"
                      :aria-checked="permisoActivo(a.permiso)" :aria-labelledby="`permiso-${a.permiso}`"
                      :disabled="!permisosEditables" @click="alternarAccionModulo(a.permiso)">
                      <span class="switch-knob"></span>
                    </button>
                  </div>
                </div>
                <p v-if="moduloActual.clave === 'almacenRegistros'" class="permisos-nota">
                  Los permisos por formato están en la pestaña Almacén de Registros.
                </p>
                <p v-else-if="!moduloActual.conectado" class="permisos-nota">
                  Las acciones de este módulo se agregarán más adelante.
                </p>
              </div>

              <div v-else-if="tabPermisos === 'documentos'" class="docs-panel" role="tabpanel">
                <p class="permisos-nota">
                  Documentos que esta persona puede consultar en el Visor Documental.
                  Los documentos nuevos se muestran a todos automáticamente.
                </p>

                <div class="docs-toolbar">
                  <div class="search-wrap docs-search">
                    <AppIcon name="search" :size="15" />
                    <input v-model="busquedaDocumentos" type="search"
                      placeholder="Buscar por proceso, tipo, código o nombre…" aria-label="Buscar documentos" />
                    <button v-if="busquedaDocumentos" type="button" class="docs-limpiar" aria-label="Limpiar búsqueda"
                      @click="busquedaDocumentos = ''">✕</button>
                  </div>
                  <span class="docs-contador">Ve {{ totalVisibles }} de {{ documentosVisor.length }}</span>
                </div>

                <div v-if="errorDocumentos" class="error-banner">{{ errorDocumentos }}</div>

                <div v-else class="docs-tabla-wrap">
                  <table class="docs-tabla">
                    <thead>
                      <tr>
                        <th>Proceso</th>
                        <th>Tipo de documento</th>
                        <th>Documento</th>
                        <th class="docs-col-switch">
                          <button type="button" role="switch" class="switch" :class="{ on: todosFiltradosVisibles }"
                            :aria-checked="todosFiltradosVisibles"
                            :disabled="!permisosEditables || !documentosFiltrados.length"
                            :title="busquedaDocumentos ? 'Mostrar u ocultar los resultados de la búsqueda' : 'Mostrar u ocultar todos'"
                            aria-label="Mostrar u ocultar todos los documentos de la lista" @click="alternarFiltrados">
                            <span class="switch-knob"></span>
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="cargandoDocumentos">
                        <td colspan="4" class="empty-row">Cargando documentos…</td>
                      </tr>
                      <tr v-else-if="!documentosFiltrados.length">
                        <td colspan="4" class="empty-row">
                          {{ busquedaDocumentos ? 'Ningún documento coincide con la búsqueda.' : 'No hay documentos vigentes.' }}
                        </td>
                      </tr>
                      <tr v-for="d in cargandoDocumentos ? [] : documentosFiltrados" :key="d.id"
                        :class="{ 'docs-oculto': !documentoVisible(d.id) }">
                        <td class="muted">{{ d.proceso || '—' }}</td>
                        <td class="muted">{{ d.tipo }}</td>
                        <td :id="`doc-${d.id}`">
                          <strong>{{ d.codigo }}</strong>
                          <span class="docs-nombre">{{ d.nombre }}</span>
                        </td>
                        <td class="docs-col-switch">
                          <button type="button" role="switch" class="switch" :class="{ on: documentoVisible(d.id) }"
                            :aria-checked="documentoVisible(d.id)" :aria-labelledby="`doc-${d.id}`"
                            :disabled="!permisosEditables" @click="alternarDocumento(d.id)">
                            <span class="switch-knob"></span>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-else class="docs-panel" role="tabpanel">
                <p class="permisos-nota">
                  Qué puede hacer esta persona con los registros de cada formato.
                </p>

                <div class="docs-toolbar">
                  <div class="search-wrap docs-search">
                    <AppIcon name="search" :size="15" />
                    <input v-model="busquedaRegistros" type="search" placeholder="Buscar por proceso, código o nombre…"
                      aria-label="Buscar formatos de registro" />
                    <button v-if="busquedaRegistros" type="button" class="docs-limpiar" aria-label="Limpiar búsqueda"
                      @click="busquedaRegistros = ''">✕</button>
                  </div>
                  <span class="docs-contador">{{ formatosFiltrados.length }} formatos</span>
                </div>

                <div v-if="errorRegistros" class="error-banner">{{ errorRegistros }}</div>

                <div v-else class="docs-tabla-wrap">
                  <table class="docs-tabla">
                    <thead>
                      <tr>
                        <th>Proceso</th>
                        <th>Formato de registro</th>
                        <th v-for="a in accionesRegistro" :key="a.clave" class="reg-col">
                          <label class="reg-encabezado">
                            <input type="checkbox" class="reg-check" :checked="columnaCompleta(a.clave)"
                              :disabled="!permisosEditables || !formatosFiltrados.length"
                              :aria-label="`Marcar o desmarcar ${a.nombre} en toda la lista`"
                              @change="alternarColumna(a.clave)" />
                            <span>{{ a.nombre }}</span>
                          </label>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="cargandoRegistros">
                        <td :colspan="2 + accionesRegistro.length" class="empty-row">Cargando formatos…</td>
                      </tr>
                      <tr v-else-if="!formatosFiltrados.length">
                        <td :colspan="2 + accionesRegistro.length" class="empty-row">
                          {{ busquedaRegistros ? 'Ningún formato coincide con la búsqueda.' : 'No hay formatos de registro vigentes.' }}
                        </td>
                      </tr>
                      <tr v-for="f in cargandoRegistros ? [] : formatosFiltrados" :key="f.documento_registro_id">
                        <td class="muted">{{ f.proceso || '—' }}</td>
                        <td>
                          <strong>{{ f.codigo }}</strong>
                          <span class="docs-nombre">{{ f.nombre }}</span>
                        </td>
                        <td v-for="a in accionesRegistro" :key="a.clave" class="reg-col">
                          <input type="checkbox" class="reg-check"
                            :checked="permisoRegistro(f.documento_registro_id, a.clave)" :disabled="!permisosEditables"
                            :aria-label="`${a.nombre} registros de ${f.codigo}`"
                            @change="alternarPermisoRegistro(f.documento_registro_id, a.clave)" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <div class="modal-actions">
              <button class="btn btn-ghost" @click="cerrarModal" :disabled="guardando">Cancelar</button>
              <button class="btn btn-primary" @click="guardar" :disabled="guardando">
                {{ guardando ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="accesoNuevo" class="overlay" @click="accesoNuevo = null">
        <div class="modal" @click.stop>
          <div class="modal-head">
            <h2>Cuenta creada</h2>
          </div>
          <div class="modal-body">
            <p>Entrega estos datos a la persona por un canal acordado. La contraseña solo se muestra ahora; todavía no
              se envía por correo.</p>
            <label class="field"><span>Correo</span><input :value="accesoNuevo.correo" readonly /></label>
            <label class="field"><span>Contraseña temporal</span><input :value="accesoNuevo.password"
                readonly /></label>
            <p>En el primer ingreso deberá cambiar la contraseña.</p>
            <div class="modal-actions"><button class="btn btn-primary" @click="accesoNuevo = null">Ya guardé los
                datos</button></div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===== MODAL ELIMINAR ===== -->
    <Teleport to="body">
      <div v-if="usuarioABorrar" class="overlay" @click="usuarioABorrar = null">
        <div class="modal modal-sm" @click.stop>
          <div class="modal-head">
            <h2>Desactivar usuario</h2>
            <button class="modal-close" @click="usuarioABorrar = null">×</button>
          </div>
          <div class="modal-body">
            <p>¿Seguro que quieres desactivar a <strong>{{ usuarioABorrar.nombre }}</strong>? No podrá iniciar sesión.
              Un administrador puede reactivarlo editando su estado.</p>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="usuarioABorrar = null">Cancelar</button>
              <button class="btn" style="background:var(--danger);color:#fff"
                @click="confirmarBorrado">Desactivar</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="../assets/styles/UsuariosView.css"></style>
