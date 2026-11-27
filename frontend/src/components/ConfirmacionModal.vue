<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';

const props = defineProps({
  titulo: { type: String, default: 'Confirmar acción' },
  mensaje: { type: String, required: true },
  confirmarTexto: { type: String, default: 'Confirmar' },
  peligro: { type: Boolean, default: false },
  modoTexto: { type: Boolean, default: false },
  etiquetaCampo: { type: String, default: '' },
});

const emit = defineEmits(['resolve']);
const cancelarBoton = ref(null);
const campoTexto = ref(null);
const texto = ref('');

function cancelar() {
  emit('resolve', props.modoTexto ? null : false);
}

function confirmar() {
  emit('resolve', props.modoTexto ? texto.value.trim() : true);
}

function teclaPresionada(evento) {
  if (evento.key === 'Escape') cancelar();
}

onMounted(() => {
  (props.modoTexto ? campoTexto.value : cancelarBoton.value)?.focus();
  document.addEventListener('keydown', teclaPresionada);
});

onBeforeUnmount(() => document.removeEventListener('keydown', teclaPresionada));
</script>

<template>
  <div class="confirmacion-overlay" @click.self="cancelar">
    <section class="confirmacion-panel" role="dialog" aria-modal="true" :aria-label="titulo">
      <header class="confirmacion-cabecera">
        <h2>{{ titulo }}</h2>
        <button type="button" class="confirmacion-cerrar" aria-label="Cerrar" @click="cancelar">×</button>
      </header>
      <div class="confirmacion-cuerpo">
        <p>{{ mensaje }}</p>
        <label v-if="modoTexto" class="confirmacion-etiqueta">
          {{ etiquetaCampo }}
          <textarea ref="campoTexto" v-model="texto" rows="3" maxlength="2000" class="confirmacion-texto"></textarea>
        </label>
      </div>
      <footer class="confirmacion-pie">
        <button ref="cancelarBoton" type="button" class="confirmacion-boton confirmacion-boton--secundario" @click="cancelar">Cancelar</button>
        <button type="button" class="confirmacion-boton" :class="peligro ? 'confirmacion-boton--peligro' : 'confirmacion-boton--primario'" @click="confirmar">{{ confirmarTexto }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.confirmacion-overlay { position: fixed; inset: 0; z-index: 20000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(0 0 0 / 52%); }
.confirmacion-panel { width: min(100%, 460px); max-height: calc(100vh - 32px); overflow: auto; border-radius: 12px; background: #fff; box-shadow: 0 20px 50px rgb(0 0 0 / 25%); }
.confirmacion-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; background: var(--brand-800); color: #fff; }
.confirmacion-cabecera h2 { margin: 0; color: inherit; font-size: var(--modal-titulo); font-weight: 600; }
.confirmacion-cerrar { display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0; border: 0; border-radius: 6px; background: transparent; color: #fff; font-size: var(--modal-cerrar); line-height: 1; cursor: pointer; }
.confirmacion-cerrar:hover { background: rgb(255 255 255 / 12%); }
.confirmacion-cuerpo { padding: 22px 20px; color: #243444; font-size: 14px; line-height: 1.5; }
.confirmacion-cuerpo p { margin: 0; }
.confirmacion-etiqueta { display: block; margin-top: 16px; font-weight: 600; }
.confirmacion-texto { display: block; width: 100%; box-sizing: border-box; margin-top: 7px; padding: 10px 12px; resize: vertical; border: 1px solid #cbd5df; border-radius: 7px; font: inherit; font-weight: 400; }
.confirmacion-pie { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px 18px; border-top: 1px solid #e4eaf0; }
.confirmacion-boton { padding: 9px 16px; border: 1px solid transparent; border-radius: var(--radius-sm); font: inherit; font-size: 13px; font-weight: 600; line-height: 1.5; cursor: pointer; }
.confirmacion-boton--secundario { border-color: var(--border); background: transparent; color: var(--brand-700); }
.confirmacion-boton--primario { background: var(--brand-700); color: #fff; }
.confirmacion-boton--peligro { background: var(--danger); color: #fff; }
.confirmacion-boton:focus-visible, .confirmacion-cerrar:focus-visible, .confirmacion-texto:focus-visible { outline: 2px solid #46a067; outline-offset: 2px; }
</style>
