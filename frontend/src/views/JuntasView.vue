<template>
  <section class="juntas-page">
    <div class="juntas-page__top juntas-page__heading">
      <div>
        <h1 class="juntas-page__title">Juntas y Sesiones</h1>
        <p class="pagina-subtitulo">Convoca juntas, registra su minuta y da seguimiento a los acuerdos.</p>
      </div>
      <button v-if="puede('convocar')" class="btn btn-primary" type="button" @click="abrirNueva">+ Nueva junta</button>
    </div>

    <div v-if="mensaje" class="juntas-aviso juntas-aviso--ok">{{ mensaje }}</div>
    <div v-if="errorPagina" class="juntas-aviso juntas-aviso--error">{{ errorPagina }}</div>

    <div class="juntas-card juntas-listado">
      <div class="juntas-listado__header">
        <h2>Juntas registradas</h2>
        <button class="juntas-btn" :disabled="cargando" @click="cargarJuntas">Actualizar lista</button>
      </div>
      <p v-if="cargando">Cargando juntas...</p>
      <p v-else-if="!juntas.length">Aún no hay juntas registradas.</p>
      <div v-else class="juntas-listado__items">
        <article v-for="junta in juntas" :key="junta.id" class="juntas-listado__item">
          <div>
            <strong>{{ junta.nombre }}</strong>
            <span>{{ fechaLegible(junta.fecha) }} · {{ junta.tipo }} · {{ junta.modalidad }}</span>
            <span>
              Organiza: {{ junta.organizador }} · Estado:
              <span class="juntas-estado-badge" :class="claseEstadoJunta(junta.estado)">
                {{ estadoLegible(junta.estado) }}
              </span>
            </span>
            <span v-if="contarAcuerdosVencidos(junta)">
              <span class="juntas-estado-badge juntas-estado-badge--rechazo">
                ⚠ {{ contarAcuerdosVencidos(junta) }}
                {{ contarAcuerdosVencidos(junta) === 1 ? 'acuerdo vencido' : 'acuerdos vencidos' }}
              </span>
            </span>
          </div>
          <div class="juntas-listado__acciones">
            <button class="juntas-btn" @click="abrirDetalle(junta)">Ver detalles</button>
            <button v-if="puedeModificar(junta) && puede('modificar')" class="juntas-btn"
              @click="abrirEdicion(junta)">Modificar</button>
          </div>
        </article>
      </div>
    </div>

    <div v-if="mostrarFormulario" class="juntas-modal-overlay" @click.self="cerrarFormulario">
      <form class="juntas-modal juntas-modal--report" @submit.prevent="guardarJunta">
        <div class="juntas-modal__header">
          <h2 class="juntas-modal__title">{{ juntaEditando ? 'Modificar junta' : 'Nueva junta' }}</h2>
          <button type="button" class="juntas-modal__close" aria-label="Cerrar" @click="cerrarFormulario">×</button>
        </div>
        <div class="juntas-modal__body">
          <div v-if="errorFormulario" class="juntas-aviso juntas-aviso--error">{{ errorFormulario }}</div>
          <label class="juntas-field">
            <span class="juntas-field__label">Título de la junta *</span>
            <input v-model.trim="formulario.nombre" class="juntas-input" maxlength="200" required
              placeholder="Ej. Revisión mensual de calidad">
          </label>
          <div class="juntas-modal__row">
            <label class="juntas-field">
              <span class="juntas-field__label">Tipo de junta *</span>
              <select v-model="formulario.tipo" class="juntas-select" required>
                <option>Ordinaria</option>
                <option>Extraordinaria</option>
                <option>Seguimiento</option>
              </select>
            </label>
            <label class="juntas-field">
              <span class="juntas-field__label">Modalidad *</span>
              <select v-model="formulario.modalidad" class="juntas-select" required>
                <option>Presencial</option>
                <option>Virtual</option>
                <option>Híbrida</option>
              </select>
            </label>
          </div>
          <div class="juntas-modal__row">
            <label class="juntas-field">
              <span class="juntas-field__label">Fecha *</span>
              <input v-model="formulario.dia" type="date" class="juntas-input" required>
            </label>
            <label class="juntas-field">
              <span class="juntas-field__label">Hora de inicio *</span>
              <input v-model="formulario.hora" type="time" class="juntas-input" required>
            </label>
          </div>
          <div class="juntas-field">
            <span class="juntas-field__label">Participantes convocados</span>
            <div class="juntas-asistentes">
              <label v-for="usuario in usuarios" :key="usuario.id">
                <input v-model="formulario.participantes_ids" type="checkbox" :value="usuario.id">
                {{ usuario.nombre }}
              </label>
              <p v-if="!usuarios.length">No hay usuarios activos para seleccionar.</p>
            </div>
          </div>
          <label class="juntas-field">
            <span class="juntas-field__label">Agenda / temas a tratar *</span>
            <textarea v-model="formulario.agenda" class="juntas-textarea" maxlength="10000" rows="3" required
              placeholder="Ej. Revisar resultados y acordar pendientes"></textarea>
          </label>
          <label v-if="juntaEditando" class="juntas-field">
            <span class="juntas-field__label">Motivo o notas de la modificación</span>
            <textarea v-model="formulario.notas" class="juntas-textarea" maxlength="5000" rows="2"></textarea>
          </label>
        </div>
        <div class="juntas-modal__footer">
          <button type="button" class="juntas-btn-cancel" @click="cerrarFormulario">Cancelar</button>
          <button type="submit" class="juntas-btn-save" :disabled="guardando">
            {{ guardando ? 'Guardando...' : juntaEditando ? 'Guardar cambios' : 'Convocar junta' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="juntaDetalle" class="juntas-modal-overlay" @click.self="juntaDetalle = null">
      <div class="juntas-modal juntas-modal--detalle">
        <div class="juntas-modal__header">
          <h2 class="juntas-modal__title">Detalle de junta</h2>
          <button class="juntas-modal__close" aria-label="Cerrar" @click="juntaDetalle = null">×</button>
        </div>
        <div class="juntas-modal__body">
          <div v-if="errorDetalle" class="juntas-aviso juntas-aviso--error">{{ errorDetalle }}</div>
          <div class="juntas-report__section"><span class="juntas-report__label">Título</span><strong>{{
            juntaDetalle.nombre }}</strong></div>
          <div class="juntas-report__grid">
            <div class="juntas-report__section"><span class="juntas-report__label">Fecha y hora</span><span>{{
              fechaLegible(juntaDetalle.fecha) }}</span></div>
            <div class="juntas-report__section"><span class="juntas-report__label">Estado</span><span
                class="juntas-estado-badge" :class="claseEstadoJunta(juntaDetalle.estado)">
                {{ estadoLegible(juntaDetalle.estado) }}
              </span></div>
            <div class="juntas-report__section"><span class="juntas-report__label">Tipo</span><span>{{ juntaDetalle.tipo
                }}</span></div>
            <div class="juntas-report__section"><span class="juntas-report__label">Modalidad</span><span>{{
              juntaDetalle.modalidad }}</span></div>
            <div class="juntas-report__section"><span class="juntas-report__label">Organizador</span><span>{{
              juntaDetalle.organizador }}</span></div>
            <div class="juntas-report__section"><span class="juntas-report__label">Participantes
                convocados</span><span>
                {{juntaDetalle.participantes_convocados?.map(usuario => usuario.nombre).join(', ') ||
                  juntaDetalle.participantes || 'Sin registrar'}}
              </span></div>
          </div>
          <div class="juntas-report__section"><span class="juntas-report__label">Agenda</span><span>{{
            juntaDetalle.agenda }}</span></div>
          <div v-if="juntaDetalle.notas" class="juntas-report__section"><span
              class="juntas-report__label">Notas</span><span>{{ juntaDetalle.notas }}</span></div>
          <div v-if="puedeModificar(juntaDetalle) && puede('iniciar')" class="juntas-seccion">
            <h3>Iniciar sesión</h3>
            <p>Cuando comience la junta, inicia la sesión para registrar asistentes, minuta y acuerdos.</p>
            <button class="juntas-btn-save" :disabled="guardandoDetalle" @click="iniciarSesion">Iniciar junta</button>
          </div>

          <div v-if="juntaDetalle.estado === 'celebrada' && puede('modificar')" class="juntas-seccion">
            <h3>Asistentes</h3>
            <p>Selecciona a quienes estuvieron presentes, no solo a los convocados.</p>
            <div class="juntas-asistentes">
              <label v-for="usuario in usuarios" :key="usuario.id">
                <input v-model="asistentesSeleccionados" type="checkbox" :value="usuario.id">
                {{ usuario.nombre }}
              </label>
            </div>
            <button class="juntas-btn-save" :disabled="guardandoDetalle" @click="guardarAsistentes">Guardar
              asistentes</button>
          </div>
          <div v-else-if="juntaDetalle.asistentes?.length" class="juntas-seccion">
            <h3>Asistentes</h3>
            <p>{{juntaDetalle.asistentes.map(asistente => asistente.nombre).join(', ')}}</p>
          </div>

          <div class="juntas-seccion">
            <h3>Minuta</h3>
            <template v-if="juntaDetalle.estado === 'celebrada' && puede('minutas')">
              <textarea v-model="textoMinuta" class="juntas-textarea" rows="5" maxlength="20000"
                placeholder="Resume los temas tratados y las decisiones tomadas"></textarea>
              <button class="juntas-btn-save" :disabled="guardandoDetalle" @click="guardarMinuta">Guardar
                minuta</button>
            </template>
            <p v-else>{{ juntaDetalle.minuta?.contenido || 'Aún no se ha registrado una minuta.' }}</p>
          </div>

          <div class="juntas-seccion">
            <h3>Acuerdos y compromisos</h3>
            <p v-if="!juntaDetalle.compromisos?.length">Aún no hay acuerdos registrados.</p>
            <article v-for="acuerdo in juntaDetalle.compromisos" :key="acuerdo.id" class="juntas-acuerdo">
              <strong>{{ acuerdo.descripcion }}</strong>
              <span>Responsable: {{ acuerdo.responsable }} · Fecha compromiso: {{
                fechaSoloLegible(acuerdo.fecha_compromiso) }} ·
                <span class="juntas-estado-badge" :class="claseEstadoAcuerdo(acuerdo.estado)">
                  {{ estadoAcuerdo(acuerdo.estado) }}
                </span>
                <span v-if="acuerdoVencido(acuerdo)" class="juntas-estado-badge juntas-estado-badge--rechazo">
                  {{ textoAtraso(acuerdo.fecha_compromiso) }}
                </span></span>
              <ul v-if="acuerdo.avances?.length">
                <li v-for="avance in acuerdo.avances" :key="avance.id">
                  {{ avance.descripcion }} — {{ avance.usuario || 'Usuario' }}, {{ fechaLegible(avance.creado_en) }}
                </li>
              </ul>
              <template
                v-if="acuerdo.estado !== 'cerrado' && ['celebrada', 'cerrada'].includes(juntaDetalle.estado) && (puede('avances') || puede('revisarAvances'))">
                <textarea v-if="puede('avances')" v-model="avancesNuevos[acuerdo.id]" class="juntas-textarea" rows="2"
                  maxlength="10000" placeholder="Describe el avance realizado"></textarea>
                <div class="juntas-listado__acciones">
                  <button v-if="puede('avances')" class="juntas-btn" :disabled="guardandoDetalle"
                    @click="registrarAvance(acuerdo)">Guardar avance</button>
                  <button v-if="acuerdo.estado === 'en_avance' && puedeCerrarAcuerdo(acuerdo)" class="juntas-btn"
                    :disabled="guardandoDetalle" @click="cerrarAcuerdo(acuerdo)">Marcar cumplido</button>
                </div>
              </template>
            </article>
            <div v-if="juntaDetalle.estado === 'celebrada' && puede('compromisos')" class="juntas-nuevo-acuerdo">
              <h4>Nuevo acuerdo</h4>
              <label class="juntas-field"><span class="juntas-field__label">Descripción *</span>
                <textarea v-model="nuevoAcuerdo.descripcion" class="juntas-textarea" rows="2" maxlength="10000"
                  placeholder="Ej. Actualizar el procedimiento de cambios"></textarea>
              </label>
              <div class="juntas-modal__row">
                <label class="juntas-field"><span class="juntas-field__label">Responsable *</span>
                  <select v-model.number="nuevoAcuerdo.responsable_id" class="juntas-select">
                    <option :value="null" disabled>Selecciona un usuario</option>
                    <option v-for="usuario in usuarios" :key="usuario.id" :value="usuario.id">{{ usuario.nombre }}
                    </option>
                  </select>
                </label>
                <label class="juntas-field"><span class="juntas-field__label">Fecha compromiso *</span>
                  <input v-model="nuevoAcuerdo.fecha_compromiso" type="date" class="juntas-input"
                    :min="diaLocal(juntaDetalle.fecha)">
                </label>
              </div>
              <button class="juntas-btn-save" :disabled="guardandoDetalle" @click="crearAcuerdo">Guardar
                acuerdo</button>
            </div>
          </div>

          <div class="juntas-seccion">
            <h3>Acciones correctivas relacionadas</h3>

            <template v-if="juntaDetalle.estado === 'celebrada' && puede('modificar')">
              <p>Marca las acciones existentes que se revisaron o trataron en esta junta.</p>

              <div class="juntas-asistentes">
                <label v-for="accion in accionesCorrectivas" :key="accion.id">
                  <input v-model="accionesCorrectivasSeleccionadas" type="checkbox" :value="accion.id">
                  <span>
                    <strong>{{ accion.titulo }}</strong>
                    · {{ accion.proceso || 'Sin proceso' }}
                    · <span class="juntas-estado-badge" :class="claseEstadoAccion(accion.estado)">
                      {{ nombreEstadoAccion(accion.estado) }}
                    </span>
                  </span>
                </label>
              </div>

              <p v-if="!accionesCorrectivas.length">
                No hay acciones correctivas registradas.
              </p>

              <button class="juntas-btn-save" :disabled="guardandoDetalle" @click="guardarAccionesCorrectivas">
                Guardar acciones relacionadas
              </button>
            </template>

            <template v-else>
              <p v-if="!juntaDetalle.acciones_correctivas?.length">
                No se relacionaron acciones correctivas.
              </p>

              <ul v-else>
                <li v-for="accion in juntaDetalle.acciones_correctivas" :key="accion.id">
                  <strong>{{ accion.titulo }}</strong>
                  · {{ accion.proceso || 'Sin proceso' }}
                  · <span class="juntas-estado-badge" :class="claseEstadoAccion(accion.estado)">
                    {{ nombreEstadoAccion(accion.estado) }}
                  </span>
                </li>
              </ul>
            </template>
          </div>

          <div v-if="juntaDetalle.estado === 'celebrada' && puede('cerrar')" class="juntas-seccion">
            <h3>Terminar junta</h3>
            <p>La minuta es obligatoria. Los acuerdos podrán seguirse y cumplirse después de cerrar la junta.</p>
            <button class="juntas-btn-save" :disabled="guardandoDetalle || !juntaDetalle.minuta"
              @click="cerrarJunta">Cerrar
              junta</button>
          </div>
        </div>
        <div class="juntas-modal__footer">
          <button class="juntas-btn-save" @click="imprimirReporte">Imprimir reporte</button>
          <button class="juntas-btn-cancel" @click="juntaDetalle = null">Cerrar</button>
        </div>
      </div>
    </div>

    <div v-if="juntaDetalle" class="juntas-print-report">
      <header>
        <span>WEB 360 de Calidad · FIME</span>
        <h1>Reporte de junta</h1>
        <p>JUN-{{ juntaDetalle.id }} · <span class="juntas-estado-badge" :class="claseEstadoJunta(juntaDetalle.estado)">
            {{ estadoLegible(juntaDetalle.estado) }}
          </span></p>
      </header>
      <div class="juntas-print-report__grid">
        <div><strong>Título</strong><span>{{ juntaDetalle.nombre }}</span></div>
        <div><strong>Fecha y hora</strong><span>{{ fechaLegible(juntaDetalle.fecha) }}</span></div>
        <div><strong>Tipo</strong><span>{{ juntaDetalle.tipo }}</span></div>
        <div><strong>Modalidad</strong><span>{{ juntaDetalle.modalidad }}</span></div>
        <div><strong>Organizador</strong><span>{{ juntaDetalle.organizador }}</span></div>
        <div><strong>Participantes convocados</strong><span>{{juntaDetalle.participantes_convocados?.map(usuario =>
          usuario.nombre).join(', ') || juntaDetalle.participantes || 'Sin registrar'}}</span>
        </div>
      </div>
      <section>
        <h2>Agenda</h2>
        <p>{{ juntaDetalle.agenda }}</p>
      </section>
      <section>
        <h2>Asistentes</h2>
        <p>{{juntaDetalle.asistentes?.map(asistente => asistente.nombre).join(', ') || 'Sin registrar'}}</p>
      </section>
      <section>
        <h2>Minuta</h2>
        <p>{{ juntaDetalle.minuta?.contenido || 'Sin registrar' }}</p>
      </section>
      <section>
        <h2>Acuerdos y avances</h2>
        <p v-if="!juntaDetalle.compromisos?.length">Sin acuerdos registrados.</p>
        <article v-for="acuerdo in juntaDetalle.compromisos" :key="acuerdo.id">
          <strong>{{ acuerdo.descripcion }}</strong>
          <p>Responsable: {{ acuerdo.responsable }} · Compromiso: {{ fechaSoloLegible(acuerdo.fecha_compromiso) }} ·
            <span class="juntas-estado-badge" :class="claseEstadoAcuerdo(acuerdo.estado)">
              {{ estadoAcuerdo(acuerdo.estado) }}
            </span>
          </p>
          <ul v-if="acuerdo.avances?.length">
            <li v-for="avance in acuerdo.avances" :key="avance.id">
              {{ fechaLegible(avance.creado_en) }} — {{ avance.usuario || 'Usuario' }}: {{ avance.descripcion }}
            </li>
          </ul>
        </article>
      </section>
      <section>
        <h2>Acciones correctivas relacionadas</h2>
        <p v-if="!juntaDetalle.acciones_correctivas?.length">
          No se relacionaron acciones correctivas.
        </p>
        <ul v-else>
          <li v-for="accion in juntaDetalle.acciones_correctivas" :key="accion.id">
            {{ accion.titulo }} · {{ accion.proceso || 'Sin proceso' }} · <span class="juntas-estado-badge"
              :class="claseEstadoAccion(accion.estado)">
              {{ nombreEstadoAccion(accion.estado) }}
            </span>
          </li>
        </ul>
      </section>
      <section v-if="juntaDetalle.notas">
        <h2>Notas</h2>
        <p>{{ juntaDetalle.notas }}</p>
      </section>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '@/api/client';
import { confirmarAccion } from '@/utils/dialogos';
import { useAuthStore } from '@/stores/auth';
import { tienePermiso } from '@/config/permisos';
import { diaLocal, estaVencida, mostrarFecha, mostrarFechaHora, textoAtraso } from '@/utils/fechas';

const auth = useAuthStore();

const puede = (accion) => tienePermiso(auth.usuario, `juntas.${accion}`);

const juntas = ref([]);
const cargando = ref(false);
const guardando = ref(false);
const mensaje = ref('');
const errorPagina = ref('');
const errorFormulario = ref('');
const errorDetalle = ref('');
const mostrarFormulario = ref(false);
const juntaEditando = ref(null);
const juntaDetalle = ref(null);
const formulario = ref(formularioVacio());
const usuarios = ref([]);
const accionesCorrectivas = ref([]);
const accionesCorrectivasSeleccionadas = ref([]);
const guardandoDetalle = ref(false);
const textoMinuta = ref('');
const asistentesSeleccionados = ref([]);
const nuevoAcuerdo = ref(acuerdoVacio());
const avancesNuevos = ref({});

function acuerdoVacio() {
  return { descripcion: '', responsable_id: null, fecha_compromiso: '' };
}

function formularioVacio() {
  return {
    nombre: '', tipo: 'Ordinaria', modalidad: 'Presencial',
    dia: '', hora: '', participantes_ids: [], agenda: '', notas: ''
  };
}

function fechaLegible(fecha) {
  return mostrarFechaHora(fecha, 'Sin fecha');
}

function fechaSoloLegible(fecha) {
  return mostrarFecha(fecha, 'Sin fecha');
}

function estadoLegible(estado) {
  return { convocada: 'Convocada', reagendada: 'Reagendada', celebrada: 'En curso', cerrada: 'Cerrada' }[estado] || estado;
}

function estadoAcuerdo(estado) {
  return { abierto: 'Abierto', en_avance: 'En avance', cerrado: 'Cumplido' }[estado] || estado;
}

function acuerdoVencido(acuerdo) {
  return acuerdo.estado !== 'cerrado' && estaVencida(acuerdo.fecha_compromiso);
}

function contarAcuerdosVencidos(junta) {
  return (junta.compromisos || []).filter(acuerdoVencido).length;
}

function claseEstadoJunta(estado) {
  return ({
    convocada: 'juntas-estado-badge--pendiente',
    reagendada: 'juntas-estado-badge--pendiente',
    celebrada: 'juntas-estado-badge--proceso',
    cerrada: 'juntas-estado-badge--exito',
  })[estado] || 'juntas-estado-badge--neutro';
}

function claseEstadoAcuerdo(estado) {
  return ({
    abierto: 'juntas-estado-badge--pendiente',
    en_avance: 'juntas-estado-badge--proceso',
    cerrado: 'juntas-estado-badge--exito',
  })[estado] || 'juntas-estado-badge--neutro';
}

function nombreEstadoAccion(estado) {
  return ({
    propuesta: 'Levantada',
    aceptada: 'Aceptada',
    rechazada: 'Rechazada',
    en_seguimiento: 'En seguimiento',
    en_revision: 'En revisión',
    cerrada: 'Cerrada',
  })[estado] || estado || 'Sin estado';
}

function claseEstadoAccion(estado) {
  return ({
    propuesta: 'juntas-estado-badge--pendiente',
    aceptada: 'juntas-estado-badge--exito',
    rechazada: 'juntas-estado-badge--rechazo',
    en_seguimiento: 'juntas-estado-badge--proceso',
    en_revision: 'juntas-estado-badge--proceso',
    cerrada: 'juntas-estado-badge--exito',
  })[estado] || 'juntas-estado-badge--neutro';
}

function puedeModificar(junta) {
  return ['convocada', 'reagendada'].includes(junta.estado);
}

async function cargarJuntas() {
  cargando.value = true;
  errorPagina.value = '';
  try {
    juntas.value = await api.get('/juntas');
    if (juntaDetalle.value) {
      juntaDetalle.value = juntas.value.find(junta => junta.id === juntaDetalle.value.id) || null;
    }
  } catch (error) {
    errorPagina.value = error.message;
  } finally {
    cargando.value = false;
  }
}

async function cargarUsuarios() {
  try {
    usuarios.value = await api.get('/juntas/catalogos');
  } catch (error) {
    errorPagina.value = error.message;
  }
}

async function cargarAccionesCorrectivas() {
  if (!tienePermiso(auth.usuario, 'modulo.accionesCorrectivas')) {
    accionesCorrectivas.value = [];
    return;
  }

  try {
    accionesCorrectivas.value = await api.get('/acciones-correctivas');
  } catch (error) {
    errorPagina.value = error.message;
  }
}

function abrirNueva() {
  formulario.value = formularioVacio();
  juntaEditando.value = null;
  errorFormulario.value = '';
  mostrarFormulario.value = true;
}

function abrirEdicion(junta) {
  const fecha = junta.fecha ? new Date(junta.fecha) : null;
  formulario.value = {
    nombre: junta.nombre,
    tipo: junta.tipo,
    modalidad: junta.modalidad,
    dia: fecha ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}` : '',
    hora: fecha ? `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}` : '',
    participantes_ids: junta.participantes_convocados?.map(usuario => usuario.id) || [],
    agenda: junta.agenda,
    notas: junta.notas,
  };
  juntaEditando.value = junta;
  errorFormulario.value = '';
  mostrarFormulario.value = true;
}

function abrirDetalle(junta) {
  juntaDetalle.value = junta;
  errorDetalle.value = '';
  textoMinuta.value = junta.minuta?.contenido || '';
  asistentesSeleccionados.value = junta.asistentes?.map(asistente => asistente.id) || [];
  accionesCorrectivasSeleccionadas.value =
    junta.acciones_correctivas?.map(accion => accion.id) || [];
  nuevoAcuerdo.value = acuerdoVacio();
  avancesNuevos.value = {};
}

function imprimirReporte() {
  window.print();
}

async function ejecutarDetalle(accion, mensajeExito) {
  errorDetalle.value = '';
  guardandoDetalle.value = true;
  try {
    await accion();
    await cargarJuntas();
    mensaje.value = mensajeExito;
  } catch (error) {
    errorDetalle.value = error.message;
  } finally {
    guardandoDetalle.value = false;
  }
}

async function iniciarSesion() {
  await ejecutarDetalle(() => api.post(`/juntas/${juntaDetalle.value.id}/iniciar`, {}),
    'La junta se inició correctamente.');
}

async function guardarAsistentes() {
  await ejecutarDetalle(() => api.put(`/juntas/${juntaDetalle.value.id}/asistentes`,
    { usuario_ids: asistentesSeleccionados.value }), 'Asistentes guardados correctamente.');
}

async function guardarAccionesCorrectivas() {
  await ejecutarDetalle(
    () => api.put(
      `/juntas/${juntaDetalle.value.id}/acciones-correctivas`,
      { accion_ids: accionesCorrectivasSeleccionadas.value },
    ),
    'Acciones correctivas relacionadas con la junta.',
  );
}

async function guardarMinuta() {
  if (!textoMinuta.value.trim()) {
    errorDetalle.value = 'Escribe el contenido de la minuta.';
    return;
  }
  await ejecutarDetalle(() => api.put(`/juntas/${juntaDetalle.value.id}/minuta`,
    { contenido: textoMinuta.value }), 'Minuta guardada correctamente.');
}

async function crearAcuerdo() {
  if (!nuevoAcuerdo.value.descripcion.trim() || !nuevoAcuerdo.value.responsable_id ||
    !nuevoAcuerdo.value.fecha_compromiso) {
    errorDetalle.value = 'Completa la descripción, responsable y fecha compromiso.';
    return;
  }
  await ejecutarDetalle(() => api.post(`/juntas/${juntaDetalle.value.id}/compromisos`,
    nuevoAcuerdo.value), 'Acuerdo registrado correctamente.');
  if (!errorDetalle.value) nuevoAcuerdo.value = acuerdoVacio();
}

async function registrarAvance(acuerdo) {
  const descripcion = avancesNuevos.value[acuerdo.id]?.trim();
  if (!descripcion) {
    errorDetalle.value = 'Describe el avance antes de guardarlo.';
    return;
  }
  await ejecutarDetalle(() => api.post(
    `/juntas/${juntaDetalle.value.id}/compromisos/${acuerdo.id}/avances`,
    { descripcion }), 'Avance registrado correctamente.');
  if (!errorDetalle.value) avancesNuevos.value[acuerdo.id] = '';
}

function puedeCerrarAcuerdo(acuerdo) {
  const esAdmin = auth.usuario?.rol_clave === 'admin_general';
  const esSuyo = Number(acuerdo.responsable_id) === Number(auth.usuario?.id);
  return puede('revisarAvances') && (esAdmin || !esSuyo);
}

async function cerrarAcuerdo(acuerdo) {
  if (!await confirmarAccion({ titulo: 'Cerrar acuerdo', mensaje: '¿Confirmas que el acuerdo ya se cumplió?', confirmarTexto: 'Marcar cumplido' })) return;
  await ejecutarDetalle(() => api.post(
    `/juntas/${juntaDetalle.value.id}/compromisos/${acuerdo.id}/cerrar`, {}),
    'El acuerdo quedó marcado como cumplido.');
}

async function cerrarJunta() {
  if (!await confirmarAccion({ titulo: 'Cerrar junta', mensaje: '¿Cerrar la junta? La minuta y la lista de asistentes ya no se podrán editar.', confirmarTexto: 'Cerrar junta' })) return;
  await ejecutarDetalle(() => api.post(`/juntas/${juntaDetalle.value.id}/cerrar`, {}),
    'La junta se cerró correctamente. Los acuerdos abiertos siguen en seguimiento.');
}

function cerrarFormulario() {
  if (!guardando.value) mostrarFormulario.value = false;
}

async function guardarJunta() {
  errorFormulario.value = '';
  const fecha = new Date(`${formulario.value.dia}T${formulario.value.hora}:00`);
  if (!formulario.value.dia || !formulario.value.hora || Number.isNaN(fecha.getTime())) {
    errorFormulario.value = 'Indica una fecha y hora válidas.';
    return;
  }
  const datos = {
    nombre: formulario.value.nombre,
    tipo: formulario.value.tipo,
    modalidad: formulario.value.modalidad,
    fecha: fecha.toISOString(),
    participantes_ids: formulario.value.participantes_ids,
    agenda: formulario.value.agenda,
    notas: formulario.value.notas,
  };
  guardando.value = true;
  try {
    if (juntaEditando.value) {
      await api.put(`/juntas/${juntaEditando.value.id}`, datos);
      mensaje.value = 'La junta se actualizó correctamente.';
    } else {
      await api.post('/juntas', datos);
      mensaje.value = 'La junta se convocó correctamente.';
    }
    mostrarFormulario.value = false;
    await cargarJuntas();
  } catch (error) {
    errorFormulario.value = error.message;
  } finally {
    guardando.value = false;
  }
}

onMounted(() => {
  cargarJuntas();
  cargarUsuarios();
  cargarAccionesCorrectivas();
});
</script>

<style>
@import '@/assets/styles/Juntas.css';
</style>
