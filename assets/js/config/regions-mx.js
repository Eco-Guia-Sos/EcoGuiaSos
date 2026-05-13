/**
 * Configuración de Regiones Geoestadísticas de México para EcoGuía SOS
 * Agrupación de estados por zonas para filtros avanzados.
 */
export const REGIONS_MX = {
    'norte': {
        name: 'Norte',
        states: ['02', '03', '05', '08', '19', '25', '26', '28'], // BC, BCS, Coah, Chih, NL, Sin, Son, Tamps
        color: '#4ecdc4'
    },
    'bajio': {
        name: 'Bajío / Occidente',
        states: ['01', '06', '10', '11', '14', '16', '18', '24', '32'], // Ags, Col, Dgo, Gto, Jal, Mich, Nay, SLP, Zac
        color: '#ff6b6b'
    },
    'centro': {
        name: 'Centro',
        states: ['09', '13', '15', '17', '21', '22', '29'], // CDMX, Hgo, Mex, Mor, Pue, Qro, Tlax
        color: '#ffe66d'
    },
    'sur': {
        name: 'Sur / Sureste',
        states: ['04', '07', '12', '20', '23', '27', '30', '31'], // Camp, Chis, Gro, Oax, Q.Roo, Tab, Ver, Yuc
        color: '#1a535c'
    }
};

/**
 * Obtener la región a la que pertenece un estado por su clave INEGI
 */
export function getRegionByState(stateCode) {
    for (const [key, region] of Object.entries(REGIONS_MX)) {
        if (region.states.includes(stateCode)) {
            return { id: key, ...region };
        }
    }
    return null;
}
