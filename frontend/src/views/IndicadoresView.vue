<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth';
import { tienePermiso } from '@/config/permisos';
import { mostrarFecha } from '@/utils/fechas';

import BaseCard from '@/components/BaseCard.vue';
import AppIcon from '@/components/AppIcon.vue';

const auth = useAuthStore();

const esAdmin = computed(
  () => auth.usuario?.rol_clave === 'admin_general'
);

const puedeAdministrar = computed(
  () => tienePermiso(auth.usuario, 'catalogo.indicadores')
);

const puede = (accion) => tienePermiso(auth.usuario, `indicadores.${accion}`);

function puedeEditarMediciones(indicador) {
  return puede('editarMediciones') && puedeCapturarIndicador(indicador);
}

function puedeEliminarMediciones(indicador) {
  return puede('eliminarMediciones') && puedeCapturarIndicador(indicador);
}

const indicadores = ref([]);
const procesos = ref([]);
const procesosActivos = computed(() => procesos.value.filter((proceso) => proceso.estatus === 'activo'));
const unidadesMedida = ref([]);
const tiposIndicador = ref([]);
const usuarios = ref([]);
const cargando = ref(false);
const error = ref('');
const busqueda = ref('');
const filasPorPagina = ref(10);
const pagina = ref(1);

const FRECUENCIAS = [
  { valor: 'mensual', etiqueta: 'Mensual' },
  { valor: 'trimestral', etiqueta: 'Trimestral' },
  { valor: 'semestral', etiqueta: 'Semestral' },
  { valor: 'anual', etiqueta: 'Anual' },
];

const SENTIDOS = [
  { valor: 'mayor_mejor', etiqueta: 'Mayor es mejor' },
  { valor: 'menor_mejor', etiqueta: 'Menor es mejor' },
  { valor: 'rango', etiqueta: 'Debe permanecer en el rango' },
];

async function cargarDatos() {
  cargando.value = true;
  error.value = '';

  try {
    const [
      indicadoresRespuesta,
      procesosRespuesta,
      unidadesRespuesta,
      tiposRespuesta,
      usuariosRespuesta,
    ] = await Promise.all([
      api.get('/indicadores'),
      api.get('/procesos'),
      api.get('/unidades-medida'),
      api.get('/tipos-indicador'),
      api.get('/usuarios'),
    ]);

    indicadores.value = indicadoresRespuesta;
    procesos.value = procesosRespuesta;
    unidadesMedida.value = unidadesRespuesta;
    tiposIndicador.value = tiposRespuesta.filter((tipo) => tipo.activo);
    usuarios.value = usuariosRespuesta.filter(
      (usuario) =>
        usuario.activo &&
        usuario.rol_clave !== 'visor'
    );
  } catch {
    error.value = 'No se pudo cargar el catálogo de indicadores.';
  } finally {
    cargando.value = false;
  }
}

onMounted(cargarDatos);

/* ---------- Filtrado y paginación ---------- */
const indicadoresFiltrados = computed(() => {
  const t = busqueda.value.trim().toLowerCase();
  if (!t) return indicadores.value;
  return indicadores.value.filter((i) =>
    [i.codigo, i.nombre, i.proceso, i.responsable].join(' ').toLowerCase().includes(t)
  );
});

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(indicadoresFiltrados.value.length / filasPorPagina.value))
);
const indicadoresPagina = computed(() =>
  indicadoresFiltrados.value.slice(
    (pagina.value - 1) * filasPorPagina.value,
    pagina.value * filasPorPagina.value
  )
);

/* ---------- Modal ---------- */
const modalAbierto = ref(false);
const esNuevo = ref(true);
const guardando = ref(false);
const errorFormulario = ref('');
const indicadorADesactivar = ref(null);

/* ---------- Mediciones ---------- */
const modalMedicionesAbierto = ref(false);
const cuerpoMediciones = ref(null);
const indicadorSeleccionado = ref(null);
const medicionEditando = ref(null);
const medicionAEliminar = ref(null);
const mediciones = ref([]);
const cargandoMediciones = ref(false);
const guardandoMedicion = ref(false);
const errorMediciones = ref('');

const formularioMedicionVacio = () => ({
  fecha_medicion: '',
  resultado: '',
  observaciones: '',
});

const formMedicion = ref(formularioMedicionVacio());

const graficaMediciones = computed(() => {
  if (
    !indicadorSeleccionado.value ||
    mediciones.value.length === 0
  ) {
    return null;
  }

  const ancho = 700;
  const alto = 250;
  const margenX = 45;
  const margenY = 30;

  const resultados = mediciones.value.map((medicion) =>
    Number(medicion.resultado)
  );

  const metaMinima = Number(
    indicadorSeleccionado.value.meta_minima
  );

  const metaMaxima = Number(
    indicadorSeleccionado.value.meta_maxima
  );

  const valores = [
    ...resultados,
    metaMinima,
    metaMaxima,
  ].filter(Number.isFinite);

  let minimo = Math.min(...valores);
  let maximo = Math.max(...valores);

  if (minimo === maximo) {
    minimo -= 1;
    maximo += 1;
  }

  const espacio = (maximo - minimo) * 0.1;
  minimo -= espacio;
  maximo += espacio;

  const obtenerX = (indice) => {
    if (mediciones.value.length === 1) {
      return ancho / 2;
    }

    return (
      margenX +
      (indice * (ancho - margenX * 2)) /
      (mediciones.value.length - 1)
    );
  };

  const obtenerY = (valor) =>
    margenY +
    ((maximo - valor) * (alto - margenY * 2)) /
    (maximo - minimo);

  const puntos = mediciones.value.map((medicion, indice) => ({
    id: medicion.id,
    x: obtenerX(indice),
    y: obtenerY(Number(medicion.resultado)),
    resultado: Number(medicion.resultado),
    fecha: formatearFecha(medicion.fecha_medicion),
    cumple: resultadoCumpleMeta(
      indicadorSeleccionado.value,
      medicion.resultado
    ),
  }));

  return {
    ancho,
    alto,
    puntos,
    linea: puntos
      .map((punto) => `${punto.x},${punto.y}`)
      .join(' '),
    metaMinimaY: obtenerY(metaMinima),
    metaMaximaY: obtenerY(metaMaxima),
  };
});

const formularioVacio = () => ({
  id: null,
  codigo: '',
  nombre: '',
  descripcion: '',
  proceso_id: '',
  responsable_id: '',
  unidad_medida_id: '',
  tipo_indicador_id: '',
  frecuencia: '',
  meta_minima: '',
  meta_maxima: '',
  sentido: 'rango',
  activo: true,
  usuarios: [],
});

const form = ref(formularioVacio());

function usuarioSeleccionado(usuarioId) {
  return form.value.usuarios.some(
    (asignacion) => asignacion.usuario_id === usuarioId
  );
}

function usuarioPuedeCapturar(usuarioId) {
  const asignacion = form.value.usuarios.find(
    (item) => item.usuario_id === usuarioId
  );

  return asignacion?.puede_capturar || false;
}

function alternarUsuario(usuarioId, seleccionado) {
  if (seleccionado) {
    form.value.usuarios.push({
      usuario_id: usuarioId,
      puede_capturar: false,
    });

    return;
  }

  form.value.usuarios = form.value.usuarios.filter(
    (asignacion) => asignacion.usuario_id !== usuarioId
  );
}

function alternarCaptura(usuarioId, puedeCapturar) {
  const asignacion = form.value.usuarios.find(
    (item) => item.usuario_id === usuarioId
  );

  if (asignacion) {
    asignacion.puede_capturar = puedeCapturar;
  }
}

function abrirNuevo() {
  esNuevo.value = true;
  form.value = formularioVacio();
  errorFormulario.value = '';
  modalAbierto.value = true;
}

function editar(indicador) {
  esNuevo.value = false;
  form.value = {
    id: indicador.id,
    codigo: indicador.codigo,
    nombre: indicador.nombre,
    descripcion: indicador.descripcion,
    proceso_id: procesosActivos.value.some((proceso) => Number(proceso.id) === Number(indicador.proceso_id))
      ? indicador.proceso_id
      : '',
    responsable_id: indicador.responsable_id,
    unidad_medida_id: indicador.unidad_medida_id,
    tipo_indicador_id: indicador.tipo_indicador_id || '',
    frecuencia: indicador.frecuencia,
    meta_minima: indicador.meta_minima,
    meta_maxima: indicador.meta_maxima,
    sentido: indicador.sentido,
    activo: indicador.activo,
    usuarios: (indicador.usuarios || []).filter(
      (asignacion) =>
        usuarios.value.some(
          (usuarioPermitido) =>
            usuarioPermitido.id === asignacion.usuario_id
        )
    ),
  };
  errorFormulario.value = '';
  modalAbierto.value = true;
}

function cerrarModal() {
  modalAbierto.value = false;
  errorFormulario.value = '';
}

function puedeCapturarIndicador(indicador) {
  if (esAdmin.value) {
    return true;
  }

  return (indicador.usuarios || []).some(
    (asignacion) =>
      asignacion.usuario_id === auth.usuario?.id &&
      asignacion.puede_capturar
  );
}

async function abrirMediciones(indicador) {
  indicadorSeleccionado.value = indicador;
  mediciones.value = [];
  medicionEditando.value = null;
  formMedicion.value = formularioMedicionVacio();
  errorMediciones.value = '';
  modalMedicionesAbierto.value = true;
  cargandoMediciones.value = true;

  try {
    mediciones.value = await api.get(
      `/indicadores/${indicador.id}/mediciones`
    );
  } catch {
    errorMediciones.value =
      'No se pudo cargar el historial de mediciones.';
  } finally {
    cargandoMediciones.value = false;
  }
}

function cerrarModalMediciones() {
  modalMedicionesAbierto.value = false;
  indicadorSeleccionado.value = null;
  mediciones.value = [];
  medicionEditando.value = null;
  medicionAEliminar.value = null;
  errorMediciones.value = '';
  cargarDatos();
}

async function editarMedicion(medicion) {
  medicionEditando.value = medicion;

  formMedicion.value = {
    fecha_medicion: String(
      medicion.fecha_medicion
    ).slice(0, 10),
    resultado: medicion.resultado,
    observaciones: medicion.observaciones || '',
  };

  errorMediciones.value = '';
  await nextTick();
  cuerpoMediciones.value?.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicionMedicion() {
  medicionEditando.value = null;
  formMedicion.value = formularioMedicionVacio();
  errorMediciones.value = '';
}

async function confirmarEliminarMedicion() {
  if (
    !medicionAEliminar.value ||
    !indicadorSeleccionado.value
  ) {
    return;
  }

  errorMediciones.value = '';

  try {
    const rutaBase =
      `/indicadores/${indicadorSeleccionado.value.id}/mediciones`;

    await api.del(
      `${rutaBase}/${medicionAEliminar.value.id}`
    );

    mediciones.value = await api.get(rutaBase);

    if (
      medicionEditando.value?.id ===
      medicionAEliminar.value.id
    ) {
      cancelarEdicionMedicion();
    }
  } catch (err) {
    errorMediciones.value =
      err.message ||
      'No se pudo eliminar la medición.';
  } finally {
    medicionAEliminar.value = null;
  }
}

async function guardarMedicion() {
  if (
    !indicadorSeleccionado.value ||
    !formMedicion.value.fecha_medicion ||
    formMedicion.value.resultado === ''
  ) {
    errorMediciones.value =
      'La fecha y el resultado son obligatorios.';
    return;
  }

  const resultado = Number(formMedicion.value.resultado);

  if (!Number.isFinite(resultado)) {
    errorMediciones.value =
      'El resultado debe ser un número válido.';
    return;
  }

  guardandoMedicion.value = true;
  errorMediciones.value = '';

  try {
    const datos = {
      fecha_medicion:
        formMedicion.value.fecha_medicion,
      resultado,
      observaciones:
        formMedicion.value.observaciones.trim(),
    };

    const rutaBase =
      `/indicadores/${indicadorSeleccionado.value.id}/mediciones`;

    if (medicionEditando.value) {
      await api.put(
        `${rutaBase}/${medicionEditando.value.id}`,
        datos
      );
    } else {
      await api.post(rutaBase, datos);
    }

    mediciones.value = await api.get(rutaBase);

    medicionEditando.value = null;
    formMedicion.value = formularioMedicionVacio();
  } catch (err) {
    errorMediciones.value =
      err.message ||
      'No se pudo guardar la medición.';
  } finally {
    guardandoMedicion.value = false;
  }
}

async function guardar() {

  if (
    !form.value.codigo.trim() ||
    !form.value.nombre.trim() ||
    !form.value.descripcion.trim() ||
    !form.value.proceso_id ||
    !form.value.responsable_id ||
    !form.value.unidad_medida_id ||
    !form.value.tipo_indicador_id ||
    !form.value.frecuencia ||
    form.value.meta_minima === '' ||
    form.value.meta_maxima === ''
  ) {
    errorFormulario.value =
      'Completa todos los campos obligatorios.';
    return;
  }

  guardando.value = true;
  errorFormulario.value = '';

  try {
    const datos = {
      codigo: form.value.codigo.trim(),
      nombre: form.value.nombre.trim(),
      descripcion: form.value.descripcion.trim(),
      proceso_id: Number(form.value.proceso_id),
      responsable_id: Number(form.value.responsable_id),
      unidad_medida_id: Number(form.value.unidad_medida_id),
      tipo_indicador_id: Number(form.value.tipo_indicador_id),
      frecuencia: form.value.frecuencia,
      meta_minima: Number(form.value.meta_minima),
      meta_maxima: Number(form.value.meta_maxima),
      sentido: form.value.sentido,
      activo: form.value.activo,
      usuarios: form.value.usuarios.map((asignacion) => ({
        usuario_id: asignacion.usuario_id,
        puede_capturar: asignacion.puede_capturar,
      })),
    };

    if (esNuevo.value) {
      await api.post('/indicadores', datos);
    } else {
      await api.put(`/indicadores/${form.value.id}`, datos);
    }

    await cargarDatos();
    cerrarModal();
  } catch (err) {
    errorFormulario.value =
      err.message ||
      'No se pudo guardar el indicador.';
  } finally {
    guardando.value = false;
  }
}

async function confirmarDesactivacion() {
  if (!indicadorADesactivar.value) return;

  try {
    await api.del(
      `/indicadores/${indicadorADesactivar.value.id}`
    );

    await cargarDatos();
  } catch {
    error.value = 'No se pudo desactivar el indicador.';
  } finally {
    indicadorADesactivar.value = null;
  }
}

function formatearFrecuencia(valor) {
  const frecuencia = FRECUENCIAS.find(
    (opcion) => opcion.valor === valor
  );

  return frecuencia?.etiqueta || valor;
}

function formatearNumero(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }

  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 4,
  }).format(Number(valor));
}

function formatearFecha(valor) {
  return mostrarFecha(String(valor || '').slice(0, 10));
}

function formatearMeta(indicador) {
  const minimo = formatearNumero(indicador.meta_minima);
  const maximo = formatearNumero(indicador.meta_maxima);
  const simbolo = indicador.unidad_simbolo
    ? ` ${indicador.unidad_simbolo}`
    : '';

  return `${minimo} - ${maximo}${simbolo}`;
}

function resultadoCumpleMeta(indicador, resultado) {
  const valor = Number(resultado);
  const minimo = Number(indicador.meta_minima);
  const maximo = Number(indicador.meta_maxima);

  if (indicador.sentido === 'mayor_mejor') {
    return valor >= minimo;
  }

  if (indicador.sentido === 'menor_mejor') {
    return valor <= maximo;
  }

  return valor >= minimo && valor <= maximo;
}

function estadoSemaforo(indicador) {
  if (indicador.ultimo_resultado == null) {
    return {
      clase: 'badge-muted',
      texto: 'Sin medición',
      detalle: 'Todavía no hay mediciones registradas.',
    };
  }

  const valor = Number(indicador.ultimo_resultado);
  const minimo = indicador.meta_minima == null ? null : Number(indicador.meta_minima);
  const maximo = indicador.meta_maxima == null ? null : Number(indicador.meta_maxima);
  const simbolo = indicador.unidad_simbolo ? ` ${indicador.unidad_simbolo}` : '';
  const fecha = mostrarFecha(indicador.ultima_fecha_medicion);
  const detalle = `Último resultado: ${formatearNumero(valor)}${simbolo} (${fecha})`;

  if (!resultadoCumpleMeta(indicador, valor)) {
    return { clase: 'badge-danger', texto: 'Fuera de meta', detalle };
  }

  const ancho = minimo != null && maximo != null
    ? maximo - minimo
    : Math.abs(minimo ?? maximo ?? 0);
  const margen = ancho * 0.1;

  const cercaDelMinimo =
    minimo != null && indicador.sentido !== 'menor_mejor' && valor < minimo + margen;
  const cercaDelMaximo =
    maximo != null && indicador.sentido !== 'mayor_mejor' && valor > maximo - margen;

  if (cercaDelMinimo || cercaDelMaximo) {
    return { clase: 'badge-warn', texto: 'Cerca del límite', detalle };
  }

  return { clase: 'badge-ok', texto: 'En meta', detalle };
}

const semaforos = computed(() =>
  new Map(indicadores.value.map(indicador => [indicador.id, estadoSemaforo(indicador)])),
);

/* ---------- Exportar CSV ---------- */
function exportarCSV() {
  const enc = ['Código', 'Nombre', 'Tipo', 'Proceso', 'Responsable', 'Frecuencia', 'Meta mínima', 'Meta máxima', 'Unidad', 'Estado'];
  const filas = indicadoresFiltrados.value.map((indicador) => [
    indicador.codigo,
    indicador.nombre,
    indicador.tipo_indicador || '',
    indicador.proceso,
    indicador.responsable,
    formatearFrecuencia(indicador.frecuencia),
    indicador.meta_minima,
    indicador.meta_maxima,
    indicador.unidad_medida,
    indicador.activo ? 'Activo' : 'Inactivo',
  ]);
  const txt = [enc, ...filas].map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + txt], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'indicadores.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div>
        <h1>Indicadores</h1>
        <p>Catálogo de indicadores de desempeño por proceso.</p>
      </div>
      <button v-if="puedeAdministrar" class="btn btn-primary" @click="abrirNuevo">
        <AppIcon name="plus" :size="16" /> Nuevo indicador
      </button>
    </div>

    <BaseCard>
      <p v-if="cargando" class="estado-mensaje">
        Cargando indicadores...
      </p>

      <p v-else-if="error" class="estado-mensaje estado-error">
        {{ error }}
      </p>
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
              <option v-for="n in [10, 25, 50]" :key="n" :value="n">{{ n }}</option>
            </select>
            filas
          </label>
          <button class="btn btn-ghost btn-sm" @click="exportarCSV">Exportar CSV</button>
        </div>
      </div>

      <!-- Tabla -->
      <div class="tabla-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Proceso</th>
            <th>Responsable</th>
            <th>Frecuencia</th>
            <th>Meta</th>
            <th>Semáforo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ind in indicadoresPagina" :key="ind.id">
            <td><code>{{ ind.codigo }}</code></td>
            <td><strong>{{ ind.nombre }}</strong></td>
            <td class="muted">{{ ind.tipo_indicador || 'Sin clasificar' }}</td>
            <td class="muted">{{ ind.proceso }}</td>
            <td class="muted">{{ ind.responsable }}</td>
            <td class="muted">{{ formatearFrecuencia(ind.frecuencia) }}</td>
            <td>{{ formatearMeta(ind) }}</td>
            <td>
              <span class="badge" :class="semaforos.get(ind.id)?.clase" :title="semaforos.get(ind.id)?.detalle">
                {{ semaforos.get(ind.id)?.texto }}
              </span>
            </td>
            <td>
              <span class="badge" :class="ind.activo ? 'badge-ok' : 'badge-muted'">
                {{ ind.activo ? 'Activo' : 'No Activo' }}
              </span>
            </td>
            <td>
              <div class="row-actions">
                <button class="action-btn measurements" title="Ver mediciones" @click="abrirMediciones(ind)">
                  <span aria-hidden="true">▥</span>
                </button>

                <button v-if="puedeAdministrar" class="action-btn edit" title="Editar" @click="editar(ind)">
                  <span aria-hidden="true">✎</span>
                </button>

                <button v-if="puedeAdministrar" class="action-btn del" :title="ind.activo
                  ? 'Desactivar indicador'
                  : 'Indicador inactivo'
                  " :disabled="!ind.activo" @click="indicadorADesactivar = ind">
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="indicadoresPagina.length === 0">
            <td colspan="10" class="empty-row">No se encontraron indicadores.</td>
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

    <!-- ===== MODAL INDICADOR ===== -->
    <Teleport to="body">
      <div v-if="modalAbierto" class="overlay" @click="cerrarModal">
        <div class="modal" @click.stop>
          <div class="modal-head">
            <h2>{{ esNuevo ? 'Nuevo indicador' : 'Editar indicador' }}</h2>
            <button class="modal-close" @click="cerrarModal">×</button>
          </div>
          <div class="modal-body">
            <label class="field">
              <span>Código *</span>
              <input v-model="form.codigo" type="text" placeholder="Ej. IND-001" />
            </label>

            <label class="field">
              <span>Nombre del indicador *</span>
              <input v-model="form.nombre" type="text" placeholder="Ej. Cumplimiento de objetivos" />
            </label>

            <label class="field">
              <span>Descripción: ¿qué mide el indicador? *</span>
              <textarea v-model="form.descripcion" rows="3" placeholder="Describe claramente qué se medirá"></textarea>
            </label>

            <label class="field">
              <span>Proceso *</span>
              <select v-model="form.proceso_id">
                <option value="" disabled>Selecciona un proceso</option>

                <option v-for="proceso in procesosActivos" :key="proceso.id" :value="proceso.id">
                  {{ proceso.nombre }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Responsable del indicador *</span>
              <select v-model="form.responsable_id" required>
                <option value="" disabled>Selecciona un responsable</option>
                <option v-for="usuario in usuarios" :key="usuario.id" :value="usuario.id">
                  {{ usuario.nombre }} — {{ usuario.correo }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Tipo de indicador *</span>
              <select v-model="form.tipo_indicador_id">
                <option value="" disabled>Selecciona un tipo</option>
                <option v-for="tipo in tiposIndicador" :key="tipo.id" :value="tipo.id">
                  {{ tipo.nombre }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Unidad de medida *</span>
              <select v-model="form.unidad_medida_id">
                <option value="" disabled>Selecciona una unidad</option>

                <option v-for="unidad in unidadesMedida" :key="unidad.id" :value="unidad.id">
                  {{ unidad.nombre }}
                  {{ unidad.simbolo ? `(${unidad.simbolo})` : '' }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Frecuencia de medición *</span>
              <select v-model="form.frecuencia">
                <option value="" disabled>Selecciona una frecuencia</option>

                <option v-for="frecuencia in FRECUENCIAS" :key="frecuencia.valor" :value="frecuencia.valor">
                  {{ frecuencia.etiqueta }}
                </option>
              </select>
            </label>

            <div class="form-grid">
              <label class="field">
                <span>Meta mínima *</span>
                <input v-model="form.meta_minima" type="number" step="0.01" placeholder="Ej. 80" />
              </label>

              <label class="field">
                <span>Meta máxima *</span>
                <input v-model="form.meta_maxima" type="number" step="0.01" placeholder="Ej. 100" />
              </label>
            </div>

            <label class="field">
              <span>Interpretación del resultado *</span>
              <select v-model="form.sentido">
                <option v-for="sentido in SENTIDOS" :key="sentido.valor" :value="sentido.valor">
                  {{ sentido.etiqueta }}
                </option>
              </select>
            </label>

            <label v-if="!esNuevo" class="field">
              <span>Estado</span>

              <select v-model="form.activo">
                <option :value="true">Activo</option>
                <option :value="false">Inactivo</option>
              </select>
            </label>

            <section class="usuarios-section">
              <div>
                <h3>Usuarios relacionados</h3>
                <p>
                  Selecciona quién puede consultar el indicador y quién puede
                  capturar sus mediciones.
                </p>
              </div>

              <div v-if="usuarios.length === 0" class="usuarios-vacio">
                No hay usuarios activos disponibles.
              </div>

              <div v-else class="usuarios-lista">
                <div v-for="usuario in usuarios" :key="usuario.id" class="usuario-item">
                  <label class="usuario-info">
                    <input type="checkbox" :checked="usuarioSeleccionado(usuario.id)" @change="
                      alternarUsuario(usuario.id, $event.target.checked)
                      " />

                    <span>
                      <strong>{{ usuario.nombre }}</strong>
                      <small>
                        {{ usuario.puesto || 'Sin puesto' }} ·
                        {{ usuario.correo }}
                      </small>
                    </span>
                  </label>

                  <label class="permiso-captura">
                    <input type="checkbox" :disabled="!usuarioSeleccionado(usuario.id)"
                      :checked="usuarioPuedeCapturar(usuario.id)" @change="
                        alternarCaptura(usuario.id, $event.target.checked)
                        " />

                    Puede capturar
                  </label>
                </div>
              </div>
            </section>

            <p v-if="errorFormulario" class="form-error">
              {{ errorFormulario }}
            </p>

            <div class="modal-actions">
              <button class="btn btn-ghost" :disabled="guardando" @click="cerrarModal">Cancelar</button>
              <button class="btn btn-primary" :disabled="guardando" @click="guardar">{{ guardando ? 'Guardando...' :
                'Guardar' }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===== MODAL MEDICIONES ===== -->
    <Teleport to="body">
      <div v-if="modalMedicionesAbierto" class="overlay" @click="cerrarModalMediciones">
        <div class="modal modal-mediciones" @click.stop>
          <div class="modal-head">
            <div>
              <h2>Mediciones del indicador</h2>
              <p v-if="indicadorSeleccionado" class="muted">
                {{ indicadorSeleccionado.codigo }} ·
                {{ indicadorSeleccionado.nombre }}
              </p>
            </div>

            <button class="modal-close" @click="cerrarModalMediciones">
              ×
            </button>
          </div>

          <div ref="cuerpoMediciones" class="modal-body">
            <section v-if="
              indicadorSeleccionado &&
              indicadorSeleccionado.activo &&
              puedeCapturarIndicador(indicadorSeleccionado) &&
              (medicionEditando ? puede('editarMediciones') : puede('capturarMediciones'))
            " class="captura-medicion">
              <h3>
                {{
                  medicionEditando
                    ? 'Editar resultado'
                    : 'Registrar resultado'
                }}
              </h3>

              <div class="form-grid">
                <label class="field">
                  <span>Fecha de medición *</span>
                  <input v-model="formMedicion.fecha_medicion" type="date" />
                </label>

                <label class="field">
                  <span>Resultado *</span>
                  <input v-model="formMedicion.resultado" type="number" step="any" placeholder="Ej. 85.5" />
                </label>
              </div>

              <label class="field">
                <span>Observaciones</span>
                <textarea v-model="formMedicion.observaciones" rows="3"
                  placeholder="Explica brevemente el resultado..."></textarea>
              </label>

              <div class="modal-actions">
                <button v-if="medicionEditando" class="btn btn-ghost" :disabled="guardandoMedicion"
                  @click="cancelarEdicionMedicion">
                  Cancelar edición
                </button>

                <button class="btn btn-primary" :disabled="guardandoMedicion" @click="guardarMedicion">
                  {{
                    guardandoMedicion
                      ? 'Guardando...'
                      : medicionEditando
                        ? 'Guardar cambios'
                        : 'Registrar medición'
                  }}
                </button>
              </div>
            </section>

            <p v-else class="muted">
              Puedes consultar el historial, pero no capturar mediciones.
            </p>

            <p v-if="errorMediciones" class="form-error">
              {{ errorMediciones }}
            </p>

            <section v-if="graficaMediciones" class="grafica-section">
              <h3>Evolución de resultados</h3>

              <div class="grafica-contenedor">
                <svg :viewBox="`0 0 ${graficaMediciones.ancho} ${graficaMediciones.alto}`
                  " role="img" aria-label="Gráfica de resultados del indicador">
                  <rect x="45" :y="Math.min(
                    graficaMediciones.metaMinimaY,
                    graficaMediciones.metaMaximaY
                  )
                    " width="610" :height="Math.abs(
                      graficaMediciones.metaMaximaY -
                      graficaMediciones.metaMinimaY
                    )
                      " class="zona-meta" />

                  <line x1="45" x2="655" :y1="graficaMediciones.metaMinimaY" :y2="graficaMediciones.metaMinimaY"
                    class="linea-meta" />

                  <line x1="45" x2="655" :y1="graficaMediciones.metaMaximaY" :y2="graficaMediciones.metaMaximaY"
                    class="linea-meta" />

                  <text x="50" :y="graficaMediciones.metaMaximaY - 7" class="etiqueta-meta">
                    Meta máxima:
                    {{
                      formatearNumero(
                        indicadorSeleccionado.meta_maxima
                      )
                    }}
                    {{ indicadorSeleccionado.unidad_simbolo || '' }}
                  </text>

                  <text x="50" :y="graficaMediciones.metaMinimaY - 7" class="etiqueta-meta">
                    Meta mínima:
                    {{
                      formatearNumero(
                        indicadorSeleccionado.meta_minima
                      )
                    }}
                    {{ indicadorSeleccionado.unidad_simbolo || '' }}
                  </text>

                  <polyline :points="graficaMediciones.linea" class="linea-resultados" />

                  <g v-for="punto in graficaMediciones.puntos" :key="punto.id">
                    <circle :cx="punto.x" :cy="punto.y" r="5" :class="[
                      'punto-resultado',
                      punto.cumple ? 'cumple' : 'no-cumple',
                    ]">
                      <title>
                        {{ punto.fecha }}: {{ punto.resultado }}
                      </title>
                    </circle>

                    <text :x="punto.x" :y="punto.y - 10" text-anchor="middle" class="etiqueta-resultado">
                      {{ formatearNumero(punto.resultado) }}
                    </text>

                    <text :x="punto.x" :y="graficaMediciones.alto - 5" text-anchor="middle" class="etiqueta-fecha">
                      {{ punto.fecha }}
                    </text>
                  </g>
                </svg>
              </div>

              <div class="leyenda-grafica">
                <span>
                  <i class="leyenda-resultados"></i>
                  Resultado
                </span>

                <span>
                  <i class="leyenda-meta"></i>
                  Rango de meta
                </span>
              </div>
            </section>

            <section class="historial-mediciones">
              <h3>Historial</h3>

              <p v-if="cargandoMediciones" class="muted">
                Cargando mediciones...
              </p>

              <p v-else-if="mediciones.length === 0" class="muted">
                Todavía no hay mediciones registradas.
              </p>

              <div v-else class="tabla-mediciones">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Resultado</th>
                      <th>Capturó</th>
                      <th>Observaciones</th>
                      <th v-if="
                        indicadorSeleccionado?.activo &&
                        (puedeEditarMediciones(indicadorSeleccionado) ||
                          puedeEliminarMediciones(indicadorSeleccionado))
                      ">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr v-for="medicion in mediciones" :key="medicion.id">
                      <td>{{ formatearFecha(medicion.fecha_medicion) }}</td>
                      <td>
                        <strong>
                          {{ formatearNumero(medicion.resultado) }}
                          {{
                            indicadorSeleccionado?.unidad_simbolo || ''
                          }}
                        </strong>
                      </td>
                      <td>{{ medicion.capturado_por_nombre }}</td>
                      <td>
                        {{ medicion.observaciones || '—' }}
                      </td>
                      <td v-if="
                        indicadorSeleccionado?.activo &&
                        (puedeEditarMediciones(indicadorSeleccionado) ||
                          puedeEliminarMediciones(indicadorSeleccionado))
                      ">
                        <div class="row-actions">
                          <button v-if="puedeEditarMediciones(indicadorSeleccionado)" class="action-btn edit"
                            title="Editar medición" @click="editarMedicion(medicion)">
                            <span aria-hidden="true">✎</span>
                          </button>

                          <button v-if="puedeEliminarMediciones(indicadorSeleccionado)" class="action-btn del"
                            title="Eliminar medición" @click="medicionAEliminar = medicion">
                            <span aria-hidden="true">×</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <div class="modal-actions">
              <button class="btn btn-ghost" @click="cerrarModalMediciones">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===== CONFIRMAR ELIMINACIÓN DE MEDICIÓN ===== -->
    <Teleport to="body">
      <div v-if="medicionAEliminar" class="overlay" @click="medicionAEliminar = null">
        <div class="modal modal-sm" @click.stop>
          <div class="modal-head">
            <h2>Eliminar medición</h2>

            <button class="modal-close" @click="medicionAEliminar = null">
              ×
            </button>
          </div>

          <div class="modal-body">
            <p>
              ¿Seguro que quieres eliminar la medición del
              <strong>
                {{
                  formatearFecha(
                    medicionAEliminar.fecha_medicion
                  )
                }}
              </strong>
              con resultado
              <strong>
                {{
                  formatearNumero(
                    medicionAEliminar.resultado
                  )
                }}
                {{
                  indicadorSeleccionado?.unidad_simbolo || ''
                }}
              </strong>?
            </p>

            <p class="muted">
              Esta acción elimina permanentemente el registro.
            </p>

            <div class="modal-actions">
              <button class="btn btn-ghost" @click="medicionAEliminar = null">
                Cancelar
              </button>

              <button class="btn" style="background:var(--danger);color:#fff" @click="confirmarEliminarMedicion">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===== MODAL ELIMINAR ===== -->
    <Teleport to="body">
      <div v-if="indicadorADesactivar" class="overlay" @click="indicadorADesactivar = null">
        <div class="modal modal-sm" @click.stop>
          <div class="modal-head">
            <h2>Desactivar indicador</h2>
            <button class="modal-close" @click="indicadorADesactivar = null">×</button>
          </div>
          <div class="modal-body">
            <p>
              ¿Seguro que quieres desactivar
              <strong>{{ indicadorADesactivar.nombre }}</strong>?
              El indicador seguirá guardado y podrás reactivarlo al editarlo.
            </p>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="indicadorADesactivar = null">Cancelar</button>
              <button class="btn" style="background:var(--danger);color:#fff"
                @click="confirmarDesactivacion">Desactivar</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="../assets/styles/IndicadoresView.css"></style>
