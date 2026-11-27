<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth.js';
import AppIcon from '@/components/AppIcon.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { solicitarTexto } from '@/utils/dialogos';
import { tienePermiso } from '@/config/permisos';
import { mostrarFecha, mostrarFechaHora } from '@/utils/fechas';

const auth = useAuthStore();

const puede = (accion) => tienePermiso(auth.usuario, `solicitudes.${accion}`);
const PERMISO_POR_TIPO = { cambio: 'solicitarCambio', baja: 'solicitarBaja' };
const route = useRoute();
const router = useRouter();
const solicitudes = ref([]);
const busquedaSolicitudes = ref('');
const fechaDesdeSolicitudes = ref('');
const fechaHastaSolicitudes = ref('');
const vistaActual = ref('flujo');
const etapaActiva = ref(null);
const mostrarModalNueva = ref(false);
const cargandoCatalogos = ref(false);
const procesandoNueva = ref(false);
const errorNueva = ref('');

const documentosDisponibles = ref([]);
const procesosDisponibles = ref([]);

function formularioNuevaInicial() {
  return {
    tipoClave: 'alta',
    documentoId: '',
    nombreDocumento: '',
    procesoId: '',
    solicitante: '',
    descripcion: '',
    archivos: [],
  };
}

const formNueva = ref(formularioNuevaInicial());

function formularioCorreccionInicial() {
  return {
    descripcion: '',
    comentario: '',
    archivos: [],
  };
}

const modalCorreccionAbierto = ref(false);
const solicitudCorreccion = ref(null);
const procesandoCorreccion = ref(false);
const errorCorreccion = ref('');
const formCorreccion = ref(
  formularioCorreccionInicial()
);

const documentoSeleccionado = computed(() =>
  documentosDisponibles.value.find(
    documento =>
      Number(documento.id) ===
      Number(formNueva.value.documentoId),
  ) || null,
);

const solicitudesFiltradas = computed(() => {
  const termino = busquedaSolicitudes.value.trim().toLocaleLowerCase('es-MX');
  return solicitudes.value.filter((solicitud) => {
    const fecha = String(solicitud.creado_en || '').slice(0, 10);
    if (fechaDesdeSolicitudes.value && fecha < fechaDesdeSolicitudes.value) return false;
    if (fechaHastaSolicitudes.value && fecha > fechaHastaSolicitudes.value) return false;
    if (!termino) return true;
    return [
      `SOL-${solicitud.id}`,
      solicitud.documento,
      solicitud.codigo,
      solicitud.proceso,
      solicitud.tipo_solicitud,
      solicitud.solicitante,
      solicitud.estado,
    ].some((valor) => String(valor || '').toLocaleLowerCase('es-MX').includes(termino));
  });
});

function limpiarFiltrosSolicitudes() {
  busquedaSolicitudes.value = '';
  fechaDesdeSolicitudes.value = '';
  fechaHastaSolicitudes.value = '';
}

function abrirSolicitudes() {
  vistaActual.value = 'solicitudes';
}

function abrirDocumentos() {
  router.push({ name: 'documentos' });
}

function volverAlFlujo() {
  vistaActual.value = 'flujo';
}

function activarEtapa(etapa) {
  etapaActiva.value = etapa;
}

function desactivarEtapa() {
  etapaActiva.value = null;
}

async function cargarCatalogosNueva() {
  cargandoCatalogos.value = true;
  errorNueva.value = '';

  try {
    const [
      documentos,
      procesos,
    ] = await Promise.all([
      api.get('/documentos/visor'),
      api.get('/procesos'),
    ]);

    documentosDisponibles.value =
      documentos.filter(
        documento =>
          documento.estado === 'vigente',
      );

    procesosDisponibles.value =
      procesos.filter(
        proceso =>
          proceso.estatus === 'activo',
      );
  } catch (err) {
    errorNueva.value =
      err.message ||
      'No se pudieron cargar los catálogos.';
  } finally {
    cargandoCatalogos.value = false;
  }
}

async function abrirNuevaSolicitud(tipoClave = 'alta') {
  formNueva.value = formularioNuevaInicial();
  formNueva.value.tipoClave = tipoClave;
  formNueva.value.solicitante =
    auth.usuario?.nombre || '';
  errorNueva.value = '';
  mostrarModalNueva.value = true;

  await cargarCatalogosNueva();
}

function cerrarNuevaSolicitud() {
  if (procesandoNueva.value) {
    return;
  }

  mostrarModalNueva.value = false;
  errorNueva.value = '';
}

function abrirCorreccion(solicitud) {
  solicitudCorreccion.value = solicitud;

  formCorreccion.value = {
    descripcion: solicitud.descripcion || '',
    comentario: '',
    archivos: [],
  };

  errorCorreccion.value = '';
  modalCorreccionAbierto.value = true;
}

function cerrarCorreccion() {
  if (procesandoCorreccion.value) {
    return;
  }

  modalCorreccionAbierto.value = false;
  solicitudCorreccion.value = null;
  errorCorreccion.value = '';
  formCorreccion.value =
    formularioCorreccionInicial();
}

function seleccionarArchivosCorreccion(evento) {
  formCorreccion.value.archivos =
    Array.from(evento.target.files || []);
}

async function guardarCorreccion() {
  if (
    procesandoCorreccion.value ||
    !solicitudCorreccion.value
  ) {
    return;
  }

  const descripcion =
    formCorreccion.value.descripcion.trim();

  const comentario =
    formCorreccion.value.comentario.trim();

  if (!descripcion) {
    errorCorreccion.value =
      'La descripción es obligatoria.';
    return;
  }

  if (!comentario) {
    errorCorreccion.value =
      'Explica qué cambios realizaste.';
    return;
  }

  const datos = new FormData();

  datos.append('descripcion', descripcion);
  datos.append('comentario', comentario);

  for (const archivo of formCorreccion.value.archivos) {
    datos.append('archivos', archivo);
  }

  procesandoCorreccion.value = true;
  errorCorreccion.value = '';
  mensaje.value = '';

  try {
    const respuesta = await api.postForm(
      `/solicitudes/${solicitudCorreccion.value.id}/reenviar`,
      datos
    );

    modalCorreccionAbierto.value = false;
    solicitudCorreccion.value = null;
    formCorreccion.value =
      formularioCorreccionInicial();

    await cargarSolicitudes();

    mensaje.value =
      respuesta.mensaje ||
      'La solicitud fue corregida y reenviada.';
  } catch (err) {
    errorCorreccion.value =
      err.message ||
      'No se pudo reenviar la solicitud.';
  } finally {
    procesandoCorreccion.value = false;
  }
}

const cargando = ref(false);
const error = ref('');
const mensaje = ref('');
const cancelandoId = ref(null);
const accionArchivo = ref('');
const decisionAbierta = ref(false);
const solicitudSeleccionada = ref(null);
const modalSoloLectura = ref(false);
const procesandoDecision = ref(false);
const comentarioDecision = ref('');
const historialSolicitud = ref([]);
const cargandoHistorial = ref(false);
const errorHistorial = ref('');

async function abrirModalSolicitud(
  solicitud,
  soloLectura
) {
  error.value = '';
  comentarioDecision.value = '';
  solicitudSeleccionada.value = solicitud;
  modalSoloLectura.value = soloLectura;
  decisionAbierta.value = true;

  await cargarHistorialSolicitud(solicitud.id);
}

async function abrirDetalle(solicitud) {
  await abrirModalSolicitud(solicitud, true);
}

function abrirDetalleDesdeTarjeta(
  evento,
  solicitud
) {
  const elementoInteractivo =
    evento.target.closest(
      'button, a, input, select, textarea'
    );

  if (elementoInteractivo) {
    return;
  }

  abrirDetalle(solicitud);
}

async function abrirDecision(solicitud) {
  await abrirModalSolicitud(solicitud, false);
}

async function cargarHistorialSolicitud(solicitudId) {
  cargandoHistorial.value = true;
  errorHistorial.value = '';
  historialSolicitud.value = [];

  try {
    historialSolicitud.value = await api.get(
      `/solicitudes/${solicitudId}/historial`
    );
  } catch (err) {
    errorHistorial.value =
      err.message || 'No se pudo cargar el historial.';
  } finally {
    cargandoHistorial.value = false;
  }
}

function cerrarDecision() {
  if (procesandoDecision.value) {
    return;
  }

  decisionAbierta.value = false;
  modalSoloLectura.value = false;
  solicitudSeleccionada.value = null;
  comentarioDecision.value = '';
  historialSolicitud.value = [];
  errorHistorial.value = '';
  error.value = '';
}

function formatearFecha(valor) {
  return mostrarFecha(String(valor || '').slice(0, 10));
}

function formatearFechaHora(valor) {
  return mostrarFechaHora(valor);
}

function claseEstado(estado) {
  const valor = String(estado || '').toLowerCase();

  if (valor.includes('aprobad')) {
    return 'solcambio-badge--exito';
  }

  if (valor.includes('rechaz')) {
    return 'solcambio-badge--rechazo';
  }

  if (valor.includes('pendiente')) {
    return 'solcambio-badge--pendiente';
  }

  if (
    valor.includes('revisor') ||
    valor.includes('aprobador') ||
    valor.includes('responsable')
  ) {
    return 'solcambio-badge--proceso';
  }

  if (valor.includes('correccion')) {
    return 'solcambio-badge--pendiente';
  }

  return 'solcambio-badge--neutro';
}

function etiquetaEstado(estado) {
  const etiquetas = {
    pendiente: 'Pendiente',
    en_responsable: 'Con responsable',
    en_revisor: 'Con revisor',
    en_aprobador: 'Con aprobador',
    correcciones: 'Requiere correcciones',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada'
  };

  return etiquetas[estado] || estado;
}

function textoAsignacion(solicitud) {
  const participantes = [
    solicitud.responsable
      ? `Responsable: ${solicitud.responsable}`
      : null,
    solicitud.revisor
      ? `Revisor: ${solicitud.revisor}`
      : 'Sin revisor',
    solicitud.aprobador
      ? `Aprobador: ${solicitud.aprobador}`
      : null,
  ].filter(Boolean);

  return participantes.join(' · ');
}

function etiquetaArchivosSolicitud(solicitud) {
  if (solicitud.es_registro) {
    return 'Evidencia del registro';
  }

  const etiquetas = {
    cambio: 'Archivo propuesto para la nueva versión',
    baja: 'Evidencia de la solicitud de baja',
    alta: 'Archivo del nuevo documento',
  };

  return (
    etiquetas[solicitud.tipo_clave] ||
    'Archivos adjuntos'
  );
}

async function descargarArchivoSolicitud(solicitud, archivo) {
  error.value = '';
  accionArchivo.value = `solicitud-${archivo.id}`;

  try {
    const blob = await api.getBlob(
      `/solicitudes/${solicitud.id}/archivos/${archivo.id}`,
    );

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = archivo.nombre_archivo || 'archivo';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
  } catch (err) {
    error.value =
      err.message || 'No se pudo descargar el archivo adjunto.';
  } finally {
    accionArchivo.value = '';
  }
}

async function verPdf(solicitud) {
  error.value = '';

  if (solicitud.es_registro) {
    accionArchivo.value = `registro-${solicitud.id}`;

    try {
      const blob = await api.getBlob(
        `/registros/${solicitud.registro_id}/archivo`
      );

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');

      enlace.href = url;
      enlace.download =
        solicitud.nombre_archivo || 'registro';

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      error.value =
        err.message ||
        'No se pudo descargar la evidencia.';
    } finally {
      accionArchivo.value = '';
    }

    return;
  }

  const ventana = window.open('', '_blank');

  if (!ventana) {
    error.value =
      'El navegador bloqueó la nueva pestaña.';
    return;
  }

  ventana.document.title = 'Cargando PDF...';
  ventana.document.body.textContent =
    'Cargando documento...';

  accionArchivo.value = `pdf-${solicitud.id}`;

  try {
    const blob = await api.getBlob(
      `/documentos/${solicitud.documento_id}` +
      `/versiones/${solicitud.version_documento_id}` +
      '/pdf'
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

async function descargarOriginalDocumento(solicitud) {
  error.value = '';
  accionArchivo.value = `original-${solicitud.id}`;

  try {
    const blob = await api.getBlob(
      `/documentos/${solicitud.documento_id}` +
      `/versiones/${solicitud.version_documento_id}` +
      '/original'
    );

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download =
      solicitud.documento_nombre_original ||
      'documento';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo descargar el archivo original.';
  } finally {
    accionArchivo.value = '';
  }
}

async function avanzarSeleccionada() {
  if (
    !solicitudSeleccionada.value ||
    procesandoDecision.value
  ) {
    return;
  }

  procesandoDecision.value = true;
  error.value = '';
  mensaje.value = '';

  try {
    const respuesta = await api.post(
      `/solicitudes/${solicitudSeleccionada.value.id}` +
      '/avanzar',
      {
        comentario:
          comentarioDecision.value.trim() || null,
      },
    );

    decisionAbierta.value = false;
    solicitudSeleccionada.value = null;
    comentarioDecision.value = '';

    await cargarSolicitudes();

    mensaje.value =
      respuesta.mensaje ||
      'La solicitud avanzó a la siguiente etapa.';
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo avanzar la solicitud.';
  } finally {
    procesandoDecision.value = false;
  }
}

async function aprobarSeleccionada() {
  if (
    !solicitudSeleccionada.value ||
    procesandoDecision.value
  ) {
    return;
  }

  procesandoDecision.value = true;
  error.value = '';
  mensaje.value = '';

  try {
    const respuesta = await api.post(
      `/solicitudes/${solicitudSeleccionada.value.id}` +
      '/aprobar',
      {
        comentario:
          comentarioDecision.value || null,
      },
    );

    decisionAbierta.value = false;
    solicitudSeleccionada.value = null;
    comentarioDecision.value = '';

    await cargarSolicitudes();

    mensaje.value =
      respuesta.mensaje ||
      'La solicitud fue aprobada correctamente.';
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo aprobar la solicitud.';
  } finally {
    procesandoDecision.value = false;
  }
}

async function devolverSeleccionada() {
  if (
    !solicitudSeleccionada.value ||
    procesandoDecision.value
  ) {
    return;
  }

  const comentario = comentarioDecision.value.trim();

  if (!comentario) {
    error.value =
      'Escribe las correcciones que debe realizar el elaborador.';
    return;
  }

  procesandoDecision.value = true;
  error.value = '';
  mensaje.value = '';

  try {
    const respuesta = await api.post(
      `/solicitudes/${solicitudSeleccionada.value.id}` +
      '/correcciones',
      { comentario },
    );

    decisionAbierta.value = false;
    solicitudSeleccionada.value = null;
    comentarioDecision.value = '';

    await cargarSolicitudes();

    mensaje.value =
      respuesta.mensaje ||
      'El documento fue devuelto para correcciones.';
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo devolver el documento.';
  } finally {
    procesandoDecision.value = false;
  }
}

async function rechazarSeleccionada() {
  if (
    !solicitudSeleccionada.value ||
    procesandoDecision.value
  ) {
    return;
  }

  const comentario = comentarioDecision.value.trim();

  if (!comentario) {
    error.value =
      'Escribe el motivo del rechazo.';
    return;
  }

  procesandoDecision.value = true;
  error.value = '';
  mensaje.value = '';

  try {
    const respuesta = await api.post(
      `/solicitudes/${solicitudSeleccionada.value.id}` +
      '/rechazar',
      { comentario },
    );

    decisionAbierta.value = false;
    solicitudSeleccionada.value = null;
    comentarioDecision.value = '';

    await cargarSolicitudes();

    mensaje.value =
      respuesta.mensaje ||
      'La solicitud fue rechazada.';
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo rechazar la solicitud.';
  } finally {
    procesandoDecision.value = false;
  }
}

function seleccionarArchivos(evento) {
  formNueva.value.archivos =
    Array.from(evento.target.files || []);
}

async function guardarNuevaSolicitud() {
  if (procesandoNueva.value) {
    return;
  }

  if (formNueva.value.tipoClave === 'alta') {
    const nombreDocumento =
      formNueva.value.nombreDocumento.trim();

    const procesoId =
      Number(formNueva.value.procesoId);

    const descripcion =
      formNueva.value.descripcion.trim();

    if (!nombreDocumento) {
      errorNueva.value =
        'Debes escribir el nombre del documento.';
      return;
    }

    if (!Number.isInteger(procesoId)) {
      errorNueva.value =
        'Debes seleccionar un proceso.';
      return;
    }

    if (!descripcion) {
      errorNueva.value =
        'Debes describir la solicitud.';
      return;
    }

    mostrarModalNueva.value = false;

    await router.push({
      name: 'documentos',
      query: {
        nuevo: '1',
        nombre: nombreDocumento,
        procesoId,
        descripcion,
      },
    });

    return;
  }

  const documentoId = Number(formNueva.value.documentoId);

  const descripcion = formNueva.value.descripcion.trim();

  if (!Number.isInteger(documentoId)) {
    errorNueva.value =
      'Debes seleccionar un documento.';
    return;
  }

  if (!descripcion) {
    errorNueva.value =
      'Debes explicar el motivo de la solicitud.';
    return;
  }

  const permisoTipo = PERMISO_POR_TIPO[formNueva.value.tipoClave];
  if (permisoTipo && !puede(permisoTipo)) {
    errorNueva.value = 'No tienes permiso para este tipo de solicitud.';
    return;
  }

  if (
    formNueva.value.tipoClave === 'cambio' &&
    formNueva.value.archivos.length === 0
  ) {
    errorNueva.value =
      'Adjunta el archivo que se convertirá en la nueva versión.';
    return;
  }

  const datos = new FormData();

  datos.append('tipoClave', formNueva.value.tipoClave);

  datos.append('documentoId', String(documentoId));

  datos.append('descripcion', descripcion);

  for (const archivo of formNueva.value.archivos) {
    datos.append('archivos', archivo);
  }

  procesandoNueva.value = true;
  errorNueva.value = '';
  mensaje.value = '';

  try {
    const respuesta = await api.postForm('/solicitudes', datos);

    mostrarModalNueva.value = false;
    formNueva.value = formularioNuevaInicial();
    vistaActual.value = 'solicitudes';

    await cargarSolicitudes();

    mensaje.value =
      respuesta.mensaje ||
      'La solicitud fue creada correctamente.';
  } catch (err) {
    errorNueva.value =
      err.message ||
      'No se pudo crear la solicitud.';
  } finally {
    procesandoNueva.value = false;
  }
}

async function abrirSolicitudDesdeRevision() {
  if (route.query.revision !== '1') {
    return;
  }

  const documentoId = Number(
    route.query.documentoId,
  );

  if (
    !Number.isInteger(documentoId) ||
    documentoId <= 0
  ) {
    return;
  }

  await abrirNuevaSolicitud();

  const documento =
    documentosDisponibles.value.find(
      (elemento) =>
        Number(elemento.id) === documentoId,
    );

  formNueva.value.tipoClave = 'cambio';
  formNueva.value.documentoId = documentoId;
  formNueva.value.descripcion =
    `La revisión programada del documento ` +
    `${documento?.codigo || ''} determinó que ` +
    `se requiere una actualización.`;

  vistaActual.value = 'solicitudes';

  await router.replace({
    name: 'solicitudes',
  });
}

async function cargarSolicitudes() {
  cargando.value = true;
  error.value = '';

  try {
    solicitudes.value = await api.get('/solicitudes');
  } catch (err) {
    error.value =
      err.message || 'No se pudieron cargar las solicitudes.';
  } finally {
    cargando.value = false;
  }
}

async function cancelarSolicitud(solicitud) {
  if (cancelandoId.value) return;
  const motivo = await solicitarTexto({
    titulo: `Cancelar SOL-${solicitud.id}`,
    mensaje: `¿Confirmas que deseas cancelar SOL-${solicitud.id}?`,
    etiquetaCampo: 'Motivo de cancelación (opcional)',
    confirmarTexto: 'Cancelar solicitud',
    peligro: true,
  });
  if (motivo === null) return;

  cancelandoId.value = solicitud.id;
  error.value = '';
  mensaje.value = '';
  try {
    const respuesta = await api.post(`/solicitudes/${solicitud.id}/cancelar`, { motivo });
    await cargarSolicitudes();
    mensaje.value = respuesta.mensaje || 'La solicitud fue cancelada.';
  } catch (err) {
    error.value = err.message || 'No se pudo cancelar la solicitud.';
  } finally {
    cancelandoId.value = null;
  }
}

async function abrirResultadoBusqueda() {
  const id = Number(route.query.id);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const solicitud = solicitudes.value.find(elemento => elemento.id === id);
  if (!solicitud) return;
  vistaActual.value = 'solicitudes';
  await abrirDetalle(solicitud);
}

watch(() => route.query.id, abrirResultadoBusqueda);

onMounted(async () => {
  await cargarSolicitudes();
  await abrirSolicitudDesdeRevision();
  await abrirResultadoBusqueda();
});
</script>

<template>
  <section class="solcambio-page">
    <div class="solcambio-page__top">
      <div>
        <h1 class="solcambio-page__title">Solicitudes y Cambios</h1>
        <p class="pagina-subtitulo">Solicita cambios o bajas de documentos y sigue su revisión y aprobación.</p>
      </div>

      <span class="solcambio-page__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M20 3.5l0.5 0.5-8 8-3 1 1-3 8-8z" />
        </svg>
      </span>
    </div>

    <div class="solcambio-card">
      <div class="solcambio-card__actions">
        <template v-if="vistaActual === 'flujo'">
          <button class="solcambio-btn solcambio-btn--solido" type="button" @click="abrirNuevaSolicitud()">
            <span>+</span>
            Nueva solicitud
          </button>

          <button class="solcambio-btn" type="button" @click="abrirSolicitudes">
            <span>▥</span>
            Solicitudes
          </button>
        </template>

        <button v-else class="solcambio-btn" type="button" @click="volverAlFlujo">
          <span>←</span>
          Volver al flujo
        </button>
      </div>

      <template v-if="vistaActual === 'flujo'">
        <h2 class="solcambio-flow__title">
          Flujo de solicitud de cambios
        </h2>

        <div class="solcambio-flow">
          <div class="solcambio-flow__col">
            <button class="solcambio-step solcambio-step--arrow" :class="{
              'solcambio-step--active': etapaActiva === 1
            }" type="button" @click="abrirDocumentos" @mouseenter="activarEtapa(1)" @mouseleave="desactivarEtapa">
              <svg class="solcambio-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 16V6" />
                <path d="M8 10l4-4 4 4" />
                <path d="M5 18h14" />
              </svg>

              <span class="solcambio-step__text">
                Registrar<br />
                documento
              </span>
            </button>

            <span class="solcambio-connector">
              <span class="solcambio-connector__line"></span>
              <span class="solcambio-connector__dot"></span>
            </span>

            <span class="solcambio-flow__role">
              Solicitante
            </span>
          </div>

          <span class="solcambio-flow__arrow">→</span>

          <div class="solcambio-flow__col">
            <button class="solcambio-step solcambio-step--arrow" :class="{
              'solcambio-step--active': etapaActiva === 2
            }" type="button" :disabled="!puede('solicitarCambio')"
              :title="puede('solicitarCambio') ? '' : 'No tienes permiso para solicitar cambios'"
              @click="abrirNuevaSolicitud('cambio')" @mouseenter="activarEtapa(2)" @mouseleave="desactivarEtapa">
              <svg class="solcambio-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 7h11" />
                <path d="M12 4l3 3-3 3" />
                <path d="M20 17H9" />
                <path d="M12 20l-3-3 3-3" />
              </svg>

              <span class="solcambio-step__text">
                Solicitar cambio<br />
                o baja
              </span>
            </button>

            <span class="solcambio-connector">
              <span class="solcambio-connector__line"></span>
              <span class="solcambio-connector__dot"></span>
            </span>

            <span class="solcambio-flow__role">
              Solicitante
            </span>
          </div>

          <span class="solcambio-flow__arrow">→</span>

          <div class="solcambio-flow__col">
            <button class="solcambio-step solcambio-step--arrow" :class="{
              'solcambio-step--active': etapaActiva === 3
            }" type="button" @click="abrirSolicitudes" @mouseenter="activarEtapa(3)" @mouseleave="desactivarEtapa">
              <svg class="solcambio-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10" cy="10" r="6" />
                <line x1="14.5" y1="14.5" x2="20" y2="20" />
              </svg>

              <span class="solcambio-step__text">
                Revisión de<br />
                la solicitud
              </span>
            </button>

            <span class="solcambio-connector">
              <span class="solcambio-connector__line"></span>
              <span class="solcambio-connector__dot"></span>
            </span>

            <span class="solcambio-flow__role">
              Revisor
            </span>
          </div>

          <span class="solcambio-flow__arrow">→</span>

          <div class="solcambio-flow__col">
            <button class="solcambio-step solcambio-step--decision" :class="{
              'solcambio-step--active': etapaActiva === 4
            }" type="button" @click="abrirSolicitudes" @mouseenter="activarEtapa(4)" @mouseleave="desactivarEtapa">
              <svg class="solcambio-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>

              <span class="solcambio-step__text">
                ¿Se aprueba<br />
                el cambio?
              </span>
            </button>

            <span class="solcambio-connector">
              <span class="solcambio-connector__line"></span>
              <span class="solcambio-connector__dot"></span>
            </span>

            <span class="solcambio-flow__role">
              Aprobador
            </span>
          </div>

          <span class="solcambio-flow__arrow">→</span>

          <div class="solcambio-branch">
            <div class="solcambio-branch__row">
              <span class="solcambio-branch__arrow">→</span>

              <div class="solcambio-branch__col">
                <div class=" solcambio-finish solcambio-finish--aprobado">
                  <strong>
                    <span class="solcambio-finish__tag">✓</span>
                    Registro actualizado
                  </strong>

                  <span>
                    Sí: el documento y el registro quedan actualizados
                  </span>
                </div>

                <span class="solcambio-flow__role">
                  Automático
                </span>
              </div>
            </div>

            <div class="solcambio-branch__row">
              <span class="solcambio-branch__arrow">→</span>

              <div class="solcambio-branch__col">
                <div class="solcambio-finish solcambio-finish--rechazado">
                  <strong>
                    <span class="solcambio-finish__tag">✕</span>
                    Solicitud rechazada
                  </strong>

                  <span>
                    No: la solicitud se cierra y regresa al solicitante
                  </span>
                </div>

                <span class="solcambio-flow__role">
                  Solicitante
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <h2 class="solcambio-flow__title">
          Selecciona una solicitud para ver su detalle
        </h2>

        <div class="solcambio-filtros" aria-label="Filtros de solicitudes">
          <label>
            Buscar solicitudes
            <input v-model="busquedaSolicitudes" type="search"
              placeholder="Folio, documento, código, proceso o persona" />
          </label>
          <label>
            Desde
            <input v-model="fechaDesdeSolicitudes" type="date" :max="fechaHastaSolicitudes || undefined" />
          </label>
          <label>
            Hasta
            <input v-model="fechaHastaSolicitudes" type="date" :min="fechaDesdeSolicitudes || undefined" />
          </label>
          <button class="solcambio-btn" type="button" @click="limpiarFiltrosSolicitudes">Limpiar filtros</button>
        </div>
        <p v-if="!cargando && !error && solicitudes.length" class="solcambio-filtros__conteo">
          {{ solicitudesFiltradas.length }} de {{ solicitudes.length }} solicitudes
        </p>

        <p v-if="mensaje" class="estado-mensaje estado-exito">
          {{ mensaje }}
        </p>

        <p v-if="cargando" class="solcambio-empty">
          Cargando solicitudes...
        </p>

        <p v-else-if="error" class="estado-mensaje estado-error">
          {{ error }}
        </p>

        <div v-else-if="solicitudes.length === 0" class="solcambio-empty">
          No tienes solicitudes asignadas.
        </div>

        <div v-else-if="solicitudesFiltradas.length === 0" class="solcambio-empty">
          Ninguna solicitud coincide con los filtros.
        </div>

        <div v-else class="solcambio-lista">
          <article v-for="solicitud in solicitudesFiltradas" :key="solicitud.id"
            class="solcambio-item solcambio-item--interactiva" role="button" tabindex="0" @click="
              abrirDetalleDesdeTarjeta(
                $event,
                solicitud
              )
              " @keydown.enter="
                abrirDetalleDesdeTarjeta(
                  $event,
                  solicitud
                )
                " @keydown.space.prevent="
                  abrirDetalleDesdeTarjeta(
                    $event,
                    solicitud
                  )
                  ">
            <div class="solcambio-item__main">
              <strong>
                SOL-{{ solicitud.id }} ·
                {{ solicitud.documento }}
              </strong>

              <span class="solcambio-item__sub">
                {{ solicitud.tipo_solicitud }} ·
                {{ solicitud.solicitante }}
              </span>

              <span v-if="solicitud.codigo" class="solcambio-item__codigo">
                Código: <strong>{{ solicitud.codigo }}</strong>
              </span>

              <span v-if="solicitud.proceso" class="solcambio-item__sub">
                Proceso: {{ solicitud.proceso }}
              </span>

              <span class="solcambio-item__asignacion">
                {{ textoAsignacion(solicitud) }}
              </span>

              <span v-if="solicitud.descripcion" class="solcambio-item__descripcion">
                {{ solicitud.descripcion }}
              </span>

              <div v-if="solicitud.archivos?.length" class="solcambio-item__archivos">
                <button v-for="archivo in solicitud.archivos" :key="archivo.id" class="btn btn-ghost btn-sm"
                  type="button" :disabled="Boolean(accionArchivo)"
                  @click="descargarArchivoSolicitud(solicitud, archivo)">
                  <AppIcon name="file" :size="14" />
                  {{
                    accionArchivo === `solicitud-${archivo.id}`
                      ? 'Descargando...'
                      : archivo.nombre_archivo
                  }}
                </button>
              </div>
            </div>

            <div class="solcambio-item__meta">
              <span class="solcambio-badge" :class="claseEstado(solicitud.estado)">
                {{ etiquetaEstado(solicitud.estado) }}
              </span>

              <span class="solcambio-item__fecha">
                {{ formatearFecha(solicitud.creado_en) }}
              </span>

              <button class="btn btn-ghost btn-sm" type="button" :disabled="Boolean(accionArchivo)"
                @click="verPdf(solicitud)">
                <AppIcon name="search" :size="14" />

                {{
                  accionArchivo ===
                    `${solicitud.es_registro
                      ? 'registro'
                      : 'pdf'}-${solicitud.id}`
                    ? solicitud.es_registro
                      ? 'Descargando...'
                      : 'Abriendo...'
                    : solicitud.es_registro
                      ? 'Descargar evidencia'
                      : solicitud.version
                        ? `Ver PDF v${solicitud.version}`
                        : 'Ver PDF'
                }}
              </button>

              <button v-if="solicitud.puede_corregir && puede('reenviar')" class="btn btn-primary btn-sm" type="button"
                :disabled="Boolean(accionArchivo)" @click="abrirCorreccion(solicitud)">
                Corregir solicitud
              </button>

              <button v-if="solicitud.puede_cancelar && puede('cancelar')" class="btn btn-danger btn-sm" type="button"
                :disabled="Boolean(cancelandoId)" @click="cancelarSolicitud(solicitud)">
                {{ cancelandoId === solicitud.id ? 'Cancelando...' : 'Cancelar solicitud' }}
              </button>

              <button v-if="solicitud.puede_atender" class="btn btn-primary btn-sm" type="button"
                :disabled="Boolean(accionArchivo)" @click="abrirDecision(solicitud)">
                Atender
              </button>

              <span v-if="solicitud.puede_atender" class="solcambio-item__arrow">
                ›
              </span>
            </div>
          </article>
        </div>
      </template>
    </div>

    <div v-if="mostrarModalNueva" class="solcambio-modal-overlay" @click.self="cerrarNuevaSolicitud">
      <div class="solcambio-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-nueva-solicitud">
        <div class="solcambio-modal__header">
          <h2 id="titulo-nueva-solicitud" class="solcambio-modal__title">
            Nueva solicitud de cambio
          </h2>

          <button class="solcambio-modal__close" type="button" aria-label="Cerrar" :disabled="procesandoNueva"
            @click="cerrarNuevaSolicitud">
            ×
          </button>
        </div>

        <form @submit.prevent="guardarNuevaSolicitud">
          <div class="solcambio-modal__body">
            <p v-if="cargandoCatalogos" class="solcambio-empty">
              Cargando datos del formulario...
            </p>

            <template v-else>
              <div class="solcambio-form">
                <div class="solcambio-form-field">
                  <label for="tipo-nueva-solicitud">
                    Tipo de solicitud
                  </label>

                  <select id="tipo-nueva-solicitud" v-model="formNueva.tipoClave" class="solcambio-select" required
                    :disabled="procesandoNueva">
                    <option value="alta">
                      Alta de nuevo documento
                    </option>

                    <option value="cambio" :disabled="!puede('solicitarCambio')">
                      Modificación de documento existente
                    </option>

                    <option value="baja" :disabled="!puede('solicitarBaja')">
                      Baja de documento
                    </option>
                  </select>
                </div>

                <div class="solcambio-form-field">
                  <label for="documento-nueva-solicitud">
                    Nombre del documento
                  </label>

                  <input v-if="formNueva.tipoClave === 'alta'" id="documento-nueva-solicitud"
                    v-model="formNueva.nombreDocumento" class="solcambio-input" type="text" maxlength="200" required
                    :disabled="procesandoNueva" placeholder="Ej. Procedimiento de control de calidad" />

                  <select v-else id="documento-nueva-solicitud" v-model="formNueva.documentoId" class="solcambio-select"
                    required :disabled="procesandoNueva">
                    <option value="" disabled>
                      Selecciona un documento vigente
                    </option>

                    <option v-for="documento in documentosDisponibles" :key="documento.id" :value="documento.id">
                      {{ documento.codigo }} · {{ documento.nombre }}
                    </option>
                  </select>

                  <span v-if="
                    formNueva.tipoClave !== 'alta' &&
                    documentosDisponibles.length === 0
                  " class="solcambio-form-hint">
                    No hay documentos vigentes disponibles.
                  </span>
                </div>

                <div class="solcambio-row">
                  <div class="solcambio-form-field">
                    <label for="proceso-nueva-solicitud">
                      Área / proceso
                    </label>

                    <select v-if="formNueva.tipoClave === 'alta'" id="proceso-nueva-solicitud"
                      v-model="formNueva.procesoId" class="solcambio-select" required :disabled="procesandoNueva">
                      <option value="" disabled>
                        Selecciona un proceso
                      </option>

                      <option v-for="proceso in procesosDisponibles" :key="proceso.id" :value="proceso.id">
                        {{ proceso.nombre }}
                      </option>
                    </select>

                    <input v-else id="proceso-nueva-solicitud" class="solcambio-input" type="text" readonly :value="documentoSeleccionado?.proceso ||
                      'Selecciona un documento'
                      " />
                  </div>

                  <div class="solcambio-form-field">
                    <label for="solicitante-nueva-solicitud">
                      Solicitante
                    </label>

                    <input id="solicitante-nueva-solicitud" class="solcambio-input" type="text" readonly
                      :value="formNueva.solicitante" placeholder="Nombre de quien solicita" />
                  </div>
                </div>

                <div class="solcambio-form-field">
                  <label for="descripcion-nueva-solicitud">
                    Descripción de la solicitud
                  </label>

                  <textarea id="descripcion-nueva-solicitud" v-model="formNueva.descripcion" class="solcambio-textarea"
                    maxlength="2000" required :disabled="procesandoNueva"
                    placeholder="Describe el cambio, motivo o alcance de la baja"></textarea>
                </div>

                <div v-if="formNueva.tipoClave !== 'alta'" class="solcambio-form-field">
                  <label for="archivos-nueva-solicitud">
                    {{
                      formNueva.tipoClave === 'cambio'
                        ? 'Archivo propuesto para la nueva versión'
                        : 'Evidencia de la solicitud de baja'
                    }}
                  </label>

                  <input id="archivos-nueva-solicitud" class="solcambio-file-input" type="file" multiple
                    :disabled="procesandoNueva" @change="seleccionarArchivos" />

                  <span v-if="formNueva.archivos.length" class="solcambio-form-hint">
                    {{
                      formNueva.archivos
                        .map(archivo => archivo.name)
                        .join(', ')
                    }}
                  </span>

                  <span class="solcambio-form-hint">
                    {{
                      formNueva.tipoClave === 'cambio'
                        ? 'El primer archivo será la nueva versión del documento; los demás quedarán como evidencia.'
                        : 'Puedes adjuntar evidencia que justifique la baja.'
                    }}
                  </span>
                </div>

                <span v-else class="solcambio-form-hint">
                  El archivo principal se seleccionará en Control de Documentos.
                </span>

                <span v-if="errorNueva" class="solcambio-form-error">
                  {{ errorNueva }}
                </span>
              </div>
            </template>
          </div>

          <div class="solcambio-modal__footer">
            <button class="solcambio-btn-cancelar" type="button" :disabled="procesandoNueva"
              @click="cerrarNuevaSolicitud">
              Cancelar
            </button>

            <button class="solcambio-btn-cerrar" type="submit" :disabled="cargandoCatalogos ||
              procesandoNueva ||
              (
                formNueva.tipoClave !== 'alta' &&
                documentosDisponibles.length === 0
              )
              ">
              {{
                procesandoNueva
                  ? 'Creando...'
                  : 'Crear solicitud'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="modalCorreccionAbierto" class="overlay" @click.self="cerrarCorreccion">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>Corregir solicitud</h2>

            <p>
              SOL-{{ solicitudCorreccion?.id }} ·
              {{ solicitudCorreccion?.documento }}
            </p>
          </div>

          <button class="modal-close" type="button" :disabled="procesandoCorreccion" @click="cerrarCorreccion">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="guardarCorreccion">
          <label class="campo">
            <span>Descripción de la solicitud *</span>

            <textarea v-model="formCorreccion.descripcion" rows="4" maxlength="2000" required
              placeholder="Describe la solicitud corregida..."></textarea>
          </label>

          <label class="campo">
            <span>Correcciones realizadas *</span>

            <textarea v-model="formCorreccion.comentario" rows="3" maxlength="2000" required
              placeholder="Explica qué cambios realizaste..."></textarea>
          </label>

          <label class="campo">
            <span>Reemplazar archivos propuesto</span>

            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
              @change="seleccionarArchivosCorreccion" />

            <small>
              Si seleccionas archivos nuevos, reemplazarán
              la propuesta anterior. En solicitudes de cambio,
              el primer archivo aprobado se convertirá en la
              nueva versión oficial del documento.
            </small>
          </label>

          <div v-if="formCorreccion.archivos.length" class="solcambio-item__archivos">
            <span v-for="archivo in formCorreccion.archivos" :key="`${archivo.name}-${archivo.size}`"
              class="archivo-seleccionado">
              {{ archivo.name }}
            </span>
          </div>

          <p v-if="errorCorreccion" class="form-error">
            {{ errorCorreccion }}
          </p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="procesandoCorreccion" @click="cerrarCorreccion">
              {{ modalSoloLectura ? 'Cerrar' : 'Cancelar' }}
            </button>

            <button class="btn btn-primary" type="submit" :disabled="procesandoCorreccion">
              {{
                procesandoCorreccion
                  ? 'Reenviando...'
                  : 'Guardar y reenviar'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="decisionAbierta" class="overlay" @click.self="cerrarDecision">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>
              {{
                modalSoloLectura
                  ? 'Detalle de solicitud'
                  : 'Atender solicitud'
              }}
            </h2>
            <p>
              SOL-{{ solicitudSeleccionada?.id }} ·
              {{ solicitudSeleccionada?.documento }}
            </p>
          </div>

          <button class="modal-close" type="button" :disabled="procesandoDecision" @click="cerrarDecision">
            ×
          </button>
        </div>

        <div class="modal-body">
          <p v-if="solicitudSeleccionada" class="solcambio-item__asignacion">
            {{ textoAsignacion(solicitudSeleccionada) }}
          </p>
          <div v-if="solicitudSeleccionada" class="solicitud-resumen">
            <div v-if="solicitudSeleccionada.codigo" class="solicitud-resumen__codigo">
              <span>Código</span>
              <strong>{{ solicitudSeleccionada.codigo }}</strong>
            </div>

            <div>
              <span>Tipo de solicitud</span>
              <strong>
                {{ solicitudSeleccionada.tipo_solicitud }}
              </strong>
            </div>

            <div v-if="solicitudSeleccionada.proceso">
              <span>Proceso</span>
              <strong>
                {{ solicitudSeleccionada.proceso }}
              </strong>
            </div>

            <div v-if="solicitudSeleccionada.es_registro" class="solicitud-resumen__codigo">
              <span>Formato de registro</span>
              <strong>{{ solicitudSeleccionada.registro_formato_codigo }}</strong>
            </div>

            <div v-if="solicitudSeleccionada.es_registro">
              <span>Versión utilizada</span>
              <strong>v{{ solicitudSeleccionada.registro_formato_version }}</strong>
            </div>

            <div v-if="solicitudSeleccionada.es_registro">
              <span>Nombre del formato</span>
              <strong>{{ solicitudSeleccionada.registro_formato_nombre }}</strong>
            </div>

            <div v-if="solicitudSeleccionada.es_registro">
              <span>Responsable del registro</span>
              <strong>{{ solicitudSeleccionada.registro_responsable }}</strong>
            </div>

            <div v-if="solicitudSeleccionada.es_registro">
              <span>Fecha del registro</span>
              <strong>{{ formatearFecha(solicitudSeleccionada.fecha_registro) }}</strong>
            </div>

            <div v-if="
              solicitudSeleccionada.es_registro &&
              solicitudSeleccionada.registro_descripcion
            " class="solicitud-resumen__descripcion">
              <span>Descripción del registro</span>
              <p>{{ solicitudSeleccionada.registro_descripcion }}</p>
            </div>

            <div v-if="solicitudSeleccionada.tipo_documento">
              <span>Tipo de documento</span>
              <strong>
                {{ solicitudSeleccionada.tipo_documento }}
              </strong>
            </div>

            <div v-if="solicitudSeleccionada.version">
              <span>Versión en revisión</span>
              <strong>v{{ solicitudSeleccionada.version }}</strong>
            </div>

            <div v-if="solicitudSeleccionada.origen">
              <span>Origen</span>
              <strong>{{ solicitudSeleccionada.origen }}</strong>
            </div>

            <div v-if="solicitudSeleccionada.elaborador">
              <span>Elaborador</span>
              <strong>{{ solicitudSeleccionada.elaborador }}</strong>
            </div>

            <div v-if="solicitudSeleccionada.descripcion" class="solicitud-resumen__descripcion">
              <span>Descripción</span>
              <p>{{ solicitudSeleccionada.descripcion }}</p>
            </div>

            <div v-if="solicitudSeleccionada.justificacion" class="solicitud-resumen__descripcion">
              <span>Justificación de creación</span>
              <p>{{ solicitudSeleccionada.justificacion }}</p>
            </div>

            <div v-if="solicitudSeleccionada.revision_programada">
              <span>Revisión programada</span>
              <strong>
                Cada {{ solicitudSeleccionada.revision_cada_meses }} meses
              </strong>
            </div>

            <div v-if="solicitudSeleccionada.revision_programada">
              <span>Próxima revisión</span>
              <strong>
                {{ formatearFecha(solicitudSeleccionada.proxima_revision) }}
              </strong>
            </div>
          </div>

          <section v-if="
            solicitudSeleccionada?.es_registro &&
            solicitudSeleccionada.registro_donde_conserva
          " class="solicitud-registro">
            <h3>Conservación del formato de registro</h3>

            <div class="solicitud-registro__datos">
              <div>
                <span>Dónde se conserva</span>
                <strong>
                  {{ solicitudSeleccionada.registro_donde_conserva }}
                </strong>
              </div>

              <div>
                <span>Quién lo conserva</span>
                <strong>
                  {{ solicitudSeleccionada.registro_quien_conserva }}
                </strong>
              </div>

              <div>
                <span>Frecuencia de uso</span>
                <strong>
                  {{ solicitudSeleccionada.registro_frecuencia_uso }}
                </strong>
              </div>

              <div>
                <span>Tiempo de retención</span>
                <strong>
                  {{ solicitudSeleccionada.registro_tiempo_retencion }}
                </strong>
              </div>

              <div>
                <span>Almacenamiento y protección</span>
                <strong>
                  {{ solicitudSeleccionada.registro_almacenamiento_proteccion }}
                </strong>
              </div>

              <div>
                <span>Disposición final</span>
                <strong>
                  {{ solicitudSeleccionada.registro_disposicion_final }}
                </strong>
              </div>
            </div>
          </section>

          <section v-if="solicitudSeleccionada?.donde_conserva" class="solicitud-registro">
            <h3>Conservación del registro</h3>

            <div class="solicitud-registro__datos">
              <div>
                <span>Dónde se conserva</span>
                <strong>{{ solicitudSeleccionada.donde_conserva }}</strong>
              </div>

              <div>
                <span>Quién lo conserva</span>
                <strong>{{ solicitudSeleccionada.quien_conserva }}</strong>
              </div>

              <div>
                <span>Frecuencia de uso</span>
                <strong>{{ solicitudSeleccionada.frecuencia_uso }}</strong>
              </div>

              <div>
                <span>Tiempo de retención</span>
                <strong>{{ solicitudSeleccionada.tiempo_retencion }}</strong>
              </div>

              <div class="solicitud-registro__ancho">
                <span>Almacenamiento y protección</span>
                <p>{{ solicitudSeleccionada.almacenamiento_proteccion }}</p>
              </div>

              <div class="solicitud-registro__ancho">
                <span>Disposición final</span>
                <p>{{ solicitudSeleccionada.disposicion_final }}</p>
              </div>
            </div>
          </section>

          <div v-if="solicitudSeleccionada?.version_documento_id" class="solicitud-documento-acciones">
            <div>
              <strong>Archivo de la versión en revisión</strong>
              <small v-if="solicitudSeleccionada.documento_nombre_original">
                {{ solicitudSeleccionada.documento_nombre_original }}
              </small>
            </div>

            <div class="solicitud-documento-acciones__botones">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="Boolean(accionArchivo)"
                @click="verPdf(solicitudSeleccionada)">
                <AppIcon name="search" :size="14" />
                {{
                  accionArchivo === `pdf-${solicitudSeleccionada.id}`
                    ? 'Abriendo...'
                    : `Ver PDF v${solicitudSeleccionada.version}`
                }}
              </button>

              <button v-if="solicitudSeleccionada.permite_descarga_original" class="btn btn-ghost btn-sm" type="button"
                :disabled="Boolean(accionArchivo)" @click="descargarOriginalDocumento(solicitudSeleccionada)">
                <AppIcon name="doc" :size="14" />
                {{
                  accionArchivo === `original-${solicitudSeleccionada.id}`
                    ? 'Descargando...'
                    : 'Descargar original'
                }}
              </button>
            </div>
          </div>

          <div v-if="solicitudSeleccionada?.es_registro" class="solicitud-documento-acciones">
            <div>
              <strong>Archivo o evidencia del registro</strong>

              <small v-if="solicitudSeleccionada.nombre_archivo">
                {{ solicitudSeleccionada.nombre_archivo }}
              </small>
            </div>

            <div class="solicitud-documento-acciones__botones">
              <button type="button" class="btn btn--secondary" :disabled="accionArchivo === `registro-${solicitudSeleccionada.registro_id}`
                " @click="verPdf(solicitudSeleccionada)">
                <AppIcon name="doc" :size="16" />

                {{
                  accionArchivo === `registro-${solicitudSeleccionada.registro_id}`
                    ? 'Descargando...'
                    : 'Descargar evidencia'
                }}
              </button>
            </div>
          </div>

          <div v-if="solicitudSeleccionada?.archivos?.length" class="solicitud-archivos">
            <strong class="solicitud-archivos__titulo">
              {{
                etiquetaArchivosSolicitud(
                  solicitudSeleccionada
                )
              }}
            </strong>

            <small v-if="
              solicitudSeleccionada.tipo_clave === 'cambio'
            " class="solicitud-archivos__ayuda">
              Al aprobarse, el primer archivo se convertirá
              en la nueva versión oficial del documento.
            </small>

            <div class="solcambio-item__archivos">
              <button v-for="archivo in solicitudSeleccionada.archivos" :key="archivo.id" class="btn btn-ghost btn-sm"
                type="button" :disabled="Boolean(accionArchivo)" @click="
                  descargarArchivoSolicitud(
                    solicitudSeleccionada,
                    archivo
                  )
                  ">
                <AppIcon name="file" :size="14" />

                {{
                  accionArchivo === `solicitud-${archivo.id}`
                    ? 'Descargando...'
                    : archivo.nombre_archivo
                }}
              </button>
            </div>
          </div>
          <section class="solicitud-historial">
            <h3>Historial de la solicitud</h3>

            <p v-if="cargandoHistorial" class="solicitud-historial__mensaje">
              Cargando historial...
            </p>

            <p v-else-if="errorHistorial" class="form-error">
              {{ errorHistorial }}
            </p>

            <p v-else-if="historialSolicitud.length === 0" class="solicitud-historial__mensaje">
              Esta solicitud todavía no tiene movimientos.
            </p>

            <ol v-else class="solicitud-historial__lista">
              <li v-for="movimiento in historialSolicitud" :key="movimiento.id" class="solicitud-historial__movimiento">
                <div class="solicitud-historial__encabezado">
                  <strong>{{ movimiento.actor }}</strong>

                  <span class="solcambio-badge" :class="claseEstado(movimiento.estado)">
                    {{ etiquetaEstado(movimiento.estado) }}
                  </span>
                </div>

                <time :datetime="movimiento.creado_en">
                  {{ formatearFechaHora(movimiento.creado_en) }}
                </time>

                <p v-if="movimiento.comentario">
                  {{ movimiento.comentario }}
                </p>
              </li>
            </ol>
          </section>
          <label v-if="!modalSoloLectura" class="campo">
            <span>Observaciones</span>

            <textarea v-model.trim="comentarioDecision" rows="4" maxlength="2000"
              placeholder="Escribe observaciones sobre el documento..."></textarea>

            <small>
              El comentario es opcional al aprobar.
            </small>
          </label>

          <p v-if="error" class="form-error">
            {{ error }}
          </p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="procesandoDecision" @click="cerrarDecision">
              Cancelar
            </button>

            <button v-if="!modalSoloLectura" class="btn btn-ghost" type="button" :disabled="procesandoDecision"
              @click="devolverSeleccionada">
              {{
                procesandoDecision
                  ? 'Procesando...'
                  : 'Solicitar correcciones'
              }}
            </button>

            <button v-if="!modalSoloLectura" class="btn btn-danger" type="button" :disabled="procesandoDecision"
              @click="rechazarSeleccionada">
              {{
                procesandoDecision
                  ? 'Procesando...'
                  : 'Rechazar'
              }}
            </button>

            <button v-if="
              !modalSoloLectura &&
              (
                solicitudSeleccionada?.estado === 'en_responsable' ||
                solicitudSeleccionada?.estado === 'en_revisor'
              )
            " class="btn btn-primary" type="button" :disabled="procesandoDecision" @click="avanzarSeleccionada">
              {{
                procesandoDecision
                  ? 'Procesando...'
                  : 'Aprobar etapa'
              }}
            </button>

            <button v-if="
              !modalSoloLectura &&
              solicitudSeleccionada?.estado === 'en_aprobador'
            " class="btn btn-primary" type="button" :disabled="procesandoDecision" @click="aprobarSeleccionada">
              {{
                procesandoDecision
                  ? 'Aprobando...'
                  : solicitudSeleccionada?.es_registro
                    ? 'Aprobar registro'
                    : solicitudSeleccionada?.tipo_clave === 'baja'
                      ? 'Aprobar baja'
                      : solicitudSeleccionada?.tipo_clave === 'cambio'
                        ? 'Aprobar nueva versión'
                        : 'Aprobar y publicar'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
@import '@/assets/styles/SolicitudCambios.css';
</style>

<style scoped src="../assets/styles/SolicitudesView.css"></style>
