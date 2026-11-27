<template>
  <div class="unidadmedida-container">
    <div class="page-head">
      <div>
        <h1>Unidades de medida</h1>
        <p>Catálogo de unidades utilizadas en los indicadores.</p>
      </div>
      <button v-if="puedeAdministrar" class="btn btn-primary" type="button" @click="abrirModal">
        <span aria-hidden="true">+</span> Nueva unidad de medida
      </button>
    </div>

    <div class="unidadmedida-card">
      <div class="unidadmedida-body">
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>

        <div class="catalogo-toolbar">
          <label class="catalogo-search">
            <AppIcon name="search" :size="15" />
            <input v-model="busqueda" type="search" placeholder="Buscar..." @input="pagina = 1" />
          </label>

          <div class="catalogo-toolbar-right">
            <label class="catalogo-rows">
              Mostrar
              <select v-model="filasPorPagina" @change="pagina = 1">
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
              filas
            </label>
            <button class="btn btn-ghost btn-sm" type="button" @click="exportarCSV(unidadesFiltradas)"">
              Exportar CSV
            </button>
          </div>
        </div>

        <div class=" tabla-wrapper">
              <table class="table">
                <thead>
                  <tr>
                    <th>Símbolo</th>
                    <th>Nombre / Concepto</th>
                    <th>Descripción</th>
                    <th>Tipo de dato</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-if="unidadesPaginadas.length === 0">
                    <td colspan="6" class="sin-registros">
                      No se encontraron unidades de medida.
                    </td>
                  </tr>

                  <tr v-for="unidad in unidadesPaginadas" :key="unidad.id">
                    <td><code class="catalogo-codigo">{{ unidad.simbolo || '—' }}</code></td>
                    <td><strong>{{ unidad.nombre }}</strong></td>
                    <td class="muted">{{ unidad.descripcion || '—' }}</td>
                    <td class="muted">{{ unidad.tipo_dato }}</td>

                    <td>
                      <StatusBadge :estado="unidad.activo ? 'activo' : 'inactivo'" />
                    </td>

                    <td>
                      <div class="acciones">
                        <button v-if="puedeAdministrar" class="btn-editar" type="button" title="Editar"
                          @click="abrirModalEdicion(unidad)">
                          <span aria-hidden="true">✎</span>
                        </button>

                        <button v-if="puedeAdministrar && unidad.activo" class="btn-eliminar" type="button"
                          title="Desactivar" @click="eliminarUnidad(unidad)">
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
          </div>

          <div class="catalogo-pagination">
            <span class="muted">Página {{ pagina }} de {{ totalPaginas }}</span>

            <div class="catalogo-pagination__buttons">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="pagina <= 1" @click="pagina--">
                Anterior
              </button>
              <button class="btn btn-ghost btn-sm" type="button" :disabled="pagina >= totalPaginas" @click="pagina++">
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="mostrarModal" class="modal-overlay" @click.self="cerrarModal">
      <div class="modal-indicador">
        <div class="modal-header">
          <h3>{{ editando ? 'Editar Unidad de Medida' : 'Nueva Unidad de Medida' }}</h3>
          <button class="modal-cerrar" type="button" @click="cerrarModal">×</button>
        </div>

        <form class="form-indicador" @submit.prevent="guardarUnidad">
          <p v-if="error" role="alert" class="form-error">{{ error }}</p>
          <div class="campo">
            <label for="codigo">Símbolo</label>
            <input id="codigo" v-model="formUnidad.simbolo" type="text" placeholder="Ej. %, h, kg" />
          </div>

          <div class="campo">
            <label for="nombre">Nombre o Concepto de la Unidad</label>
            <input id="nombre" v-model="formUnidad.nombre" type="text" placeholder="Ej. Porcentaje, Piezas, Horas..."
              required />
          </div>

          <div class="campo">
            <label for="descripcion">Descripción de la Unidad</label>
            <textarea id="descripcion" v-model="formUnidad.descripcion"
              placeholder="Describe brevemente qué representa esta unidad"></textarea>
          </div>

          <div class="campo">
            <label for="tipo">Tipo de dato</label>
            <select id="tipo" v-model="formUnidad.tipo_dato" required>
              <option value="" disabled>Selecciona un tipo</option>
              <option value="numero">Número</option>
              <option value="porcentaje">Porcentaje</option>
              <option value="texto">Texto</option>
            </select>
          </div>

          <div class="campo">
            <label for="estado">Estado</label>
            <select id="estado" v-model="formUnidad.activo">
              <option :value="true">Activo</option>
              <option :value="false">No Activo</option>
            </select>
          </div>

          <div class="modal-botones">
            <button type="button" class="btn-cancelar" @click="cerrarModal">
              Cancelar
            </button>
            <button type="submit" class="btn-guardar" :disabled="guardando">{{ guardando ? 'Guardando...' : 'Guardar'
            }}</button>
          </div>
        </form>
      </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth.js';
import { tienePermiso } from '@/config/permisos';
import { confirmarAccion } from '@/utils/dialogos';
import StatusBadge from '@/components/StatusBadge.vue';
import AppIcon from '@/components/AppIcon.vue';

const auth = useAuthStore();
const puedeAdministrar = computed(() =>
  tienePermiso(auth.usuario, 'indicadores.unidadesMedida')
);

const busqueda = ref("");
const filasPorPagina = ref("10");
const pagina = ref(1);
const mostrarModal = ref(false);
const editando = ref(false);
const idEnEdicion = ref(null);
const guardando = ref(false);
const error = ref('');

const unidades = ref([]);

async function cargarUnidades() {
  try {
    unidades.value = await api.get('/unidades-medida/todas');
    error.value = '';
  } catch (err) {
    error.value = err.message || 'No se pudieron cargar las unidades de medida.';
  }
}

onMounted(cargarUnidades);

const formVacio = () => ({
  simbolo: "",
  nombre: "",
  descripcion: "",
  tipo_dato: "",
  activo: true,
});

const formUnidad = ref(formVacio());

const abrirModal = () => {
  editando.value = false;
  idEnEdicion.value = null;
  formUnidad.value = formVacio();
  mostrarModal.value = true;
};

const abrirModalEdicion = (unidad) => {
  editando.value = true;
  idEnEdicion.value = unidad.id;
  formUnidad.value = { ...unidad };
  mostrarModal.value = true;
};

const cerrarModal = () => {
  mostrarModal.value = false;
};

const guardarUnidad = async () => {
  if (guardando.value) return;
  guardando.value = true;
  error.value = '';
  try {
    if (editando.value) {
      await api.put(`/unidades-medida/${idEnEdicion.value}`, formUnidad.value);
    } else {
      await api.post('/unidades-medida', formUnidad.value);
    }
    await cargarUnidades();
    cerrarModal();
  } catch (err) {
    error.value = err.message || 'No se pudo guardar la unidad de medida.';
  } finally {
    guardando.value = false;
  }
};

const eliminarUnidad = async (unidad) => {
  const confirmado = await confirmarAccion({
    titulo: 'Desactivar unidad de medida',
    mensaje: `¿Desactivar la unidad de medida "${unidad.nombre}"? Los indicadores existentes conservarán su referencia.`,
    confirmarTexto: 'Desactivar',
    peligro: true,
  });

  if (!confirmado) return;
  try {
    await api.del(`/unidades-medida/${unidad.id}`);
    await cargarUnidades();
  } catch (err) {
    error.value = err.message || 'No se pudo desactivar la unidad de medida.';
  }
};

const unidadesFiltradas = computed(() => {
  const texto = busqueda.value.toLowerCase().trim();

  if (unidades.value.length === 0) return [];
  if (!texto) return unidades.value;

  return unidades.value.filter((unidad) => {
    return (
      (unidad.simbolo || '').toLowerCase().includes(texto) ||
      unidad.nombre.toLowerCase().includes(texto) ||
      (unidad.descripcion || "").toLowerCase().includes(texto) ||
      unidad.tipo_dato.toLowerCase().includes(texto)
    );
  });
});

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(unidadesFiltradas.value.length / Number(filasPorPagina.value)))
);

const unidadesPaginadas = computed(() => {
  const inicio = (pagina.value - 1) * Number(filasPorPagina.value);
  return unidadesFiltradas.value.slice(inicio, inicio + Number(filasPorPagina.value));
});

watch(filasPorPagina, () => {
  pagina.value = 1;
});

watch(unidadesFiltradas, () => {
  if (pagina.value > totalPaginas.value) {
    pagina.value = totalPaginas.value;
  }
});

const exportarCSV = (datos) => {
  if (!datos.length) {
    error.value = 'No hay datos para exportar.';
    return;
  }

  const encabezados = ["Símbolo", "Nombre / Concepto", "Descripción", "Tipo de dato", "Estado"];

  const filas = datos.map((unidad) => [
    unidad.simbolo || "",
    unidad.nombre,
    unidad.descripcion || "",
    unidad.tipo_dato,
    unidad.activo ? "Activo" : "No Activo",
  ]);

  const escapar = (valor) => `"${String(valor).replace(/"/g, '""')}"`;

  const csv = [encabezados, ...filas]
    .map((fila) => fila.map(escapar).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "unidades_de_medida.csv";
  link.click();

  URL.revokeObjectURL(url);
};
</script>

<style scoped src="../assets/styles/UnidadMedida.css"></style>
