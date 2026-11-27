<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const correo = ref('');
const clave = ref('');
const error = ref('');
const cargando = ref(false);

const auth = useAuthStore();
const router = useRouter();
const motivoSesion = new URLSearchParams(window.location.search).get('sesion');
const sesionRestablecida = motivoSesion === 'restablecida';
const sesionExpirada = motivoSesion === 'expirada';

async function entrar() {
  error.value = '';
  cargando.value = true;

  try {
    await auth.login(correo.value, clave.value);
    router.push({ name: auth.usuario?.debe_cambiar_password ? 'cambiarPassword' : 'dashboard' });
  } catch (fallo) {
    error.value = fallo.status === 429
      ? fallo.message
      : 'Correo o contraseña incorrectos.';
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="panel">
      <div class="brand">
        <div class="mark">
          <svg width="30" height="30" viewBox="0 0 32 32">
            <path d="M16 4l10 5v7c0 6.2-4.2 10.5-10 12.5C10.2 26.5 6 22.2 6 16V9l10-5z" fill="#fff"/>
            <path d="M11 16.5l3.2 3.2L21 13" fill="none" stroke="#1b7a43" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>WEB 360 de Calidad</h1>
        <p>Facultad de Ingeniería Mecánica y Eléctrica · UANL</p>
      </div>

      <form class="form" @submit.prevent="entrar">
        <p v-if="sesionRestablecida" class="session-message">Tu sesión terminó porque el administrador restableció tu contraseña. Inicia sesión con la nueva contraseña temporal.</p>
        <p v-else-if="sesionExpirada" class="session-message">Tu sesión expiró. Vuelve a iniciar sesión para continuar.</p>
        <label>
          <span>Correo institucional</span>
          <input v-model="correo" type="email" required placeholder="usuario@fime.uanl.mx" />
        </label>
        <label>
          <span>Contraseña</span>
          <input v-model="clave" type="password" required placeholder="••••••••" />
        </label>
        <button class="btn btn-primary" type="submit" :disabled="cargando">
          {{ cargando ? 'Iniciando sesión...' : 'Iniciar sesión' }}
        </button>
        <p v-if="error" class="hint" style="color: #b42318">{{ error }}</p>
        <p class="recuperar">Si olvidaste tu contraseña, solicita una contraseña temporal al administrador.</p>
      </form>
    </div>
    <footer class="pie muted">Sistema interno de gestión de calidad · Uso confidencial</footer>
  </div>
</template>

<style scoped src="../assets/styles/LoginView.css"></style>
