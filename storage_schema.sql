-- ==============================================================================
-- 1. CREACIÓN DEL BUCKET PARA IMÁGENES
-- ==============================================================================
-- Las imágenes de la plataforma (cursos, lugares, eventos, etc.)
-- se guardarán de forma pública.
insert into storage.buckets (id, name, public)
values ('imagenes_plataforma', 'imagenes_plataforma', true)
on conflict (id) do nothing;

-- ==============================================================================
-- 2. POLÍTICAS DE SEGURIDAD (RLS) PARA EL BUCKET
-- ==============================================================================

-- A. Público: Cualquier persona puede ver/descargar las imágenes.
-- Esto es necesario para que las imágenes carguen en la página web.
create policy "Imágenes visibles al público" 
on storage.objects for select 
using ( bucket_id = 'imagenes_plataforma' );

-- B. Restringido: Sólo usuarios autenticados (administradores) pueden subir nuevas imágenes.
create policy "Sólo admins pueden subir imágenes" 
on storage.objects for insert 
with check ( bucket_id = 'imagenes_plataforma' and auth.uid() is not null );

-- C. Restringido: Sólo usuarios autenticados pueden actualizar imágenes.
create policy "Sólo admins pueden editar imágenes" 
on storage.objects for update 
using ( bucket_id = 'imagenes_plataforma' and auth.uid() is not null );

-- D. Restringido: Sólo usuarios autenticados pueden borrar imágenes.
create policy "Sólo admins pueden borrar imágenes" 
on storage.objects for delete 
using ( bucket_id = 'imagenes_plataforma' and auth.uid() is not null );
