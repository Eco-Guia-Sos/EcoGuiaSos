# 🏗️ Estructura del Proyecto

Esta es la organización física de las carpetas en el explorador de archivos.

## 📂 Raíz del Proyecto
- `index.html` → Página de inicio (Landing).
- `auth.html` → Pantalla de inicio de sesión y registro.
- `admin.html` → Panel de control principal para publicar eventos.
- `mapa.html` → Visor geográfico.
- `sw.js` → Service Worker para caché y modo offline (PWA).
- `vite.config.js` → Configuración del servidor de desarrollo (npm run dev).
- `.env` → Variables de entorno (Claves de Supabase).

## 📂 `/pages/`
Contiene todas las **pantallas interiores**.
- `agentes.html`, `eventos.html`, `lugares.html` → Listados principales (Catálogos).
- `nosotros.html` → Información institucional y logotipos.
- `agente-detalle.html` → Perfil público de un actor/agente.
- `mis-favoritos.html` → Dashboard del usuario con lo que ha guardado.

## 📂 `/assets/`
Todos los recursos estáticos y lógicos.
- `/css/` → Hojas de estilo (`global.css`, `style.css`, `admin.css`).
- `/img/` → Imágenes, iconos, GIFs (`logo-app.webp`, `pc.gif`).
- `/js/` → **Cerebro del frontend**. Aquí vive toda la lógica de negocio.

## 📂 `/assets/js/pages/`
Cada página HTML tiene su archivo `.js` correspondiente aquí.
- `admin.js` → Toda la lógica del panel de control.
- `index.js` → Animaciones y carga del home.
- `detalles.js` → Lógica para abrir el modal de detalles de un evento.

## 📂 `/supabase/`
- `/migrations/` → Historial de cambios SQL que crean las tablas en la nube.

## 📂 `/scratch/`
- Directorio de borradores. Aquí guardamos scripts en Python o SQL antiguos que ya no se usan en producción pero no queremos borrar.
