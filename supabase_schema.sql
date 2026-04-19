-- ==========================================
-- SCRIPT DE BASE DE DATOS PARA ECOGUÍA SOS
-- Ejecuta este código en el SQL Editor de tu Dashboard de Supabase
-- ==========================================

-- 1. Tabla de Favoritos (Eventos y Lugares)
CREATE TABLE IF NOT EXISTS public.favoritos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID NOT NULL,
    item_tipo TEXT CHECK (item_tipo IN ('evento', 'lugar')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, item_id, item_tipo)
);

-- Habilitar RLS para Favoritos
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Favoritos)
CREATE POLICY "Usuarios pueden ver sus propios favoritos"
ON public.favoritos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar sus propios favoritos"
ON public.favoritos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar sus propios favoritos"
ON public.favoritos FOR DELETE
USING (auth.uid() = user_id);


-- 2. Tabla de Seguimientos de Actores
CREATE TABLE IF NOT EXISTS public.seguimientos_actores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, actor_id)
);

-- Habilitar RLS para Seguimientos
ALTER TABLE public.seguimientos_actores ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Seguimientos)
CREATE POLICY "Usuarios pueden ver a quién siguen"
ON public.seguimientos_actores FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden seguir actores"
ON public.seguimientos_actores FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden dejar de seguir actores"
ON public.seguimientos_actores FOR DELETE
USING (auth.uid() = user_id);

-- 3. Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_favoritos_user ON public.favoritos(user_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_user ON public.seguimientos_actores(user_id);
