-- Tablas para las sub-páginas de EcoGuía SOS

-- Tabla de Cursos
CREATE TABLE IF NOT EXISTS public.cursos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    organiza TEXT,
    fecha TEXT,
    modalidad TEXT,
    descripcion TEXT,
    imagen TEXT,
    link TEXT,
    creado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Voluntariados
CREATE TABLE IF NOT EXISTS public.voluntariados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    organiza TEXT,
    fecha TEXT,
    ubicacion TEXT,
    descripcion TEXT,
    imagen TEXT,
    link TEXT,
    creado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Agentes (Líderes)
CREATE TABLE IF NOT EXISTS public.agentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    especialidad TEXT,
    organizacion TEXT,
    zona TEXT,
    alcaldia TEXT,
    descripcion TEXT,
    imagen TEXT,
    mapa_url TEXT,
    redes_ig TEXT,
    redes_fb TEXT,
    redes_x TEXT,
    redes_web TEXT,
    redes_wa TEXT,
    creado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voluntariados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agentes ENABLE ROW LEVEL SECURITY;

-- Políticas de Lectura Pública
CREATE POLICY "Permitir lectura publica cursos" ON public.cursos FOR SELECT USING (true);
CREATE POLICY "Permitir lectura publica voluntarios" ON public.voluntariados FOR SELECT USING (true);
CREATE POLICY "Permitir lectura publica agentes" ON public.agentes FOR SELECT USING (true);

-- Políticas de Admin
CREATE POLICY "Admin_Cursos" ON public.cursos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin_Voluntariados" ON public.voluntariados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin_Agentes" ON public.agentes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quitar validación estricta de creado_por temporalmente
ALTER TABLE public.cursos DROP CONSTRAINT IF EXISTS cursos_creado_por_fkey;
ALTER TABLE public.voluntariados DROP CONSTRAINT IF EXISTS voluntariados_creado_por_fkey;
ALTER TABLE public.agentes DROP CONSTRAINT IF EXISTS agentes_creado_por_fkey;
