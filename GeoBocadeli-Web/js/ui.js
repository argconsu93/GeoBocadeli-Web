// ============================================================
//  ui.js  –  Interfaz de usuario (login, filtros, tablas, descargas)
// ============================================================

import {
    listaUsuariosRoles,
    MAPEO_RUTAS_GRUPOS,
    rawClientes,
    rawGeocercas,
    rawDistribuidoras,
    csvB64Servidor,
    usuarioActual,
    diaSeleccionado,
    ultimoClientesFiltrados,
    ultimoClientesFuera,
    clientesVisitadosMap
} from './data.js';

import {
    procesarCsvBase64,
    procesarPropiedadesGeocercas
} from './utils.js';

import {
    map,
    markersGroup,
    geocercasLayerGroup,
    distribuidorasLayerGroup,
    clienteMarkersMap,
    initMap,
    actualizarMapa,
    cambiarEstadoVisitado,
    seleccionarClienteEnMapa
} from './map.js';

// ------------------------------------------------------------
//  Variables de estado de UI
// ------------------------------------------------------------
let usuarioActualUI = null;  // copia local
let diaSeleccionadoUI = 'NINGUNO';

// ------------------------------------------------------------
//  Inicialización (se llama desde app.js)
// ------------------------------------------------------------
export function initUI() {
    // Eventos de login
    document.getElementById('btn-login').addEventListener('click', validarLogin);
    document.getElementById('input-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') validarLogin();
    });

    // Cierre de sesión
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

    // Drawer (móvil)
    document.getElementById('drawer-handle').addEventListener('click', toggleDrawer);

    // Filtros
    document.getElementById('select-grupo').addEventListener('change', alCambiarGrupo);
    document.getElementById('select-ruta').addEventListener('change', alCambiarRuta);

    // Botones de día
    document.querySelectorAll('.btn-day').forEach(btn => {
        btn.addEventListener('click', function() {
            const dia = this.dataset.dia;
            filtrarDia(dia, this);
        });
    });

    // Carga de archivos (admin)
    document.getElementById('file-csv-input').addEventListener('change', subirNuevoCSV);
    document.getElementById('file-geojson-input').addEventListener('change', subirNuevoGeoJSON);
    document.getElementById('file-distribuidoras-input').addEventListener('change', subirNuevoGeoJSONDistribuidoras);

    // Botones de descarga
    document.getElementById('btn-descargar-visitados').addEventListener('click', descargarClientesVisitados);
    document.getElementById('btn-descargar-itinerario').addEventListener('click', descargarItinerarioFiltrado);

    // Escuchar cambios de visitado desde los popups
    document.addEventListener('visitado-cambiado', (e) => {
        const { codigo, visitado } = e.detail;
        actualizarFilaVisita(codigo, visitado);
        actualizarKpisVisitas();
    });

    // Inicializar fecha y login
    actualizarFechaActual();
    poblarModalLogin();

    // Si hay un CSV embebido, procesarlo
    if (csvB64Servidor && csvB64Servidor !== "") {
        const clientes = procesarCsvBase64(csvB64Servidor, MAPEO_RUTAS_GRUPOS);
        if (clientes.length) {
            rawClientes.length = 0;
            rawClientes.push(...clientes);
            procesarPropiedadesGeocercas(rawGeocercas, MAPEO_RUTAS_GRUPOS, rawClientes);
        }
    }
}

// ------------------------------------------------------------
//  LOGIN
// ------------------------------------------------------------
function poblarModalLogin() {
    const selectLogin = document.getElementById('select-usuario-login');
    selectLogin.innerHTML = '<option value="">-- Seleccione su Nombre --</option>';
    const sorted = [...listaUsuariosRoles].sort((a, b) => a.nombre.localeCompare(b.nombre));
    sorted.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.nombre;
        opt.textContent = u.nombre;
        selectLogin.appendChild(opt);
    });
}

function validarLogin() {
    const nombreSel = document.getElementById('select-usuario-login').value;
    const passInput = document.getElementById('input-password').value.trim().toLowerCase();
    const errorDiv = document.getElementById('login-error');

    if (!nombreSel) {
        errorDiv.textContent = "⚠️ Por favor seleccione su nombre.";
        errorDiv.style.display = 'block';
        return;
    }

    const userObj = listaUsuariosRoles.find(u => u.nombre === nombreSel);
    if (userObj && passInput === userObj.pass.toLowerCase()) {
        usuarioActualUI = userObj;
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('txt-rol-activo').textContent = `${userObj.nombre} (${userObj.rol})`;

        if (userObj.rol === 'Administrador') {
            document.getElementById('panel-admin-actualizacion').style.display = 'flex';
        } else {
            document.getElementById('panel-admin-actualizacion').style.display = 'none';
        }

        // Inicializar el dashboard
        initDashboard();
    } else {
        errorDiv.textContent = "⚠️ Contraseña incorrecta. Verifique e intente de nuevo.";
        errorDiv.style.display = 'block';
    }
}

function cerrarSesion() {
    usuarioActualUI = null;
    document.getElementById('input-password').value = '';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    if (map) {
        map.remove();
        // Reiniciar variables de mapa
        // (Se reiniciarán al volver a iniciar sesión)
    }
    // Limpiar datos de sesión
    clientesVisitadosMap.clear();
    Object.keys(clienteMarkersMap).forEach(k => delete clienteMarkersMap[k]);
    document.getElementById('txt-rol-activo').textContent = 'Invitado';
}

// ------------------------------------------------------------
//  DASHBOARD (después del login)
// ------------------------------------------------------------
function initDashboard() {
    initMap();
    procesarPropiedadesGeocercas(rawGeocercas, MAPEO_RUTAS_GRUPOS, rawClientes);
    poblarFiltrosPermitidos();
    aplicarFiltros();
}

// ------------------------------------------------------------
//  FILTROS
// ------------------------------------------------------------
function poblarFiltrosPermitidos() {
    const selectGrupo = document.getElementById('select-grupo');
    selectGrupo.innerHTML = '';

    const gruposUnicos = [...new Set(rawClientes.map(c => c.grupo))]
        .filter(g => /^GRUPO_\d+$/i.test(g))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (usuarioActualUI && usuarioActualUI.rol === 'Supervisor') {
        const opt = document.createElement('option');
        opt.value = usuarioActualUI.grupo;
        opt.textContent = usuarioActualUI.grupo;
        selectGrupo.appendChild(opt);
        selectGrupo.value = usuarioActualUI.grupo;
        selectGrupo.disabled = true;
    } else {
        const optTodos = document.createElement('option');
        optTodos.value = "TODOS";
        optTodos.textContent = "-- Todos los Grupos --";
        selectGrupo.appendChild(optTodos);
        gruposUnicos.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            selectGrupo.appendChild(opt);
        });
        selectGrupo.value = "TODOS";
        selectGrupo.disabled = false;
    }
    actualizarOpcionesRuta();
}

function actualizarOpcionesRuta() {
    const selectGrupo = document.getElementById('select-grupo').value;
    const selectRuta = document.getElementById('select-ruta');
    const rutaPrevia = selectRuta.value;

    selectRuta.innerHTML = '<option value="TODOS">-- Todas las Rutas --</option>';

    let clientesFiltrados = rawClientes;
    if (selectGrupo !== 'TODOS') {
        clientesFiltrados = rawClientes.filter(c => c.grupo === selectGrupo);
    }

    const rutasUnicas = [...new Set(clientesFiltrados.map(c => c.ruta))]
        .filter(r => r && r !== 'S/R' && r !== 'nan' && !r.includes(',') && r.length < 15)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    rutasUnicas.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        selectRuta.appendChild(opt);
    });

    if (rutasUnicas.includes(rutaPrevia)) selectRuta.value = rutaPrevia;
}

function alCambiarGrupo() {
    actualizarOpcionesRuta();
    aplicarFiltros();
}

function alCambiarRuta() {
    const rutaSel = document.getElementById('select-ruta').value;
    if (rutaSel !== 'TODOS') {
        const clienteRuta = rawClientes.find(c => c.ruta === rutaSel);
        if (clienteRuta && clienteRuta.grupo && usuarioActualUI && usuarioActualUI.rol !== 'Supervisor') {
            document.getElementById('select-grupo').value = clienteRuta.grupo;
            actualizarOpcionesRuta();
            document.getElementById('select-ruta').value = rutaSel;
        }
    }
    aplicarFiltros();
}

function filtrarDia(dia, btn) {
    if (diaSeleccionadoUI === dia) {
        diaSeleccionadoUI = 'NINGUNO';
        document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
    } else {
        diaSeleccionadoUI = dia;
        document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    aplicarFiltros();
}

// ------------------------------------------------------------
//  APLICAR FILTROS (central)
// ------------------------------------------------------------
function aplicarFiltros() {
    const grupoSel = document.getElementById('select-grupo').value;
    const rutaSel = document.getElementById('select-ruta').value;
    const diaSel = diaSeleccionadoUI;

    // Obtener geocercas filtradas
    let featuresGeocercasFiltradas = [];
    if (rawGeocercas && rawGeocercas.features) {
        featuresGeocercasFiltradas = rawGeocercas.features.filter(f => {
            const g = f.properties.grupo_clean || 'Sin Grupo';
            if (grupoSel !== 'TODOS' && g !== grupoSel) return false;
            if (rutaSel !== 'TODOS') {
                const r = f.properties.ruta_clean || '';
                if (r.toUpperCase() !== rutaSel.toUpperCase()) return false;
            }
            return true;
        });
    }

    // Filtrar clientes
    let clientesFiltrados = [];
    if (diaSel !== 'NINGUNO') {
        clientesFiltrados = rawClientes.filter(c => {
            const matchGrupo = (grupoSel === 'TODOS') || (c.grupo === grupoSel);
            const matchRuta = (rutaSel === 'TODOS') || (c.ruta === rutaSel);
            let matchDia = false;
            if (diaSel === 'TODOS') {
                matchDia = true;
            } else {
                const d1 = (c.dia || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const d2 = diaSel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                matchDia = (d1 === d2);
            }
            return matchGrupo && matchRuta && matchDia;
        });
    } else {
        clientesFiltrados = [];
    }

    // Actualizar mapa y obtener estadísticas
    const { conCoords, fueraGeocerca } = actualizarMapa(grupoSel, rutaSel, diaSel, featuresGeocercasFiltradas, clientesFiltrados);

    // Actualizar variables globales para descargas
    ultimoClientesFiltrados.length = 0;
    ultimoClientesFiltrados.push(...clientesFiltrados);
    ultimoClientesFuera.length = 0;
    ultimoClientesFuera.push(...fueraGeocerca);

    // Actualizar tablas
    actualizarTablaClientes(clientesFiltrados);
    actualizarTablaFuera(fueraGeocerca);

    // KPIs
    document.getElementById('kpi-total').innerText = clientesFiltrados.length;
    document.getElementById('kpi-coords').innerText = conCoords;
    document.getElementById('kpi-fuera').innerText = fueraGeocerca.length;
    actualizarKpisVisitas();
}

// ------------------------------------------------------------
//  TABLAS
// ------------------------------------------------------------
function actualizarTablaClientes(clientes) {
    const tbody = document.getElementById('tabla-clientes-body');
    tbody.innerHTML = '';
    clientes.slice(0, 300).forEach(c => {
        const isVisited = clientesVisitadosMap.get(c.codigo) || false;
        const tr = document.createElement('tr');
        tr.id = `row-cli-${c.codigo}`;
        tr.className = `clickable-row ${isVisited ? 'visited-row' : ''}`;
        tr.addEventListener('click', () => seleccionarClienteEnMapa(c.codigo));

        tr.innerHTML = `
            <td style="font-weight: 700; color: #1e3a8a;">${c.codigo}</td>
            <td>${c.nombre}</td>
            <td><span style="background:#e0f2fe; color:#0369a1; padding:2px 5px; border-radius:4px; font-weight:bold;">${c.ruta}</span></td>
            <td>${c.dia}</td>
            <td class="col-estado">
                ${isVisited
                    ? '<span style="color:#16a34a; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> Visitado</span>'
                    : '<span style="color:#94a3b8;"><i class="fa-regular fa-circle"></i> Pendiente</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarTablaFuera(clientes) {
    const tbody = document.getElementById('tabla-fuera-body');
    tbody.innerHTML = '';
    clientes.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'clickable-row outside-row';
        tr.addEventListener('click', () => seleccionarClienteEnMapa(c.codigo));
        tr.innerHTML = `
            <td style="font-weight: 700; color: #dc2626;">${c.codigo}</td>
            <td>${c.nombre}</td>
            <td><span style="background:#fee2e2; color:#b91c1c; padding:2px 5px; border-radius:4px; font-weight:bold;">${c.ruta}</span></td>
            <td>${c.dia}</td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarFilaVisita(codigo, visitado) {
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
}

// ------------------------------------------------------------
//  KPIS DE VISITAS
// ------------------------------------------------------------
function actualizarKpisVisitas() {
    const total = ultimoClientesFiltrados.length;
    let visitados = 0;
    ultimoClientesFiltrados.forEach(c => {
        if (clientesVisitadosMap.get(c.codigo) === true) visitados++;
    });
    const pendientes = total - visitados;
    const porcentaje = total > 0 ? Math.round((visitados / total) * 100) : 0;

    document.getElementById('kpi-visitados').innerText = visitados;
    document.getElementById('kpi-pendientes').innerText = pendientes;
    document.getElementById('kpi-porcentaje').innerText = porcentaje + '%';
}

// ------------------------------------------------------------
//  DESCARGA DE ARCHIVOS
// ------------------------------------------------------------
function descargarClientesVisitados() {
    const listVisitados = [];
    rawClientes.forEach(c => {
        if (clientesVisitadosMap.get(c.codigo) === true) {
            listVisitados.push({
                "Ruta": c.ruta,
                "Codigo": c.codigo,
                "Cliente": c.nombre,
                "Direccion": c.direccion,
                "Dia de visita": c.dia
            });
        }
    });
    if (listVisitados.length === 0) {
        alert("⚠️ No hay ningún cliente marcado como 'Visitado' aún.");
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(listVisitados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes Visitados");
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Clientes_Visitados_Bocadeli_${fecha}.xlsx`);
}

function descargarItinerarioFiltrado() {
    if (!ultimoClientesFiltrados || ultimoClientesFiltrados.length === 0) {
        alert("⚠️ No hay clientes disponibles en la lista con los filtros seleccionados.");
        return;
    }
    const grupoSel = document.getElementById('select-grupo').value;
    const rutaSel = document.getElementById('select-ruta').value;
    const diaSel = diaSeleccionadoUI;

    const datosExportar = ultimoClientesFiltrados.map(c => ({
        "Grupo": c.grupo,
        "Ruta": c.ruta,
        "Codigo": c.codigo,
        "Cliente": c.nombre,
        "Direccion": c.direccion,
        "Dia de visita": c.dia,
        "Estado Visitado": clientesVisitadosMap.get(c.codigo) ? "SÍ" : "NO",
        "Fuera de Geocerca": ultimoClientesFuera.some(f => f.codigo === c.codigo) ? "SÍ" : "NO"
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Itinerario");

    const nombreGrupo = grupoSel !== 'TODOS' ? grupoSel : 'TodosGrupos';
    const nombreRuta = rutaSel !== 'TODOS' ? `Ruta_${rutaSel}` : 'TodasRutas';
    const nombreDia = (diaSel !== 'TODOS' && diaSel !== 'NINGUNO') ? `_Dia_${diaSel}` : '';

    XLSX.writeFile(workbook, `Itinerario_${nombreGrupo}_${nombreRuta}${nombreDia}.xlsx`);
}

// ------------------------------------------------------------
//  CARGA DE ARCHIVOS (Admin)
// ------------------------------------------------------------
function subirNuevoCSV(event) {
    const file = event.target.files[0];
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
                if (MAPEO_RUTAS_GRUPOS[rVal]) grupoClean = MAPEO_RUTAS_GRUPOS[rVal];

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
            rawClientes.length = 0;
            rawClientes.push(...nuevosClientes);
            procesarPropiedadesGeocercas(rawGeocercas, MAPEO_RUTAS_GRUPOS, rawClientes);
            poblarFiltrosPermitidos();
            aplicarFiltros();
            alert("✅ Archivo CSV de clientes cargado en memoria local.");
        }
    });
}

function subirNuevoGeoJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const geojsonData = JSON.parse(e.target.result);
            rawGeocercas = geojsonData;
            procesarPropiedadesGeocercas(rawGeocercas, MAPEO_RUTAS_GRUPOS, rawClientes);
            poblarFiltrosPermitidos();
            aplicarFiltros();
            alert("✅ Geocercas de Rutas cargadas en memoria local.");
        } catch(err) {
            alert("❌ Error al procesar GeoJSON: " + err);
        }
    };
    reader.readAsText(file);
}

function subirNuevoGeoJSONDistribuidoras(event) {
    const file = event.target.files[0];
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

// ------------------------------------------------------------
//  DRAWER (MÓVIL)
// ------------------------------------------------------------
function toggleDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const label = document.getElementById('drawer-btn-label');
    drawer.classList.toggle('collapsed');
    label.innerHTML = drawer.classList.contains('collapsed')
        ? '<i class="fa-solid fa-chevron-up"></i> Mostrar Filtros e Indicadores'
        : '<i class="fa-solid fa-chevron-down"></i> Ocultar';
    setTimeout(() => { if (map) map.invalidateSize(); }, 360);
}

// ------------------------------------------------------------
//  FECHA ACTUAL
// ------------------------------------------------------------
function actualizarFechaActual() {
    const fecha = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let fechaTexto = fecha.toLocaleDateString('es-ES', opciones);
    document.getElementById('fecha-actual').textContent = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);
}