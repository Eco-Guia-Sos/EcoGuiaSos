-- =========================================================
-- 🔐 MIGRACIÓN 001: POLÍTICAS RLS Y CUSTOM CLAIMS HOOK
-- ECOGUÍA SOS
-- =========================================================

-- HABILITAR EXTENSIÓN PARA UUID SI NO EXISTE
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- PASO 3B: JWT CUSTOM CLAIMS ACCESS TOKEN HOOK
-- =========================================================
-- Este hook inyecta el 'role' del usuario en su JWT de Supabase Auth
-- cada vez que se autentica o refresca su sesión.
-- =========================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
  DECLARE
    claims jsonb;
    user_role text;
  BEGIN
    -- Obtener el rol del usuario desde la tabla perfiles
    SELECT rol INTO user_role FROM public.perfiles WHERE id = (event->'user'->>'id')::uuid;
    
    -- Extraer los claims actuales del evento
    claims := event->'claims';
    
    -- Inyectar el rol (si es nulo, asigna 'user')
    claims := jsonb_set(claims, '{role}', to_jsonb(COALESCE(user_role, 'user')));
    
    -- Reemplazar los claims modificados en el evento
    event := jsonb_set(event, '{claims}', claims);
    
    RETURN event;
  END;
$$;

-- Otorgar permisos necesarios para que Supabase Auth ejecute la función
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;


-- =========================================================
-- PASO 3A: POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =========================================================

-- ---------------------------------------------------------
-- 1. TABLA: perfiles
-- ---------------------------------------------------------
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Lectura pública para visualizar nombres, especialidades, etc.
CREATE POLICY "perfiles_select_public" 
ON public.perfiles FOR SELECT 
USING (true);

-- INSERT: Restringido. Generalmente lo gestiona un trigger al registrarse en auth.users.
CREATE POLICY "perfiles_insert_never" 
ON public.perfiles FOR INSERT 
WITH CHECK (false);

-- UPDATE: Solo el propietario de la cuenta puede actualizar su propia información
CREATE POLICY "perfiles_update_owner" 
ON public.perfiles FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- DELETE: Solo administradores pueden borrar perfiles
CREATE POLICY "perfiles_delete_admin" 
ON public.perfiles FOR DELETE 
USING ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 2. TABLA: eventos
-- ---------------------------------------------------------
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

-- SELECT: Lectura pública de eventos aprobados, u owners y admins de cualquier estado
CREATE POLICY "eventos_select" 
ON public.eventos FOR SELECT 
USING (estado = 'approved' OR owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- INSERT: Solo el propietario registrado puede insertar
CREATE POLICY "eventos_insert" 
ON public.eventos FOR INSERT 
WITH CHECK (owner_id = auth.uid());

-- UPDATE: Propietarios y administradores pueden editar
CREATE POLICY "eventos_update" 
ON public.eventos FOR UPDATE 
USING (owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
WITH CHECK (owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- DELETE: Solo administradores pueden borrar registros
CREATE POLICY "eventos_delete" 
ON public.eventos FOR DELETE 
USING ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 3. TABLA: lugares
-- ---------------------------------------------------------
ALTER TABLE public.lugares ENABLE ROW LEVEL SECURITY;

-- SELECT: Lectura pública de lugares aprobados, u owners y admins de cualquier estado
CREATE POLICY "lugares_select" 
ON public.lugares FOR SELECT 
USING (estado = 'approved' OR owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- INSERT: Solo el propietario registrado puede crear
CREATE POLICY "lugares_insert" 
ON public.lugares FOR INSERT 
WITH CHECK (owner_id = auth.uid());

-- UPDATE: Propietarios y administradores pueden editar
CREATE POLICY "lugares_update" 
ON public.lugares FOR UPDATE 
USING (owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
WITH CHECK (owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- DELETE: Solo administradores pueden borrar
CREATE POLICY "lugares_delete" 
ON public.lugares FOR DELETE 
USING ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 4. TABLA: contenido_secciones (Cursos, Ecotecnias, etc.)
-- ---------------------------------------------------------
ALTER TABLE public.contenido_secciones ENABLE ROW LEVEL SECURITY;

-- SELECT: Lectura pública para los contenidos aprobados/activos, dueños y admins
CREATE POLICY "contenido_secciones_select" 
ON public.contenido_secciones FOR SELECT 
USING (activo = true OR owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- INSERT: Debe coincidir el owner_id y existir un permiso para esa sección en permisos_actores
CREATE POLICY "contenido_secciones_insert" 
ON public.contenido_secciones FOR INSERT 
WITH CHECK (
  owner_id = auth.uid() AND (
    (auth.jwt() ->> 'role') = 'admin' OR 
    EXISTS (
      SELECT 1 FROM public.permisos_actores 
      WHERE user_id = auth.uid() AND seccion_id = contenido_secciones.seccion_id
    )
  )
);

-- UPDATE: Propietario o administrador
CREATE POLICY "contenido_secciones_update" 
ON public.contenido_secciones FOR UPDATE 
USING (owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
WITH CHECK (owner_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- DELETE: Solo administradores
CREATE POLICY "contenido_secciones_delete" 
ON public.contenido_secciones FOR DELETE 
USING ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 5. TABLA: carrusel_principal
-- ---------------------------------------------------------
ALTER TABLE public.carrusel_principal ENABLE ROW LEVEL SECURITY;

-- SELECT: Público
CREATE POLICY "carrusel_principal_select" 
ON public.carrusel_principal FOR SELECT 
USING (true);

-- INSERT, UPDATE, DELETE: Únicamente administradores
CREATE POLICY "carrusel_principal_write" 
ON public.carrusel_principal FOR ALL 
USING ((auth.jwt() ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 6. TABLA: permisos_actores
-- ---------------------------------------------------------
ALTER TABLE public.permisos_actores ENABLE ROW LEVEL SECURITY;

-- SELECT: Propietario de los permisos o administradores
CREATE POLICY "permisos_actores_select" 
ON public.permisos_actores FOR SELECT 
USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- INSERT, UPDATE, DELETE: Solo administradores
CREATE POLICY "permisos_actores_write" 
ON public.permisos_actores FOR ALL 
USING ((auth.jwt() ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 7. TABLA: permisos_funciones
-- ---------------------------------------------------------
ALTER TABLE public.permisos_funciones ENABLE ROW LEVEL SECURITY;

-- SELECT: Propietario del perfil de permisos o administradores
CREATE POLICY "permisos_funciones_select" 
ON public.permisos_funciones FOR SELECT 
USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');

-- INSERT, UPDATE, DELETE: Solo administradores
CREATE POLICY "permisos_funciones_write" 
ON public.permisos_funciones FOR ALL 
USING ((auth.jwt() ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 8. TABLA: notificaciones
-- ---------------------------------------------------------
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo si el usuario tiene una relación en notificaciones_usuarios o es administrador
CREATE POLICY "notificaciones_select" 
ON public.notificaciones FOR SELECT 
USING (
  id IN (SELECT notificacion_id FROM public.notificaciones_usuarios WHERE user_id = auth.uid()) 
  OR (auth.jwt() ->> 'role') = 'admin'
);

-- INSERT: Permitido para administradores y actores (creadores del contenido)
CREATE POLICY "notificaciones_insert" 
ON public.notificaciones FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'role') IN ('admin', 'actor'));

-- UPDATE, DELETE: Solo administradores
CREATE POLICY "notificaciones_write" 
ON public.notificaciones FOR ALL 
USING ((auth.jwt() ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------
-- 9. TABLA: favoritos
-- ---------------------------------------------------------
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

-- SELECT, INSERT, UPDATE, DELETE: Exclusivo del usuario dueño del favorito
CREATE POLICY "favoritos_owner_all" 
ON public.favoritos FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------
-- 10. TABLA: seguimientos_actores
-- ---------------------------------------------------------
ALTER TABLE public.seguimientos_actores ENABLE ROW LEVEL SECURITY;

-- SELECT, INSERT, UPDATE, DELETE: Exclusivo del usuario seguidor
CREATE POLICY "seguimientos_actores_owner_all" 
ON public.seguimientos_actores FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
