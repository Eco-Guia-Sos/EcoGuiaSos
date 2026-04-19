import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // Para Vercel y la mayoría de despliegues modernos, la raíz '/' es lo ideal.
    base: '/',
    server: {
      watch: {
        ignored: ['**/memory/**', '**/.agent/**', '**/.github/**', '**/node_modules/**']
      }
    },
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
          convocatoria: resolve(__dirname, 'pages/convocatoria.html'),
          'agente-detalle': resolve(__dirname, 'pages/agente-detalle.html'),
          'mis-favoritos': resolve(__dirname, 'pages/mis-favoritos.html'),
          eventos: resolve(__dirname, 'pages/eventos.html'),
          lugares: resolve(__dirname, 'pages/lugares.html'),
          'admin-login': resolve(__dirname, 'admin-login.html'),
          admin: resolve(__dirname, 'admin.html'),
          auth: resolve(__dirname, 'auth.html'),
          mapa: resolve(__dirname, 'mapa.html'),
        },
      },
    },
  };
});
