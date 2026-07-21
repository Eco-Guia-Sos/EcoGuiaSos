-- =========================================================
-- 🛡️ MIGRACIÓN 004: REFORZAMIENTO DE SEGURIDAD Y RLS EN SUPABASE
-- ECOGUÍA SOS
-- =========================================================

-- 1. PREVENCIÓN DE AUTO-ELEVACIÓN DE PRIVILEGIOS EN TABLA PERFILES
-- Evitar que un usuario no-admin modifique su propio 'rol', 'actor_status' o 'permitir_edicion_videos'
CREATE OR REPLACE FUNCTION public.protect_perfiles_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el usuario no es admin, no puede alterar rol, actor_status ni permitir_edicion_videos
  IF (auth.uid() = OLD.id) AND NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'
  ) THEN
    IF (NEW.rol IS DISTINCT FROM OLD.rol) THEN
      RAISE EXCEPTION 'No tienes permiso para modificar tu propio rol de usuario.';
    END IF;
    IF (NEW.actor_status IS DISTINCT FROM OLD.actor_status) THEN
      RAISE EXCEPTION 'No tienes permiso para modificar tu propio estado de verificación/actor.';
    END IF;
    IF (NEW.permitir_edicion_videos IS DISTINCT FROM OLD.permitir_edicion_videos) THEN
      RAISE EXCEPTION 'No tienes permiso para modificar tus restricciones de edición de video.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_perfiles_privileges ON public.perfiles;
CREATE TRIGGER trg_protect_perfiles_privileges
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_perfiles_privileges();

-- 2. REVOCAR EXECUTE DE RPCs ADMINISTRATIVAS AL ROL ANON
REVOKE EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_email(uuid, text) FROM anon;

-- 3. RLS Y POLÍTICAS EXPLÍCITAS EN TABLAS DE SISTEMA Y RECURSOS

-- 3.1 SUPER_EVENTOS
ALTER TABLE IF EXISTS public.super_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de super_eventos" ON public.super_eventos;
CREATE POLICY "Lectura pública de super_eventos"
  ON public.super_eventos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Escritura de super_eventos por admin o staff permitido" ON public.super_eventos;
CREATE POLICY "Escritura de super_eventos por admin o staff permitido"
  ON public.super_eventos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.permisos_funciones WHERE user_id = auth.uid() AND puede_crear_super_eventos = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.permisos_funciones WHERE user_id = auth.uid() AND puede_crear_super_eventos = true)
  );

-- 3.2 CHAT DE SOPORTE (CONVERSACIONES Y MENSAJES)
ALTER TABLE IF EXISTS public.chat_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_mensajes ENABLE ROW LEVEL SECURITY;

-- Conversaciones
DROP POLICY IF EXISTS "Ver conversaciones propias o admin" ON public.chat_conversaciones;
CREATE POLICY "Ver conversaciones propias o admin"
  ON public.chat_conversaciones FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS "Crear conversacion propia" ON public.chat_conversaciones;
CREATE POLICY "Crear conversacion propia"
  ON public.chat_conversaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS "Actualizar conversacion propia o admin" ON public.chat_conversaciones;
CREATE POLICY "Actualizar conversacion propia o admin"
  ON public.chat_conversaciones FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Mensajes
DROP POLICY IF EXISTS "Ver mensajes de conversacion propia o admin" ON public.chat_mensajes;
CREATE POLICY "Ver mensajes de conversacion propia o admin"
  ON public.chat_mensajes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversaciones c
      WHERE c.id = chat_mensajes.conversacion_id
        AND (c.usuario_id = auth.uid() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
    )
  );

DROP POLICY IF EXISTS "Enviar mensaje en conversacion propia o admin" ON public.chat_mensajes;
CREATE POLICY "Enviar mensaje en conversacion propia o admin"
  ON public.chat_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    remitente_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_conversaciones c
      WHERE c.id = chat_mensajes.conversacion_id
        AND (c.usuario_id = auth.uid() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
    )
  );

-- 3.3 CONFIG_PLATAFORMA
ALTER TABLE IF EXISTS public.config_plataforma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de config_plataforma" ON public.config_plataforma;
CREATE POLICY "Lectura pública de config_plataforma"
  ON public.config_plataforma FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Modificación de config_plataforma solo admin" ON public.config_plataforma;
CREATE POLICY "Modificación de config_plataforma solo admin"
  ON public.config_plataforma FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- 3.4 PORTADAS_SECCIONES
ALTER TABLE IF EXISTS public.portadas_secciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de portadas_secciones" ON public.portadas_secciones;
CREATE POLICY "Lectura pública de portadas_secciones"
  ON public.portadas_secciones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Edición de portadas solo admin" ON public.portadas_secciones;
CREATE POLICY "Edición de portadas solo admin"
  ON public.portadas_secciones FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- 3.5 NOTIFICACIONES_USUARIOS
ALTER TABLE IF EXISTS public.notificaciones_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver notificaciones propias o remitente" ON public.notificaciones_usuarios;
CREATE POLICY "Ver notificaciones propias o remitente"
  ON public.notificaciones_usuarios FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Actualizar estado leido de notificacion propia" ON public.notificaciones_usuarios;
CREATE POLICY "Actualizar estado leido de notificacion propia"
  ON public.notificaciones_usuarios FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- 4. POLÍTICAS DE STORAGE (BUCKETS DE IMÁGENES)
DROP POLICY IF EXISTS "Lectura pública de storage" ON storage.objects;
CREATE POLICY "Lectura pública de storage"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('imagenes-plataforma', 'imagenes-causas', 'avatares'));

DROP POLICY IF EXISTS "Insercion autenticada en storage" ON storage.objects;
CREATE POLICY "Insercion autenticada en storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('imagenes-plataforma', 'imagenes-causas', 'avatares'));

-- 5. FUNCIÓN DE PURGA DE EVENTOS EXPIRADOS (> 60 DÍAS) USANDO FECHA EFECTIVA
CREATE OR REPLACE FUNCTION public.purge_expired_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Eliminar eventos cuya fecha efectiva (fecha_fin o fecha_inicio) supere los 60 días de antigüedad
  DELETE FROM public.eventos
  WHERE COALESCE(fecha_fin, fecha_inicio) < (NOW() - INTERVAL '60 days');
END;
$$;

-- NOTIFICAR A POSTGREST
NOTIFY pgrst, 'reload schema';
