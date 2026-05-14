# Plan de Implementación: Soporte Responsive Multi-Formato en el Slider Principal

## Objetivo
Permitir a los administradores elegir entre subir una **imagen general única** o activar el modo **Responsive Avanzado** para proveer archivos independientes optimizados para resoluciones de Escritorio (PC), Tablet y Móvil, replicando y escalando la experiencia visual de la portada original animada.

---

## Fases de Implementación

### Fase 1: Actualización del Esquema de Base de Datos
Añadir soporte para fuentes secundarias en la tabla `carrusel_principal` sin romper los registros actuales.
*   **Nuevas Columnas Opcionales:**
    *   `imagen_pc_url` (TEXT, Nullable): Imagen/GIF optimizado para pantallas grandes (min-width: 1024px).
    *   `imagen_tablet_url` (TEXT, Nullable): Imagen/GIF optimizado para pantallas intermedias (min-width: 768px).
*   **Regla de compatibilidad:** Si estos campos están vacíos, el sistema asume que `imagen_url` es la imagen global para todos los dispositivos.

---

### Fase 2: Interfaz del Panel de Administración (`admin.html` & `admin.js`)
*   **Control de Modo Visual:** Agregar un interruptor/casilla en el modal `#modal-nuevo-slide` llamado:
    👉 *"Modo Multi-Formato (Imágenes dedicadas para PC, Tablet y Móvil)"*
*   **Comportamiento Dinámico UI:**
    *   **Modo Desactivado (Por defecto):** Muestra el formulario actual con un solo campo de subida de imagen general.
    *   **Modo Activado:** Despliega tres bloques de subida/previsualización claramente identificados con iconos:
        1. 💻 **Formato PC / Escritorio** (Asignado a `imagen_pc_url`).
        2. 📱 **Formato Tablet** (Asignado a `imagen_tablet_url`).
        3. 📱 **Formato Teléfono / Móvil** (Asignado al campo base `imagen_url`).
*   **Ajuste del CRUD:** Actualizar los endpoints de guardado (`insert`/`update`) y la función `editarSlideAdmin` para mapear y persistir estos tres formatos en Supabase.

---

### Fase 3: Renderizado Frontend Dinámico con `<picture>` (`index.js`)
Modificar la función `iniciarCarrusel()` en el cliente para que evalúe de forma inteligente la presencia de imágenes secundarias:
*   **Si la diapositiva tiene formato PC o Tablet definido:**
    Inyectar la estructura semántica completa con `<picture>` y `<source>`:
    ```html
    <picture class="hero-picture-full">
        <!-- Fuente para Escritorio -->
        <source srcset="[imagen_pc_url]" media="(min-width: 1024px)">
        <!-- Fuente para Tablet -->
        <source srcset="[imagen_tablet_url]" media="(min-width: 768px)">
        <!-- Imagen por defecto / Móvil -->
        <img src="[imagen_url]" alt="..." class="slide-bg" loading="lazy">
    </picture>
    ```
*   **Si es una sola imagen:**
    Mantener la etiqueta de imagen única actual:
    ```html
    <img src="[imagen_url]" alt="..." class="slide-bg" loading="lazy">
    ```

---

## Verificación y Criterios de Aceptación
1.  **Compatibilidad hacia atrás:** Las diapositivas existentes con una sola imagen deben seguir mostrándose correctamente sin alteraciones.
2.  **Responsividad en Tiempo Real:** Al cambiar el tamaño de la ventana del navegador (o usar DevTools en emulación móvil/tablet/PC), el navegador debe alternar limpiamente entre las 3 imágenes o GIFs proveídos.
3.  **Experiencia de Usuario en el Admin:** La transición entre el modo simple (1 imagen) y el modo avanzado (3 imágenes) debe ser fluida y visualmente intuitiva.
