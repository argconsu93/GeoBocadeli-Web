// =============================================
//  APLICACIÓN PRINCIPAL - LOGIN Y ORQUESTACIÓN
// =============================================

let usuarioActual = null;

/**
 * Poblar el select del modal de login con los nombres de usuarios.
 */
function poblarModalLogin() {
    const selectLogin = document.getElementById('select-usuario-login');
    selectLogin.innerHTML = '<option value="">-- Seleccione su Nombre --</option>';
    const sorted = [...USUARIOS_ROLES].sort((a, b) => a.nombre.localeCompare(b.nombre));
    sorted.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.nombre;
        opt.textContent = u.nombre;
        selectLogin.appendChild(opt);
    });
}

/**
 * Validar credenciales de login.
 */
function validarLogin() {
    const nombreSel = document.getElementById('select-usuario-login').value;
    const passInput = document.getElementById('input-password').value.trim().toLowerCase();
    const errorDiv = document.getElementById('login-error');

    if (!nombreSel) {
        errorDiv.textContent = "⚠️ Por favor seleccione su nombre.";
        errorDiv.style.display = 'block';
        return;
    }

    const userObj = USUARIOS_ROLES.find(u => u.nombre === nombreSel);
    if (userObj && passInput === userObj.pass.toLowerCase()) {
        usuarioActual = userObj;
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('txt-rol-activo').textContent = `${usuarioActual.nombre} (${usuarioActual.rol})`;
        
        if (usuarioActual.rol === 'Administrador') {
            document.getElementById('panel-admin-actualizacion').style.display = 'flex';
        } else {
            document.getElementById('panel-admin-actualizacion').style.display = 'none';
        }

        // Inicializar dashboard con permisos
        inicializarMapa();
        poblarFiltrosPermitidos();
        aplicarFiltros();
    } else {
        errorDiv.textContent = "⚠️ Contraseña incorrecta. Verifique e intente de nuevo.";
        errorDiv.style.display = 'block';
    }
}

/**
 * Cerrar sesión.
 */
function cerrarSesion() {
    usuarioActual = null;
    document.getElementById('input-password').value = '';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    if (map) {
        map.remove();
        map = null;
    }
}

/**
 * Actualizar la fecha actual en el header.
 */
function actualizarFechaActual() {
    const fecha = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let fechaTexto = fecha.toLocaleDateString('es-ES', opciones);
    document.getElementById('fecha-actual').textContent = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);
}

/**
 * Descargar clientes visitados en XLSX.
 */
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

/**
 * Descargar itinerario filtrado en XLSX.
 */
function descargarItinerarioFiltrado() {
    if (!ultimoClientesFiltrados || ultimoClientesFiltrados.length === 0) {
        alert("⚠️ No hay clientes disponibles en la lista con los filtros seleccionados.");
        return;
    }
    const grupoSel = document.getElementById('select-grupo').value;
    const rutaSel = document.getElementById('select-ruta').value;
    const diaSel = diaSeleccionado;

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
    const nombreDia = diaSel !== 'TODOS' && diaSel !== 'NINGUNO' ? `_Dia_${diaSel}` : '';

    XLSX.writeFile(workbook, `Itinerario_${nombreGrupo}_${nombreRuta}${nombreDia}.xlsx`);
}

// ===== EVENTOS Y ARRANQUE =====

document.addEventListener('DOMContentLoaded', function() {
    // Fecha actual
    actualizarFechaActual();

    // Poblar login
    poblarModalLogin();

    // Botón de login
    document.getElementById('btn-login').addEventListener('click', validarLogin);
    document.getElementById('input-password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') validarLogin();
    });

    // Botón de logout
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

    // Eventos de filtros
    document.getElementById('select-grupo').addEventListener('change', window.alCambiarGrupo);
    document.getElementById('select-ruta').addEventListener('change', window.alCambiarRuta);

    // Eventos de botones de día
    document.querySelectorAll('.btn-day').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const dia = this.getAttribute('data-dia');
            window.filtrarDia(dia, this);
        });
    });

    // Drawer handle (mobile)
    document.getElementById('drawer-handle').addEventListener('click', window.toggleDrawer);

    // Botones de descarga
    document.getElementById('btn-download-visited').addEventListener('click', descargarClientesVisitados);
    document.getElementById('btn-download-itinerary').addEventListener('click', descargarItinerarioFiltrado);

    // Cargar datos iniciales y luego mostrar login
    cargarDatosIniciales().then(() => {
        // Los datos ya están en memoria
        // El login se muestra por defecto, el usuario debe autenticarse
        console.log('Datos cargados correctamente.');
    }).catch(err => {
        console.warn('Error al cargar datos iniciales, se usará datos vacíos', err);
        // Aún así se puede continuar
    });
});