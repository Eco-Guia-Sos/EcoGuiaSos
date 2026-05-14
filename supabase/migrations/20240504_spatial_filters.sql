-- 1. Asegurar que eventos y lugares tengan geometría PostGIS
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE public.lugares ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- 2. Índices espaciales para máxima velocidad
CREATE INDEX IF NOT EXISTS eventos_geom_idx ON public.eventos USING GIST (geom);
CREATE INDEX IF NOT EXISTS lugares_geom_idx ON public.lugares USING GIST (geom);

-- 3. Sincronizar datos existentes (convertir columnas lat/lng a geom)
UPDATE public.eventos 
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;

UPDATE public.lugares 
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;

-- 4. Función para obtener TODO (eventos y lugares) dentro de un territorio único (Estados/Municipios)
CREATE OR REPLACE FUNCTION get_events_in_territory(p_territory_id UUID)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    lat FLOAT8,
    lng FLOAT8,
    tipo TEXT,
    categoria TEXT,
    imagen_url TEXT,
    ubicacion TEXT,
    fecha_inicio TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Eventos
    SELECT e.id, e.nombre, e.lat, e.lng, 'evento'::TEXT, e.categoria, e.imagen_url, e.ubicacion, e.fecha_inicio::TEXT
    FROM public.eventos e
    JOIN public.territories t ON ST_Contains(t.geometry, e.geom)
    WHERE t.id = p_territory_id
    
    UNION ALL
    
    -- Lugares
    SELECT l.id, l.nombre, l.lat, l.lng, 'lugar'::TEXT, l.categoria, l.imagen_url, l.ubicacion, NULL::TEXT
    FROM public.lugares l
    JOIN public.territories t ON ST_Contains(t.geometry, l.geom)
    WHERE t.id = p_territory_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Función para obtener TODO dentro de múltiples territorios (Regiones)
CREATE OR REPLACE FUNCTION get_events_in_territories(p_territory_ids UUID[])
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    lat FLOAT8,
    lng FLOAT8,
    tipo TEXT,
    categoria TEXT,
    imagen_url TEXT,
    ubicacion TEXT,
    fecha_inicio TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Eventos
    SELECT e.id, e.nombre, e.lat, e.lng, 'evento'::TEXT, e.categoria, e.imagen_url, e.ubicacion, e.fecha_inicio::TEXT
    FROM public.eventos e
    JOIN public.territories t ON ST_Contains(t.geometry, e.geom)
    WHERE t.id = ANY(p_territory_ids)
    
    UNION ALL
    
    -- Lugares
    SELECT l.id, l.nombre, l.lat, l.lng, 'lugar'::TEXT, l.categoria, l.imagen_url, l.ubicacion, NULL::TEXT
    FROM public.lugares l
    JOIN public.territories t ON ST_Contains(t.geometry, l.geom)
    WHERE t.id = ANY(p_territory_ids);
END;
$$ LANGUAGE plpgsql;
