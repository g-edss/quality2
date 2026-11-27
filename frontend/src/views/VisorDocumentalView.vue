<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/client.js';
import AppIcon from '@/components/AppIcon.vue';
import SolicitudesCopiasModal from '@/components/SolicitudesCopiasModal.vue';
import { useAuthStore } from '@/stores/auth';
import { tienePermiso } from '@/config/permisos';

const auth = useAuthStore();

const puede = (accion) => tienePermiso(auth.usuario, `visorDocumental.${accion}`);

const documentos = ref([]);
const cargando = ref(false);
const error = ref('');
const accionArchivo = ref('');
const busqueda = ref('');
const procesoSeleccionado = ref('');
const tipoSeleccionado = ref('');
const documentoSolicitud = ref(null);
const destinatarioCopia = ref('');
const motivoCopia = ref('');
const guardandoSolicitud = ref(false);
const solicitudesAbiertas = ref(false);
const mensajeSolicitud = ref('');

const procesosDisponibles = computed(() => {
    const procesosUnicos = new Map();

    documentos.value.forEach((documento) => {
        if (documento.proceso_id && documento.proceso) {
            procesosUnicos.set(
                String(documento.proceso_id),
                {
                    id: String(documento.proceso_id),
                    nombre: documento.proceso
                }
            );
        }
    });

    return Array.from(procesosUnicos.values())
        .sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es')
        );
});

const tiposDisponibles = computed(() => {
    if (!procesoSeleccionado.value) {
        return [];
    }

    const tiposUnicos = new Map();

    documentos.value
        .filter(
            (documento) =>
                String(documento.proceso_id) ===
                procesoSeleccionado.value
        )
        .forEach((documento) => {
            tiposUnicos.set(
                String(documento.tipo_documento_id),
                {
                    id: String(documento.tipo_documento_id),
                    nombre: documento.tipo
                }
            );
        });

    return Array.from(tiposUnicos.values())
        .sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es')
        );
});

function seleccionarProceso(procesoId) {
    procesoSeleccionado.value = String(procesoId);
    tipoSeleccionado.value = '';
}

function seleccionarTipo(tipoId) {
    tipoSeleccionado.value = String(tipoId);
}

function normalizarTexto(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function esDocumentoRegistro(documento) {
    const tipo = normalizarTexto(documento.tipo);
    const codigo = String(documento.codigo || '')
        .trim()
        .toUpperCase();

    return (
        tipo === 'registro' ||
        codigo.startsWith('REG-') ||
        documento.origen === 'externo'
    );
}

const documentosFiltrados = computed(() => {
    const texto = normalizarTexto(busqueda.value);

    return documentos.value.filter((documento) => {
        const coincideProceso =
            !procesoSeleccionado.value ||
            String(documento.proceso_id) ===
            procesoSeleccionado.value;

        const coincideTipo =
            !tipoSeleccionado.value ||
            String(documento.tipo_documento_id) ===
            tipoSeleccionado.value;

        const contenidoDocumento = normalizarTexto([
            documento.codigo,
            documento.nombre,
            documento.proceso,
            documento.tipo,
            documento.origen
        ].join(' '));

        const coincideBusqueda =
            !texto ||
            contenidoDocumento.includes(texto);

        return (
            coincideProceso &&
            coincideTipo &&
            coincideBusqueda
        );
    });
});

const documentosVisibles = computed(() => {
    const hayBusqueda = normalizarTexto(busqueda.value);

    if (
        !hayBusqueda &&
        (
            !procesoSeleccionado.value ||
            !tipoSeleccionado.value
        )
    ) {
        return [];
    }

    return documentosFiltrados.value;
});

async function cargarDocumentos() {
    cargando.value = true;
    error.value = '';

    try {
        documentos.value =
            await api.get('/documentos/visor');
    } catch (err) {
        error.value =
            err.message || 'No se pudo cargar el visor documental.';
    } finally {
        cargando.value = false;
    }
}

async function verPdf(documento) {
    error.value = '';

    const ventana = window.open('', '_blank');

    if (!ventana) {
        error.value =
            'El navegador bloqueó la nueva pestaña.';
        return;
    }

    ventana.document.title = 'Cargando PDF...';
    ventana.document.body.textContent =
        'Cargando documento...';

    accionArchivo.value = `pdf-${documento.id}`;

    try {
        const blob = await api.getBlob(
            `/documentos/${documento.id}/versiones/${documento.version_id}/pdf`,
        );

        const url = URL.createObjectURL(blob);
        ventana.location.href = url;

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 300000);
    } catch (err) {
        ventana.close();
        error.value =
            err.message || 'No se pudo abrir el PDF.';
    } finally {
        accionArchivo.value = '';
    }
}

async function descargarOriginal(documento) {
    error.value = '';
    accionArchivo.value = `original-${documento.id}`;

    try {
        const blob = await api.getBlob(
            `/documentos/${documento.id}/versiones/${documento.version_id}/original`,
        );

        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download =
            documento.nombre_original || 'documento';

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        error.value =
            err.message || 'No se pudo descargar el original.';
    } finally {
        accionArchivo.value = '';
    }
}

function abrirSolicitud(documento) {
    documentoSolicitud.value = documento;
    destinatarioCopia.value = '';
    motivoCopia.value = '';
    error.value = '';
}

function cerrarSolicitud() {
    if (guardandoSolicitud.value) return;
    documentoSolicitud.value = null;
    error.value = '';
}

async function enviarSolicitud() {
    if (!documentoSolicitud.value || guardandoSolicitud.value) return;
    guardandoSolicitud.value = true;
    error.value = '';
    mensajeSolicitud.value = '';
    try {
        const respuesta = await api.post('/copias-controladas/solicitudes', {
            documento_id: documentoSolicitud.value.id,
            destinatario_nombre: destinatarioCopia.value.trim(),
            motivo: motivoCopia.value.trim(),
        });
        mensajeSolicitud.value = respuesta.mensaje;
        documentoSolicitud.value = null;
    } catch (e) {
        error.value = e.message;
    } finally {
        guardandoSolicitud.value = false;
    }
}

onMounted(cargarDocumentos);
</script>

<template>
    <div class="stack">
        <div class="page-head">
            <div>
                <h1>Visor Documental</h1>
                <p>Consulta los documentos vigentes del sistema de calidad.</p>
            </div>
            <button v-if="puede('solicitarCopia') || puede('resolverCopias')" class="btn btn-ghost" type="button" @click="solicitudesAbiertas = true">
                {{ puede('resolverCopias') ? 'Solicitudes de copias' : 'Mis solicitudes de copias' }}
            </button>
        </div>

        <p v-if="mensajeSolicitud" class="mensaje-solicitud">{{ mensajeSolicitud }}</p>

        <div class="buscador-documental">
            <AppIcon name="search" :size="18" />

            <input v-model="busqueda" type="search" placeholder="Buscar por código o nombre del documento" />
        </div>

        <div class="navegador-documental">
            <section class="panel-documental">
                <h2>Proceso</h2>

                <div class="lista-opciones">
                    <button v-for="proceso in procesosDisponibles" :key="proceso.id" class="opcion-navegacion" :class="{
                        activa:
                            procesoSeleccionado === proceso.id
                    }" type="button" @click="seleccionarProceso(proceso.id)">
                        <span>{{ proceso.nombre }}</span>
                        <span aria-hidden="true">›</span>
                    </button>
                </div>
            </section>

            <section class="panel-documental">
                <h2>Tipo de documento</h2>

                <p v-if="!procesoSeleccionado" class="mensaje-panel">
                    Selecciona primero un proceso.
                </p>

                <p v-else-if="tiposDisponibles.length === 0" class="mensaje-panel">
                    Este proceso no tiene tipos disponibles.
                </p>

                <div v-else class="lista-opciones">
                    <button v-for="tipo in tiposDisponibles" :key="tipo.id" class="opcion-navegacion" :class="{
                        activa:
                            tipoSeleccionado === tipo.id
                    }" type="button" @click="seleccionarTipo(tipo.id)">
                        <span>{{ tipo.nombre }}</span>
                        <span aria-hidden="true">›</span>
                    </button>
                </div>
            </section>

            <section class="panel-documental panel-documentos">
                <h2>Documento</h2>

                <p v-if="cargando" class="mensaje-panel">
                    Cargando documentos vigentes...
                </p>

                <p v-else-if="error" class="mensaje-panel mensaje-error">
                    {{ error }}
                </p>

                <p v-else-if="
                    !busqueda &&
                    (
                        !procesoSeleccionado ||
                        !tipoSeleccionado
                    )
                " class="mensaje-panel">
                    Selecciona un proceso y un tipo de documento.
                </p>

                <p v-else-if="documentosVisibles.length === 0" class="mensaje-panel">
                    No hay documentos que coincidan con la selección.
                </p>

                <div v-else class="lista-documentos">
                    <article v-for="documento in documentosVisibles" :key="documento.id" class="documento-item">
                        <div class="informacion-documento">
                            <code>
                        {{ documento.codigo || 'Sin código' }}
                    </code>

                            <strong>{{ documento.nombre }}</strong>

                            <span>
                                {{ documento.tipo }} ·
                                v{{ documento.version }}
                            </span>
                        </div>

                        <div class="acciones-documento">
                            <button v-if="puede('solicitarCopia')" class="btn btn-ghost btn-sm" type="button" @click="abrirSolicitud(documento)">Solicitar copia</button>
                            <button class="btn btn-ghost btn-sm" type="button" :disabled="Boolean(accionArchivo)"
                                @click="verPdf(documento)">
                                <AppIcon name="search" :size="14" />

                                {{
                                    accionArchivo ===
                                        `pdf-${documento.id}`
                                        ? 'Abriendo...'
                                        : 'Ver PDF'
                                }}
                            </button>

                            <button v-if="esDocumentoRegistro(documento) && puede('descargarOriginal')" class="btn btn-ghost btn-sm" type="button"
                                :disabled="Boolean(accionArchivo)" @click="descargarOriginal(documento)">
                                <AppIcon name="doc" :size="14" />

                                {{
                                    accionArchivo ===
                                        `original-${documento.id}`
                                        ? 'Descargando...'
                                        : 'Original'
                                }}
                            </button>
                        </div>
                    </article>
                </div>
            </section>
        </div>
        <Teleport to="body">
            <div v-if="documentoSolicitud" class="overlay-solicitud" @click.self="cerrarSolicitud">
                <form class="modal-solicitud" role="dialog" aria-modal="true" aria-labelledby="titulo-solicitud-copia" @submit.prevent="enviarSolicitud">
                    <div class="cabecera-solicitud">
                        <div>
                            <h2 id="titulo-solicitud-copia">Solicitar copia controlada</h2>
                            <p>{{ documentoSolicitud.codigo }} · {{ documentoSolicitud.nombre }} · v{{ documentoSolicitud.version }}</p>
                        </div>
                        <button type="button" aria-label="Cerrar" :disabled="guardandoSolicitud" @click="cerrarSolicitud">×</button>
                    </div>
                    <div class="contenido-solicitud">
                        <label>Nombre de quien recibirá la copia *
                            <input v-model="destinatarioCopia" maxlength="200" required placeholder="Ej. Coordinación de laboratorios" />
                        </label>
                        <label>Motivo de la solicitud *
                            <textarea v-model="motivoCopia" maxlength="2000" rows="3" required placeholder="Indica para qué se necesita la copia" />
                        </label>
                        <p v-if="error" class="mensaje-error" role="alert">{{ error }}</p>
                    </div>
                    <div class="acciones-solicitud">
                        <button class="btn btn-ghost" type="button" :disabled="guardandoSolicitud" @click="cerrarSolicitud">Cancelar</button>
                        <button class="btn btn-primary" type="submit" :disabled="guardandoSolicitud">{{ guardandoSolicitud ? 'Enviando...' : 'Enviar solicitud' }}</button>
                    </div>
                </form>
            </div>
        </Teleport>
        <SolicitudesCopiasModal v-if="solicitudesAbiertas" :admin="puede('resolverCopias')" @close="solicitudesAbiertas = false" />
    </div>
</template>

<style scoped src="../assets/styles/VisorDocumentalView.css"></style>