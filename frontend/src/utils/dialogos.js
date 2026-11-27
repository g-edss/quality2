import { createVNode, render } from 'vue';
import ConfirmacionModal from '@/components/ConfirmacionModal.vue';

function abrirDialogo(opciones) {
  return new Promise(resolve => {
    const contenedor = document.createElement('div');
    const focoAnterior = document.activeElement;
    let cerrado = false;
    document.body.appendChild(contenedor);

    function cerrar(confirmado) {
      if (cerrado) return;
      cerrado = true;
      render(null, contenedor);
      contenedor.remove();
      if (focoAnterior?.isConnected) focoAnterior.focus();
      resolve(confirmado);
    }

    render(createVNode(ConfirmacionModal, { ...opciones, onResolve: cerrar }), contenedor);
  });
}

export function confirmarAccion(opciones) {
  return abrirDialogo(opciones);
}

export function solicitarTexto(opciones) {
  return abrirDialogo({ ...opciones, modoTexto: true });
}
