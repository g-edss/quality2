<script setup>
import { computed, onMounted, ref } from 'vue';
import BaseCard from '@/components/BaseCard.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const esAdmin = computed(() => auth.usuario?.rol_clave === 'admin_general');

const normas = ref([]);
const criterios = ref([]);
const busquedaNormas = ref('');
const busquedaCriterios = ref('');
const cargandoNormas = ref(false);
const cargandoCriterios = ref(false);
const error = ref('');

const modalNormaAbierto = ref(false);
const guardandoNorma = ref(false);
const errorNorma = ref('');
const formularioNorma = ref({
    id: null,
    codigo: '',
    nombre: '',
    activo: true,
});
const criteriosParaNorma = ref([]);

const modalCriterioAbierto = ref(false);
const guardandoCriterio = ref(false);
const errorCriterio = ref('');
const formularioCriterio = ref({
    id: null,
    codigo: '',
    descripcion: '',
    activo: true,
});

const normasFiltradas = computed(() => {
    const texto = busquedaNormas.value.trim().toLowerCase();
    if (!texto) return normas.value;

    return normas.value.filter((norma) =>
        `${norma.codigo} ${norma.nombre}`.toLowerCase().includes(texto)
    );
});

const criteriosFiltrados = computed(() => {
    const texto = busquedaCriterios.value.trim().toLowerCase();
    if (!texto) return criterios.value;

    return criterios.value.filter((criterio) =>
        `${criterio.codigo} ${criterio.descripcion}`.toLowerCase().includes(texto)
    );
});

async function cargarNormas() {
    cargandoNormas.value = true;
    error.value = '';

    try {
        normas.value = await api.get('/normas');
    } catch (err) {
        error.value = err.message || 'No se pudieron cargar las normas.';
    } finally {
        cargandoNormas.value = false;
    }
}

async function cargarCriterios() {
    cargandoCriterios.value = true;
    error.value = '';

    try {
        criterios.value = await api.get('/normas/criterios');
    } catch (err) {
        error.value = err.message || 'No se pudieron cargar los criterios.';
    } finally {
        cargandoCriterios.value = false;
    }
}

function abrirNuevaNorma() {
    formularioNorma.value = {
        id: null,
        codigo: '',
        nombre: '',
        activo: true,
    };
    criteriosParaNorma.value = criterios.value
        .filter((criterio) => criterio.activo)
        .map((criterio) => ({ ...criterio, asignado: false }));
    errorNorma.value = '';
    modalNormaAbierto.value = true;
}

async function abrirEdicionNorma(norma) {
    formularioNorma.value = {
        id: norma.id,
        codigo: norma.codigo,
        nombre: norma.nombre,
        activo: norma.activo,
    };
    criteriosParaNorma.value = [];
    errorNorma.value = '';
    modalNormaAbierto.value = true;

    try {
        criteriosParaNorma.value = await api.get(`/normas/${norma.id}/criterios`);
    } catch (err) {
        errorNorma.value = err.message || 'No se pudieron cargar los criterios de la norma.';
    }
}

function cerrarModalNorma() {
    if (guardandoNorma.value) return;
    modalNormaAbierto.value = false;
}

async function guardarNorma() {
    if (guardandoNorma.value) return;

    guardandoNorma.value = true;
    errorNorma.value = '';

    try {
        const datos = {
            codigo: formularioNorma.value.codigo.trim(),
            nombre: formularioNorma.value.nombre.trim(),
        };

        let normaId = formularioNorma.value.id;

        if (normaId) {
            await api.put(`/normas/${normaId}`, {
                ...datos,
                activo: formularioNorma.value.activo,
            });
        } else {
            const nuevaNorma = await api.post('/normas', datos);
            normaId = nuevaNorma.id;
            formularioNorma.value.id = normaId;
        }

        if (formularioNorma.value.activo) {
            const criterioIds = criteriosParaNorma.value
                .filter((criterio) => criterio.asignado)
                .map((criterio) => criterio.id);

            await api.put(`/normas/${normaId}/criterios`, {
                criterio_ids: criterioIds,
            });
        }

        await cargarNormas();
        modalNormaAbierto.value = false;
    } catch (err) {
        errorNorma.value = err.message || 'No se pudo guardar la norma y sus criterios.';
    } finally {
        guardandoNorma.value = false;
    }
}

function abrirNuevoCriterio() {
    formularioCriterio.value = {
        id: null,
        codigo: '',
        descripcion: '',
        activo: true,
    };
    errorCriterio.value = '';
    modalCriterioAbierto.value = true;
}

function abrirEdicionCriterio(criterio) {
    formularioCriterio.value = {
        id: criterio.id,
        codigo: criterio.codigo,
        descripcion: criterio.descripcion,
        activo: criterio.activo,
    };
    errorCriterio.value = '';
    modalCriterioAbierto.value = true;
}

function cerrarModalCriterio() {
    if (guardandoCriterio.value) return;
    modalCriterioAbierto.value = false;
}

async function guardarCriterio() {
    if (guardandoCriterio.value) return;

    guardandoCriterio.value = true;
    errorCriterio.value = '';

    try {
        const datos = {
            codigo: formularioCriterio.value.codigo.trim(),
            descripcion: formularioCriterio.value.descripcion.trim(),
        };

        if (formularioCriterio.value.id) {
            await api.put(`/normas/criterios/${formularioCriterio.value.id}`, {
                ...datos,
                activo: formularioCriterio.value.activo,
            });
        } else {
            await api.post('/normas/criterios', datos);
        }

        await cargarCriterios();
        await cargarNormas();
        modalCriterioAbierto.value = false;
    } catch (err) {
        errorCriterio.value = err.message || 'No se pudo guardar el criterio.';
    } finally {
        guardandoCriterio.value = false;
    }
}

onMounted(async () => {
    await Promise.all([cargarNormas(), cargarCriterios()]);
});
</script>

<template>
    <div class="stack">
        <div class="page-head">
            <div>
                <h1>Normas</h1>
                <p>Administra las normas y el catálogo independiente de criterios.</p>
            </div>
            <button v-if="esAdmin" class="btn btn-primary" type="button" @click="abrirNuevaNorma">
                + Registrar norma
            </button>
        </div>

        <p v-if="error" class="error-banner" role="alert">{{ error }}</p>

        <BaseCard>
            <div class="toolbar">
                <div>
                    <h2>Normas registradas</h2>
                    <p class="muted">Selecciona los criterios que aplican a cada norma.</p>
                </div>
                <label class="search-wrap">
                    <input v-model="busquedaNormas" type="search" placeholder="Buscar norma"
                        aria-label="Buscar normas" />
                </label>
            </div>

            <div class="table-scroll">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Criterios</th>
                            <th>Estado</th>
                            <th v-if="esAdmin">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="cargandoNormas">
                            <td :colspan="esAdmin ? 5 : 4" class="empty-row">Cargando normas…</td>
                        </tr>
                        <tr v-for="norma in cargandoNormas ? [] : normasFiltradas" :key="norma.id">
                            <td><strong>{{ norma.codigo }}</strong></td>
                            <td>{{ norma.nombre }}</td>
                            <td>{{ norma.total_criterios }}</td>
                            <td>
                                <StatusBadge :estado="norma.activo ? 'activo' : 'inactivo'" />
                            </td>
                            <td v-if="esAdmin">
                                <div class="row-actions">
                                    <button class="action-btn edit" type="button" title="Editar norma y criterios"
                                        aria-label="Editar norma y criterios" @click="abrirEdicionNorma(norma)">
                                        <span aria-hidden="true">✎</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!cargandoNormas && normasFiltradas.length === 0">
                            <td :colspan="esAdmin ? 5 : 4" class="empty-row">No se encontraron normas.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </BaseCard>

        <BaseCard>
            <div class="toolbar">
                <div>
                    <h2>Catálogo de criterios</h2>
                    <p class="muted">Crea cada criterio una sola vez y asígnalo a las normas correspondientes.</p>
                </div>
                <button v-if="esAdmin" class="btn btn-primary" type="button" @click="abrirNuevoCriterio">
                    + Registrar criterio
                </button>
            </div>

            <div class="toolbar">
                <label class="search-wrap">
                    <input v-model="busquedaCriterios" type="search" placeholder="Buscar criterio"
                        aria-label="Buscar criterios" />
                </label>
            </div>

            <div class="table-scroll">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Estado</th>
                            <th v-if="esAdmin">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="cargandoCriterios">
                            <td :colspan="esAdmin ? 4 : 3" class="empty-row">Cargando criterios…</td>
                        </tr>
                        <tr v-for="criterio in cargandoCriterios ? [] : criteriosFiltrados" :key="criterio.id">
                            <td><strong>{{ criterio.codigo }}</strong></td>
                            <td>{{ criterio.descripcion }}</td>
                            <td>
                                <StatusBadge :estado="criterio.activo ? 'activo' : 'inactivo'" />
                            </td>
                            <td v-if="esAdmin">
                                <div class="row-actions">
                                    <button class="action-btn edit" type="button" title="Editar criterio"
                                        aria-label="Editar criterio" @click="abrirEdicionCriterio(criterio)">
                                        <span aria-hidden="true">✎</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!cargandoCriterios && criteriosFiltrados.length === 0">
                            <td :colspan="esAdmin ? 4 : 3" class="empty-row">No se encontraron criterios.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </BaseCard>

        <Teleport to="body">
            <div v-if="modalNormaAbierto" class="overlay" @click.self="cerrarModalNorma">
                <form class="modal" @submit.prevent="guardarNorma" @click.stop>
                    <div class="modal-head">
                        <h2>{{ formularioNorma.id ? 'Editar norma' : 'Registrar norma' }}</h2>
                        <button class="modal-close" type="button" @click="cerrarModalNorma">×</button>
                    </div>
                    <div class="modal-body">
                        <p v-if="errorNorma" class="error-banner" role="alert">{{ errorNorma }}</p>

                        <label class="field">
                            <span>Código *</span>
                            <input v-model="formularioNorma.codigo" maxlength="80" required
                                placeholder="Ej. ISO 14001:2015" />
                        </label>

                        <label class="field">
                            <span>Nombre o descripción *</span>
                            <input v-model="formularioNorma.nombre" maxlength="200" required
                                placeholder="Ej. Sistema de gestión ambiental" />
                        </label>

                        <label v-if="formularioNorma.id" class="field">
                            <span>Estado</span>
                            <select v-model="formularioNorma.activo">
                                <option :value="true">Activo</option>
                                <option :value="false">Inactivo</option>
                            </select>
                        </label>

                        <div class="field">
                            <span>Criterios que corresponden a esta norma</span>
                            <div v-if="criteriosParaNorma.length" class="norma-opciones">
                                <label v-for="criterio in criteriosParaNorma" :key="criterio.id" class="norma-opcion">
                                    <input v-model="criterio.asignado" type="checkbox"
                                        :disabled="formularioNorma.id && !formularioNorma.activo" />
                                    <span><strong>{{ criterio.codigo }}</strong> — {{ criterio.descripcion }}</span>
                                </label>
                            </div>
                            <p v-else class="muted">
                                No hay criterios activos. Regístralos primero en el catálogo de criterios.
                            </p>
                        </div>

                        <div class="modal-actions">
                            <button class="btn btn-ghost" type="button" @click="cerrarModalNorma">Cancelar</button>
                            <button class="btn btn-primary" type="submit" :disabled="guardandoNorma">
                                {{ guardandoNorma ? 'Guardando…' : 'Guardar norma' }}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </Teleport>

        <Teleport to="body">
            <div v-if="modalCriterioAbierto" class="overlay" @click.self="cerrarModalCriterio">
                <form class="modal" @submit.prevent="guardarCriterio" @click.stop>
                    <div class="modal-head">
                        <h2>{{ formularioCriterio.id ? 'Editar criterio' : 'Registrar criterio' }}</h2>
                        <button class="modal-close" type="button" @click="cerrarModalCriterio">×</button>
                    </div>
                    <div class="modal-body">
                        <p v-if="errorCriterio" class="error-banner" role="alert">{{ errorCriterio }}</p>

                        <label class="field">
                            <span>Código *</span>
                            <input v-model="formularioCriterio.codigo" maxlength="80" required placeholder="Ej. 4.1" />
                        </label>

                        <label class="field">
                            <span>Descripción del criterio *</span>
                            <textarea v-model="formularioCriterio.descripcion" maxlength="2000" rows="4" required
                                placeholder="Describe el criterio que se revisará" />
                        </label>

                        <label v-if="formularioCriterio.id" class="field">
                            <span>Estado</span>
                            <select v-model="formularioCriterio.activo">
                                <option :value="true">Activo</option>
                                <option :value="false">Inactivo</option>
                            </select>
                        </label>

                        <div class="modal-actions">
                            <button class="btn btn-ghost" type="button" @click="cerrarModalCriterio">
                                Cancelar
                            </button>
                            <button class="btn btn-primary" type="submit" :disabled="guardandoCriterio">
                                {{ guardandoCriterio ? 'Guardando…' : 'Guardar criterio' }}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </Teleport>
    </div>
</template>

<style scoped src="../assets/styles/ProcesosView.css"></style>