# 🗄️ Base de Datos (Supabase)

La base de datos actual vive en Supabase (PostgreSQL).

## 📊 Tablas Principales

### 1. `perfiles`
Guarda a todos los usuarios del sistema.
- `id` (UUID): Conectado con `auth.users`.
- `rol`: `voluntario`, `actor` o `admin`.
- `nombre_completo`, `avatar_url`.

### 2. `eventos`
Las actividades y publicaciones.
- `id`, `titulo`, `descripcion`, `categoria`.
- **`imagenes` (TEXT[])**: Arreglo que guarda múltiples URLs de imágenes para el carrusel. *(Antes era `imagen_url`)*.
- `latitud`, `longitud`: Para dibujarlo en el mapa.

### 3. `seguimientos_actores`
Sistema de Followers.
- `seguidor_id`: Quién sigue.
- `actor_id`: A quién sigue.

### 4. `favoritos`
Lo que los usuarios guardan.
- `usuario_id`
- `tipo_item`: 'evento', 'lugar', 'curso', etc.
- `item_id`.

### 5. `secciones_dinamicas`
Controla si se muestran o no ciertas secciones en el menú.
- `id`, `nombre`, `icono`, `ruta`, `activo`.

## 🔒 Seguridad (RLS - Row Level Security)
Supabase bloquea las lecturas por defecto. Hemos configurado políticas (Policies) para que:
- Cualquiera pueda LEER (SELECT) los eventos.
- Solo los dueños o Admins puedan EDITAR (UPDATE/DELETE).
