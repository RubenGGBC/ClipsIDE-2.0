import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    // Sin esto, importar una hoja de estilos en un test devuelve cadena
    // vacía y la guarda de la paleta pasaría sin mirar nada.
    css: { include: [/index\.css/] },
  },
});
