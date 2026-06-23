-- ============================================================
-- 📸 MIGRACIÓN 002: AGREGAR SOPORTE PARA DRIVE DE FOTOGRAFÍAS
-- ECOGUÍA SOS
-- ============================================================

ALTER TABLE public.eventos 
ADD COLUMN IF NOT EXISTS drive_fotos_url TEXT,
ADD COLUMN IF NOT EXISTS clave_fotos TEXT;
