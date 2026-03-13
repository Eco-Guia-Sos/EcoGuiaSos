-- schema.sql
-- Run this query to create the initial tables for EcoGuía SOS

-- Tabla de Usuarios (Administradores)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Eventos
CREATE TABLE IF NOT EXISTS public.eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    mapa_url TEXT,
    imagen TEXT,
    descripcion TEXT,
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    creado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Lugares
CREATE TABLE IF NOT EXISTS public.lugares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    mapa_url TEXT,
    imagen TEXT,
    descripcion TEXT,
    horario TEXT,
    creado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (Políticas de seguridad)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lugares ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para LEER eventos y lugares (cualquiera puede verlos en la web)
CREATE POLICY "Permitir lectura publica de eventos" ON public.eventos FOR SELECT USING (true);
CREATE POLICY "Permitir lectura publica de lugares" ON public.lugares FOR SELECT USING (true);

-- (Las políticas de inserción/edición se configurarán para usuarios autenticados)
