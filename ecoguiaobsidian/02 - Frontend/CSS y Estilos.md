# 🎨 CSS y Estilos — Guía de Localización

El diseño de EcoGuía SOS sigue una estructura modular para evitar que un solo archivo gigante controle todo el sitio. 

Para evitar realizar búsquedas manuales a ciegas por todo el proyecto, utiliza esta tabla como mapa de referencia definitivo para saber qué archivo editar según lo que necesites cambiar.

## 🗺️ Mapa de Localización de Estilos

| Elemento / Sección | Archivo CSS Responsable | Descripción y Alcance |
| :--- | :--- | :--- |
| **Navbar & Footer Global** | `global.css` | Contiene el diseño base de la barra superior, la estructura estándar de footers de páginas interiores y variables de color globales (Modo Oscuro, *glassmorphism*). |
| **Landing Principal (Home)** | `style.css` | Exclusivo para la estructura de `index.html`. Controla el Hero principal, la cuadrícula de categorías y el mapa de calor/radar de proximidad. |
| **Páginas Interiores** | `interior-pages.css` | Aplica a todos los catálogos en `/pages/` (`agentes.html`, `eventos.html`, etc.). Define las tarjetas de listado, modales y grillas de contenido secundario. |
| **Páginas de "Cómo Usar"** | **`guia.css`** | **[CRÍTICO]** Controla de forma aislada e independiente `como-usar.html`, `guia-usuario.html` y `guia-actor.html`. Define el pie de página Premium de 2 columnas y el diseño minimalista de tutoriales. |
| **Panel de Administración** | `admin.css` | Estilos para `admin.html` (formularios de carga, previsualización de imágenes, pestañas de gestión). |
| **Visor del Mapa** | `calendar.css` + `style.css` | Interfaz gráfica del mapa y los controles flotantes sobre él. |
| **Autenticación** | `auth.css` | Formularios de ingreso, registro y cambio de contraseña en `auth.html`. |

---

## ⚠️ Reglas de Oro y Advertencias Críticas

### 1. El Footer de las Páginas de Guía
Si necesitas cambiar colores, espaciados o el diseño del pie de página en los tutoriales (`como-usar.html` o sus subguías), **NO edites `global.css` ni `style.css`**. 
> **Solución:** Ve directamente a `assets/css/guia.css` bajo la sección comentada como `/* ========================================================================== FOOTER PREMIUM ========================================================================== */`.

### 2. Uso de Flexbox vs Grid
* El footer de las guías está refactorizado con **Flexbox** para asegurar simetría en 2 columnas en pantallas grandes y un apilamiento limpio en dispositivos móviles.
* Evita inyectar reglas con `grid-template-columns` en el footer premium para prevenir desbordamientos o solapamientos en resoluciones de tablet.

### 3. Efecto Vidrio (Glassmorphism)
El estilo translúcido se aplica con la clase `.glass-effect` definida en `global.css`. Si necesitas ajustar el desenfoque (`backdrop-filter`) o la opacidad del fondo, hazlo centralizado ahí para que se propague a todas las vistas.
