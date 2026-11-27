<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api/client';

const auth = useAuthStore();

const profile = ref({
  nombre: auth.usuario?.nombre || '',
  correo: auth.usuario?.correo || '',
  telefono: '',
  rol: auth.usuario?.rol || '',
});

const passwords = ref({ actual: '', nueva: '', confirmar: '' });
const tabActiva = ref('datos');
const cargando = ref(true);
const guardandoPerfil = ref(false);
const guardandoPassword = ref(false);
const perfilGuardado = ref(false);
const passwordGuardada = ref(false);
const errorPerfil = ref('');
const errorPass = ref('');

const emit = defineEmits(['close']);

async function cargarPerfil() {
  cargando.value = true;
  errorPerfil.value = '';
  try {
    const datos = await api.get('/usuarios/perfil');
    profile.value = {
      nombre: datos.nombre,
      correo: datos.correo,
      telefono: datos.telefono || '',
      rol: datos.rol,
    };
  } catch (error) {
    errorPerfil.value = error.message;
  } finally {
    cargando.value = false;
  }
}

async function guardarPerfil() {
  errorPerfil.value = '';
  perfilGuardado.value = false;
  guardandoPerfil.value = true;
  try {
    const datos = await api.put('/usuarios/perfil', { telefono: profile.value.telefono });
    profile.value.telefono = datos.telefono || '';
    auth.usuario = { ...auth.usuario, telefono: datos.telefono };
    localStorage.setItem('web360_user', JSON.stringify(auth.usuario));
    perfilGuardado.value = true;
  } catch (error) {
    errorPerfil.value = error.message;
  } finally {
    guardandoPerfil.value = false;
  }
}

async function guardarPassword() {
  errorPass.value = '';
  passwordGuardada.value = false;
  if (!passwords.value.actual || passwords.value.nueva.length < 10) {
    errorPass.value = 'Escribe la contraseña actual y una nueva de al menos 10 caracteres.';
    return;
  }
  if (passwords.value.nueva !== passwords.value.confirmar) {
    errorPass.value = 'La nueva contraseña y su confirmación no coinciden.';
    return;
  }
  guardandoPassword.value = true;
  try {
    await api.put('/usuarios/password', {
      actual: passwords.value.actual,
      nueva: passwords.value.nueva,
    });
    passwords.value = { actual: '', nueva: '', confirmar: '' };
    passwordGuardada.value = true;
  } catch (error) {
    errorPass.value = error.message;
  } finally {
    guardandoPassword.value = false;
  }
}

function iniciales() {
  return (profile.value.nombre || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

onMounted(cargarPerfil);
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="emit('close')">
      <div class="modal" @click.stop>

        <div class="modal-head">
          <h2>Mi perfil</h2>
          <button class="close-btn" type="button" aria-label="Cerrar" @click="emit('close')">×</button>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button :class="['tab', { active: tabActiva === 'datos' }]" @click="tabActiva = 'datos'">Mis datos</button>
          <button :class="['tab', { active: tabActiva === 'password' }]" @click="tabActiva = 'password'">Contraseña</button>
        </div>

        <!-- Avatar + info -->
        <div class="avatar-row">
          <div class="avatar">{{ iniciales() }}</div>
          <div>
            <strong>{{ profile.nombre }}</strong>
            <small>{{ profile.rol }}</small>
          </div>
        </div>

        <!-- Panel: mis datos -->
        <div v-if="tabActiva === 'datos'" class="panel">
          <div v-if="cargando">Cargando perfil...</div>
          <div v-if="perfilGuardado" class="banner-ok">Cambios guardados correctamente.</div>
          <div v-if="errorPerfil" class="error-banner">{{ errorPerfil }}</div>

          <label class="field">
            <span>Nombre</span>
            <input v-model="profile.nombre" type="text" readonly class="readonly" />
          </label>
          <label class="field">
            <span>Correo</span>
            <input v-model="profile.correo" type="email" readonly class="readonly" />
            <small>El cambio de correo requiere verificación y todavía no está disponible.</small>
          </label>
          <label class="field">
            <span>Teléfono</span>
            <input v-model="profile.telefono" type="tel" autocomplete="tel" maxlength="30" />
          </label>
          <label class="field">
            <span>Rol</span>
            <input v-model="profile.rol" type="text" readonly class="readonly" />
          </label>

          <button class="btn btn-primary" :disabled="cargando || guardandoPerfil" @click="guardarPerfil">
            {{ guardandoPerfil ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>

        <!-- Panel: contraseña -->
        <div v-if="tabActiva === 'password'" class="panel">
          <div v-if="passwordGuardada" class="banner-ok">Contraseña actualizada.</div>
          <div v-if="errorPass" class="error-banner">{{ errorPass }}</div>

          <label class="field">
            <span>Contraseña actual</span>
            <input v-model="passwords.actual" type="password" autocomplete="current-password" required />
          </label>
          <label class="field">
            <span>Nueva contraseña</span>
            <input v-model="passwords.nueva" type="password" autocomplete="new-password" minlength="10" maxlength="128" required />
          </label>
          <label class="field">
            <span>Confirmar contraseña</span>
            <input v-model="passwords.confirmar" type="password" autocomplete="new-password" minlength="10" maxlength="128" required />
          </label>

          <button class="btn btn-primary" :disabled="guardandoPassword" @click="guardarPassword">
            {{ guardandoPassword ? 'Guardando...' : 'Guardar contraseña' }}
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 48px 16px; z-index: 200; overflow-y: auto;
}
.modal {
  background: #fff; border-radius: var(--modal-radio); width: 100%; max-width: 380px;
  box-shadow: var(--shadow-md); overflow: hidden;
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--modal-relleno-encabezado); background: var(--modal-encabezado); color: #fff;
}
.modal-head h2 { font-size: var(--modal-titulo); font-weight: 600; color: #fff; }
.close-btn {
  display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0;
  border: none; border-radius: 6px; background: transparent; color: #fff;
  font-size: var(--modal-cerrar); line-height: 1; cursor: pointer;
}
.close-btn:hover { background: rgba(255, 255, 255, 0.12); }

.tabs { display: flex; border-bottom: 1px solid var(--border-soft); }
.tab {
  flex: 1; padding: 11px; border: none; background: transparent;
  font: inherit; font-size: 13px; font-weight: 600; color: var(--gray-500);
  cursor: pointer; border-bottom: 2px solid transparent;
  transition: color .14s, border-color .14s;
}
.tab.active { color: var(--brand-700); border-bottom-color: var(--brand-700); }

.avatar-row {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px; border-bottom: 1px solid var(--border-soft);
}
.avatar {
  width: 46px; height: 46px; border-radius: 50%;
  background: var(--brand-700); color: #fff;
  display: grid; place-items: center; font-size: 14px; font-weight: 700;
  flex-shrink: 0;
}
.avatar-row strong { display: block; font-size: 14px; }
.avatar-row small { font-size: 12px; color: var(--gray-500); }

.panel { padding: 20px; display: flex; flex-direction: column; gap: 14px; }

.field { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 600; color: var(--gray-700); }
.field input {
  padding: 9px 10px; border: 1px solid var(--border); border-radius: 7px;
  font: inherit; font-size: 14px; font-weight: 400; outline: none;
}
.field input:focus { border-color: var(--brand-500); box-shadow: 0 0 0 3px var(--brand-100); }
.readonly { background: var(--gray-100); color: var(--gray-500); cursor: not-allowed; }

.btn-primary { justify-content: center; width: 100%; margin-top: 4px; }

.banner-ok {
  background: var(--ok-bg); color: var(--ok);
  border: 1px solid var(--brand-200); border-radius: 7px;
  padding: 9px 12px; font-size: 13px;
}
.error-banner {
  background: var(--danger-bg); color: var(--danger);
  border: 1px solid var(--danger); border-radius: 7px;
  padding: 9px 12px; font-size: 13px;
}
</style>
