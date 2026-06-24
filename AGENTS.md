# 📖 Directrices de Desarrollo y Seguridad - EcoGuía SOS

Este documento establece las reglas obligatorias de arquitectura, desarrollo y seguridad para todo desarrollador o asistente de Inteligencia Artificial que trabaje en el repositorio de **EcoGuía SOS**.

---

## 🛡️ 1. Políticas de Seguridad Obligatorias

### 1.1 Row Level Security (RLS) en Base de Datos
* **Regla:** **Toda tabla nueva** en el esquema público de Supabase debe tener habilitado RLS (`ENABLE ROW LEVEL SECURITY`).
* **Políticas:** Las políticas de acceso no deben ser genéricas (`USING (true)` para todo). Se debe separar el acceso de lectura (`SELECT`) del acceso de escritura (`INSERT`, `UPDATE`, `DELETE`), validando siempre la identidad del usuario en el servidor:
  ```sql
  -- Ejemplo de política segura para inserción
  USING (auth.uid() = creador_id)
  WITH CHECK (auth.uid() = creador_id);
  ```
* **Protección de Datos Sensibles:** La tabla de sistema PostGIS `spatial_ref_sys` debe permanecer restringida para la API pública, permitiendo el acceso únicamente a los roles de sistema (`postgres` y `service_role`).

### 1.2 Validación de Roles y Permisos (No confiar en el Frontend)
* Las variables en `localStorage` (como `eco_user_role` o perfiles reactivos de Pinia) se utilizan **exclusivamente para mejorar la experiencia de usuario** (ocultar/mostrar botones).
* **Nunca** uses variables del cliente para autorizar escrituras en la base de datos. Toda validación de rol administrativo o de staff debe realizarse del lado del servidor (Supabase) validando la sesión activa y cruzándola con la tabla `perfiles` mediante políticas RLS robustas.

### 1.3 Content Security Policy (CSP) y Service Worker
* Las políticas CSP están centralizadas en `vercel.json` y `public/_headers`.
* Si la aplicación requiere conectarse a un nuevo dominio externo (ej. CDNs de imágenes o APIs externas), el dominio debe añadirse **tanto en `img-src` como en `connect-src`** dentro de las directivas CSP.
* El archivo `public/sw.js` debe mantener actualizados los patrones de bypass (`BYPASS_PATTERNS`) para los dominios CSP externos, garantizando que el Service Worker no intercepte llamadas REST críticas y cause bloqueos de seguridad.

---

## ⚡ 2. Directrices de Rendimiento y Frontend

### 2.1 Compresión y Optimización de Imágenes
* **Canvas Helper:** Todo formulario que permita la subida de imágenes a Supabase Storage (en el panel de administración, perfil, causas, eventos, etc.) debe utilizar la utilidad nativa de compresión por Canvas de HTML5 (`src/utils/imageCompressor.ts`).
* **Especificaciones:** Las imágenes deben escalarse de forma proporcional a un máximo de **1200px en su lado más largo** y exportarse como `image/jpeg` con calidad del **80%** antes de iniciar la subida. Esto limita el peso de las imágenes a un rango ideal de 150KB - 300KB.

### 2.2 Ciclo de Vida de los Datos (Purga de Eventos)
* Para evitar el sobre-fetching y la saturación del storage gratuito de 1GB de Supabase, los eventos y causas que tengan una fecha registrada y hayan finalizado con más de **2 meses (60 días) de antigüedad** deben ser eliminados de la base de datos de manera física.
* La eliminación de registros en la base de datos debe disparar la correspondiente remoción del archivo de imagen del bucket de Supabase Storage para no dejar archivos huérfanos.

---

## 🎨 3. Estética y Buenas Prácticas UI

* **Uso de Fallbacks de Marca:** Ningún elemento de la aplicación debe mostrar imágenes genéricas o ajenas al proyecto (como imágenes de K-Pop) cuando la carga falle o no exista archivo. Se debe utilizar la ruta del logotipo oficial: `/assets/img/logo-app.webp`.
* **Transiciones Fluidas:** Toda interacción de menús, enlaces desplegables o listados dinámicos debe contar con transiciones Bezier fluidas, micro-desplazamientos de cortesía y efectos de brillo (glow) temáticos acordes a la paleta de colores del nivel o sección activa.
