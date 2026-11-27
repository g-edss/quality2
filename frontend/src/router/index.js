import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { puedeAcceder } from '@/config/permisos';
import DefaultLayout from '@/layouts/DefaultLayout.vue';

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/cambiar-password', name: 'cambiarPassword', component: () => import('@/views/CambiarPasswordView.vue'), meta: { requiereAuth: true } },
  {
    path: '/',
    component: DefaultLayout,
    meta: { requiereAuth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
      { path: 'procesos', name: 'procesos', component: () => import('@/views/ProcesosView.vue') },
      { path: 'normas', name: 'normas', component: () => import('@/views/NormasView.vue') },
      { path: 'visor-documental', name: 'visorDocumental', component: () => import('@/views/VisorDocumentalView.vue') },
      { path: 'documentos', name: 'documentos', component: () => import('@/views/DocumentosView.vue') },
      { path: 'almacen-registros', name: 'almacenRegistros', component: () => import('@/views/AlmacenRegistrosView.vue') },
      { path: 'solicitudes', name: 'solicitudes', component: () => import('@/views/SolicitudesView.vue') },
      { path: 'auditorias', name: 'auditorias', component: () => import('@/views/AuditoriasView.vue') },
      { path: 'juntas', name: 'juntas', component: () => import('@/views/JuntasView.vue') },
      { path: 'usuarios', name: 'usuarios', component: () => import('@/views/UsuariosView.vue') },
      { path: 'auditores', name: 'auditores', component: () => import('@/views/AuditoresView.vue') },
      { path: 'indicadores', name: 'indicadores', component: () => import('@/views/IndicadoresView.vue') },
      { path: 'tipo-indicador', name: 'tipoIndicador', component: () => import('@/views/TipoIndicadorView.vue') },
      { path: 'unidad-medida', name: 'unidadMedida', component: () => import('@/views/UnidadMedidaView.vue') },
      { path: 'acciones-correctivas', name: 'accionesCorrectivas', component: () => import('@/views/AccionesCorrectivas.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (auth.autenticado && !auth.perfilCargado && !auth.usuario?.debe_cambiar_password) {
    await auth.refrescarPerfil();
  }

  if (to.meta.requiereAuth && !auth.autenticado) return { name: 'login' };
  if (auth.autenticado && auth.usuario?.debe_cambiar_password && to.name !== 'cambiarPassword') {
    return { name: 'cambiarPassword' };
  }
  if (to.name === 'cambiarPassword' && !auth.usuario?.debe_cambiar_password) return { name: 'dashboard' };
  if (to.name === 'login' && auth.autenticado) return { name: 'dashboard' };

  if (to.meta.requiereAuth && auth.autenticado && to.name !== 'cambiarPassword') {
    if (!puedeAcceder(auth.usuario, to.name)) {
      return { name: 'dashboard' };
    }
  }
});

export default router;
