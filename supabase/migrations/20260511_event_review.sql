-- EcoGuía SOS: Moderación de Eventos
-- Agregamos campos para la retroalimentación y auditoría de revisión

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Asegurar que el admin pueda ver todos los eventos sin importar el estado
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'eventos' AND policyname = 'Admins can manage all events'
    ) THEN
        CREATE POLICY "Admins can manage all events" ON public.eventos
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
    END IF;
END $$;

-- Mismo proceso para la tabla perfiles (para el Módulo 2)
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS actor_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS can_edit_until TIMESTAMPTZ;
