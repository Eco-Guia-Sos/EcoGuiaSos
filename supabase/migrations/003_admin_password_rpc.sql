-- =========================================================
-- 🔐 MIGRACIÓN 003: RPC SECURITY DEFINER PARA RESET MANUAL DE CONTRASEÑAS POR ADMIN
-- ECOGUÍA SOS
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  user_id uuid,
  new_pass text
)
RETURNS void
SECURITY DEFINER
SET search_path = public
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
  SET encrypted_password = crypt(new_pass, gen_salt('bf'))
  WHERE id = user_id;
END;
$$;

-- Otorgar permisos de ejecución para la API pública
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) TO authenticated;
