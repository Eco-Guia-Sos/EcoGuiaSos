# ⚙️ Estructura JavaScript

El frontend no usa frameworks pesados (como React o Vue). Todo se maneja con **JavaScript Vanilla** modular, conectado a Supabase.

## 🧠 Núcleo (Core)
Estos archivos están en `/assets/js/` y se cargan casi en todas las páginas.

- **`supabase.js`**: Inicia la conexión con la base de datos usando las llaves de `.env`.
- **`ui-utils.js`**: ¡El archivo más grande e importante!
  - Controla la autenticación (`updateAuthUI`).
  - Muestra las notificaciones flotantes (`showNotification`).
  - Renderiza los botones de "Súmate" o el menú de usuario.
- **`auth-handler.js`**: Solo se usa en `auth.html` para procesar registros y logins.
- **`dynamic-section-handler.js`**: Lee la base de datos para decidir qué botones del menú lateral dibujar.

## 📄 Controladores de Páginas
Están en `/assets/js/pages/`. Cada HTML tiene su propio script.

- **`index.js`**: Controla el radar (radio de proximidad) y carga los eventos destacados en la home.
- **`admin.js`**: El corazón del panel de control. 
  - Controla el formulario de subida de eventos.
  - Sube imágenes al Storage de Supabase.
  - Guarda los registros en las tablas.
- **`detalles.js`**: Lógica compartida. Cuando haces clic en un evento en cualquier página, este archivo dibuja el "Modal de Detalle", carga el mapa de Google y pinta el carrusel de imágenes.
