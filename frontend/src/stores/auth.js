import { defineStore } from 'pinia';
import { api } from '@/api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    usuario: JSON.parse(localStorage.getItem('web360_user') || 'null'),
    token: localStorage.getItem('web360_token'),

    perfilCargado: false,
  }),

  getters: {
    autenticado: (state) => !!state.token,
  },

  actions: {
    async login(correo, password) {
      const { token, usuario } = await api.post('/auth/login', {
        correo,
        password,
      });

      this.token = token;
      this.usuario = usuario;
      this.perfilCargado = true;

      localStorage.setItem('web360_token', token);
      localStorage.setItem('web360_user', JSON.stringify(usuario));
    },

    async refrescarPerfil() {
      try {
        const perfil = await api.get('/usuarios/perfil');
        this.usuario = {
          ...this.usuario,
          nombre: perfil.nombre,
          rol: perfil.rol,
          rol_clave: perfil.rol_clave,
          permisos: perfil.permisos || [],
        };
        localStorage.setItem('web360_user', JSON.stringify(this.usuario));
      } catch {

      } finally {
        this.perfilCargado = true;
      }
    },

    completarCambioPassword() {
      this.usuario = { ...this.usuario, debe_cambiar_password: false };
      localStorage.setItem('web360_user', JSON.stringify(this.usuario));
    },

    logout() {
      this.token = null;
      this.usuario = null;
      this.perfilCargado = false;

      localStorage.removeItem('web360_token');
      localStorage.removeItem('web360_user');
    },
  },
});
