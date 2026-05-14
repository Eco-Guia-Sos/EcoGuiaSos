# Card Details Enhancement Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Enriquecer visualmente las tarjetas de la página principal y el panel de Mis Favoritos mostrando la fecha del evento, el actor responsable y calculando la distancia en tiempo real.

**Architecture:** Se inyectarán componentes visuales (badges/etiquetas) en las funciones de renderizado existentes (`renderCards`) de `index.js` y `mis-favoritos.js`. Para la distancia en Mis Favoritos, se reutilizará la lógica de cálculo de proximidad (Haversine) basándose en las coordenadas del dispositivo si están disponibles, o enriqueciendo las trazas desde Supabase.

**Tech Stack:** JavaScript ES6, Supabase JS SDK, HTML5/CSS nativo.

---

### Task 1: Enriquecer Tarjetas de la Página Principal (`index.js`)

**Files:**
- Modify: `assets/js/pages/index.js`

**Step 1: Inyectar el formato y renderizado de la fecha en renderCards**

Se añadirá una etiqueta estilizada (`date-badge`) sobre la imagen o el cuerpo de la tarjeta para mostrar el día y mes del evento.

```javascript
// Localizar la función renderCards en assets/js/pages/index.js
// Añadir el cálculo y renderizado condicional de la fecha junto a los demás badges:

        let dateBadge = '';
        if (p.fecha_inicio) {
            const d = new Date(p.fecha_inicio);
            // Evitar desajustes de zona horaria extrayendo formato local
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            const fTxt = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
            dateBadge = `<span class="date-badge" title="Fecha del evento" style="position:absolute; top:10px; left:10px; background:rgba(15,20,25,0.85); color:#5bc2f7; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; backdrop-filter:blur(5px); border:1px solid rgba(91,194,247,0.3); z-index:2;"><i class="fa-regular fa-calendar"></i> ${fTxt}</span>`;
        }

// Inyectarlo en la cadena del HTML de la tarjeta (card-image):
                <div class="card-image">
                    <img src="${p.imagen}" alt="${sanitize(p.nombre)}" onerror="this.src='/assets/img/kpop.webp'">
                    ${dateBadge}
                    ${distLabel}
                    ${eventosBadge}
                    ${actorBadge}
                    <div class="card-actions-overlay"></div>
                </div>
```

**Step 2: Verificar renderizado de página principal**

Run: `npm run dev` (visualizar en navegador que las tarjetas de eventos muestran la nueva etiqueta de fecha en la esquina superior izquierda).
Expected: PASS sin errores en consola.

---

### Task 2: Enriquecer Tarjetas de Mis Favoritos (`mis-favoritos.js`)

**Files:**
- Modify: `assets/js/pages/mis-favoritos.js`

**Step 1: Enriquecer la consulta a Supabase para obtener el nombre del actor**

Se actualizará la lectura de eventos y lugares para incluir los datos del perfil publicador mediante un `join` implícito de Supabase, o solicitando campos adicionales.

```javascript
// En loadFavorites de assets/js/pages/mis-favoritos.js:
// Cambiar el select básico por un select enriquecido que traiga el perfil del dueño si existe:
    if (eventIds.length > 0) {
        const { data: events } = await supabase
            .from('eventos')
            .select('*, perfiles!owner_id(nombre_completo)')
            .in('id', eventIds);
        renderCards(events, containers.eventos, 'evento');
    }
```

**Step 2: Incorporar el cálculo de distancia en vivo y fechas en la tarjeta de favoritos**

Se implementará una función auxiliar de cálculo de distancia (fórmula Haversine) que consuma la última ubicación guardada o intente leerla, y se inyectarán las etiquetas de fecha, actor y kilómetros en `renderCards` de favoritos.

```javascript
// Añadir la función de distancia Haversine y enriquecer renderCards en mis-favoritos.js:
function calcularDistanciaLocal(lat2, lon2) {
    // Intentar recuperar coordenadas globales si existen en la app
    const userCoordsStr = sessionStorage.getItem('eco_user_coords') || localStorage.getItem('eco_user_coords');
    if (!userCoordsStr || !lat2 || !lon2) return null;
    try {
        const coords = JSON.parse(userCoordsStr);
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - coords.lat) * Math.PI / 180;
        const dLon = (lon2 - coords.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(coords.lat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    } catch(e) { return null; }
}

// Actualizar renderCards para inyectar estos metadatos:
function renderCards(data, container, type) {
    container.innerHTML = '';
    data.forEach(p => {
        const detailPage = type === 'evento' ? 'eventos.html' : 'lugares.html';
        
        // Fecha formatada
        let fTxt = '';
        if (p.fecha_inicio) {
            const d = new Date(p.fecha_inicio);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            fTxt = `<span style="color:#5bc2f7; font-size:0.8rem; display:block; margin-bottom:5px;"><i class="fa-regular fa-calendar"></i> ${d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`;
        }

        // Nombre del actor
        const actorName = p.perfiles?.nombre_completo || p.actor_nombre || '';
        const actorHtml = actorName ? `<span style="color:#a7f3d0; font-size:0.8rem; display:block; margin-bottom:5px;"><i class="fa-solid fa-user-pen"></i> Por: ${sanitize(actorName)}</span>` : '';

        // Distancia
        const dist = calcularDistanciaLocal(p.lat, p.lng);
        const distHtml = dist !== null ? `<span style="color:#fde047; font-size:0.8rem; margin-left:10px;"><i class="fa-solid fa-route"></i> a ${dist.toFixed(1)} km</span>` : '';

        const html = `
            <article class="dash-card" onclick="window.location.href='/pages/${detailPage}?id=${p.id}'" style="cursor: pointer;">
                <div style="position:relative;">
                    <img src="${p.imagen_url || p.imagen || '/assets/img/kpop.webp'}" alt="${p.nombre}" class="dash-card-img" onerror="this.src='/assets/img/kpop.webp'">
                    <span class="badge-pill" style="position:absolute; top:10px; right:10px; background:var(--primary-color);">${type.toUpperCase()}</span>
                </div>
                <div class="dash-card-body">
                    <h3>${sanitize(p.nombre)}</h3>
                    ${fTxt}
                    ${actorHtml}
                    <p style="margin-bottom: 8px; font-size:0.85rem; color:#aaa;">${sanitize(p.categoria || 'General')}</p>
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="color: var(--primary-color); font-size: 0.85rem;"><i class="fa-solid fa-location-dot"></i> ${sanitize(p.alcaldia || 'CDMX')}</span>
                        ${distHtml}
                    </div>
                </div>
            </article>
        `;
        container.innerHTML += html;
    });
}
```

**Step 3: Commit de la funcionalidad**

```bash
git add assets/js/pages/index.js assets/js/pages/mis-favoritos.js
git commit -m "feat: show dates on home cards and enrich favorites with actor, date, and live distance"
```

---
