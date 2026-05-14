-- EcoGuía SOS: Políticas RLS para Favoritos y Seguimientos de Actores
-- Fecha: 2026-05-14
-- Descripción: Permite a los usuarios normales (como actor3) leer y persistir sus favoritos y seguimientos en la base de datos.

-- 1. Asegurar que RLS esté activo
ALTER TABLE IF EXISTS public.favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seguimientos_actores ENABLE ROW LEVEL SECURITY;

-- 2. Limpieza de políticas previas para evitar duplicados
DO $$
BEGIN
    DROP POLICY IF EXISTS "Usuarios pueden ver sus propios favoritos" ON public.favoritos;
    DROP POLICY IF EXISTS "Usuarios pueden gestionar sus propios favoritos" ON public.favoritos;
    
    DROP POLICY IF EXISTS "Usuarios pueden ver a quién siguen" ON public.seguimientos_actores;
    DROP POLICY IF EXISTS "Usuarios pueden gestionar sus seguimientos" ON public.seguimientos_actores;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- 3. Crear Políticas para la tabla favoritos
-- Lectura: Solo el dueño del favorito puede verlo
CREATE POLICY "Usuarios pueden ver sus propios favoritos" 
ON public.favoritos FOR SELECT 
USING (auth.uid() = user_id);

-- Inserción/Edición/Borrado: Solo el dueño
CREATE POLICY "Usuarios pueden gestionar sus propios favoritos" 
ON public.favoritos FOR ALL 
USING (auth.uid() = user_id);

-- 4. Crear Políticas para la tabla seguimientos_actores
-- Lectura: Solo el usuario que sigue puede ver su lista
CREATE POLICY "Usuarios pueden ver a quién siguen" 
ON public.seguimientos_actores FOR SELECT 
USING (auth.uid() = user_id);

-- Gestión total: Solo el dueño del seguimiento
CREATE POLICY "Usuarios pueden gestionar sus seguimientos" 
ON public.seguimientos_actores FOR ALL 
USING (auth.uid() = user_id);
