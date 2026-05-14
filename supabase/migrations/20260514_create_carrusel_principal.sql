-- Crear tabla para el carrusel principal si no existe
CREATE TABLE IF NOT EXISTS public.carrusel_principal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT,
    subtitulo TEXT,
    badge TEXT,
    imagen_url TEXT NOT NULL, -- Usada por defecto y para versión móvil
    imagen_pc_url TEXT,       -- Opcional: Versión optimizada para Escritorio (PC)
    imagen_tablet_url TEXT,   -- Opcional: Versión optimizada para Tablet
    enlace_url TEXT,
    btn_texto TEXT,
    sin_boton BOOLEAN DEFAULT false,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar que las columnas opcionales existan si la tabla ya había sido creada antes
ALTER TABLE public.carrusel_principal ADD COLUMN IF NOT EXISTS imagen_pc_url TEXT;
ALTER TABLE public.carrusel_principal ADD COLUMN IF NOT EXISTS imagen_tablet_url TEXT;

-- Habilitar RLS
ALTER TABLE public.carrusel_principal ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Borrar si existen para permitir re-ejecución limpia)
DROP POLICY IF EXISTS "Lectura pública de slides activos" ON public.carrusel_principal;
DROP POLICY IF EXISTS "Gestión total para administradores" ON public.carrusel_principal;

CREATE POLICY "Lectura pública de slides activos" 
    ON public.carrusel_principal FOR SELECT 
    USING (true);

CREATE POLICY "Gestión total para administradores" 
    ON public.carrusel_principal FOR ALL 
    TO authenticated 
    USING (true);

-- Asegurar que el slide original preexistente tenga los formatos multidispositivo asignados
UPDATE public.carrusel_principal 
SET imagen_pc_url = './assets/img/pc.gif', imagen_tablet_url = './assets/img/tablet.gif' 
WHERE imagen_url = './assets/img/fon.gif';

-- Insertar datos iniciales de continuidad (Seed)
INSERT INTO public.carrusel_principal (titulo, subtitulo, badge, imagen_url, imagen_pc_url, imagen_tablet_url, sin_boton, orden, activo)
VALUES 
(
    null, 
    null, 
    null, 
    './assets/img/fon.gif', 
    './assets/img/pc.gif', 
    './assets/img/tablet.gif', 
    true, 
    1, 
    true
),
(
    'Fondo Semilla 2026', 
    'Aplica hoy para recibir financiamiento para tu proyecto ecoturístico.', 
    'DESTACADO', 
    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1000', 
    null, 
    null, 
    false, 
    2, 
    true
),
(
    'Envía tu nombre al espacio', 
    'Únete a la misión Landsat y registra tu nombre en la base de datos satelital de la NASA.', 
    'NASA LANDSAT', 
    './assets/img/ecoguiasos_rios_2.png', 
    null, 
    null, 
    true, 
    3, 
    true
)
ON CONFLICT DO NOTHING;
