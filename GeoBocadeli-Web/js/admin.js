// =============================================
//  ADMIN: CARGA DE ARCHIVOS (CSV, GeoJSON)
// =============================================

/**
 * Maneja la subida de un nuevo CSV de clientes.
 */
function subirNuevoCSV(file) {
    if (!file) return;
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            const parsedData = results.data;
            const nuevosClientes = [];

            parsedData.forEach(row => {
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

                nuevosClientes.push({
                    codigo: String(row[cCol] || 'S/C').trim(),
                    nombre: String(row[nCol] || 'Cliente').trim(),
                    grupo: grupoClean,
                    ruta: rVal,
                    dia: row[dCol] ? String(row[dCol]).trim() : 'Sin Día',
                    direccion: row[dirCol] ? String(row[dirCol]).trim() : 'Sin dirección',
                    lat: row[latCol] ? parseFloat(row[latCol]) : null,
                    lng: row[lngCol] ? parseFloat(row[lngCol]) : null
                });
            });

            rawClientes = nuevosClientes;
            procesarPropiedadesGeocercas();
            poblarFiltrosPermitidos();
            aplicarFiltros();
            alert("✅ Archivo CSV de clientes cargado en memoria local.");
        }
    });
}

/**
 * Maneja la subida de un nuevo GeoJSON de rutas.
 */
function subirNuevoGeoJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const geojsonData = JSON.parse(e.target.result);
            rawGeocercas = geojsonData;
            procesarPropiedadesGeocercas();
            poblarFiltrosPermitidos();
            aplicarFiltros();
            alert("✅ Geocercas de Rutas cargadas en memoria local.");
        } catch(err) {
            alert("❌ Error al procesar GeoJSON: " + err);
        }
    };
    reader.readAsText(file);
}

/**
 * Maneja la subida de un nuevo GeoJSON de distribuidoras.
 */
function subirNuevoGeoJSONDistribuidoras(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const geojsonData = JSON.parse(e.target.result);
            rawDistribuidoras = geojsonData;
            aplicarFiltros();
            alert("✅ Geocercas de Distribuidoras cargadas en memoria local.");
        } catch(err) {
            alert("❌ Error al procesar GeoJSON de Distribuidoras: " + err);
        }
    };
    reader.readAsText(file);
}

// Asignar eventos a los inputs de archivo
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('file-csv-input').addEventListener('change', function(e) {
        if (this.files[0]) subirNuevoCSV(this.files[0]);
    });
    document.getElementById('file-geojson-input').addEventListener('change', function(e) {
        if (this.files[0]) subirNuevoGeoJSON(this.files[0]);
    });
    document.getElementById('file-distribuidoras-input').addEventListener('change', function(e) {
        if (this.files[0]) subirNuevoGeoJSONDistribuidoras(this.files[0]);
    });
});