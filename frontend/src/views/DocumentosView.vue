<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth.js';
import AppIcon from '@/components/AppIcon.vue';
import BaseCard from '@/components/BaseCard.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import SolicitudesCopiasModal from '@/components/SolicitudesCopiasModal.vue';
import { confirmarAccion } from '@/utils/dialogos';
import { tienePermiso } from '@/config/permisos';
import { estadoSolicitud } from '@/api/mock.js';
import { mostrarFecha, mostrarFechaHora } from '@/utils/fechas';

const auth = useAuthStore();
const puede = (accion) => tienePermiso(auth.usuario, `documentos.${accion}`);
const route = useRoute();
const router = useRouter();
const documentos = ref([]);
const documentosVisibles = computed(() => {
  const id = Number(route.query.id);
  return Number.isSafeInteger(id) && id > 0
    ? documentos.value.filter(documento => documento.id === id)
    : documentos.value;
});
const busquedaDocumentos = ref('');
const filtroTipo = ref('');
const filtroEstado = ref('');
const filasPorPagina = ref(10);
const paginaDocumentos = ref(1);

const nombresEstadoDocumento = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  vigente: 'Vigente',
  rechazado: 'Rechazado',
  obsoleto: 'Obsoleto',
};

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const tiposEnLista = computed(() =>
  [...new Set(documentos.value.map(d => d.tipo).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es')),
);

const estadosEnLista = computed(() =>
  [...new Set(documentos.value.map(d => d.estado).filter(Boolean))],
);

const documentosFiltrados = computed(() => {
  const texto = normalizar(busquedaDocumentos.value.trim());
  return documentosVisibles.value.filter((d) => {
    const coincideTexto = !texto || normalizar(`${d.codigo} ${d.nombre} ${d.tipo}`).includes(texto);
    const coincideTipo = !filtroTipo.value || d.tipo === filtroTipo.value;
    const coincideEstado = !filtroEstado.value || d.estado === filtroEstado.value;
    return coincideTexto && coincideTipo && coincideEstado;
  });
});

const totalPaginasDocumentos = computed(() =>
  Math.max(1, Math.ceil(documentosFiltrados.value.length / filasPorPagina.value)),
);

const documentosPagina = computed(() =>
  documentosFiltrados.value.slice(
    (paginaDocumentos.value - 1) * filasPorPagina.value,
    paginaDocumentos.value * filasPorPagina.value,
  ),
);

watch([busquedaDocumentos, filtroTipo, filtroEstado, filasPorPagina], () => {
  paginaDocumentos.value = 1;
});

watch(totalPaginasDocumentos, (total) => {
  if (paginaDocumentos.value > total) paginaDocumentos.value = total;
});

function limpiarFiltrosDocumentos() {
  busquedaDocumentos.value = '';
  filtroTipo.value = '';
  filtroEstado.value = '';
}
const tiposDocumento = ref([]);
const tiposAdministrables = ref([]);
const catalogoTiposAbierto = ref(false);
const cargandoTipos = ref(false);
const guardandoTipo = ref(false);
const errorTipos = ref('');
const mensajeTipos = ref('');
const tipoEditandoId = ref(null);
const formularioTipo = ref({ nombre: '', activo: true });
const procesos = ref([]);
const procesosActivos = computed(() => procesos.value.filter((proceso) => proceso.estatus === 'activo'));
const normas = ref([]);
const usuarios = ref([]);
const reportesAbiertos = ref(false);
const reporteDocumental = ref([]);
const cargandoReporteDocumental = ref(false);
const errorReporteDocumental = ref('');
const filtroReporteTexto = ref('');
const filtroReporteEstado = ref('');
const detalleReporteId = ref(null);

const participantes = ref([]);

const puedeIniciarFlujo = computed(() => puede('crear'));
const puedeGestionarCopiasControladas = computed(() => puede('copiasControladas'));
const puedeGestionarTipos = computed(() => puede('tiposDocumento'));
const puedeResolverCopias = computed(
  () => tienePermiso(auth.usuario, 'visorDocumental.resolverCopias'),
);
const puedeConsultarHistorialVersiones = computed(
  () => auth.usuario?.rol_clave === 'admin_general',
);

async function cargarTiposAdministrables() {
  cargandoTipos.value = true;
  errorTipos.value = '';
  try {
    tiposAdministrables.value = await api.get('/documentos/tipos/todos');
  } catch (err) {
    errorTipos.value = err.message || 'No se pudieron cargar los tipos de documento.';
  } finally {
    cargandoTipos.value = false;
  }
}

async function abrirCatalogoTipos() {
  catalogoTiposAbierto.value = true;
  mensajeTipos.value = '';
  tipoEditandoId.value = null;
  formularioTipo.value = { nombre: '', activo: true };
  await cargarTiposAdministrables();
}

function cerrarCatalogoTipos() {
  if (guardandoTipo.value) return;
  catalogoTiposAbierto.value = false;
  errorTipos.value = '';
}

function editarTipoDocumento(tipo) {
  tipoEditandoId.value = tipo.id;
  formularioTipo.value = { nombre: tipo.nombre, activo: tipo.activo };
  errorTipos.value = '';
  mensajeTipos.value = '';
}

function nuevoTipoDocumento() {
  tipoEditandoId.value = null;
  formularioTipo.value = { nombre: '', activo: true };
  errorTipos.value = '';
}

async function guardarTipoDocumento() {
  if (guardandoTipo.value) return;
  guardandoTipo.value = true;
  errorTipos.value = '';
  try {
    if (tipoEditandoId.value) {
      await api.put(`/documentos/tipos/${tipoEditandoId.value}`, formularioTipo.value);
    } else {
      await api.post('/documentos/tipos', formularioTipo.value);
    }
    await Promise.all([cargarTiposAdministrables(), cargarCatalogos()]);
    nuevoTipoDocumento();
    mensajeTipos.value = 'El tipo de documento se guardó correctamente.';
  } catch (err) {
    errorTipos.value = err.message || 'No se pudo guardar el tipo de documento.';
  } finally {
    guardandoTipo.value = false;
  }
}

async function desactivarTipoDocumento(tipo) {
  if (!await confirmarAccion({ titulo: 'Desactivar tipo de documento', mensaje: `¿Desactivar el tipo "${tipo.nombre}"? Los documentos existentes conservarán su clasificación.`, confirmarTexto: 'Desactivar', peligro: true })) return;
  errorTipos.value = '';
  try {
    await api.del(`/documentos/tipos/${tipo.id}`);
    await Promise.all([cargarTiposAdministrables(), cargarCatalogos()]);
    mensajeTipos.value = 'El tipo de documento se desactivó correctamente.';
  } catch (err) {
    errorTipos.value = err.message || 'No se pudo desactivar el tipo de documento.';
  }
}

const documentosConRevision = computed(() =>
  documentos.value
    .filter(
      (documento) => documento.revision_programada,
    )
    .sort((primero, segundo) =>
      String(primero.proxima_revision || '').localeCompare(
        String(segundo.proxima_revision || ''),
      ),
    ),
);

const revisionesProgramadas = computed(() =>
  documentosConRevision.value.filter(
    (documento) => documento.estado === 'vigente',
  ),
);

const responsables = computed(() =>
  participantes.value.filter(
    (usuario) => usuario.rol_clave === 'responsable',
  ),
);

const revisores = computed(() =>
  participantes.value.filter(
    (usuario) => usuario.rol_clave === 'revisor',
  ),
);

const aprobadores = computed(() =>
  participantes.value.filter(
    (usuario) => usuario.rol_clave === 'aprobador',
  ),
);

const elaboradores = computed(() =>
  usuarios.value.filter(
    (usuario) => usuario.activo,
  ),
);

const reporteDocumentalFiltrado = computed(() => {
  const texto = filtroReporteTexto.value
    .trim()
    .toLocaleLowerCase('es');

  return reporteDocumental.value.filter((documento) => {
    const coincideTexto = !texto || [
      documento.codigo,
      documento.nombre,
      documento.tipo,
      documento.proceso,
    ].some((valor) =>
      String(valor || '')
        .toLocaleLowerCase('es')
        .includes(texto),
    );
    const coincideEstado =
      !filtroReporteEstado.value ||
      documento.estado === filtroReporteEstado.value ||
      documento.solicitud_estado === filtroReporteEstado.value;

    return coincideTexto && coincideEstado;
  });
});

const tipoDocumentoSeleccionado = computed(() =>
  tiposDocumento.value.find(
    (tipo) =>
      Number(tipo.id) ===
      Number(formulario.value.tipo_documento_id),
  ),
);

const esRegistro = computed(() =>
  formulario.value.origen === 'interno' &&
  String(
    tipoDocumentoSeleccionado.value?.nombre || '',
  ).trim().toLocaleLowerCase('es') === 'registro',
);

const formularioAbierto = ref(false);
const cargandoCatalogos = ref(false);
const guardando = ref(false);
const mensaje = ref('');
const error = ref('');
const archivoInput = ref(null);
const accionArchivo = ref('');
const revisionesAbiertas = ref(false);
const confirmacionRevisionAbierta = ref(false);
const documentoRevisionPeriodica = ref(null);
const comentarioRevisionPeriodica = ref('');
const guardandoRevisionPeriodica = ref(false);
const historialRevisionAbierto = ref(false);
const documentoHistorialRevision = ref(null);
const historialRevisiones = ref([]);
const cargandoHistorialRevisiones = ref(false);
const historialVersionesAbierto = ref(false);
const documentoHistorialVersiones = ref(null);
const historialVersiones = ref([]);
const cargandoHistorialVersiones = ref(false);
const errorHistorialVersiones = ref('');
const descripcionAltaPendiente = ref('');
const revisionAbierta = ref(false);
const documentoRevision = ref(null);
const enviandoRevision = ref(false);
const correccionAbierta = ref(false);
const documentoCorreccion = ref(null);
const guardandoCorreccion = ref(false);
const archivoCorreccion = ref(null);
const archivoCorreccionInput = ref(null);
const copiasControladasAbiertas = ref(false);
const solicitudesCopiasAbiertas = ref(false);
const documentoCopiasControladas = ref(null);
const copiasControladas = ref([]);
const cargandoCopiasControladas = ref(false);
const errorCopiaControlada = ref('');
const accionCopiaControlada = ref('');
const retiroCopiaAbierto = ref(false);
const entregaCopiaAbierta = ref(false);
const copiaPendienteEntrega = ref(null);
const guardandoEntregaCopia = ref(false);
const formularioEntregaCopia = ref({ recibida_por_nombre: '', observaciones: '', confirmada: false });
const copiaPendienteRetiro = ref(null);
const guardandoRetiroCopia = ref(false);

const formularioRetiroCopia = ref({
  accion: 'retirada',
  comentario: '',
});

const formularioRevision = ref({
  responsable_id: '',
  revisor_id: '',
  aprobador_id: '',
  comentario: '',
});

const formulario = ref({
  nombre: '',
  tipo_documento_id: '',
  proceso_id: '',
  elaborador_id: '',
  responsable_id: '',
  revisor_id: '',
  aprobador_id: '',
  origen: 'interno',
  version: '1.0',
  justificacion: '',
  revision_programada: false,
  revision_cada_meses: '',
  proxima_revision: '',
  norma_ids: [],
  documentos_relacionados_ids: [],
  registro_donde_conserva: '',
  registro_quien_conserva: '',
  registro_frecuencia_uso: '',
  registro_almacenamiento_proteccion: '',
  registro_tiempo_retencion: '',
  registro_disposicion_final: '',
  archivo: null,
});

function abrirCorreccion(documento) {
  error.value = '';
  archivoCorreccion.value = null;
  documentoCorreccion.value = documento;
  correccionAbierta.value = true;

  if (archivoCorreccionInput.value) {
    archivoCorreccionInput.value.value = '';
  }
}

function cerrarCorreccion() {
  if (guardandoCorreccion.value) {
    return;
  }

  correccionAbierta.value = false;
  documentoCorreccion.value = null;
  archivoCorreccion.value = null;
  error.value = '';

  if (archivoCorreccionInput.value) {
    archivoCorreccionInput.value.value = '';
  }
}

function seleccionarArchivoCorreccion(event) {
  archivoCorreccion.value =
    event.target.files?.[0] || null;
}

async function guardarCorreccion() {
  error.value = '';
  mensaje.value = '';

  if (
    !documentoCorreccion.value ||
    guardandoCorreccion.value
  ) {
    return;
  }

  if (!archivoCorreccion.value) {
    error.value = 'Debes seleccionar el archivo corregido.';
    return;
  }

  const datos = new FormData();
  datos.append('archivo', archivoCorreccion.value);

  guardandoCorreccion.value = true;
  let guardada = false;

  try {
    const documento = documentoCorreccion.value;

    const respuesta = await api.postForm(
      `/documentos/${documento.id}` +
      `/versiones/${documento.version_id}` +
      '/correccion',
      datos,
    );

    documento.nombre_original =
      respuesta.version.nombre_original;
    documento.estado_conversion =
      respuesta.version.estado_conversion;
    documento.estado = 'en_revision';
    documento.solicitud_estado = null;

    mensaje.value = respuesta.mensaje;
    guardada = true;
  } catch (err) {
    error.value =
      err.message || 'No se pudo guardar la corrección.';
  } finally {
    guardandoCorreccion.value = false;
  }

  if (guardada) {
    cerrarCorreccion();
  }
}

function abrirRevision(documento) {
  error.value = '';

  formularioRevision.value = {
    responsable_id: '',
    revisor_id: '',
    aprobador_id: '',
    comentario: '',
  };

  documentoRevision.value = documento;
  revisionAbierta.value = true;
}

function cerrarRevision() {
  if (enviandoRevision.value) {
    return;
  }

  revisionAbierta.value = false;
  documentoRevision.value = null;
  error.value = '';
}

function limpiarFormulario() {
  formulario.value = {
    nombre: '',
    tipo_documento_id: '',
    proceso_id: '',
    elaborador_id: auth.usuario?.id || '',
    responsable_id: '',
    revisor_id: '',
    aprobador_id: '',
    origen: 'interno',
    version: '1.0',
    justificacion: '',
    revision_programada: false,
    revision_cada_meses: '',
    proxima_revision: '',
    norma_ids: [],
    documentos_relacionados_ids: [],
    registro_donde_conserva: '',
    registro_quien_conserva: '',
    registro_frecuencia_uso: '',
    registro_almacenamiento_proteccion: '',
    registro_tiempo_retencion: '',
    registro_disposicion_final: '',
    archivo: null,
  };

  if (archivoInput.value) {
    archivoInput.value.value = '';
  }
}

function abrirFormulario() {
  if (!puedeIniciarFlujo.value) {
    error.value = 'No tienes permiso para dar de alta documentos.';
    return;
  }

  error.value = '';
  descripcionAltaPendiente.value = '';
  limpiarFormulario();
  formularioAbierto.value = true;
}

function abrirAltaDesdeSolicitud() {
  if (
    route.query.nuevo !== '1' ||
    !puedeIniciarFlujo.value
  ) {
    return;
  }

  abrirFormulario();

  formulario.value.nombre =
    String(route.query.nombre || '').trim();

  descripcionAltaPendiente.value =
    String(route.query.descripcion || '').trim();

  formulario.value.justificacion =
    descripcionAltaPendiente.value;

  const procesoId =
    Number(route.query.procesoId);

  const procesoCoincidente =
    procesos.value.find(
      proceso =>
        Number(proceso.id) === procesoId &&
        proceso.estatus === 'activo',
    );

  formulario.value.proceso_id =
    procesoCoincidente?.id || '';

  router.replace({
    name: 'documentos',
  });
}

function cerrarFormulario() {
  if (guardando.value) {
    return;
  }

  formularioAbierto.value = false;
  error.value = '';
  descripcionAltaPendiente.value = '';
  limpiarFormulario();
}

function seleccionarArchivo(event) {
  formulario.value.archivo =
    event.target.files?.[0] || null;
}

async function verPdf(documento) {
  error.value = '';

  const ventana = window.open('', '_blank');

  if (!ventana) {
    error.value =
      'El navegador bloqueó la nueva pestaña. Permite ventanas emergentes.';
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

async function guardarDocumento() {
  error.value = '';
  mensaje.value = '';

  if (!formulario.value.archivo) {
    error.value = 'Debes seleccionar un archivo.';
    return;
  }

  if (
    !formulario.value.responsable_id ||
    !formulario.value.revisor_id ||
    !formulario.value.aprobador_id
  ) {
    error.value =
      'Selecciona responsable, revisor y aprobador.';
    return;
  }

  const datos = new FormData();

  datos.append('nombre', formulario.value.nombre);
  datos.append(
    'tipo_documento_id',
    formulario.value.tipo_documento_id,
  );
  datos.append(
    'proceso_id',
    formulario.value.proceso_id,
  );
  datos.append(
    'elaborador_id',
    formulario.value.elaborador_id,
  );
  datos.append('origen', formulario.value.origen);
  datos.append('version', formulario.value.version);
  datos.append(
    'justificacion',
    formulario.value.justificacion,
  );
  datos.append(
    'revision_programada',
    String(formulario.value.revision_programada),
  );
  datos.append(
    'norma_ids',
    JSON.stringify(formulario.value.norma_ids),
  );
  datos.append(
    'documentos_relacionados_ids',
    JSON.stringify(
      formulario.value.documentos_relacionados_ids,
    ),
  );

  if (formulario.value.revision_programada) {
    datos.append(
      'revision_cada_meses',
      formulario.value.revision_cada_meses,
    );
    datos.append(
      'proxima_revision',
      formulario.value.proxima_revision,
    );
  }

  if (esRegistro.value) {
    datos.append(
      'registro_donde_conserva',
      formulario.value.registro_donde_conserva,
    );
    datos.append(
      'registro_quien_conserva',
      formulario.value.registro_quien_conserva,
    );
    datos.append(
      'registro_frecuencia_uso',
      formulario.value.registro_frecuencia_uso,
    );
    datos.append(
      'registro_almacenamiento_proteccion',
      formulario.value
        .registro_almacenamiento_proteccion,
    );
    datos.append(
      'registro_tiempo_retencion',
      formulario.value.registro_tiempo_retencion,
    );
    datos.append(
      'registro_disposicion_final',
      formulario.value.registro_disposicion_final,
    );
  }

  datos.append('archivo', formulario.value.archivo);

  guardando.value = true;

  try {
    const respuesta = await api.postForm(
      '/documentos',
      datos,
    );

    const documento = respuesta.documento;

    const documentoCreado = {
      id: documento.id,
      codigo: documento.codigo,
      nombre: documento.nombre,
      tipo: documento.tipo,
      version_id: documento.version_actual.id,
      nombre_original:
        documento.version_actual.nombre_original,
      estado_conversion:
        documento.version_actual.estado_conversion,
      version: documento.version_actual.version,
      origen: documento.origen,
      estado: documento.estado,
      proceso:
        procesos.value.find(
          (proceso) =>
            Number(proceso.id) ===
            Number(formulario.value.proceso_id),
        )?.nombre || '',
      revision_programada:
        formulario.value.revision_programada,
      revision_cada_meses:
        formulario.value.revision_programada
          ? Number(formulario.value.revision_cada_meses)
          : null,
      proxima_revision:
        formulario.value.revision_programada
          ? formulario.value.proxima_revision
          : null,
      solicitud_estado: null,
    };

    let errorRevision = '';

    if (
      ['completada', 'no_requerida'].includes(
        documento.version_actual.estado_conversion,
      )
    ) {
      try {
        const respuestaRevision = await api.post(
          `/documentos/${documento.id}` +
          `/versiones/${documento.version_actual.id}` +
          '/enviar-revision',
          {
            responsable_id:
              formulario.value.responsable_id,
            revisor_id:
              formulario.value.revisor_id,
            aprobador_id:
              formulario.value.aprobador_id,
            comentario:
              formulario.value.justificacion,
          },
        );

        documentoCreado.estado = 'en_revision';
        documentoCreado.solicitud_estado =
          respuestaRevision.solicitud?.estado || null;
      } catch (err) {
        errorRevision =
          err.message ||
          'No fue posible enviar el documento a revisión.';
      }
    }

    documentos.value.unshift(documentoCreado);

    formularioAbierto.value = false;
    descripcionAltaPendiente.value = '';
    limpiarFormulario();

    if (errorRevision) {
      mensaje.value =
        'El documento fue guardado como borrador.';
      error.value =
        `${errorRevision} Puedes enviarlo desde la tabla.`;
    } else {
      mensaje.value =
        `${respuesta.mensaje} Código asignado: ${documento.codigo}.` +
        (
          documentoCreado.estado === 'en_revision'
            ? ' También fue enviado al flujo de revisión.'
            : ''
        );
    }
  } catch (err) {
    error.value =
      err.message || 'No se pudo guardar el documento.';
  } finally {
    guardando.value = false;
  }
}

async function enviarRevision() {
  if (
    !documentoRevision.value ||
    enviandoRevision.value
  ) {
    return;
  }

  enviandoRevision.value = true;
  error.value = '';

  try {
    const respuesta = await api.post(
      `/documentos/${documentoRevision.value.id}` +
      `/versiones/${documentoRevision.value.version_id}` +
      '/enviar-revision',
      {
        responsable_id:
          formularioRevision.value.responsable_id || null,
        revisor_id:
          formularioRevision.value.revisor_id || null,
        aprobador_id:
          formularioRevision.value.aprobador_id,
        comentario:
          formularioRevision.value.comentario || null,
      },
    );

    revisionAbierta.value = false;
    documentoRevision.value = null;

    await cargarCatalogos();

    mensaje.value =
      respuesta.mensaje ||
      'El documento fue enviado a revisión.';
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo enviar el documento a revisión.';
  } finally {
    enviandoRevision.value = false;
  }
}

async function cargarCatalogos() {
  cargandoCatalogos.value = true;
  error.value = '';

  try {
    const participantesPromesa = puedeIniciarFlujo.value
      ? api.get('/documentos/participantes')
      : Promise.resolve([]);

    const [
      tiposRespuesta,
      procesosRespuesta,
      documentosRespuesta,
      participantesRespuesta,
      normasRespuesta,
      usuariosRespuesta,
    ] = await Promise.all([
      api.get('/documentos/tipos'),
      api.get('/procesos'),
      api.get('/documentos'),
      participantesPromesa,
      api.get('/documentos/normas'),
      api.get('/usuarios'),
    ]);

    tiposDocumento.value = tiposRespuesta;
    procesos.value = procesosRespuesta;
    documentos.value = documentosRespuesta;
    participantes.value = participantesRespuesta;
    normas.value = normasRespuesta;
    usuarios.value = usuariosRespuesta;
  } catch (err) {
    error.value =
      err.message || 'No se pudieron cargar los catálogos.';
  } finally {
    cargandoCatalogos.value = false;
  }
}

function abrirRevisionesProgramadas() {
  revisionesAbiertas.value = true;
}

function cerrarRevisionesProgramadas() {
  revisionesAbiertas.value = false;
}

function convertirFechaRevision(fecha) {
  if (!fecha) {
    return null;
  }

  const [anio, mes, dia] = String(fecha)
    .slice(0, 10)
    .split('-')
    .map(Number);

  return new Date(anio, mes - 1, dia);
}

function formatearFechaRevision(fecha) {
  return mostrarFecha(convertirFechaRevision(fecha), 'Sin fecha');
}

function diasParaRevision(documento) {
  const fechaRevision = convertirFechaRevision(
    documento.proxima_revision,
  );

  if (!fechaRevision) {
    return null;
  }

  const hoy = new Date();

  hoy.setHours(0, 0, 0, 0);
  fechaRevision.setHours(0, 0, 0, 0);

  return Math.round(
    (fechaRevision.getTime() - hoy.getTime()) /
    86400000,
  );
}

function estadoRevisionProgramada(documento) {
  if (documento.estado !== 'vigente') {
    return {
      clave: 'pendiente',
      texto: 'Pendiente de aprobación',
    };
  }

  const dias = diasParaRevision(documento);

  if (dias === null) {
    return {
      clave: 'sin-fecha',
      texto: 'Sin fecha',
    };
  }

  if (dias < 0) {
    return {
      clave: 'vencida',
      texto: 'Vencida',
    };
  }

  if (dias <= 30) {
    return {
      clave: 'proxima',
      texto: 'Próxima',
    };
  }

  return {
    clave: 'programada',
    texto: 'Programada',
  };
}

function revisionPuedeAtenderse(documento) {
  const estado = estadoRevisionProgramada(documento);

  return ['proxima', 'vencida'].includes(
    estado.clave,
  );
}

function formatearFechaHoraRevision(fecha) {
  return mostrarFechaHora(fecha, 'Sin fecha');
}

async function abrirHistorialRevision(documento) {
  documentoHistorialRevision.value = documento;
  historialRevisiones.value = [];
  historialRevisionAbierto.value = true;
  cargandoHistorialRevisiones.value = true;
  error.value = '';

  try {
    historialRevisiones.value = await api.get(
      `/documentos/${documento.id}` +
      '/revisiones-programadas',
    );
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo cargar el historial de revisiones.';
  } finally {
    cargandoHistorialRevisiones.value = false;
  }
}

function cerrarHistorialRevision() {
  historialRevisionAbierto.value = false;
  documentoHistorialRevision.value = null;
  historialRevisiones.value = [];
}

async function abrirHistorialVersiones(documento) {
  documentoHistorialVersiones.value = documento;
  historialVersiones.value = [];
  errorHistorialVersiones.value = '';
  historialVersionesAbierto.value = true;
  cargandoHistorialVersiones.value = true;

  try {
    historialVersiones.value = await api.get(
      `/documentos/${documento.id}/historial-versiones`,
    );
  } catch (err) {
    errorHistorialVersiones.value =
      err.message || 'No se pudo cargar el historial de versiones.';
  } finally {
    cargandoHistorialVersiones.value = false;
  }
}

function cerrarHistorialVersiones() {
  historialVersionesAbierto.value = false;
  documentoHistorialVersiones.value = null;
  historialVersiones.value = [];
  errorHistorialVersiones.value = '';
}

async function verPdfVersionHistorial(version) {
  const ventana = window.open('', '_blank');

  if (!ventana) {
    errorHistorialVersiones.value =
      'El navegador bloqueó la nueva pestaña. Permite ventanas emergentes.';
    return;
  }

  ventana.document.title = `Cargando versión ${version.version}...`;
  ventana.document.body.textContent = 'Cargando PDF...';
  accionArchivo.value = `historial-${version.id}`;
  errorHistorialVersiones.value = '';

  try {
    const blob = await api.getBlob(
      `/documentos/${documentoHistorialVersiones.value.id}` +
      `/historial-versiones/${version.id}/pdf`,
    );
    const url = URL.createObjectURL(blob);
    ventana.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (err) {
    ventana.close();
    errorHistorialVersiones.value =
      err.message || 'No se pudo abrir el PDF de esta versión.';
  } finally {
    accionArchivo.value = '';
  }
}

function estadoHistorialVersion(version) {
  if (version.estado_solicitud) {
    return estadoSolicitud[version.estado_solicitud]?.texto
      || version.estado_solicitud.replaceAll('_', ' ');
  }

  const estadosPdf = {
    completada: 'PDF disponible',
    no_requerida: 'PDF disponible',
    pendiente: 'PDF pendiente',
    procesando: 'Generando PDF',
    error: 'Error al generar PDF',
  };

  return estadosPdf[version.estado_conversion] || 'Sin estado';
}

function claseEstadoHistorialVersion(version) {
  const estadoSolicitud = String(version.estado_solicitud || '').toLowerCase();

  if (estadoSolicitud.includes('aprob')) {
    return 'revision-estado--programada';
  }

  if (estadoSolicitud.includes('rechaz')) {
    return 'revision-estado--vencida';
  }

  if (estadoSolicitud.startsWith('en_')) {
    return 'revision-estado--proceso';
  }

  if (estadoSolicitud.includes('pendiente')) {
    return 'revision-estado--pendiente';
  }

  const estadoPdf = version.estado_conversion;

  if (['completada', 'no_requerida'].includes(estadoPdf)) {
    return 'revision-estado--programada';
  }

  if (estadoPdf === 'procesando') {
    return 'revision-estado--proceso';
  }

  if (estadoPdf === 'pendiente') {
    return 'revision-estado--pendiente';
  }

  if (estadoPdf === 'error') {
    return 'revision-estado--vencida';
  }

  return 'revision-estado--sin-fecha';
}

function abrirConfirmacionRevision(documento) {
  documentoRevisionPeriodica.value = documento;
  comentarioRevisionPeriodica.value = '';
  confirmacionRevisionAbierta.value = true;
  error.value = '';
}

function cerrarConfirmacionRevision() {
  if (guardandoRevisionPeriodica.value) {
    return;
  }

  confirmacionRevisionAbierta.value = false;
  documentoRevisionPeriodica.value = null;
  comentarioRevisionPeriodica.value = '';
}

async function confirmarRevisionSinCambios() {
  if (
    !documentoRevisionPeriodica.value ||
    guardandoRevisionPeriodica.value
  ) {
    return;
  }

  guardandoRevisionPeriodica.value = true;
  error.value = '';
  mensaje.value = '';

  try {
    const documento =
      documentoRevisionPeriodica.value;

    const respuesta = await api.post(
      `/documentos/${documento.id}` +
      '/revisiones-programadas/confirmar',
      {
        comentario:
          comentarioRevisionPeriodica.value.trim(),
      },
    );

    documento.proxima_revision =
      respuesta.revision.proxima_revision_nueva;

    cerrarConfirmacionRevision();
    revisionesAbiertas.value = true;

    mensaje.value =
      respuesta.mensaje ||
      'La revisión fue registrada correctamente.';
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo registrar la revisión.';
  } finally {
    guardandoRevisionPeriodica.value = false;
  }
}

async function solicitarCambioDesdeRevision(documento) {
  revisionesAbiertas.value = false;

  await router.push({
    name: 'solicitudes',
    query: {
      revision: '1',
      documentoId: String(documento.id),
    },
  });
}

async function abrirReporteDocumental() {
  reportesAbiertos.value = true;
  cargandoReporteDocumental.value = true;
  errorReporteDocumental.value = '';
  detalleReporteId.value = null;

  try {
    reporteDocumental.value = await api.get(
      '/documentos/reporte',
    );
  } catch (err) {
    errorReporteDocumental.value =
      err.message || 'No se pudo cargar el reporte documental.';
  } finally {
    cargandoReporteDocumental.value = false;
  }
}

function cerrarReporteDocumental() {
  reportesAbiertos.value = false;
  detalleReporteId.value = null;
  errorReporteDocumental.value = '';
}

function alternarDetalleReporte(documentoId) {
  detalleReporteId.value =
    detalleReporteId.value === documentoId
      ? null
      : documentoId;
}

function textoEstadoSolicitudReporte(estado) {
  const estados = {
    pendiente: 'Pendiente',
    en_responsable: 'Con responsable',
    en_revisor: 'Con revisor',
    en_aprobador: 'Con aprobador',
    correcciones: 'Requiere correcciones',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
  };

  return estados[estado] || 'Sin solicitud';
}

function claseEstadoSolicitudReporte(estado) {
  if (estado === 'aprobada') {
    return 'reporte-solicitud--aprobada';
  }

  if (estado === 'rechazada') {
    return 'reporte-solicitud--atencion';
  }

  if (['pendiente', 'correcciones'].includes(estado)) {
    return 'reporte-solicitud--pendiente';
  }

  if (!estado || estado === 'cancelada') {
    return 'reporte-solicitud--neutral';
  }

  return 'reporte-solicitud--proceso';
}

function formatearFechaHoraReporte(fecha) {
  return mostrarFechaHora(fecha, 'Sin fecha');
}

function abrirCopiasDesdeReporte(documento) {
  cerrarReporteDocumental();
  abrirCopiasControladas(documento);
}

function prepararCeldaReporteCsv(valor) {
  let texto = String(valor ?? '');

  if (/^\s*[=+@-]/.test(texto)) {
    texto = `'${texto}`;
  }

  return `"${texto.replaceAll('"', '""')}"`;
}

function descargarReporteCsv() {
  if (
    cargandoReporteDocumental.value ||
    errorReporteDocumental.value ||
    reporteDocumentalFiltrado.value.length === 0
  ) {
    return;
  }

  const encabezados = [
    'Código', 'Documento', 'Tipo', 'Proceso', 'Versión',
    'Estado documental', 'Última solicitud', 'Estado de solicitud',
    'Última actualización', 'Comentario realizado por',
    'Último comentario', 'Copias activas', 'Copias por retirar',
  ];
  const filas = reporteDocumentalFiltrado.value.map((documento) => [
    documento.codigo,
    documento.nombre,
    documento.tipo,
    documento.proceso,
    documento.version ? `v${documento.version}` : '',
    documento.estado,
    documento.solicitud_tipo,
    textoEstadoSolicitudReporte(documento.solicitud_estado),
    documento.solicitud_actualizada_en
      ? formatearFechaHoraReporte(documento.solicitud_actualizada_en)
      : '',
    documento.comentario_actor,
    documento.ultimo_comentario,
    documento.copias_activas,
    documento.copias_requieren_retiro,
  ]);
  const contenido = [encabezados, ...filas]
    .map((fila) => fila.map(prepararCeldaReporteCsv).join(','))
    .join('\r\n');
  const archivo = new Blob(['\uFEFF', contenido], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  const fecha = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  enlace.href = url;
  enlace.download = `reporte-documental-${fecha}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function cargarCopiasControladas() {
  if (!documentoCopiasControladas.value) {
    return;
  }

  cargandoCopiasControladas.value = true;
  errorCopiaControlada.value = '';

  try {
    copiasControladas.value = await api.get(
      `/documentos/${documentoCopiasControladas.value.id}` +
      '/copias-controladas',
    );
  } catch (err) {
    errorCopiaControlada.value =
      err.message ||
      'No se pudo cargar el historial de copias controladas.';
  } finally {
    cargandoCopiasControladas.value = false;
  }
}

async function abrirCopiasControladas(documento) {
  documentoCopiasControladas.value = documento;
  copiasControladas.value = [];
  errorCopiaControlada.value = '';
  copiasControladasAbiertas.value = true;

  await cargarCopiasControladas();
}

function cerrarCopiasControladas() {
  copiasControladasAbiertas.value = false;
  documentoCopiasControladas.value = null;
  copiasControladas.value = [];
}

function textoEstadoCopiaControlada(estado) {
  const estados = {
    pendiente_entrega: 'Pendiente de entrega',
    activa: 'Activa',
    requiere_retiro: 'Requiere retiro',
    retirada: 'Retirada',
    cancelada: 'Cancelada',
  };

  return estados[estado] || estado;
}

async function verPdfCopiaControlada(copia) {
  const ventana = window.open('', '_blank');

  if (!ventana) {
    errorCopiaControlada.value =
      'El navegador bloqueó la nueva pestaña. Permite ventanas emergentes.';
    return;
  }

  ventana.document.title = 'Cargando copia controlada...';
  ventana.document.body.textContent =
    'Cargando copia controlada...';
  accionCopiaControlada.value = `ver-${copia.id}`;
  errorCopiaControlada.value = '';

  try {
    const blob = await api.getBlob(
      `/documentos/${documentoCopiasControladas.value.id}` +
      `/copias-controladas/${copia.id}/pdf`,
    );
    const url = URL.createObjectURL(blob);

    ventana.location.href = url;

    setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (err) {
    ventana.close();
    errorCopiaControlada.value =
      err.message ||
      'No se pudo abrir la copia controlada.';
  } finally {
    accionCopiaControlada.value = '';
  }
}

async function guardarPdfCopiaControlada(copia) {
  accionCopiaControlada.value = `guardar-${copia.id}`;
  errorCopiaControlada.value = '';

  try {
    const blob = await api.getBlob(
      `/documentos/${documentoCopiasControladas.value.id}` +
      `/copias-controladas/${copia.id}/pdf`,
    );
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = `${copia.folio}.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    errorCopiaControlada.value =
      err.message ||
      'No se pudo guardar la copia controlada.';
  } finally {
    accionCopiaControlada.value = '';
  }
}

async function generarPdfCopiaControlada(copia) {
  accionCopiaControlada.value = `generar-${copia.id}`;
  errorCopiaControlada.value = '';

  try {
    const respuesta = await api.post(
      `/documentos/${documentoCopiasControladas.value.id}` +
      `/copias-controladas/${copia.id}/generar-pdf`,
      {},
    );

    await cargarCopiasControladas();
    mensaje.value = respuesta.mensaje;
  } catch (err) {
    errorCopiaControlada.value =
      err.message ||
      'No se pudo generar el PDF de la copia controlada.';
  } finally {
    accionCopiaControlada.value = '';
  }
}

function abrirRetiroCopiaControlada(copia) {
  copiaPendienteRetiro.value = copia;
  formularioRetiroCopia.value = {
    accion: 'retirada',
    comentario: '',
  };
  retiroCopiaAbierto.value = true;
  errorCopiaControlada.value = '';
}

function cerrarRetiroCopiaControlada() {
  if (guardandoRetiroCopia.value) {
    return;
  }

  retiroCopiaAbierto.value = false;
  copiaPendienteRetiro.value = null;
  formularioRetiroCopia.value = {
    accion: 'retirada',
    comentario: '',
  };
}

async function confirmarRetiroCopiaControlada() {
  if (
    !documentoCopiasControladas.value ||
    !copiaPendienteRetiro.value ||
    guardandoRetiroCopia.value
  ) {
    return;
  }

  guardandoRetiroCopia.value = true;
  errorCopiaControlada.value = '';
  mensaje.value = '';

  try {
    const respuesta = await api.patch(
      `/documentos/${documentoCopiasControladas.value.id}` +
      `/copias-controladas/${copiaPendienteRetiro.value.id}` +
      '/retirar',
      {
        accion: formularioRetiroCopia.value.accion,
        comentario:
          formularioRetiroCopia.value.comentario.trim(),
      },
    );

    guardandoRetiroCopia.value = false;
    cerrarRetiroCopiaControlada();
    await cargarCopiasControladas();
    mensaje.value = respuesta.mensaje;
  } catch (err) {
    errorCopiaControlada.value =
      err.message ||
      'No se pudo registrar el retiro de la copia.';
  } finally {
    guardandoRetiroCopia.value = false;
  }
}

function abrirEntregaCopiaControlada(copia) {
  copiaPendienteEntrega.value = copia;
  formularioEntregaCopia.value = {
    recibida_por_nombre: copia.destinatario_nombre,
    observaciones: '',
    confirmada: false,
  };
  errorCopiaControlada.value = '';
  entregaCopiaAbierta.value = true;
}

function cerrarEntregaCopiaControlada() {
  if (guardandoEntregaCopia.value) return;
  entregaCopiaAbierta.value = false;
  copiaPendienteEntrega.value = null;
}

async function confirmarEntregaCopiaControlada() {
  if (!documentoCopiasControladas.value || !copiaPendienteEntrega.value || guardandoEntregaCopia.value) return;
  guardandoEntregaCopia.value = true;
  errorCopiaControlada.value = '';
  try {
    const respuesta = await api.patch(
      `/documentos/${documentoCopiasControladas.value.id}` +
      `/copias-controladas/${copiaPendienteEntrega.value.id}/entregar`,
      formularioEntregaCopia.value,
    );
    guardandoEntregaCopia.value = false;
    cerrarEntregaCopiaControlada();
    await Promise.all([cargarCopiasControladas(), cargarCatalogos()]);
    mensaje.value = respuesta.mensaje;
  } catch (err) {
    errorCopiaControlada.value = err.message || 'No se pudo registrar la entrega.';
  } finally {
    guardandoEntregaCopia.value = false;
  }
}

onMounted(async () => {
  await cargarCatalogos();
  abrirAltaDesdeSolicitud();
});
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div>
        <h1>Control de Documentos</h1>
        <p>Documentos controlados del sistema de calidad.</p>
      </div>

      <div class="documentos-acciones-principales">
        <button v-if="puedeResolverCopias" class="btn btn-ghost" type="button"
          @click="solicitudesCopiasAbiertas = true">
          Solicitudes de copias
        </button>
        <button v-if="puedeGestionarTipos" class="btn btn-ghost" type="button" @click="abrirCatalogoTipos">
          <AppIcon name="doc" :size="16" /> Tipos de documento
        </button>
        <button v-if="puede('reportes')" class="btn btn-ghost" type="button" @click="abrirReporteDocumental">
          <AppIcon name="doc" :size="16" />
          Reportes
        </button>

        <button class="btn btn-ghost" type="button" @click="abrirRevisionesProgramadas">
          <AppIcon name="doc" :size="16" />
          Revisiones programadas

          <span class="revisiones-contador">
            {{ revisionesProgramadas.length }}
          </span>
        </button>

        <button class="btn btn-primary" type="button" :disabled="cargandoCatalogos" @click="abrirFormulario">
          <AppIcon name="plus" :size="16" />

          {{
            cargandoCatalogos
              ? 'Cargando...'
              : 'Alta de documento'
          }}
        </button>
      </div>
    </div>

    <p v-if="mensaje" class="estado-mensaje estado-exito">
      {{ mensaje }}
    </p>

    <p v-if="error && !formularioAbierto" class="estado-mensaje estado-error">
      {{ error }}
    </p>

    <p v-if="route.query.id" class="estado-mensaje estado-exito">
      Resultado de la búsqueda.
      <button type="button" class="btn btn-ghost btn-sm" @click="router.replace({ name: 'documentos' })">Ver
        todos</button>
    </p>

    <BaseCard>
      <div class="catalogo-toolbar">
        <label class="catalogo-search">
          <AppIcon name="search" :size="15" />
          <input v-model="busquedaDocumentos" type="search" placeholder="Código, nombre o tipo…"
            aria-label="Buscar documentos" />
        </label>

        <div class="catalogo-toolbar-right">
          <select v-model="filtroTipo" class="catalogo-select" aria-label="Filtrar por tipo">
            <option value="">Todos los tipos</option>
            <option v-for="tipo in tiposEnLista" :key="tipo" :value="tipo">{{ tipo }}</option>
          </select>

          <select v-model="filtroEstado" class="catalogo-select" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option v-for="estado in estadosEnLista" :key="estado" :value="estado">
              {{ nombresEstadoDocumento[estado] || estado }}
            </option>
          </select>

          <label class="catalogo-rows">
            Mostrar
            <select v-model.number="filasPorPagina">
              <option v-for="n in [10, 25, 50]" :key="n" :value="n">{{ n }}</option>
            </select>
            filas
          </label>

          <button v-if="busquedaDocumentos || filtroTipo || filtroEstado" class="btn btn-ghost btn-sm" type="button"
            @click="limpiarFiltrosDocumentos">
            Limpiar
          </button>
        </div>
      </div>

      <div class="tabla-documentos">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Versión</th>
              <th>Origen</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!documentosPagina.length">
              <td colspan="7" class="muted">No hay documentos que coincidan con la búsqueda.</td>
            </tr>
            <tr v-for="d in documentosPagina" :key="d.id">
              <td><code>{{ d.codigo }}</code></td>
              <td><strong>{{ d.nombre }}</strong></td>
              <td class="muted">{{ d.tipo }}</td>
              <td>v{{ d.version }}</td>
              <td class="muted">{{ d.origen }}</td>
              <td>
                <StatusBadge :estado="d.estado" />
              </td>
              <td>
                <div class="acciones-documento">
                  <button class="btn btn-ghost btn-sm" type="button" :disabled="Boolean(accionArchivo) ||
                    !['completada', 'no_requerida'].includes(
                      d.estado_conversion,
                    )
                    " @click="verPdf(d)">
                    <AppIcon name="search" :size="14" />
                    {{
                      accionArchivo === `pdf-${d.id}`
                        ? 'Abriendo...'
                        : 'Ver PDF'
                    }}
                  </button>

                  <button class="btn btn-ghost btn-sm" type="button" :disabled="Boolean(accionArchivo)"
                    @click="descargarOriginal(d)">
                    <AppIcon name="doc" :size="14" />
                    {{
                      accionArchivo === `original-${d.id}`
                        ? 'Descargando...'
                        : 'Original'
                    }}
                  </button>

                  <button v-if="
                    puedeGestionarCopiasControladas &&
                    d.estado === 'vigente'
                  " class="btn btn-ghost btn-sm" type="button" @click="abrirCopiasControladas(d)">
                    <AppIcon name="doc" :size="14" />
                    Copia controlada
                  </button>

                  <button v-if="puedeConsultarHistorialVersiones" class="btn btn-ghost btn-sm" type="button"
                    @click="abrirHistorialVersiones(d)">
                    <AppIcon name="doc" :size="14" />
                    Historial de versiones
                  </button>

                  <button v-if="
                    puedeIniciarFlujo &&
                    d.estado === 'borrador' &&
                    d.solicitud_estado === 'correcciones'
                  " class="btn btn-primary btn-sm" type="button" @click="abrirCorreccion(d)">
                    Subir corrección
                  </button>

                  <button v-if="
                    puedeIniciarFlujo &&
                    d.estado === 'borrador' &&
                    d.solicitud_estado !== 'correcciones'
                  " class="btn btn-primary btn-sm" type="button" :disabled="Boolean(accionArchivo) ||
                    !['completada', 'no_requerida'].includes(
                      d.estado_conversion,
                    )
                    " @click="abrirRevision(d)">
                    Enviar a revisión
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="catalogo-pagination">
        <span class="muted">
          Mostrando {{ documentosPagina.length }} de {{ documentosFiltrados.length }} documentos ·
          Página {{ paginaDocumentos }} de {{ totalPaginasDocumentos }}
        </span>
        <div class="catalogo-pagination__buttons">
          <button class="btn btn-ghost btn-sm" type="button" :disabled="paginaDocumentos <= 1"
            @click="paginaDocumentos--">Anterior</button>
          <button class="btn btn-ghost btn-sm" type="button" :disabled="paginaDocumentos >= totalPaginasDocumentos"
            @click="paginaDocumentos++">Siguiente</button>
        </div>
      </div>
    </BaseCard>

    <div v-if="reportesAbiertos" class="overlay" @click.self="cerrarReporteDocumental">
      <div class="modal modal--reporte-documental">
        <div class="modal-head">
          <div>
            <h2>Reporte documental</h2>
            <p>Estado, flujo y copias controladas de todos los documentos.</p>
          </div>

          <button class="modal-close" type="button" aria-label="Cerrar" @click="cerrarReporteDocumental">
            ×
          </button>
        </div>

        <div class="modal-body">
          <div class="reporte-filtros">
            <label class="campo">
              Buscar
              <input v-model="filtroReporteTexto" type="search" placeholder="Código, documento, tipo o proceso" />
            </label>

            <label class="campo">
              Estado
              <select v-model="filtroReporteEstado">
                <option value="">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="en_revision">En revisión</option>
                <option value="vigente">Vigente</option>
                <option value="obsoleto">Obsoleto</option>
                <option value="correcciones">Requiere correcciones</option>
                <option value="rechazada">Solicitud rechazada</option>
              </select>
            </label>
          </div>

          <p v-if="errorReporteDocumental" class="form-error">
            {{ errorReporteDocumental }}
          </p>

          <p v-if="cargandoReporteDocumental" class="revisiones-vacio">
            Cargando reporte documental...
          </p>

          <p v-else-if="reporteDocumentalFiltrado.length === 0" class="revisiones-vacio">
            No existen documentos que coincidan con los filtros.
          </p>

          <div v-else class="tabla-reporte-documental">
            <table class="table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo / proceso</th>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Última solicitud</th>
                  <th>Copias</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                <template v-for="documento in reporteDocumentalFiltrado" :key="documento.id">
                  <tr>
                    <td>
                      <code>{{ documento.codigo }}</code>
                      <strong class="reporte-documento-nombre">{{ documento.nombre }}</strong>
                    </td>
                    <td>
                      {{ documento.tipo }}
                      <span class="reporte-documento-proceso">{{ documento.proceso || 'Sin proceso' }}</span>
                    </td>
                    <td>v{{ documento.version || '—' }}</td>
                    <td>
                      <StatusBadge :estado="documento.estado" />
                    </td>
                    <td>
                      <span class="reporte-solicitud" :class="claseEstadoSolicitudReporte(documento.solicitud_estado)">
                        {{ textoEstadoSolicitudReporte(documento.solicitud_estado) }}
                      </span>
                    </td>
                    <td>
                      <span v-if="documento.copias_requieren_retiro > 0" class="reporte-copias-retiro">
                        {{ documento.copias_requieren_retiro }} por retirar
                      </span>
                      <span v-else>{{ documento.copias_activas }} activas</span>
                    </td>
                    <td>
                      <div class="acciones-reporte">
                        <button class="btn btn-ghost btn-sm" type="button"
                          @click="alternarDetalleReporte(documento.id)">
                          Detalles
                        </button>
                        <button class="btn btn-ghost btn-sm" type="button" :disabled="!documento.version_id ||
                          !['completada', 'no_requerida'].includes(documento.estado_conversion)
                          " @click="verPdf(documento)">
                          Ver PDF
                        </button>
                        <button v-if="puedeGestionarCopiasControladas && documento.estado === 'vigente'"
                          class="btn btn-ghost btn-sm" type="button" @click="abrirCopiasDesdeReporte(documento)">
                          Copias
                        </button>
                      </div>
                    </td>
                  </tr>

                  <tr v-if="detalleReporteId === documento.id" class="reporte-detalle-fila">
                    <td colspan="7">
                      <div class="reporte-detalle">
                        <div>
                          <span>Tipo de solicitud</span>
                          <strong>{{ documento.solicitud_tipo || 'Sin solicitud' }}</strong>
                        </div>
                        <div>
                          <span>Última actualización</span>
                          <strong>{{ formatearFechaHoraReporte(documento.solicitud_actualizada_en) }}</strong>
                        </div>
                        <div>
                          <span>Comentario realizado por</span>
                          <strong>{{ documento.comentario_actor || 'Sin actor' }}</strong>
                        </div>
                        <p>
                          {{ documento.ultimo_comentario || 'No existen comentarios registrados para este documento.' }}
                        </p>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div class="modal-actions">
            <button class="btn btn-primary" type="button" :disabled="cargandoReporteDocumental || Boolean(errorReporteDocumental) ||
              reporteDocumentalFiltrado.length === 0
              " @click="descargarReporteCsv">
              Descargar reporte CSV
            </button>
            <button class="btn btn-ghost" type="button" @click="cerrarReporteDocumental">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="copiasControladasAbiertas" class="overlay" @click.self="cerrarCopiasControladas">
      <div class="modal modal--copias-controladas">
        <div class="modal-head">
          <div>
            <h2>Copia controlada</h2>
            <p v-if="documentoCopiasControladas">
              {{ documentoCopiasControladas.codigo }} ·
              {{ documentoCopiasControladas.nombre }} ·
              v{{ documentoCopiasControladas.version }}
            </p>
          </div>

          <button class="modal-close" type="button" aria-label="Cerrar" @click="cerrarCopiasControladas">
            ×
          </button>
        </div>

        <div class="modal-body">
          <section class="seccion-formulario">
            <div class="seccion-titulo">
              <h3>Copias autorizadas</h3>
              <p>
                Para solicitar otra copia, abre el documento en el Visor Documental.
                El folio y el PDF se generan al autorizarla.
              </p>
            </div>
            <p v-if="errorCopiaControlada" class="form-error">
              {{ errorCopiaControlada }}
            </p>
          </section>

          <section class="seccion-formulario">
            <div class="seccion-titulo">
              <h3>Historial de copias</h3>
              <p>
                Aquí se conserva la trazabilidad de las copias entregadas.
              </p>
            </div>

            <p v-if="cargandoCopiasControladas" class="revisiones-vacio">
              Cargando copias controladas...
            </p>

            <p v-else-if="copiasControladas.length === 0" class="revisiones-vacio">
              Este documento todavía no tiene copias controladas.
            </p>

            <div v-else class="historial-copias-controladas">
              <article v-for="copia in copiasControladas" :key="copia.id" class="copia-controlada">
                <div class="copia-controlada__encabezado">
                  <div>
                    <strong>{{ copia.folio }}</strong>
                    <span>Versión {{ copia.version }}</span>
                  </div>

                  <span class="copia-controlada__estado" :class="`copia-controlada__estado--${copia.estado}`">
                    {{ textoEstadoCopiaControlada(copia.estado) }}
                  </span>
                </div>

                <dl class="copia-controlada__datos">
                  <div>
                    <dt>Destinada a</dt>
                    <dd>{{ copia.destinatario_nombre }}</dd>
                  </div>
                  <div>
                    <dt>Fecha de vigencia</dt>
                    <dd>{{ formatearFechaRevision(copia.fecha_vigencia) }}</dd>
                  </div>
                  <div>
                    <dt>Registrada por</dt>
                    <dd>{{ copia.creada_por }}</dd>
                  </div>
                  <div v-if="copia.entregada_en">
                    <dt>Entregada el</dt>
                    <dd>{{ formatearFechaHoraReporte(copia.entregada_en) }}</dd>
                  </div>
                  <div v-if="copia.recibida_por_nombre">
                    <dt>Recibida por</dt>
                    <dd>{{ copia.recibida_por_nombre }}</dd>
                  </div>
                </dl>

                <p v-if="copia.entregada_por">Entrega registrada por {{ copia.entregada_por }}.</p>
                <p v-if="copia.observaciones_entrega">{{ copia.observaciones_entrega }}</p>

                <p v-if="copia.comentarios">
                  {{ copia.comentarios }}
                </p>

                <p v-if="copia.motivo_retiro" class="copia-controlada__retiro">
                  <strong>{{ copia.estado === 'cancelada' ? 'Cancelación:' : 'Resultado del retiro:' }}</strong>
                  {{ copia.motivo_retiro }}
                </p>

                <div class="copia-controlada__acciones">
                  <button v-if="copia.archivo_pdf_url" class="btn btn-ghost btn-sm" type="button"
                    :disabled="Boolean(accionCopiaControlada)" @click="verPdfCopiaControlada(copia)">
                    <AppIcon name="search" :size="14" />
                    {{ accionCopiaControlada === `ver-${copia.id}` ? 'Abriendo...' : 'Ver / imprimir' }}
                  </button>

                  <button v-if="copia.archivo_pdf_url" class="btn btn-ghost btn-sm" type="button"
                    :disabled="Boolean(accionCopiaControlada)" @click="guardarPdfCopiaControlada(copia)">
                    <AppIcon name="doc" :size="14" />
                    {{ accionCopiaControlada === `guardar-${copia.id}` ? 'Guardando...' : 'Guardar PDF' }}
                  </button>

                  <button v-if="!copia.archivo_pdf_url" class="btn btn-ghost btn-sm" type="button"
                    :disabled="Boolean(accionCopiaControlada)" @click="generarPdfCopiaControlada(copia)">
                    <AppIcon name="doc" :size="14" />
                    {{ accionCopiaControlada === `generar-${copia.id}` ? 'Generando...' : 'Generar PDF' }}
                  </button>

                  <button v-if="copia.estado === 'pendiente_entrega'" class="btn btn-primary btn-sm" type="button"
                    :disabled="Boolean(accionCopiaControlada)" @click="abrirEntregaCopiaControlada(copia)">
                    Confirmar entrega
                  </button>

                  <button v-if="copia.estado === 'requiere_retiro'" class="btn btn-primary btn-sm" type="button"
                    :disabled="Boolean(accionCopiaControlada)" @click="abrirRetiroCopiaControlada(copia)">
                    Confirmar retiro
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div v-if="entregaCopiaAbierta" class="overlay overlay--secundario" @click.self="cerrarEntregaCopiaControlada">
      <div class="modal modal--retiro-copia">
        <div class="modal-head">
          <div>
            <h2>Confirmar entrega física</h2>
            <p>{{ copiaPendienteEntrega?.folio }}</p>
          </div>
          <button class="modal-close" type="button" aria-label="Cerrar" @click="cerrarEntregaCopiaControlada">×</button>
        </div>
        <form class="modal-body" @submit.prevent="confirmarEntregaCopiaControlada">
          <p>Confirma la entrega de la impresión identificada con este folio. El sistema registrará la fecha y tu
            usuario.
          </p>
          <label class="campo">Nombre de quien recibió la copia *
            <input v-model="formularioEntregaCopia.recibida_por_nombre" maxlength="200" required />
          </label>
          <label class="campo">Observaciones
            <textarea v-model="formularioEntregaCopia.observaciones" rows="3" maxlength="2000"
              placeholder="Lugar de entrega u observaciones"></textarea>
          </label>
          <label class="campo-check entrega-copia-confirmacion">
            <input v-model="formularioEntregaCopia.confirmada" type="checkbox" required />
            <span>Confirmo que la copia física fue entregada.</span>
          </label>
          <p v-if="errorCopiaControlada" class="form-error">{{ errorCopiaControlada }}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="guardandoEntregaCopia"
              @click="cerrarEntregaCopiaControlada">Cancelar</button>
            <button class="btn btn-primary" type="submit" :disabled="guardandoEntregaCopia">{{ guardandoEntregaCopia ?
              'Guardando...' : 'Registrar entrega' }}</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="retiroCopiaAbierto" class="overlay overlay--secundario" @click.self="cerrarRetiroCopiaControlada">
      <div class="modal modal--retiro-copia">
        <div class="modal-head">
          <div>
            <h2>Confirmar retiro de copia</h2>
            <p v-if="copiaPendienteRetiro">
              {{ copiaPendienteRetiro.folio }} · Versión {{ copiaPendienteRetiro.version }}
            </p>
          </div>

          <button class="modal-close" type="button" aria-label="Cerrar" :disabled="guardandoRetiroCopia"
            @click="cerrarRetiroCopiaControlada">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="confirmarRetiroCopiaControlada">
          <div class="retiro-copia-resumen" v-if="copiaPendienteRetiro">
            <span>Copia entregada a</span>
            <strong>{{ copiaPendienteRetiro.destinatario_nombre }}</strong>
          </div>

          <fieldset class="opciones-retiro">
            <legend>¿Qué ocurrió con la copia impresa?</legend>

            <label>
              <input v-model="formularioRetiroCopia.accion" type="radio" value="retirada"
                :disabled="guardandoRetiroCopia" />
              <span>
                <strong>Fue retirada</strong>
                Se recuperó del punto donde se utilizaba.
              </span>
            </label>

            <label>
              <input v-model="formularioRetiroCopia.accion" type="radio" value="conservada_obsoleta"
                :disabled="guardandoRetiroCopia" />
              <span>
                <strong>Se conservó como obsoleta</strong>
                La impresión fue identificada físicamente con el sello OBSOLETO.
              </span>
            </label>
          </fieldset>

          <label class="campo">
            Comentarios
            <textarea v-model="formularioRetiroCopia.comentario" rows="3" maxlength="2000"
              placeholder="Agrega algún detalle sobre el retiro" :disabled="guardandoRetiroCopia"></textarea>
            <small>Opcional. Máximo 2000 caracteres.</small>
          </label>

          <p v-if="errorCopiaControlada" class="form-error">
            {{ errorCopiaControlada }}
          </p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="guardandoRetiroCopia"
              @click="cerrarRetiroCopiaControlada">
              Cancelar
            </button>

            <button class="btn btn-primary" type="submit" :disabled="guardandoRetiroCopia">
              {{ guardandoRetiroCopia ? 'Guardando...' : 'Confirmar retiro' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="revisionesAbiertas" class="overlay" @click.self="cerrarRevisionesProgramadas">
      <div class="modal modal--revisiones">
        <div class="modal-head">
          <div>
            <h2>Revisiones programadas</h2>
            <p>
              Seguimiento periódico de documentos controlados.
            </p>
          </div>

          <button class="modal-close" type="button" aria-label="Cerrar" @click="cerrarRevisionesProgramadas">
            ×
          </button>
        </div>

        <div class="modal-body">
          <p v-if="documentosConRevision.length === 0" class="revisiones-vacio">
            No existen documentos con revisión programada.
          </p>

          <div v-else class="tabla-revisiones">
            <table class="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Documento</th>
                  <th>Estado</th>
                  <th>Revisión cada</th>
                  <th>Próxima revisión</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="documento in documentosConRevision" :key="documento.id">
                  <td>
                    <code>{{ documento.codigo }}</code>
                  </td>

                  <td>
                    <strong>{{ documento.nombre }}</strong>
                    <small class="revision-proceso">
                      {{ documento.proceso }}
                    </small>
                  </td>

                  <td>
                    <span class="revision-estado" :class="`revision-estado--${estadoRevisionProgramada(documento).clave
                      }`
                      ">
                      {{
                        estadoRevisionProgramada(documento).texto
                      }}
                    </span>
                  </td>

                  <td>
                    {{ documento.revision_cada_meses }} meses
                  </td>

                  <td>
                    {{
                      formatearFechaRevision(
                        documento.proxima_revision,
                      )
                    }}
                  </td>

                  <td>
                    <div class="acciones-revision">
                      <button class="btn btn-ghost btn-sm" type="button" :disabled="Boolean(accionArchivo) ||
                        ![
                          'completada',
                          'no_requerida',
                        ].includes(
                          documento.estado_conversion,
                        )
                        " @click="verPdf(documento)">
                        <AppIcon name="search" :size="14" />
                        Ver PDF
                      </button>

                      <button class="btn btn-ghost btn-sm" type="button" @click="abrirHistorialRevision(documento)">
                        <AppIcon name="doc" :size="14" />
                        Historial
                      </button>

                      <button v-if="
                        puede('confirmarRevision') &&
                        revisionPuedeAtenderse(documento)
                      " class="btn btn-primary btn-sm" type="button" @click="
                        abrirConfirmacionRevision(documento)
                        ">
                        Confirmar vigente
                      </button>

                      <button v-if="
                        tienePermiso(auth.usuario, 'solicitudes.solicitarCambio') &&
                        revisionPuedeAtenderse(documento)
                      " class="btn btn-ghost btn-sm" type="button" @click="
                        solicitarCambioDesdeRevision(documento)
                        ">
                        Solicitar cambio
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" @click="cerrarRevisionesProgramadas">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="historialRevisionAbierto" class="overlay" @click.self="cerrarHistorialRevision">
      <div class="modal modal--historial-revision">
        <div class="modal-head">
          <div>
            <h2>Historial de revisiones</h2>
            <p>
              {{ documentoHistorialRevision?.codigo }} ·
              {{ documentoHistorialRevision?.nombre }}
            </p>
          </div>

          <button class="modal-close" type="button" aria-label="Cerrar" @click="cerrarHistorialRevision">
            ×
          </button>
        </div>

        <div class="modal-body">
          <p v-if="cargandoHistorialRevisiones" class="revisiones-vacio">
            Cargando historial...
          </p>

          <p v-else-if="historialRevisiones.length === 0" class="revisiones-vacio">
            Este documento todavía no tiene revisiones
            periódicas completadas.
          </p>

          <div v-else class="historial-revisiones">
            <article v-for="revision in historialRevisiones" :key="revision.id" class="historial-revision">
              <div class="historial-revision__encabezado">
                <div>
                  <strong>
                    Revisión de la versión
                    v{{ revision.version }}
                  </strong>

                  <span>
                    {{
                      formatearFechaHoraRevision(
                        revision.creado_en,
                      )
                    }}
                  </span>
                </div>

                <span class="revision-estado revision-estado--programada">
                  {{
                    revision.resultado === 'sin_cambios'
                      ? 'Continúa vigente'
                      : 'Requiere cambio'
                  }}
                </span>
              </div>

              <dl class="historial-revision__datos">
                <div>
                  <dt>Revisado por</dt>
                  <dd>{{ revision.revisado_por }}</dd>
                </div>

                <div>
                  <dt>Fecha anterior</dt>
                  <dd>
                    {{
                      formatearFechaRevision(
                        revision.proxima_revision_anterior,
                      )
                    }}
                  </dd>
                </div>

                <div>
                  <dt>Nueva revisión</dt>
                  <dd>
                    {{
                      formatearFechaRevision(
                        revision.proxima_revision_nueva,
                      )
                    }}
                  </dd>
                </div>
              </dl>

              <p v-if="revision.comentario">
                {{ revision.comentario }}
              </p>
            </article>
          </div>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" @click="cerrarHistorialRevision">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="historialVersionesAbierto" class="overlay" @click.self="cerrarHistorialVersiones">
      <div class="modal modal--historial-versiones">
        <div class="modal-head">
          <div>
            <h2>Historial de versiones</h2>
            <p>
              {{ documentoHistorialVersiones?.codigo }} ·
              {{ documentoHistorialVersiones?.nombre }}
            </p>
          </div>

          <button class="modal-close" type="button" aria-label="Cerrar" @click="cerrarHistorialVersiones">
            ×
          </button>
        </div>

        <div class="modal-body">
          <p v-if="errorHistorialVersiones" class="form-error estado-error" role="alert">
            {{ errorHistorialVersiones }}
          </p>

          <p v-if="cargandoHistorialVersiones" class="revisiones-vacio">
            Cargando versiones...
          </p>

          <p v-else-if="!errorHistorialVersiones && historialVersiones.length === 0" class="revisiones-vacio">
            No hay versiones anteriores registradas para este documento.
          </p>

          <div v-else-if="historialVersiones.length" class="tabla-historial-versiones">
            <table class="table">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Fecha</th>
                  <th>Registrada por</th>
                  <th>Estado</th>
                  <th>Consulta</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="version in historialVersiones" :key="version.id">
                  <td><strong>v{{ version.version }}</strong></td>
                  <td>{{ mostrarFechaHora(version.creado_en) }}</td>
                  <td>{{ version.subido_por || '—' }}</td>
                  <td>
                    <span class="revision-estado" :class="claseEstadoHistorialVersion(version)">
                      {{ estadoHistorialVersion(version) }}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-ghost btn-sm" type="button"
                      :disabled="!version.pdf_disponible || accionArchivo === `historial-${version.id}`"
                      @click="verPdfVersionHistorial(version)">
                      <AppIcon name="search" :size="14" />
                      {{ accionArchivo === `historial-${version.id}` ? 'Abriendo...' : 'Ver PDF' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" @click="cerrarHistorialVersiones">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="confirmacionRevisionAbierta" class="overlay" @click.self="cerrarConfirmacionRevision">
      <div class="modal modal--confirmacion-revision">
        <div class="modal-head">
          <div>
            <h2>Confirmar revisión</h2>
            <p>
              {{ documentoRevisionPeriodica?.codigo }} ·
              {{ documentoRevisionPeriodica?.nombre }}
            </p>
          </div>

          <button class="modal-close" type="button" aria-label="Cerrar" :disabled="guardandoRevisionPeriodica"
            @click="cerrarConfirmacionRevision">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="confirmarRevisionSinCambios">
          <div class="revision-confirmacion-resumen">
            <span>Resultado de la revisión</span>
            <strong>
              El documento continúa vigente sin cambios.
            </strong>
          </div>

          <label class="campo">
            <span>Comentario de la revisión</span>

            <textarea v-model="comentarioRevisionPeriodica" maxlength="2000" :disabled="guardandoRevisionPeriodica"
              placeholder="Explica brevemente qué se verificó"></textarea>

            <small>
              El comentario quedará guardado en el historial.
            </small>
          </label>

          <p v-if="error" class="form-error estado-error">
            {{ error }}
          </p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="guardandoRevisionPeriodica"
              @click="cerrarConfirmacionRevision">
              Cancelar
            </button>

            <button class="btn btn-primary" type="submit" :disabled="guardandoRevisionPeriodica">
              {{
                guardandoRevisionPeriodica
                  ? 'Guardando...'
                  : 'Confirmar que sigue vigente'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="catalogoTiposAbierto" class="overlay" @click.self="cerrarCatalogoTipos">
      <div class="modal modal--tipos-documento">
        <div class="modal-head">
          <h2>Tipos de documento</h2>
          <button class="modal-close" type="button" @click="cerrarCatalogoTipos">×</button>
        </div>
        <div class="modal-body">
          <p v-if="errorTipos" class="form-error estado-error" role="alert">{{ errorTipos }}</p>
          <p v-if="mensajeTipos" class="estado-mensaje estado-exito" role="status">{{ mensajeTipos }}</p>
          <p v-if="cargandoTipos">Cargando tipos...</p>
          <div v-else class="tabla-tipos-documento">
            <table class="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Documentos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tipo in tiposAdministrables" :key="tipo.id">
                  <td>{{ tipo.nombre }}</td>
                  <td>{{ tipo.documentos_asociados }}</td>
                  <td>{{ tipo.activo ? 'Activo' : 'Inactivo' }}</td>
                  <td>
                    <div class="acciones-documento">
                      <button v-if="tipo.nombre.toLocaleLowerCase('es') !== 'registro'" class="btn btn-ghost btn-sm"
                        type="button" @click="editarTipoDocumento(tipo)">Editar</button>
                      <button v-if="tipo.activo && tipo.nombre.toLocaleLowerCase('es') !== 'registro'"
                        class="btn btn-ghost btn-sm" type="button"
                        @click="desactivarTipoDocumento(tipo)">Desactivar</button>
                      <span v-if="tipo.nombre.toLocaleLowerCase('es') === 'registro'">Protegido</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <form class="seccion-formulario" @submit.prevent="guardarTipoDocumento">
            <div class="seccion-titulo">
              <h3>{{ tipoEditandoId ? 'Editar tipo' : 'Nuevo tipo' }}</h3>
              <p>Los tipos utilizados por documentos no se pueden renombrar.</p>
            </div>
            <label class="campo">
              Nombre *
              <input v-model.trim="formularioTipo.nombre" maxlength="120" required placeholder="Ej. Guía técnica" />
            </label>
            <label v-if="tipoEditandoId" class="campo">
              Estado
              <select v-model="formularioTipo.activo">
                <option :value="true">Activo</option>
                <option :value="false">Inactivo</option>
              </select>
            </label>
            <div class="modal-actions">
              <button v-if="tipoEditandoId" class="btn btn-ghost" type="button" @click="nuevoTipoDocumento">Nuevo
                tipo</button>
              <button class="btn btn-primary" type="submit" :disabled="guardandoTipo">
                {{ guardandoTipo ? 'Guardando...' : 'Guardar tipo' }}
              </button>
            </div>
          </form>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" @click="cerrarCatalogoTipos">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="formularioAbierto" class="overlay" @click.self="cerrarFormulario">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>Alta de documento</h2>
            <p>Registra el original y genera su versión PDF.</p>
          </div>

          <button class="modal-close" type="button" :disabled="guardando" @click="cerrarFormulario">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="guardarDocumento">
          <section class="seccion-formulario">
            <div class="seccion-titulo">
              <h3>Identificación del documento</h3>
              <p>
                Información utilizada para identificar y clasificar
                el documento.
              </p>
            </div>

            <div class="form-grid">
              <div class="campo">
                <span>Código del documento</span>
                <p class="muted">Se asigna automáticamente al guardar. Ejemplo: PRO-SDS-01-GC.</p>
              </div>
              <label class="campo">
                <span>Versión *</span>
                <input v-model.trim="formulario.version" type="text" maxlength="20" required placeholder="Ej. 1.0" />
              </label>
            </div>

            <label class="campo">
              <span>Nombre del documento *</span>
              <input v-model.trim="formulario.nombre" type="text" maxlength="200" required
                placeholder="Ej. Procedimiento de control documental" />
            </label>

            <div class="form-grid">
              <label class="campo">
                <span>Tipo de documento *</span>
                <select v-model="formulario.tipo_documento_id" required>
                  <option value="">
                    Selecciona un tipo
                  </option>

                  <option v-for="tipo in tiposDocumento" :key="tipo.id" :value="tipo.id">
                    {{ tipo.nombre }}
                  </option>
                </select>
              </label>

              <label class="campo">
                <span>Proceso *</span>
                <select v-model="formulario.proceso_id" required>
                  <option value="">
                    Selecciona un proceso
                  </option>

                  <option v-for="proceso in procesosActivos" :key="proceso.id" :value="proceso.id">
                    {{ proceso.nombre }}
                  </option>
                </select>
              </label>
            </div>

            <div class="form-grid">
              <label class="campo">
                <span>Origen *</span>
                <select v-model="formulario.origen" required>
                  <option value="interno">
                    Interno
                  </option>
                  <option value="externo">
                    Externo
                  </option>
                </select>
              </label>

              <label class="campo">
                <span>Elaborador *</span>
                <select v-model="formulario.elaborador_id" required>
                  <option value="">
                    Selecciona al elaborador
                  </option>

                  <option v-for="usuario in elaboradores" :key="usuario.id" :value="usuario.id">
                    {{ usuario.nombre }} · {{ usuario.correo }}
                  </option>
                </select>
              </label>
            </div>
          </section>

          <section class="seccion-formulario">
            <div class="seccion-titulo">
              <h3>Flujo de revisión</h3>
              <p>
                El documento seguirá siempre el orden:
                Responsable → Revisor → Aprobador.
              </p>
            </div>

            <div class="form-grid">
              <label class="campo">
                <span>Responsable *</span>
                <select v-model="formulario.responsable_id" required>
                  <option value="">
                    Selecciona un responsable
                  </option>

                  <option v-for="usuario in responsables" :key="usuario.id" :value="usuario.id">
                    {{ usuario.nombre }} · {{ usuario.correo }}
                  </option>
                </select>
              </label>

              <label class="campo">
                <span>Revisor *</span>
                <select v-model="formulario.revisor_id" required>
                  <option value="">
                    Selecciona un revisor
                  </option>

                  <option v-for="usuario in revisores" :key="usuario.id" :value="usuario.id">
                    {{ usuario.nombre }} · {{ usuario.correo }}
                  </option>
                </select>
              </label>
            </div>

            <label class="campo">
              <span>Aprobador *</span>
              <select v-model="formulario.aprobador_id" required>
                <option value="">
                  Selecciona un aprobador
                </option>

                <option v-for="usuario in aprobadores" :key="usuario.id" :value="usuario.id">
                  {{ usuario.nombre }} · {{ usuario.correo }}
                </option>
              </select>
            </label>
          </section>

          <section class="seccion-formulario">
            <div class="seccion-titulo">
              <h3>Control documental</h3>
              <p>
                Estas reglas se calculan según el tipo y origen.
              </p>
            </div>

            <div class="reglas-documento">
              <div>
                <span>Protección contra impresión</span>
                <strong>
                  {{ esRegistro ? 'No aplica' : 'Activada' }}
                </strong>
              </div>

              <div>
                <span>Descarga del original</span>
                <strong>
                  {{
                    esRegistro || formulario.origen === 'externo'
                      ? 'Disponible'
                      : 'No disponible'
                  }}
                </strong>
              </div>

              <div>
                <span>Estado administrativo</span>
                <strong>Activo</strong>
              </div>
            </div>

            <label class="campo">
              <span>Justificación de creación *</span>
              <textarea v-model.trim="formulario.justificacion" maxlength="2000" rows="3" required
                placeholder="Describe el motivo por el cual se crea este documento"></textarea>
              <small>
                Máximo 2000 caracteres.
              </small>
            </label>

            <label class="campo-check">
              <input v-model="formulario.revision_programada" type="checkbox" />
              <span>
                Este documento requiere revisiones programadas
              </span>
            </label>

            <div v-if="formulario.revision_programada" class="form-grid">
              <label class="campo">
                <span>Revisión cada cuántos meses *</span>
                <input v-model.number="formulario.revision_cada_meses
                  " type="number" min="1" max="120" required placeholder="Ej. 12" />
              </label>

              <label class="campo">
                <span>Próxima revisión *</span>
                <input v-model="formulario.proxima_revision" type="date" required />
              </label>
            </div>
          </section>

          <section class="seccion-formulario">
            <div class="seccion-titulo">
              <h3>Relaciones y normas</h3>
              <p>
                Marca todas las opciones que correspondan al documento.
              </p>
            </div>

            <div class="form-grid">
              <fieldset class="relacion-campo">
                <legend>Normas relacionadas</legend>
                <div v-if="normas.length" class="relacion-opciones">
                  <label v-for="norma in normas" :key="norma.id" class="relacion-opcion">
                    <input v-model="formulario.norma_ids" type="checkbox" :value="norma.id" />
                    <span>{{ norma.codigo }} · {{ norma.nombre }}</span>
                  </label>
                </div>
                <small v-else>
                  Aún no se ha cargado el catálogo oficial de normas.
                </small>
              </fieldset>

              <fieldset class="relacion-campo">
                <legend>Documentos relacionados</legend>
                <div v-if="documentos.length" class="relacion-opciones">
                  <label v-for="documento in documentos" :key="documento.id" class="relacion-opcion">
                    <input v-model="formulario.documentos_relacionados_ids" type="checkbox" :value="documento.id" />
                    <span>{{ documento.codigo }} · {{ documento.nombre }}</span>
                  </label>
                </div>
                <small v-else>No hay documentos disponibles para relacionar.</small>
                <small>
                  Selecciona documentos que tengan una relación
                  directa con el nuevo documento.
                </small>
              </fieldset>
            </div>
          </section>

          <section v-if="esRegistro" class="seccion-formulario seccion-registro">
            <div class="seccion-titulo">
              <h3>Conservación del Registro</h3>
              <p>
                Estos datos aparecerán también en el Almacén de
                Registros.
              </p>
            </div>

            <div class="form-grid">
              <label class="campo">
                <span>Dónde se conserva *</span>
                <input v-model.trim="formulario.registro_donde_conserva
                  " type="text" maxlength="255" required placeholder="Ej. Archivo físico de Secretaría" />
              </label>

              <label class="campo">
                <span>Quién lo conserva *</span>
                <input v-model.trim="formulario.registro_quien_conserva
                  " type="text" maxlength="255" required placeholder="Ej. Responsable del proceso" />
              </label>
            </div>

            <div class="form-grid">
              <label class="campo">
                <span>Frecuencia de uso *</span>
                <input v-model.trim="formulario.registro_frecuencia_uso
                  " type="text" maxlength="160" required placeholder="Ej. Cada semestre" />
              </label>

              <label class="campo">
                <span>Tiempo de retención *</span>
                <input v-model.trim="formulario.registro_tiempo_retencion
                  " type="text" maxlength="160" required placeholder="Ej. Cinco años" />
              </label>
            </div>

            <label class="campo">
              <span>Almacenamiento y protección *</span>
              <textarea v-model.trim="formulario.registro_almacenamiento_proteccion
                " rows="3" required placeholder="Indica el lugar y la forma de proteger el registro"></textarea>
            </label>

            <label class="campo">
              <span>Disposición final *</span>
              <textarea v-model.trim="formulario.registro_disposicion_final
                " rows="3" required placeholder="Indica qué se hace al terminar el tiempo de retención"></textarea>
            </label>
          </section>

          <section class="seccion-formulario">
            <div class="seccion-titulo">
              <h3>Archivo original</h3>
              <p>
                El sistema conservará el original y generará la
                versión PDF.
              </p>
            </div>

            <label class="campo">
              <span>Seleccionar archivo *</span>
              <input ref="archivoInput" type="file" required
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" @change="seleccionarArchivo" />
              <small>
                PDF, Word, Excel, PowerPoint, PNG o JPEG.
                Máximo 25 MB.
              </small>
            </label>

            <p v-if="formulario.archivo" class="archivo-seleccionado">
              Seleccionado:
              <strong>{{ formulario.archivo.name }}</strong>
            </p>
          </section>

          <p v-if="error" class="form-error">
            {{ error }}
          </p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="guardando" @click="cerrarFormulario">
              Cancelar
            </button>

            <button class="btn btn-primary" type="submit" :disabled="guardando">
              {{
                guardando
                  ? 'Guardando y enviando...'
                  : 'Guardar y enviar a revisión'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="correccionAbierta" class="overlay" @click.self="cerrarCorreccion">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>Subir archivo corregido</h2>
            <p>
              {{ documentoCorreccion?.codigo }} ·
              {{ documentoCorreccion?.nombre }}
            </p>
          </div>

          <button class="modal-close" type="button" :disabled="guardandoCorreccion" @click="cerrarCorreccion">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="guardarCorreccion">
          <label class="campo">
            <span>Archivo corregido *</span>

            <input ref="archivoCorreccionInput" type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" required
              @change="seleccionarArchivoCorreccion" />
          </label>

          <p class="ayuda">
            El archivo reemplazará la versión borrador y se
            enviará nuevamente al flujo de revisión.
          </p>

          <p v-if="archivoCorreccion" class="archivo-seleccionado">
            Seleccionado:
            <strong>{{ archivoCorreccion.name }}</strong>
          </p>

          <p v-if="error" class="form-error">
            {{ error }}
          </p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="guardandoCorreccion" @click="cerrarCorreccion">
              Cancelar
            </button>

            <button class="btn btn-primary" type="submit" :disabled="guardandoCorreccion">
              {{
                guardandoCorreccion
                  ? 'Guardando...'
                  : 'Guardar y reenviar'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="revisionAbierta" class="overlay" @click.self="cerrarRevision">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>Enviar documento a revisión</h2>
            <p>
              {{ documentoRevision?.codigo }} ·
              {{ documentoRevision?.nombre }}
            </p>
          </div>

          <button class="modal-close" type="button" :disabled="enviandoRevision" @click="cerrarRevision">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="enviarRevision">
          <label class="campo">
            <span>Responsable del documento</span>

            <select v-model="formularioRevision.responsable_id">
              <option value="">
                Sin responsable adicional
              </option>

              <option v-for="usuario in responsables" :key="usuario.id" :value="usuario.id">
                {{ usuario.nombre }} · {{ usuario.correo }}
              </option>
            </select>
          </label>

          <label class="campo">
            <span>Revisor</span>

            <select v-model="formularioRevision.revisor_id">
              <option value="">
                Sin revisión intermedia
              </option>

              <option v-for="usuario in revisores" :key="usuario.id" :value="usuario.id">
                {{ usuario.nombre }} · {{ usuario.correo }}
              </option>
            </select>
          </label>

          <label class="campo">
            <span>Aprobador *</span>

            <select v-model="formularioRevision.aprobador_id" required>
              <option value="">
                Selecciona un aprobador
              </option>

              <option v-for="usuario in aprobadores" :key="usuario.id" :value="usuario.id">
                {{ usuario.nombre }} · {{ usuario.correo }}
              </option>
            </select>
          </label>

          <label class="campo">
            <span>Comentario para el flujo</span>

            <textarea v-model.trim="formularioRevision.comentario" rows="4" maxlength="2000"
              placeholder="Explica brevemente qué debe revisarse..."></textarea>
          </label>

          <p v-if="error" class="form-error">
            {{ error }}
          </p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="enviandoRevision" @click="cerrarRevision">
              Cancelar
            </button>

            <button class="btn btn-primary" type="submit" :disabled="enviandoRevision">
              {{
                enviandoRevision
                  ? 'Enviando...'
                  : 'Enviar a revisión'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <SolicitudesCopiasModal v-if="solicitudesCopiasAbiertas" :admin="true" @close="solicitudesCopiasAbiertas = false"
      @resolved="cargarCatalogos" />
  </div>
</template>

<style scoped src="../assets/styles/DocumentosView.css"></style>
