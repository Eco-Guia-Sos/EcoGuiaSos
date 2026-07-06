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

---

## 🔒 4. Anexo: Checklist Obligatorio de Seguridad (27 Chequeos)

Cualquier agente de IA o desarrollador debe auditar y validar estas directivas en su código antes de enviar cambios al repositorio.

### 4.1 Autenticación y Permisos
1. **RLS Activo:** RLS habilitado en todas las tablas de Supabase.
2. **Políticas RLS Específicas:** Prohibidas las reglas genéricas `USING (true)` para escrituras.
3. **Validación Criptográfica de JWT:** Validar las sesiones usando la API de Supabase en backend (`supabase.auth.getUser()`) y no solo decodificando localmente.
4. **Protección IDOR:** Filtrar siempre las consultas usando el identificador de usuario verificado (`.eq('user_id', user.id)`).
5. **Aislamiento BOLA:** Validar membresías en consultas de grupos o recursos colaborativos.
6. **Control de Roles:** Validar roles de administración directamente desde `app_metadata` en backend, no basándose en variables de la sesión frontend.
7. **Password Reset:** Mantener flujos de reseteo con respuestas de mensajería genéricas para evitar enumeración de cuentas.
8. **Expiración de Sesiones:** Mantener tokens efímeros autorrotativos en Supabase.
9. **Rutas protegidas:** Proteger accesos en `router/index.ts` a nivel de middleware.

### 4.2 Manejo de Secretos
10. **Sin Secretos Hardcodeados:** Prohibido escribir API keys (`sk_...`) de forma estática en el código.
11. **Variables de Frontend:** Solo variables con el prefijo `VITE_` público permitidas en cliente.
12. **Historial Limpio:** Garantizar la ausencia de claves en commits antiguos.
13. **Ignorar Entornos:** Exclusión absoluta de archivos `.env` en Git.
14. **Service Role Resguardado:** La clave `service_role` de Supabase es exclusiva de funciones seguras y nunca debe exponerse en el cliente.
15. **Rotación:** Las variables deben configurarse únicamente mediante Vercel Env Variables.

### 4.3 Validación de Input
16. **Prevención XSS:** Sanitizar cualquier entrada HTML a través del escape de Vue.
17. **Evitar SQL Injection:** Utilizar exclusivamente la API parametrizada de Supabase/PostgREST.
18. **SSRF:** Validar y mitigar accesos a localhost o IPs privadas en formularios de URLs externas.
19. **Esquemas Robustos:** Validar tipos, longitudes y formatos mediante esquemas (Zod) antes de procesar operaciones.

### 4.4 Infraestructura y Facturación
20. **CORS:** Accesos API restringidos a dominios oficiales.
21. **Cabeceras CSP:** Modificar las directivas `connect-src` e `img-src` en `vercel.json` cuando se integren servicios CDN o de imágenes.
22. **Rate Limiting:** Asegurar el control de spammers en APIs críticas de contacto o registro.
23. **Logs Seguros:** Prohibido imprimir contraseñas, hashes, claves o tokens en consola o reportes de error.
24. **Firma de Webhooks:** Verificar firmas de servicios de pago en APIs de backend (si aplica).
25. **Race Conditions:** Actualizar contadores o saldos mediante sentencias atómicas directamente en base de datos.
26. **Validación de Precios:** No confiar en precios suministrados por el frontend.
27. **Idempotencia:** Evitar peticiones duplicadas usando identificadores únicos de transacciones.

---

## 🎨 5. Estándares de Tarjetas Dinámicas (Hubs de Animales)

### 5.1 Estructura y Mapeo de Datos
* **Almacenamiento**: Todos los recursos dinámicos (Cursos, Ecotecnias, Agua, Lecturas, Documentales, Firmas, Eco-tecnología, Normativa, Fondos, Voluntariados, Convocatorias, Causas) se guardan en la tabla `contenido_secciones` con su respectivo `seccion_id`.
* **Mapeo de Relaciones**: No dependas de consultas relacionales directas de Supabase/PostgREST en la tabla `contenido_secciones` para obtener perfiles de autor (`perfiles`). Realiza un mapa manual en JavaScript en el frontend consultando los IDs de perfil únicos para evadir errores de cache relacional de Supabase.

### 5.2 Formato de Descripción y Resumen
* **Descripción Corta (Tarjeta)**: Toda tarjeta que muestre texto a la vista debe priorizar el campo `descripcion_corta` almacenado dentro de la columna JSON de `descripcion`.
* **Fallback**: Si `descripcion_corta` está ausente o vacío, se debe recortar la descripción larga automáticamente a los primeros 150 caracteres usando el helper `getBriefDescription`.
* **Aislamiento**: Las tarjetas de las secciones fijas **Eventos** (`eventos`) y **Lugares** (`lugares`) no deben ser modificadas, ya que tienen su propio formato estandarizado sin descripción a la vista.

