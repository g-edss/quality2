<script setup>
import { computed, onMounted, ref } from 'vue';
import BaseCard from '@/components/BaseCard.vue';
import AppIcon from '@/components/AppIcon.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api/client';
import { mostrarFecha, mostrarFechaHora } from '@/utils/fechas';

const resumen = ref(null);
const cargando = ref(false);
const error = ref('');
const hoy = ref(fechaHoy());
const mesCalendario = ref(hoy.value.slice(0, 7));
const diasSemana = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const calendarioDisponible = computed(() => Array.isArray(resumen.value?.revisiones));
const revisionesCalendario = computed(() =>
  calendarioDisponible.value ? resumen.value.revisiones : []);

const tituloMes = computed(() => new Intl.DateTimeFormat('es-MX', {
  month: 'long', year: 'numeric',
}).format(new Date(`${mesCalendario.value}-01T12:00:00`)));

const revisionesVencidas = computed(() =>
  revisionesCalendario.value.filter(revision => revision.fecha < hoy.value));

const revisionesPorDia = computed(() => {
  const fechas = new Map();
  for (const revision of revisionesCalendario.value) {
    const lista = fechas.get(revision.fecha) || [];
    lista.push(revision);
    fechas.set(revision.fecha, lista);
  }
  return fechas;
});

const diasCalendario = computed(() => {
  const [anio, mes] = mesCalendario.value.split('-').map(Number);
  const primerDia = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
  const totalDias = new Date(anio, mes, 0).getDate();
  return [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: totalDias }, (_, indice) =>
      `${mesCalendario.value}-${String(indice + 1).padStart(2, '0')}`),
  ];
});

const pendientes = computed(() => [
  { clave: 'solicitudes', etiqueta: 'Solicitudes por atender', icono: 'request', ruta: '/solicitudes' },
  { clave: 'hallazgos', etiqueta: 'Hallazgos asignados', icono: 'audit', ruta: '/auditorias' },
  { clave: 'acciones', etiqueta: 'Acciones correctivas', icono: 'check', ruta: '/acciones-correctivas' },
  { clave: 'acuerdos', etiqueta: 'Acuerdos de juntas', icono: 'meeting', ruta: '/juntas' },
].map(item => ({ ...item, valor: resumen.value?.pendientes?.[item.clave] ?? 0 })));

async function cargarResumen() {
  cargando.value = true;
  error.value = '';
  try {
    resumen.value = await api.get('/dashboard');
    hoy.value = fechaHoy();
  } catch (fallo) {
    error.value = fallo.message || 'No se pudo cargar el resumen.';
  } finally {
    cargando.value = false;
  }
}

function fechaLegible(fecha) {
  return mostrarFechaHora(fecha, 'Sin fecha');
}

function fechaHoy() {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function moverMes(cantidad) {
  const [anio, mes] = mesCalendario.value.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + cantidad, 1);
  mesCalendario.value = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function estadoRevision(fecha) {
  if (fecha < hoy.value) return 'Vencida';
  const dias = Math.round((Date.parse(`${fecha}T12:00:00Z`) -
    Date.parse(`${hoy.value}T12:00:00Z`)) / 86400000);
  return dias <= 30 ? 'Próxima' : 'Programada';
}

onMounted(cargarResumen);
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div>
        <h1>Inicio</h1>
        <p>Resumen de los asuntos asignados a tu cuenta.</p>
      </div>
      <RouterLink to="/solicitudes" class="btn btn-primary">
        <AppIcon name="plus" :size="16" /> Ir a solicitudes
      </RouterLink>
    </div>

    <div v-if="error" class="dashboard-error" role="alert">{{ error }}</div>
    <p v-if="cargando && !resumen" class="muted">Cargando resumen...</p>

    <div v-if="resumen" class="kpis">
      <RouterLink v-for="item in pendientes" :key="item.clave" :to="item.ruta" class="kpi">
        <div class="kpi-icon"><AppIcon :name="item.icono" :size="20" /></div>
        <div class="kpi-body">
          <span class="kpi-label">{{ item.etiqueta }}</span>
          <strong class="kpi-value">{{ item.valor }}</strong>
          <small class="muted">Abrir módulo</small>
        </div>
      </RouterLink>
    </div>

    <BaseCard title="Actividad reciente" subtitle="Últimas solicitudes en las que participas">
      <template #actions>
        <button class="btn btn-ghost btn-sm" :disabled="cargando" @click="cargarResumen">Actualizar</button>
        <RouterLink to="/solicitudes" class="btn btn-ghost btn-sm">Ver todas</RouterLink>
      </template>
      <p v-if="!cargando && resumen && !resumen.actividad.length" class="muted dashboard-empty">
        Todavía no hay solicitudes relacionadas con tu cuenta.
      </p>
      <div v-else-if="resumen?.actividad?.length" class="dashboard-table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Tipo</th><th>Documento / Proceso</th><th>Solicitante</th><th>Estado</th><th>Última actualización</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="actividad in resumen.actividad" :key="actividad.id">
              <td>{{ actividad.tipo }}</td>
              <td><strong>{{ actividad.asunto }}</strong></td>
              <td class="muted">{{ actividad.usuario }}</td>
              <td><StatusBadge :estado="actividad.estado" /></td>
              <td class="muted">{{ fechaLegible(actividad.actualizado_en) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>

    <BaseCard title="Revisiones documentales" subtitle="Consulta el calendario de los documentos vigentes">
      <template #actions>
        <RouterLink to="/documentos" class="btn btn-ghost btn-sm">Ver documentos</RouterLink>
      </template>
      <p v-if="resumen && !calendarioDisponible" class="dashboard-error" role="alert">
        No se pudo cargar el calendario. Pulsa Actualizar en Actividad reciente.
      </p>
      <p v-else-if="!cargando && resumen && !revisionesCalendario.length" class="muted dashboard-empty">
        No hay documentos vigentes con revisión programada.
      </p>
      <template v-else-if="revisionesCalendario.length">
        <div v-if="revisionesVencidas.length" class="revision-vencida-alerta">
          <strong>{{ revisionesVencidas.length }} revisión(es) vencida(s)</strong>
          <RouterLink v-for="revision in revisionesVencidas.slice(0, 5)" :key="revision.id"
            :to="{ name: 'documentos', query: { id: revision.id } }">
            {{ revision.codigo || 'Pendiente' }} · {{ revision.nombre }} · {{ mostrarFecha(revision.fecha) }}
          </RouterLink>
          <small v-if="revisionesVencidas.length > 5">Hay más revisiones vencidas en Control de Documentos.</small>
        </div>
        <div class="calendario-controles">
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Mes anterior" @click="moverMes(-1)">‹</button>
          <strong>{{ tituloMes }}</strong>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Mes siguiente" @click="moverMes(1)">›</button>
          <input v-model="mesCalendario" type="month" aria-label="Elegir mes de revisiones" />
        </div>
        <div class="calendario-grid">
          <div v-for="(dia, indice) in diasSemana" :key="indice" class="calendario-semana">{{ dia }}</div>
          <div v-for="(fecha, indice) in diasCalendario" :key="fecha || `vacio-${indice}`"
            class="calendario-dia" :class="{ 'calendario-dia--vacio': !fecha, 'calendario-dia--hoy': fecha === hoy }">
            <template v-if="fecha">
              <span class="calendario-numero">{{ Number(fecha.slice(-2)) }}</span>
              <RouterLink v-for="revision in (revisionesPorDia.get(fecha) || []).slice(0, 2)" :key="revision.id"
                :to="{ name: 'documentos', query: { id: revision.id } }" class="calendario-revision"
                :title="`${revision.codigo || 'Pendiente'} · ${revision.nombre} · ${estadoRevision(fecha)}`">
                {{ revision.codigo || revision.nombre }}
              </RouterLink>
              <small v-if="(revisionesPorDia.get(fecha) || []).length > 2">
                +{{ revisionesPorDia.get(fecha).length - 2 }} más
              </small>
            </template>
          </div>
        </div>
        <p class="muted calendario-ayuda">Selecciona un documento para ver su revisión y atenderla cuando corresponda.</p>
      </template>
    </BaseCard>
  </div>
</template>

<style scoped src="../assets/styles/DashboardView.css"></style>
