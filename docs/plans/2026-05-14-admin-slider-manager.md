# Admin Slider Manager Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implementar un gestor completamente dinámico en el Panel de Administración para el Carrusel Principal (Slider) de la página de inicio, permitiendo crear, editar, reordenar y eliminar diapositivas (con o sin botones/enlaces), con persistencia en Supabase y renderizado dinámico en el frontend.

**Architecture:** 
- **Base de Datos:** Nueva tabla `carrusel_principal` en Supabase con políticas RLS (lectura pública, escritura protegida). Se insertarán por defecto los 3 slides existentes para mantener la continuidad.
- **Backend/Admin UI:** Integración de la vista y modal en `admin.html`, y manejo CRUD + subida de imágenes a Supabase Storage en `assets/js/pages/admin.js`.
- **Frontend Principal:** Consumo dinámico desde `index.html` y `assets/js/pages/main.js` para popular el carrusel de Swiper.js antes de su inicialización.

**Tech Stack:** MapLibre GL, Supabase JS, Vanilla JS, Swiper.js, CSS global.

---

### Task 1: Supabase Database Schema & Initial Seed

**Files:**
- Create: `supabase/migrations/20260514_create_carrusel_principal.sql`

**Step 1: Write the SQL migration script**

```sql
-- Crear tabla para el carrusel principal
CREATE TABLE IF NOT EXISTS public.carrusel_principal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT,
    subtitulo TEXT,
    badge TEXT,
    imagen_url TEXT NOT NULL,
    enlace_url TEXT,
    btn_texto TEXT,
    sin_boton BOOLEAN DEFAULT false,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.carrusel_principal ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
CREATE POLICY "Lectura pública de slides activos" 
    ON public.carrusel_principal FOR SELECT 
    USING (true);

CREATE POLICY "Gestión total para administradores" 
    ON public.carrusel_principal FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Insertar los slides actuales como seed inicial para no romper la web
INSERT INTO public.carrusel_principal (titulo, subtitulo, badge, imagen_url, enlace_url, btn_texto, sin_boton, orden, activo)
VALUES 
    (NULL, NULL, NULL, './assets/img/fon.gif', NULL, NULL, true, 1, true),
    ('Fondo Semilla 2026', 'Aplica hoy para recibir financiamiento para tu proyecto ecoturístico.', 'DESTACADO', 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1000', NULL, 'Ver Detalles', false, 2, true),
    ('Envía tu nombre al espacio', 'Únete a la misión Landsat y registra tu nombre en la base de datos satelital de la NASA.', 'NASA LANDSAT', './assets/img/ecoguiasos_rios_2.png', 'https://science.nasa.gov/specials/your-name-in-landsat/', 'Registrarse en la NASA', false, 3, true);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260514_create_carrusel_principal.sql
git commit -m "feat(db): esquema y datos iniciales para la tabla carrusel_principal"
```

---

### Task 2: Admin Panel Layout & Modals

**Files:**
- Modify: `admin.html`

**Step 1: Add menu option to Sidebar**
Ubicar la lista de "Gestión Plataforma" en `admin.html` y agregar el nuevo enlace.

```html
                <li class="only-admin"><a href="#" data-view="slider">
                    <i data-lucide="images"></i> 
                    <span>Slider Principal</span>
                </a></li>
```

**Step 2: Add Slider View Container**
Insertar la vista `#slider-view` debajo de `#notificaciones-view` en `admin.html`.

```html
            <!-- VISTA: SLIDER PRINCIPAL -->
            <div id="slider-view" class="profile-view-container fade-in hidden">
                <div class="table-container glass-effect" style="padding: 24px;">
                    <div class="table-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <h2 style="color: white; font-size: 1.5rem; margin-bottom: 4px;">Diapositivas del Inicio</h2>
                            <p style="color: var(--admin-text-muted); font-size: 0.9rem;">Gestiona las imágenes, enlaces y textos del carrusel principal.</p>
                        </div>
                        <button class="btn-create-new" id="btn-nuevo-slide">
                            <i data-lucide="plus"></i> <span>Añadir Slide</span>
                        </button>
                    </div>
                    <div id="slider-list-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                        <div style="grid-column: span 100%; text-align: center; padding: 40px; color: var(--admin-text-muted);">Cargando diapositivas...</div>
                    </div>
                </div>
            </div>
```

**Step 3: Add Slider Modal**
Insertar el modal para creación/edición de diapositivas al final de `admin.html` (junto a los otros modales).

```html
    <!-- MODAL: SLIDER PRINCIPAL -->
    <div id="modal-nuevo-slide" class="modal-overlay hidden">
        <div class="modal-content glass-effect" style="max-width: 600px;">
            <div class="modal-header">
                <h2 id="slide-modal-title">Añadir Diapositiva</h2>
                <button class="btn-close-modal" id="btn-close-slide"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <form id="form-nuevo-slide" style="padding: 25px;">
                <input type="hidden" id="sl-id">
                <div class="form-grid">
                    <div class="form-group full-width">
                        <label>Imagen de Fondo o Portada (*)</label>
                        <div class="image-upload-wrapper">
                            <input type="file" id="sl-imagen-file" accept="image/*" style="display: none;">
                            <button type="button" class="btn-admin" id="sl-btn-trigger-upload" style="width: 100%; margin-bottom: 10px;">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Seleccionar Imagen
                            </button>
                            <input type="text" id="sl-imagen-url" placeholder="URL de la imagen (local o externa)" required style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px;">
                            <div id="sl-image-preview" class="image-preview hidden" style="margin-top: 10px; text-align: center;">
                                <img id="sl-preview-img" src="" style="max-height: 140px; border-radius: 8px; object-fit: contain;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Etiqueta / Badge (Opcional)</label>
                        <input type="text" id="sl-badge" placeholder="Ej: DESTACADO, NASA LANDSAT" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px;">
                    </div>

                    <div class="form-group">
                        <label>Orden de aparición</label>
                        <input type="number" id="sl-orden" value="1" min="1" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px;">
                    </div>

                    <div class="form-group full-width">
                        <label>Título Principal (Opcional)</label>
                        <input type="text" id="sl-titulo" placeholder="Texto grande en la diapositiva" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px;">
                    </div>

                    <div class="form-group full-width">
                        <label>Subtítulo / Descripción (Opcional)</label>
                        <textarea id="sl-subtitulo" rows="2" placeholder="Texto descriptivo secundario" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px;"></textarea>
                    </div>

                    <div class="form-group full-width" style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--admin-border);">
                        <label class="perm-item" style="margin-bottom: 12px; display: flex; justify-content: space-between;">
                            <span style="color: var(--color-eco); font-weight: 600;">Ocultar botón (Imagen completa sin acción o clicable)</span>
                            <input type="checkbox" id="sl-sin-boton" style="width: 20px; height: 20px;">
                        </label>
                        
                        <div id="sl-boton-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                            <div>
                                <label style="font-size: 0.85rem;">Texto del Botón</label>
                                <input type="text" id="sl-btn-texto" placeholder="Ej: Ver Detalles" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 8px;">
                            </div>
                            <div>
                                <label style="font-size: 0.85rem;">URL de Enlace</label>
                                <input type="url" id="sl-enlace" placeholder="https://..." style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 8px;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label>Estado</label>
                        <select id="sl-activo" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px;">
                            <option value="true">Activo (Visible)</option>
                            <option value="false">Inactivo (Oculto)</option>
                        </select>
                    </div>
                </div>

                <div class="modal-footer" style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" id="btn-cancelar-slide">Cancelar</button>
                    <button type="submit" class="btn btn-primary" id="btn-guardar-slide">Guardar Slide</button>
                </div>
            </form>
        </div>
    </div>
```

**Step 4: Commit**

```bash
git add admin.html
git commit -m "feat(admin): interfaz y modal para la gestión del carrusel principal"
```

---

### Task 3: Admin JS Logic (CRUD & Storage)

**Files:**
- Modify: `assets/js/pages/admin.js`

**Step 1: Implement Navigation Logic**
En `admin.js`, localizar el listener del menú lateral (`document.querySelectorAll('.admin-menu a')`) e integrar el manejo de la vista `slider`. Ocultar los contenedores de otras vistas y mostrar `#slider-view` cuando corresponda. Recargar datos al entrar a la vista.

**Step 2: Implement Slide Rendering Logic**
Crear la función `loadSlidesAdmin()` que consulte `carrusel_principal` y dibuje las tarjetas en `#slider-list-grid`.

**Step 3: Implement Modal Handlers & Form Submission**
Conectar abrir/cerrar modal, trigger de input file, preview de imagen y el guardado/actualización (INSERT/UPDATE) hacia Supabase. Implementar el checkbox `sin-boton` para deshabilitar o ignorar dinámicamente los campos de botón si se activa.

**Step 4: Commit**

```bash
git add assets/js/pages/admin.js
git commit -m "feat(admin): lógica JS completa para CRUD y subida de imágenes de diapositivas"
```

---

### Task 4: Dynamic Frontend Rendering in Main Index

**Files:**
- Modify: `index.html`
- Modify: `assets/js/pages/main.js`

**Step 1: Clean up static slides in index.html**
Reemplazar el interior del `.swiper-wrapper` del carrusel principal por un contenedor dinámico.

```html
                <div class="swiper-wrapper" id="main-slider-wrapper">
                    <!-- Esqueleto de carga temporal -->
                    <div class="swiper-slide custom-slide" style="background: #0f172a;">
                        <div class="slide-content-overlay">
                            <div class="skeleton-line" style="width: 100px; height: 24px; margin-bottom: 10px;"></div>
                            <div class="skeleton-line" style="width: 70%; height: 40px; margin-bottom: 15px;"></div>
                        </div>
                    </div>
                </div>
```

**Step 2: Fetch and build slides dynamically in main.js**
Antes de inicializar Swiper en la portada, cargar los slides desde `carrusel_principal` donde `activo = true` ordenados por `orden`.

```javascript
// Renderizado de slides en frontend
async function initDynamicSlider() {
    const wrapper = document.getElementById('main-slider-wrapper');
    if (!wrapper) return;

    try {
        const { data: slides, error } = await supabaseClient
            .from('carrusel_principal')
            .select('*')
            .eq('activo', true)
            .order('orden', { ascending: true });

        if (error) throw error;

        if (slides && slides.length > 0) {
            wrapper.innerHTML = slides.map(sl => {
                const hasTextOverlay = sl.titulo || sl.subtitulo || sl.badge || (!sl.sin_boton && sl.btn_texto);
                const isClickableImage = sl.sin_boton && sl.enlace_url;
                
                let contentOverlay = '';
                if (hasTextOverlay) {
                    let btnHtml = '';
                    if (!sl.sin_boton && sl.btn_texto) {
                        const href = sl.enlace_url ? `href="${sl.enlace_url}" target="_blank"` : '';
                        const tag = sl.enlace_url ? 'a' : 'button';
                        btnHtml = `<${tag} ${href} class="btn btn-primary shimmer-btn" style="pointer-events: auto;">${sl.btn_texto}</${tag}>`;
                    }

                    contentOverlay = `
                        <div class="slide-content-overlay" style="${isClickableImage ? 'pointer-events: none;' : ''}">
                            ${sl.badge ? `<span class="slide-badge">${sl.badge}</span>` : ''}
                            ${sl.titulo ? `<h2>${sl.titulo}</h2>` : ''}
                            ${sl.subtitulo ? `<p>${sl.subtitulo}</p>` : ''}
                            ${btnHtml}
                        </div>
                    `;
                }

                const clickAttr = isClickableImage ? `style="cursor: pointer;" onclick="window.open('${sl.enlace_url}', '_blank')"` : '';
                const imgStyle = sl.imagen_url.includes('fon.gif') ? '' : 'object-fit: contain !important; opacity: 0.95; object-position: center;';

                return `
                    <div class="swiper-slide custom-slide" ${clickAttr}>
                        ${contentOverlay}
                        <img src="${sl.imagen_url}" alt="${sl.titulo || 'EcoGuía Slide'}" class="slide-bg" loading="lazy" style="${imgStyle}">
                        <div class="swiper-lazy-preloader swiper-lazy-preloader-white"></div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('[Slider] Error cargando diapositivas:', err);
    }
}
```

Asegurar que la función se invoque antes o en conjunto con la inicialización de `new Swiper(...)` para la portada.

**Step 3: Commit**

```bash
git add index.html assets/js/pages/main.js
git commit -m "feat(home): renderizado dinámico del carrusel principal basado en base de datos"
```

---

## Tracking and Validation

Para verificar y probar exhaustivamente en Localhost:
1. **Base de Datos:** Ejecutar la migración SQL en Supabase local/remoto o desde su panel SQL.
2. **Admin UI:** Iniciar sesión como administrador, ir a "Slider Principal", probar a subir una nueva imagen (o enlazar una externa), conmutar el checkbox "Sin botón", guardar y verificar que la lista se actualiza instantáneamente.
3. **Página de Inicio:** Abrir `index.html` en localhost, corroborar que se cargan las diapositivas en el orden correcto y que los clics en botones/imágenes completas redirigen según lo configurado.

---
**Plan complete and saved to `docs/plans/2026-05-14-admin-slider-manager.md`.**
**Next step: run `.agent/workflows/execute-plan.md` to execute this plan task-by-task in single-flow mode.**
