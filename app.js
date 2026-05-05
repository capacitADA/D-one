import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDw1faNff7uMXR6JbHOhZa7eA5WiiNAJNw",
  authDomain: "donecapacitada-4fa37.firebaseapp.com",
  databaseURL: "https://donecapacitada-4fa37-default-rtdb.firebaseio.com",
  projectId: "donecapacitada-4fa37",
  storageBucket: "donecapacitada-4fa37.firebasestorage.app",
  messagingSenderId: "449540711283",
  appId: "1:449540711283:web:01efe4696daafc4e215b06"
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYWgupeHfhfKmvMDk_FFsTj-P9PdJfXMn3pheGjFMXK7i43AW1V8A5BD4iCSbOho9c/exec';
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

let _driveConnected = false;
function driveIsConnected() { return _driveConnected; }
async function conectarDriveAuto() {
    try { await fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'no-cors' }); _driveConnected = true; console.log('✅ Drive conectado'); }
    catch(e) { console.log('⚠️ Drive no disponible'); _driveConnected = false; }
}
async function driveUploadPDF(html, filename) {
    if (!filename.endsWith('.pdf')) filename = filename.replace('.html', '') + '.pdf';
    try { await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html, filename }) }); return true; }
    catch(e) { return false; }
}

let clientes = [], tiendas = [], equipos = [], servicios = [], tecnicos = [];
let jmcTiendas = [], jmcTiendasVersion = '';

async function cargarDatos() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando...</p></div>';
    try {
        const [cs, ts, es, ss, tecs, jmc] = await Promise.all([
            getDocs(query(collection(db,'clientes'), orderBy('nombre'))),
            getDocs(query(collection(db,'tiendas'), orderBy('nombre'))),
            getDocs(collection(db,'equipos')),
            getDocs(query(collection(db,'servicios'), orderBy('fecha','desc'))),
            getDocs(collection(db,'tecnicos')),
            getDocs(collection(db,'jmc_tiendas'))
        ]);
        clientes = cs.docs.map(d => ({ id:d.id, ...d.data() }));
        tiendas = ts.docs.map(d => ({ id:d.id, ...d.data() }));
        equipos = es.docs.map(d => ({ id:d.id, ...d.data() }));
        servicios = ss.docs.map(d => ({ id:d.id, ...d.data() }));
        tecnicos = tecs.docs.map(d => ({ id:d.id, ...d.data() }));
        jmcTiendas = jmc.docs.map(d => ({ id:d.id, ...d.data() }));
        if(jmcTiendas[0]?.version) jmcTiendasVersion = jmcTiendas[0].version;
    } catch(err) {
        console.error(err);
        toast('⚠️ Error de conexión');
        main.innerHTML = '<div class="page"><p>Error de conexión</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

function getEntidad(id) {
    let ent = clientes.find(c => c.id === id);
    if (ent) return { ...ent, tipoEntidad: 'cliente' };
    ent = tiendas.find(t => t.id === id);
    if (ent) return { ...ent, tipoEntidad: 'tienda' };
    return null;
}

const getEq = id => equipos.find(e => e.id === id);
const getTec = id => tecnicos.find(t => t.id === id);
const getEquiposCliente = cid => equipos.filter(e => e.clienteId === cid);
const getEquiposTienda = tid => equipos.filter(e => e.clienteId === tid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosCliente = cid => servicios.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));
const getServiciosTienda = tid => servicios.filter(s => getEquiposTienda(tid).some(e => e.id === s.equipoId));
const getTiendaJMC = (sap) => jmcTiendas.find(t => t.sap === String(sap));
function esClienteJMC(clienteId) {
    const c = clientes.find(c => c.id === clienteId);
    return c?.nombre === 'Jeronimo Martins Colombia';
}

function fmtFecha(f) { if (!f) return ''; return new Date(f + 'T12:00:00').toLocaleDateString('es-ES'); }
function fmtFechaLarga(f) { if (!f) return ''; return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' }); }

function esAdmin() { return sesionActual?.rol === 'admin'; }
function toast(msg, duration=3000) { const t = document.getElementById('toastEl'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), duration); }
function showModal(html) { const ov = document.getElementById('overlayEl'); if (!ov) return; ov.innerHTML = html; ov.classList.remove('hidden'); ov.onclick = e => { if(e.target === ov) closeModal(); }; }
function closeModal() { const ov = document.getElementById('overlayEl'); if (!ov) return; ov.classList.add('hidden'); ov.innerHTML = ''; fotosNuevas = [null,null,null]; }

function actualizarTopbar() {
    const right = document.getElementById('topbarRight');
    if (!right) return;
    if (!sesionActual) { right.innerHTML = `<span class="topbar-user">Sin sesión</span>`; }
    else {
        const initials = sesionActual.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
        const rolBadge = esAdmin() ? `<span class="topbar-rol-badge">Admin</span>` : '';
        right.innerHTML = `<div class="topbar-sesion"><div class="topbar-avatar">${initials}</div><div><div style="font-size:0.68rem;color:white;font-weight:700;">${sesionActual.nombre.split(' ')[0]}</div>${rolBadge}</div><button class="topbar-salir" onclick="cerrarSesion()">Salir</button></div>`;
    }
}
function cerrarSesion() { sesionActual = null; actualizarTopbar(); renderView(); toast('👋 Sesion cerrada'); }

let currentView = 'panel';
let sesionActual = null;
let selectedClienteId = null, selectedTiendaId = null, selectedEquipoId = null;
let fotosNuevas = [null,null,null];
let _servicioEidActual = null;

// FIX: Lista completa de ciudades colombianas — todas las capitales de departamento + municipios principales
const CIUDADES = [
    'Arauca','Armenia','Barranquilla','Bogota','Bucaramanga','Buenaventura',
    'Bello','Cali','Cartagena','Cartago','Cucuta','Dosquebradas',
    'Envigado','Florencia','Floridablanca','Giron','Ibague','Itagui',
    'Leticia','Manizales','Medellin','Mitu','Mocoa','Monteria',
    'Neiva','Palmira','Pamplona','Pasto','Pereira','Piedecuesta',
    'Popayan','Puerto Carreno','Puerto Inirida','Quibdo','Riohacha',
    'Samaniego','San Andres','San Jose del Guaviare','Santa Marta',
    'Sincelejo','Soacha','Sogamoso','Soledad','Tunja','Turbo',
    'Valledupar','Villavicencio','Yopal'
].sort();

const TIPOS_DOC = ['CC','CE','PA','NIT','TI'];
const ESPECIALIDADES = [{id:'mecanico',label:'Mecanico de plantas'},{id:'baja',label:'Electricista baja tension'},{id:'media',label:'Electricista media tension'},{id:'electronico',label:'Electronico'},{id:'ups',label:'UPS'},{id:'planta',label:'Plantas electricas'}];

function goTo(view, id=null, eid=null) {
    currentView = view;
    selectedClienteId = (view === 'detalleCliente') ? id : null;
    selectedTiendaId = (view === 'detalleTienda') ? id : null;
    selectedEquipoId = (view === 'historial') ? eid : null;
    if(view !== 'detalleCliente' && view !== 'detalleTienda' && view !== 'historial') { selectedClienteId = null; selectedTiendaId = null; selectedEquipoId = null; }
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => b.classList.toggle('active', b.dataset.page === view || (view === 'detalleCliente' && b.dataset.page === 'clientes') || (view === 'detalleTienda' && b.dataset.page === 'tiendas') || (view === 'historial' && (b.dataset.page === 'clientes' || b.dataset.page === 'tiendas'))));
}

function renderView() {
    if(!sesionActual && currentView !== 'panel' && currentView !== 'tecnicos') currentView = 'panel';
    const main = document.getElementById('mainContent');
    if (!main) return;
    const botnav = document.getElementById('botnavEl');
    if (botnav) botnav.style.display = 'flex';
    switch(currentView) {
        case 'panel': main.innerHTML = renderPanel(); break;
        case 'clientes': main.innerHTML = renderClientes(); break;
        case 'tiendas': main.innerHTML = renderTiendas(); break;
        case 'detalleCliente': main.innerHTML = renderDetalleCliente(); break;
        case 'detalleTienda': main.innerHTML = renderDetalleTienda(); break;
        case 'historial': main.innerHTML = renderHistorial(); break;
        case 'servicios': main.innerHTML = renderServicios(); setTimeout(() => { if(window.aplicarFiltros) aplicarFiltros(); }, 100); break;
        case 'mantenimientos': main.innerHTML = renderMantenimientos(); break;
        case 'tecnicos': main.innerHTML = renderTecnicos(); break;
        default: main.innerHTML = renderPanel();
    }
}

// FIX: Panel — preselecciona CEDI cuyo nombre contenga "IBAGUE" (insensible a mayúsculas/tildes).
// Si no existe, usa el primer CEDI; si no hay CEDIs, usa la primera tienda.
// FIX: Se elimina el patrón originalRenderPanel + bind(this) que fallaba en módulos ES (this=undefined).
function renderPanel() {
    const opcionesCedi = clientes.map(c => ({ id:c.id, nombre:c.nombre, tipo:'cliente' }));
    const opcionesTienda = tiendas.map(t => ({ id:t.id, nombre:t.nombre, tipo:'tienda' }));
    const opciones = [...opcionesCedi, ...opcionesTienda];
    if(opciones.length === 0) {
        return `<div class="page"><div class="panel-banner">No hay CEDIs ni Tiendas registradas.</div></div>`;
    }

    // Buscar CEDI Ibagué
    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    let defaultIdx = opcionesCedi.findIndex(c => normalize(c.nombre).includes('ibague'));
    if(defaultIdx === -1) defaultIdx = 0; // primer CEDI si no hay Ibagué

    const html = `<div class="page" id="panelContainer">
        <div class="selector-panel"><select id="panelSelector" style="width:100%;padding:0.6rem 0.75rem;border:1px solid var(--border);border-radius:10px;font-size:0.88rem;font-weight:500;background:white;color:var(--text);">
            ${opciones.map((opt, i) => {
                const selected = i === defaultIdx ? 'selected' : '';
                return `<option value="${opt.tipo}|${opt.id}" ${selected}>${opt.tipo === 'cliente' ? 'CEDI: ' : 'TIENDA: '}${opt.nombre}</option>`;
            }).join('')}
        </select></div>
        <div id="panelStats"></div>
        <div id="panelEquiposFuera"></div>
    </div>`;

    // Iniciar panel después del render
    setTimeout(() => {
        const selector = document.getElementById('panelSelector');
        if(!selector) return;
        const [tipo, id] = selector.value.split('|');
        actualizarPanel(id, tipo);
        selector.addEventListener('change', (e) => {
            const [newTipo, newId] = e.target.value.split('|');
            actualizarPanel(newId, newTipo);
        });
    }, 100);

    return html;
}

async function actualizarPanel(entidadId, entidadTipo) {
    const equiposEntidad = equipos.filter(e => e.clienteId === entidadId);
    let operativos=0, fueraServicio=0, darBaja=0, sinInfo=0;
    for(const eq of equiposEntidad) {
        // FIX: usar solo el ÚLTIMO estado (primer servicio con estadoReparacion al ordenar desc)
        const ss = getServiciosEquipo(eq.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
        let ultimoEstado = null;
        for(const s of ss) { if(s.estadoReparacion) { ultimoEstado = s.estadoReparacion; break; } }
        if(ultimoEstado === 'OPERATIVO') operativos++;
        else if(ultimoEstado === 'FUERA DE SERVICIO') fueraServicio++;
        else if(ultimoEstado === 'DAR DE BAJA') darBaja++;
        else sinInfo++;
    }
    const hoy = new Date(), anioActual = hoy.getFullYear(), mesActual = hoy.getMonth()+1;
    let anualMant=0, anualRep=0, anualInst=0, mensualMant=0, mensualRep=0, mensualInst=0;
    for(const eq of equiposEntidad) {
        for(const s of getServiciosEquipo(eq.id)) {
            if(!s.fecha) continue;
            const fecha = new Date(s.fecha+'T12:00:00');
            if((hoy-fecha)/(1000*60*60*24*365) <= 1) {
                if(s.tipo === 'Mantenimiento') anualMant++;
                else if(s.tipo === 'Reparacion') anualRep++;
                else if(s.tipo === 'Instalacion') anualInst++;
            }
            if(fecha.getFullYear() === anioActual && (fecha.getMonth()+1) === mesActual) {
                if(s.tipo === 'Mantenimiento') mensualMant++;
                else if(s.tipo === 'Reparacion') mensualRep++;
                else if(s.tipo === 'Instalacion') mensualInst++;
            }
        }
    }
    const statsHtml = `<div class="panel-grid-3col">
        <div class="panel-cell"><div class="panel-cell-header">ESTADO</div><div class="panel-cell-content">
            <div><span class="pc-lbl">Operativos</span><span class="panel-number pn-green">${operativos}</span></div>
            <div><span class="pc-lbl">Fuera serv.</span><span class="panel-number pn-yellow">${fueraServicio}</span></div>
            <div><span class="pc-lbl">Dar de baja</span><span class="panel-number pn-red">${darBaja}</span></div>
            <div><span class="pc-lbl">Sin info</span><span class="panel-number pn-gray">${sinInfo}</span></div>
        </div></div>
        <div class="panel-cell"><div class="panel-cell-header">SERV. ANUAL</div><div class="panel-cell-content">
            <div><span class="pc-lbl">Mantenim.</span><span class="panel-number">${anualMant}</span></div>
            <div><span class="pc-lbl">Reparación</span><span class="panel-number">${anualRep}</span></div>
            <div><span class="pc-lbl">Instalación</span><span class="panel-number">${anualInst}</span></div>
        </div></div>
        <div class="panel-cell"><div class="panel-cell-header">SERV. MES</div><div class="panel-cell-content">
            <div><span class="pc-lbl">Mantenim.</span><span class="panel-number">${mensualMant}</span></div>
            <div><span class="pc-lbl">Reparación</span><span class="panel-number">${mensualRep}</span></div>
            <div><span class="pc-lbl">Instalación</span><span class="panel-number">${mensualInst}</span></div>
        </div></div>
    </div>`;

    // FIX: solo equipos cuyo ÚLTIMO estado sea "FUERA DE SERVICIO"
    const equiposFuera = equiposEntidad.filter(eq => {
        const ss = getServiciosEquipo(eq.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
        for(const s of ss) { if(s.estadoReparacion) return s.estadoReparacion === 'FUERA DE SERVICIO'; }
        return false;
    });
    let fueraHtml = '<div class="equipos-fuera"><h4>⚙️ Equipos FUERA DE SERVICIO</h4><div class="scroll-horizontal">';
    if(equiposFuera.length === 0) {
        fueraHtml += '<span style="font-size:0.75rem;color:var(--hint);">No hay equipos en este estado.</span>';
    } else {
        for(const eq of equiposFuera) {
            fueraHtml += `<div class="equipo-card" onclick="goTo('historial', null, '${eq.id}')">${eq.marca} ${eq.tipo || ''} ${eq.modelo}</div>`;
        }
    }
    fueraHtml += '</div></div>';

    const ent = getEntidad(entidadId);
    const exportBtn = `<div style="display:flex;justify-content:flex-end;margin-bottom:0.5rem;">
        <button class="btn btn-gray btn-sm" onclick="exportarHistorialEntidad('${entidadId}')">📊 Exportar Excel</button>
    </div>`;

    const statsDiv = document.getElementById('panelStats');
    const fueraDiv = document.getElementById('panelEquiposFuera');
    if(statsDiv) statsDiv.innerHTML = exportBtn + statsHtml;
    if(fueraDiv) fueraDiv.innerHTML = fueraHtml;
}

// Exporta TODO el historial de todos los equipos del CEDI o Tienda seleccionado
function exportarHistorialEntidad(entidadId) {
    const ent = getEntidad(entidadId);
    const equiposEntidad = equipos.filter(e => e.clienteId === entidadId);
    if(!equiposEntidad.length) { toast('⚠️ No hay activos registrados'); return; }

    const filas = [];
    for(const eq of equiposEntidad) {
        const ss = getServiciosEquipo(eq.id).sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
        for(const s of ss) {
            filas.push([
                fmtFecha(s.fecha),
                s.tipo || '',
                s.tecnico || '',
                s.estadoReparacion || '',
                s.descripcion || '',
                s.proximoMantenimiento ? fmtFecha(s.proximoMantenimiento) : '',
                ent?.nombre || '',
                `${eq.marca} ${eq.tipo||''} ${eq.modelo}`.trim(),
                eq.marca || '',
                eq.modelo || '',
                eq.serie || '',
                eq.ubicacion || ''
            ]);
        }
    }

    if(!filas.length) { toast('⚠️ Sin servicios para exportar'); return; }

    const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
    const header = ['Fecha','Tipo','Tecnico','Estado','Descripcion','Proximo Mantenimiento','CEDI/Tienda','Activo','Marca','Modelo','Serie','Ubicacion'];
    const csv = '\uFEFF' + [header.map(esc).join(','), ...filas.map(f => f.map(esc).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nombre = ent?.nombre || entidadId;
    a.download = `Historial_${nombre.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`📊 Excel descargado — ${filas.length} servicios`);
}

function renderClientes() {
    return `<div class="page"><div class="sec-head"><h2>CEDIs (${clientes.length})</h2><button class="btn btn-blue btn-sm" onclick="modalNuevoCliente()">+ Nuevo</button></div>
        <input class="search" placeholder="🔍 Buscar..." oninput="filtrarClientes(this.value)" id="searchClientes">
        <div id="clientesGrid">${clientes.map(c => `<div class="cc" data-search="${(c.nombre+c.ciudad+c.telefono+(c.email||'')).toLowerCase()}">
            <div style="display:flex;justify-content:space-between;"><div class="cc-name">${c.nombre}</div>${esAdmin()?`<div><button class="ib" onclick="modalEditarCliente('${c.id}')">✏️</button><button class="ib" onclick="modalEliminarCliente('${c.id}')">🗑️</button></div>`:''}</div>
            <div class="cc-row">📞 ${c.telefono}</div>${c.email?`<div class="cc-row">📧 ${c.email}</div>`:''}
            <div class="cc-row">📍 ${c.direccion}</div><span class="city-tag">${c.ciudad}</span>
            ${c.latitud?`<div><a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver GPS</a></div>`:''}
            <div class="cc-meta">${getEquiposCliente(c.id).length} activo(s) · ${getServiciosCliente(c.id).length} servicio(s)</div>
            <button class="link-btn" onclick="goTo('detalleCliente','${c.id}')">Ver activos →</button>
        </div>`).join('')}</div></div>`;
}

function filtrarClientes(v) { const txt=v.toLowerCase(); document.querySelectorAll('#clientesGrid .cc').forEach(c=>{c.style.display=(c.dataset.search||'').includes(txt)?'':'none';}); }

function renderDetalleCliente() {
    const c = clientes.find(x=>x.id===selectedClienteId); if(!c) { goTo('clientes'); return ''; }
    const eqs = getEquiposCliente(c.id);
    return `<div class="page"><div class="det-hdr"><button class="back" onclick="goTo('clientes')">← Volver</button><div><div class="cc-name">${c.nombre}</div><div class="cc-meta">${c.ciudad}</div></div></div>
        <div class="info-box"><div class="cc-row">📞 <strong>${c.telefono}</strong></div>${c.email?`<div class="cc-row">📧 ${c.email}</div>`:''}
        <div class="cc-row">📍 ${c.direccion}</div>${c.latitud?`<a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver en Google Maps</a>`:'<div class="cc-meta">Sin GPS</div>'}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:0.65rem;"><span style="font-weight:700;">Activos (${eqs.length})</span><button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${c.id}')">+ Activo</button></div>
        ${eqs.map(e=>`<div class="ec"><div style="display:flex;justify-content:space-between;"><div><div class="ec-name">${e.marca} ${e.tipo||''} ${e.modelo}</div><div class="ec-meta">${e.ubicacion?'📍 '+e.ubicacion:''} · Serie: ${e.serie||'S/N'}</div><div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s)</div></div>${esAdmin()?`<div><button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button><button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button></div>`:''}</div>
        <div class="ec-btns"><button class="ab" onclick="goTo('historial','${c.id}','${e.id}')">📋 Servicios</button><button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button><button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button><button class="ab" onclick="modalQR('${e.id}')">📱 QR</button></div></div>`).join('')}
    </div>`;
}

function modalNuevoCliente() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo CEDI</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">SAP *</label><input class="fi" id="cSap">
        <label class="fl">Nombre *</label><input class="fi" id="cNombre">
        <div class="fr"><div><label class="fl">Ciudad *</label><select class="fi" id="cCiudad">${CIUDADES.map(ci=>`<option>${ci}</option>`).join('')}</select></div>
        <div><label class="fl">Departamento</label><input class="fi" id="cDepartamento"></div></div>
        <label class="fl">Dirección *</label><input class="fi" id="cDir">
        <label class="fl">Coordinador *</label><input class="fi" id="cCoordinador">
        <label class="fl">Cargo *</label><input class="fi" id="cCargo">
        <label class="fl">Teléfono *</label><input class="fi" id="cTel" type="tel">
        <label class="fl">Email (opcional)</label><input class="fi" id="cEmail">
        <button class="btn btn-blue btn-full" onclick="obtenerGPS('cLat','cLng')">📍 Compartir ubicación</button>
        <input type="hidden" id="cLat"><input type="hidden" id="cLng">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarCliente()">Guardar</button></div>
    </div></div>`);
}

async function guardarCliente() {
    const sap = document.getElementById('cSap')?.value?.trim();
    const nombre = document.getElementById('cNombre')?.value?.trim();
    const ciudad = document.getElementById('cCiudad')?.value;
    const depto = document.getElementById('cDepartamento')?.value?.trim();
    const direccion = document.getElementById('cDir')?.value?.trim();
    const coordinador = document.getElementById('cCoordinador')?.value?.trim();
    const cargo = document.getElementById('cCargo')?.value?.trim();
    const telefono = document.getElementById('cTel')?.value?.trim();
    const email = document.getElementById('cEmail')?.value?.trim();
    const lat = document.getElementById('cLat')?.value || '';
    const lng = document.getElementById('cLng')?.value || '';
    if (!sap || !nombre || !ciudad || !direccion || !coordinador || !cargo || !telefono) { toast('⚠️ Complete todos los campos obligatorios'); return; }
    try {
        await addDoc(collection(db, 'clientes'), { sap, nombre, ciudad, departamento: depto, direccion, coordinador, cargo, telefono, email: email || '', latitud: lat, longitud: lng });
        closeModal(); await cargarDatos(); toast('✅ CEDI guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarCliente(cid) {
    const c = clientes.find(x=>x.id===cid); if(!c) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar CEDI</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">SAP</label><input class="fi" id="eSap" value="${c.sap||''}">
        <label class="fl">Nombre</label><input class="fi" id="eNombre" value="${c.nombre}">
        <div class="fr"><div><label class="fl">Ciudad</label><select class="fi" id="eCiudad">${CIUDADES.map(ci=>`<option ${ci===c.ciudad?'selected':''}>${ci}</option>`).join('')}</select></div>
        <div><label class="fl">Departamento</label><input class="fi" id="eDepartamento" value="${c.departamento||''}"></div></div>
        <label class="fl">Dirección</label><input class="fi" id="eDir" value="${c.direccion}">
        <label class="fl">Coordinador</label><input class="fi" id="eCoordinador" value="${c.coordinador||''}">
        <label class="fl">Cargo</label><input class="fi" id="eCargo" value="${c.cargo||''}">
        <label class="fl">Teléfono</label><input class="fi" id="eTel" value="${c.telefono}">
        <label class="fl">Email</label><input class="fi" id="eEmail" value="${c.email||''}">
        <button class="btn btn-blue btn-full" onclick="obtenerGPS('eLat','eLng')">📍 Actualizar ubicación</button>
        <input type="hidden" id="eLat" value="${c.latitud||''}"><input type="hidden" id="eLng" value="${c.longitud||''}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarCliente('${cid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarCliente(cid) {
    const data = {
        sap: document.getElementById('eSap').value,
        nombre: document.getElementById('eNombre').value,
        ciudad: document.getElementById('eCiudad').value,
        departamento: document.getElementById('eDepartamento').value,
        direccion: document.getElementById('eDir').value,
        coordinador: document.getElementById('eCoordinador').value,
        cargo: document.getElementById('eCargo').value,
        telefono: document.getElementById('eTel').value,
        email: document.getElementById('eEmail').value,
        latitud: document.getElementById('eLat').value,
        longitud: document.getElementById('eLng').value
    };
    try { await updateDoc(doc(db, 'clientes', cid), data); closeModal(); await cargarDatos(); toast('✅ CEDI actualizado'); } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarCliente(cid) { if(!confirm('¿Eliminar este CEDI y todos sus activos/servicios?')) return; eliminarCliente(cid); }
async function eliminarCliente(cid) {
    const eids = getEquiposCliente(cid).map(e=>e.id);
    try { for(const eid of eids) { for(const s of getServiciosEquipo(eid)) await deleteDoc(doc(db,'servicios',s.id)); await deleteDoc(doc(db,'equipos',eid)); } await deleteDoc(doc(db,'clientes',cid)); await cargarDatos(); goTo('clientes'); toast('🗑️ CEDI eliminado'); } catch(err) { toast('❌ Error: '+err.message); }
}

function renderTiendas() {
    return `<div class="page"><div class="sec-head"><h2>Tiendas (${tiendas.length})</h2><button class="btn btn-blue btn-sm" onclick="modalNuevaTienda()">+ Nueva</button></div>
        <input class="search" placeholder="🔍 Buscar..." oninput="filtrarTiendas(this.value)" id="searchTiendas">
        <div id="tiendasGrid">${tiendas.map(t=>`<div class="cc" data-search="${(t.nombre+t.ciudad+t.telefono).toLowerCase()}">
            <div style="display:flex;justify-content:space-between;"><div class="cc-name">${t.nombre}</div>${esAdmin()?`<div><button class="ib" onclick="modalEditarTienda('${t.id}')">✏️</button><button class="ib" onclick="modalEliminarTienda('${t.id}')">🗑️</button></div>`:''}</div>
            <div class="cc-row">📞 ${t.telefono}</div><div class="cc-row">📍 ${t.direccion}</div><span class="city-tag">${t.ciudad}</span>
            ${t.latitud?`<div><a class="map-link" href="https://maps.google.com/?q=${t.latitud},${t.longitud}" target="_blank">🗺️ Ver GPS</a></div>`:''}
            <div class="cc-meta">${getEquiposTienda(t.id).length} activo(s) · ${getServiciosTienda(t.id).length} servicio(s)</div>
            <button class="link-btn" onclick="goTo('detalleTienda','${t.id}')">Ver activos →</button>
        </div>`).join('')}</div></div>`;
}

function filtrarTiendas(v) { const txt=v.toLowerCase(); document.querySelectorAll('#tiendasGrid .cc').forEach(c=>{c.style.display=(c.dataset.search||'').includes(txt)?'':'none';}); }

function renderDetalleTienda() {
    const t = tiendas.find(x=>x.id===selectedTiendaId); if(!t) { goTo('tiendas'); return ''; }
    const eqs = getEquiposTienda(t.id);
    return `<div class="page"><div class="det-hdr"><button class="back" onclick="goTo('tiendas')">← Volver</button><div><div class="cc-name">${t.nombre}</div><div class="cc-meta">${t.ciudad}</div></div></div>
        <div class="info-box"><div class="cc-row">📞 <strong>${t.telefono}</strong></div><div class="cc-row">📍 ${t.direccion}</div>${t.latitud?`<a class="map-link" href="https://maps.google.com/?q=${t.latitud},${t.longitud}" target="_blank">🗺️ Ver en Google Maps</a>`:'<div class="cc-meta">Sin GPS</div>'}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:0.65rem;"><span style="font-weight:700;">Activos (${eqs.length})</span><button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${t.id}')">+ Activo</button></div>
        ${eqs.map(e=>`<div class="ec"><div style="display:flex;justify-content:space-between;"><div><div class="ec-name">${e.marca} ${e.tipo||''} ${e.modelo}</div><div class="ec-meta">${e.ubicacion?'📍 '+e.ubicacion:''} · Serie: ${e.serie||'S/N'}</div><div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s)</div></div>${esAdmin()?`<div><button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button><button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button></div>`:''}</div>
        <div class="ec-btns"><button class="ab" onclick="goTo('historial','${t.id}','${e.id}')">📋 Servicios</button><button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button><button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button><button class="ab" onclick="modalQR('${e.id}')">📱 QR</button></div></div>`).join('')}
    </div>`;
}

function modalNuevaTienda() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nueva Tienda</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">SAP *</label><input class="fi" id="tSap">
        <label class="fl">Nombre *</label><input class="fi" id="tNombre">
        <div class="fr"><div><label class="fl">Ciudad *</label><select class="fi" id="tCiudad">${CIUDADES.map(ci=>`<option>${ci}</option>`).join('')}</select></div>
        <div><label class="fl">Departamento</label><input class="fi" id="tDepartamento"></div></div>
        <label class="fl">Dirección *</label><input class="fi" id="tDir">
        <label class="fl">Coordinador *</label><input class="fi" id="tCoordinador">
        <label class="fl">Cargo *</label><input class="fi" id="tCargo">
        <label class="fl">Teléfono *</label><input class="fi" id="tTel" type="tel">
        <button class="btn btn-blue btn-full" onclick="obtenerGPS('tLat','tLng')">📍 Compartir ubicación</button>
        <input type="hidden" id="tLat"><input type="hidden" id="tLng">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarTienda()">Guardar</button></div>
    </div></div>`);
}

async function guardarTienda() {
    const sap = document.getElementById('tSap')?.value?.trim();
    const nombre = document.getElementById('tNombre')?.value?.trim();
    const ciudad = document.getElementById('tCiudad')?.value;
    const depto = document.getElementById('tDepartamento')?.value?.trim();
    const direccion = document.getElementById('tDir')?.value?.trim();
    const coordinador = document.getElementById('tCoordinador')?.value?.trim();
    const cargo = document.getElementById('tCargo')?.value?.trim();
    const telefono = document.getElementById('tTel')?.value?.trim();
    const lat = document.getElementById('tLat')?.value || '';
    const lng = document.getElementById('tLng')?.value || '';
    if (!sap || !nombre || !ciudad || !direccion || !coordinador || !cargo || !telefono) { toast('⚠️ Complete todos los campos obligatorios'); return; }
    try {
        await addDoc(collection(db, 'tiendas'), { sap, nombre, ciudad, departamento: depto, direccion, coordinador, cargo, telefono, latitud: lat, longitud: lng });
        closeModal(); await cargarDatos(); toast('✅ Tienda guardada');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarTienda(tid) {
    const t = tiendas.find(x=>x.id===tid); if(!t) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar Tienda</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <label class="fl">SAP</label><input class="fi" id="etSap" value="${t.sap||''}">
        <label class="fl">Nombre</label><input class="fi" id="etNombre" value="${t.nombre}">
        <div class="fr"><div><label class="fl">Ciudad</label><select class="fi" id="etCiudad">${CIUDADES.map(ci=>`<option ${ci===t.ciudad?'selected':''}>${ci}</option>`).join('')}</select></div>
        <div><label class="fl">Departamento</label><input class="fi" id="etDepartamento" value="${t.departamento||''}"></div></div>
        <label class="fl">Dirección</label><input class="fi" id="etDir" value="${t.direccion}">
        <label class="fl">Coordinador</label><input class="fi" id="etCoordinador" value="${t.coordinador||''}">
        <label class="fl">Cargo</label><input class="fi" id="etCargo" value="${t.cargo||''}">
        <label class="fl">Teléfono</label><input class="fi" id="etTel" value="${t.telefono}">
        <button class="btn btn-blue btn-full" onclick="obtenerGPS('etLat','etLng')">📍 Actualizar ubicación</button>
        <input type="hidden" id="etLat" value="${t.latitud||''}"><input type="hidden" id="etLng" value="${t.longitud||''}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarTienda('${tid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarTienda(tid) {
    const data = {
        sap: document.getElementById('etSap').value,
        nombre: document.getElementById('etNombre').value,
        ciudad: document.getElementById('etCiudad').value,
        departamento: document.getElementById('etDepartamento').value,
        direccion: document.getElementById('etDir').value,
        coordinador: document.getElementById('etCoordinador').value,
        cargo: document.getElementById('etCargo').value,
        telefono: document.getElementById('etTel').value,
        latitud: document.getElementById('etLat').value,
        longitud: document.getElementById('etLng').value
    };
    try { await updateDoc(doc(db, 'tiendas', tid), data); closeModal(); await cargarDatos(); toast('✅ Tienda actualizada'); } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarTienda(tid) { if(!confirm('¿Eliminar esta Tienda y todos sus activos/servicios?')) return; eliminarTienda(tid); }
async function eliminarTienda(tid) {
    const eids = getEquiposTienda(tid).map(e=>e.id);
    try { for(const eid of eids) { for(const s of getServiciosEquipo(eid)) await deleteDoc(doc(db,'servicios',s.id)); await deleteDoc(doc(db,'equipos',eid)); } await deleteDoc(doc(db,'tiendas',tid)); await cargarDatos(); goTo('tiendas'); toast('🗑️ Tienda eliminada'); } catch(err) { toast('❌ Error: '+err.message); }
}

function modalNuevoEquipo(entidadId) {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div class="fr"><div><label class="fl">Marca *</label><input class="fi" id="qMarca"></div><div><label class="fl">Modelo *</label><input class="fi" id="qModelo"></div></div>
        <label class="fl">Serie</label><input class="fi" id="qSerie">
        <label class="fl">Tipo</label><input class="fi" id="qTipo">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarEquipo('${entidadId}')">Guardar</button></div>
    </div></div>`);
}

async function guardarEquipo(entidadId) {
    const marca = document.getElementById('qMarca')?.value?.trim();
    const modelo = document.getElementById('qModelo')?.value?.trim();
    if (!marca || !modelo) { toast('⚠️ Complete marca y modelo'); return; }
    const serie = document.getElementById('qSerie')?.value || '';
    const tipo = document.getElementById('qTipo')?.value || '';
    try {
        await addDoc(collection(db, 'equipos'), { clienteId: entidadId, marca, modelo, serie, tipo, ubicacion: '' });
        closeModal(); await cargarDatos(); toast('✅ Activo guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarEquipo(eid) {
    const eq = getEq(eid); if(!eq) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div class="fr"><div><label class="fl">Marca</label><input class="fi" id="eMarca" value="${eq.marca}"></div><div><label class="fl">Modelo</label><input class="fi" id="eModelo" value="${eq.modelo}"></div></div>
        <label class="fl">Serie</label><input class="fi" id="eSerie" value="${eq.serie||''}">
        <label class="fl">Tipo</label><input class="fi" id="eTipoEq" value="${eq.tipo||''}">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar</button></div>
    </div></div>`);
}

async function actualizarEquipo(eid) {
    try {
        await updateDoc(doc(db,'equipos',eid), {
            marca: document.getElementById('eMarca').value,
            modelo: document.getElementById('eModelo').value,
            serie: document.getElementById('eSerie').value,
            tipo: document.getElementById('eTipoEq').value
        });
        closeModal(); await cargarDatos(); toast('✅ Activo actualizado');
    } catch(err) { toast('❌ Error: '+err.message); }
}

function modalEliminarEquipo(eid) { if(!confirm('¿Eliminar este activo y sus servicios?')) return; eliminarEquipo(eid); }
async function eliminarEquipo(eid) {
    const ss = getServiciosEquipo(eid);
    try { for(const s of ss) await deleteDoc(doc(db,'servicios',s.id)); await deleteDoc(doc(db,'equipos',eid)); await cargarDatos(); toast('🗑️ Activo eliminado'); } catch(err) { toast('❌ Error: '+err.message); }
}

// FIX: font-size de fecha corregido de 2rem a 0.82rem
function renderHistorial() {
    const e = getEq(selectedEquipoId); if(!e) { goTo('clientes'); return ''; }
    const ent = getEntidad(e.clienteId); const nombreEnt = ent ? ent.nombre : 'Sin entidad';
    const ss = getServiciosEquipo(e.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    // Volver al detalle correcto según tipo de entidad
    const backTarget = ent?.tipoEntidad === 'tienda' ? `goTo('detalleTienda','${e.clienteId}')` : `goTo('detalleCliente','${e.clienteId}')`;
    return `<div class="page"><div class="det-hdr"><button class="back" onclick="${backTarget}">← Volver</button><div><div class="ec-name">${e.marca} ${e.tipo||''} ${e.modelo}</div><div class="ec-meta">${e.ubicacion||''} · ${nombreEnt}</div></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
            <span style="font-weight:700;">Historial (${ss.length})</span>
            <button class="btn btn-gray btn-sm" onclick="exportarHistorialExcel('${e.id}')">📊 Excel</button>
        </div>
        ${ss.map(s=>`<div class="si"><div class="si-top"><span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparacion'?'b-red':'b-green'}">${s.tipo}</span><span style="font-size:0.82rem;color:var(--hint);">${fmtFecha(s.fecha)}</span></div><div class="si-info">🔧 ${s.tecnico}</div>${s.estadoReparacion?`<div class="si-info"><strong>Estado:</strong> ${s.estadoReparacion}</div>`:''}<div class="si-info">${s.descripcion}</div>${s.proximoMantenimiento?`<div class="si-info" style="color:var(--gold);">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>`:''}<div class="fotos-strip">${(s.fotos||[]).map(f=>`<img class="fthumb" src="${f}" loading="lazy">`).join('')}</div><div class="si-top" style="justify-content:flex-end;margin-top:4px;">${puedeEditar(s.tecnico)?`<button class="ib" onclick="modalEditarServicio('${s.id}')">✏️</button>`:''}${esAdmin()?`<button class="ib" onclick="eliminarServicio('${s.id}')">🗑️</button>`:''}</div></div>`).join('')}
    </div>`;
}

// NUEVO: exportar historial completo del equipo a Excel (.csv descargable como xlsx)
function exportarHistorialExcel(eid) {
    const e = getEq(eid); if(!e) return;
    const ent = getEntidad(e.clienteId);
    const ss = getServiciosEquipo(eid).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
    if(!ss.length){ toast('⚠️ Sin servicios para exportar'); return; }
    const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
    const header = ['Fecha','Tipo','Tecnico','Estado','Descripcion','Proximo Mantenimiento','CEDI/Tienda','Activo','Marca','Modelo','Serie','Ubicacion'];
    const rows = ss.map(s => [
        fmtFecha(s.fecha),
        s.tipo||'',
        s.tecnico||'',
        s.estadoReparacion||'',
        s.descripcion||'',
        s.proximoMantenimiento ? fmtFecha(s.proximoMantenimiento) : '',
        ent?.nombre||'',
        `${e.marca} ${e.tipo||''} ${e.modelo}`.trim(),
        e.marca||'',
        e.modelo||'',
        e.serie||'',
        e.ubicacion||''
    ].map(esc).join(','));
    const csv = '\uFEFF' + [header.map(esc).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Historial_${e.marca}_${e.modelo}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('📊 Excel descargado');
}

// FIX: compresión de imagen antes de convertir a base64 (max 800px, calidad 0.7)
function comprimirFoto(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const MAX = 800;
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const mantBox = document.getElementById('mantBox');
    const reparacionBox = document.getElementById('reparacionBox');
    if(mantBox) mantBox.classList.toggle('hidden', tipo !== 'Mantenimiento');
    if(reparacionBox) reparacionBox.classList.toggle('hidden', tipo !== 'Reparacion');
}

function previewFoto(input,idx) {
    if(!input.files||!input.files[0]) return;
    fotosNuevas[idx]=input.files[0];
    const reader=new FileReader();
    reader.onload=e=>{
        const slot=document.getElementById('fslot'+idx);
        if(slot) slot.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"><button class="fslot-del" onclick="borrarFoto(event,${idx})">✕</button><input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
    };
    reader.readAsDataURL(input.files[0]);
}

function borrarFoto(e,idx) {
    e.stopPropagation();
    fotosNuevas[idx]=null;
    const slot=document.getElementById('fslot'+idx);
    if(slot){
        slot.innerHTML=`<div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${idx+1}</div><input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick=()=>document.getElementById('finput'+idx).click();
    }
}

function modalNuevoServicio(eid) {
    if(!sesionActual){ toast('🔑 Inicia sesion para continuar'); return; }
    const e=getEq(eid); const ent=getEntidad(e.clienteId); const hoy=new Date().toISOString().split('T')[0];
    fotosNuevas=[null,null,null]; _servicioEidActual=eid;
    showModal(`<div class="modal" onclick="event.stopPropagation()"><div class="modal-h"><h3>Nuevo servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div style="background:var(--bg2);padding:0.55rem;border-radius:8px;margin-bottom:0.65rem;"><strong>${ent?.nombre||'Sin entidad'}</strong><br><span style="font-size:0.75rem;">${e?.marca} ${e?.tipo||''} ${e?.modelo}</span></div>
        <div class="fr"><div><label class="fl">Tipo *</label><select class="fi" id="sTipo" onchange="onTipoChange()"><option>Mantenimiento</option><option>Reparacion</option><option>Instalacion</option></select></div>
        <div><label class="fl">Fecha *</label><input class="fi" type="date" id="sFecha" value="${hoy}"></div></div>
        <label class="fl">Tecnico</label><input class="fi" id="sTecnico" value="${sesionActual?.nombre||''}" readonly>
        <label class="fl">Diagnostico / Descripcion *</label><textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado..."></textarea>
        <div class="mant-box hidden" id="mantBox"><label class="fl">📅 Proximo mantenimiento</label><input class="fi" type="date" id="proxFecha"></div>
        <div class="reparacion-box hidden" id="reparacionBox"><label class="fl">🔧 Estado posterior a la reparación</label><select class="fi" id="estadoReparacion"><option value="OPERATIVO">OPERATIVO</option><option value="FUERA DE SERVICIO">FUERA DE SERVICIO</option><option value="DAR DE BAJA">DAR DE BAJA</option></select></div>
        <label class="fl">📷 Fotos (max 3)</label><div class="foto-row">${[0,1,2].map(i=>`<div style="flex:1;"><div class="fslot" id="fslot${i}" onclick="document.getElementById('finput${i}').click()"><div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${i+1}</div><input type="file" id="finput${i}" accept="image/*" style="display:none" onchange="previewFoto(this,${i})"></div></div>`).join('')}</div>
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" id="btnGuardarServicio" onclick="guardarServicio('${eid}')">💾 Guardar</button></div>
    </div></div>`);
    onTipoChange();
}

// FIX: botón bloqueado durante guardado para evitar duplicados; fotos comprimidas
async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if(!desc){ toast('⚠️ Ingresa el diagnostico'); return; }
    const tipo = document.getElementById('sTipo').value;
    const fecha = document.getElementById('sFecha').value;
    if(!fecha){ toast('⚠️ Selecciona la fecha'); return; }
    const prox = tipo === 'Mantenimiento' ? (document.getElementById('proxFecha')?.value || null) : null;
    const estadoRep = tipo === 'Reparacion' ? (document.getElementById('estadoReparacion')?.value || null) : null;

    // Bloquear botón para evitar doble guardado
    const btn = document.getElementById('btnGuardarServicio');
    if(btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    // FIX: comprimir fotos antes de subir
    const fotosBase64 = [];
    for(let i = 0; i < fotosNuevas.length; i++) {
        if(fotosNuevas[i]) fotosBase64.push(await comprimirFoto(fotosNuevas[i]));
    }

    try {
        await addDoc(collection(db,'servicios'), {
            equipoId: eid, tipo, fecha,
            tecnico: sesionActual?.nombre || '',
            descripcion: desc,
            proximoMantenimiento: prox,
            fotos: fotosBase64,
            estadoReparacion: estadoRep
        });
        closeModal();
        await cargarDatos();
        goTo('historial', null, eid);
        toast('✅ Servicio guardado con ' + fotosBase64.length + ' foto(s)');
    } catch(err) {
        if(btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
        toast('❌ Error: ' + err.message);
    }
}

// FIX: modalEditarServicio ahora incluye estadoReparacion y lógica condicional
function modalEditarServicio(sid) {
    const s = servicios.find(x=>x.id===sid); if(!s) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b">
        <div class="fr"><div><label class="fl">Tipo</label><select class="fi" id="esTipo" onchange="onEditTipoChange()">
            <option ${s.tipo==='Mantenimiento'?'selected':''}>Mantenimiento</option>
            <option ${s.tipo==='Reparacion'?'selected':''}>Reparacion</option>
            <option ${s.tipo==='Instalacion'?'selected':''}>Instalacion</option>
        </select></div>
        <div><label class="fl">Fecha</label><input class="fi" type="date" id="esFecha" value="${s.fecha}"></div></div>
        <label class="fl">Diagnostico</label><textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea>
        <div id="esMantBox" style="${s.tipo==='Mantenimiento'?'':'display:none'}"><label class="fl">Proximo mantenimiento</label><input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento||''}"></div>
        <div id="esRepBox" style="${s.tipo==='Reparacion'?'':'display:none'}"><label class="fl">Estado posterior</label><select class="fi" id="esEstado">
            <option value="OPERATIVO" ${s.estadoReparacion==='OPERATIVO'?'selected':''}>OPERATIVO</option>
            <option value="FUERA DE SERVICIO" ${s.estadoReparacion==='FUERA DE SERVICIO'?'selected':''}>FUERA DE SERVICIO</option>
            <option value="DAR DE BAJA" ${s.estadoReparacion==='DAR DE BAJA'?'selected':''}>DAR DE BAJA</option>
        </select></div>
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarServicio('${sid}')">Guardar</button></div>
    </div></div>`);
}

function onEditTipoChange() {
    const tipo = document.getElementById('esTipo')?.value;
    const mb = document.getElementById('esMantBox');
    const rb = document.getElementById('esRepBox');
    if(mb) mb.style.display = tipo === 'Mantenimiento' ? '' : 'none';
    if(rb) rb.style.display = tipo === 'Reparacion' ? '' : 'none';
}

// FIX: actualizarServicio ahora guarda estadoReparacion y proximoMantenimiento condicional
async function actualizarServicio(sid) {
    const tipo = document.getElementById('esTipo')?.value;
    const fecha = document.getElementById('esFecha')?.value;
    const desc = document.getElementById('esDesc')?.value?.trim();
    const prox = tipo === 'Mantenimiento' ? (document.getElementById('esProx')?.value || null) : null;
    const estadoRep = tipo === 'Reparacion' ? (document.getElementById('esEstado')?.value || null) : null;
    try {
        await updateDoc(doc(db,'servicios',sid), { tipo, fecha, descripcion: desc, proximoMantenimiento: prox, estadoReparacion: estadoRep });
        closeModal(); await cargarDatos(); toast('✅ Servicio actualizado');
    } catch(err) { toast('❌ Error: '+err.message); }
}

async function eliminarServicio(sid) {
    if(!confirm('¿Eliminar este servicio?')) return;
    try { await deleteDoc(doc(db,'servicios',sid)); await cargarDatos(); toast('🗑️ Eliminado'); } catch(err) { toast('❌ Error: '+err.message); }
}

function generarInformePDF(eid) {
    const e=getEq(eid); const ent=getEntidad(e.clienteId); const ss=getServiciosEquipo(eid).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    const serviciosHTML=ss.map(s=>{ const fotosHTML=(s.fotos||[]).length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">${(s.fotos||[]).map(f=>`<img src="${f}" style="height:80px;width:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">`).join('')}</div>`:''; const proxHTML=(s.tipo==='Mantenimiento' && s.proximoMantenimiento)?`<div style="color:#b45309;font-size:16px;margin-top:4px;">&#128197; Proximo mantenimiento: ${fmtFecha(s.proximoMantenimiento)}</div>`:''; const estadoHTML=s.estadoReparacion?`<div style="font-size:12px;font-weight:bold;color:#d10000;margin-top:2px;">Estado: ${s.estadoReparacion}</div>`:''; return `<div style="border:1px solid #d1d5db;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span style="background:${s.tipo==='Mantenimiento'?'#1d4ed8':s.tipo==='Reparacion'?'#dc2626':'#d10000'};color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">${s.tipo}</span><span style="font-size:16px;color:#555;">${fmtFecha(s.fecha)}</span></div><div style="font-size:16px;color:#374151;margin:3px 0;">&#128295; ${s.tecnico}</div><div style="font-size:16px;color:#111;margin:3px 0;">${s.descripcion}</div>${estadoHTML}${fotosHTML}${proxHTML}</div>`; }).join('');
    const coordinador=ent?.coordinador||'No asignado'; const telefonoCoord=ent?.telefono||'Sin teléfono';
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe_${e?.marca}_${e?.modelo}</title><style>@page{size:letter;margin:15mm;}body{font-family:Arial,sans-serif;font-size:11px;color:#111;}.header{text-align:center;margin-bottom:15px;}.coordinador{font-size:14px;font-weight:bold;color:#d10000;}.titulo{font-size:18px;font-weight:bold;margin-top:5px;}</style></head><body><div class="header"><div class="coordinador">Coordinador: ${coordinador} | Tel: ${telefonoCoord}</div><div class="titulo">INFORME TECNICO</div></div><table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><tr><td style="padding:6px;background:#f1f5f9;border:1px solid #ddd;"><strong>Cliente:</strong> ${ent?.nombre||'N/A'}</td><td style="padding:6px;background:#f1f5f9;border:1px solid #ddd;"><strong>Generado:</strong> ${new Date().toLocaleString()}</td></tr><tr><td colspan="2" style="padding:6px;border:1px solid #ddd;"><strong>Activo:</strong> ${e?.marca||''} ${e?.tipo||''} ${e?.modelo||''} &nbsp;&nbsp; <strong>Serial:</strong> ${e?.serie||'N/A'}</td></tr></table><div style="background:#d10000;color:white;font-weight:bold;padding:6px;margin-bottom:10px;">HISTORIAL DE SERVICIOS (${ss.length})</div>${serviciosHTML}</body></html>`;
    const v=window.open('','_blank'); if(v){ v.document.open(); v.document.write(html); v.document.close(); setTimeout(()=>v.print(),500); }
}

function modalQR(eid) {
    const e=getEq(eid); const ent=getEntidad(e.clienteId); const url=`${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    const qrDiv=document.createElement('div'); qrDiv.style.cssText='position:fixed;top:-9999px;left:-9999px;width:300px;height:300px;'; document.body.appendChild(qrDiv);
    const QRLib=window.QRCode; if(!QRLib){ toast('⚠️ QRCode.js no cargado'); return; }
    new QRLib(qrDiv,{ text:url, width:300, height:300, colorDark:'#d10000', colorLight:'#ffffff' });
    setTimeout(()=>{
        const qrCanvas=qrDiv.querySelector('canvas');
        const qrDataUrl=qrCanvas.toDataURL('image/png');
        document.body.removeChild(qrDiv);
        // Canvas final: header rojo con logo+nombre, QR centrado, footer
        const W=420, PAD=16;
        const HDR=72; // altura header
        const QRS=300;
        const FOOT=28;
        const totalH=HDR+QRS+PAD+FOOT+PAD;
        const compCanvas=document.createElement('canvas');
        compCanvas.width=W; compCanvas.height=totalH;
        const ctx=compCanvas.getContext('2d');
        // Fondo blanco
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,totalH);
        // Borde rojo
        ctx.strokeStyle='#d10000'; ctx.lineWidth=3; ctx.strokeRect(2,2,W-4,totalH-4);
        // Header rojo
        ctx.fillStyle='#d10000'; ctx.fillRect(2,2,W-4,HDR);
        const eqLabel=`${e?.marca||''} ${e?.tipo||''} ${e?.modelo||''}`.trim();
        const entLabel=ent?.nombre||'';
        const logoImg=new Image(); const qrImg=new Image();
        logoImg.crossOrigin='anonymous';
        logoImg.src='https://raw.githubusercontent.com/capacitADA/D-one/main/D1_logo.png';
        logoImg.onload=()=>{
            // Logo pequeño izquierda del header
            const lH=42; const lW=logoImg.width*(lH/logoImg.height);
            ctx.drawImage(logoImg, PAD, (HDR-lH)/2, lW, lH);
            // Texto derecha del logo
            ctx.fillStyle='#ffffff'; ctx.textAlign='left';
            ctx.font='bold 13px Arial';
            ctx.fillText(eqLabel, PAD+lW+10, HDR/2-4);
            ctx.font='11px Arial';
            ctx.fillStyle='rgba(255,255,255,0.85)';
            ctx.fillText('🏭 '+entLabel, PAD+lW+10, HDR/2+13);
            // QR centrado
            qrImg.onload=()=>{
                ctx.drawImage(qrImg,(W-QRS)/2, HDR, QRS, QRS);
                // Footer
                ctx.fillStyle='#888'; ctx.font='10px Arial'; ctx.textAlign='center';
                ctx.fillText('Escanea para ver historial y contactar soporte', W/2, HDR+QRS+PAD+14);
                const compositeUrl=compCanvas.toDataURL('image/png');
                showModal(`<div class="modal" style="max-width:360px;"><div class="modal-h"><h3>📱 Codigo QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b" style="text-align:center;"><img src="${compositeUrl}" style="width:100%;border-radius:8px;border:2px solid #d10000;"><a href="${compositeUrl}" download="QR_${e?.marca}_${e?.modelo}.png" class="btn btn-blue btn-full" style="margin-top:8px;">⬇️ Descargar QR</a></div></div>`);
            };
            qrImg.src=qrDataUrl;
        };
        logoImg.onerror=()=>{
            // Sin logo: solo texto en header
            ctx.fillStyle='#ffffff'; ctx.textAlign='center'; ctx.font='bold 14px Arial';
            ctx.fillText(eqLabel, W/2, HDR/2-4);
            ctx.font='11px Arial'; ctx.fillStyle='rgba(255,255,255,0.85)';
            ctx.fillText(entLabel, W/2, HDR/2+13);
            qrImg.onload=()=>{
                ctx.drawImage(qrImg,(W-QRS)/2, HDR, QRS, QRS);
                ctx.fillStyle='#888'; ctx.font='10px Arial'; ctx.textAlign='center';
                ctx.fillText('Escanea para ver historial y contactar soporte', W/2, HDR+QRS+PAD+14);
                const compositeUrl=compCanvas.toDataURL('image/png');
                showModal(`<div class="modal" style="max-width:360px;"><div class="modal-h"><h3>📱 Codigo QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b" style="text-align:center;"><img src="${compositeUrl}" style="width:100%;border-radius:8px;border:2px solid #d10000;"><a href="${compositeUrl}" download="QR_${e?.marca}_${e?.modelo}.png" class="btn btn-blue btn-full" style="margin-top:8px;">⬇️ Descargar QR</a></div></div>`);
            };
            qrImg.src=qrDataUrl;
        };
    },200);
}

function manejarRutaQR() { const hash=window.location.hash; if(!hash.startsWith('#/equipo/')) return false; const eid=hash.replace('#/equipo/',''); const e=getEq(eid); if(!e) return false; const ent=getEntidad(e.clienteId); const ss=getServiciosEquipo(eid).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)); const main=document.getElementById('mainContent'); const topbar=document.querySelector('.topbar'); const botnav=document.querySelector('.botnav'); if(topbar) topbar.style.display='none'; if(botnav) botnav.style.display='none'; main.style.background='white'; const coordinador=ent?.coordinador||'Coordinador'; const telefono=ent?.telefono||'3239454477'; const waMsg=encodeURIComponent(`Hola ${coordinador}, necesito ayuda con el equipo ${e?.marca||''} ${e?.tipo||''} ${e?.modelo||''} de la ubicación ${e?.ubicacion||'sin ubicación'}, podrías devolverme el mensaje`); const waUrl=`https://wa.me/57${telefono.replace(/\D/g,'')}?text=${waMsg}`; main.innerHTML=`<div style="max-width:600px;margin:0 auto;padding:1.5rem;"><div style="text-align:center;margin-bottom:0.75rem;"><img src="https://raw.githubusercontent.com/capacitADA/D-one/main/D1_logo.png" style="height:56px;" onerror="this.style.display='none'"></div><div style="border:1px solid #ccc;border-radius:12px;padding:1rem;margin-bottom:0.75rem;"><h3 style="margin:0 0 6px;">${e.marca} ${e.tipo||''} ${e.modelo}</h3><p style="margin:2px 0;">📍 ${e.ubicacion||'Sin ubicación'}</p><p style="margin:2px 0;">👤 ${ent?.nombre||'Sin entidad'}</p><p style="margin:2px 0;font-size:0.8rem;color:#888;">Serie: ${e.serie||'N/A'}</p></div><a id="waBtn" href="${waUrl}" target="_blank" style="display:block;width:100%;box-sizing:border-box;background:#25D366;color:white;border:none;padding:14px;border-radius:12px;text-align:center;font-size:1rem;font-weight:700;text-decoration:none;margin-bottom:1rem;">📱 Contactar por WhatsApp</a><h3>Historial (${ss.length})</h3>${ss.map(s=>`<div style="border:1px solid #d1ede0;border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;"><div style="display:flex;justify-content:space-between;"><strong>${s.tipo}</strong><span style="font-size:0.8rem;color:#555;">${fmtFecha(s.fecha)}</span></div><div style="font-size:0.85rem;">🔧 ${s.tecnico}</div><div style="font-size:0.85rem;margin-top:2px;">${s.descripcion}</div>${s.estadoReparacion?`<div style="font-size:0.82rem;color:#d10000;font-weight:700;margin-top:2px;">Estado: ${s.estadoReparacion}</div>`:''} ${s.proximoMantenimiento?`<div style="font-size:0.82rem;color:#b45309;margin-top:4px;">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>`:''}</div>`).join('')}</div>`; return true; }

function renderServicios() { const años=[...new Set(servicios.map(s=>s.fecha?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a); const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']; return `<div class="page"><div class="sec-head"><h2>Servicios</h2></div><div class="filtros"><select class="fi" id="fAnio"><option value="">Todos los años</option>${años.map(a=>`<option>${a}</option>`).join('')}</select><select class="fi" id="fMes"><option value="">Todos los meses</option>${meses.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('')}</select><select class="fi" id="fTipo"><option value="">Todos los tipos</option><option>Mantenimiento</option><option>Reparacion</option><option>Instalacion</option></select><select class="fi" id="fCliente"><option value="">Todos los CEDIs/Tiendas</option>${[...clientes.map(c=>`<option value="cliente|${c.id}">CEDI: ${c.nombre}</option>`), ...tiendas.map(t=>`<option value="tienda|${t.id}">TIENDA: ${t.nombre}</option>`)]}</select><select class="fi" id="fTecnico"><option value="">Todos los tecnicos</option>${tecnicos.map(t=>`<option>${t.nombre}</option>`).join('')}</select><button class="btn btn-blue btn-full" onclick="aplicarFiltros()">Aplicar</button><button class="btn btn-gray btn-full" onclick="limpiarFiltros()">Limpiar</button></div><div id="listaServicios"></div></div>`; }
function aplicarFiltros() { const anio=document.getElementById('fAnio')?.value||''; const mes=document.getElementById('fMes')?.value||''; const tipo=document.getElementById('fTipo')?.value||''; const filtroEntidad=document.getElementById('fCliente')?.value||''; const tec=document.getElementById('fTecnico')?.value||''; let filtrados=[...servicios].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)); if(anio) filtrados=filtrados.filter(s=>s.fecha?.startsWith(anio)); if(mes) filtrados=filtrados.filter(s=>s.fecha?.slice(5,7)===mes); if(tipo) filtrados=filtrados.filter(s=>s.tipo===tipo); if(filtroEntidad){ const [tipoEnt,id]=filtroEntidad.split('|'); if(tipoEnt==='cliente') filtrados=filtrados.filter(s=>getEquiposCliente(id).some(e=>e.id===s.equipoId)); else filtrados=filtrados.filter(s=>getEquiposTienda(id).some(e=>e.id===s.equipoId)); } if(tec) filtrados=filtrados.filter(s=>s.tecnico===tec); const el=document.getElementById('listaServicios'); if(!el) return; if(!filtrados.length){ el.innerHTML='<p class="cc-meta" style="text-align:center;">Sin resultados.</p>'; return; } el.innerHTML=filtrados.map(s=>{ const e=getEq(s.equipoId); const ent=getEntidad(e?.clienteId); return `<div class="si"><div class="si-top"><span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparacion'?'b-red':'b-green'}">${s.tipo}</span><span>${fmtFecha(s.fecha)}</span></div><div class="si-info">👤 ${ent?.nombre||'N/A'} · ${e?.marca||''} ${e?.tipo||''} ${e?.modelo||''}</div><div class="si-info">📍 ${e?.ubicacion||''} · 🔧 ${s.tecnico}</div>${s.estadoReparacion?`<div class="si-info"><strong>Estado:</strong> ${s.estadoReparacion}</div>`:''}<div class="si-info">${s.descripcion}</div>${s.proximoMantenimiento?`<div class="si-info" style="color:var(--gold);">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>`:''}</div>`; }).join(''); }
function limpiarFiltros() { ['fAnio','fMes','fTipo','fCliente','fTecnico'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); aplicarFiltros(); }
function renderMantenimientos() { const MESES=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']; const año=new Date().getFullYear(); const mant=servicios.filter(s=>s.proximoMantenimiento); return `<div class="page"><div class="sec-head"><h2>Agenda ${año}</h2></div><div class="tbl-wrap"><table><thead><tr><th>Mes</th><th>Fecha</th><th>Cliente</th><th>Activo</th><th></th></tr></thead><tbody>${MESES.map((mes,idx)=>{ const mp=String(idx+1).padStart(2,'0'); const lista=mant.filter(m=>m.proximoMantenimiento?.startsWith(`${año}-${mp}`)); if(!lista.length) return `<tr><td style="color:var(--hint);">${mes}</td><td colspan="4" style="color:#cbd5e1;">—</td></tr>`; return lista.map((m,i)=>{ const e=getEq(m.equipoId); const ent=getEntidad(e?.clienteId); return `<tr>${i===0?`<td rowspan="${lista.length}" style="font-weight:700;background:var(--bg2);">${mes}</td>`:''}<td>${fmtFecha(m.proximoMantenimiento)}</td><td>${ent?.nombre||'N/A'}</td><td>${e?`${e.marca} ${e.tipo||''} ${e.modelo}`:'N/A'}</td><td><button class="rec-btn" onclick="modalRecordar('${e?.clienteId}','${e?.id}','${m.proximoMantenimiento}')">📱</button></td></tr>`; }).join(''); }).join('')}</tbody></table></div></div>`; }
function obtenerGPS(latId,lngId) { if(!navigator.geolocation){ toast('⚠️ GPS no disponible'); return; } navigator.geolocation.getCurrentPosition(pos=>{ document.getElementById(latId).value=pos.coords.latitude.toFixed(6); document.getElementById(lngId).value=pos.coords.longitude.toFixed(6); toast('✅ Ubicacion capturada'); },()=>toast('⚠️ No se pudo obtener GPS')); }
function modalRecordar(clienteId,equipoId,fecha) { const e=getEq(equipoId); const ent=getEntidad(clienteId); const fechaF=fmtFechaLarga(fecha); let tel,destinatario,msg; if(ent){ tel=ent.telefono; destinatario=`${ent.coordinador} · SAP ${ent.sap}`; msg=`Hola *${ent.coordinador}*, recordatorio: activo *${e?.marca} ${e?.tipo||''} ${e?.modelo}* (${ent.tipoEntidad==='cliente'?'CEDI':'Tienda'} ${ent.nombre}) requiere mantenimiento el *${fechaF}*. Confirmar visita. Coordinador Mtto 📞 3239454477`; } else { tel='3239454477'; destinatario='Coordinador'; msg=`Recordatorio: activo *${e?.marca} ${e?.modelo}* requiere mantenimiento el *${fechaF}*.`; } showModal(`<div class="modal"><div class="modal-h"><h3>📱 Recordatorio WhatsApp</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div class="ec-meta">Para <strong>${destinatario}</strong> · 📞 ${tel}</div><div class="wa-bubble">${msg}</div><textarea class="fi" id="waMsgEdit" rows="4">${msg}</textarea><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-wa" onclick="enviarWhatsApp('${tel}')">📱 Abrir WhatsApp</button></div></div></div>`); }
function enviarWhatsApp(tel) { const msg=document.getElementById('waMsgEdit')?.value||''; const telLimpio='57'+tel.replace(/\D/g,''); window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`,'_blank'); closeModal(); toast('📱 WhatsApp abierto'); }

function renderTecnicos() {
    return `<div class="page"><div class="sec-head"><h2>Tecnicos (${tecnicos.length})</h2>${esAdmin()?`<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>`:''}</div>
        ${tecnicos.map(t=>{ const esps=(t.especialidades||[]).map(id=>ESPECIALIDADES.find(e=>e.id===id)?.label||id); return `<div class="ec"><div style="display:flex;justify-content:space-between;"><div><div class="ec-name">${t.nombre}</div>${sesionActual?`<div class="ec-meta">${t.tipoDoc} ${t.cedula}</div>`:''}<div class="ec-meta">${t.cargo}</div><div class="ec-meta">📞 ${t.telefono}</div></div><div><span class="tc-rol-badge ${t.rol==='admin'?'rol-admin':'rol-tec'}">${t.rol==='admin'?'Admin':'Tecnico'}</span>${esAdmin()?`<div><button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button><button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button></div>`:''}</div></div>${sesionActual?`<div>${esps.map(e=>`<span class="esp-chip">${e}</span>`).join('')}</div>`:''}<div class="ec-meta">📍 ${t.region||'Sin region'}</div><button class="btn btn-blue btn-sm btn-full" onclick="abrirLogin('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button></div>`; }).join('')}
        ${esAdmin()?`<div style="margin-top:1.2rem;background:white;border-radius:12px;padding:0.85rem;"><div style="font-weight:700;">🏪 Subida Masiva de CEDIs y Tiendas</div><div class="ec-meta">Sube un CSV con columnas: SAP, TIENDA, CIUDAD, DEPARTAMENTO, DIRECCION, COORDINADOR, CARGO, TELEFONO</div><label class="btn btn-blue btn-sm" style="display:inline-block;margin:4px;">📥 Subir CSV<input type="file" accept=".csv" style="display:none;" onchange="subirCSVJMC(this)"></label><button class="btn btn-gray btn-sm" onclick="descargarPlantillaCSV()">📄 Plantilla</button></div>`:''}
    </div>`;
}

// FIX: abrirLogin ahora limpia mlPinActual correctamente antes de abrir el modal
function abrirLogin(tid) {
    mlPinActual = '';
    const t=getTec(tid);
    showModal(`<div class="modal" style="max-width:320px;"><div class="modal-h"><h3>🔑 Ingresar</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div style="font-weight:700;">${t.nombre}</div><div class="ec-meta">${t.tipoDoc}</div><label class="fl">Cedula</label><input class="fi" id="mlCedula" type="number"><label class="fl">Clave (4 digitos)</label><div class="pin-display"><div class="pin-digit" id="mlpd0"></div><div class="pin-digit" id="mlpd1"></div><div class="pin-digit" id="mlpd2"></div><div class="pin-digit" id="mlpd3"></div></div><div class="numpad">${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="num-btn" onclick="mlPin('${tid}',${n})">${n}</div>`).join('')}<div class="num-btn del" onclick="mlDel()">⌫</div><div class="num-btn zero" onclick="mlPin('${tid}',0)">0</div><div class="num-btn ok" onclick="mlLogin('${tid}')">✓</div></div><div id="mlMsg"></div><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="mlLogin('${tid}')">Ingresar</button></div></div></div>`);
    // Inicializar display limpio tras render
    setTimeout(() => mlUpdateDisplay(), 50);
}

let mlPinActual='';
function mlPin(tid,n){ if(mlPinActual.length>=4) return; mlPinActual+=String(n); mlUpdateDisplay(); if(mlPinActual.length===4) mlLogin(tid); }
function mlDel(){ mlPinActual=mlPinActual.slice(0,-1); mlUpdateDisplay(); }
function mlUpdateDisplay(){ for(let i=0;i<4;i++){ const d=document.getElementById('mlpd'+i); if(!d) return; d.className='pin-digit'; if(i<mlPinActual.length){ d.textContent='●'; d.classList.add('filled'); } else if(i===mlPinActual.length){ d.textContent='_'; d.classList.add('active'); } else { d.textContent=''; } } }
function mlLogin(tid){
    const t=getTec(tid);
    const cedula=document.getElementById('mlCedula')?.value?.trim();
    const msg=document.getElementById('mlMsg');
    if(!cedula){ if(msg) msg.innerHTML='<div class="login-warn">⚠️ Cedula requerida</div>'; return; }
    if(mlPinActual.length<4){ if(msg) msg.innerHTML='<div class="login-warn">⚠️ Clave de 4 digitos</div>'; return; }
    if(String(t.cedula)!==String(cedula) || t.clave!==mlPinActual){ if(msg) msg.innerHTML='<div class="login-error">❌ Credenciales incorrectas</div>'; mlPinActual=''; mlUpdateDisplay(); return; }
    sesionActual=t; mlPinActual=''; closeModal(); actualizarTopbar(); currentView='panel'; renderView(); toast(`✅ Bienvenido, ${t.nombre.split(' ')[0]}`);
}

function modalNuevoTecnico() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><label class="fl">Nombre *</label><input class="fi" id="tNombre"><div class="fr"><div><label class="fl">Tipo Doc</label><select class="fi" id="tTipoDoc">${TIPOS_DOC.map(d=>`<option>${d}</option>`).join('')}</select></div><div><label class="fl">Cedula *</label><input class="fi" id="tCedula" type="number"></div></div><label class="fl">Telefono</label><input class="fi" id="tTel"><label class="fl">Cargo</label><input class="fi" id="tCargo"><label class="fl">Rol</label><select class="fi" id="tRol"><option value="tecnico">Tecnico</option><option value="admin">Admin</option></select><label class="fl">Clave (4 digitos) *</label><input class="fi" id="tClave" type="password" maxlength="4"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button></div></div></div>`);
}

async function guardarTecnico() {
    const n=document.getElementById('tNombre')?.value?.trim(); const cc=document.getElementById('tCedula')?.value?.trim(); const cl=document.getElementById('tClave')?.value?.trim();
    if(!n||!cc||!cl){ toast('⚠️ Nombre, cedula y clave requeridos'); return; }
    if(cl.length!==4){ toast('⚠️ Clave de 4 digitos'); return; }
    try {
        await addDoc(collection(db,'tecnicos'),{ nombre:n, cedula:cc, tipoDoc:document.getElementById('tTipoDoc')?.value||'CC', telefono:document.getElementById('tTel')?.value||'', cargo:document.getElementById('tCargo')?.value||'', rol:document.getElementById('tRol')?.value||'tecnico', especialidades:[], region:'', clave:cl });
        closeModal(); await cargarDatos(); toast('✅ Tecnico guardado');
    } catch(err){ toast('❌ Error: '+err.message); }
}

function modalEditarTecnico(tid) { const t=getTec(tid); showModal(`<div class="modal"><div class="modal-h"><h3>Editar tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><label class="fl">Nombre</label><input class="fi" id="etNombreTec" value="${t.nombre}"><label class="fl">Cedula</label><input class="fi" id="etCedulaTec" value="${t.cedula}"><label class="fl">Telefono</label><input class="fi" id="etTelTec" value="${t.telefono}"><label class="fl">Cargo</label><input class="fi" id="etCargoTec" value="${t.cargo||''}"><label class="fl">Rol</label><select class="fi" id="etRolTec"><option value="tecnico" ${t.rol==='tecnico'?'selected':''}>Tecnico</option><option value="admin" ${t.rol==='admin'?'selected':''}>Admin</option></select><label class="fl">Nueva clave (opcional)</label><input class="fi" id="etClaveTec" type="password" maxlength="4"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarTecnico('${tid}')">Guardar</button></div></div></div>`); }

// FIX: IDs renombrados en modalEditarTecnico para evitar colisión con modalEditarCliente/Tienda (etNombre, etTel, etCargo, etRol eran compartidos)
async function actualizarTecnico(tid) {
    const data={
        nombre: document.getElementById('etNombreTec').value,
        cedula: document.getElementById('etCedulaTec').value,
        telefono: document.getElementById('etTelTec').value,
        cargo: document.getElementById('etCargoTec').value,
        rol: document.getElementById('etRolTec').value
    };
    const newClave=document.getElementById('etClaveTec')?.value?.trim();
    if(newClave && newClave.length===4) data.clave=newClave;
    try { await updateDoc(doc(db,'tecnicos',tid),data); closeModal(); await cargarDatos(); toast('✅ Tecnico actualizado'); } catch(err){ toast('❌ Error: '+err.message); }
}

async function eliminarTecnico(tid) { if(!confirm('¿Eliminar este tecnico?')) return; try{ await deleteDoc(doc(db,'tecnicos',tid)); await cargarDatos(); toast('🗑️ Tecnico eliminado'); } catch(err){ toast('❌ Error: '+err.message); } }

// FIX: subirCSVJMC ahora parsea CSV correctamente respetando campos con comas entre comillas
async function subirCSVJMC(input) {
    const file=input.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async ev=>{
        const lines=ev.target.result.split('\n').filter(l=>l.trim());
        if(lines.length<2){ toast('⚠️ CSV vacío'); return; }
        // Parser CSV que respeta comillas
        function parseCSVLine(line) {
            const result=[]; let cur=''; let inQ=false;
            for(let i=0;i<line.length;i++){
                const ch=line[i];
                if(ch==='"'){ inQ=!inQ; }
                else if(ch===',' && !inQ){ result.push(cur.trim()); cur=''; }
                else { cur+=ch; }
            }
            result.push(cur.trim());
            return result;
        }
        const encabezados=parseCSVLine(lines[0]).map(h=>h.replace(/^"|"$/g,'').trim().toUpperCase());
        const idx=(col)=>encabezados.indexOf(col);
        const iSap=idx('SAP'),iTienda=idx('TIENDA'),iCiudad=idx('CIUDAD'),iDepto=idx('DEPARTAMENTO'),iDir=idx('DIRECCION'),iCoord=idx('COORDINADOR'),iCargo=idx('CARGO'),iTel=idx('TELEFONO');
        if(iSap===-1||iTienda===-1){ toast('⚠️ El CSV debe tener columnas SAP y TIENDA'); return; }
        const cedis=[]; const tiendasCSV=[];
        for(let i=1;i<lines.length;i++){
            const cols=parseCSVLine(lines[i]).map(c=>c.replace(/^"|"$/g,''));
            const sap=cols[iSap]?.trim(); const nombre=cols[iTienda]?.trim();
            if(!sap||!nombre) continue;
            const item={
                sap, nombre,
                ciudad: iCiudad!==-1?(cols[iCiudad]||''):'',
                departamento: iDepto!==-1?(cols[iDepto]||''):'',
                direccion: iDir!==-1?(cols[iDir]||''):'',
                coordinador: iCoord!==-1?(cols[iCoord]||''):'',
                cargo: iCargo!==-1?(cols[iCargo]||''):'',
                telefono: iTel!==-1?(cols[iTel]||''):'',
                latitud:'', longitud:''
            };
            if(nombre.toUpperCase().includes('CEDI')) cedis.push(item); else tiendasCSV.push(item);
        }
        const guardarBatch=async(items,coleccion)=>{
            const batch=writeBatch(db); const colRef=collection(db,coleccion);
            for(const item of items){ batch.set(doc(colRef),item); }
            await batch.commit();
        };
        try {
            if(cedis.length) await guardarBatch(cedis,'clientes');
            if(tiendasCSV.length) await guardarBatch(tiendasCSV,'tiendas');
            input.value=''; await cargarDatos(); toast(`✅ ${cedis.length} CEDIs y ${tiendasCSV.length} Tiendas guardadas`);
        } catch(err){ toast('❌ Error CSV: '+err.message); }
    };
    reader.readAsText(file,'UTF-8');
}

function descargarPlantillaCSV() { const enc='SAP,TIENDA,CIUDAD,DEPARTAMENTO,DIRECCION,COORDINADOR,CARGO,TELEFONO'; const ejemplo='170,Chia - Centro - Calle 13,Chia,Cundinamarca,Calle 13 # 9-43,Edgar Amado,Coordinador Sr Mantenimiento,3107935104'; const csv=[enc,ejemplo].join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='plantilla_cedis_tiendas.csv'; a.click(); URL.revokeObjectURL(url); toast('📄 Plantilla descargada'); }
function puedeEditar(creadoPor) { return esAdmin() || sesionActual?.nombre === creadoPor; }

window.exportarHistorialEntidad=exportarHistorialEntidad; window.exportarHistorialExcel=exportarHistorialExcel; window.goTo=goTo; window.closeModal=closeModal; window.filtrarClientes=filtrarClientes; window.filtrarTiendas=filtrarTiendas; window.aplicarFiltros=aplicarFiltros; window.limpiarFiltros=limpiarFiltros; window.modalNuevoCliente=modalNuevoCliente; window.modalEditarCliente=modalEditarCliente; window.modalEliminarCliente=modalEliminarCliente; window.actualizarCliente=actualizarCliente; window.modalNuevaTienda=modalNuevaTienda; window.modalEditarTienda=modalEditarTienda; window.modalEliminarTienda=modalEliminarTienda; window.actualizarTienda=actualizarTienda; window.modalNuevoEquipo=modalNuevoEquipo; window.modalEditarEquipo=modalEditarEquipo; window.modalEliminarEquipo=modalEliminarEquipo; window.guardarEquipo=guardarEquipo; window.modalNuevoServicio=modalNuevoServicio; window.modalEditarServicio=modalEditarServicio; window.eliminarServicio=eliminarServicio; window.modalNuevoTecnico=modalNuevoTecnico; window.modalEditarTecnico=modalEditarTecnico; window.modalRecordar=modalRecordar; window.enviarWhatsApp=enviarWhatsApp; window.generarInformePDF=generarInformePDF; window.modalQR=modalQR; window.obtenerGPS=obtenerGPS; window.previewFoto=previewFoto; window.borrarFoto=borrarFoto; window.onTipoChange=onTipoChange; window.onEditTipoChange=onEditTipoChange; window.abrirLogin=abrirLogin; window.mlPin=mlPin; window.mlDel=mlDel; window.mlLogin=mlLogin; window.cerrarSesion=cerrarSesion; window.subirCSVJMC=subirCSVJMC; window.descargarPlantillaCSV=descargarPlantillaCSV; window.guardarCliente=guardarCliente; window.guardarTienda=guardarTienda; window.guardarTecnico=guardarTecnico; window.actualizarTecnico=actualizarTecnico; window.eliminarTecnico=eliminarTecnico; window.actualizarServicio=actualizarServicio; window.guardarServicio=guardarServicio; window.actualizarEquipo=actualizarEquipo; window.modalEliminarEquipo=modalEliminarEquipo; window.eliminarEquipo=eliminarEquipo; window.modalEliminarCliente=modalEliminarCliente; window.modalEliminarTienda=modalEliminarTienda;

document.querySelectorAll('.bni').forEach(btn=>{ btn.addEventListener('click',()=>{ const page=btn.dataset.page; if(!sesionActual && page!=='panel' && page!=='tecnicos'){ toast('🔒 Inicia sesion desde Tecnicos'); return; } goTo(page); }); });

(async()=>{ await conectarDriveAuto(); await cargarDatos(); if(!manejarRutaQR()) renderView(); })();
