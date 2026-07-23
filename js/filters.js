// =============================================
//  FILTROS Y ACTUALIZACIÓN DE LA VISTA
// =============================================

let diaSeleccionado = 'NINGUNO';
let ultimoClientesFiltrados = [];
let ultimoClientesFuera = [];

/**
 * Poblar el select de grupos según el rol del usuario.
 */
function poblarFiltrosPermitidos() {
    const selectGrupo = document.getElementById('select-grupo');
    selectGrupo.innerHTML = '';

    const gruposUnicos = [...new Set(rawClientes.map(c => c.grupo))]
        .filter(g => /^GRUPO_\d+$/i.test(g))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (usuarioActual && usuarioActual.rol === 'Supervisor') {
        const opt = document.createElement('option');
        opt.value = usuarioActual.grupo;
        opt.textContent = usuarioActual.grupo;
        selectGrupo.appendChild(opt);
        selectGrupo.value = usuarioActual.grupo;
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

/**
 * Actualiza el select de rutas según el grupo seleccionado.
 */
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

/**
 * Aplica todos los filtros y actualiza el mapa y las tablas.
 */
function aplicarFiltros() {
    const grupoSel = document.getElementById('select-grupo').value;
    const rutaSel = document.getElementById('select-ruta').value;

    // Obtener features de geocercas filtradas
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
    if (diaSeleccionado !== 'NINGUNO') {
        clientesFiltrados = rawClientes.filter(c => {
            const matchGrupo = (grupoSel === 'TODOS') || (c.grupo === grupoSel);
            const matchRuta = (rutaSel === 'TODOS') || (c.ruta === rutaSel);
            let matchDia = false;
            if (diaSeleccionado === 'TODOS') {
                matchDia = true;
            } else {
                const d1 = (c.dia || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const d2 = diaSeleccionado.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                matchDia = (d1 === d2);
            }
            return matchGrupo && matchRuta && matchDia;
        });
    } else {
        clientesFiltrados = [];
    }

    ultimoClientesFiltrados = clientesFiltrados;

    // Renderizar geocercas de distribuidoras (siempre)
    renderizarDistribuidoras(rawDistribuidoras);

    // Renderizar geocercas de rutas
    const geoLayer = renderizarGeocercas(featuresGeocercasFiltradas, rutaSel);

    // Renderizar marcadores y obtener fuera de geocerca
    const { bounds, fuera } = renderizarMarcadores(clientesFiltrados, featuresGeocercasFiltradas);
    ultimoClientesFuera = fuera;

    // Actualizar tablas y KPIs
    actualizarTablaClientes(clientesFiltrados);
    actualizarTablaFuera(fuera);
    actualizarKPIsBasicos(clientesFiltrados.length, fuera.length);
    actualizarKPIsVisitas();

    // Ajustar vista del mapa
    if (bounds.isValid()) {
        const maxZ = rutaSel !== 'TODOS' ? 15 : (grupoSel !== 'TODOS' ? 13 : 11);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: maxZ, animate: true });
    }
}

/**
 * Actualiza la tabla de clientes filtrados.
 */
function actualizarTablaClientes(clientes) {
    const tbody = document.getElementById('tabla-clientes-body');
    tbody.innerHTML = '';
    clientes.slice(0, 300).forEach(c => {
        const isVisited = clientesVisitadosMap.get(c.codigo) || false;
        const tr = document.createElement('tr');
        tr.id = `row-cli-${c.codigo}`;
        tr.className = `clickable-row ${isVisited ? 'visited-row' : ''}`;
        tr.onclick = () => seleccionarClienteEnMapa(c.codigo);
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

/**
 * Actualiza la tabla de clientes fuera de geocerca.
 */
function actualizarTablaFuera(clientesFuera) {
    const tbody = document.getElementById('tabla-fuera-body');
    tbody.innerHTML = '';
    clientesFuera.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = `clickable-row outside-row`;
        tr.onclick = () => seleccionarClienteEnMapa(c.codigo);
        tr.innerHTML = `
            <td style="font-weight: 700; color: #dc2626;">${c.codigo}</td>
            <td>${c.nombre}</td>
            <td><span style="background:#fee2e2; color:#b91c1c; padding:2px 5px; border-radius:4px; font-weight:bold;">${c.ruta}</span></td>
            <td>${c.dia}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Actualiza KPIs básicos (total, fuera).
 */
function actualizarKPIsBasicos(total, fuera) {
    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-fuera').innerText = fuera;
}

/**
 * Actualiza KPIs de visitados, pendientes y porcentaje.
 */
function actualizarKPIsVisitas() {
    let totalFiltrados = ultimoClientesFiltrados.length;
    let visitadosCount = 0;
    ultimoClientesFiltrados.forEach(c => {
        if (clientesVisitadosMap.get(c.codigo) === true) visitadosCount++;
    });
    let pendientesCount = totalFiltrados - visitadosCount;
    let porcentajeAvance = totalFiltrados > 0 ? Math.round((visitadosCount / totalFiltrados) * 100) : 0;

    document.getElementById('kpi-visitados').innerText = visitadosCount;
    document.getElementById('kpi-pendientes').innerText = pendientesCount;
    document.getElementById('kpi-porcentaje').innerText = porcentajeAvance + '%';
}

/**
 * Selecciona un cliente en el mapa (centra y abre popup).
 */
function seleccionarClienteEnMapa(codigo) {
    const marker = clienteMarkersMap[codigo];
    const clientObj = rawClientes.find(c => c.codigo === codigo);
    if (marker && clientObj && clientObj.lat && clientObj.lng) {
        if (window.innerWidth <= 768) {
            const drawer = document.getElementById('mobile-drawer');
            if (!drawer.classList.contains('collapsed')) toggleDrawer();
        }
        map.setView([clientObj.lat, clientObj.lng], 16, { animate: true });
        setTimeout(() => { marker.openPopup(); }, 280);
    } else {
        alert("⚠️ Este cliente no posee coordenadas geográficas válidas.");
    }
}

// Exponer funciones globales para los eventos onclick en HTML
window.alCambiarGrupo = function() {
    actualizarOpcionesRuta();
    aplicarFiltros();
};
window.alCambiarRuta = function() {
    const rutaSel = document.getElementById('select-ruta').value;
    if (rutaSel !== 'TODOS') {
        const clienteRuta = rawClientes.find(c => c.ruta === rutaSel);
        if (clienteRuta && clienteRuta.grupo && usuarioActual && usuarioActual.rol !== 'Supervisor') {
            document.getElementById('select-grupo').value = clienteRuta.grupo;
            actualizarOpcionesRuta();
            document.getElementById('select-ruta').value = rutaSel;
        }
    }
    aplicarFiltros();
};

window.filtrarDia = function(dia, btn) {
    if (diaSeleccionado === dia) {
        diaSeleccionado = 'NINGUNO';
        document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
    } else {
        diaSeleccionado = dia;
        document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    aplicarFiltros();
};

window.toggleDrawer = function() {
    const drawer = document.getElementById('mobile-drawer');
    const label = document.getElementById('drawer-btn-label');
    drawer.classList.toggle('collapsed');
    label.innerHTML = drawer.classList.contains('collapsed') 
        ? '<i class="fa-solid fa-chevron-up"></i> Mostrar Filtros e Indicadores' 
        : '<i class="fa-solid fa-chevron-down"></i> Ocultar';
    setTimeout(() => { if (map) map.invalidateSize(); }, 360);
};