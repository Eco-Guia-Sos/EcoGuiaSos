-- =========================================================
-- 🔐 MIGRACIÓN 003: RPC SECURITY DEFINER PARA RESET MANUAL DE CREDENCIALES POR ADMIN (CONTRASENA Y EMAIL)
-- ECOGUÍA SOS
-- =========================================================

-- Asegurar que la extensión de encriptación existe en el esquema extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  user_id uuid,
  new_pass text
)
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar si el usuario iniciador de la transacción (autenticado) es administrador
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado. Se requieren permisos de administrador de plataforma.';
  END IF;

  -- Actualizar contraseña encriptada en la tabla auth.users de Supabase
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_pass, extensions.gen_salt('bf'))
  WHERE id = user_id;
END;
$$;

-- Otorgar permisos de ejecución para la API pública
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) TO service_role;

-- =========================================================
-- 🔐 RPC SECURITY DEFINER PARA ACTUALIZAR CORREO POR ADMIN
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_update_user_email(
  user_id uuid,
  new_email text
)
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar si el usuario iniciador de la transacción (autenticado) es administrador
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado. Se requieren permisos de administrador de plataforma.';
  END IF;

  -- Actualizar email en la tabla auth.users de Supabase (y sync interno)
  UPDATE auth.users
  SET email = new_email,
      email_confirmed_at = now()
  WHERE id = user_id;
END;
$$;

-- Otorgar permisos de ejecución para la API pública
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(uuid, text) TO service_role;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
