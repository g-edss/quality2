<template>
  <div class="tipoindicador-container">
    <div class="page-head">
      <div>
        <h1>Tipos de indicador</h1>
        <p>Catálogo de tipos de indicadores.</p>
      </div>
      <button v-if="puedeAdministrar" class="btn btn-primary" type="button" @click="abrirModal">
        <span aria-hidden="true">+</span> Nuevo tipo de indicador
      </button>
    </div>

    <div class="tipoindicador-card">
      <div class="tipoindicador-body">
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
            <button class="btn btn-ghost btn-sm" type="button" @click="exportarCSV(tiposFiltrados)">
              Exportar CSV
            </button>
          </div>
        </div>

        <div class="tabla-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Tipo</th>
                <th>Descripción</th>
                <th>Códigos de indicadores en uso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="tiposPaginados.length === 0">
                <td colspan="6" class="sin-registros">
                  No se encontraron tipos de indicador.
                </td>
              </tr>

              <tr v-for="tipo in tiposPaginados" :key="tipo.id">
                <td><code class="catalogo-codigo">{{ tipo.codigo }}</code></td>
                <td><strong>{{ tipo.nombre }}</strong></td>
                <td class="muted">{{ tipo.descripcion || '—' }}</td>
                <td>
                  {{ tipo.indicadores_codigos?.join(', ') || 'Sin indicadores' }}
                </td>

                <td>
                  <StatusBadge :estado="tipo.activo ? 'activo' : 'inactivo'" />
                </td>

                <td>
                  <div class="acciones">
                    <button v-if="puedeAdministrar" class="btn-editar" type="button" title="Editar"
                      @click="abrirModalEdicion(tipo)">
                      <span aria-hidden="true">✎</span>
                    </button>

                    <button v-if="puedeAdministrar && tipo.activo" class="btn-eliminar" type="button" title="Desactivar"
                      @click="eliminarTipo(tipo)">
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
        <h3>{{ editando ? 'Editar Tipo de Indicador' : 'Nuevo Tipo de Indicador' }}</h3>
        <button class="modal-cerrar" type="button" @click="cerrarModal">×</button>
      </div>

      <form class="form-indicador" @submit.prevent="guardarTipo">
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
        <div class="campo">
          <label for="codigo">Código</label>
          <input id="codigo" v-model="formTipo.codigo" type="text" placeholder="Ej. TI-001" required />
        </div>

        <div class="campo">
          <label for="nombre">Nombre del Tipo</label>
          <input id="nombre" v-model="formTipo.nombre" type="text"
            placeholder="Ej. Eficiencia, Eficacia, Cumplimiento..." required />
        </div>

        <div class="campo">
          <label for="descripcion">Descripción</label>
          <textarea id="descripcion" v-model="formTipo.descripcion"
            placeholder="Describe brevemente qué mide este tipo de indicador"></textarea>
        </div>

        <div class="campo">
          <label for="estado">Estado</label>
          <select id="estado" v-model="formTipo.activo">
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
  tienePermiso(auth.usuario, 'indicadores.tiposIndicador')
);

const busqueda = ref("");
const filasPorPagina = ref("10");
const pagina = ref(1);
const mostrarModal = ref(false);
const editando = ref(false);
const idEnEdicion = ref(null);
const guardando = ref(false);
const error = ref('');

const tipos = ref([]);

async function cargarTipos() {
  try {
    tipos.value = await api.get('/tipos-indicador');
    error.value = '';
  } catch (err) {
    error.value = err.message || 'No se pudieron cargar los tipos de indicador.';
  }
}

onMounted(cargarTipos);

const formVacio = () => ({
  codigo: "",
  nombre: "",
  descripcion: "",
  activo: true,
});

const formTipo = ref(formVacio());

const abrirModal = () => {
  editando.value = false;
  idEnEdicion.value = null;
  formTipo.value = formVacio();
  mostrarModal.value = true;
};

const abrirModalEdicion = (tipo) => {
  editando.value = true;
  idEnEdicion.value = tipo.id;
  formTipo.value = { ...tipo };
  mostrarModal.value = true;
};

const cerrarModal = () => {
  mostrarModal.value = false;
};

const guardarTipo = async () => {
  if (guardando.value) return;
  guardando.value = true;
  error.value = '';
  try {
    if (editando.value) {
      await api.put(`/tipos-indicador/${idEnEdicion.value}`, formTipo.value);
    } else {
      await api.post('/tipos-indicador', formTipo.value);
    }
    await cargarTipos();
    cerrarModal();
  } catch (err) {
    error.value = err.message || 'No se pudo guardar el tipo de indicador.';
  } finally {
    guardando.value = false;
  }
};

const eliminarTipo = async (tipo) => {
  const confirmado = await confirmarAccion({
    titulo: 'Desactivar tipo de indicador',
    mensaje: `¿Desactivar el tipo de indicador "${tipo.nombre}"? Los indicadores existentes conservarán su referencia.`,
    confirmarTexto: 'Desactivar',
    peligro: true,
  });

  if (!confirmado) return;
  try {
    await api.del(`/tipos-indicador/${tipo.id}`);
    await cargarTipos();
  } catch (err) {
    error.value = err.message || 'No se pudo desactivar el tipo de indicador.';
  }
};

const tiposFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim();

  if (tipos.value.length === 0) return [];
  if (!texto) return tipos.value;

  return tipos.value.filter((tipo) => {
    return (
      tipo.codigo.toLowerCase().includes(texto) ||
      tipo.nombre.toLowerCase().includes(texto) ||
      (tipo.descripcion || "").toLowerCase().includes(texto)
    );
  });
});

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(tiposFiltrados.value.length / Number(filasPorPagina.value)))
);

const tiposPaginados = computed(() => {
  const inicio = (pagina.value - 1) * Number(filasPorPagina.value);
  return tiposFiltrados.value.slice(inicio, inicio + Number(filasPorPagina.value));
});

watch(filasPorPagina, () => {
  pagina.value = 1;
});

watch(tiposFiltrados, () => {
  if (pagina.value > totalPaginas.value) {
    pagina.value = totalPaginas.value;
  }
});

const exportarCSV = (datos) => {
  if (!datos.length) {
    error.value = 'No hay datos para exportar.';
    return;
  }

  const encabezados = [
    "Código",
    "Nombre del Tipo",
    "Descripción",
    "Códigos de indicadores en uso",
    "Estado",
  ];

  const filas = datos.map((tipo) => [
    tipo.codigo,
    tipo.nombre,
    tipo.descripcion || "",
    tipo.indicadores_codigos?.join(", ") || "Sin indicadores",
    tipo.activo ? "Activo" : "No Activo",
  ]);

  const escapar = (valor) => `"${String(valor).replace(/"/g, '""')}"`;

  const csv = [encabezados, ...filas]
    .map((fila) => fila.map(escapar).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "tipos_de_indicador.csv";
  link.click();

  URL.revokeObjectURL(url);
};
</script>

<style scoped src="../assets/styles/TipoIndicador.css"></style>
