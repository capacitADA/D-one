// ============================================
// D1 - COORDINADOR DE MANTENIMIENTO CEDI
// Versión CEDI Ibagué · Region 3
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDw1faNff7uMXR6JbHOhZa7eA5WiiNAJNw",
    authDomain: "donecapacitada-4fa37.firebaseapp.com",
    projectId: "donecapacitada-4fa37",
    storageBucket: "donecapacitada-4fa37.firebasestorage.app",
    messagingSenderId: "449540711283",
    appId: "1:449540711283:web:01efe4696daafc4e215b06"
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYWgupeHfhfKmvMDk_FFsTj-P9PdJfXMn3pheGjFMXK7i43AW1V8A5BD4iCSbOho9c/exec';

const D1_LOGO = 'https://raw.githubusercontent.com/capacitADA/D-one/main/D1_logo.png';

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ===== DRIVE =====
let _driveConnected = false;
function driveIsConnected() { return _driveConnected; }

async function conectarDriveAuto() {
    try {
        await fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'no-cors' });
        _driveConnected = true;
    } catch (e) {
        _driveConnected = false;
    }
}

async function driveUploadPDF(html, filename) {
    if (!filename.endsWith('.pdf')) filename = filename.replace('.html', '') + '.pdf';
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html, filename })
        });
        return true;
    } catch(e) { return false; }
}

// ===== DATOS GLOBALES =====
// cedis = los "clientes" (CEDIs), cada uno tiene region
// equipos = activos del CEDI
// servicios = servicios/mantenimientos
// tecnicos = personal tecnico
// tiendas = ubicaciones de tiendas D1 (ex jmc_tiendas)
let cedis = [], equipos = [], servicios = [], tecnicos = [];
let tiendas = [];
let tiendasVersion = '';

// ===== CARGAR DATOS =====
async function cargarDatos() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando...</p></div>';
    try {
        const [cs, es, ss, ts, ti] = await Promise.all([
            getDocs(query(collection(db, 'cedis'), orderBy('nombre'))),
            getDocs(collection(db, 'equipos')),
            getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc'))),
            getDocs(collection(db, 'tecnicos')),
            getDocs(collection(db, 'd1_tiendas'))
        ]);
        cedis = cs.docs.map(d => ({ id: d.id, ...d.data() }));
        equipos = es.docs.map(d => ({ id: d.id, ...d.data() }));
        servicios = ss.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos = ts.docs.map(d => ({ id: d.id, ...d.data() }));
        tiendas = ti.docs.map(d => ({ id: d.id, ...d.data() }));
        if (tiendas.length > 0 && tiendas[0].version) tiendasVersion = tiendas[0].version;
    } catch (err) {
        console.error('Error:', err);
        toast('⚠️ Error de conexión');
        main.innerHTML = '<div class="page" style="text-align:center;padding:2rem;"><p>⚠️ Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

// ===== SEMBRAR DATOS INICIALES =====
async function sembrarDatos() {
    const snap = await getDocs(collection(db, 'tecnicos'));
    if (!snap.empty) return;
    toast('⚙️ Configurando app...');

    // CEDI inicial: Ibagué · Región 3
    const cRef = await addDoc(collection(db, 'cedis'), {
        nombre: 'CEDI Ibague',
        region: 'Region 3',
        telefono: '3100000001',
        email: 'cedi.ibague@d1.com.co',
        ciudad: 'Ibague',
        direccion: 'Calle 60 # 5 - 120, Ibague, Tolima',
        latitud: '4.4378',
        longitud: '-75.2012',
        fechaCreacion: new Date().toISOString().split('T')[0]
    });

    await addDoc(collection(db, 'equipos'), {
        cediId: cRef.id,
        marca: 'Carrier',
        modelo: 'XPower 48000',
        serie: 'CA-2023-00001',
        ubicacion: 'Bodega Principal',
        tipo: 'Aire Acondicionado Industrial'
    });

    // Técnico administrador: Carlos Monsalve
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Carlos Monsalve',
        cedula: '0000001',
        tipoDoc: 'CC',
        telefono: '3114831801',
        cargo: 'Coordinador de Mantenimiento',
        rol: 'admin',
        especialidades: ['mecanico', 'baja', 'media', 'electronico', 'ups', 'planta'],
        region: 'Region 3',
        clave: '1234'
    });

    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Juan Perez',
        cedula: '10234568',
        tipoDoc: 'CC',
        telefono: '3120000002',
        cargo: 'Tecnico de Campo',
        rol: 'tecnico',
        especialidades: ['baja', 'media'],
        region: 'Region 3',
        clave: '5678'
    });

    toast('✅ Listo. Cedula: 0000001 · Clave: 1234');
}

// ===== CSV DE TIENDAS =====
async function guardarTiendasD1(nuevas, version) {
    const snapshot = await getDocs(collection(db, 'd1_tiendas'));
    const batch = writeBatch(db);
    snapshot.forEach(d => batch.delete(d.ref));
    await batch.commit();
    for (const t of nuevas) {
        await addDoc(collection(db, 'd1_tiendas'), { ...t, version });
    }
}

async function subirCSVTiendas(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        const lines = ev.target.result.split('\n').filter(l => l.trim());
        const nuevas = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length >= 8 && cols[0]) {
                nuevas.push({
                    sap: cols[0], tienda: cols[1], ciudad: cols[2],
                    departamento: cols[3], direccion: cols[4],
                    coordinador: cols[5], cargo: cols[6], telefono: cols[7]
                });
            }
        }
        if (!nuevas.length) { toast('⚠️ CSV invalido'); return; }
        const version = `${file.name} · ${new Date().toISOString().split('T')[0]}`;
        await guardarTiendasD1(nuevas, version);
        tiendas = nuevas;
        tiendasVersion = version;
        input.value = '';
        renderView();
        toast(`✅ ${nuevas.length} tiendas guardadas`);
    };
    reader.readAsText(file, 'UTF-8');
}

function descargarPlantillaCSV() {
    const enc = 'SAP,TIENDA,CIUDAD,DEPARTAMENTO,DIRECCION,COORDINADOR,CARGO,TELEFONO';
    const filas = tiendas.length > 0
        ? tiendas.slice(0,3).map(t => [t.sap, t.tienda, t.ciudad, t.departamento, t.direccion, t.coordinador, t.cargo, t.telefono].join(','))
        : ['1001,D1 El Jardin,Ibague,Tolima,Carrera 5 # 20-10,Ana Torres,Coordinador Tienda,3100000001'];
    const csv = [enc, ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'D1_Tiendas_Plantilla.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('📄 Plantilla descargada');
}

function getTiendaD1(sap) { return tiendas.find(t => t.sap === String(sap)); }

// ===== HELPERS =====
const getEq   = id => equipos.find(e => e.id === id);
const getCedi = id => cedis.find(c => c.id === id);
const getTec  = id => tecnicos.find(t => t.id === id);
const getEquiposCedi   = cid => equipos.filter(e => e.cediId === cid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosCedi   = cid => servicios.filter(s => getEquiposCedi(cid).some(e => e.id === s.equipoId));

function fmtFecha(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES');
}
function fmtFechaLarga(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function getMesActual() { return new Date().toISOString().slice(0, 7); }

function esAdmin() { return sesionActual?.rol === 'admin'; }
function esPropietario(creadoPor) { return sesionActual?.nombre === creadoPor; }
function puedeEditar(creadoPor) { return esAdmin() || esPropietario(creadoPor); }

function toast(msg, duration = 3000) {
    const t = document.getElementById('toastEl');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

function showModal(html) {
    const ov = document.getElementById('overlayEl');
    ov.innerHTML = html;
    ov.classList.remove('hidden');
    ov.onclick = e => { if (e.target === ov) closeModal(); };
}
function closeModal() {
    const ov = document.getElementById('overlayEl');
    ov.classList.add('hidden');
    ov.innerHTML = '';
    fotosNuevas = [null, null, null];
}

function actualizarTopbar() {
    const right = document.getElementById('topbarRight');
    if (!right) return;
    if (!sesionActual) {
        right.innerHTML = `<span class="topbar-user">Sin sesion</span>`;
    } else {
        const initials = sesionActual.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
        const rolBadge = esAdmin() ? `<span class="topbar-rol-badge">Admin</span>` : '';
        right.innerHTML = `
            <div class="topbar-sesion">
                <div class="topbar-avatar">${initials}</div>
                <div>
                    <div style="font-size:0.68rem;color:white;font-weight:700;">${sesionActual.nombre.split(' ')[0]}</div>
                    ${rolBadge}
                </div>
                <button class="topbar-salir" onclick="cerrarSesion()">Salir</button>
            </div>`;
    }
}

function cerrarSesion() {
    sesionActual = null;
    actualizarTopbar();
    renderView();
    toast('👋 Sesion cerrada');
}

// ===== ESTADO =====
let currentView = 'panel';
let sesionActual = null;
let selectedCediId = null;
let selectedEquipoId = null;
let fotosNuevas = [null, null, null];
let _servicioEidActual = null;

const CIUDADES = ['Ibague', 'Espinal', 'Melgar', 'Honda', 'Mariquita', 'Girardot',
    'Bogota', 'Medellin', 'Cali', 'Bucaramanga', 'Barranquilla',
    'Manizales', 'Pereira', 'Villavicencio'];

const REGIONES = ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'Region 6'];

const TIPOS_DOC = ['CC', 'CE', 'PA', 'NIT', 'TI'];

const ESPECIALIDADES = [
    { id: 'mecanico', label: 'Mecanico de plantas' },
    { id: 'baja', label: 'Electricista baja tension' },
    { id: 'media', label: 'Electricista media tension' },
    { id: 'electronico', label: 'Electronico' },
    { id: 'ups', label: 'UPS' },
    { id: 'planta', label: 'Plantas electricas' }
];

// ===== NAVEGACION =====
function goTo(view, cid = null, eid = null) {
    currentView = view;
    selectedCediId = cid;
    selectedEquipoId = eid;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'detalle' && b.dataset.page === 'cedis') ||
            (view === 'historial' && b.dataset.page === 'cedis'));
    });
}

function renderView() {
    if (!sesionActual && currentView !== 'panel' && currentView !== 'tecnicos') {
        currentView = 'panel';
    }
    const main = document.getElementById('mainContent');
    document.getElementById('botnavEl').style.display = 'flex';

    switch (currentView) {
        case 'panel':        main.innerHTML = renderPanel(); break;
        case 'cedis':        main.innerHTML = renderCedis(); break;
        case 'detalle':      main.innerHTML = renderDetalleCedi(); break;
        case 'historial':    main.innerHTML = renderHistorial(); break;
        case 'equipos':      main.innerHTML = renderEquipos(); break;
        case 'tiendas':      main.innerHTML = renderTiendas(); break;
        case 'agenda':       main.innerHTML = renderAgenda(); break;
        case 'tecnicos':     main.innerHTML = renderTecnicos(); break;
        default:             main.innerHTML = renderPanel();
    }
}

// ===== PANEL =====
function renderPanel() {
    const mes = getMesActual();
    const man = servicios.filter(s => s.tipo === 'Mantenimiento');
    const rep = servicios.filter(s => s.tipo === 'Reparacion');
    const inst = servicios.filter(s => s.tipo === 'Instalacion');
    const manM = man.filter(s => s.fecha?.startsWith(mes));
    const repM = rep.filter(s => s.fecha?.startsWith(mes));
    const instM = inst.filter(s => s.fecha?.startsWith(mes));
    const nuevosMes = cedis.filter(c => c.fechaCreacion?.startsWith(mes)).length;

    // Agrupar CEDIs por región
    const regionesMap = {};
    cedis.forEach(c => {
        const r = c.region || 'Sin Region';
        if (!regionesMap[r]) regionesMap[r] = 0;
        regionesMap[r]++;
    });

    return `<div class="page">
        <div class="panel-banner">
            <div class="panel-banner-sub">Coordinacion de Mantenimiento</div>
            <div class="panel-banner-title">Panel CEDI</div>
            <div style="font-size:0.75rem;opacity:0.8;">Region 3 · Ibague</div>
        </div>
        <div class="panel-grid">
            <div class="panel-col">
                <div class="panel-col-head">CEDIs</div>
                <div class="panel-box gold-box"><div class="panel-box-num">${cedis.length}</div><div class="panel-box-lbl">TOTAL</div></div>
                <div class="panel-box gold-box"><div class="panel-box-num">${nuevosMes}</div><div class="panel-box-lbl">NUEVOS MES</div></div>
                ${Object.entries(regionesMap).map(([r,n])=>`<div class="panel-box gold-box" style="font-size:0.7rem;"><div class="panel-box-num" style="font-size:1.1rem;">${n}</div><div class="panel-box-lbl">${r}</div></div>`).join('')}
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box anual-box"><div class="panel-box-lbl">ANUAL</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${man.length}</div><div class="panel-box-lbl">MANTENIMIENTO</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${rep.length}</div><div class="panel-box-lbl">REPARACION</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${inst.length}</div><div class="panel-box-lbl">INSTALACION</div></div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box mensual-box"><div class="panel-box-lbl">MENSUAL</div></div>
                <div class="panel-box mensual-box"><div class="panel-box-num">${manM.length}</div><div class="panel-box-lbl">MANTENIMIENTO</div></div>
                <div class="panel-box mensual-box"><div class="panel-box-num">${repM.length}</div><div class="panel-box-lbl">REPARACION</div></div>
                <div class="panel-box mensual-box"><div class="panel-box-num">${instM.length}</div><div class="panel-box-lbl">INSTALACION</div></div>
            </div>
        </div>
    </div>`;
}

// ===== CEDIS (antes Clientes) =====
function renderCedis() {
    // Agrupar por región
    const porRegion = {};
    cedis.forEach(c => {
        const r = c.region || 'Sin Region';
        if (!porRegion[r]) porRegion[r] = [];
        porRegion[r].push(c);
    });

    return `<div class="page">
        <div class="sec-head"><h2>CEDIs (${cedis.length})</h2>${esAdmin()?`<button class="btn btn-blue btn-sm" onclick="modalNuevoCedi()">+ Nuevo CEDI</button>`:''}</div>
        <input class="search" placeholder="🔍 Buscar CEDI..." oninput="filtrarCedis(this.value)" id="searchCedis">
        <div id="cedisGrid">
            ${Object.entries(porRegion).map(([region, lista]) => `
            <div class="region-header">📍 ${region}</div>
            ${lista.map(c => `
            <div class="cc" data-search="${(c.nombre+c.ciudad+(c.region||'')+c.telefono).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;">
                    <div class="cc-name">${c.nombre}</div>
                    ${esAdmin() ? `<div><button class="ib" onclick="modalEditarCedi('${c.id}')">✏️</button><button class="ib" onclick="modalEliminarCedi('${c.id}')">🗑️</button></div>` : ''}
                </div>
                <div class="cc-row">📞 ${c.telefono}</div>
                ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
                <div class="cc-row">📍 ${c.direccion}</div>
                <span class="city-tag">${c.ciudad}</span>
                <span class="city-tag" style="background:#e0e7ff;color:#3730a3;">${c.region||'Sin Region'}</span>
                ${c.latitud ? `<div><a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver GPS</a></div>` : ''}
                <div class="cc-meta">${getEquiposCedi(c.id).length} activo(s) · ${getServiciosCedi(c.id).length} servicio(s)</div>
                <button class="link-btn" onclick="goTo('detalle','${c.id}')">Ver activos →</button>
            </div>`).join('')}`).join('')}
        </div>
    </div>`;
}

function filtrarCedis(v) {
    const txt = v.toLowerCase();
    document.querySelectorAll('#cedisGrid .cc').forEach(c => {
        c.style.display = (c.dataset.search||'').includes(txt) ? '' : 'none';
    });
}

// ===== DETALLE CEDI =====
function renderDetalleCedi() {
    const c = getCedi(selectedCediId);
    if (!c) { goTo('cedis'); return ''; }
    const eqs = getEquiposCedi(c.id);
    return `<div class="page">
        <div class="det-hdr"><button class="back" onclick="goTo('cedis')">← Volver</button><div><div class="cc-name">${c.nombre}</div><div class="cc-meta">${c.ciudad} · ${c.region||''}</div></div></div>
        <div class="info-box">
            <div class="cc-row">📞 <strong>${c.telefono}</strong></div>
            ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
            <div class="cc-row">📍 ${c.direccion}</div>
            ${c.latitud ? `<a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver en Google Maps</a>` : '<div class="cc-meta">Sin GPS</div>'}
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:0.65rem;"><span style="font-weight:700;">Activos (${eqs.length})</span>${esAdmin()?`<button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${c.id}')">+ Activo</button>`:''}</div>
        ${eqs.map(e => `
        <div class="ec">
            <div style="display:flex;justify-content:space-between;">
                <div><div class="ec-name">${e.marca} ${e.modelo}</div><div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie||'S/N'}</div><div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s)</div></div>
                ${esAdmin() ? `<div><button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button><button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button></div>` : ''}
            </div>
            <div class="ec-btns">
                <button class="ab" onclick="goTo('historial','${c.id}','${e.id}')">📋 Servicios</button>
                <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
                <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
            </div>
        </div>`).join('')}
    </div>`;
}

// ===== HISTORIAL =====
function renderHistorial() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('cedis'); return ''; }
    const c = getCedi(e.cediId);
    const ss = getServiciosEquipo(e.id).sort((a,b) => new Date(b.fecha)-new Date(a.fecha));
    return `<div class="page">
        <div class="det-hdr"><button class="back" onclick="goTo('detalle','${e.cediId}')">← Volver</button><div><div class="ec-name">${e.marca} ${e.modelo}</div><div class="ec-meta">${e.ubicacion} · ${c?.nombre}</div></div></div>
        <div style="margin-bottom:2rem;"><span style="font-weight:700;">Historial (${ss.length})</span></div>
        ${ss.map(s => `
        <div class="si">
            <div class="si-top"><span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparacion'?'b-red':'b-green'}">${s.tipo}</span><span style="font-size:2rem;color:var(--hint);">${fmtFecha(s.fecha)}</span></div>
            <div class="si-info">🔧 ${s.tecnico}</div>
            <div class="si-info">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div class="si-info" style="color:var(--gold);">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">${(s.fotos||[]).map(f => `<img class="fthumb" src="${f}" loading="lazy">`).join('')}</div>
            <div class="si-top" style="justify-content:flex-end;margin-top:4px;">
                ${puedeEditar(s.tecnico) ? `<button class="ib" onclick="modalEditarServicio('${s.id}')">✏️</button>` : ''}
                ${esAdmin() ? `<button class="ib" onclick="eliminarServicio('${s.id}')">🗑️</button>` : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

// ===== EQUIPOS (activos de todos los CEDIs) =====
function renderEquipos() {
    return `<div class="page">
        <div class="sec-head"><h2>Activos (${equipos.length})</h2></div>
        <input class="search" placeholder="🔍 Buscar activo..." oninput="filtrarEquipos(this.value)" id="searchEq">
        <div id="equiposGrid">
        ${equipos.map(e => {
            const c = getCedi(e.cediId);
            return `<div class="ec" data-search="${(e.marca+e.modelo+(c?.nombre||'')+e.ubicacion).toLowerCase()}">
                <div class="ec-name">${e.marca} ${e.modelo}</div>
                <div class="ec-meta">🏭 ${c?.nombre||'Sin CEDI'} · 📍 ${e.ubicacion}</div>
                ${e.tipo ? `<div class="ec-meta">⚙️ ${e.tipo}</div>` : ''}
                <div class="ec-btns">
                    <button class="ab" onclick="goTo('historial','${e.cediId}','${e.id}')">📋 Servicios</button>
                    <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
                    <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                    <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
                </div>
            </div>`;
        }).join('')}
        </div>
    </div>`;
}

function filtrarEquipos(v) {
    document.querySelectorAll('#equiposGrid .ec').forEach(c => {
        c.style.display = (c.dataset.search||'').includes(v.toLowerCase()) ? '' : 'none';
    });
}

// ===== TIENDAS D1 (ex Servicios) =====
function renderTiendas() {
    return `<div class="page">
        <div class="sec-head"><h2>Tiendas D1 (${tiendas.length})</h2></div>
        ${esAdmin() ? `<div style="background:white;border-radius:12px;padding:0.85rem;margin-bottom:1rem;">
            <div style="font-weight:700;margin-bottom:0.4rem;">📥 Cargar directorio de tiendas</div>
            <div class="ec-meta" style="margin-bottom:0.4rem;">Version: ${tiendasVersion||'Sin datos'} · ${tiendas.length} tiendas</div>
            <label class="btn btn-blue btn-sm" style="display:inline-block;margin:4px;">📥 Subir CSV<input type="file" accept=".csv" style="display:none;" onchange="subirCSVTiendas(this)"></label>
            <button class="btn btn-gray btn-sm" onclick="descargarPlantillaCSV()">📄 Plantilla</button>
        </div>` : ''}
        <input class="search" placeholder="🔍 Buscar tienda, ciudad, SAP..." oninput="filtrarTiendas(this.value)" id="searchTiendas">
        <div id="tiendasGrid">
            ${tiendas.length === 0 ? `<div style="text-align:center;padding:2rem;color:var(--hint);">Sin tiendas cargadas. Sube un CSV para comenzar.</div>` : ''}
            ${tiendas.map(t => `
            <div class="cc" data-search="${(t.tienda+t.ciudad+t.sap+t.departamento+t.coordinador).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;">
                    <div class="cc-name">${t.tienda}</div>
                    <span class="city-tag" style="background:#fee2e2;color:#b91c1c;">SAP ${t.sap}</span>
                </div>
                <div class="cc-row">📍 ${t.direccion}</div>
                <span class="city-tag">${t.ciudad}</span>
                <span class="city-tag" style="background:#f0fdf4;color:#166534;">${t.departamento}</span>
                <div class="cc-row">👤 ${t.coordinador} · ${t.cargo}</div>
                <div class="cc-row">📞 ${t.telefono}</div>
                <a href="https://wa.me/57${t.telefono.replace(/\D/g,'')}?text=${encodeURIComponent('Hola '+t.coordinador+', soy del equipo de mantenimiento D1.')}" target="_blank" class="btn btn-wa btn-sm btn-full" style="margin-top:6px;">📱 WhatsApp</a>
            </div>`).join('')}
        </div>
    </div>`;
}

function filtrarTiendas(v) {
    const txt = v.toLowerCase();
    document.querySelectorAll('#tiendasGrid .cc').forEach(c => {
        c.style.display = (c.dataset.search||'').includes(txt) ? '' : 'none';
    });
}

// ===== AGENDA (solo activos de CEDI) =====
function renderAgenda() {
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const año = new Date().getFullYear();
    const mant = servicios.filter(s => s.proximoMantenimiento);
    return `<div class="page">
        <div class="sec-head"><h2>Agenda ${año}</h2></div>
        <div class="tbl-wrap">
            <table>
                <thead><tr><th>Mes</th><th>Fecha</th><th>CEDI</th><th>Activo</th><th>Ubic.</th><th></th></tr></thead>
                <tbody>
                ${MESES.map((mes,idx) => {
                    const mp = String(idx+1).padStart(2,'0');
                    const lista = mant.filter(m=>m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                    if (!lista.length) return `<tr><td style="color:var(--hint);">${mes}</td><td colspan="5" style="color:#cbd5e1;">—</td></tr>`;
                    return lista.map((m,i) => {
                        const e = getEq(m.equipoId);
                        const c = getCedi(e?.cediId);
                        return `<tr>
                            ${i===0?`<td rowspan="${lista.length}" style="font-weight:700;background:var(--bg2);">${mes}</td>`:''}
                            <td>${fmtFecha(m.proximoMantenimiento)}</td>
                            <td>${c?.nombre||'N/A'}</td>
                            <td>${e?`${e.marca} ${e.modelo}`:'N/A'}</td>
                            <td style="font-size:0.75rem;">${e?.ubicacion||''}</td>
                            <td><button class="rec-btn" onclick="modalRecordar('${e?.cediId}','${e?.id}','${m.proximoMantenimiento}')">📱</button></td>
                        </tr>`;
                    }).join('');
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

// ===== TECNICOS =====
function renderTecnicos() {
    return `<div class="page">
        <div class="sec-head"><h2>Tecnicos (${tecnicos.length})</h2>${esAdmin() ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>` : ''}</div>
        ${tecnicos.map(t => {
            const esps = (t.especialidades||[]).map(id => ESPECIALIDADES.find(e=>e.id===id)?.label||id);
            return `<div class="ec">
                <div style="display:flex;justify-content:space-between;">
                    <div><div class="ec-name">${t.nombre}</div><div class="ec-meta">${t.tipoDoc} · ${t.cedula}</div><div class="ec-meta">${t.cargo}</div><div class="ec-meta">📞 ${t.telefono}</div></div>
                    <div><span class="tc-rol-badge ${t.rol==='admin'?'rol-admin':'rol-tec'}">${t.rol==='admin'?'Admin':'Tecnico'}</span>${esAdmin() ? `<div><button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button><button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button></div>` : ''}</div>
                </div>
                <div>${esps.map(e=>`<span class="esp-chip">${e}</span>`).join('')}</div>
                <div class="ec-meta">📍 ${t.region||'Sin region'}</div>
                <button class="btn btn-blue btn-sm btn-full" onclick="abrirLogin('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button>
            </div>`;
        }).join('')}
    </div>`;
}

// ===== LOGIN / SESIÓN =====
function abrirLogin(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal" style="max-width:320px;"><div class="modal-h"><h3>🔑 Ingresar</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div style="font-weight:700;">${t.nombre}</div><div class="ec-meta">${t.cargo}</div><label class="fl">Cedula</label><input class="fi" id="mlCedula" type="number"><label class="fl">Clave (4 digitos)</label><div class="pin-display"><div class="pin-digit" id="mlpd0"></div><div class="pin-digit" id="mlpd1"></div><div class="pin-digit" id="mlpd2"></div><div class="pin-digit" id="mlpd3"></div></div><div class="numpad">${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="num-btn" onclick="mlPin('${tid}',${n})">${n}</div>`).join('')}<div class="num-btn del" onclick="mlDel()">⌫</div><div class="num-btn zero" onclick="mlPin('${tid}',0)">0</div><div class="num-btn ok" onclick="mlLogin('${tid}')">✓</div></div><div id="mlMsg"></div><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="mlLogin('${tid}')">Ingresar</button></div></div></div>`);
    window._mlPin = '';
}

let mlPinActual = '';
function mlPin(tid, n) { if (mlPinActual.length >= 4) return; mlPinActual += String(n); mlUpdateDisplay(); if (mlPinActual.length === 4) mlLogin(tid); }
function mlDel() { mlPinActual = mlPinActual.slice(0,-1); mlUpdateDisplay(); }
function mlUpdateDisplay() { for (let i=0;i<4;i++) { const d = document.getElementById('mlpd'+i); if(!d) return; d.className='pin-digit'; if(i<mlPinActual.length){ d.textContent='●'; d.classList.add('filled'); } else if(i===mlPinActual.length){ d.textContent='_'; d.classList.add('active'); } else { d.textContent=''; } } }
function mlLogin(tid) {
    const t = getTec(tid);
    const cedula = document.getElementById('mlCedula')?.value?.trim();
    const msg = document.getElementById('mlMsg');
    if (!cedula) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Cedula requerida</div>'; return; }
    if (mlPinActual.length<4) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Clave de 4 digitos</div>'; return; }
    if (t.cedula !== cedula || t.clave !== mlPinActual) { if(msg) msg.innerHTML='<div class="login-error">❌ Credenciales incorrectas</div>'; mlPinActual=''; mlUpdateDisplay(); return; }
    sesionActual = t;
    mlPinActual = '';
    closeModal();
    actualizarTopbar();
    currentView='panel';
    renderView();
    toast(`✅ Bienvenido, ${t.nombre.split(' ')[0]}`);
}

// ===== RECORDATORIO WHATSAPP =====
function modalRecordar(cediId, equipoId, fecha) {
    const e = getEq(equipoId);
    const c = getCedi(cediId);
    const fechaF = fmtFechaLarga(fecha);
    const tel = c?.telefono || '';
    const msg = `Hola *${c?.nombre}*, recordatorio: activo *${e?.marca} ${e?.modelo}* ubicado en *${e?.ubicacion}* requiere mantenimiento el *${fechaF}*. D1 Mantenimiento CEDI 📞 ${sesionActual?.telefono||''}`;
    showModal(`<div class="modal"><div class="modal-h"><h3>📱 Recordatorio WhatsApp</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div class="ec-meta">Para <strong>${c?.nombre}</strong> · 📞 ${tel}</div><div class="wa-bubble">${msg}</div><textarea class="fi" id="waMsgEdit" rows="4">${msg}</textarea><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-wa" onclick="enviarWhatsApp('${tel}')">📱 Abrir WhatsApp</button></div></div></div>`);
}

function enviarWhatsApp(tel) {
    const msg = document.getElementById('waMsgEdit')?.value||'';
    const telLimpio = '57' + tel.replace(/\D/g,'');
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    closeModal();
    toast('📱 WhatsApp abierto');
}

// ===== FOTOS =====
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function previewFoto(input, idx) {
    if (!input.files || !input.files[0]) return;
    fotosNuevas[idx] = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const slot = document.getElementById('fslot' + idx);
        if (slot) slot.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"><button class="fslot-del" onclick="borrarFoto(event,${idx})">✕</button><input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
    };
    reader.readAsDataURL(input.files[0]);
}

function borrarFoto(e, idx) {
    e.stopPropagation();
    fotosNuevas[idx] = null;
    const slot = document.getElementById('fslot' + idx);
    if (slot) {
        slot.innerHTML = `<div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${idx+1}</div><input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick = () => document.getElementById('finput' + idx).click();
    }
}

// ===== NUEVO SERVICIO =====
function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const box = document.getElementById('mantBox');
    if (box) box.classList.toggle('hidden', tipo !== 'Mantenimiento');
}

function modalNuevoServicio(eid) {
    if (!sesionActual) { toast('🔑 Inicia sesion para continuar'); return; }
    const e = getEq(eid);
    const c = getCedi(e?.cediId);
    const hoy = new Date().toISOString().split('T')[0];
    fotosNuevas = [null, null, null];
    _servicioEidActual = eid;

    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="background:var(--bg2);padding:0.55rem;border-radius:8px;margin-bottom:0.65rem;">
                <strong>${c?.nombre}</strong> <span style="font-size:0.72rem;color:var(--green);">${c?.region||''}</span><br>
                <span style="font-size:0.75rem;">${e?.marca} ${e?.modelo} · 📍 ${e?.ubicacion}</span>
            </div>
            <div class="fr">
                <div><label class="fl">Tipo *</label><select class="fi" id="sTipo" onchange="onTipoChange()"><option>Mantenimiento</option><option>Reparacion</option><option>Instalacion</option></select></div>
                <div><label class="fl">Fecha *</label><input class="fi" type="date" id="sFecha" value="${hoy}"></div>
            </div>
            <label class="fl">Tecnico</label>
            <input class="fi" id="sTecnico" value="${sesionActual?.nombre||''}" readonly>
            <label class="fl">Diagnostico / Descripcion *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado..."></textarea>
            <div class="mant-box hidden" id="mantBox">
                <label class="fl">📅 Proximo mantenimiento</label>
                <input class="fi" type="date" id="proxFecha">
            </div>
            <label class="fl">📷 Fotos (max 3)</label>
            <div class="foto-row">
                ${[0,1,2].map(i => `<div style="flex:1;"><div class="fslot" id="fslot${i}" onclick="document.getElementById('finput${i}').click()"><div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${i+1}</div><input type="file" id="finput${i}" accept="image/*" style="display:none" onchange="previewFoto(this,${i})"></div></div>`).join('')}
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarServicio('${eid}')">💾 Guardar</button>
            </div>
        </div>
    </div>`);
    onTipoChange();
}

async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if(!desc){ toast('⚠️ Ingresa el diagnostico'); return; }
    const tipo = document.getElementById('sTipo').value;
    const fecha = document.getElementById('sFecha').value;
    const prox = tipo === 'Mantenimiento' ? (document.getElementById('proxFecha')?.value || null) : null;
    const fotosBase64 = [];
    for (let i = 0; i < fotosNuevas.length; i++) {
        if (fotosNuevas[i]) {
            const base64 = await fileToBase64(fotosNuevas[i]);
            fotosBase64.push(base64);
        }
    }
    try {
        await addDoc(collection(db, 'servicios'), {
            equipoId: eid, tipo, fecha,
            tecnico: sesionActual?.nombre || '',
            descripcion: desc,
            proximoMantenimiento: prox,
            fotos: fotosBase64
        });
        closeModal();
        await cargarDatos();
        const e = getEq(eid);
        if(e) goTo('historial', e.cediId, eid);
        toast('✅ Servicio guardado con ' + fotosBase64.length + ' foto(s)');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarServicio(sid) {
    const s = servicios.find(x => x.id === sid);
    if (!s) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div class="fr"><div><label class="fl">Tipo</label><select class="fi" id="esTipo"><option ${s.tipo==='Mantenimiento'?'selected':''}>Mantenimiento</option><option ${s.tipo==='Reparacion'?'selected':''}>Reparacion</option><option ${s.tipo==='Instalacion'?'selected':''}>Instalacion</option></select></div><div><label class="fl">Fecha</label><input class="fi" type="date" id="esFecha" value="${s.fecha}"></div></div><label class="fl">Diagnostico</label><textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea><label class="fl">Proximo mantenimiento</label><input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento||''}"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarServicio('${sid}')">Guardar</button></div></div></div>`);
}

async function actualizarServicio(sid) {
    const tipo = document.getElementById('esTipo')?.value;
    const fecha = document.getElementById('esFecha')?.value;
    const desc = document.getElementById('esDesc')?.value?.trim();
    const prox = document.getElementById('esProx')?.value || null;
    try {
        await updateDoc(doc(db, 'servicios', sid), { tipo, fecha, descripcion: desc, proximoMantenimiento: prox });
        closeModal(); await cargarDatos();
        toast('✅ Servicio actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarServicio(sid) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try { await deleteDoc(doc(db, 'servicios', sid)); await cargarDatos(); toast('🗑️ Eliminado'); }
    catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD CEDIS =====
function modalNuevoCedi() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo CEDI</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre *</label><input class="fi" id="cNombre" placeholder="Ej: CEDI Ibague">
        <label class="fl">Region *</label><select class="fi" id="cRegion">${REGIONES.map(r=>`<option>${r}</option>`).join('')}</select>
        <label class="fl">Telefono *</label><input class="fi" id="cTel" type="tel">
        <label class="fl">Email</label><input class="fi" id="cEmail">
        <label class="fl">Ciudad *</label><select class="fi" id="cCiudad">${CIUDADES.map(ci=>`<option>${ci}</option>`).join('')}</select>
        <label class="fl">Direccion *</label><input class="fi" id="cDir">
        <button class="btn btn-blue btn-full" onclick="obtenerGPS()">📍 Compartir ubicacion</button>
        <input type="hidden" id="cLat"><input type="hidden" id="cLng">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarCedi()">Guardar</button></div>
    </div></div>`);
}

function obtenerGPS() {
    if (!navigator.geolocation) { toast('⚠️ GPS no disponible'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        document.getElementById('cLat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('cLng').value = pos.coords.longitude.toFixed(6);
        toast('✅ Ubicacion capturada');
    }, () => toast('⚠️ No se pudo obtener GPS'));
}

async function guardarCedi() {
    const n = document.getElementById('cNombre')?.value?.trim();
    const r = document.getElementById('cRegion')?.value;
    const t = document.getElementById('cTel')?.value?.trim();
    const ci = document.getElementById('cCiudad')?.value;
    const d = document.getElementById('cDir')?.value?.trim();
    if (!n || !t || !ci || !d) { toast('⚠️ Complete campos obligatorios'); return; }
    try {
        await addDoc(collection(db, 'cedis'), {
            nombre: n, region: r, telefono: t, ciudad: ci, direccion: d,
            email: document.getElementById('cEmail')?.value || '',
            latitud: document.getElementById('cLat')?.value || null,
            longitud: document.getElementById('cLng')?.value || null,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });
        closeModal(); await cargarDatos();
        toast('✅ CEDI guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarCedi(cid) {
    const c = getCedi(cid);
    if (!c) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar CEDI</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre</label><input class="fi" id="ecNombre" value="${c.nombre}">
        <label class="fl">Region</label><select class="fi" id="ecRegion">${REGIONES.map(r=>`<option ${c.region===r?'selected':''}>${r}</option>`).join('')}</select>
        <label class="fl">Telefono</label><input class="fi" id="ecTel" value="${c.telefono}">
        <label class="fl">Email</label><input class="fi" id="ecEmail" value="${c.email||''}">
        <label class="fl">Ciudad</label><select class="fi" id="ecCiudad">${CIUDADES.map(ci=>`<option ${c.ciudad===ci?'selected':''}>${ci}</option>`).join('')}</select>
        <label class="fl">Direccion</label><input class="fi" id="ecDir" value="${c.direccion}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarCedi('${cid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarCedi(cid) {
    const data = {
        nombre: document.getElementById('ecNombre').value,
        region: document.getElementById('ecRegion').value,
        telefono: document.getElementById('ecTel').value,
        email: document.getElementById('ecEmail').value,
        ciudad: document.getElementById('ecCiudad').value,
        direccion: document.getElementById('ecDir').value
    };
    try {
        await updateDoc(doc(db, 'cedis', cid), data);
        closeModal(); await cargarDatos();
        toast('✅ CEDI actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function modalEliminarCedi(cid) {
    if (!confirm('¿Eliminar este CEDI y todos sus activos?')) return;
    const eqs = getEquiposCedi(cid);
    try {
        for (const e of eqs) {
            const ss = getServiciosEquipo(e.id);
            for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
            await deleteDoc(doc(db, 'equipos', e.id));
        }
        await deleteDoc(doc(db, 'cedis', cid));
        await cargarDatos();
        toast('🗑️ CEDI eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD EQUIPOS =====
function modalNuevoEquipo(cediId) {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Tipo</label><input class="fi" id="eTipo" placeholder="Ej: Compresor, Aire Acondicionado">
        <div class="fr"><div><label class="fl">Marca *</label><input class="fi" id="eMarca"></div><div><label class="fl">Modelo *</label><input class="fi" id="eModelo"></div></div>
        <label class="fl">Serie</label><input class="fi" id="eSerie">
        <label class="fl">Ubicacion *</label><input class="fi" id="eUbic" placeholder="Ej: Bodega Principal, Sala Fria 1">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarEquipo('${cediId}')">Guardar</button></div>
    </div></div>`);
}

async function guardarEquipo(cediId) {
    const marca = document.getElementById('eMarca')?.value?.trim();
    const modelo = document.getElementById('eModelo')?.value?.trim();
    const ubic = document.getElementById('eUbic')?.value?.trim();
    if (!marca || !modelo || !ubic) { toast('⚠️ Marca, modelo y ubicacion requeridos'); return; }
    try {
        await addDoc(collection(db, 'equipos'), {
            cediId, marca, modelo, ubicacion: ubic,
            serie: document.getElementById('eSerie')?.value || '',
            tipo: document.getElementById('eTipo')?.value || ''
        });
        closeModal(); await cargarDatos();
        goTo('detalle', cediId);
        toast('✅ Activo guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarEquipo(eid) {
    const e = getEq(eid);
    if (!e) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Tipo</label><input class="fi" id="etTipo" value="${e.tipo||''}">
        <div class="fr"><div><label class="fl">Marca</label><input class="fi" id="etMarca" value="${e.marca}"></div><div><label class="fl">Modelo</label><input class="fi" id="etModelo" value="${e.modelo}"></div></div>
        <label class="fl">Serie</label><input class="fi" id="etSerie" value="${e.serie||''}">
        <label class="fl">Ubicacion</label><input class="fi" id="etUbic" value="${e.ubicacion}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarEquipo(eid) {
    const data = {
        tipo: document.getElementById('etTipo').value,
        marca: document.getElementById('etMarca').value,
        modelo: document.getElementById('etModelo').value,
        serie: document.getElementById('etSerie').value,
        ubicacion: document.getElementById('etUbic').value
    };
    try {
        await updateDoc(doc(db, 'equipos', eid), data);
        closeModal(); await cargarDatos();
        toast('✅ Activo actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function modalEliminarEquipo(eid) {
    if (!confirm('¿Eliminar este activo y su historial?')) return;
    const ss = getServiciosEquipo(eid);
    try {
        for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
        await deleteDoc(doc(db, 'equipos', eid));
        await cargarDatos();
        toast('🗑️ Activo eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD TECNICOS =====
function modalNuevoTecnico() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre *</label><input class="fi" id="tNombre">
        <div class="fr"><div><label class="fl">Tipo Doc</label><select class="fi" id="tTipoDoc">${TIPOS_DOC.map(d=>`<option>${d}</option>`).join('')}</select></div><div><label class="fl">Cedula *</label><input class="fi" id="tCedula" type="number"></div></div>
        <label class="fl">Telefono</label><input class="fi" id="tTel">
        <label class="fl">Cargo</label><input class="fi" id="tCargo">
        <label class="fl">Region</label><select class="fi" id="tRegion">${REGIONES.map(r=>`<option>${r}</option>`).join('')}</select>
        <label class="fl">Rol</label><select class="fi" id="tRol"><option value="tecnico">Tecnico</option><option value="admin">Admin</option></select>
        <label class="fl">Clave (4 digitos) *</label><input class="fi" id="tClave" type="password" maxlength="4">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button></div>
    </div></div>`);
}

async function guardarTecnico() {
    const n = document.getElementById('tNombre')?.value?.trim();
    const cc = document.getElementById('tCedula')?.value?.trim();
    const cl = document.getElementById('tClave')?.value?.trim();
    if (!n || !cc || !cl) { toast('⚠️ Nombre, cedula y clave requeridos'); return; }
    if (cl.length !== 4) { toast('⚠️ Clave de 4 digitos'); return; }
    try {
        await addDoc(collection(db, 'tecnicos'), {
            nombre: n, cedula: cc,
            tipoDoc: document.getElementById('tTipoDoc')?.value || 'CC',
            telefono: document.getElementById('tTel')?.value || '',
            cargo: document.getElementById('tCargo')?.value || '',
            rol: document.getElementById('tRol')?.value || 'tecnico',
            region: document.getElementById('tRegion')?.value || 'Region 3',
            especialidades: [], clave: cl
        });
        closeModal(); await cargarDatos();
        toast('✅ Tecnico guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarTecnico(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre</label><input class="fi" id="etNombre" value="${t.nombre}">
        <label class="fl">Cedula</label><input class="fi" id="etCedula" value="${t.cedula}">
        <label class="fl">Telefono</label><input class="fi" id="etTel" value="${t.telefono}">
        <label class="fl">Cargo</label><input class="fi" id="etCargo" value="${t.cargo||''}">
        <label class="fl">Region</label><select class="fi" id="etRegion">${REGIONES.map(r=>`<option ${t.region===r?'selected':''}>${r}</option>`).join('')}</select>
        <label class="fl">Rol</label><select class="fi" id="etRol"><option value="tecnico" ${t.rol==='tecnico'?'selected':''}>Tecnico</option><option value="admin" ${t.rol==='admin'?'selected':''}>Admin</option></select>
        <label class="fl">Nueva clave (opcional)</label><input class="fi" id="etClave" type="password" maxlength="4">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarTecnico('${tid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarTecnico(tid) {
    const data = {
        nombre: document.getElementById('etNombre').value,
        cedula: document.getElementById('etCedula').value,
        telefono: document.getElementById('etTel').value,
        cargo: document.getElementById('etCargo').value,
        region: document.getElementById('etRegion').value,
        rol: document.getElementById('etRol').value
    };
    const newClave = document.getElementById('etClave')?.value?.trim();
    if (newClave && newClave.length === 4) data.clave = newClave;
    try {
        await updateDoc(doc(db, 'tecnicos', tid), data);
        closeModal(); await cargarDatos();
        toast('✅ Tecnico actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarTecnico(tid) {
    if (!confirm('¿Eliminar este tecnico?')) return;
    try { await deleteDoc(doc(db, 'tecnicos', tid)); await cargarDatos(); toast('🗑️ Tecnico eliminado'); }
    catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== INFORME PDF =====
function generarInformePDF(eid) {
    const e = getEq(eid);
    const c = getCedi(e?.cediId);
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const LOGO = D1_LOGO;
    const serviciosHTML = ss.map(s => {
        const fotosHTML = (s.fotos||[]).length > 0
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">${(s.fotos||[]).map(f=>`<img src="${f}" style="height:80px;width:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">`).join('')}</div>`
            : '';
        const proxHTML = (s.tipo === 'Mantenimiento' && s.proximoMantenimiento)
            ? `<div style="color:#b45309;font-size:16px;margin-top:4px;">&#128197; Proximo mantenimiento: ${fmtFecha(s.proximoMantenimiento)}</div>`
            : '';
        return `<div style="border:1px solid #d1d5db;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="background:${s.tipo==='Mantenimiento'?'#1d4ed8':s.tipo==='Reparacion'?'#dc2626':'#15803d'};color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">${s.tipo}</span>
                <span style="font-size:16px;color:#555;">${fmtFecha(s.fecha)}</span>
            </div>
            <div style="font-size:16px;color:#374151;margin:3px 0;">&#128295; ${s.tecnico}</div>
            <div style="font-size:16px;color:#111;margin:3px 0;">${s.descripcion}</div>
            ${fotosHTML}${proxHTML}
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Informe_${e?.marca}_${e?.modelo}</title>
<style>
  @page{size:letter;margin:15mm;}
  @media print{html,body{margin:0;padding:0;}}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:0;}
</style></head><body>
<div style="display:flex;align-items:center;border-bottom:3px solid #c8102e;padding-bottom:10px;margin-bottom:12px;">
  <img src="${LOGO}" style="height:64px;margin-right:18px;" onerror="this.style.display='none'">
  <div>
    <div style="font-size:18px;font-weight:900;color:#c8102e;">D1</div>
    <div style="font-size:14px;color:#555;">Coordinacion de Mantenimiento CEDI &nbsp;|&nbsp; Region 3</div>
    <div style="font-size:18px;font-weight:700;margin-top:4px;">INFORME TECNICO</div>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
  <tr>
    <td style="padding:6px 10px;background:#f1f5f9;border:1px solid #ddd;width:50%;font-size:14px;"><strong>CEDI:</strong> ${c?.nombre || 'N/A'} &nbsp; <span style="color:#6b7280;">${c?.region||''}</span></td>
    <td style="padding:6px 10px;background:#f1f5f9;border:1px solid #ddd;font-size:14px;"><strong>Generado:</strong> ${new Date().toLocaleString()}</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #ddd;font-size:14px;" colspan="2"><strong>Activo:</strong> ${e?.tipo||''} ${e?.marca||''} ${e?.modelo||''} &nbsp;&nbsp; <strong>Serial:</strong> ${e?.serie || 'N/A'} &nbsp;&nbsp; <strong>Ubicacion:</strong> ${e?.ubicacion||''}</td>
  </tr>
</table>
<div style="background:#c8102e;color:white;font-weight:700;font-size:15px;padding:7px 12px;border-radius:4px;margin-bottom:10px;">
  HISTORIAL DE SERVICIOS &nbsp;&nbsp; <span style="font-weight:400;font-size:13px;">${ss.length} registro(s)</span>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${serviciosHTML}</div>
</body></html>`;

    const v = window.open('', '_blank');
    if (v) { v.document.open(); v.document.write(html); v.document.close(); setTimeout(()=>v.print(),500); }
}

// ===== QR =====
function modalQR(eid) {
    const e = getEq(eid);
    const c = getCedi(e?.cediId);
    const url = `${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:280px;height:280px;';
    document.body.appendChild(qrDiv);
    const QRLib = window.QRCode;
    if (!QRLib) { toast('⚠️ QRCode.js no cargado'); return; }
    new QRLib(qrDiv, { text: url, width: 280, height: 280, colorDark: '#c8102e', colorLight: '#ffffff' });

    setTimeout(() => {
        const qrCanvas = qrDiv.querySelector('canvas');
        const qrDataUrl = qrCanvas.toDataURL('image/png');
        document.body.removeChild(qrDiv);

        const W = 400, PAD = 16;
        const compCanvas = document.createElement('canvas');
        const ctx = compCanvas.getContext('2d');
        const logoImg = new Image();
        const qrImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = D1_LOGO;

        logoImg.onload = () => {
            qrImg.onload = () => {
                const logoH = 50, infoH = 70, qrH = 280, footH = 24;
                const totalH = PAD + logoH + 8 + infoH + 8 + qrH + 8 + footH + PAD;
                compCanvas.width = W;
                compCanvas.height = totalH;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, W, totalH);
                ctx.strokeStyle = '#c8102e';
                ctx.lineWidth = 3;
                ctx.strokeRect(2, 2, W-4, totalH-4);
                ctx.fillStyle = '#c8102e';
                ctx.fillRect(2, 2, W-4, logoH + PAD + 4);
                const logoW = logoImg.width * (logoH / logoImg.height);
                ctx.drawImage(logoImg, (W - logoW)/2, PAD, logoW, logoH);
                let y = PAD + logoH + 8 + 4;
                ctx.fillStyle = '#111';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText((e?.tipo ? e.tipo + ' · ' : '') + (e?.marca||'') + ' ' + (e?.modelo||''), W/2, y + 16);
                ctx.font = '12px Arial';
                ctx.fillStyle = '#444';
                ctx.fillText('📍 ' + (e?.ubicacion||''), W/2, y + 34);
                ctx.fillText('🏭 ' + (c?.nombre||''), W/2, y + 50);
                if (e?.serie) { ctx.font = '10px Arial'; ctx.fillStyle='#888'; ctx.fillText('Serie: '+e.serie, W/2, y+64); }
                y = PAD + logoH + 8 + 4 + infoH + 8;
                ctx.drawImage(qrImg, (W-280)/2, y, 280, 280);
                y += 280 + 8;
                ctx.font = '10px Arial'; ctx.fillStyle = '#888';
                ctx.fillText('Escanea para ver historial de mantenimiento', W/2, y + 14);
                const compositeUrl = compCanvas.toDataURL('image/png');
                showModal(`<div class="modal" style="max-width:360px;"><div class="modal-h"><h3>📱 Codigo QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b" style="text-align:center;">
                    <img src="${compositeUrl}" style="width:100%;border-radius:8px;border:2px solid #c8102e;">
                    <a href="${compositeUrl}" download="QR_${e?.marca}_${e?.modelo}.png" class="btn btn-blue btn-full" style="margin-top:8px;">⬇️ Descargar QR</a>
                </div></div>`);
            };
            qrImg.src = qrDataUrl;
        };
        logoImg.onerror = () => {
            showModal(`<div class="modal" style="max-width:340px;"><div class="modal-h"><h3>📱 Codigo QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b" style="text-align:center;"><img src="${qrDataUrl}" style="width:100%;"><a href="${qrDataUrl}" download="QR_${e?.marca}_${e?.modelo}.png" class="btn btn-blue btn-full" style="margin-top:8px;">⬇️ Descargar QR</a></div></div>`);
        };
    }, 200);
}

// ===== QR PÚBLICO =====
function manejarRutaQR() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/equipo/')) return false;
    const eid = hash.replace('#/equipo/', '');
    const e = getEq(eid);
    if (!e) return false;
    const c = getCedi(e.cediId);
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const main = document.getElementById('mainContent');
    const topbar = document.querySelector('.topbar');
    const botnav = document.querySelector('.botnav');
    if (topbar) topbar.style.display = 'none';
    if (botnav) botnav.style.display = 'none';
    main.style.background = 'white';
    const adminTel = tecnicos.find(t=>t.rol==='admin')?.telefono || '3114831801';
    const waMsg = encodeURIComponent('Hola, necesito asistencia para el ' + (e?.tipo||'') + ' ' + (e?.marca||'') + ' ' + (e?.modelo||'') + ' ubicado en ' + (e?.ubicacion||'') + ' - CEDI ' + (c?.nombre||''));
    const waUrl = 'https://wa.me/57' + adminTel.replace(/\D/g,'') + '?text=' + waMsg;
    main.innerHTML = `<div style="max-width:600px;margin:0 auto;padding:1.5rem;">
        <div style="text-align:center;margin-bottom:0.75rem;">
            <img src="${D1_LOGO}" style="height:56px;" onerror="this.style.display='none'">
        </div>
        <div style="background:#c8102e;border-radius:14px;padding:14px;color:white;text-align:center;margin-bottom:0.75rem;">
            <div style="font-size:0.85rem;">Soporte de Mantenimiento D1</div>
            <div style="font-size:2rem;font-weight:700;">${adminTel}</div>
        </div>
        <div style="border:1px solid #ccc;border-radius:12px;padding:1rem;margin-bottom:0.75rem;">
            <h3 style="margin:0 0 6px;">${e?.tipo ? e.tipo+' · ':'' }${e.marca} ${e.modelo}</h3>
            <p style="margin:2px 0;">📍 ${e.ubicacion}</p>
            <p style="margin:2px 0;">🏭 ${c?.nombre} · ${c?.region||''}</p>
            <p style="margin:2px 0;font-size:0.8rem;color:#888;">Serie: ${e.serie || 'N/A'}</p>
        </div>
        <a href="${waUrl}" target="_blank" style="display:block;width:100%;box-sizing:border-box;background:#25D366;color:white;border:none;padding:14px;border-radius:12px;text-align:center;font-size:1rem;font-weight:700;text-decoration:none;margin-bottom:1rem;">📱 Contactar por WhatsApp</a>
        <h3>Historial (${ss.length})</h3>
        ${ss.map(s => `<div style="border:1px solid #fecaca;border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;">
            <div style="display:flex;justify-content:space-between;"><strong>${s.tipo}</strong><span style="font-size:0.8rem;color:#555;">${fmtFecha(s.fecha)}</span></div>
            <div style="font-size:0.85rem;">🔧 ${s.tecnico}</div>
            <div style="font-size:0.85rem;margin-top:2px;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.82rem;color:#b45309;margin-top:4px;">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
        </div>`).join('')}
    </div>`;
    return true;
}

// ===== GLOBALS Y EVENTOS =====
window.goTo = goTo;
window.closeModal = closeModal;
window.filtrarCedis = filtrarCedis;
window.filtrarEquipos = filtrarEquipos;
window.filtrarTiendas = filtrarTiendas;
window.modalNuevoCedi = modalNuevoCedi;
window.modalEditarCedi = modalEditarCedi;
window.modalEliminarCedi = modalEliminarCedi;
window.guardarCedi = guardarCedi;
window.actualizarCedi = actualizarCedi;
window.modalNuevoEquipo = modalNuevoEquipo;
window.modalEditarEquipo = modalEditarEquipo;
window.modalEliminarEquipo = modalEliminarEquipo;
window.guardarEquipo = guardarEquipo;
window.actualizarEquipo = actualizarEquipo;
window.modalNuevoServicio = modalNuevoServicio;
window.modalEditarServicio = modalEditarServicio;
window.guardarServicio = guardarServicio;
window.actualizarServicio = actualizarServicio;
window.eliminarServicio = eliminarServicio;
window.modalNuevoTecnico = modalNuevoTecnico;
window.modalEditarTecnico = modalEditarTecnico;
window.guardarTecnico = guardarTecnico;
window.actualizarTecnico = actualizarTecnico;
window.eliminarTecnico = eliminarTecnico;
window.modalRecordar = modalRecordar;
window.enviarWhatsApp = enviarWhatsApp;
window.generarInformePDF = generarInformePDF;
window.modalQR = modalQR;
window.obtenerGPS = obtenerGPS;
window.previewFoto = previewFoto;
window.borrarFoto = borrarFoto;
window.onTipoChange = onTipoChange;
window.abrirLogin = abrirLogin;
window.mlPin = mlPin;
window.mlDel = mlDel;
window.mlLogin = mlLogin;
window.cerrarSesion = cerrarSesion;
window.subirCSVTiendas = subirCSVTiendas;
window.descargarPlantillaCSV = descargarPlantillaCSV;

document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (!sesionActual && page !== 'panel' && page !== 'tecnicos') {
            toast('🔒 Inicia sesion desde Tecnicos');
            return;
        }
        selectedCediId = null;
        selectedEquipoId = null;
        goTo(page);
    });
});

// ===== INICIAR APP =====
(async () => {
    await conectarDriveAuto();
    await sembrarDatos();
    await cargarDatos();
    if (!manejarRutaQR()) renderView();
})();
