<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import TheSidebar from '@/components/TheSidebar.vue';
import TheTopbar from '@/components/TheTopbar.vue';

const route = useRoute();
const menuAbierto = ref(false);

watch(() => route.fullPath, () => {
  menuAbierto.value = false;
});

function cerrarConEsc(evento) {
  if (evento.key === 'Escape') menuAbierto.value = false;
}

onMounted(() => window.addEventListener('keydown', cerrarConEsc));
onBeforeUnmount(() => window.removeEventListener('keydown', cerrarConEsc));
</script>

<template>
  <div class="shell">
    <TheSidebar :abierto="menuAbierto" />
    <div v-if="menuAbierto" class="menu-fondo" @click="menuAbierto = false"></div>
    <div class="main">
      <TheTopbar @abrir-menu="menuAbierto = true" />
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  width: 100%;
  min-height: 100vh;
}

.main {
  width: calc(100% - var(--sidebar-w));
  min-width: 0;
  overflow-x: clip;
  margin-left: var(--sidebar-w);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.content {
  width: 100%;
  min-width: 0;
  padding: 24px;
  flex: 1;
}

.menu-fondo {
  display: none;
}

@media (max-width: 900px) {
  .main {
    width: 100%;
    margin-left: 0;
  }

  .content {
    padding: 18px;
  }

  .menu-fondo {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 299;
    background: rgba(0, 0, 0, .4);
  }
}

@media (max-width: 560px) {
  .content {
    padding: 12px;
  }
}
</style>