-- EcoGuía SOS: Migración para Secciones Dinámicas y Permisos
-- Fecha: 2026-05-05

-- 1. Tabla para el contenido de las páginas (Agua, Cursos, Ecotecnias, etc.)
CREATE TABLE IF NOT EXISTS public.contenido_secciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seccion_id TEXT NOT NULL, -- 'agua', 'cursos', 'ecotecnias', etc.
    titulo TEXT NOT NULL,
    descripcion TEXT,
    imagen_url TEXT,
    enlace_externo TEXT,
    estado TEXT DEFAULT 'publicado', -- 'borrador', 'publicado', 'archivado'
    autor_id UUID REFERENCES public.perfiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla para controlar qué actores pueden editar qué secciones
CREATE TABLE IF NOT EXISTS public.permisos_actores (
    actor_id UUID REFERENCES public.perfiles(id) PRIMARY KEY,
    puede_editar_agua BOOLEAN DEFAULT false,
    puede_editar_cursos BOOLEAN DEFAULT false,
    puede_editar_convocatoria BOOLEAN DEFAULT false,
    puede_editar_documentales BOOLEAN DEFAULT false,
    puede_editar_ecotecnias BOOLEAN DEFAULT false,
    puede_editar_firmas BOOLEAN DEFAULT false,
    puede_editar_fondos BOOLEAN DEFAULT false,
    puede_editar_lecturas BOOLEAN DEFAULT false,
    puede_editar_normativa BOOLEAN DEFAULT false,
    puede_editar_voluntariados BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar Seguridad (RLS)
ALTER TABLE public.contenido_secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos_actores ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad para Contenido
CREATE POLICY "Contenido público es visible por todos" 
    ON public.contenido_secciones FOR SELECT USING (estado = 'publicado');

CREATE POLICY "Admins y Actores autorizados pueden insertar" 
    ON public.contenido_secciones FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol IN ('admin', 'actor'))
    );

-- 5. Políticas para Permisos (Solo lectura pública, edición por Admin)
CREATE POLICY "Permisos son visibles por todos" 
    ON public.permisos_actores FOR SELECT USING (true);
