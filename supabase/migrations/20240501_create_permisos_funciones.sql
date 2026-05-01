-- ====================================================================
-- ECOGUÍA SOS - CREACIÓN DE TABLA DE PERMISOS DE FUNCIONES
-- ====================================================================
-- Esta tabla gestiona los permisos generales de los actores sobre 
-- funciones globales del sistema.

CREATE TABLE IF NOT EXISTS public.permisos_funciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
    puede_crear_eventos BOOLEAN DEFAULT true,
    puede_crear_lugares BOOLEAN DEFAULT true,
    puede_enviar_notificaciones BOOLEAN DEFAULT false,
    visible_en_directorio BOOLEAN DEFAULT true,
    modo_solo_lectura BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.permisos_funciones ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admins pueden gestionar todos los permisos de funciones" 
ON public.permisos_funciones FOR ALL 
USING ( (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Usuarios pueden ver sus propios permisos de funciones" 
ON public.permisos_funciones FOR SELECT 
USING ( user_id = auth.uid() );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_permisos_funciones_updated_at
    BEFORE UPDATE ON public.permisos_funciones
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
