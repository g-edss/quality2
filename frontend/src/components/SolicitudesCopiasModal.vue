<script setup>
import { onMounted, ref } from 'vue';
import { api } from '@/api/client';
import { confirmarAccion } from '@/utils/dialogos';
import { mostrarFechaHora } from '@/utils/fechas';

const props = defineProps({ admin: { type: Boolean, default: false } });
const emit = defineEmits(['close', 'resolved']);
const solicitudes = ref([]);
const cargando = ref(false);
const procesando = ref(null);
const rechazando = ref(null);
const motivoRechazo = ref('');
const error = ref('');
const mensaje = ref('');

async function cargar() {
  cargando.value = true;
  error.value = '';
  try {
    solicitudes.value = await api.get('/copias-controladas/solicitudes');
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}

function fecha(valor) {
  return mostrarFechaHora(valor);
}

function estadoEntrega(solicitud) {
  if (solicitud.copia_estado === 'pendiente_entrega') return 'Pendiente de entrega física';
  if (solicitud.copia_estado === 'activa' && solicitud.entregada_en) return 'Entregada';
  if (solicitud.copia_estado === 'activa') return 'Activa (registro anterior)';
  if (solicitud.copia_estado === 'cancelada') return 'Cancelada antes de entregar';
  if (solicitud.copia_estado === 'requiere_retiro') return 'Requiere retiro';
  if (solicitud.copia_estado === 'retirada') return 'Retirada';
  return solicitud.copia_estado || '—';
}

function etiquetaEstado(estado) {
  return ({ pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' })[estado] || estado || '—';
}

function claseEstado(estado) {
  if (estado === 'pendiente' || estado === 'pendiente_entrega' || estado === 'requiere_retiro') return 'estado--pendiente';
  if (estado === 'aprobada' || estado === 'activa') return 'estado--aprobado';
  if (estado === 'rechazada' || estado === 'cancelada') return 'estado--rechazado';
  return 'estado--neutro';
}

async function resolver(solicitud, decision) {
  if (decision === 'aprobada' && !await confirmarAccion({ titulo: 'Autorizar copia controlada', mensaje: '¿Autorizar y generar esta copia controlada?', confirmarTexto: 'Autorizar copia' })) return;
  if (decision === 'rechazada' && !motivoRechazo.value.trim()) {
    error.value = 'Explica por qué se rechaza la solicitud.';
    return;
  }
  procesando.value = solicitud.id;
  error.value = '';
  mensaje.value = '';
  try {
    const resultado = await api.patch(
      `/copias-controladas/solicitudes/${solicitud.id}/resolver`,
      { decision, comentario: decision === 'rechazada' ? motivoRechazo.value.trim() : '' },
    );
    mensaje.value = resultado.mensaje;
    rechazando.value = null;
    motivoRechazo.value = '';
    await cargar();
    emit('resolved');
  } catch (e) {
    error.value = e.message;
  } finally {
    procesando.value = null;
  }
}

onMounted(cargar);
</script>

<template>
  <Teleport to="body">
    <div class="overlay-copias" @click.self="emit('close')">
      <div class="panel-copias" role="dialog" aria-modal="true" aria-label="Solicitudes de copias controladas">
        <div class="cabecera-copias">
          <div><h2>{{ props.admin ? 'Solicitudes de copias' : 'Mis solicitudes de copias' }}</h2>
            <p>La autorización genera el folio; la entrega física se confirma por separado.</p></div>
          <button type="button" aria-label="Cerrar" @click="emit('close')">×</button>
        </div>
        <div class="contenido-copias">
          <p v-if="mensaje" class="exito">{{ mensaje }}</p>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <p v-if="cargando">Cargando solicitudes...</p>
          <p v-else-if="!solicitudes.length">Todavía no hay solicitudes.</p>
          <article v-for="s in solicitudes" :key="s.id" class="solicitud">
            <div class="titulo"><strong>{{ s.codigo }} · {{ s.documento_nombre }} · v{{ s.version }}</strong><span class="estado" :class="claseEstado(s.estado)">{{ etiquetaEstado(s.estado) }}</span></div>
            <p><strong>Para:</strong> {{ s.destinatario_nombre }} · <strong>Solicitó:</strong> {{ s.solicitada_por }}</p>
            <p><strong>Motivo:</strong> {{ s.motivo }}</p>
            <p><strong>Fecha:</strong> {{ fecha(s.solicitada_en) }}</p>
            <p v-if="s.folio"><strong>Copia autorizada:</strong> {{ s.folio }} · <strong>Entrega:</strong> <span class="estado" :class="claseEstado(s.copia_estado)">{{ estadoEntrega(s) }}</span></p>
            <p v-if="s.entregada_en"><strong>Recibida por:</strong> {{ s.recibida_por_nombre }} · {{ fecha(s.entregada_en) }}</p>
            <p v-if="s.comentario_resolucion"><strong>Respuesta:</strong> {{ s.comentario_resolucion }}</p>
            <div v-if="props.admin && s.estado === 'pendiente'" class="acciones">
              <button class="btn btn-primary btn-sm" type="button" :disabled="Boolean(procesando)" @click="resolver(s, 'aprobada')">Aprobar y generar</button>
              <button class="btn btn-ghost btn-sm" type="button" :disabled="Boolean(procesando)" @click="rechazando = s.id; motivoRechazo = ''">Rechazar</button>
            </div>
            <div v-if="rechazando === s.id" class="rechazo">
              <label>Motivo del rechazo<textarea v-model="motivoRechazo" maxlength="2000" rows="2" /></label>
              <button class="btn btn-primary btn-sm" type="button" :disabled="Boolean(procesando)" @click="resolver(s, 'rechazada')">Confirmar rechazo</button>
            </div>
          </article>
        </div>
        <div class="pie-copias"><button class="btn btn-ghost" type="button" @click="emit('close')">Cerrar</button></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay-copias { position: fixed; inset: 0; z-index: 300; display: flex; justify-content: center; align-items: flex-start; padding: 7vh 16px; background: rgb(0 0 0 / 50%); overflow-y: auto; }
.panel-copias { width: min(780px, 100%); max-height: 86vh; display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; background: white; box-shadow: var(--shadow-md); }
.cabecera-copias { display: flex; justify-content: space-between; gap: 16px; padding: 16px 20px; color: white; background: var(--brand-800); }
.cabecera-copias h2 { color: white; font-size: 17px; }
.cabecera-copias p { margin-top: 4px; font-size: 12px; }
.cabecera-copias button { align-self: flex-start; border: 0; color: white; background: transparent; font-size: 24px; cursor: pointer; }
.contenido-copias { padding: 18px 20px; overflow-y: auto; }
.solicitud { padding: 16px 0; border-bottom: 1px solid var(--border-soft); }
.titulo { display: flex; justify-content: space-between; gap: 10px; }
.titulo { align-items: flex-start; }
.estado { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.estado--pendiente { color: #805000; background: #fff1cf; }
.estado--aprobado { color: #17613b; background: #e3f4e9; }
.estado--rechazado { color: #a42a2a; background: #fce8e8; }
.estado--neutro { color: #53616b; background: #edf0f2; }
.solicitud p { margin-top: 7px; font-size: 13px; }
.acciones { display: flex; gap: 8px; margin-top: 12px; }
.rechazo { display: grid; gap: 8px; margin-top: 12px; }
.rechazo label { display: grid; gap: 5px; font-size: 13px; }
.rechazo textarea { padding: 8px; border: 1px solid var(--border); border-radius: 6px; font: inherit; }
.rechazo button { justify-self: start; }
.pie-copias { display: flex; justify-content: flex-end; padding: 12px 20px; border-top: 1px solid var(--border-soft); }
.error { padding: 10px; color: var(--danger); background: var(--danger-bg); }
.exito { padding: 10px; color: var(--ok); background: var(--ok-bg); }
</style>
