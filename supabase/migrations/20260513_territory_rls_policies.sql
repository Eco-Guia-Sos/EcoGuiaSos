-- ====================================================================
-- POLÍTICAS DE ACCESO PÚBLICO PARA CAPAS TERRITORIALES Y TERRITORIOS
-- ====================================================================
-- Permite que cualquier usuario (incluso sin haber iniciado sesión) 
-- pueda consultar el atlas territorial (estados y municipios) 
-- a través de la API REST del cliente Supabase en el frontend.

-- 1. Habilitar RLS explícitamente
ALTER TABLE public.territory_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de lectura pública (Cualquiera puede consultar el catálogo)
DROP POLICY IF EXISTS "Lectura pública de capas territoriales" ON public.territory_layers;
CREATE POLICY "Lectura pública de capas territoriales" 
ON public.territory_layers FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Lectura pública de territorios" ON public.territories;
CREATE POLICY "Lectura pública de territorios" 
ON public.territories FOR SELECT 
USING (true);

-- 3. Políticas de escritura (Solo administradores o roles de servicio pueden insertar/modificar)
-- (La llave de servicio role de Supabase sobrepasa RLS automáticamente, 
-- pero añadimos políticas de seguridad como buena práctica).
