import { createClient } from '@supabase/supabase-js';

const MEXICO_STATE_CODES = Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, '0'));

export async function onRequestPost(context) {
    const { request, env } = context;
    
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';

    // Verificación de API Key administrativa (opcional, recomendado para seguridad)
    const adminKey = request.headers.get('x-admin-key');
    if (env.ADMIN_KEY && adminKey !== env.ADMIN_KEY) {
        return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }

    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return new Response(JSON.stringify({ success: false, error: 'Configuración de Supabase faltante en el entorno' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const results = { success: true, skipped: [], layers: [] };
        
        // 1. Capa de Estados (mgee)
        let stateLayerId;
        const { data: existingStateLayer } = await supabase.from('territory_layers')
            .select('id')
            .eq('source', 'INEGI wscatgeo Marco Geoestadistico')
            .eq('level', 'estado')
            .single();
            
        if (existingStateLayer && !force) {
            results.skipped.push('estado');
        } else {
            if (existingStateLayer && force) {
                await supabase.from('territory_layers').delete().eq('id', existingStateLayer.id);
            }
            const { data: newLayer, error: layerErr } = await supabase.from('territory_layers').insert({
                name: 'Estados de México',
                level: 'estado',
                country: 'MX',
                source: 'INEGI wscatgeo Marco Geoestadistico',
                metadata: { provider: 'INEGI', sourceUrl: 'https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgee/' }
            }).select('id').single();
            
            if (layerErr) throw new Error(`Error al crear capa estado: ${layerErr.message}`);
            stateLayerId = newLayer.id;

            let totalFeatures = 0;
            for (const stateCode of MEXICO_STATE_CODES) {
                const res = await fetch(`https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgee/${stateCode}`);
                if (!res.ok) throw new Error(`INEGI respondio ${res.status} para estado ${stateCode}`);
                
                const json = await res.json();
                const features = json.data?.features || json.features;
                
                if (!features || !Array.isArray(features)) {
                    throw new Error(`Respuesta INEGI sin features para estado ${stateCode}`);
                }

                const { error: rpcErr } = await supabase.rpc('insert_territory_features', {
                    p_layer_id: stateLayerId,
                    p_features: features
                });
                if (rpcErr) throw new Error(`Error BD insertando estado ${stateCode}: ${rpcErr.message}`);
                
                totalFeatures += features.length;
            }
            results.layers.push({ id: stateLayerId, level: 'estado', imported: totalFeatures });
        }

        // 2. Capa de Municipios (mgem)
        let munLayerId;
        const { data: existingMunLayer } = await supabase.from('territory_layers')
            .select('id')
            .eq('source', 'INEGI wscatgeo Marco Geoestadistico')
            .eq('level', 'municipio')
            .single();
            
        if (existingMunLayer && !force) {
            results.skipped.push('municipio');
        } else {
            if (existingMunLayer && force) {
                await supabase.from('territory_layers').delete().eq('id', existingMunLayer.id);
            }
            const { data: newLayer, error: layerErr } = await supabase.from('territory_layers').insert({
                name: 'Municipios de México',
                level: 'municipio',
                country: 'MX',
                source: 'INEGI wscatgeo Marco Geoestadistico',
                metadata: { provider: 'INEGI', sourceUrl: 'https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/' }
            }).select('id').single();
            
            if (layerErr) throw new Error(`Error al crear capa municipio: ${layerErr.message}`);
            munLayerId = newLayer.id;

            let totalFeatures = 0;
            for (const stateCode of MEXICO_STATE_CODES) {
                const res = await fetch(`https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/${stateCode}`);
                if (!res.ok) throw new Error(`INEGI respondio ${res.status} para municipio ${stateCode}`);
                
                const json = await res.json();
                const features = json.data?.features || json.features;
                
                if (!features || !Array.isArray(features)) {
                    throw new Error(`Respuesta INEGI sin features para municipio ${stateCode}`);
                }
                
                const { error: rpcErr } = await supabase.rpc('insert_territory_features', {
                    p_layer_id: munLayerId,
                    p_features: features
                });
                if (rpcErr) throw new Error(`Error BD insertando municipio ${stateCode}: ${rpcErr.message}`);
                
                totalFeatures += features.length;
            }
            results.layers.push({ id: munLayerId, level: 'municipio', imported: totalFeatures });
        }

        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
