import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ecoguiasos/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        agentes: resolve(__dirname, 'pages/agentes.html'),
        voluntariados: resolve(__dirname, 'pages/voluntariados.html'),
        cursos: resolve(__dirname, 'pages/cursos.html'),
        ecotecnias: resolve(__dirname, 'pages/ecotecnias.html'),
        fondos: resolve(__dirname, 'pages/fondos.html'),
        normativa: resolve(__dirname, 'pages/normativa.html'),
        agua: resolve(__dirname, 'pages/agua.html'),
        lecturas: resolve(__dirname, 'pages/lecturas.html'),
        documentales: resolve(__dirname, 'pages/documentales.html'),
        firmas: resolve(__dirname, 'pages/firmas.html'),
        nosotros: resolve(__dirname, 'pages/nosotros.html'),
      },
    },
  },
});
