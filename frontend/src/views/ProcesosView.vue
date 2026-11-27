<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import BaseCard from '@/components/BaseCard.vue';
import AppIcon from '@/components/AppIcon.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth';
import { tienePermiso } from '@/config/permisos';
import { useRoute, useRouter } from 'vue-router';
import { confirmarAccion } from '@/utils/dialogos';
import { mostrarFechaHora } from '@/utils/fechas';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const puedeAdministrar = computed(() => tienePermiso(auth.usuario, 'catalogo.procesos'));

const procesos = ref([]);
const macroprocesos = ref([]);
const normas = ref([]);
const normasCargadas = ref(false);
const procesoChecklist = ref(null);
const criteriosChecklist = ref([]);
const cargandoChecklist = ref(false);
const errorChecklist = ref('');
const evaluacionGuardandoId = ref(null);
const procesosVisibles = computed(() => {
  const id = Number(route.query.id);
  return Number.isSafeInteger(id) && id > 0
    ? procesos.value.filter(proceso => proceso.id === id)
    : procesos.value;
});
const busqueda = ref('');
const filasPorPagina = ref(10);
const pagina = ref(1);
const procesosFiltrados = computed(() => {
  const texto = busqueda.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!texto) return procesosVisibles.value;
  return procesosVisibles.value.filter(proceso =>
    [proceso.nombre, proceso.macroproceso, proceso.responsable, proceso.correo, proceso.estatus]
      .join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(texto)
  );
});
const totalPaginas = computed(() => Math.max(1, Math.ceil(procesosFiltrados.value.length / filasPorPagina.value)));
const procesosPagina = computed(() => procesosFiltrados.value.slice(
  (pagina.value - 1) * filasPorPagina.value,
  pagina.value * filasPorPagina.value
));
watch(() => route.query.id, () => { pagina.value = 1; });
watch(totalPaginas, total => { if (pagina.value > total) pagina.value = total; });
const responsables = ref([]);
const cargando = ref(false);
const error = ref('');
const errorProcesos = ref(false);
const procesoADesactivar = ref(null);

const modalAbierto = ref(false);
const procesoEditando = ref(null);
const guardando = ref(false);
const errorFormulario = ref('');
const macroAbierto = ref(false);
const macroEditando = ref(null);
const macroGuardando = ref(false);
const macroError = ref('');
const macroFormulario = ref({ nombre: '', descripcion: '', activo: true });

const esEdicion = computed(() => !!procesoEditando.value);

const formulario = ref({
  nombre: '',
  codigo_area: 'SDS',
  codigo_proceso: '',
  responsable_id: '',
  descripcion: '',
  macroproceso_id: '',
  norma_ids: [],
  estatus: 'activo',
});

async function cargarMacroprocesos() {
  try {
    macroprocesos.value = await api.get('/macroprocesos');
  } catch (err) {
    error.value = err.message || 'No se pudieron cargar los macroprocesos.';
  }
}

function abrirMacroFormulario() {
  macroEditando.value = null;
  macroFormulario.value = { nombre: '', descripcion: '', activo: true };
  macroError.value = '';
  macroAbierto.value = true;
}

function abrirMacroEdicion(macro) {
  macroEditando.value = macro;
  macroFormulario.value = { nombre: macro.nombre, descripcion: macro.descripcion || '', activo: macro.activo };
  macroError.value = '';
  macroAbierto.value = true;
}

function cerrarMacroFormulario() {
  if (macroGuardando.value) return;
  macroAbierto.value = false;
  macroEditando.value = null;
}

async function guardarMacroproceso() {
  if (macroGuardando.value) return;
  macroGuardando.value = true;
  macroError.value = '';
  try {
    if (macroEditando.value) {
      await api.put(`/macroprocesos/${macroEditando.value.id}`, macroFormulario.value);
    } else {
      await api.post('/macroprocesos', macroFormulario.value);
    }
    await cargarMacroprocesos();
    macroAbierto.value = false;
    macroEditando.value = null;
  } catch (err) {
    macroError.value = err.message || 'No se pudo guardar el macroproceso.';
  } finally {
    macroGuardando.value = false;
  }
}

async function desactivarMacroproceso(macro) {
  if (!await confirmarAccion({ titulo: 'Desactivar macroproceso', mensaje: `¿Desactivar el macroproceso "${macro.nombre}"?`, confirmarTexto: 'Desactivar', peligro: true })) return;
  try {
    await api.del(`/macroprocesos/${macro.id}`);
    await cargarMacroprocesos();
  } catch (err) {
    error.value = err.message || 'No se pudo desactivar el macroproceso.';
  }
}

async function cargarProcesos() {
  cargando.value = true;
  error.value = '';
  errorProcesos.value = false;

  try {
    procesos.value = await api.get('/procesos');
  } catch {
    procesos.value = [];
    errorProcesos.value = true;
    error.value = 'No se pudieron cargar los procesos.';
  } finally {
    cargando.value = false;
  }
}

async function cargarResponsables() {
  try {
    const usuarios = await api.get('/usuarios');
    responsables.value = usuarios.filter((usuario) => usuario.activo);
  } catch {
    error.value = 'No se pudieron cargar los responsables.';
  }
}

async function cargarNormas() {
  try {
    normas.value = await api.get('/documentos/normas');
    normasCargadas.value = true;
  } catch {
    normasCargadas.value = false;
    error.value = 'No se pudieron cargar las normas.';
  }
}

function abrirFormulario() {
  procesoEditando.value = null;
  formulario.value = {
    nombre: '',
    codigo_area: 'SDS',
    codigo_proceso: '',
    responsable_id: '',
    descripcion: '',
    macroproceso_id: '',
    norma_ids: [],
    estatus: 'activo',
  };
  errorFormulario.value = '';
  modalAbierto.value = true;
}

function abrirEdicion(proceso) {
  procesoEditando.value = proceso;
  formulario.value = {
    nombre: proceso.nombre,
    codigo_area: proceso.codigo_area || 'SDS',
    codigo_proceso: proceso.codigo_proceso || '',
    responsable_id: proceso.responsable_id,
    descripcion: proceso.descripcion || '',
    macroproceso_id: proceso.macroproceso_id || '',
    norma_ids: Array.isArray(proceso.norma_ids) ? [...proceso.norma_ids] : [],
    estatus: proceso.estatus,
  };
  errorFormulario.value = '';
  modalAbierto.value = true;
}

function cerrarFormulario() {
  modalAbierto.value = false;
  procesoEditando.value = null;
  errorFormulario.value = '';
}

async function guardarProceso() {
  if (!normasCargadas.value) {
    errorFormulario.value = 'No se cargaron las normas. Actualiza la página e inténtalo de nuevo.';
    return;
  }
  if (!formulario.value.nombre.trim() || !formulario.value.responsable_id ||
    !formulario.value.codigo_area.trim() || !formulario.value.codigo_proceso.trim() ||
    (!esEdicion.value && !formulario.value.macroproceso_id)) {
    errorFormulario.value = 'Completa el nombre, las claves de área y proceso, el responsable y el macroproceso requerido.';
    return;
  }

  guardando.value = true;
  errorFormulario.value = '';

  const datos = {
    nombre: formulario.value.nombre.trim(),
    codigo_area: formulario.value.codigo_area.trim().toUpperCase(),
    codigo_proceso: formulario.value.codigo_proceso.trim().toUpperCase(),
    responsable_id: Number(formulario.value.responsable_id),
    macroproceso_id: formulario.value.macroproceso_id ? Number(formulario.value.macroproceso_id) : null,
    norma_ids: formulario.value.norma_ids,
    descripcion: formulario.value.descripcion.trim(),
  };

  try {
    if (esEdicion.value) {
      await api.put(`/procesos/${procesoEditando.value.id}`, {
        ...datos,
        estatus: formulario.value.estatus,
      });
    } else {
      await api.post('/procesos', datos);
    }

    await cargarProcesos();
    cerrarFormulario();
  } catch (err) {
    errorFormulario.value = err.message || 'No se pudo guardar el proceso.';
  } finally {
    guardando.value = false;
  }
}

function formatoFecha(fecha) {
  return mostrarFechaHora(fecha);
}

async function confirmarDesactivacion() {
  if (!procesoADesactivar.value) return;

  try {
    await api.del(`/procesos/${procesoADesactivar.value.id}`);
    await cargarProcesos();
  } catch {
    error.value = 'No se pudo desactivar el proceso.';
  } finally {
    procesoADesactivar.value = null;
  }
}

async function abrirChecklist(proceso) {
  procesoChecklist.value = proceso;
  criteriosChecklist.value = [];
  errorChecklist.value = '';
  cargandoChecklist.value = true;

  try {
    const criterios = await api.get(
      `/procesos/${proceso.id}/evaluaciones-normas`
    );

    criteriosChecklist.value = criterios.map((criterio) => ({
      ...criterio,
      cumple_editado:
        criterio.cumple === null ? '' : String(criterio.cumple),
      observacion_editada: criterio.observacion || '',
    }));
  } catch (err) {
    errorChecklist.value =
      err.message || 'No se pudo cargar el checklist del proceso.';
  } finally {
    cargandoChecklist.value = false;
  }
}

function cerrarChecklist() {
  if (evaluacionGuardandoId.value !== null) return;

  procesoChecklist.value = null;
  criteriosChecklist.value = [];
  errorChecklist.value = '';
}

async function guardarEvaluacion(criterio) {
  if (criterio.cumple_editado === '') {
    errorChecklist.value = 'Selecciona si el criterio cumple o no cumple.';
    return;
  }

  evaluacionGuardandoId.value = criterio.criterio_id;
  errorChecklist.value = '';

  try {
    await api.post(
      `/procesos/${procesoChecklist.value.id}/evaluaciones-normas/${criterio.criterio_id}`,
      {
        cumple: criterio.cumple_editado === 'true',
        observacion: criterio.observacion_editada,
      }
    );

    await abrirChecklist(procesoChecklist.value);
  } catch (err) {
    errorChecklist.value =
      err.message || 'No se pudo guardar la evaluación.';
  } finally {
    evaluacionGuardandoId.value = null;
  }
}

onMounted(async () => {
  await Promise.all([
    cargarProcesos(),
    cargarResponsables(),
    cargarMacroprocesos(),
    cargarNormas(),
  ]);
});
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div>
        <h1>Procesos</h1>
        <p>Organiza los procesos bajo un macroproceso; los anteriores pueden clasificarse sin alterar sus documentos.
        </p>
      </div>
      <button v-if="puedeAdministrar" class="btn btn-primary" @click="abrirFormulario">
        <AppIcon name="plus" :size="16" /> Registrar proceso
      </button>
    </div>

    <p v-if="route.query.id" class="muted">
      Resultado de la búsqueda.
      <button class="btn btn-ghost btn-sm" @click="router.replace({ name: 'procesos' })">Ver todos</button>
    </p>
    <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
    <BaseCard>
      <div class="modal-actions">
        <h2 style="margin-right: auto">Macroprocesos</h2>
        <button v-if="puedeAdministrar" class="btn btn-primary" type="button" @click="abrirMacroFormulario">
          <AppIcon name="plus" :size="16" /> Registrar macroproceso
        </button>
      </div>
      <p v-if="macroprocesos.length === 0" class="muted">Todavía no hay macroprocesos. Registra uno para clasificar
        procesos nuevos.</p>
      <div v-else class="tabla-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>Macroproceso</th>
            <th>Descripción</th>
            <th>Procesos activos</th>
            <th>Estado</th>
            <th v-if="puedeAdministrar">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="macro in macroprocesos" :key="macro.id">
            <td><strong>{{ macro.nombre }}</strong></td>
            <td>{{ macro.descripcion || '—' }}</td>
            <td>{{ macro.procesos_activos }}</td>
            <td>
              <StatusBadge :estado="macro.activo ? 'activo' : 'inactivo'" />
            </td>
            <td v-if="puedeAdministrar">
              <div class="row-actions">
                <button class="action-btn edit" type="button" title="Editar macroproceso"
                  aria-label="Editar macroproceso" @click="abrirMacroEdicion(macro)">
                  <span aria-hidden="true">✎</span>
                </button>
                <button v-if="macro.activo" class="action-btn del" type="button"
                  :disabled="macro.procesos_activos > 0"
                  :title="macro.procesos_activos > 0
                    ? 'No se puede desactivar: todavía tiene procesos activos'
                    : 'Desactivar macroproceso'"
                  aria-label="Desactivar macroproceso" @click="desactivarMacroproceso(macro)">
                  <AppIcon name="plus" :size="14" style="transform: rotate(45deg)" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </BaseCard>
    <BaseCard>
      <div class="toolbar">
        <label class="search-wrap">
          <AppIcon name="search" :size="15" />
          <input v-model="busqueda" type="search" placeholder="Buscar proceso, macroproceso o responsable"
            aria-label="Buscar procesos" @input="pagina = 1" />
        </label>
        <label class="rows-select">
          Mostrar
          <select v-model.number="filasPorPagina" @change="pagina = 1">
            <option v-for="n in [5, 10, 25, 50]" :key="n" :value="n">{{ n }}</option>
          </select>
          filas
        </label>
      </div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Proceso</th>
              <th>Macroproceso</th>
              <th>Responsable</th>
              <th>Correo</th>
              <th>Estatus</th>
              <th>Registrado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cargando">
              <td colspan="7" class="empty-row">Cargando procesos…</td>
            </tr>
            <tr v-for="p in cargando ? [] : procesosPagina" :key="p.id">
              <td><strong>{{ p.nombre }}</strong></td>
              <td>{{ p.macroproceso || 'Sin clasificar' }}</td>
              <td>{{ p.responsable }}</td>
              <td class="muted">{{ p.correo }}</td>
              <td>
                <StatusBadge :estado="p.estatus" />
              </td>
              <td class="muted">{{ formatoFecha(p.creado_en) }}</td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-ghost btn-sm" type="button" :disabled="p.estatus !== 'activo'"
                    :title="p.estatus !== 'activo' ? 'Activa el proceso para evaluar sus normas' : ''"
                    @click="abrirChecklist(p)">
                    Evaluar normas
                  </button>
                  <template v-if="puedeAdministrar">
                    <button class="action-btn edit" type="button" title="Editar proceso" aria-label="Editar proceso"
                      @click="abrirEdicion(p)">
                      <span aria-hidden="true">✎</span>
                    </button>

                    <button class="action-btn del" type="button" aria-label="Desactivar proceso"
                      :title="p.estatus === 'inactivo' ? 'El proceso ya está inactivo' : 'Desactivar proceso'"
                      :disabled="p.estatus === 'inactivo'"
                      @click="procesoADesactivar = p">
                      <AppIcon name="plus" :size="14" style="transform: rotate(45deg)" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="!cargando && procesosPagina.length === 0">
              <td colspan="7" class="empty-row">
                {{ errorProcesos ? 'No se pudieron cargar los procesos.' : 'No se encontraron procesos.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span class="muted">Página {{ pagina }} de {{ totalPaginas }}</span>
        <div class="row" style="gap: 8px">
          <button class="btn btn-ghost btn-sm" type="button" :disabled="pagina <= 1" @click="pagina--">Anterior</button>
          <button class="btn btn-ghost btn-sm" type="button" :disabled="pagina >= totalPaginas"
            @click="pagina++">Siguiente</button>
        </div>
      </div>
    </BaseCard>
    <Teleport to="body">
      <div v-if="modalAbierto" class="overlay" @click="cerrarFormulario">
        <form class="modal" @submit.prevent="guardarProceso" @click.stop>
          <div class="modal-head">
            <h2>{{ esEdicion ? 'Editar proceso' : 'Registrar proceso' }}</h2>
            <button class="modal-close" type="button" @click="cerrarFormulario">×</button>
          </div>

          <div class="modal-body">
            <p v-if="errorFormulario" class="error-banner">
              {{ errorFormulario }}
            </p>

            <label class="field">
              <span>Nombre del proceso</span>
              <input v-model="formulario.nombre" required placeholder="Ej. Gestión de documentos" />
            </label>

            <div class="field-grid">
              <label class="field">
                <span>Clave de área</span>
                <input v-model.trim="formulario.codigo_area" required maxlength="8" placeholder="Ej. SDS"
                  @input="formulario.codigo_area = formulario.codigo_area.toUpperCase().replace(/[^A-Z0-9]/g, '')" />
              </label>
              <label class="field">
                <span>Clave del proceso</span>
                <input v-model.trim="formulario.codigo_proceso" required maxlength="8" placeholder="Ej. GC"
                  @input="formulario.codigo_proceso = formulario.codigo_proceso.toUpperCase().replace(/[^A-Z0-9]/g, '')" />
              </label>
            </div>

            <label class="field">
              <span>Macroproceso {{ esEdicion ? '(opcional para procesos anteriores)' : '*' }}</span>
              <select v-model="formulario.macroproceso_id" :required="!esEdicion">
                <option value="">{{ esEdicion ? 'Sin clasificar' : 'Selecciona un macroproceso' }}</option>
                <option
                  v-for="macro in macroprocesos.filter(item => item.activo || item.id === Number(formulario.macroproceso_id))"
                  :key="macro.id" :value="macro.id">{{ macro.nombre }}</option>
              </select>
            </label>

            <label class="field">
              <span>Responsable</span>
              <select v-model="formulario.responsable_id" required>
                <option disabled value="">Selecciona un responsable</option>
                <option v-for="usuario in responsables" :key="usuario.id" :value="usuario.id">
                  {{ usuario.nombre }} — {{ usuario.correo }}
                </option>
              </select>
            </label>

            <label v-if="esEdicion" class="field">
              <span>Estado</span>
              <select v-model="formulario.estatus">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>

            <label class="field">
              <span>Descripción general</span>
              <textarea v-model="formulario.descripcion" rows="4"
                placeholder="Describe el objetivo o alcance del proceso" />
            </label>

            <div class="field">
              <span>Normas aplicables</span>
              <div v-if="normas.length" class="norma-opciones">
                <label v-for="norma in normas" :key="norma.id" class="norma-opcion">
                  <input v-model="formulario.norma_ids" type="checkbox" :value="norma.id" />
                  <span>{{ norma.codigo }} — {{ norma.nombre }}</span>
                </label>
              </div>
              <p v-else class="muted">No hay normas activas disponibles.</p>
            </div>

            <div class="modal-actions">
              <button class="btn btn-ghost" type="button" @click="cerrarFormulario">
                Cancelar
              </button>
              <button class="btn btn-primary" type="submit" :disabled="guardando">
                {{
                  guardando
                    ? 'Guardando...'
                    : esEdicion
                      ? 'Guardar cambios'
                      : 'Registrar proceso'
                }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="macroAbierto" class="overlay" @click.self="cerrarMacroFormulario">
        <form class="modal" @submit.prevent="guardarMacroproceso" @click.stop>
          <div class="modal-head">
            <h2>{{ macroEditando ? 'Editar macroproceso' : 'Registrar macroproceso' }}</h2>
            <button class="modal-close" type="button" @click="cerrarMacroFormulario">×</button>
          </div>
          <div class="modal-body">
            <p v-if="macroError" class="error-banner" role="alert">{{ macroError }}</p>
            <label class="field">
              <span>Nombre *</span>
              <input v-model.trim="macroFormulario.nombre" maxlength="160" required
                placeholder="Ej. Gestión de calidad" />
            </label>
            <label class="field">
              <span>Descripción</span>
              <textarea v-model.trim="macroFormulario.descripcion" maxlength="2000" rows="3"
                placeholder="Describe el alcance del macroproceso" />
            </label>
            <label v-if="macroEditando" class="field">
              <span>Estado</span>
              <select v-model="macroFormulario.activo">
                <option :value="true">Activo</option>
                <option :value="false">Inactivo</option>
              </select>
            </label>
            <div class="modal-actions">
              <button class="btn btn-ghost" type="button" @click="cerrarMacroFormulario">Cancelar</button>
              <button class="btn btn-primary" type="submit" :disabled="macroGuardando">
                {{ macroGuardando ? 'Guardando...' : 'Guardar macroproceso' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="procesoADesactivar" class="overlay" @click="procesoADesactivar = null">
        <div class="modal modal-sm" @click.stop>
          <div class="modal-head">
            <h2>Desactivar proceso</h2>
            <button class="modal-close" type="button" @click="procesoADesactivar = null">
              ×
            </button>
          </div>

          <div class="modal-body">
            <p>
              ¿Seguro que deseas desactivar
              <strong>{{ procesoADesactivar.nombre }}</strong>?
              El proceso se conservará, pero quedará inactivo.
            </p>

            <div class="modal-actions">
              <button class="btn btn-ghost" @click="procesoADesactivar = null">
                Cancelar
              </button>
              <button class="btn" style="background: var(--danger); color: #fff" @click="confirmarDesactivacion">
                Desactivar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="procesoChecklist" class="overlay" @click.self="cerrarChecklist">
        <section class="modal"
          style="max-width: 1000px; max-height: calc(100vh - 64px); display: flex; flex-direction: column" @click.stop>
          <div class="modal-head">
            <div>
              <h2>Checklist de normas</h2>
              <span>{{ procesoChecklist.nombre }}</span>
            </div>
            <button class="modal-close" type="button" @click="cerrarChecklist">×</button>
          </div>

          <div class="modal-body" style="overflow-y: auto">
            <p v-if="errorChecklist" class="error-banner" role="alert">
              {{ errorChecklist }}
            </p>

            <p v-else-if="cargandoChecklist" class="muted">Cargando criterios…</p>

            <p v-else-if="criteriosChecklist.length === 0" class="muted">
              No hay criterios activos para las normas asociadas a este proceso.
            </p>

            <div v-else class="table-scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>Norma</th>
                    <th>Criterio</th>
                    <th>Evaluación</th>
                    <th>Observación</th>
                    <th>Última evaluación</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="criterio in criteriosChecklist" :key="criterio.criterio_id">
                    <td>
                      <strong>{{ criterio.norma_codigo }}</strong>
                      <div class="muted">{{ criterio.norma_nombre }}</div>
                    </td>
                    <td>
                      <strong>{{ criterio.criterio_codigo }}</strong>
                      <div>{{ criterio.descripcion }}</div>
                    </td>
                    <td>
                      <div class="norma-opciones" role="group" aria-label="Evaluación del criterio">
                        <label class="norma-opcion">
                          <input type="checkbox" :checked="criterio.cumple_editado === 'true'"
                            :disabled="evaluacionGuardandoId !== null"
                            @change="criterio.cumple_editado = $event.target.checked ? 'true' : ''" />
                          <span>Cumple</span>
                        </label>

                        <label class="norma-opcion">
                          <input type="checkbox" :checked="criterio.cumple_editado === 'false'"
                            :disabled="evaluacionGuardandoId !== null"
                            @change="criterio.cumple_editado = $event.target.checked ? 'false' : ''" />
                          <span>No cumple</span>
                        </label>
                      </div>
                    </td>
                    <td>
                      <textarea v-model="criterio.observacion_editada" rows="2" maxlength="2000"
                        aria-label="Observación de la evaluación" placeholder="Detalle opcional" />
                    </td>
                    <td>
                      <span v-if="criterio.evaluado_en">
                        {{ criterio.evaluado_por_nombre || 'Usuario' }}<br />
                        <span class="muted">{{ formatoFecha(criterio.evaluado_en) }}</span>
                      </span>
                      <span v-else class="muted">Sin evaluar</span>
                    </td>
                    <td>
                      <button class="btn btn-primary btn-sm" type="button"
                        :disabled="evaluacionGuardandoId !== null || criterio.cumple_editado === ''"
                        @click="guardarEvaluacion(criterio)">
                        {{ evaluacionGuardandoId === criterio.criterio_id ? 'Guardando…' : 'Guardar' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="modal-actions">
              <button class="btn btn-ghost" type="button" @click="cerrarChecklist">
                Cerrar
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>


<style scoped src="../assets/styles/ProcesosView.css"></style>
