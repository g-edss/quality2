<script setup>
import { useRoute, useRouter } from 'vue-router';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import PerfilModal from './PerfilModal.vue';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api/client';
import { puedeAcceder } from '@/config/permisos';

const emit = defineEmits(['abrir-menu']);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const perfilAbierto = ref(false);
const notificaciones = ref([]);
const noLeidas = ref(0);
const notificacionesAbiertas = ref(false);
const cargandoNotificaciones = ref(false);
const errorNotificaciones = ref('');
const textoBusqueda = ref('');
const resultadosBusqueda = ref([]);
const busquedaAbierta = ref(false);
const cargandoBusqueda = ref(false);
const errorBusqueda = ref('');
const contenedorBusqueda = ref(null);
let temporizadorBusqueda;
let secuenciaBusqueda = 0;
let temporizadorNotificaciones;
let sincronizandoNotificaciones = false;

const titulos = {
  dashboard: 'Inicio',
  procesos: 'Procesos',
  visorDocumental: 'Visor Documental',
  documentos: 'Control de Documentos',
  almacenRegistros: 'Almacén de Registros',
  solicitudes: 'Solicitudes', auditorias: 'Auditorías', juntas: 'Juntas',
  usuarios: 'Usuarios',
  auditores: 'Auditores',
  indicadores: 'Indicadores',
  tipoIndicador: 'Tipos de Indicador',
  unidadMedida: 'Unidades de Medida',
  accionesCorrectivas: 'Acciones Correctivas',
};

const titulo = computed(() => titulos[route.name] || 'WEB 360 de Calidad');

const iniciales = computed(() => {
  const n = auth.usuario?.nombre || 'U';
  return n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
});

async function cargarNotificaciones(silencioso = false) {
  if (sincronizandoNotificaciones) return;
  sincronizandoNotificaciones = true;
  if (!silencioso) {
    cargandoNotificaciones.value = true;
    errorNotificaciones.value = '';
  }

  try {
    const datos = await api.get('/notificaciones');

    notificaciones.value = datos.notificaciones;
    noLeidas.value = datos.no_leidas;
  } catch (error) {
    if (!silencioso) {
      errorNotificaciones.value =
        error.message || 'No se pudieron cargar las notificaciones.';
    }
  } finally {
    cargandoNotificaciones.value = false;
    sincronizandoNotificaciones = false;
  }
}

function sincronizarNotificaciones() {
  if (!document.hidden) cargarNotificaciones(true);
}

onMounted(() => {
  cargarNotificaciones();
  temporizadorNotificaciones = window.setInterval(sincronizarNotificaciones, 30000);
  window.addEventListener('focus', sincronizarNotificaciones);
  document.addEventListener('visibilitychange', sincronizarNotificaciones);
});

watch(textoBusqueda, (valor) => {
  clearTimeout(temporizadorBusqueda);
  secuenciaBusqueda += 1;
  resultadosBusqueda.value = [];
  errorBusqueda.value = '';
  const texto = valor.trim();
  if (texto.length < 2) {
    cargandoBusqueda.value = false;
    busquedaAbierta.value = false;
    return;
  }
  busquedaAbierta.value = true;
  cargandoBusqueda.value = true;
  const secuencia = secuenciaBusqueda;
  temporizadorBusqueda = setTimeout(async () => {
    try {
      const resultados = await api.get(`/busqueda?q=${encodeURIComponent(texto)}`);
      if (secuencia === secuenciaBusqueda) {
        resultadosBusqueda.value = resultados.filter(item =>
          puedeAcceder(auth.usuario, item.modulo));
      }
    } catch (error) {
      if (secuencia === secuenciaBusqueda) errorBusqueda.value = error.message;
    } finally {
      if (secuencia === secuenciaBusqueda) cargandoBusqueda.value = false;
    }
  }, 300);
});

function cerrarBusquedaExterior(evento) {
  if (!contenedorBusqueda.value?.contains(evento.target)) busquedaAbierta.value = false;
}

function enfocarBusqueda() {
  if (textoBusqueda.value.trim().length >= 2) busquedaAbierta.value = true;
}

async function abrirResultado(resultado) {
  busquedaAbierta.value = false;
  textoBusqueda.value = '';
  await router.push({ name: resultado.modulo, query: { id: String(resultado.id) } });
}

function abrirPrimerResultado() {
  if (resultadosBusqueda.value[0]) abrirResultado(resultadosBusqueda.value[0]);
}

onMounted(() => document.addEventListener('pointerdown', cerrarBusquedaExterior));
onBeforeUnmount(() => {
  clearTimeout(temporizadorBusqueda);
  clearInterval(temporizadorNotificaciones);
  window.removeEventListener('focus', sincronizarNotificaciones);
  document.removeEventListener('visibilitychange', sincronizarNotificaciones);
  document.removeEventListener('pointerdown', cerrarBusquedaExterior);
});

async function alternarNotificaciones() {
  notificacionesAbiertas.value = !notificacionesAbiertas.value;

  if (notificacionesAbiertas.value) {
    await cargarNotificaciones();
  }
}

async function abrirNotificacion(notificacion) {
  errorNotificaciones.value = '';

  try {
    if (!notificacion.leida) {
      const actualizada = await api.patch(
        `/notificaciones/${notificacion.id}/leida`,
      );

      Object.assign(notificacion, actualizada);
      noLeidas.value = Math.max(0, noLeidas.value - 1);
    }

    notificacionesAbiertas.value = false;

    if (
      notificacion.enlace &&
      notificacion.enlace.startsWith('/')
    ) {
      await router.push(notificacion.enlace);
    }
  } catch (error) {
    errorNotificaciones.value =
      error.message || 'No se pudo abrir la notificación.';
  }
}

function salir() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="topbar">
    <button type="button" class="menu-toggle" aria-label="Abrir menú" @click="emit('abrir-menu')">
      <AppIcon name="menu" :size="22" />
    </button>
    <div class="crumbs">
      <span class="muted">Calidad</span>
      <span class="sep">/</span>
      <strong>{{ titulo }}</strong>
    </div>

    <div ref="contenedorBusqueda" class="search">
      <AppIcon name="search" :size="16" />
      <input v-model="textoBusqueda" type="search" autocomplete="off" aria-label="Buscar documento, proceso o solicitud"
        placeholder="Buscar documento, proceso o solicitud…" @focus="enfocarBusqueda"
        @keydown.enter.prevent="abrirPrimerResultado" @keydown.esc="busquedaAbierta = false" />
      <div v-if="busquedaAbierta" class="search-panel">
        <p v-if="cargandoBusqueda" class="search-panel__message">Buscando...</p>
        <p v-else-if="errorBusqueda" class="search-panel__message search-panel__error">{{ errorBusqueda }}</p>
        <p v-else-if="!resultadosBusqueda.length" class="search-panel__message">No se encontraron resultados.</p>
        <button v-for="resultado in resultadosBusqueda" :key="`${resultado.modulo}-${resultado.id}`" type="button"
          class="search-result" @click="abrirResultado(resultado)">
          <span class="search-result__type">{{ resultado.tipo }}</span>
          <strong>{{ resultado.titulo }}</strong>
          <small>{{ resultado.detalle }}</small>
        </button>
      </div>
    </div>

    <div class="actions">
      <div class="notifications-wrapper">
        <button class="icon-btn" title="Notificaciones" type="button" @click="alternarNotificaciones">
          <AppIcon name="bell" :size="18" />
          <span v-if="noLeidas > 0" class="dot"></span>
        </button>

        <section v-if="notificacionesAbiertas" class="notifications-panel">
          <div class="notifications-header">
            <strong>Notificaciones</strong>
            <span>{{ noLeidas }} sin leer</span>
          </div>

          <p v-if="cargandoNotificaciones" class="notifications-message">
            Cargando notificaciones...
          </p>

          <p v-else-if="errorNotificaciones" class="notifications-message notifications-error">
            {{ errorNotificaciones }}
          </p>

          <p v-else-if="notificaciones.length === 0" class="notifications-message">
            No tienes notificaciones.
          </p>

          <ul v-else class="notifications-list">
            <li v-for="notificacion in notificaciones" :key="notificacion.id">
              <button class="notification-item" :class="{ unread: !notificacion.leida }" type="button"
                @click="abrirNotificacion(notificacion)">
                <span>{{ notificacion.mensaje }}</span>

                <small>
                  {{ notificacion.leida ? 'Leída' : 'Nueva' }}
                </small>
              </button>
            </li>
          </ul>
        </section>
      </div>

      <!-- Avatar abre el modal de perfil -->
      <button class="user-btn" title="Mi perfil" @click="perfilAbierto = true">
        <div class="avatar">{{ iniciales }}</div>
        <div class="user-info">
          <strong>{{ auth.usuario?.nombre }}</strong>
          <small>{{ auth.usuario?.rol }}</small>
        </div>
      </button>

      <button class="icon-btn" title="Cerrar sesión" @click="salir">
        <AppIcon name="logout" :size="18" />
      </button>
    </div>
  </header>

  <!-- Modal de perfil (de la compañera, integrado) -->
  <PerfilModal v-if="perfilAbierto" @close="perfilAbierto = false" />
</template>

<style scoped>
.topbar {
  height: var(--topbar-h);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 5;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.crumbs .sep {
  color: var(--gray-400);
}

.search {
  position: relative;
  flex: 1;
  max-width: 420px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--gray-100);
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--gray-500);
}

.search-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: min(540px, calc(100vw - 32px));
  max-height: 420px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 18%);
  z-index: 25;
}

.search-panel__message {
  margin: 0;
  padding: 16px;
  color: var(--gray-500);
  font-size: 13px;
}

.search-panel__error {
  color: var(--danger);
}

.search-result {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 11px 16px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: #fff;
  color: var(--gray-900);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.search-result:hover {
  background: var(--gray-100);
}

.search-result:last-child {
  border-bottom: 0;
}

.search-result__type {
  color: var(--brand-700);
  font-size: 11px;
  font-weight: 700;
}

.search-result small {
  color: var(--gray-500);
  font-size: 11px;
}

.search:focus-within {
  border-color: var(--brand-200);
  background: #fff;
}

.search input {
  border: none;
  background: transparent;
  outline: none;
  flex: 1;
  font: inherit;
  font-size: 13px;
  color: var(--gray-900);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.icon-btn {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--gray-500);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-btn:hover {
  background: var(--gray-100);
  color: var(--brand-700);
}

.notifications-wrapper {
  position: relative;
}

.notifications-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: min(360px, calc(100vw - 32px));
  max-height: 420px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 18%);
  z-index: 20;
}

.notifications-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.notifications-header strong {
  color: var(--gray-900);
  font-size: 14px;
}

.notifications-header span {
  color: var(--gray-500);
  font-size: 12px;
}

.notifications-message {
  margin: 0;
  padding: 20px 16px;
  color: var(--gray-500);
  font-size: 13px;
  text-align: center;
}

.notifications-error {
  color: var(--danger);
}

.notifications-list {
  max-height: 350px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.notifications-list li {
  border-bottom: 1px solid var(--border);
}

.notifications-list li:last-child {
  border-bottom: none;
}

.notification-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 13px 16px;
  border: none;
  background: #fff;
  color: var(--gray-700);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.notification-item:hover {
  background: var(--gray-100);
}

.notification-item.unread {
  background: var(--brand-50);
  color: var(--gray-900);
  font-weight: 600;
}

.notification-item.unread:hover {
  background: var(--brand-100);
}

.notification-item small {
  color: var(--gray-500);
  font-size: 11px;
  font-weight: 400;
}

.dot {
  position: absolute;
  top: 9px;
  right: 10px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--danger);
  border: 2px solid #fff;
}

/* Botón de usuario (abre perfil) */
.user-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 4px 4px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.user-btn:hover {
  background: var(--gray-100);
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--brand-700);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  text-align: left;
}

.user-info strong {
  font-size: 13px;
  color: var(--gray-900);
}

.user-info small {
  font-size: 11px;
  color: var(--gray-500);
}

.menu-toggle {
  display: none;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text, #1f2937);
  cursor: pointer;
  place-items: center;
}

.menu-toggle:hover {
  background: rgba(0, 0, 0, .06);
}

@media (max-width: 900px) {
  .menu-toggle {
    display: grid;
  }
}

@media (max-width: 900px) {
  .topbar {
    width: 100%;
    min-width: 0;
    gap: 10px;
    padding: 0 14px;
  }

  .crumbs {
    min-width: 0;
    flex-shrink: 1;
  }

  .search {
    min-width: 0;
    max-width: 360px;
  }

  .search input {
    min-width: 0;
  }

  .actions {
    flex-shrink: 0;
    gap: 4px;
  }
}

@media (max-width: 700px) {
  .topbar {
    gap: 8px;
    padding: 0 10px;
  }

  .crumbs .muted,
  .crumbs .sep {
    display: none;
  }

  .crumbs strong {
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search {
    flex: 1;
    padding: 8px;
  }

  .actions {
    gap: 2px;
  }

  .user-info {
    display: none;
  }

  .user-btn {
    gap: 0;
    padding: 0;
  }

  .icon-btn {
    width: 34px;
    height: 34px;
  }
}
</style>
