// ============================================================
//  utils.js  –  Funciones auxiliares
// ============================================================

// ------------------------------------------------------------
//  Punto en polígono (algoritmo de ray casting)
// ------------------------------------------------------------
export function puntoEnPoligono(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ------------------------------------------------------------
//  Determina si un punto (lat, lng) está dentro de al menos una geocerca
// ------------------------------------------------------------
export function estaDentroDeGeocercas(lat, lng, featuresGeocercas) {
    if (!featuresGeocercas || featuresGeocercas.length === 0) return true;
    const pt = [lng, lat];
    for (const feat of featuresGeocercas) {
        const geom = feat.geometry;
        if (!geom) continue;
        if (geom.type === 'Polygon') {
            for (const ring of geom.coordinates) {
                if (puntoEnPoligono(pt, ring)) return true;
            }
        } else if (geom.type === 'MultiPolygon') {
            for (const polyCoords of geom.coordinates) {
                for (const ring of polyCoords) {
                    if (puntoEnPoligono(pt, ring)) return true;
                }
            }
        }
    }
    return false;
}

// ------------------------------------------------------------
//  Procesar CSV (decodificado desde base64) con PapaParse
// ------------------------------------------------------------
export function procesarCsvBase64(csvB64, MAPEO_RUTAS_GRUPOS) {
    if (!csvB64 || csvB64 === "") return [];
    try {
        const decodedCsv = decodeURIComponent(escape(atob(csvB64)));
        let resultados = [];
        Papa.parse(decodedCsv, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                resultados = results.data.map(row => {
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
            }
        });
        return resultados;
    } catch (err) {
        console.error("Error al decodificar CSV:", err);
        return [];
    }
}

// ------------------------------------------------------------
//  Procesar propiedades de geocercas (asigna grupo_clean y ruta_clean)
// ------------------------------------------------------------
export function procesarPropiedadesGeocercas(geocercas, MAPEO_RUTAS_GRUPOS, rawClientes) {
    if (!geocercas || !geocercas.features) return;
    geocercas.features.forEach(feat => {
        const props = feat.properties || {};
        let rutaName = String(props.Name || props.name || props.nambe || '').trim();
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