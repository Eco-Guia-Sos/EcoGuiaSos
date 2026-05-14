import { supabase } from '../supabase.js';
import { getRegionByState } from '../config/regions-mx.js';

/**
 * Datos estáticos de los 32 estados de México (claves INEGI 2020)
 * Se usan como fallback si la tabla territory_layers en Supabase está vacía.
 * Centroides aproximados en formato [lng, lat].
 */
const ESTADOS_MX_FALLBACK = [
    { code: '01', name: 'Aguascalientes',     centroid: { coordinates: [-102.2913, 21.8818] } },
    { code: '02', name: 'Baja California',    centroid: { coordinates: [-115.1282, 30.8406] } },
    { code: '03', name: 'Baja California Sur',centroid: { coordinates: [-110.3097, 25.0000] } },
    { code: '04', name: 'Campeche',           centroid: { coordinates: [-90.5349, 19.1816] } },
    { code: '05', name: 'Coahuila',           centroid: { coordinates: [-101.7068, 27.0587] } },
    { code: '06', name: 'Colima',             centroid: { coordinates: [-104.0870, 19.2452] } },
    { code: '07', name: 'Chiapas',            centroid: { coordinates: [-92.7137, 16.7565] } },
    { code: '08', name: 'Chihuahua',          centroid: { coordinates: [-106.0691, 28.6329] } },
    { code: '09', name: 'Ciudad de México',   centroid: { coordinates: [-99.1332, 19.4326] } },
    { code: '10', name: 'Durango',            centroid: { coordinates: [-104.6532, 24.0277] } },
    { code: '11', name: 'Guanajuato',         centroid: { coordinates: [-101.2574, 21.0190] } },
    { code: '12', name: 'Guerrero',           centroid: { coordinates: [-100.2722, 17.4392] } },
    { code: '13', name: 'Hidalgo',            centroid: { coordinates: [-98.7391, 20.0911] } },
    { code: '14', name: 'Jalisco',            centroid: { coordinates: [-103.3496, 20.6597] } },
    { code: '15', name: 'Estado de México',   centroid: { coordinates: [-99.6419, 19.4969] } },
    { code: '16', name: 'Michoacán',          centroid: { coordinates: [-101.7068, 19.5665] } },
    { code: '17', name: 'Morelos',            centroid: { coordinates: [-99.0130, 18.6813] } },
    { code: '18', name: 'Nayarit',            centroid: { coordinates: [-104.8945, 21.7514] } },
    { code: '19', name: 'Nuevo León',         centroid: { coordinates: [-99.9962, 25.5922] } },
    { code: '20', name: 'Oaxaca',             centroid: { coordinates: [-96.7265, 17.0732] } },
    { code: '21', name: 'Puebla',             centroid: { coordinates: [-98.2063, 19.0414] } },
    { code: '22', name: 'Querétaro',          centroid: { coordinates: [-100.3899, 20.5888] } },
    { code: '23', name: 'Quintana Roo',       centroid: { coordinates: [-87.7758, 19.1817] } },
    { code: '24', name: 'San Luis Potosí',    centroid: { coordinates: [-100.3161, 22.1565] } },
    { code: '25', name: 'Sinaloa',            centroid: { coordinates: [-107.3771, 24.8074] } },
    { code: '26', name: 'Sonora',             centroid: { coordinates: [-110.9559, 29.2972] } },
    { code: '27', name: 'Tabasco',            centroid: { coordinates: [-92.9480, 17.8409] } },
    { code: '28', name: 'Tamaulipas',         centroid: { coordinates: [-99.1277, 24.2669] } },
    { code: '29', name: 'Tlaxcala',           centroid: { coordinates: [-98.2375, 19.3182] } },
    { code: '30', name: 'Veracruz',           centroid: { coordinates: [-96.1429, 19.1738] } },
    { code: '31', name: 'Yucatán',            centroid: { coordinates: [-89.5926, 20.7099] } },
    { code: '32', name: 'Zacatecas',          centroid: { coordinates: [-102.5832, 22.7709] } },
];

/**
 * Municipios estáticos por clave de estado INEGI.
 * Patrón lazy: solo se accede al estado que el usuario selecciona.
 * Agrega más estados aquí o pobla la tabla territories en Supabase para cobertura completa.
 */
const MUNICIPIOS_FALLBACK = {
    '09': [ // Ciudad de México — 16 Alcaldías con centroides precisos
        { code: '09001', name: 'Álvaro Obregón', centroid: { coordinates: [-99.2435, 19.3587] } },
        { code: '09002', name: 'Azcapotzalco', centroid: { coordinates: [-99.1820, 19.4843] } },
        { code: '09003', name: 'Benito Juárez', centroid: { coordinates: [-99.1580, 19.3700] } },
        { code: '09004', name: 'Coyoacán', centroid: { coordinates: [-99.1550, 19.3275] } },
        { code: '09005', name: 'Cuajimalpa de Morelos', centroid: { coordinates: [-99.3000, 19.3550] } },
        { code: '09006', name: 'Cuauhtémoc', centroid: { coordinates: [-99.1450, 19.4320] } },
        { code: '09007', name: 'Gustavo A. Madero', centroid: { coordinates: [-99.1130, 19.5000] } },
        { code: '09008', name: 'Iztacalco', centroid: { coordinates: [-99.0950, 19.3950] } },
        { code: '09009', name: 'Iztapalapa', centroid: { coordinates: [-99.0600, 19.3550] } },
        { code: '09010', name: 'La Magdalena Contreras', centroid: { coordinates: [-99.2500, 19.2800] } },
        { code: '09011', name: 'Miguel Hidalgo', centroid: { coordinates: [-99.2000, 19.4300] } },
        { code: '09012', name: 'Milpa Alta', centroid: { coordinates: [-99.0300, 19.1800] } },
        { code: '09013', name: 'Tláhuac', centroid: { coordinates: [-99.0000, 19.2700] } },
        { code: '09014', name: 'Tlalpan', centroid: { coordinates: [-99.2000, 19.2200] } },
        { code: '09015', name: 'Venustiano Carranza', centroid: { coordinates: [-99.0900, 19.4300] } },
        { code: '09016', name: 'Xochimilco', centroid: { coordinates: [-99.1000, 19.2500] } },
    ],
    '15': [ // Estado de México — municipios principales
        { code: '15002', name: 'Acolman' }, { code: '15009', name: 'Amecameca' },
        { code: '15010', name: 'Apaxco' }, { code: '15011', name: 'Atenco' },
        { code: '15013', name: 'Atizapán de Zaragoza' }, { code: '15020', name: 'Axapusco' },
        { code: '15024', name: 'Coacalco de Berriozábal' }, { code: '15025', name: 'Coatepec Harinas' },
        { code: '15028', name: 'Coyotepec' }, { code: '15029', name: 'Cuautitlán' },
        { code: '15030', name: 'Chalco' }, { code: '15031', name: 'Chapa de Mota' },
        { code: '15033', name: 'Chiautla' }, { code: '15034', name: 'Chicoloapan' },
        { code: '15035', name: 'Chiconcuac' }, { code: '15036', name: 'Chimalhuacán' },
        { code: '15037', name: 'Donato Guerra' }, { code: '15039', name: 'Ecatepec de Morelos' },
        { code: '15044', name: 'Huehuetoca' }, { code: '15046', name: 'Huixquilucan' },
        { code: '15051', name: 'Ixtapaluca' }, { code: '15053', name: 'Ixtapan de la Sal' },
        { code: '15055', name: 'Jilotepec' }, { code: '15057', name: 'Jiutepec (Morelos)' },
        { code: '15058', name: 'Jocotitlán' }, { code: '15060', name: 'Lerma' },
        { code: '15061', name: 'Malinalco' }, { code: '15062', name: 'Melchor Ocampo' },
        { code: '15063', name: 'Metepec' }, { code: '15067', name: 'Naucalpan de Juárez' },
        { code: '15068', name: 'Nezahualcóyotl' }, { code: '15069', name: 'Nextlalpan' },
        { code: '15070', name: 'Nicolás Romero' }, { code: '15075', name: 'Ocoyoacac' },
        { code: '15076', name: 'Ocuilan' }, { code: '15081', name: 'La Paz' },
        { code: '15083', name: 'Polotitlán' }, { code: '15087', name: 'San Mateo Atenco' },
        { code: '15092', name: 'Tecámac' }, { code: '15099', name: 'Texcoco' },
        { code: '15100', name: 'Tezoyuca' }, { code: '15106', name: 'Tlalnepantla de Baz' },
        { code: '15108', name: 'Tlatlaya' }, { code: '15109', name: 'Toluca' },
        { code: '15112', name: 'Tultepec' }, { code: '15113', name: 'Tultitlán' },
        { code: '15115', name: 'Valle de Bravo' }, { code: '15122', name: 'Villa del Carbón' },
        { code: '15125', name: 'Zinacantepec' }, { code: '15127', name: 'Zumpango' },
    ],
    '14': [ // Jalisco — municipios principales
        { code: '14014', name: 'Autlán de Navarro' }, { code: '14020', name: 'Chapala' },
        { code: '14023', name: 'Cihuatlán' }, { code: '14039', name: 'Guadalajara' },
        { code: '14044', name: 'Ixtlahuacán de los Membrillos' }, { code: '14051', name: 'Jamay' },
        { code: '14053', name: 'Lagos de Moreno' }, { code: '14055', name: 'La Barca' },
        { code: '14056', name: 'Ocotlán' }, { code: '14065', name: 'Puerto Vallarta' },
        { code: '14067', name: 'El Salto' }, { code: '14070', name: 'San Pedro Tlaquepaque' },
        { code: '14071', name: 'Sayula' }, { code: '14087', name: 'Tepatitlán de Morelos' },
        { code: '14093', name: 'Tlajomulco de Zúñiga' }, { code: '14098', name: 'Tonalá' },
        { code: '14101', name: 'Tuxpan' }, { code: '14102', name: 'La Huerta' },
        { code: '14120', name: 'Zapopan' }, { code: '14124', name: 'Zapotlán el Grande' },
    ],
    '19': [ // Nuevo León — municipios principales
        { code: '19006', name: 'Apodaca' }, { code: '19018', name: 'Cadereyta Jiménez' },
        { code: '19019', name: 'El Carmen' }, { code: '19021', name: 'Ciénega de Flores' },
        { code: '19025', name: 'García' }, { code: '19026', name: 'San Pedro Garza García' },
        { code: '19028', name: 'General Escobedo' }, { code: '19031', name: 'Guadalupe' },
        { code: '19039', name: 'Juárez' }, { code: '19046', name: 'Linares' },
        { code: '19049', name: 'Monterrey' }, { code: '19051', name: 'Pesquería' },
        { code: '19058', name: 'Salinas Victoria' }, { code: '19061', name: 'San Nicolás de los Garza' },
        { code: '19065', name: 'Santa Catarina' }, { code: '19067', name: 'Santiago' },
    ],
    '21': [ // Puebla — municipios principales
        { code: '21004', name: 'Acatzingo' }, { code: '21015', name: 'Atlixco' },
        { code: '21034', name: 'Cholula de Rivadabia' }, { code: '21041', name: 'Cuautlancingo' },
        { code: '21057', name: 'Huejotzingo' }, { code: '21090', name: 'Izúcar de Matamoros' },
        { code: '21114', name: 'Puebla' }, { code: '21119', name: 'San Andrés Cholula' },
        { code: '21132', name: 'San Martín Texmelucan' }, { code: '21136', name: 'San Pedro Cholula' },
        { code: '21140', name: 'San Salvador el Verde' }, { code: '21143', name: 'Tecali de Herrera' },
        { code: '21156', name: 'Tehuacán' }, { code: '21174', name: 'Tepatlaxco de Hidalgo' },
        { code: '21185', name: 'Teziutlán' }, { code: '21213', name: 'Zacatlán' },
    ],
    '11': [ // Guanajuato — municipios principales
        { code: '11003', name: 'Apaseo el Grande' }, { code: '11006', name: 'Celaya' },
        { code: '11007', name: 'Manuel Doblado' }, { code: '11012', name: 'Dolores Hidalgo' },
        { code: '11015', name: 'Guanajuato' }, { code: '11017', name: 'Irapuato' },
        { code: '11018', name: 'Jaral del Progreso' }, { code: '11020', name: 'León' },
        { code: '11021', name: 'Moroleón' }, { code: '11022', name: 'Ocampo' },
        { code: '11024', name: 'Pénjamo' }, { code: '11028', name: 'Salamanca' },
        { code: '11029', name: 'Salvatierra' }, { code: '11031', name: 'San Francisco del Rincón' },
        { code: '11033', name: 'San Miguel de Allende' }, { code: '11035', name: 'Silao de la Victoria' },
        { code: '11037', name: 'Uriangato' }, { code: '11039', name: 'Villagrán' },
        { code: '11040', name: 'Yuriria' },
    ],
    '31': [ // Yucatán — municipios principales
        { code: '31014', name: 'Chemax' }, { code: '31020', name: 'Dzilam de Bravo' },
        { code: '31028', name: 'Hunucmá' }, { code: '31041', name: 'Mérida' },
        { code: '31043', name: 'Motul' }, { code: '31044', name: 'Muna' },
        { code: '31050', name: 'Progreso' }, { code: '31058', name: 'Tekax' },
        { code: '31062', name: 'Ticul' }, { code: '31069', name: 'Tizimín' },
        { code: '31076', name: 'Umán' }, { code: '31080', name: 'Valladolid' },
    ],
};

export const TerritoryService = {
    _cache: {
        states: null,
        layers: null,
        geometries: new Map(),
        municipalities: new Map()  // Cache por código de estado: '09' → [...]  
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
        this._cache.layers = data || [];
        return this._cache.layers;
    },

    /**
     * Obtiene todos los estados (MGEE).
     * Si la BD no tiene datos, usa el fallback estático local con los 32 estados.
     */
    async getStates() {
        if (this._cache.states) return this._cache.states;
        
        try {
            const layers = await this.getLayers();
            const stateLayer = layers.find(l => l.level === 'estado');
            
            if (stateLayer) {
                // Datos reales desde Supabase
                const { data, error } = await supabase
                    .from('territories')
                    .select('id, code, name, parent_code, centroid')
                    .eq('layer_id', stateLayer.id)
                    .order('name');
                    
                if (error) throw error;
                
                const statesWithRegion = data.map(s => ({
                    ...s,
                    key: s.code,
                    region: getRegionByState(s.code),
                    centroid: s.centroid ? { coordinates: [s.centroid.coordinates[0], s.centroid.coordinates[1]] } : null
                }));

                this._cache.states = statesWithRegion;
                console.log(`[TerritoryService] ✅ ${statesWithRegion.length} estados cargados desde Supabase.`);
                return statesWithRegion;
            }
        } catch (err) {
            console.warn('[TerritoryService] No se pudieron obtener estados de Supabase:', err.message);
        }

        // Fallback: datos estáticos locales (sin geometría, solo nombre/clave/centroide)
        console.info('[TerritoryService] ℹ️ Usando datos estáticos de estados (32 entidades INEGI).');
        const fallback = ESTADOS_MX_FALLBACK.map(s => ({
            id: null,
            key: s.code,
            code: s.code,
            name: s.name,
            parent_code: null,
            centroid: s.centroid,
            region: getRegionByState(s.code),
            _isFallback: true
        }));
        this._cache.states = fallback;
        return fallback;
    },

    /**
     * Obtiene municipios de un estado específico.
     * Patrón "load on select": solo se carga cuando el usuario selecciona el estado.
     * Cache de sesión por estado — no se vuelve a pedir el mismo dos veces.
     */
    async getMunicipalities(stateCode) {
        // 1. Cache de sesión: ya lo tenemos → retornar instantáneo
        if (this._cache.municipalities.has(stateCode)) {
            return this._cache.municipalities.get(stateCode);
        }

        // 2. Intentar Supabase (datos reales con geometría)
        try {
            const layers = await this.getLayers();
            const munLayer = layers.find(l => l.level === 'municipio');

            if (munLayer) {
                const { data, error } = await supabase
                    .from('territories')
                    .select('id, code, name, parent_code, centroid')
                    .eq('layer_id', munLayer.id)
                    .ilike('code', `${stateCode}%`)
                    .order('name');

                if (!error && data && data.length > 0) {
                    const result = data.map(m => ({
                        ...m,
                        key: m.code,
                        centroid: m.centroid ? { coordinates: [m.centroid.coordinates[0], m.centroid.coordinates[1]] } : null
                    }));
                    this._cache.municipalities.set(stateCode, result);
                    console.log(`[TerritoryService] ✅ ${result.length} municipios cargados para estado ${stateCode}.`);
                    return result;
                }
            }
        } catch (err) {
            console.warn(`[TerritoryService] Supabase no disponible para municipios de ${stateCode}:`, err.message);
        }

        // 3. Fallback estático (solo estados disponibles en MUNICIPIOS_FALLBACK)
        const fallbackData = MUNICIPIOS_FALLBACK[stateCode];
        if (fallbackData) {
            const result = fallbackData.map(m => ({
                id: null, key: m.code, code: m.code, name: m.name,
                parent_code: stateCode, centroid: m.centroid, _isFallback: true
            }));
            this._cache.municipalities.set(stateCode, result);
            console.info(`[TerritoryService] ℹ️ Municipios estáticos para ${stateCode} (${result.length} registros).`);
            return result;
        }

        // 4. Sin datos disponibles
        console.info(`[TerritoryService] Sin municipios para estado ${stateCode}. Agrega el seed en Supabase.`);
        return [];
    },

    /**
     * Detecta el estado más cercano a unas coordenadas.
     * Usa distancia euclidiana a los centroides — suficientemente preciso para este uso.
     * No hace ningún fetch: opera sobre los estados ya cargados en caché.
     */
    async detectStateFromCoords(lat, lng) {
        const states = await this.getStates();
        if (!states || states.length === 0) return null;

        let closest = null;
        let minDist = Infinity;

        for (const state of states) {
            if (!state.centroid?.coordinates) continue;
            const [sLng, sLat] = state.centroid.coordinates;
            // Distancia euclidiana simple (precisa para la escala de México)
            const dist = Math.sqrt((lat - sLat) ** 2 + (lng - sLng) ** 2);
            if (dist < minDist) {
                minDist = dist;
                closest = state;
            }
        }

        return closest;
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
            
        if (error) {
            console.warn('[TerritoryService] RPC spatial filter failed:', error.message);
        }

        // Si la RPC devolvió datos reales, usarlos
        if (data && data.length > 0) return data;

        // Fallback: buscar el nombre del territorio y filtrar la lista completa por el campo ubicacion
        console.info('[TerritoryService] ℹ️ Filtro espacial vacío. Aplicando filtrado textual inteligente como fallback.');
        
        let territoryName = '';
        if (this._cache.states) {
            const st = this._cache.states.find(s => s.id === territoryId);
            if (st) territoryName = st.name;
        }
        if (!territoryName) {
            for (const muns of this._cache.municipalities.values()) {
                const mun = muns.find(m => m.id === territoryId);
                if (mun) { territoryName = mun.name; break; }
            }
        }

        const [eventosRes, lugaresRes] = await Promise.all([
            supabase.from('eventos').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio'),
            supabase.from('lugares').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion')
        ]);

        const allItems = [
            ...(eventosRes.data || []).map(e => ({ ...e, tipo: 'evento' })),
            ...(lugaresRes.data || []).map(l => ({ ...l, tipo: 'lugar' }))
        ];

        if (territoryName) {
            return allItems.filter(item => item.ubicacion && item.ubicacion.toLowerCase().includes(territoryName.toLowerCase()));
        }
        return allItems;
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
