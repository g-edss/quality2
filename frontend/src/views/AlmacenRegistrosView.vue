<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/client.js';
import { useAuthStore } from '@/stores/auth.js';
import { tienePermiso } from '@/config/permisos';
import { mostrarFecha } from '@/utils/fechas';
import AppIcon from '@/components/AppIcon.vue';
import StatusBadge from '@/components/StatusBadge.vue';

const auth = useAuthStore();
const registros = ref([]);
const formatos = ref([]);
const cargando = ref(false);
const error = ref('');
const busqueda = ref('');
const procesoSeleccionado = ref('');
const formatoSeleccionadoId = ref('');
const responsables = ref([]);
const revisores = ref([]);
const aprobadores = ref([]);
const formularioAbierto = ref(false);
const cargandoCatalogos = ref(false);
const guardando = ref(false);
const descargandoId = ref(null);
const descargandoFormato = ref(false);
const mensaje = ref('');
const archivoInput = ref(null);
const revisionAbierta = ref(false);
const registroRevision = ref(null);
const enviandoRevision = ref(false);
const formularioRevision = ref({
  revisor_id: '',
  aprobador_id: '',
  comentario: ''
});
const formulario = ref({
  nombre: '',
  documento_registro_id: '',
  responsable_id: '',
  fecha_registro: '',
  descripcion: '',
  archivo: null
});
const puedeCrear = computed(() =>
  tienePermiso(auth.usuario, 'almacenRegistros.crearFormato')
);

const crearFormatoAbierto = ref(false);
const guardandoFormato = ref(false);
const errorFormato = ref('');
const archivoFormatoInput = ref(null);
const tiposDocumento = ref([]);
const procesosFormato = ref([]);
const revisoresFormato = ref([]);
const aprobadoresFormato = ref([]);

const formularioFormato = ref({
  nombre: '',
  proceso_id: '',
  responsable_id: '',
  revisor_id: '',
  aprobador_id: '',
  version: '1.0',
  justificacion: '',
  donde_conserva: '',
  quien_conserva: '',
  frecuencia_uso: '',
  almacenamiento_proteccion: '',
  tiempo_retencion: '',
  disposicion_final: '',
  archivo: null,
});

const tipoRegistro = computed(() =>
  tiposDocumento.value.find(
    tipo => String(tipo.nombre).trim().toLocaleLowerCase('es') === 'registro',
  ) || null,
);

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const procesosDisponibles = computed(() => {
  const procesosUnicos = new Map();

  formatos.value.forEach((formato) => {
    if (formato.proceso_id && formato.proceso) {
      procesosUnicos.set(
        String(formato.proceso_id),
        {
          id: String(formato.proceso_id),
          nombre: formato.proceso
        }
      );
    }
  });

  return Array.from(procesosUnicos.values())
    .sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es')
    );
});

const formatoSeleccionado = computed(() =>
  formatos.value.find(
    (formato) =>
      String(formato.documento_registro_id) ===
      formatoSeleccionadoId.value
  ) || null
);

const registrosDelFormato = computed(() =>
  registros.value.filter(
    (registro) =>
      String(registro.documento_registro_id) ===
      formatoSeleccionadoId.value
  )
);

const formatosVisibles = computed(() => {
  const texto = normalizarTexto(busqueda.value);

  return formatos.value.filter((formato) => {
    const coincideProceso =
      !procesoSeleccionado.value ||
      String(formato.proceso_id) ===
      procesoSeleccionado.value;

    const registrosRelacionados =
      registros.value.filter(
        (registro) =>
          Number(registro.documento_registro_id) ===
          Number(formato.documento_registro_id)
      );

    const contenido = normalizarTexto([
      formato.codigo,
      formato.nombre,
      formato.proceso,
      formato.version,
      ...registrosRelacionados.flatMap(
        (registro) => [
          registro.nombre,
          registro.responsable,
          registro.nombre_archivo
        ]
      )
    ].join(' '));

    return (
      coincideProceso &&
      (!texto || contenido.includes(texto))
    );
  });
});

function seleccionarProceso(procesoId) {
  procesoSeleccionado.value = String(procesoId);
  formatoSeleccionadoId.value = '';
}

function seleccionarFormato(formatoId) {
  formatoSeleccionadoId.value = String(formatoId);
}

function obtenerFechaActual() {
  const fecha = new Date();

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function limpiarFormulario() {
  formulario.value = {
    nombre: '',
    documento_registro_id:
      formatoSeleccionadoId.value,
    responsable_id: '',
    fecha_registro: obtenerFechaActual(),
    descripcion: '',
    archivo: null
  };

  if (archivoInput.value) {
    archivoInput.value.value = '';
  }
}

function seleccionarArchivoFormato(event) {
  formularioFormato.value.archivo =
    event.target.files?.[0] || null;
}

function cerrarCrearFormato() {
  if (guardandoFormato.value) return;
  crearFormatoAbierto.value = false;
  errorFormato.value = '';
  formularioFormato.value.archivo = null;
}

async function abrirCrearFormato() {
  errorFormato.value = '';
  crearFormatoAbierto.value = true;
  guardandoFormato.value = true;

  try {
    const [tipos, procesos, participantes] = await Promise.all([
      api.get('/documentos/tipos'),
      api.get('/procesos'),
      api.get('/documentos/participantes'),
    ]);

    tiposDocumento.value = tipos;
    procesosFormato.value = procesos.filter(
      proceso => proceso.estatus === 'activo',
    );

    responsables.value = participantes.filter(
      usuario => usuario.rol_clave === 'responsable',
    );
    revisoresFormato.value = participantes.filter(
      usuario => usuario.rol_clave === 'revisor',
    );
    aprobadoresFormato.value = participantes.filter(
      usuario => usuario.rol_clave === 'aprobador',
    );

    formularioFormato.value = {
      nombre: '',
      proceso_id: '',
      responsable_id: '',
      revisor_id: '',
      aprobador_id: '',
      version: '1.0',
      justificacion: '',
      donde_conserva: '',
      quien_conserva: '',
      frecuencia_uso: '',
      almacenamiento_proteccion: '',
      tiempo_retencion: '',
      disposicion_final: '',
      archivo: null,
    };

    if (!tipoRegistro.value) {
      errorFormato.value =
        'No está registrado un tipo de documento llamado Registro.';
    }
  } catch (err) {
    errorFormato.value =
      err.message || 'No se pudieron cargar los datos para crear el formato.';
  } finally {
    guardandoFormato.value = false;
  }
}

async function guardarFormatoRegistro() {
  errorFormato.value = '';

  if (!tipoRegistro.value) {
    errorFormato.value = 'No está disponible el tipo de documento Registro.';
    return;
  }

  if (!auth.usuario?.id) {
    errorFormato.value = 'No se pudo identificar al usuario que crea el formato.';
    return;
  }

  const datos = new FormData();
  datos.append('nombre', formularioFormato.value.nombre.trim());
  datos.append('tipo_documento_id', tipoRegistro.value.id);
  datos.append('proceso_id', formularioFormato.value.proceso_id);
  datos.append('elaborador_id', auth.usuario.id);
  datos.append('origen', 'interno');
  datos.append('version', formularioFormato.value.version.trim());
  datos.append('justificacion', formularioFormato.value.justificacion.trim());
  datos.append('revision_programada', 'false');
  datos.append('norma_ids', JSON.stringify([]));
  datos.append('documentos_relacionados_ids', JSON.stringify([]));
  datos.append('registro_donde_conserva', formularioFormato.value.donde_conserva.trim());
  datos.append('registro_quien_conserva', formularioFormato.value.quien_conserva.trim());
  datos.append('registro_frecuencia_uso', formularioFormato.value.frecuencia_uso.trim());
  datos.append(
    'registro_almacenamiento_proteccion',
    formularioFormato.value.almacenamiento_proteccion.trim(),
  );
  datos.append('registro_tiempo_retencion', formularioFormato.value.tiempo_retencion.trim());
  datos.append('registro_disposicion_final', formularioFormato.value.disposicion_final.trim());
  datos.append('archivo', formularioFormato.value.archivo);

  guardandoFormato.value = true;

  try {
    const respuesta = await api.postForm('/documentos/formato-registro', datos);
    const documento = respuesta.documento;
    let resultado = `Formato guardado con el código ${documento.codigo}.`;

    if (
      ['completada', 'no_requerida'].includes(
        documento.version_actual.estado_conversion,
      )
    ) {
      try {
        await api.post(
          `/documentos/formato-registro/${documento.id}/versiones/${documento.version_actual.id}/enviar-revision`,
          {
            responsable_id: Number(formularioFormato.value.responsable_id),
            revisor_id: Number(formularioFormato.value.revisor_id),
            aprobador_id: Number(formularioFormato.value.aprobador_id),
            comentario: formularioFormato.value.justificacion.trim(),
          },
        );

        resultado =
          'Formato creado y enviado al flujo de revisión. Aparecerá en Almacén cuando sea aprobado.';
      } catch (err) {
        resultado =
          `Formato guardado como borrador, pero no se pudo enviar a revisión: ${err.message}`;
      }
    } else {
      resultado =
        'Formato guardado como borrador. No se pudo generar su PDF para enviarlo a revisión.';
    }

    crearFormatoAbierto.value = false;
    mensaje.value = resultado;
    await cargarRegistros();
  } catch (err) {
    errorFormato.value =
      err.message || 'No se pudo crear el formato de Registro.';
  } finally {
    guardandoFormato.value = false;
  }
}

async function abrirFormulario() {
  if (!formatoSeleccionado.value) {
    error.value =
      'Selecciona primero un formato de registro.';
    return;
  }

  error.value = '';
  mensaje.value = '';
  limpiarFormulario();
  formularioAbierto.value = true;
  cargandoCatalogos.value = true;

  try {
    const participantesRespuesta = await api.get(
      '/documentos/participantes'
    );

    responsables.value =
      participantesRespuesta.filter(
        (usuario) =>
          usuario.rol_clave === 'responsable'
      );
  } catch (err) {
    error.value =
      err.message ||
      'No se pudieron cargar los responsables.';

    formularioAbierto.value = false;
  } finally {
    cargandoCatalogos.value = false;
  }
}

function cerrarFormulario() {
  if (guardando.value) {
    return;
  }

  formularioAbierto.value = false;
  error.value = '';
  limpiarFormulario();
}

function seleccionarArchivo(event) {
  formulario.value.archivo =
    event.target.files?.[0] || null;
}

async function abrirRevision(registro) {
  error.value = '';
  mensaje.value = '';

  formularioRevision.value = {
    revisor_id: '',
    aprobador_id: '',
    comentario: ''
  };

  registroRevision.value = registro;
  revisionAbierta.value = true;
  cargandoCatalogos.value = true;

  try {
    const participantes = await api.get(
      '/documentos/participantes'
    );

    revisores.value = participantes.filter(
      (usuario) => usuario.rol_clave === 'revisor'
    );

    aprobadores.value = participantes.filter(
      (usuario) => usuario.rol_clave === 'aprobador'
    );
  } catch (err) {
    error.value =
      err.message || 'No se pudieron cargar los participantes.';
    revisionAbierta.value = false;
    registroRevision.value = null;
  } finally {
    cargandoCatalogos.value = false;
  }
}

function cerrarRevision() {
  if (enviandoRevision.value) {
    return;
  }

  revisionAbierta.value = false;
  registroRevision.value = null;
  error.value = '';
}

async function enviarRegistroRevision() {
  error.value = '';
  mensaje.value = '';

  if (
    !registroRevision.value ||
    !formularioRevision.value.aprobador_id
  ) {
    error.value = 'Debes seleccionar un aprobador.';
    return;
  }

  enviandoRevision.value = true;
  let enviado = false;

  try {
    const respuesta = await api.post(
      `/registros/${registroRevision.value.id}/enviar-revision`,
      {
        revisor_id:
          formularioRevision.value.revisor_id || null,
        aprobador_id:
          formularioRevision.value.aprobador_id,
        comentario:
          formularioRevision.value.comentario.trim()
      }
    );

    mensaje.value = respuesta.mensaje;
    enviado = true;

    await cargarRegistros();
  } catch (err) {
    error.value =
      err.message || 'No se pudo enviar el registro.';
  } finally {
    enviandoRevision.value = false;
  }

  if (enviado) {
    revisionAbierta.value = false;
    registroRevision.value = null;
  }
}

async function guardarRegistro() {
  error.value = '';
  mensaje.value = '';

  if (
    !formulario.value.nombre.trim() ||
    !formulario.value.documento_registro_id ||
    !formulario.value.responsable_id ||
    !formulario.value.fecha_registro ||
    !formulario.value.archivo
  ) {
    error.value =
      'Completa los campos obligatorios y selecciona un archivo.';
    return;
  }

  const datos = new FormData();

  datos.append(
    'nombre',
    formulario.value.nombre.trim()
  );

  datos.append(
    'documento_registro_id',
    formulario.value.documento_registro_id
  );

  datos.append(
    'responsable_id',
    formulario.value.responsable_id
  );

  datos.append(
    'fecha_registro',
    formulario.value.fecha_registro
  );

  datos.append(
    'descripcion',
    formulario.value.descripcion.trim()
  );

  datos.append(
    'archivo',
    formulario.value.archivo
  );

  guardando.value = true;
  let guardado = false;

  try {
    const respuesta = await api.postForm(
      '/registros',
      datos
    );

    mensaje.value = respuesta.mensaje;
    guardado = true;

    await cargarRegistros();
  } catch (err) {
    error.value =
      err.message || 'No se pudo guardar el registro.';
  } finally {
    guardando.value = false;
  }

  if (guardado) {
    formularioAbierto.value = false;
    limpiarFormulario();
  }
}

function formatearFecha(valor) {
  return mostrarFecha(String(valor || '').slice(0, 10));
}

async function descargarFormato() {
  if (!formatoSeleccionado.value) {
    return;
  }

  error.value = '';
  descargandoFormato.value = true;

  try {
    const formato = formatoSeleccionado.value;

    const archivo = await api.getBlob(
      `/documentos/${formato.documento_registro_id}` +
      `/versiones/${formato.version_id}/original`
    );

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download =
      formato.nombre_original ||
      `${formato.codigo}-formato`;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo descargar el formato.';
  } finally {
    descargandoFormato.value = false;
  }
}

async function descargarArchivo(registro) {
  error.value = '';
  descargandoId.value = registro.id;

  try {
    const archivo = await api.getBlob(
      `/registros/${registro.id}/archivo`
    );

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download =
      registro.nombre_archivo || 'registro';

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
  } catch (err) {
    error.value =
      err.message || 'No se pudo descargar el archivo.';
  } finally {
    descargandoId.value = null;
  }
}

async function cargarRegistros() {
  cargando.value = true;
  error.value = '';

  try {
    const [
      registrosRespuesta,
      formatosRespuesta
    ] = await Promise.all([
      api.get('/registros'),
      api.get('/registros/formatos')
    ]);

    registros.value = registrosRespuesta;
    formatos.value = formatosRespuesta;

    if (
      formatoSeleccionadoId.value &&
      !formatos.value.some(
        (formato) =>
          String(formato.documento_registro_id) ===
          formatoSeleccionadoId.value
      )
    ) {
      formatoSeleccionadoId.value = '';
    }
  } catch (err) {
    error.value =
      err.message ||
      'No se pudo cargar el almacén de registros.';
  } finally {
    cargando.value = false;
  }
}

onMounted(cargarRegistros);
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div>
        <h1>Almacén de registros</h1>
        <p>
          Consulta los registros generados por los procesos
          de calidad.
        </p>
      </div>
      <button v-if="puedeCrear" class="btn btn-primary" type="button" @click="abrirCrearFormato">
        <AppIcon name="plus" :size="16" />
        Crear formato de Registro
      </button>
    </div>

    <p v-if="mensaje" class="estado-mensaje estado-exito">
      {{ mensaje }}
    </p>

    <p v-if="
      error &&
      !formularioAbierto &&
      !revisionAbierta
    " class="estado-mensaje estado-error">
      {{ error }}
    </p>

    <div class="buscador-registros">
      <AppIcon name="search" :size="18" />

      <input v-model="busqueda" type="search" placeholder="Buscar registro, responsable o archivo" />
    </div>

    <div class="navegador-registros">
      <section class="panel-registros">
        <h2>Proceso</h2>

        <div v-if="!cargando && procesosDisponibles.length === 0" class="mensaje-panel">
          <p>Aún no hay formatos de registro disponibles. Para cargar un registro, primero debe existir un documento
            vigente de tipo Registro.</p>
          <RouterLink v-if="puedeCrear" to="/documentos">Ir a Control de Documentos</RouterLink>
        </div>

        <div v-else class="lista-opciones">
          <button v-for="proceso in procesosDisponibles" :key="proceso.id" class="opcion-navegacion" :class="{
            activa:
              procesoSeleccionado === proceso.id
          }" type="button" @click="seleccionarProceso(proceso.id)">
            <span>{{ proceso.nombre }}</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>

      <section class="panel-registros">
        <h2>Registros</h2>

        <p v-if="!busqueda && !procesoSeleccionado" class="mensaje-panel">
          Selecciona primero un proceso.
        </p>

        <p v-else-if="formatosVisibles.length === 0" class="mensaje-panel">
          No hay formatos de registro que coincidan.
        </p>

        <div v-else class="lista-opciones">
          <button v-for="formato in formatosVisibles" :key="formato.documento_registro_id"
            class="opcion-navegacion opcion-registro" :class="{
              activa:
                formatoSeleccionadoId ===
                String(formato.documento_registro_id)
            }" type="button" @click="
              seleccionarFormato(
                formato.documento_registro_id
              )
              ">
            <span>
              <strong>{{ formato.codigo }}</strong>

              <small>{{ formato.nombre }}</small>

              <small>Versión {{ formato.version }}</small>
            </span>

            <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>

      <section class="panel-registros panel-detalle">
        <h2>Detalle y acciones</h2>

        <p v-if="!formatoSeleccionado" class="mensaje-panel">
          Selecciona un formato de registro.
        </p>

        <div v-else class="detalle-registro">
          <div class="encabezado-registro">
            <div>
              <strong>
                {{ formatoSeleccionado.codigo }}
              </strong>

              <p>{{ formatoSeleccionado.nombre }}</p>

              <p>
                {{ formatoSeleccionado.proceso }}
                · Versión {{ formatoSeleccionado.version }}
              </p>
            </div>

            <StatusBadge estado="vigente" />
          </div>

          <dl class="datos-registro conservacion-registro">
            <div>
              <dt>Dónde se conserva</dt>
              <dd>
                {{ formatoSeleccionado.donde_conserva }}
              </dd>
            </div>

            <div>
              <dt>Quién lo conserva</dt>
              <dd>
                {{ formatoSeleccionado.quien_conserva }}
              </dd>
            </div>

            <div>
              <dt>Frecuencia de uso</dt>
              <dd>
                {{ formatoSeleccionado.frecuencia_uso }}
              </dd>
            </div>

            <div>
              <dt>Tiempo de retención</dt>
              <dd>
                {{ formatoSeleccionado.tiempo_retencion }}
              </dd>
            </div>

            <div>
              <dt>Almacenamiento y protección</dt>
              <dd>
                {{
                  formatoSeleccionado
                    .almacenamiento_proteccion
                }}
              </dd>
            </div>

            <div>
              <dt>Disposición final</dt>
              <dd>
                {{ formatoSeleccionado.disposicion_final }}
              </dd>
            </div>
          </dl>

          <div class="acciones-registro">
            <button type="button" class="btn btn-ghost" :disabled="descargandoFormato" @click="descargarFormato">
              <AppIcon name="doc" :size="15" />

              {{
                descargandoFormato
                  ? 'Descargando...'
                  : 'Descargar formato'
              }}
            </button>

            <button v-if="formatoSeleccionado.puede_cargar" type="button" class="btn btn-primary"
              @click="abrirFormulario">
              <AppIcon name="plus" :size="15" />
              Cargar nuevo registro
            </button>
          </div>

          <div class="registros-capturados">
            <h3>Registros cargados</h3>

            <p v-if="registrosDelFormato.length === 0" class="mensaje-panel">
              Todavía no se han cargado registros con este
              formato.
            </p>

            <article v-for="registro in registrosDelFormato" :key="registro.id" class="registro-capturado">
              <div class="registro-capturado__encabezado">
                <div>
                  <strong>{{ registro.nombre }}</strong>

                  <small>
                    {{ formatearFecha(registro.fecha_registro) }}
                    · {{ registro.responsable }}
                  </small>
                </div>

                <StatusBadge :estado="registro.estado" />
              </div>

              <p v-if="registro.descripcion">
                {{ registro.descripcion }}
              </p>

              <div class="acciones-registro">
                <button v-if="registro.nombre_archivo && formatoSeleccionado.puede_descargar" type="button"
                  class="btn btn-ghost btn-sm" :disabled="descargandoId === registro.id"
                  @click="descargarArchivo(registro)">
                  <AppIcon name="doc" :size="14" />

                  {{
                    descargandoId === registro.id
                      ? 'Descargando...'
                      : 'Descargar evidencia'
                  }}
                </button>

                <button v-if="
                  puedeCrear &&
                  registro.estado === 'borrador'
                " type="button" class="btn btn-primary btn-sm" @click="abrirRevision(registro)">
                  Enviar a aprobación
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

    </div>
    <div v-if="crearFormatoAbierto" class="overlay" @click.self="cerrarCrearFormato">
      <div class="modal modal-formato">
        <div class="modal-head">
          <div>
            <h2>Crear formato de Registro</h2>
            <p>Define el documento controlado que después aparecerá en Almacén.</p>
          </div>
          <button class="modal-close" type="button" :disabled="guardandoFormato" @click="cerrarCrearFormato">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="guardarFormatoRegistro">
          <div class="form-grid">
            <label class="campo">
              <span>Versión *</span>
              <input v-model.trim="formularioFormato.version" maxlength="20" required>
            </label>
          </div>

          <p class="muted">El código se asignará automáticamente con el área y el proceso seleccionados.</p>

          <label class="campo">
            <span>Nombre del Registro *</span>
            <input v-model.trim="formularioFormato.nombre" maxlength="200" required
              placeholder="Ej. Bitácora de mantenimiento">
          </label>

          <div class="form-grid">
            <label class="campo">
              <span>Proceso *</span>
              <select v-model="formularioFormato.proceso_id" required>
                <option value="">Selecciona un proceso</option>
                <option v-for="proceso in procesosFormato" :key="proceso.id" :value="proceso.id">
                  {{ proceso.nombre }}
                </option>
              </select>
            </label>

            <label class="campo">
              <span>Tipo de documento</span>
              <input :value="tipoRegistro?.nombre || 'Registro'" disabled>
            </label>
          </div>

          <div class="form-grid">
            <label class="campo">
              <span>Responsable *</span>
              <select v-model="formularioFormato.responsable_id" required>
                <option value="">Selecciona un responsable</option>
                <option v-for="usuario in responsables" :key="usuario.id" :value="usuario.id">
                  {{ usuario.nombre }} · {{ usuario.correo }}
                </option>
              </select>
            </label>

            <label class="campo">
              <span>Revisor *</span>
              <select v-model="formularioFormato.revisor_id" required>
                <option value="">Selecciona un revisor</option>
                <option v-for="usuario in revisoresFormato" :key="usuario.id" :value="usuario.id">
                  {{ usuario.nombre }} · {{ usuario.correo }}
                </option>
              </select>
            </label>
          </div>

          <label class="campo">
            <span>Aprobador *</span>
            <select v-model="formularioFormato.aprobador_id" required>
              <option value="">Selecciona un aprobador</option>
              <option v-for="usuario in aprobadoresFormato" :key="usuario.id" :value="usuario.id">
                {{ usuario.nombre }} · {{ usuario.correo }}
              </option>
            </select>
          </label>

          <label class="campo">
            <span>Justificación *</span>
            <textarea v-model.trim="formularioFormato.justificacion" maxlength="2000" required rows="3"
              placeholder="Ej. Crear un formato para controlar las bitácoras mensuales de mantenimiento."></textarea>
          </label>

          <div class="seccion-titulo">
            <h3>Conservación del Registro</h3>
            <p>Estos datos se mostrarán en Almacén al consultar el formato.</p>
          </div>

          <div class="form-grid">
            <label class="campo">
              <span>Dónde se conserva *</span>
              <input v-model.trim="formularioFormato.donde_conserva" maxlength="255" required
                placeholder="Ej. Archivo físico del departamento de mantenimiento">
            </label>

            <label class="campo">
              <span>Quién lo conserva *</span>
              <input v-model.trim="formularioFormato.quien_conserva" maxlength="255" required
                placeholder="Ej. Responsable del proceso">
            </label>
          </div>

          <div class="form-grid">
            <label class="campo">
              <span>Frecuencia de uso *</span>
              <input v-model.trim="formularioFormato.frecuencia_uso" maxlength="160" required
                placeholder="Ej. Cada vez que se realice mantenimiento">
            </label>

            <label class="campo">
              <span>Tiempo de retención *</span>
              <input v-model.trim="formularioFormato.tiempo_retencion" maxlength="160" required
                placeholder="Ej. Cinco años">
            </label>
          </div>

          <label class="campo">
            <span>Almacenamiento y protección *</span>
            <textarea v-model.trim="formularioFormato.almacenamiento_proteccion" required rows="3"
              placeholder="Ej. Carpeta física bajo llave y repositorio institucional con acceso restringido."></textarea>
          </label>

          <label class="campo">
            <span>Disposición final *</span>
            <textarea v-model.trim="formularioFormato.disposicion_final" required rows="3"
              placeholder="Ej. Al terminar la retención, destruir de forma segura según el procedimiento institucional."></textarea>
          </label>

          <label class="campo">
            <span>Archivo original *</span>
            <input ref="archivoFormatoInput" type="file" required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" @change="seleccionarArchivoFormato">
            <small>El sistema conservará el original y generará la versión PDF.</small>
          </label>

          <p v-if="errorFormato" class="form-error">{{ errorFormato }}</p>

          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" :disabled="guardandoFormato" @click="cerrarCrearFormato">
              Cancelar
            </button>
            <button class="btn btn-primary" type="submit" :disabled="guardandoFormato">
              {{ guardandoFormato ? 'Guardando...' : 'Crear formato y enviar a revisión' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="formularioAbierto" class="overlay" @click.self="cerrarFormulario">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>Cargar nuevo registro</h2>
            <p>
              Captura un registro generado por un proceso
              de calidad.
            </p>
          </div>

          <button type="button" class="modal-close" :disabled="guardando" @click="cerrarFormulario">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="guardarRegistro">
          <label class="campo">
            <span>Nombre del registro *</span>
            <input v-model.trim="formulario.nombre" type="text" maxlength="255" required
              placeholder="Ej. Bitácora mensual de mantenimiento" />
          </label>

          <div class="form-grid">
            <div class="formato-seleccionado">
              <span>Formato seleccionado</span>

              <strong>
                {{ formatoSeleccionado?.codigo }}
                · {{ formatoSeleccionado?.nombre }}
              </strong>

              <small>
                {{ formatoSeleccionado?.proceso }}
                · Versión {{ formatoSeleccionado?.version }}
              </small>
            </div>

            <label class="campo">
              <span>Responsable *</span>
              <select v-model="formulario.responsable_id" :disabled="cargandoCatalogos" required>
                <option value="">
                  Selecciona un responsable
                </option>

                <option v-for="responsable in responsables" :key="responsable.id" :value="responsable.id">
                  {{ responsable.nombre }}
                </option>
              </select>
            </label>
          </div>

          <label class="campo">
            <span>Fecha de registro *</span>
            <input v-model="formulario.fecha_registro" type="date" required />
          </label>

          <label class="campo">
            <span>Descripción</span>
            <textarea v-model="formulario.descripcion" maxlength="2000" rows="4"
              placeholder="Describe brevemente el contenido del registro..."></textarea>
          </label>

          <label class="campo">
            <span>Archivo o evidencia *</span>
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

          <p v-if="error" class="form-error">
            {{ error }}
          </p>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" :disabled="guardando" @click="cerrarFormulario">
              Cancelar
            </button>

            <button type="submit" class="btn btn-primary" :disabled="guardando || cargandoCatalogos">
              {{
                guardando
                  ? 'Guardando...'
                  : 'Guardar registro'
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
            <h2>Enviar registro a aprobación</h2>
            <p>
              {{ registroRevision?.nombre }}
            </p>
          </div>

          <button type="button" class="modal-close" :disabled="enviandoRevision" @click="cerrarRevision">
            ×
          </button>
        </div>

        <form class="modal-body" @submit.prevent="enviarRegistroRevision">
          <p class="revision-info">
            El responsable del registro atenderá la primera
            etapa del flujo.
          </p>

          <label class="campo">
            <span>Revisor</span>

            <select v-model="formularioRevision.revisor_id" :disabled="cargandoCatalogos">
              <option value="">
                Sin revisor
              </option>

              <option v-for="revisor in revisores" :key="revisor.id" :value="revisor.id">
                {{ revisor.nombre }} · {{ revisor.correo }}
              </option>
            </select>

            <small>
              Esta etapa es opcional.
            </small>
          </label>

          <label class="campo">
            <span>Aprobador *</span>

            <select v-model="formularioRevision.aprobador_id" :disabled="cargandoCatalogos" required>
              <option value="">
                Selecciona un aprobador
              </option>

              <option v-for="aprobador in aprobadores" :key="aprobador.id" :value="aprobador.id">
                {{ aprobador.nombre }} · {{ aprobador.correo }}
              </option>
            </select>
          </label>

          <label class="campo">
            <span>Comentario</span>

            <textarea v-model="formularioRevision.comentario" maxlength="2000" rows="4"
              placeholder="Agrega indicaciones para quienes revisarán el registro..."></textarea>
          </label>

          <p v-if="error" class="form-error">
            {{ error }}
          </p>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" :disabled="enviandoRevision" @click="cerrarRevision">
              Cancelar
            </button>

            <button type="submit" class="btn btn-primary" :disabled="enviandoRevision ||
              cargandoCatalogos
              ">
              {{
                enviandoRevision
                  ? 'Enviando...'
                  : 'Enviar a aprobación'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped src="../assets/styles/AlmacenRegistrosView.css"></style>
