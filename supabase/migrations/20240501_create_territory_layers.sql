-- Migración para capas territoriales
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.territory_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    level TEXT NOT NULL, -- 'estado', 'municipio'
    country TEXT NOT NULL DEFAULT 'MX',
    source TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id UUID REFERENCES public.territory_layers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    parent_code TEXT,
    geometry geometry(MultiPolygon, 4326),
    centroid geometry(Point, 4326),
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices espaciales
CREATE INDEX IF NOT EXISTS territories_geom_idx ON public.territories USING GIST (geometry);
CREATE INDEX IF NOT EXISTS territories_centroid_idx ON public.territories USING GIST (centroid);

-- Función para insertar de GeoJSON
CREATE OR REPLACE FUNCTION insert_territory_features(p_layer_id UUID, p_features JSONB)
RETURNS VOID AS $$
DECLARE
    feature JSONB;
    geom GEOMETRY;
    centroid GEOMETRY;
    prop_name TEXT;
    prop_code TEXT;
    prop_parent TEXT;
BEGIN
    FOR feature IN SELECT * FROM jsonb_array_elements(p_features)
    LOOP
        geom := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(feature->>'geometry'), 4326));
        centroid := ST_Centroid(geom);
        
        prop_name := COALESCE(
            feature->'properties'->>'nomgeo',
            feature->'properties'->>'NOMGEO',
            'Territorio N'
        );
        
        prop_code := COALESCE(
            feature->'properties'->>'cvegeo',
            feature->'properties'->>'CVEGEO',
            feature->'properties'->>'cve_ent',
            'N/A'
        );
        
        prop_parent := feature->'properties'->>'cve_ent';
        
        INSERT INTO public.territories (layer_id, name, code, parent_code, geometry, centroid, properties)
        VALUES (p_layer_id, prop_name, prop_code, prop_parent, geom, centroid, feature->'properties');
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener GeoJSON de un territorio específico
CREATE OR REPLACE FUNCTION get_territory_geojson(t_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(geometry)::jsonb,
        'properties', properties || jsonb_build_object('name', name, 'code', code)
    ) INTO result
    FROM public.territories
    WHERE id = t_id;
    
    return result;
END;
$$ LANGUAGE plpgsql;
