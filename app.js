// ============================================
// D1 GESTIÓN - App Firebase
// Versión: CEDIS + TIENDAS + Activos + Servicios
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración Firebase D1 (virgen)
const firebaseConfig = {
    apiKey: "AIzaSyDw1faNff7uMXR6JbHOhZa7eA5WiiNAJNw",
    authDomain: "donecapacitada-4fa37.firebaseapp.com",
    projectId: "donecapacitada-4fa37",
    storageBucket: "donecapacitada-4fa37.firebasestorage.app",
    messagingSenderId: "449540711283",
    appId: "1:449540711283:web:01efe4696daafc4e215b06"
};

// Google Apps Script para Drive (se mantiene igual)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYWgupeHfhfKmvMDk_FFsTj-P9PdJfXMn3pheGjFMXK7i43AW1V8A5BD4iCSbOho9c/exec';

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ===== DRIVE (igual que antes) =====
let _driveConnected = false;
function driveIsConnected() { return _driveConnected; }

async function conectarDriveAuto() {
    try {
        const response = await fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'no-cors' });
        _driveConnected = true;
        console.log('✅ Drive conectado');
    } catch (e) {
        console.log('⚠️ Drive no disponible');
        _driveConnected = false;
    }
}

async function driveUploadPDF(html, filename) {
    if (!filename.endsWith('.pdf')) filename = filename.replace('.html', '') + '.pdf';
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: html, filename: filename })
        });
        console.log('✅ PDF enviado a Drive:', filename);
        return true;
    } catch(e) {
        console.error('Error Drive:', e);
        return false;
    }
}

// ===== DATOS GLOBALES =====
let cedis = [];        // Colección 'cedis'
let tiendas = [];      // Colección 'tiendas'
let equipos = [];
let servicios = [];
let tecnicos = [];

// ===== CARGAR DATOS =====
async function cargarDatos() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando...</p></div>';
    try {
        const [cSnapshot, tSnapshot, eSnapshot, sSnapshot, tecSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'cedis'), orderBy('nombre'))),
            getDocs(query(collection(db, 'tiendas'), orderBy('nombre'))),
            getDocs(collection(db, 'equipos')),
            getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc'))),
            getDocs(collection(db, 'tecnicos'))
        ]);
        cedis = cSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        tiendas = tSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        equipos = eSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        servicios = sSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos = tecSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error:', err);
        toast('⚠️ Error de conexión');
        main.innerHTML = '<div class="page" style="text-align:center;padding:2rem;"><p>⚠️ Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

// ===== SEMBRAR DATOS INICIALES (solo si no hay técnicos) =====
async function sembrarDatos() {
    const snap = await getDocs(collection(db, 'tecnicos'));
    if (!snap.empty) return;
    toast('⚙️ Configurando app...');

    // Superusuario: CARLOS MONSALVE
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Carlos Monsalve',
        cedula: '0000001',
        tipoDoc: 'CC',
        telefono: '3110000000',
        cargo: 'Administrador',
        rol: 'admin',
        especialidades: ['mecanico', 'baja', 'media', 'electronico', 'ups', 'planta'],
        region: 'Colombia',
        clave: '1234'
    });
    
    // Técnico de ejemplo (opcional)
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Juan Perez',
        cedula: '10234568',
        tipoDoc: 'CC',
        telefono: '3120000002',
        cargo: 'Tecnico de Campo',
        rol: 'tecnico',
        especialidades: ['baja', 'media'],
        region: 'Cundinamarca',
        clave: '5678'
    });

    toast('✅ Listo. Cédula admin: 0000001 · Clave: 1234');
}

// ===== HELPERS =====
const getEq = id => equipos.find(e => e.id === id);
const getCedi = id => cedis.find(c => c.id === id);
const getTienda = id => tiendas.find(t => t.id === id);
const getTec = id => tecnicos.find(t => t.id === id);
const getEquiposEntidad = (entidadId, tipo) => equipos.filter(e => e.entidadId === entidadId && e.entidadTipo === tipo);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosEntidad = (entidadId, tipo) => {
    const eqs = getEquiposEntidad(entidadId, tipo);
    return servicios.filter(s => eqs.some(e => e.id === s.equipoId));
};

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
        right.innerHTML = `<span class="topbar-user">Sin sesión</span>`;
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
    toast('👋 Sesión cerrada');
}

// ===== ESTADO GLOBAL =====
let currentView = 'panel';
let sesionActual = null;
let selectedEntidadId = null;      // ID del CEDI o TIENDA actual
let selectedEntidadTipo = null;    // 'cedi' o 'tienda'
let selectedEquipoId = null;
let fotosNuevas = [null, null, null];

const REGIONES = ['Región 1', 'Región 2', 'Región 3', 'Región 4', 'Región 5', 'Región 6', 'Región 7', 'Región 8', 'Región 9', 'Región 10'];
const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Bucaramanga', 'Barranquilla', 'Cúcuta', 'Manizales', 'Pereira', 'Ibagué', 'Villavicencio', 'Girón', 'Floridablanca', 'Piedecuesta', 'Pamplona', 'Soacha', 'Tunja', 'Pasto', 'Ipiales'];
const TIPOS_DOC = ['CC', 'CE', 'PA', 'NIT', 'TI'];
const ESPECIALIDADES = [
    { id: 'mecanico', label: 'Mecánico de plantas' },
    { id: 'baja', label: 'Electricista baja tensión' },
    { id: 'media', label: 'Electricista media tensión' },
    { id: 'electronico', label: 'Electrónico' },
    { id: 'ups', label: 'UPS' },
    { id: 'planta', label: 'Plantas eléctricas' }
];

// ===== NAVEGACIÓN =====
function goTo(view, entidadId = null, entidadTipo = null, equipoId = null) {
    currentView = view;
    selectedEntidadId = entidadId;
    selectedEntidadTipo = entidadTipo;
    selectedEquipoId = equipoId;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'detalle' && (b.dataset.page === 'cedis' || b.dataset.page === 'tiendas')));
    });
}

function renderView() {
    if (!sesionActual && currentView !== 'panel' && currentView !== 'tecnicos') {
        currentView = 'panel';
    }
    
    const main = document.getElementById('mainContent');
    document.getElementById('botnavEl').style.display = 'flex';

    switch (currentView) {
        case 'panel':         main.innerHTML = renderPanel(); break;
        case 'cedis':         main.innerHTML = renderCedis(); break;
        case 'tiendas':       main.innerHTML = renderTiendas(); break;
        case 'detalle':       main.innerHTML = renderDetalleEntidad(); break;
        case 'historial':     main.innerHTML = renderHistorialEquipo(); break;
        case 'servicios':     main.innerHTML = renderServicios(); if(window.aplicarFiltros) aplicarFiltros(); break;
        case 'mantenimientos':main.innerHTML = renderMantenimientos(); break;
        case 'tecnicos':      main.innerHTML = renderTecnicos(); break;
        default:              main.innerHTML = renderPanel();
    }
}

// ===== PANEL =====
function renderPanel() {
    const totalCedis = cedis.length;
    const totalTiendas = tiendas.length;
    const totalEquipos = equipos.length;
    const serviciosMes = servicios.filter(s => s.fecha?.startsWith(getMesActual())).length;
    const mantPendientes = servicios.filter(s => s.proximoMantenimiento && s.proximoMantenimiento >= new Date().toISOString().slice(0,10)).length;

    return `<div class="page">
        <div class="panel-banner" style="background:#0d4a3a;color:white;padding:20px;text-align:center;">
            <div class="panel-banner-sub">Gestión de Mantenimiento</div>
            <div class="panel-banner-title" style="font-size:1.6rem;font-weight:700;">D1 Colombia</div>
        </div>
        <div class="panel-grid">
            <div class="panel-box"><div class="panel-box-num">${totalCedis}</div><div class="panel-box-lbl">CEDIS</div></div>
            <div class="panel-box"><div class="panel-box-num">${totalTiendas}</div><div class="panel-box-lbl">TIENDAS</div></div>
            <div class="panel-box"><div class="panel-box-num">${totalEquipos}</div><div class="panel-box-lbl">ACTIVOS</div></div>
            <div class="panel-box"><div class="panel-box-num">${serviciosMes}</div><div class="panel-box-lbl">SERVICIOS MES</div></div>
            <div class="panel-box"><div class="panel-box-num">${mantPendientes}</div><div class="panel-box-lbl">MANT. PENDIENTES</div></div>
        </div>
    </div>`;
}

// ===== CEDIS =====
function renderCedis() {
    return `<div class="page">
        <div class="sec-head"><h2>CEDIS (${cedis.length})</h2><button class="btn btn-blue btn-sm" onclick="modalNuevaEntidad('cedi')">+ Nuevo CEDI</button></div>
        <input class="search" placeholder="🔍 Buscar..." oninput="filtrarEntidades(this.value, 'cedi')" id="searchCedis">
        <div id="cedisGrid">
            ${cedis.map(c => `
            <div class="cc" data-search="${(c.nombre+c.ciudad+c.telefono+(c.region||'')).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;">
                    <div class="cc-name">${c.nombre}</div>
                    ${esAdmin() ? `<div><button class="ib" onclick="modalEditarEntidad('cedi','${c.id}')">✏️</button><button class="ib" onclick="modalEliminarEntidad('cedi','${c.id}')">🗑️</button></div>` : ''}
                </div>
                <div class="cc-row">📍 ${c.ciudad} · ${c.region || 'Sin región'}</div>
                <div class="cc-row">📞 ${c.telefono}</div>
                <div class="cc-row">📧 ${c.email || ''}</div>
                <div class="cc-meta">${getEquiposEntidad(c.id, 'cedi').length} activo(s) · ${getServiciosEntidad(c.id, 'cedi').length} servicio(s)</div>
                <button class="link-btn" onclick="goTo('detalle','${c.id}','cedi')">Ver activos →</button>
            </div>`).join('')}
        </div>
    </div>`;
}

function renderTiendas() {
    return `<div class="page">
        <div class="sec-head"><h2>TIENDAS (${tiendas.length})</h2><button class="btn btn-blue btn-sm" onclick="modalNuevaEntidad('tienda')">+ Nueva Tienda</button></div>
        <input class="search" placeholder="🔍 Buscar..." oninput="filtrarEntidades(this.value, 'tienda')" id="searchTiendas">
        <div id="tiendasGrid">
            ${tiendas.map(t => `
            <div class="cc" data-search="${(t.nombre+t.ciudad+t.telefono+(t.region||'')).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;">
                    <div class="cc-name">${t.nombre}</div>
                    ${esAdmin() ? `<div><button class="ib" onclick="modalEditarEntidad('tienda','${t.id}')">✏️</button><button class="ib" onclick="modalEliminarEntidad('tienda','${t.id}')">🗑️</button></div>` : ''}
                </div>
                <div class="cc-row">📍 ${t.ciudad} · ${t.region || 'Sin región'}</div>
                <div class="cc-row">📞 ${t.telefono}</div>
                <div class="cc-row">📧 ${t.email || ''}</div>
                <div class="cc-meta">${getEquiposEntidad(t.id, 'tienda').length} activo(s) · ${getServiciosEntidad(t.id, 'tienda').length} servicio(s)</div>
                <button class="link-btn" onclick="goTo('detalle','${t.id}','tienda')">Ver activos →</button>
            </div>`).join('')}
        </div>
    </div>`;
}

function filtrarEntidades(valor, tipo) {
    const gridId = tipo === 'cedi' ? 'cedisGrid' : 'tiendasGrid';
    const elementos = document.querySelectorAll(`#${gridId} .cc`);
    const txt = valor.toLowerCase();
    elementos.forEach(el => {
        el.style.display = (el.dataset.search || '').includes(txt) ? '' : 'none';
    });
}

// Detalle de entidad (CEDI o TIENDA) - muestra sus activos
function renderDetalleEntidad() {
    let entidad;
    if (selectedEntidadTipo === 'cedi') entidad = getCedi(selectedEntidadId);
    else entidad = getTienda(selectedEntidadId);
    if (!entidad) { goTo(selectedEntidadTipo === 'cedi' ? 'cedis' : 'tiendas'); return ''; }
    const eqs = getEquiposEntidad(selectedEntidadId, selectedEntidadTipo);
    const titulo = selectedEntidadTipo === 'cedi' ? 'CEDI' : 'TIENDA';
    return `<div class="page">
        <div class="det-hdr"><button class="back" onclick="goTo('${selectedEntidadTipo}s')">← Volver</button><div><div class="cc-name">${entidad.nombre}</div><div class="cc-meta">${entidad.ciudad} · ${entidad.region || ''}</div></div></div>
        <div class="info-box">
            <div class="cc-row">📞 ${entidad.telefono}</div>
            ${entidad.email ? `<div class="cc-row">📧 ${entidad.email}</div>` : ''}
            <div class="cc-row">📍 ${entidad.direccion}</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin:0 16px 0.65rem;"><span style="font-weight:700;">Activos (${eqs.length})</span><button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${selectedEntidadId}','${selectedEntidadTipo}')">+ Activo</button></div>
        ${eqs.map(e => `
        <div class="ec" style="margin:0 16px 12px;">
            <div style="display:flex;justify-content:space-between;">
                <div><div class="ec-name">${e.marca} ${e.modelo}</div><div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie||'S/N'}</div><div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s)</div></div>
                ${esAdmin() ? `<div><button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button><button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button></div>` : ''}
            </div>
            <div class="ec-btns">
                <button class="ab" onclick="goTo('historial',null,null,'${e.id}')">📋 Servicios</button>
                <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
                <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
            </div>
        </div>`).join('')}
    </div>`;
}

// Historial de servicios de un equipo
function renderHistorialEquipo() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('panel'); return ''; }
    let entidadNombre = '';
    if (e.entidadTipo === 'cedi') {
        const c = getCedi(e.entidadId);
        entidadNombre = c ? c.nombre : '';
    } else {
        const t = getTienda(e.entidadId);
        entidadNombre = t ? t.nombre : '';
    }
    const ss = getServiciosEquipo(e.id).sort((a,b) => new Date(b.fecha)-new Date(a.fecha));
    return `<div class="page">
        <div class="det-hdr"><button class="back" onclick="goTo('detalle','${e.entidadId}','${e.entidadTipo}')">← Volver</button><div><div class="ec-name">${e.marca} ${e.modelo}</div><div class="ec-meta">${e.ubicacion} · ${entidadNombre}</div></div></div>
        <div style="margin:0 16px 2rem;"><span style="font-weight:700;">Historial (${ss.length})</span></div>
        ${ss.map(s => `
        <div class="si" style="margin:0 16px 12px;">
            <div class="si-top"><span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparacion'?'b-red':'b-green'}">${s.tipo}</span><span style="font-size:2rem;color:var(--hint);">${fmtFecha(s.fecha)}</span></div>
            <div class="si-info">🔧 ${s.tecnico}</div>
            <div class="si-info">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div class="si-info" style="color:var(--gold);">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">${(s.fotos||[]).map(f => `<img class="fthumb" src="${f}" loading="lazy">`).join('')}</div>
            <div class="si-top" style="justify-content:flex-end;margin-top:4px;">
                ${puedeEditar(s.tecnico) ? `<button class="ib" onclick="modalEditarServicio('${s.id}')">✏️</button>` : ''}
                ${esAdmin() ? `<button class="ib" onclick="eliminarServicio('${s.id}')">🗑️</button>` : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

// ===== CRUD ENTIDADES (CEDI / TIENDA) =====
function modalNuevaEntidad(tipo) {
    const titulo = tipo === 'cedi' ? 'Nuevo CEDI' : 'Nueva Tienda';
    showModal(`<div class="modal"><div class="modal-h"><h3>${titulo}</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre *</label><input class="fi" id="entNombre">
        <div class="fr"><div><label class="fl">Ciudad *</label><select class="fi" id="entCiudad">${CIUDADES.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div><label class="fl">Región *</label><select class="fi" id="entRegion">${REGIONES.map(r=>`<option>${r}</option>`).join('')}</select></div></div>
        <label class="fl">Teléfono *</label><input class="fi" id="entTelefono" type="tel">
        <label class="fl">Email</label><input class="fi" id="entEmail">
        <label class="fl">Dirección *</label><input class="fi" id="entDireccion">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarEntidad('${tipo}')">Guardar</button></div>
    </div></div>`);
}

async function guardarEntidad(tipo) {
    const nombre = document.getElementById('entNombre')?.value.trim();
    const ciudad = document.getElementById('entCiudad')?.value;
    const region = document.getElementById('entRegion')?.value;
    const telefono = document.getElementById('entTelefono')?.value.trim();
    const email = document.getElementById('entEmail')?.value.trim();
    const direccion = document.getElementById('entDireccion')?.value.trim();
    if (!nombre || !ciudad || !region || !telefono || !direccion) { toast('⚠️ Complete campos obligatorios'); return; }
    const coleccion = tipo === 'cedi' ? 'cedis' : 'tiendas';
    try {
        await addDoc(collection(db, coleccion), {
            nombre, ciudad, region, telefono, email: email || '', direccion,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });
        closeModal();
        await cargarDatos();
        toast(`✅ ${tipo === 'cedi' ? 'CEDI' : 'Tienda'} guardado`);
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarEntidad(tipo, id) {
    const ent = tipo === 'cedi' ? getCedi(id) : getTienda(id);
    if (!ent) return;
    const titulo = tipo === 'cedi' ? 'Editar CEDI' : 'Editar Tienda';
    showModal(`<div class="modal"><div class="modal-h"><h3>${titulo}</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre</label><input class="fi" id="eNombre" value="${ent.nombre}">
        <div class="fr"><div><label class="fl">Ciudad</label><select class="fi" id="eCiudad">${CIUDADES.map(c=>`<option ${c===ent.ciudad?'selected':''}>${c}</option>`).join('')}</select></div>
        <div><label class="fl">Región</label><select class="fi" id="eRegion">${REGIONES.map(r=>`<option ${r===ent.region?'selected':''}>${r}</option>`).join('')}</select></div></div>
        <label class="fl">Teléfono</label><input class="fi" id="eTelefono" value="${ent.telefono}">
        <label class="fl">Email</label><input class="fi" id="eEmail" value="${ent.email || ''}">
        <label class="fl">Dirección</label><input class="fi" id="eDireccion" value="${ent.direccion}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarEntidad('${tipo}','${id}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarEntidad(tipo, id) {
    const coleccion = tipo === 'cedi' ? 'cedis' : 'tiendas';
    try {
        await updateDoc(doc(db, coleccion, id), {
            nombre: document.getElementById('eNombre').value,
            ciudad: document.getElementById('eCiudad').value,
            region: document.getElementById('eRegion').value,
            telefono: document.getElementById('eTelefono').value,
            email: document.getElementById('eEmail').value,
            direccion: document.getElementById('eDireccion').value
        });
        closeModal();
        await cargarDatos();
        toast('✅ Actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarEntidad(tipo, id) {
    if (!confirm(`¿Eliminar este ${tipo === 'cedi' ? 'CEDI' : 'TIENDA'} y TODOS sus activos y servicios?`)) return;
    eliminarEntidadCompleta(tipo, id);
}

async function eliminarEntidadCompleta(tipo, id) {
    const equiposEntidad = getEquiposEntidad(id, tipo);
    try {
        for (const eq of equiposEntidad) {
            const ss = getServiciosEquipo(eq.id);
            for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
            await deleteDoc(doc(db, 'equipos', eq.id));
        }
        const coleccion = tipo === 'cedi' ? 'cedis' : 'tiendas';
        await deleteDoc(doc(db, coleccion, id));
        await cargarDatos();
        goTo(tipo === 'cedi' ? 'cedis' : 'tiendas');
        toast('🗑️ Eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD EQUIPOS (ACTIVOS) =====
function modalNuevoEquipo(entidadId, entidadTipo) {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div class="fr"><div><label class="fl">Marca *</label><input class="fi" id="eqMarca"></div><div><label class="fl">Modelo *</label><input class="fi" id="eqModelo"></div></div>
        <label class="fl">Serie</label><input class="fi" id="eqSerie">
        <label class="fl">Ubicación *</label><input class="fi" id="eqUbicacion">
        <label class="fl">Tipo</label><input class="fi" id="eqTipo">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarEquipo('${entidadId}','${entidadTipo}')">Guardar</button></div>
    </div></div>`);
}

async function guardarEquipo(entidadId, entidadTipo) {
    const marca = document.getElementById('eqMarca')?.value.trim();
    const modelo = document.getElementById('eqModelo')?.value.trim();
    const ubicacion = document.getElementById('eqUbicacion')?.value.trim();
    if (!marca || !modelo || !ubicacion) { toast('⚠️ Marca, modelo y ubicación requeridos'); return; }
    try {
        await addDoc(collection(db, 'equipos'), {
            entidadId, entidadTipo,
            marca, modelo,
            serie: document.getElementById('eqSerie')?.value || '',
            ubicacion,
            tipo: document.getElementById('eqTipo')?.value || ''
        });
        closeModal();
        await cargarDatos();
        toast('✅ Activo guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarEquipo(eid) {
    const eq = getEq(eid);
    if (!eq) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div class="fr"><div><label class="fl">Marca</label><input class="fi" id="eMarca" value="${eq.marca}"></div><div><label class="fl">Modelo</label><input class="fi" id="eModelo" value="${eq.modelo}"></div></div>
        <label class="fl">Serie</label><input class="fi" id="eSerie" value="${eq.serie || ''}">
        <label class="fl">Ubicación</label><input class="fi" id="eUbicacion" value="${eq.ubicacion}">
        <label class="fl">Tipo</label><input class="fi" id="eTipoEq" value="${eq.tipo || ''}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarEquipo(eid) {
    try {
        await updateDoc(doc(db, 'equipos', eid), {
            marca: document.getElementById('eMarca').value,
            modelo: document.getElementById('eModelo').value,
            serie: document.getElementById('eSerie').value,
            ubicacion: document.getElementById('eUbicacion').value,
            tipo: document.getElementById('eTipoEq').value
        });
        closeModal();
        await cargarDatos();
        toast('✅ Activo actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarEquipo(eid) {
    if (!confirm('¿Eliminar este activo y sus servicios?')) return;
    eliminarEquipoCompleto(eid);
}

async function eliminarEquipoCompleto(eid) {
    const ss = getServiciosEquipo(eid);
    try {
        for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
        await deleteDoc(doc(db, 'equipos', eid));
        await cargarDatos();
        toast('🗑️ Activo eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== SERVICIOS (similar a OLM pero adaptado) =====
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if(!desc){ toast('⚠️ Ingrese el diagnóstico'); return; }
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
            equipoId: eid,
            tipo, fecha,
            tecnico: sesionActual?.nombre || '',
            descripcion: desc,
            proximoMantenimiento: prox,
            fotos: fotosBase64
        });
        closeModal();
        await cargarDatos();
        const e = getEq(eid);
        if(e) goTo('historial', null, null, eid);
        toast('✅ Servicio guardado con ' + fotosBase64.length + ' foto(s)');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const box = document.getElementById('mantBox');
    if (box) box.classList.toggle('hidden', tipo !== 'Mantenimiento');
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

function modalNuevoServicio(eid) {
    if (!sesionActual) { toast('🔑 Inicie sesión para continuar'); return; }
    const e = getEq(eid);
    if (!e) return;
    let entidadNombre = '';
    if (e.entidadTipo === 'cedi') {
        const c = getCedi(e.entidadId);
        entidadNombre = c ? c.nombre : '';
    } else {
        const t = getTienda(e.entidadId);
        entidadNombre = t ? t.nombre : '';
    }
    const hoy = new Date().toISOString().split('T')[0];
    fotosNuevas = [null, null, null];
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="background:var(--bg2);padding:0.55rem;border-radius:8px;margin-bottom:0.65rem;">
                <strong>${entidadNombre}</strong><br>
                <span style="font-size:0.75rem;">${e.marca} ${e.modelo} · 📍 ${e.ubicacion}</span>
            </div>
            <div class="fr">
                <div><label class="fl">Tipo *</label><select class="fi" id="sTipo" onchange="onTipoChange()"><option>Mantenimiento</option><option>Reparacion</option><option>Instalacion</option></select></div>
                <div><label class="fl">Fecha *</label><input class="fi" type="date" id="sFecha" value="${hoy}"></div>
            </div>
            <label class="fl">Técnico</label>
            <input class="fi" id="sTecnico" value="${sesionActual?.nombre||''}" readonly>
            <label class="fl">Diagnóstico / Descripción *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado..."></textarea>
            <div class="mant-box hidden" id="mantBox">
                <label class="fl">📅 Próximo mantenimiento</label>
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

function modalEditarServicio(sid) {
    const s = servicios.find(x => x.id === sid);
    if (!s) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div class="fr"><div><label class="fl">Tipo</label><select class="fi" id="esTipo"><option ${s.tipo==='Mantenimiento'?'selected':''}>Mantenimiento</option><option ${s.tipo==='Reparacion'?'selected':''}>Reparacion</option><option ${s.tipo==='Instalacion'?'selected':''}>Instalacion</option></select></div><div><label class="fl">Fecha</label><input class="fi" type="date" id="esFecha" value="${s.fecha}"></div></div>
        <label class="fl">Diagnóstico</label><textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea>
        <label class="fl">Próximo mantenimiento</label><input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento||''}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarServicio('${sid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarServicio(sid) {
    const tipo = document.getElementById('esTipo')?.value;
    const fecha = document.getElementById('esFecha')?.value;
    const desc = document.getElementById('esDesc')?.value?.trim();
    const prox = document.getElementById('esProx')?.value || null;
    try {
        await updateDoc(doc(db, 'servicios', sid), { tipo, fecha, descripcion: desc, proximoMantenimiento: prox });
        closeModal();
        await cargarDatos();
        toast('✅ Servicio actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarServicio(sid) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try { await deleteDoc(doc(db, 'servicios', sid)); await cargarDatos(); toast('🗑️ Eliminado'); } 
    catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== RENDER SERVICIOS (con filtros) =====
function renderServicios() {
    const años = [...new Set(servicios.map(s=>s.fecha?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `<div class="page">
        <div class="sec-head"><h2>Servicios</h2></div>
        <div class="filtros">
            <select class="fi" id="fAnio"><option value="">Todos los años</option>${años.map(a=>`<option>${a}</option>`).join('')}</select>
            <select class="fi" id="fMes"><option value="">Todos los meses</option>${meses.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('')}</select>
            <select class="fi" id="fTipo"><option value="">Todos los tipos</option><option>Mantenimiento</option><option>Reparacion</option><option>Instalacion</option></select>
            <select class="fi" id="fEntidad"><option value="">Todas las entidades</option><optgroup label="CEDIS">${cedis.map(c=>`<option value="cedi_${c.id}">CEDI: ${c.nombre}</option>`).join('')}</optgroup><optgroup label="TIENDAS">${tiendas.map(t=>`<option value="tienda_${t.id}">Tienda: ${t.nombre}</option>`).join('')}</optgroup></select>
            <select class="fi" id="fTecnico"><option value="">Todos los técnicos</option>${tecnicos.map(t=>`<option>${t.nombre}</option>`).join('')}</select>
            <button class="btn btn-blue btn-full" onclick="aplicarFiltros()">Aplicar</button>
            <button class="btn btn-gray btn-full" onclick="limpiarFiltros()">Limpiar</button>
        </div>
        <div id="listaServicios"></div>
    </div>`;
}

function aplicarFiltros() {
    const anio = document.getElementById('fAnio')?.value||'';
    const mes = document.getElementById('fMes')?.value||'';
    const tipo = document.getElementById('fTipo')?.value||'';
    const entidadVal = document.getElementById('fEntidad')?.value||'';
    const tec = document.getElementById('fTecnico')?.value||'';
    let filtrados = [...servicios].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    if (anio) filtrados = filtrados.filter(s=>s.fecha?.startsWith(anio));
    if (mes) filtrados = filtrados.filter(s=>s.fecha?.slice(5,7)===mes);
    if (tipo) filtrados = filtrados.filter(s=>s.tipo===tipo);
    if (tec) filtrados = filtrados.filter(s=>s.tecnico===tec);
    if (entidadVal) {
        const [tipoEnt, id] = entidadVal.split('_');
        const equiposEnt = equipos.filter(e => e.entidadTipo === tipoEnt && e.entidadId === id);
        const idsEquipos = equiposEnt.map(e => e.id);
        filtrados = filtrados.filter(s => idsEquipos.includes(s.equipoId));
    }
    const el = document.getElementById('listaServicios');
    if (!el) return;
    if (!filtrados.length) { el.innerHTML='<p class="cc-meta" style="text-align:center;">Sin resultados.</p>'; return; }
    el.innerHTML = filtrados.map(s => {
        const e = getEq(s.equipoId);
        let entidadNombre = '';
        if (e) {
            if (e.entidadTipo === 'cedi') {
                const c = getCedi(e.entidadId);
                entidadNombre = c ? c.nombre : '';
            } else {
                const t = getTienda(e.entidadId);
                entidadNombre = t ? t.nombre : '';
            }
        }
        return `<div class="si" style="margin:0 16px 12px;">
            <div class="si-top"><span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparacion'?'b-red':'b-green'}">${s.tipo}</span><span>${fmtFecha(s.fecha)}</span></div>
            <div class="si-info">🏢 ${entidadNombre} · ${e?.marca||''} ${e?.modelo||''}</div>
            <div class="si-info">📍 ${e?.ubicacion||''} · 🔧 ${s.tecnico}</div>
            <div class="si-info">${s.descripcion}</div>
            ${s.proximoMantenimiento?`<div class="si-info" style="color:var(--gold);">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>`:''}
        </div>`;
    }).join('');
}

function limpiarFiltros() {
    ['fAnio','fMes','fTipo','fEntidad','fTecnico'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    aplicarFiltros();
}

// ===== MANTENIMIENTOS (AGENDA) =====
function renderMantenimientos() {
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const año = new Date().getFullYear();
    const mant = servicios.filter(s=>s.proximoMantenimiento);
    return `<div class="page">
        <div class="sec-head"><h2>Agenda ${año}</h2></div>
        <div class="tbl-wrap">
            <table>
                <thead><tr><th>Mes</th><th>Fecha</th><th>Entidad</th><th>Activo</th><th></th></tr></thead>
                <tbody>
                ${MESES.map((mes,idx) => {
                    const mp = String(idx+1).padStart(2,'0');
                    const lista = mant.filter(m=>m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                    if (!lista.length) return `<tr><td style="color:var(--hint);">${mes}</td><td colspan="4" style="color:#cbd5e1;">—</td></tr>`;
                    return lista.map((m,i) => {
                        const e = getEq(m.equipoId);
                        let entidadNombre = '';
                        if (e) {
                            if (e.entidadTipo === 'cedi') {
                                const c = getCedi(e.entidadId);
                                entidadNombre = c ? c.nombre : '';
                            } else {
                                const t = getTienda(e.entidadId);
                                entidadNombre = t ? t.nombre : '';
                            }
                        }
                        return `<tr>
                            ${i===0?`<td rowspan="${lista.length}" style="font-weight:700;background:var(--bg2);">${mes}</td>`:''}
                            <td>${fmtFecha(m.proximoMantenimiento)}</td>
                            <td>${entidadNombre}</td>
                            <td>${e?`${e.marca} ${e.modelo}`:'N/A'}</td>
                            <td><button class="rec-btn" onclick="modalRecordar('${e?.id}','${m.proximoMantenimiento}')">📱</button></td>
                        </tr>`;
                    }).join('');
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

function modalRecordar(equipoId, fecha) {
    const e = getEq(equipoId);
    if (!e) return;
    let entidad = null;
    let telefono = '';
    let destinatario = '';
    if (e.entidadTipo === 'cedi') {
        entidad = getCedi(e.entidadId);
        if (entidad) { telefono = entidad.telefono; destinatario = entidad.nombre; }
    } else {
        entidad = getTienda(e.entidadId);
        if (entidad) { telefono = entidad.telefono; destinatario = entidad.nombre; }
    }
    if (!telefono) { toast('⚠️ No hay teléfono registrado'); return; }
    const fechaF = fmtFechaLarga(fecha);
    const msg = `Hola *${destinatario}*, recordatorio: activo *${e.marca} ${e.modelo}* (${e.ubicacion}) requiere mantenimiento el *${fechaF}*. Por favor confirmar. D1 Mantenimiento.`;
    showModal(`<div class="modal"><div class="modal-h"><h3>📱 Recordatorio WhatsApp</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div class="ec-meta">Para <strong>${destinatario}</strong> · 📞 ${telefono}</div>
        <div class="wa-bubble">${msg}</div>
        <textarea class="fi" id="waMsgEdit" rows="4">${msg}</textarea>
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-wa" onclick="enviarWhatsApp('${telefono}')">📱 Abrir WhatsApp</button></div>
    </div></div>`);
}

function enviarWhatsApp(tel) {
    const msg = document.getElementById('waMsgEdit')?.value||'';
    const telLimpio = '57' + tel.replace(/\D/g,'');
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    closeModal();
    toast('📱 WhatsApp abierto');
}

// ===== TÉCNICOS (igual que OLM) =====
function renderTecnicos() {
    return `<div class="page">
        <div class="sec-head"><h2>Técnicos (${tecnicos.length})</h2>${esAdmin() ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>` : ''}</div>
        ${tecnicos.map(t => {
            const esps = (t.especialidades||[]).map(id => ESPECIALIDADES.find(e=>e.id===id)?.label||id);
            return `<div class="ec" style="margin:0 16px 12px;">
                <div style="display:flex;justify-content:space-between;">
                    <div><div class="ec-name">${t.nombre}</div><div class="ec-meta">${t.tipoDoc} ${t.cedula}</div><div class="ec-meta">${t.cargo}</div><div class="ec-meta">📞 ${t.telefono}</div></div>
                    <div><span class="tc-rol-badge ${t.rol==='admin'?'rol-admin':'rol-tec'}">${t.rol==='admin'?'Admin':'Técnico'}</span>${esAdmin() ? `<div><button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button><button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button></div>` : ''}</div>
                </div>
                <div>${esps.map(e=>`<span class="esp-chip">${e}</span>`).join('')}</div>
                <div class="ec-meta">📍 ${t.region||'Sin región'}</div>
                <button class="btn btn-blue btn-sm btn-full" onclick="abrirLogin('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button>
            </div>`;
        }).join('')}
    </div>`;
}

function abrirLogin(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal" style="max-width:320px;"><div class="modal-h"><h3>🔑 Ingresar</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div style="font-weight:700;">${t.nombre}</div><div class="ec-meta">${t.tipoDoc} ${t.cedula}</div>
        <label class="fl">Cédula</label><input class="fi" id="mlCedula" type="number">
        <label class="fl">Clave (4 dígitos)</label>
        <div class="pin-display"><div class="pin-digit" id="mlpd0"></div><div class="pin-digit" id="mlpd1"></div><div class="pin-digit" id="mlpd2"></div><div class="pin-digit" id="mlpd3"></div></div>
        <div class="numpad">${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="num-btn" onclick="mlPin('${tid}',${n})">${n}</div>`).join('')}<div class="num-btn del" onclick="mlDel()">⌫</div><div class="num-btn zero" onclick="mlPin('${tid}',0)">0</div><div class="num-btn ok" onclick="mlLogin('${tid}')">✓</div></div>
        <div id="mlMsg"></div>
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="mlLogin('${tid}')">Ingresar</button></div>
    </div></div>`);
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
    if (!cedula) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Cédula requerida</div>'; return; }
    if (mlPinActual.length<4) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Clave de 4 dígitos</div>'; return; }
    if (t.cedula !== cedula || t.clave !== mlPinActual) { if(msg) msg.innerHTML='<div class="login-error">❌ Credenciales incorrectas</div>'; mlPinActual=''; mlUpdateDisplay(); return; }
    sesionActual = t;
    mlPinActual = '';
    closeModal();
    actualizarTopbar();
    currentView='panel';
    renderView();
    toast(`✅ Bienvenido, ${t.nombre.split(' ')[0]}`);
}

function modalNuevoTecnico() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre *</label><input class="fi" id="tNombre">
        <div class="fr"><div><label class="fl">Tipo Doc</label><select class="fi" id="tTipoDoc">${TIPOS_DOC.map(d=>`<option>${d}</option>`).join('')}</select></div><div><label class="fl">Cédula *</label><input class="fi" id="tCedula" type="number"></div></div>
        <label class="fl">Teléfono</label><input class="fi" id="tTel">
        <label class="fl">Cargo</label><input class="fi" id="tCargo">
        <label class="fl">Rol</label><select class="fi" id="tRol"><option value="tecnico">Técnico</option><option value="admin">Admin</option></select>
        <label class="fl">Clave (4 dígitos) *</label><input class="fi" id="tClave" type="password" maxlength="4">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button></div>
    </div></div>`);
}

async function guardarTecnico() {
    const n = document.getElementById('tNombre')?.value?.trim();
    const cc = document.getElementById('tCedula')?.value?.trim();
    const cl = document.getElementById('tClave')?.value?.trim();
    if (!n || !cc || !cl) { toast('⚠️ Nombre, cédula y clave requeridos'); return; }
    if (cl.length !== 4) { toast('⚠️ Clave de 4 dígitos'); return; }
    try {
        await addDoc(collection(db, 'tecnicos'), {
            nombre: n, cedula: cc,
            tipoDoc: document.getElementById('tTipoDoc')?.value || 'CC',
            telefono: document.getElementById('tTel')?.value || '',
            cargo: document.getElementById('tCargo')?.value || '',
            rol: document.getElementById('tRol')?.value || 'tecnico',
            especialidades: [],
            region: '',
            clave: cl
        });
        closeModal();
        await cargarDatos();
        toast('✅ Técnico guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarTecnico(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">Nombre</label><input class="fi" id="etNombre" value="${t.nombre}">
        <label class="fl">Cédula</label><input class="fi" id="etCedula" value="${t.cedula}">
        <label class="fl">Teléfono</label><input class="fi" id="etTel" value="${t.telefono}">
        <label class="fl">Cargo</label><input class="fi" id="etCargo" value="${t.cargo || ''}">
        <label class="fl">Rol</label><select class="fi" id="etRol"><option value="tecnico" ${t.rol==='tecnico'?'selected':''}>Técnico</option><option value="admin" ${t.rol==='admin'?'selected':''}>Admin</option></select>
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
        rol: document.getElementById('etRol').value
    };
    const newClave = document.getElementById('etClave')?.value?.trim();
    if (newClave && newClave.length === 4) data.clave = newClave;
    try {
        await updateDoc(doc(db, 'tecnicos', tid), data);
        closeModal();
        await cargarDatos();
        toast('✅ Técnico actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarTecnico(tid) {
    if (!confirm('¿Eliminar este técnico?')) return;
    try {
        await deleteDoc(doc(db, 'tecnicos', tid));
        await cargarDatos();
        toast('🗑️ Técnico eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== PDF, QR, y otras utilidades (simplificadas, se mantienen funcionales) =====
function generarInformePDF(eid) {
    const e = getEq(eid);
    if (!e) return;
    let entidadNombre = '';
    if (e.entidadTipo === 'cedi') {
        const c = getCedi(e.entidadId);
        entidadNombre = c ? c.nombre : '';
    } else {
        const t = getTienda(e.entidadId);
        entidadNombre = t ? t.nombre : '';
    }
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const LOGO = 'https://github.com/capacitADA/D-one/blob/main/D1_logo.png?raw=true';
    const serviciosHTML = ss.map(s => {
        const fotosHTML = (s.fotos||[]).length > 0
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">${(s.fotos||[]).map(f=>`<img src="${f}" style="height:80px;width:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">`).join('')}</div>`
            : '';
        const proxHTML = (s.tipo === 'Mantenimiento' && s.proximoMantenimiento)
            ? `<div style="color:#b45309;font-size:16px;margin-top:4px;">📅 Próximo mantenimiento: ${fmtFecha(s.proximoMantenimiento)}</div>`
            : '';
        return `<div style="border:1px solid #d1d5db;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="background:${s.tipo==='Mantenimiento'?'#1d4ed8':s.tipo==='Reparacion'?'#dc2626':'#15803d'};color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">${s.tipo}</span>
                <span style="font-size:16px;color:#555;">${fmtFecha(s.fecha)}</span>
            </div>
            <div style="font-size:16px;color:#374151;margin:3px 0;">🔧 ${s.tecnico}</div>
            <div style="font-size:16px;color:#111;margin:3px 0;">${s.descripcion}</div>
            ${fotosHTML}${proxHTML}
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe_${e.marca}_${e.modelo}</title>
    <style>@page{size:letter;margin:15mm;}body{font-family:Arial,sans-serif;}</style></head><body>
    <div style="display:flex;align-items:center;border-bottom:3px solid #0d4a3a;padding-bottom:10px;margin-bottom:12px;">
        <img src="${LOGO}" style="height:64px;margin-right:18px;" onerror="this.style.display='none'">
        <div><div style="font-size:14px;color:#555;">D1 Mantenimiento | 📞 311 483 1801</div><div style="font-size:18px;font-weight:700;">INFORME TÉCNICO</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px;background:#f1f5f9;"><strong>Entidad:</strong> ${entidadNombre}</td><td style="padding:6px;background:#f1f5f9;"><strong>Fecha:</strong> ${new Date().toLocaleString()}</td></tr>
        <tr><td colspan="2" style="padding:6px;"><strong>Activo:</strong> ${e.tipo||''} ${e.marca} ${e.modelo} | Serie: ${e.serie||'N/A'} | Ubicación: ${e.ubicacion}</td></tr>
    </table>
    <div style="background:#0d4a3a;color:white;padding:7px;margin:10px 0;">HISTORIAL DE SERVICIOS (${ss.length})</div>
    ${serviciosHTML}
    </body></html>`;
    const v = window.open('', '_blank');
    if (v) { v.document.open(); v.document.write(html); v.document.close(); setTimeout(()=>v.print(),500); }
}

function modalQR(eid) {
    const e = getEq(eid);
    if (!e) return;
    const url = `${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:280px;height:280px;';
    document.body.appendChild(qrDiv);
    const QRLib = window.QRCode;
    if (!QRLib) { toast('⚠️ QRCode.js no cargado'); return; }
    new QRLib(qrDiv, { text: url, width: 280, height: 280, colorDark: '#0d4a3a', colorLight: '#ffffff' });
    setTimeout(() => {
        const qrCanvas = qrDiv.querySelector('canvas');
        const qrDataUrl = qrCanvas.toDataURL('image/png');
        document.body.removeChild(qrDiv);
        showModal(`<div class="modal" style="max-width:340px;"><div class="modal-h"><h3>📱 Código QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b" style="text-align:center;"><img src="${qrDataUrl}" style="width:100%;"><a href="${qrDataUrl}" download="QR_${e.marca}_${e.modelo}.png" class="btn btn-blue btn-full" style="margin-top:8px;">⬇️ Descargar QR</a></div></div>`);
    }, 200);
}

function manejarRutaQR() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/equipo/')) return false;
    const eid = hash.replace('#/equipo/', '');
    const e = getEq(eid);
    if (!e) return false;
    let entidadNombre = '';
    let telefono = '';
    if (e.entidadTipo === 'cedi') {
        const c = getCedi(e.entidadId);
        if (c) { entidadNombre = c.nombre; telefono = c.telefono; }
    } else {
        const t = getTienda(e.entidadId);
        if (t) { entidadNombre = t.nombre; telefono = t.telefono; }
    }
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const main = document.getElementById('mainContent');
    const topbar = document.querySelector('.topbar');
    const botnav = document.querySelector('.botnav');
    if (topbar) topbar.style.display = 'none';
    if (botnav) botnav.style.display = 'none';
    main.style.background = 'white';
    const waMsg = encodeURIComponent(`Hola, necesito soporte para el equipo ${e.marca} ${e.modelo} (${e.ubicacion}) de ${entidadNombre}.`);
    const waUrl = `https://wa.me/${telefono ? '57' + telefono.replace(/\D/g,'') : '573114831801'}?text=${waMsg}`;
    main.innerHTML = `<div style="max-width:600px;margin:0 auto;padding:1.5rem;">
        <div style="text-align:center;margin-bottom:0.75rem;"><img src="https://github.com/capacitADA/D-one/blob/main/D1_logo.png?raw=true" style="height:56px;"></div>
        <div style="background:#0d4a3a;border-radius:14px;padding:14px;color:white;text-align:center;margin-bottom:0.75rem;">
            <div>¿Necesitas soporte?</div><div style="font-size:2rem;font-weight:700;">${telefono || '311 483 1801'}</div>
        </div>
        <div style="border:1px solid #ccc;border-radius:12px;padding:1rem;margin-bottom:0.75rem;">
            <h3>${e.marca} ${e.modelo}</h3><p>📍 ${e.ubicacion}</p><p>🏢 ${entidadNombre}</p><p>Serie: ${e.serie || 'N/A'}</p>
        </div>
        <a href="${waUrl}" target="_blank" style="display:block;background:#25D366;color:white;padding:14px;border-radius:12px;text-align:center;text-decoration:none;margin-bottom:1rem;">📱 Contactar por WhatsApp</a>
        <h3>Historial (${ss.length})</h3>
        ${ss.map(s => `<div style="border:1px solid #d1ede0;border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;">
            <div><strong>${s.tipo}</strong> - ${fmtFecha(s.fecha)}</div><div>${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="color:#b45309;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
        </div>`).join('')}
    </div>`;
    return true;
}

// ===== GLOBALS Y EVENTOS =====
window.goTo = goTo;
window.closeModal = closeModal;
window.filtrarEntidades = filtrarEntidades;
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.modalNuevaEntidad = modalNuevaEntidad;
window.modalEditarEntidad = modalEditarEntidad;
window.modalEliminarEntidad = modalEliminarEntidad;
window.guardarEntidad = guardarEntidad;
window.actualizarEntidad = actualizarEntidad;
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
window.modalRecordar = modalRecordar;
window.enviarWhatsApp = enviarWhatsApp;
window.generarInformePDF = generarInformePDF;
window.modalQR = modalQR;
window.previewFoto = previewFoto;
window.borrarFoto = borrarFoto;
window.onTipoChange = onTipoChange;
window.abrirLogin = abrirLogin;
window.mlPin = mlPin;
window.mlDel = mlDel;
window.mlLogin = mlLogin;
window.cerrarSesion = cerrarSesion;
window.modalNuevoTecnico = modalNuevoTecnico;
window.modalEditarTecnico = modalEditarTecnico;
window.guardarTecnico = guardarTecnico;
window.actualizarTecnico = actualizarTecnico;
window.eliminarTecnico = eliminarTecnico;

document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (!sesionActual && page !== 'panel' && page !== 'tecnicos') {
            toast('🔒 Inicia sesión desde Técnicos');
            return;
        }
        selectedEntidadId = null;
        selectedEntidadTipo = null;
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