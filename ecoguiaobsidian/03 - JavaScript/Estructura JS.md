# ⚙️ Estructura JavaScript y Patrones de Conexión

El frontend de **EcoGuía SOS** está construido exclusivamente con **JavaScript Vanilla Modular (ES6)** conectado directamente a Supabase. 

Para garantizar que la autenticación, los menús de navegación y las notificaciones funcionen correctamente en cualquier vista nueva o existente, debes seguir estrictamente los patrones descritos a continuación.

---

## 🧠 Núcleo Global (Core JS)
Estos archivos residen en `/assets/js/` y proveen las herramientas indispensables de la plataforma.

### `supabase.js`
* **Rol:** Inicializa el cliente oficial de conexión (`supabase-js`) inyectando las credenciales almacenadas en `.env`.
* **Exporta:** El objeto `supabase` listo para realizar consultas a las tablas.

### `ui-utils.js`
**[EL ARCHIVO MÁS IMPORTANTE DEL FRONTEND]**
Centraliza toda la manipulación del DOM compartida entre páginas:
* **`setupNavbar()`:** Asigna los eventos de apertura y cierre al botón de hamburguesa en dispositivos móviles y sincroniza iconos (FontAwesome/Lucide).
* **`setupAuthObserver()`:** Escucha los cambios de sesión en Supabase para alternar dinámicamente los botones de la barra superior (ej. ocultar "Súmate" y mostrar el Avatar del usuario).
* **`showNotification(msg, type)`:** Despliega alertas flotantes estilizadas en pantalla.
* **`updateAuthUI(session)`:** Lógica interna que re-dibuja los enlaces según los permisos del actor.

### `auth-handler.js` & `dynamic-section-handler.js`
* El primero procesa de forma exclusiva los envíos de formularios en `auth.html`.
* El segundo consulta la base de datos para pintar dinámicamente secciones o botones autorizados en las vistas.

---

## 📄 Controladores de Página (`/assets/js/pages/`)
Cada vista HTML principal tiene un script dedicado que maneja su ciclo de vida y eventos específicos.
* **`admin.js`**: Valida permisos, procesa subida de imágenes hacia Supabase Storage y escribe registros de eventos.
* **`index.js`**: Controla el filtrado del home y la interactividad del mapa de proximidad.
* **`detalles.js`**: Lógica de modales que abre detalles al hacer clic sobre tarjetas.
* **`como-usar.js`**: **[NUEVO]** Orquesta las animaciones de entrada en cascada (staggered fade-in) y atajos de las guías de ayuda.

---

## 🚨 Patrón Obligatorio para Nuevas Páginas (ES Modules)

Si creas una nueva página HTML o refactorizas una existente, **DEBES** seguir este flujo para no romper la navegación ni la seguridad:

### 1. Declaración en el HTML
Los scripts que consumen funciones de `ui-utils.js` o `supabase.js` deben cargarse **siempre** como módulos usando el atributo `type="module"`:
```html
<!-- CORRECTO -->
<script type="module" src="./assets/js/supabase.js"></script>
<script type="module" src="./assets/js/ui-utils.js"></script>
<script type="module" src="./assets/js/pages/mi-nueva-pagina.js"></script>
```

### 2. Inicialización a Prueba de Condiciones de Carrera (Race Conditions)
Como los módulos ES se ejecutan en segundo plano (diferidos), en servidores locales rápidos el HTML puede terminar de dibujarse antes de que el script escuche el evento `DOMContentLoaded`. 
> **Solución obligatoria:** Al final de tu archivo `.js`, verifica el estado de `document.readyState` para asegurar que las utilidades globales se ejecuten sin importar la velocidad de carga:

```javascript
// archivo: /assets/js/pages/mi-nueva-pagina.js
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initMiPagina() {
    // 1. Inicializar siempre el menú móvil y la sesión global
    setupNavbar();
    setupAuthObserver();

    // 2. Tu lógica personalizada aquí...
    console.log("Página cargada correctamente");
}

// [PATRÓN OBLIGATORIO] Previene bloqueos si el DOM ya cargó previamente
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMiPagina);
} else {
    initMiPagina();
}
```

### Advertencia sobre Rutas Relativas en Imports
* Si tu archivo JS vive en `/assets/js/pages/` y necesitas importar utilidades de la carpeta padre, la ruta de importación en JS **siempre será `../ui-utils.js`** sin importar si el HTML que invoca al script vive en la raíz o en una subcarpeta. El navegador resuelve la ruta basándose en la ubicación del script `.js`, no del `.html`.
