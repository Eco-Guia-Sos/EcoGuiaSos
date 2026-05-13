# 📄 Inventario de Páginas HTML

Este documento detalla todas las pantallas de **EcoGuía SOS**, su propósito principal, las hojas de estilo que las controlan y el archivo JavaScript que actúa como su controlador.

---

## 📂 Páginas Principales (Raíz)

### `index.html`
* **Propósito:** Página de aterrizaje principal (Home / Landing). Muestra el Hero de bienvenida, el buscador por proximidad (radar) y los accesos rápidos a todas las categorías del sistema.
* **Estilos CSS:** `global.css`, `style.css`.
* **Controlador JS:** `assets/js/pages/index.js` (Cargado como módulo estándar si requiere lógica modular, o script clásico en conjunto con `ui-utils.js`).

### `como-usar.html`
* **Propósito:** Centro de Ayuda y selección de perfil para tutoriales. Permite al usuario elegir si es **Visitante/Voluntario** o **Organización/Actor Oficial** para ver guías personalizadas.
* **Estilos CSS:** `global.css`, `guia.css`.
* **Controlador JS:** `assets/js/pages/como-usar.js` **[CRÍTICO: Cargado con `type="module"`]**.

### `auth.html`
* **Propósito:** Gestión de autenticación. Contiene pestañas dinámicas para **Iniciar Sesión** y **Registro** de nuevas cuentas.
* **Estilos CSS:** `global.css`, `auth.css`.
* **Controlador JS:** `assets/js/auth-handler.js`.

### `admin.html`
* **Propósito:** Panel de control centralizado para que los actores oficiales publiquen eventos, suban imágenes y gestionen sus proyectos.
* **Estilos CSS:** `global.css`, `admin.css`.
* **Controlador JS:** `assets/js/pages/admin.js` (Aplica filtros de seguridad y expulsa a la raíz a usuarios sin permisos).

### `mapa.html`
* **Propósito:** Visor geoespacial a pantalla completa para explorar iniciativas e incidencias sobre Google Maps.
* **Estilos CSS:** `global.css`, `calendar.css`, `style.css`.
* **Controlador JS:** `assets/js/pages/mapa.js`.

---

## 📂 Páginas Interiores (`/pages/`)

### Guías y Tutoriales Específicos
Ambas páginas cargan el controlador `como-usar.js` como módulo ES para inicializar su interactividad y menús.
* **`guia-usuario.html`**: Tutoriales en video y texto para el rol de Visitante/Voluntario (Usa `guia.css`).
* **`guia-actor.html`**: Tutoriales enfocados en gestión institucional para Organizaciones (Usa `guia.css`).

### Listados y Catálogos Generales
Todas estas vistas comparten el layout de `interior-pages.css` y usan `global.css` para el pie y cabecera.
* **`agentes.html`**: Directorio de organizaciones y actores registrados (`agentes.js`).
* **`eventos.html`**: Agenda comunitaria de actividades y recolecciones (`index.js` / `detalles.js`).
* **`lugares.html`**: Puntos de acopio, reservas y centros ecológicos.
* **`voluntariados.html`**: Oportunidades de participación ciudadana directa en campo.
* **`cursos.html`**: Oferta educativa y talleres de capacitación (`cursos.js`).
* **`ecotecnias.html`**, **`agua.html`**, **`firmas.html`**, **`fondos.html`**, **`normativa.html`**, **`lecturas.html`**, **`documentales.html`**, **`convocatoria.html`**: Catálogos de consulta y recursos informativos.

### Vistas Personalizadas
* **`agente-detalle.html`**: Página de perfil público de una organización específica. Muestra su información de contacto, galería y eventos asociados (`agente-detalle.js`).
* **`mis-favoritos.html`**: Panel de usuario final donde se visualizan los eventos y organizaciones guardados con la estrella de favoritos (`mis-favoritos.js`).
* **`nosotros.html`**: Página estática institucional sobre la misión, visión y equipo de EcoGuía SOS (`interior-pages.css`).
* **`reset-password.html`**: Flujo seguro para la recuperación de cuentas olvidadas.
