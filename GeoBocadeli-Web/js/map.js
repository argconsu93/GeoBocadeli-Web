// ============================================================
//  map.js  –  Manejo del mapa Leaflet
// ============================================================

import {
    rawClientes,
    rawGeocercas,
    rawDistribuidoras,
    clientesVisitadosMap,
    diaSeleccionado,
    ultimoClientesFiltrados,
    ultimoClientesFuera
} from './data.js';

import { estaDentroDeGeocercas, procesarPropiedadesGeocercas } from './utils.js';

// ------------------------------------------------------------
//  Variables globales del mapa
// ------------------------------------------------------------
export let map = null;
export let markersGroup = null;
export let geocercasLayerGroup = null;
export let distribuidorasLayerGroup = null;
export const clienteMarkersMap = {};

// ------------------------------------------------------------
//  Inicializar mapa y capas
// ------------------------------------------------------------
export function initMap() {
    map = L.map('map').setView([13.6929, -89.2182], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    distribuidorasLayerGroup = L.layerGroup().addTo(map);
    geocercasLayerGroup = L.layerGroup().addTo(map);
    markersGroup = L.layerGroup().addTo(map);
}

// ------------------------------------------------------------
//  Actualizar mapa según filtros (llamado desde UI)
// ------------------------------------------------------------
export function actualizarMapa(grupoSel, rutaSel, diaSel, featuresGeocercasFiltradas, clientesFiltrados) {
    // Limpiar capas
    markersGroup.clearLayers();
    geocercasLayerGroup.clearLayers();
    distribuidorasLayerGroup.clearLayers();
    Object.keys(clienteMarkersMap).forEach(key => delete clienteMarkersMap[key]);

    const bounds = L.latLngBounds();

    // --- Distribuidoras (siempre se dibujan) ---
    if (rawDistribuidoras && rawDistribuidoras.features && rawDistribuidoras.features.length > 0) {
        const distLayer = L.geoJSON(rawDistribuidoras, {
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

        if (grupoSel === 'TODOS' && rutaSel === 'TODOS') {
            try {
                const bDist = distLayer.getBounds();
                if (bDist.isValid()) bounds.extend(bDist);
            } catch(e) {}
        }
    }

    // --- Geocercas de rutas ---
    if (featuresGeocercasFiltradas && featuresGeocercasFiltradas.length > 0) {
        const geoLayer = L.geoJSON({ type: "FeatureCollection", features: featuresGeocercasFiltradas }, {
            style: function(feature) {
                const r = feature.properties.ruta_clean || '';
                if (rutaSel !== 'TODOS' && r.toUpperCase() === rutaSel.toUpperCase()) {
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
        }).addTo(geocercasLayerGroup);

        try {
            const bGeo = geoLayer.getBounds();
            if (bGeo.isValid()) bounds.extend(bGeo);
        } catch(e) {}
    }

    // --- Marcadores de clientes ---
    let conCoords = 0;
    const fueraGeocerca = [];

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
            });

            // Popup con checkbox (se genera en ui.js, pero aquí lo vinculamos)
            marker.bindPopup(generarPopupHTML(c, isVisited));

            marker.addTo(markersGroup);
            clienteMarkersMap[c.codigo] = marker;

            if (!estaDentroDeGeocercas(c.lat, c.lng, featuresGeocercasFiltradas)) {
                fueraGeocerca.push(c);
            }
        }
    });

    // Ajustar vista
    if (bounds.isValid()) {
        const maxZ = rutaSel !== 'TODOS' ? 15 : (grupoSel !== 'TODOS' ? 13 : 11);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: maxZ, animate: true });
    }

    // Retornar datos para actualizar tablas y KPIs
    return { conCoords, fueraGeocerca };
}

// ------------------------------------------------------------
//  Generar popup HTML (incluye checkbox para marcar visitado)
// ------------------------------------------------------------
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
                <input type="checkbox" id="chk-vis-${c.codigo}" ${chkAttr} data-codigo="${c.codigo}" style="width: 16px; height: 16px; cursor: pointer;">
                <label for="chk-vis-${c.codigo}" style="font-size: 0.82rem; font-weight: 700; color: #16a34a; cursor: pointer; user-select: none;">Marcar como Visitado</label>
            </div>
        </div>
    `;
}

// ------------------------------------------------------------
//  Cambiar estado de visitado (llamado desde el checkbox en popup)
// ------------------------------------------------------------
export function cambiarEstadoVisitado(codigo, visitado) {
    clientesVisitadosMap.set(codigo, visitado);
    const marker = clienteMarkersMap[codigo];
    if (marker) {
        marker.setStyle({
            fillColor: visitado ? '#16a34a' : '#2563eb',
            color: visitado ? '#15803d' : '#1e40af',
            fillOpacity: visitado ? 0.95 : 0.85
        });
        // Actualizar popup
        const clientObj = rawClientes.find(c => c.codigo === codigo);
        if (clientObj) marker.setPopupContent(generarPopupHTML(clientObj, visitado));
    }

    // También actualizar la fila de la tabla (se hace desde ui.js mediante evento)
    const event = new CustomEvent('visitado-cambiado', { detail: { codigo, visitado } });
    document.dispatchEvent(event);
}

// ------------------------------------------------------------
//  Seleccionar un cliente en el mapa (zoom y abrir popup)
// ------------------------------------------------------------
export function seleccionarClienteEnMapa(codigo) {
    const marker = clienteMarkersMap[codigo];
    const clientObj = rawClientes.find(c => c.codigo === codigo);
    if (marker && clientObj && clientObj.lat && clientObj.lng) {
        if (window.innerWidth <= 768) {
            const drawer = document.getElementById('mobile-drawer');
            if (!drawer.classList.contains('collapsed')) {
                drawer.classList.add('collapsed');
                document.getElementById('drawer-btn-label').innerHTML = '<i class="fa-solid fa-chevron-up"></i> Mostrar Filtros e Indicadores';
            }
        }
        map.setView([clientObj.lat, clientObj.lng], 16, { animate: true });
        setTimeout(() => { marker.openPopup(); }, 280);
    } else {
        alert("⚠️ Este cliente no posee coordenadas geográficas válidas.");
    }
}