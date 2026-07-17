-- Crear tabla para portadas de secciones
CREATE TABLE IF NOT EXISTS public.portadas_secciones (
    seccion_id TEXT PRIMARY KEY,
    imagen_url TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Habilitar RLS
ALTER TABLE public.portadas_secciones ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
DROP POLICY IF EXISTS "Permitir lectura publica de portadas" ON public.portadas_secciones;
CREATE POLICY "Permitir lectura publica de portadas" 
ON public.portadas_secciones 
FOR SELECT 
USING (true);

-- Política de escritura (solo admin)
DROP POLICY IF EXISTS "Permitir a los administradores modificar portadas" ON public.portadas_secciones;
CREATE POLICY "Permitir a los administradores modificar portadas" 
ON public.portadas_secciones 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE perfiles.id = auth.uid() AND perfiles.rol = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE perfiles.id = auth.uid() AND perfiles.rol = 'admin'
    )
);
