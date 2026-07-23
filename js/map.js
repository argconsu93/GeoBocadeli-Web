// =============================================
//  MAPA (Leaflet)
// =============================================

let map = null;
let markersGroup = null;
let geocercasLayerGroup = null;
let distribuidorasLayerGroup = null;
const clienteMarkersMap = {};   // clave: código cliente -> marker
const clientesVisitadosMap = new Map();  // clave: código -> boolean

/**
 * Inicializa el mapa en el contenedor #map
 */
function inicializarMapa() {
    if (map) {
        map.remove();
        map = null;
    }
    map = L.map('map').setView([13.6929, -89.2182], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    distribuidorasLayerGroup = L.layerGroup().addTo(map);
    geocercasLayerGroup = L.layerGroup().addTo(map);
    markersGroup = L.layerGroup().addTo(map);
}

/**
 * Agrega las capas de geocercas (rutas y distribuidoras) al mapa.
 * @param {Array} featuresGeocercasFiltradas - features de rutas a mostrar
 * @param {string} rutaSeleccionada - para resaltar la ruta activa
 */
function renderizarGeocercas(featuresGeocercasFiltradas, rutaSeleccionada) {
    geocercasLayerGroup.clearLayers();
    if (!featuresGeocercasFiltradas || featuresGeocercasFiltradas.length === 0) return;

    const geoLayer = L.geoJSON(
        { type: "FeatureCollection", features: featuresGeocercasFiltradas },
        {
            style: function(feature) {
                const r = feature.properties.ruta_clean || '';
                if (rutaSeleccionada !== 'TODOS' && r.toUpperCase() === rutaSeleccionada.toUpperCase()) {
                    return { color: '#0284c7', weight: 3, fillColor: '#38bdf8', fillOpacity: 0.20, className: 'glow-geofence' };
                }
                return { color: '#1e3a8a', weight: 1.5, fillColor: '#3b82f6', fillOpacity: 0.10 };
            },
            onEachFeature: function(feature, layer) {
                const realRuta = feature.properties.ruta_clean || 'N/A';
                const realGrupo = feature.properties.grupo_clean || 'Sin Grupo';
                layer.bindPopup(`
                    <div style="font-family:'Inter',sans-serif; padding:4px;">
                        <b style="color:#1e3a8a; font-size:0.9rem;"><i class="fa-solid fa-draw-polygon"></i> Cobertura Geocerca</b><br>
                        <b>Grupo:</b> ${realGrupo}<br>
                        <b>Ruta:</b> ${realRuta}
                    </div>
                `);
            }
        }
    ).addTo(geocercasLayerGroup);
    return geoLayer;
}

/**
 * Renderiza las geocercas de distribuidoras.
 * @param {Object} distribuidorasData - GeoJSON de distribuidoras
 */
function renderizarDistribuidoras(distribuidorasData) {
    distribuidorasLayerGroup.clearLayers();
    if (!distribuidorasData || !distribuidorasData.features || distribuidorasData.features.length === 0) return;

    L.geoJSON(distribuidorasData, {
        style: {
            color: '#d9534f',
            weight: 2,
            fillColor: '#d9534f',
            fillOpacity: 0.12
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties || {};
            const nombreDist = props.nambe || props.Name || props.name || props.DISTRIBUIDORA || 'Distribuidora Bocadeli';
            layer.bindPopup(`
                <div style="font-family:'Inter',sans-serif; padding:4px;">
                    <b style="color:#0b1e42; font-size:0.9rem;"><i class="fa-solid fa-building"></i> ${nombreDist}</b>
                </div>
            `);
        }
    }).addTo(distribuidorasLayerGroup);
}

/**
 * Renderiza los marcadores de clientes en el mapa.
 * @param {Array} clientesFiltrados - lista de clientes a mostrar
 * @param {Array} featuresGeocercasFiltradas - para validar fuera de geocerca
 */
function renderizarMarcadores(clientesFiltrados, featuresGeocercasFiltradas) {
    markersGroup.clearLayers();
    Object.keys(clienteMarkersMap).forEach(key => delete clienteMarkersMap[key]);

    let bounds = L.latLngBounds();
    let conCoords = 0;
    const fuera = [];

    clientesFiltrados.forEach(c => {
        if (c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng)) {
            conCoords++;
            bounds.extend([c.lat, c.lng]);
            const isVisited = clientesVisitadosMap.get(c.codigo) || false;

            const marker = L.circleMarker([c.lat, c.lng], {
                radius: 6,
                fillColor: isVisited ? '#16a34a' : '#2563eb',
                color: isVisited ? '#15803d' : '#1e40af',
                weight: 1.5,
                fillOpacity: 0.85
            }).bindPopup(generarPopupHTML(c, isVisited));

            marker.addTo(markersGroup);
            clienteMarkersMap[c.codigo] = marker;

            if (!estaDentroDeGeocercas(c.lat, c.lng, featuresGeocercasFiltradas)) {
                fuera.push(c);
            }
        }
    });

    // Actualizar KPIs de coordenadas y fuera de geocerca
    document.getElementById('kpi-coords').innerText = conCoords;
    document.getElementById('kpi-fuera').innerText = fuera.length;
    return { bounds, fuera };
}

/**
 * Genera el HTML del popup para un cliente.
 */
function generarPopupHTML(c, isVisited) {
    const chkAttr = isVisited ? "checked" : "";
    let navButtons = c.lat && c.lng 
        ? `<div style="display: flex; gap: 6px; margin: 8px 0;">
            <a href="http://googleusercontent.com/maps.google.com/4${c.lat},${c.lng}" target="_blank" class="nav-btn btn-gmaps"><i class="fa-solid fa-location-dot"></i> Maps</a>
            <a href="https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes" target="_blank" class="nav-btn btn-waze"><i class="fa-solid fa-location-arrow"></i> Waze</a>
           </div>`
        : `<div style="font-size: 0.75rem; color: #ef4444; margin: 6px 0; font-weight: 600;">⚠️ Sin coordenadas registradas</div>`;

    return `
        <div style="font-family: 'Inter', sans-serif; padding: 4px; min-width: 200px;">
            <b style="font-size: 0.95rem; color: #0f172a;">${c.nombre}</b><br>
            <hr style="margin: 6px 0; border: 0; border-top: 1px solid #cbd5e1;">
            <div style="font-size: 0.84rem; color: #334155; line-height: 1.5;">
                <b>Código:</b> ${c.codigo}<br>
                <b>Grupo:</b> ${c.grupo}<br>
                <b>Ruta:</b> ${c.ruta}<br>
                <b>Día:</b> ${c.dia}<br>
                <b>Dirección:</b> ${c.direccion}
            </div>
            ${navButtons}
            <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chk-vis-${c.codigo}" ${chkAttr} onchange="cambiarEstadoVisitado('${c.codigo}', this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
                <label for="chk-vis-${c.codigo}" style="font-size: 0.82rem; font-weight: 700; color: #16a34a; cursor: pointer; user-select: none;">Marcar como Visitado</label>
            </div>
        </div>
    `;
}

/**
 * Función para cambiar el estado visitado de un cliente.
 * Debe estar expuesta globalmente para que el onclick del checkbox funcione.
 */
window.cambiarEstadoVisitado = function(codigo, visitado) {
    clientesVisitadosMap.set(codigo, visitado);
    const marker = clienteMarkersMap[codigo];
    if (marker) {
        marker.setStyle({
            fillColor: visitado ? '#16a34a' : '#2563eb',
            color: visitado ? '#15803d' : '#1e40af',
            fillOpacity: visitado ? 0.95 : 0.85
        });
        const clientObj = rawClientes.find(c => c.codigo === codigo);
        if (clientObj) marker.setPopupContent(generarPopupHTML(clientObj, visitado));
    }
    const fila = document.getElementById(`row-cli-${codigo}`);
    if (fila) {
        const cellEstado = fila.querySelector('.col-estado');
        if (visitado) {
            fila.classList.add('visited-row');
            if (cellEstado) cellEstado.innerHTML = '<span style="color:#16a34a; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> Visitado</span>';
        } else {
            fila.classList.remove('visited-row');
            if (cellEstado) cellEstado.innerHTML = '<span style="color:#94a3b8;"><i class="fa-regular fa-circle"></i> Pendiente</span>';
        }
    }
    actualizarKPIsVisitas();
};

/**
 * Algoritmo de punto en polígono (Ray casting)
 */
function puntoEnPoligono(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function estaDentroDeGeocercas(lat, lng, featuresGeocercas) {
    if (!featuresGeocercas || featuresGeocercas.length === 0) return true;
    const pt = [lng, lat];
    for (let feat of featuresGeocercas) {
        const geom = feat.geometry;
        if (!geom) continue;
        if (geom.type === 'Polygon') {
            for (let ring of geom.coordinates) {
                if (puntoEnPoligono(pt, ring)) return true;
            }
        } else if (geom.type === 'MultiPolygon') {
            for (let polyCoords of geom.coordinates) {
                for (let ring of polyCoords) {
                    if (puntoEnPoligono(pt, ring)) return true;
                }
            }
        }
    }
    return false;
}