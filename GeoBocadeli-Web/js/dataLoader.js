// =============================================
//  CARGA DE DATOS (CSV y GeoJSON)
// =============================================

// Variables globales que almacenarán los datos
let rawClientes = [];
let rawGeocercas = null;
let rawDistribuidoras = null;

/**
 * Carga el archivo CSV de clientes mediante fetch y lo parsea con PapaParse.
 * @param {string} url Ruta al archivo CSV
 * @returns {Promise} Resuelve con el array de clientes
 */
function cargarClientes(url = 'data/clientes.csv') {
    return new Promise((resolve, reject) => {
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
                return res.text();
            })
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: function(results) {
                        const parsed = results.data;
                        const clientes = parsed.map(row => {
                            const keys = Object.keys(row);
                            const cCol = keys.find(k => k.toLowerCase().includes('codigo') || k.toLowerCase().includes('cliente')) || keys[0];
                            const nCol = keys.find(k => k.toLowerCase().includes('nombre')) || keys[1];
                            const gCol = keys.find(k => k.toLowerCase().includes('grupo')) || 'grupo';
                            const rCol = keys.find(k => k.toLowerCase().includes('ruta')) || 'ruta';
                            const dCol = keys.find(k => k.toLowerCase().includes('dia') || k.toLowerCase().includes('día')) || 'dia';
                            const latCol = keys.find(k => k.toLowerCase().includes('lat')) || 'latitud';
                            const lngCol = keys.find(k => k.toLowerCase().includes('lon') || k.toLowerCase().includes('lng')) || 'longitud';
                            const dirCol = keys.find(k => k.toLowerCase().includes('dir') || k.toLowerCase().includes('domicilio')) || 'direccion';

                            let rVal = row[rCol] ? String(row[rCol]).trim() : "S/R";
                            if (rVal.length > 15 || rVal.includes(',')) rVal = "S/R";

                            let gVal = row[gCol] ? String(row[gCol]).toUpperCase() : "SIN GRUPO";
                            const m = gVal.match(/([0-9]+)/);
                            let grupoClean = m ? "GRUPO_" + m[1].padStart(2, '0') : "Sin Grupo";

                            if (MAPEO_RUTAS_GRUPOS[rVal]) {
                                grupoClean = MAPEO_RUTAS_GRUPOS[rVal];
                            }

                            return {
                                codigo: String(row[cCol] || 'S/C').trim(),
                                nombre: String(row[nCol] || 'Cliente').trim(),
                                grupo: grupoClean,
                                ruta: rVal,
                                dia: row[dCol] ? String(row[dCol]).trim() : 'Sin Día',
                                direccion: row[dirCol] ? String(row[dirCol]).trim() : 'Sin dirección',
                                lat: row[latCol] ? parseFloat(row[latCol]) : null,
                                lng: row[lngCol] ? parseFloat(row[lngCol]) : null
                            };
                        });
                        rawClientes = clientes;
                        resolve(clientes);
                    },
                    error: function(err) {
                        reject(err);
                    }
                });
            })
            .catch(err => reject(err));
    });
}

/**
 * Carga un archivo GeoJSON mediante fetch.
 * @param {string} url Ruta al archivo GeoJSON
 * @returns {Promise} Resuelve con el objeto GeoJSON
 */
function cargarGeoJSON(url) {
    return fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
            return res.json();
        });
}

/**
 * Carga todos los datos iniciales (clientes, geocercas rutas, geocercas distribuidoras).
 * @returns {Promise} Resuelve cuando todos los datos estén cargados
 */
function cargarDatosIniciales() {
    const promClientes = cargarClientes('data/clientes.csv').catch(err => {
        console.warn('No se pudo cargar clientes.csv, se usará array vacío', err);
        return [];
    });
    const promGeocercas = cargarGeoJSON('data/geocercas_rutas.geojson').catch(err => {
        console.warn('No se pudo cargar geocercas_rutas.geojson, se usará null', err);
        return null;
    });
    const promDistribuidoras = cargarGeoJSON('data/geocercas_distribuidoras.geojson').catch(err => {
        console.warn('No se pudo cargar geocercas_distribuidoras.geojson, se usará null', err);
        return null;
    });

    return Promise.all([promClientes, promGeocercas, promDistribuidoras])
        .then(([clientes, geocercas, distribuidoras]) => {
            rawClientes = clientes;
            rawGeocercas = geocercas || { type: "FeatureCollection", features: [] };
            rawDistribuidoras = distribuidoras || { type: "FeatureCollection", features: [] };
            // Procesar propiedades de geocercas (agregar grupo_clean y ruta_clean)
            procesarPropiedadesGeocercas();
            return { clientes, geocercas: rawGeocercas, distribuidoras: rawDistribuidoras };
        });
}

/**
 * Añade propiedades 'ruta_clean' y 'grupo_clean' a cada feature de rawGeocercas.
 * Similar a la lógica original.
 */
function procesarPropiedadesGeocercas() {
    if (!rawGeocercas || !rawGeocercas.features) return;

    rawGeocercas.features.forEach(feat => {
        const props = feat.properties || {};
        const rutaName = String(props.Name || props.name || props.nambe || '').trim();
        feat.properties.ruta_clean = rutaName;

        let grupoClean = "Sin Grupo";

        if (MAPEO_RUTAS_GRUPOS[rutaName]) {
            grupoClean = MAPEO_RUTAS_GRUPOS[rutaName];
        } else {
            const m_g = String(props.description || '').match(/GRUPO\s*([0-9]+)/i);
            if (m_g) {
                grupoClean = "GRUPO_" + m_g[1].padStart(2, '0');
            } else if (rawClientes && rawClientes.length > 0) {
                const matchCliente = rawClientes.find(c => c.ruta === rutaName && c.grupo && c.grupo !== "Sin Grupo");
                if (matchCliente) grupoClean = matchCliente.grupo;
            }
        }

        feat.properties.grupo_clean = grupoClean;
    });
}