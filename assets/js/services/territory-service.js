import { supabase } from '../supabase.js';
import { REGIONS_MX, getRegionByState } from '../config/regions-mx.js';

/**
 * TerritoryService
 * Centraliza la lógica de territorios, capas y filtros espaciales.
 */
export const TerritoryService = {
    _cache: {
        states: null,
        layers: null,
        geometries: new Map()
    },

    /**
     * Obtiene las capas territoriales instaladas (Estado, Municipio, etc)
     */
    async getLayers() {
        if (this._cache.layers) return this._cache.layers;
        
        const { data, error } = await supabase
            .from('territory_layers')
            .select('*')
            .order('level');
            
        if (error) throw error;
        this._cache.layers = data;
        return data;
    },

    /**
     * Obtiene todos los estados (MGEE)
     */
    async getStates() {
        if (this._cache.states) return this._cache.states;
        
        const layers = await this.getLayers();
        const stateLayer = layers.find(l => l.level === 'estado');
        
        if (!stateLayer) return [];

        const { data, error } = await supabase
            .from('territories')
            .select('id, code, name, parent_code')
            .eq('layer_id', stateLayer.id)
            .order('name');
            
        if (error) throw error;
        
        // Enriquecer con información de región
        const statesWithRegion = data.map(s => ({
            ...s,
            key: s.code, // Mantenemos key en JS para compatibilidad con código existente
            region: getRegionByState(s.code)
        }));

        this._cache.states = statesWithRegion;
        return statesWithRegion;
    },

    /**
     * Obtiene municipios de un estado específico
     */
    async getMunicipalities(stateKey) {
        const layers = await this.getLayers();
        const munLayer = layers.find(l => l.level === 'municipio');
        if (!munLayer) return [];

        const { data, error } = await supabase
            .from('territories')
            .select('id, code, name, parent_code')
            .eq('layer_id', munLayer.id)
            .ilike('code', `${stateKey}%`) // Clave INEGI de municipio empieza con la del estado
            .order('name');
            
        if (error) throw error;
        
        // Mapear 'code' a 'key' para compatibilidad JS
        return data.map(m => ({ ...m, key: m.code }));
    },

    /**
     * Obtiene la geometría GeoJSON de un territorio (con caché de sesión)
     */
    async getGeometry(territoryId) {
        if (this._cache.geometries.has(territoryId)) {
            return this._cache.geometries.get(territoryId);
        }

        const { data, error } = await supabase
            .rpc('get_territory_geojson', { p_territory_id: territoryId });
            
        if (error) throw error;
        
        this._cache.geometries.set(territoryId, data);
        return data;
    },

    /**
     * Filtro Avanzado: Obtener regiones disponibles
     */
    getRegions() {
        return Object.entries(REGIONS_MX).map(([id, reg]) => ({ id, ...reg }));
    },

    /**
     * Obtener estados por región
     */
    async getStatesByRegion(regionId) {
        const allStates = await this.getStates();
        return allStates.filter(s => s.region && s.region.id === regionId);
    },

    /**
     * FILTRO ESPACIAL: Obtener eventos dentro de un territorio
     */
    async fetchEventsByTerritory(territoryId) {
        const { data, error } = await supabase
            .rpc('get_events_in_territory', { p_territory_id: territoryId });
            
        if (error) throw error;
        return data || [];
    },

    /**
     * FILTRO ESPACIAL: Obtener eventos de una región completa
     */
    async fetchEventsByRegion(regionId) {
        const states = await this.getStatesByRegion(regionId);
        const stateIds = states.map(s => s.id);
        
        if (stateIds.length === 0) return [];

        const { data, error } = await supabase
            .rpc('get_events_in_territories', { p_territory_ids: stateIds });
            
        if (error) throw error;
        return data || [];
    }
};
