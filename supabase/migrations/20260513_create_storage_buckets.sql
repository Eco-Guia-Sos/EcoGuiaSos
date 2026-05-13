-- EcoGuía SOS: Migración para Crear Buckets de Storage
-- Fecha: 2026-05-13

-- 1. Crear Buckets en Supabase Storage
-- Insertamos los buckets necesarios para nuestra plataforma.
-- ON CONFLICT nos asegura de que si ya existen, solo se actualicen sus propiedades.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, '{"image/jpeg","image/png","image/webp","image/gif"}'), -- 5MB límite
  ('imagenes_eventos', 'imagenes_eventos', true, 10485760, '{"image/jpeg","image/png","image/webp","image/gif"}'), -- 10MB límite
  ('contenido_secciones', 'contenido_secciones', true, 10485760, '{"image/jpeg","image/png","image/webp","image/gif"}') -- 10MB límite
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Limpieza de políticas anteriores (por si se vuelve a correr la migración)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Avatar viewable by everyone" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
    
    DROP POLICY IF EXISTS "Event images viewable by everyone" ON storage.objects;
    DROP POLICY IF EXISTS "Auth users can upload event images" ON storage.objects;
    DROP POLICY IF EXISTS "Auth users can manage event images" ON storage.objects;
    DROP POLICY IF EXISTS "Auth users can delete event images" ON storage.objects;
    
    DROP POLICY IF EXISTS "Section content viewable by everyone" ON storage.objects;
    DROP POLICY IF EXISTS "Auth users can upload section images" ON storage.objects;
    DROP POLICY IF EXISTS "Auth users can update section images" ON storage.objects;
    DROP POLICY IF EXISTS "Auth users can delete section images" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- 3. Crear Políticas de Seguridad (RLS) para storage.objects

-- ==========================================
-- BUCKET: avatars (Fotos de Perfil)
-- ==========================================
-- Todo el mundo puede ver las fotos de perfil
CREATE POLICY "Avatar viewable by everyone" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

-- Solo usuarios logueados pueden subir, actualizar o borrar
CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own avatar" ON storage.objects
    FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- ==========================================
-- BUCKET: imagenes_eventos (Banners, fotos de lugares/eventos)
-- ==========================================
CREATE POLICY "Event images viewable by everyone" ON storage.objects
    FOR SELECT USING (bucket_id = 'imagenes_eventos');

CREATE POLICY "Auth users can upload event images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'imagenes_eventos' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can manage event images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'imagenes_eventos' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete event images" ON storage.objects
    FOR DELETE USING (bucket_id = 'imagenes_eventos' AND auth.role() = 'authenticated');

-- ==========================================
-- BUCKET: contenido_secciones (Imágenes para las páginas dinámicas)
-- ==========================================
CREATE POLICY "Section content viewable by everyone" ON storage.objects
    FOR SELECT USING (bucket_id = 'contenido_secciones');

-- Las páginas dinámicas son gestionadas por usuarios autenticados (admin/actores según tu DB)
CREATE POLICY "Auth users can upload section images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'contenido_secciones' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can update section images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'contenido_secciones' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete section images" ON storage.objects
    FOR DELETE USING (bucket_id = 'contenido_secciones' AND auth.role() = 'authenticated');
