# 🏗️ Estructura del Proyecto

Esta es la organización física de las carpetas y archivos en el repositorio de **EcoGuía SOS**. Conocer esta jerarquía te permitirá ubicar de inmediato dónde vive la capa de presentación (HTML/CSS), la capa de lógica (JS) y la capa de datos (Supabase).

---

## 📂 Raíz del Proyecto
Archivos principales de entrada al sistema y configuración:
* `index.html` → Página de inicio (Landing / Home).
* `como-usar.html` → **[NUEVO]** Portal principal de tutoriales y selección de rol.
* `auth.html` → Pantalla centralizada de inicio de sesión y registro.
* `admin.html` → Panel de administración exclusivo para actores oficiales.
* `mapa.html` → Visor geográfico a pantalla completa.
* `sw.js` → Service Worker para gestión de caché y soporte PWA offline.
* `manifest.json` → Manifiesto de la aplicación web progresiva (Iconos y colores PWA).
* `package.json` / `vite.config.js` → Dependencias de Node y configuración del servidor local (`npm run dev`).
* `.env` → Variables de entorno locales (Contiene las credenciales de conexión a Supabase).

---

## 📂 `/pages/`
Contiene todas las **pantallas secundarias e interiores** del sitio.
* `guia-usuario.html` y `guia-actor.html` → **[NUEVO]** Vistas de tutoriales detallados según el rol elegido.
* `agentes.html`, `eventos.html`, `lugares.html`, `voluntariados.html` → Listados y catálogos de consulta.
* `agente-detalle.html` → Perfil público de una organización con su información y eventos.
* `mis-favoritos.html` → Panel privado del usuario con sus elementos guardados.
* `nosotros.html` → Página institucional sobre la misión de EcoGuía SOS.
* `reset-password.html` → Formulario de recuperación de contraseña.

---

## 📂 `/assets/`
Almacena todos los recursos visuales y la lógica de programación del cliente.

### `/assets/css/`
Hojas de estilo modulares:
* `global.css` → Estilos base, barra de navegación, footer estándar y utilidades visuales.
* `style.css` → Maquetación exclusiva del home/landing principal.
* `interior-pages.css` → Estilos compartidos para listados y vistas secundarias.
* **`guia.css`** → **[NUEVO]** Estilos independientes y de alta fidelidad para el módulo "Cómo Usar" y su pie de página Premium de 2 columnas.
* `admin.css` / `auth.css` → Estilos para gestión y autenticación.

### `/assets/img/`
Activos estáticos:
* Logotipos e identidades (`logo-app.webp`, `logo-navbar.webp`).
* Animaciones y explicativos (`logmov.gif`, `pc.gif`, `tablet.gif`, `fon.gif`).
* Iconografía complementaria (`world.png`, `book.png`, `engrane.png`).

### `/assets/js/`
**Cerebro del Frontend.** Aquí se centraliza la comunicación con la base de datos y la interactividad.
* `supabase.js` → Inicializa el cliente de conexión.
* `ui-utils.js` → Librería central de interfaz (Navbar, observador de sesión, notificaciones, menús).
* `auth-handler.js` → Procesamiento de formularios de login y registro.
* `dynamic-section-handler.js` → Generación dinámica de secciones desde la base de datos.

#### `/assets/js/pages/`
Controladores enlazados a vistas específicas:
* `como-usar.js` → **[NUEVO]** Lógica modular para las guías de ayuda y animaciones de entrada.
* `admin.js` → Gestión completa del panel de control y validación de roles.
* `index.js` → Funciones del home (Carga de eventos destacados y cálculo de radio en el radar).
* `detalles.js` → Lógica de apertura de ventanas modales de información.

#### `/assets/js/config/` & `/assets/js/services/`
* `regions-mx.js` → Catálogos estáticos de estados y municipios.
* `territory-service.js` → Servicios para la consulta de divisiones territoriales.

---

## 📂 `/supabase/`
Infraestructura como Código (IaC) para la base de datos.
* `/migrations/` → Historial de archivos `.sql` que definen tablas, políticas de seguridad (RLS), funciones espaciales y secciones dinámicas en la nube.

---

## 📂 `/ecoguiaobsidian/`
**[NUEVO]** Bóveda de documentación técnica en formato Markdown para consulta rápida del equipo de desarrollo en Obsidian.
