<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api/client';

const router = useRouter();
const auth = useAuthStore();
const actual = ref('');
const nueva = ref('');
const confirmar = ref('');
const error = ref('');
const guardando = ref(false);

async function cambiar() {
  error.value = '';
  if (nueva.value.length < 10 || nueva.value.length > 128) {
    error.value = 'La nueva contraseña debe tener entre 10 y 128 caracteres.';
    return;
  }
  if (nueva.value !== confirmar.value) {
    error.value = 'Las contraseñas nuevas no coinciden.';
    return;
  }
  guardando.value = true;
  try {
    await api.put('/usuarios/password', { actual: actual.value, nueva: nueva.value });
    auth.completarCambioPassword();
    router.replace({ name: 'dashboard' });
  } catch (e) {
    error.value = e.message;
  } finally {
    guardando.value = false;
  }
}

function salir() {
  auth.logout();
  router.replace({ name: 'login' });
}
</script>

<template>
  <main class="pantalla">
    <section class="panel">
      <h1>Cambia tu contraseña temporal</h1>
      <p>Antes de entrar a WEB 360 de Calidad, crea una contraseña personal para {{ auth.usuario?.correo }}.</p>
      <form @submit.prevent="cambiar">
        <label>Contraseña temporal<input v-model="actual" type="password" autocomplete="current-password" required /></label>
        <label>Nueva contraseña<input v-model="nueva" type="password" autocomplete="new-password" minlength="10" maxlength="128" required /></label>
        <label>Confirmar nueva contraseña<input v-model="confirmar" type="password" autocomplete="new-password" minlength="10" maxlength="128" required /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="btn btn-primary" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar y entrar' }}</button>
      </form>
      <button class="salir" type="button" @click="salir">Cerrar sesión</button>
    </section>
  </main>
</template>

<style scoped src="../assets/styles/CambiarPasswordView.css"></style>
