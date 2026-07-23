// =============================================
//  CONFIGURACIÓN DE USUARIOS Y MAPEO DE RUTAS
// =============================================

const USUARIOS_ROLES = [
    { nombre: "JORGE LUIS PINEDA", rol: "Supervisor", grupo: "GRUPO_01", pass: "G01" },
    { nombre: "OSCAR ANTONIO DEL CID", rol: "Supervisor", grupo: "GRUPO_02", pass: "G02" },
    { nombre: "RICARDO ERNESTO RIVAS", rol: "Supervisor", grupo: "GRUPO_03", pass: "G03" },
    { nombre: "NOE ALBERTO CORNEJO", rol: "Supervisor", grupo: "GRUPO_04", pass: "G04" },
    { nombre: "CHRISTIAN CORTEZ", rol: "Supervisor", grupo: "GRUPO_05", pass: "G05" },
    { nombre: "JAIME NAVARRO", rol: "Supervisor", grupo: "GRUPO_06", pass: "G06" },
    { nombre: "RUBEN OCEAS HERNANDEZ", rol: "Supervisor", grupo: "GRUPO_07", pass: "G07" },
    { nombre: "EDWIN ADONAY GALEAS", rol: "Supervisor", grupo: "GRUPO_08", pass: "G08" },
    { nombre: "LUIS ALFREDO LOPEZ", rol: "Supervisor", grupo: "GRUPO_09", pass: "G09" },
    { nombre: "MANUEL ANTONIO ORELLANA", rol: "Supervisor", grupo: "GRUPO_10", pass: "G10" },
    { nombre: "NOE HERNANDEZ", rol: "Jefatura", grupo: "TODOS", pass: "BOCADELI" },
    { nombre: "ALVARO CAMPOS", rol: "Jefatura", grupo: "TODOS", pass: "BOCADELI" },
    { nombre: "JESSICA MEJIA", rol: "Jefatura", grupo: "TODOS", pass: "BOCADELI" },
    { nombre: "WILBER MERCADO", rol: "Jefatura", grupo: "TODOS", pass: "BOCADELI" },
    { nombre: "ISRAEL CONSUEGRA", rol: "Administrador", grupo: "TODOS", pass: "SVCENTRO" },
    { nombre: "PAOLA CASTANEDA", rol: "Analista", grupo: "TODOS", pass: "SVCENTRO" },
    { nombre: "ALDAHIR RODRIGUEZ", rol: "Analista", grupo: "TODOS", pass: "SVCENTRO" },
    { nombre: "RENE DOMINGUEZ", rol: "Analista", grupo: "TODOS", pass: "SVCENTRO" },
    { nombre: "JACQUELINE GUILLEN", rol: "Analista", grupo: "TODOS", pass: "SVCENTRO" },
    { nombre: "OSCAR BARRERA", rol: "Analista", grupo: "TODOS", pass: "SVCENTRO" }
];

const MAPEO_RUTAS_GRUPOS = {
    '1.1.54': 'GRUPO_02',
    '1.1.51': 'GRUPO_05',
    '1.2.45': 'GRUPO_06',
    '1.2.46': 'GRUPO_06'
};