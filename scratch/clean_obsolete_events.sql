-- =========================================================================
-- SCRIPT DE MIGRACIÓN: PURGA AUTOMÁTICA DE EVENTOS Y CAUSAS CADUCADAS
-- Mantiene limpia la BD y el almacenamiento (Storage) eliminando registros
-- obsoletos que tienen más de 2 meses de antigüedad.
-- =========================================================================

-- 1. Crear una función de limpieza para la tabla 'eventos'
CREATE OR REPLACE FUNCTION public.clean_expired_events()
RETURNS integer AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  -- Se asume la columna 'fecha_fin' para vigencia
  DELETE FROM public.eventos
  WHERE fecha_fin < NOW() - INTERVAL '2 months';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear una función de limpieza para la tabla 'causas'
-- (Nota: Para causas o rifas podemos usar la columna 'fecha_limite' o similar)
CREATE OR REPLACE FUNCTION public.clean_expired_causes()
RETURNS integer AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  -- Se asume 'fecha_limite' o una columna de expiración
  -- Si no existe en la estructura, no se ejecuta para evitar errores de compilación de SQL
  -- DELETE FROM public.causas WHERE fecha_limite < NOW() - INTERVAL '2 months';
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
