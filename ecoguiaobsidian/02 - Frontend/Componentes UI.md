# 🧩 Componentes UI Reutilizables

El frontend de **EcoGuía SOS** se apoya en una serie de componentes visuales estandarizados que garantizan la consistencia a lo largo de toda la experiencia de usuario. 

Esta guía detalla dónde se define la estructura de cada componente, qué archivos los estilizan y cómo interactúan con la lógica del sistema.

---

## 🍔 Menú de Hamburguesa (Navegación Móvil)

### Estructura y Comportamiento
* **Definición HTML:** Presente de forma estática dentro de la etiqueta `<nav class="navbar">` en cada archivo `.html` del proyecto. Contiene un botón `.hamburger-menu` y una lista de enlaces `.nav-menu`.
* **Estilos CSS:** Controlado exclusivamente por **`global.css`**. En pantallas de escritorio, los enlaces se distribuyen horizontalmente; en resoluciones móviles/tablets, se ocultan y adoptan un diseño de panel desplegable absoluto.
* **Activador JS:** Función `setupNavbar()` en `ui-utils.js`. Al hacer clic en el botón, alterna la clase `.active` en el contenedor `.nav-menu` e intercambia dinámicamente el icono (de barras a "X").

### Advertencia de Implementación
Si una página no inicializa `setupNavbar()` (por falta de importación o fallas en el oyente del DOM), el botón de hamburguesa **no responderá al clic**.

---

## 🏛️ Footers (Pies de Página)

El sitio utiliza dos variantes arquitectónicas de pie de página según el contexto de la vista:

### 1. Footer Estándar Global
* **Uso:** Presente en catálogos e información institucional (`nosotros.html`, `agentes.html`, etc.).
* **Estilos CSS:** `global.css`. 
* **Diseño:** Distribuye múltiples columnas de enlaces internos orientados a la exploración general.

### 2. Footer Premium Minimalista (2 Columnas)
* **Uso:** Diseñado en exclusiva para el módulo de tutoriales (`como-usar.html`, `guia-usuario.html`, `guia-actor.html`).
* **Estilos CSS:** **`guia.css`** (Sobrescribe limpiamente los selectores globales).
* **Diseño:** Basado en **Flexbox**. Muestra únicamente la marca/misión a la izquierda y enlaces de redes sociales con efectos hover de alta fidelidad a la derecha, eliminando el ruido visual para enfocar al usuario en el aprendizaje.

---

## 🔔 Notificaciones Flotantes (Toasts)

### Estructura y Comportamiento
* **Definición HTML:** Inyectado dinámicamente en el DOM bajo demanda. No requiere contenedores preexistentes en el HTML estático.
* **Estilos CSS:** `global.css` (Clase `.custom-notification` y modificadores de éxito/error).
* **Activador JS:** Función global `showNotification(message, type)` expuesta por `ui-utils.js`. Crea un elemento flotante en la esquina superior derecha con animaciones CSS de entrada y salida automática tras unos segundos.

---

## 👤 Dropdown de Usuario y Estado de Sesión

### Estructura y Comportamiento
* **Definición HTML:** Los botones de autenticación estáticos (`#nav-auth-btn`, `#nav-login-btn`) residen en el `<nav>` de cada página.
* **Activador JS:** Función `setupAuthObserver()` en conjunto con `updateAuthUI(session)` dentro de `ui-utils.js`.
* **Lógica Dinámica:** 
  1. Si no hay sesión, muestra los botones estándar de "Súmate" e "Iniciar sesión".
  2. Si el usuario ingresa exitosamente, la función oculta dichos botones e inyecta en su lugar un contenedor `.user-menu-container` que muestra el Avatar del usuario.
  3. Al hacer clic sobre el Avatar, despliega un submenú con opciones de perfil, acceso directo al **Panel de Administración** (sólo si su rol en base de datos es `'actor'` o `'admin'`) y el botón para cerrar sesión.
