// ============================================
// D1 GESTIÓN - App Firebase vFINAL
// SIN DATOS DE PRUEBA - LECTURA ESCRIBIR FIRESTORE
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDw1faNff7uMXR6JbHOhZa7eA5WiiNAJNw",
    authDomain: "donecapacitada-4fa37.firebaseapp.com",
    projectId: "donecapacitada-4fa37",
    storageBucket: "donecapacitada-4fa37.firebasestorage.app",
    messagingSenderId: "449540711283",
    appId: "1:449540711283:web:01efe4696daafc4e215b06"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
window.db = db;

// ===== GLOBALES =====
let cedis = [], tiendas = [], equipos = [], servicios = [], tecnicos = [];
let sesionActual = null;
let currentView = 'panel';
let selectedEntidadId = null, selectedEntidadTipo = null, selectedEquipoId = null;
let fotosNuevas = [null, null, null];

const REGIONES = ['Región 1','Región 2','Región 3','Región 4','Región 5','Región 6','Región 7','Región 8','Región 9','Región 10'];
const CIUDADES = ['Bogotá','Medellín','Cali','Bucaramanga','Barranquilla','Cúcuta','Manizales','Pereira','Ibagué','Villavicencio','Girón','Floridablanca','Piedecuesta','Pamplona','Soacha','Tunja','Pasto','Ipiales'];
const TIPOS_DOC = ['CC','CE','PA','NIT','TI'];
const ESPECIALIDADES = [
    {id:'mecanico',label:'Mecánico de plantas'},
    {id:'baja',label:'Electricista baja tensión'},
    {id:'media',label:'Electricista media tensión'},
    {id:'electronico',label:'Electrónico'},
    {id:'ups',label:'UPS'},
    {id:'planta',label:'Plantas eléctricas'}
];

// ===== HELPERS =====
function toast(msg, dur=3000) {
    const t = document.getElementById('toastEl');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), dur);
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
    fotosNuevas = [null,null,null];
}
function actualizarTopbar() {
    const right = document.getElementById('topbarRight');
    if (!right) return;
    if (!sesionActual) {
        right.innerHTML = `<span>Sin sesión</span>`;
    } else {
        const inicial = sesionActual.nombre[0].toUpperCase();
        right.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><div style="background:gold;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;">${inicial}</div><span>${sesionActual.nombre}</span><button class="topbar-salir" onclick="cerrarSesion()">Salir</button></div>`;
    }
}
function cerrarSesion() { sesionActual = null; actualizarTopbar(); renderView(); toast('Sesión cerrada'); }
function esAdmin() { return sesionActual?.rol === 'admin'; }
function getCedi(id) { return cedis.find(c=>c.id===id); }
function getTienda(id) { return tiendas.find(t=>t.id===id); }
function getEq(id) { return equipos.find(e=>e.id===id); }
function getTec(id) { return tecnicos.find(t=>t.id===id); }
function getEquiposEntidad(id,tipo) { return equipos.filter(e=>e.entidadId===id && e.entidadTipo===tipo); }
function getServiciosEquipo(eid) { return servicios.filter(s=>s.equipoId===eid); }
function fmtFecha(f) { if(!f)return ''; return new Date(f+'T12:00:00').toLocaleDateString('es-ES'); }
function fmtFechaLarga(f) { if(!f)return ''; return new Date(f+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}); }
function getMesActual() { return new Date().toISOString().slice(0,7); }

// ===== CARGAR DATOS DESDE FIRESTORE =====
async function cargarDatos() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando datos...</p></div>';
    try {
        const [c,t,e,s,tec] = await Promise.all([
            getDocs(query(collection(db,'cedis'), orderBy('nombre'))),
            getDocs(query(collection(db,'tiendas'), orderBy('nombre'))),
            getDocs(collection(db,'equipos')),
            getDocs(query(collection(db,'servicios'), orderBy('fecha','desc'))),
            getDocs(collection(db,'tecnicos'))
        ]);
        cedis = c.docs.map(d=>({id:d.id,...d.data()}));
        tiendas = t.docs.map(d=>({id:d.id,...d.data()}));
        equipos = e.docs.map(d=>({id:d.id,...d.data()}));
        servicios = s.docs.map(d=>({id:d.id,...d.data()}));
        tecnicos = tec.docs.map(d=>({id:d.id,...d.data()}));
        console.log(`CEDIS:${cedis.length} TIENDAS:${tiendas.length} EQUIPOS:${equipos.length}`);
    } catch(err) {
        console.error(err);
        toast('Error de conexión a Firebase');
        main.innerHTML = '<div class="page" style="text-align:center;padding:2rem;"><p>Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

// ===== SEMBRAR TÉCNICOS (SOLO SI NO HAY NINGUNO) =====
async function sembrarTecnicos() {
    const snap = await getDocs(collection(db,'tecnicos'));
    if(!snap.empty) return;
    toast('Configurando técnicos de ejemplo...');
    await addDoc(collection(db,'tecnicos'), {
        nombre:'Carlos Monsalve', cedula:'0000001', tipoDoc:'CC', telefono:'3110000000',
        cargo:'Administrador', rol:'admin', especialidades:['mecanico','baja','media','electronico','ups','planta'],
        region:'Colombia', clave:'1234'
    });
    await addDoc(collection(db,'tecnicos'), {
        nombre:'Juan Perez', cedula:'10234568', tipoDoc:'CC', telefono:'3120000002',
        cargo:'Tecnico de Campo', rol:'tecnico', especialidades:['baja','media'],
        region:'Cundinamarca', clave:'5678'
    });
    toast('Técnicos creados. Admin: 0000001 / 1234');
}

// ===== RENDER VISTAS =====
function renderView() {
    if(!sesionActual && currentView!=='panel' && currentView!=='tecnicos') currentView='panel';
    const main = document.getElementById('mainContent');
    if(currentView==='panel') main.innerHTML = renderPanel();
    else if(currentView==='cedis') main.innerHTML = renderCedis();
    else if(currentView==='tiendas') main.innerHTML = renderTiendas();
    else if(currentView==='detalle') main.innerHTML = renderDetalleEntidad();
    else if(currentView==='historial') main.innerHTML = renderHistorialEquipo();
    else if(currentView==='servicios') main.innerHTML = renderServicios();
    else if(currentView==='mantenimientos') main.innerHTML = renderMantenimientos();
    else if(currentView==='tecnicos') main.innerHTML = renderTecnicos();
    else main.innerHTML = renderPanel();
    // Re-aplicar eventos de búsqueda si existen
    if(currentView==='cedis' || currentView==='tiendas') {
        setTimeout(() => {
            const input = document.getElementById(currentView==='cedis'?'searchCedis':'searchTiendas');
            if(input) input.oninput = (e) => filtrarEntidades(e.target.value, currentView.slice(0,-1));
        }, 50);
    }
}

function renderPanel() {
    const servMes = servicios.filter(s=>s.fecha?.startsWith(getMesActual())).length;
    return `<div class="page"><div class="panel-banner" style="background:#0d4a3a;color:white;padding:20px;text-align:center;"><div class="panel-banner-title">D1 Colombia</div></div>
    <div class="panel-grid">
        <div class="panel-box"><div class="panel-box-num">${cedis.length}</div><div class="panel-box-lbl">CEDIS</div></div>
        <div class="panel-box"><div class="panel-box-num">${tiendas.length}</div><div class="panel-box-lbl">TIENDAS</div></div>
        <div class="panel-box"><div class="panel-box-num">${equipos.length}</div><div class="panel-box-lbl">ACTIVOS</div></div>
        <div class="panel-box"><div class="panel-box-num">${servMes}</div><div class="panel-box-lbl">SERVICIOS MES</div></div>
    </div></div>`;
}

function renderCedis() {
    return `<div class="page"><div class="sec-head"><h2>CEDIS (${cedis.length})</h2><button class="btn btn-blue btn-sm" onclick="modalNuevaEntidad('cedi')">+ Nuevo CEDI</button></div>
    <input class="search" placeholder="Buscar por nombre o ciudad..." id="searchCedis">
    <div id="cedisGrid">${cedis.map(c=>`<div class="cc" data-search="${(c.nombre+c.ciudad).toLowerCase()}"><div class="cc-name">${c.nombre}</div><div class="cc-row">📍 ${c.ciudad}</div><div class="cc-row">📞 ${c.telefono||''}</div><button class="link-btn" onclick="goTo('detalle','${c.id}','cedi')">Ver activos →</button></div>`).join('')}</div></div>`;
}

function renderTiendas() {
    return `<div class="page"><div class="sec-head"><h2>TIENDAS (${tiendas.length})</h2><button class="btn btn-blue btn-sm" onclick="modalNuevaEntidad('tienda')">+ Nueva Tienda</button></div>
    <input class="search" placeholder="Buscar por nombre o ciudad..." id="searchTiendas">
    <div id="tiendasGrid">${tiendas.map(t=>`<div class="cc" data-search="${(t.nombre+t.ciudad).toLowerCase()}"><div class="cc-name">${t.nombre}</div><div class="cc-row">📍 ${t.ciudad}</div><div class="cc-row">📞 ${t.telefono||''}</div><button class="link-btn" onclick="goTo('detalle','${t.id}','tienda')">Ver activos →</button></div>`).join('')}</div></div>`;
}

function filtrarEntidades(val, tipo) {
    const gridId = tipo==='cedi'?'cedisGrid':'tiendasGrid';
    const grid = document.getElementById(gridId);
    if(!grid) return;
    const txt = val.toLowerCase();
    grid.querySelectorAll('.cc').forEach(el => {
        el.style.display = (el.dataset.search||'').includes(txt) ? '' : 'none';
    });
}

function renderDetalleEntidad() {
    let entidad = selectedEntidadTipo==='cedi' ? getCedi(selectedEntidadId) : getTienda(selectedEntidadId);
    if(!entidad) { goTo(selectedEntidadTipo==='cedi'?'cedis':'tiendas'); return ''; }
    const eqs = getEquiposEntidad(selectedEntidadId, selectedEntidadTipo);
    return `<div class="page"><div class="det-hdr"><button class="back" onclick="goTo('${selectedEntidadTipo}s')">←</button><div><div class="cc-name">${entidad.nombre}</div><div class="cc-meta">${entidad.direccion||''}</div></div></div>
    <div class="sec-head"><span>Activos (${eqs.length})</span><button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${selectedEntidadId}','${selectedEntidadTipo}')">+ Activo</button></div>
    ${eqs.map(e=>`<div class="ec"><div class="ec-name">${e.tipo||''} ${e.modelo} - ${e.marca}</div><div class="ec-meta">📍 ${e.ubicacion||'Sin ubicación'} · Serie: ${e.serie||'S/N'}</div><div class="ec-btns"><button class="ab" onclick="goTo('historial',null,null,'${e.id}')">📋 Historial</button><button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo servicio</button></div></div>`).join('')}</div>`;
}

function renderHistorialEquipo() {
    const e = getEq(selectedEquipoId);
    if(!e) { goTo('panel'); return ''; }
    const ss = getServiciosEquipo(e.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    return `<div class="page"><div class="det-hdr"><button class="back" onclick="goTo('detalle','${e.entidadId}','${e.entidadTipo}')">←</button><div><div class="ec-name">${e.tipo||''} ${e.modelo} - ${e.marca}</div><div class="ec-meta">${e.ubicacion||''}</div></div></div>
    ${ss.map(s=>`<div class="si"><div class="si-top"><span class="badge b-blue">${s.tipo}</span><span>${fmtFecha(s.fecha)}</span></div><div>${s.descripcion}</div><div>🔧 ${s.tecnico}</div></div>`).join('')}</div>`;
}

function renderServicios() { return `<div class="page"><div class="sec-head"><h2>Servicios (${servicios.length})</h2></div><div>Implementar filtros si se desea</div></div>`; }
function renderMantenimientos() { return `<div class="page"><div class="sec-head"><h2>Mantenimientos programados</h2></div></div>`; }
function renderTecnicos() {
    return `<div class="page"><div class="sec-head"><h2>Técnicos (${tecnicos.length})</h2>${esAdmin()?`<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>`:''}</div>
    ${tecnicos.map(t=>`<div class="ec"><div class="ec-name">${t.nombre}</div><div class="ec-meta">${t.rol}</div><button class="btn btn-blue btn-sm" onclick="abrirLogin('${t.id}')">🔑 Ingresar</button></div>`).join('')}</div>`;
}

function goTo(view, entId, entTipo, eqId) {
    currentView = view;
    selectedEntidadId = entId;
    selectedEntidadTipo = entTipo;
    selectedEquipoId = eqId;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b=>b.classList.toggle('active', b.dataset.page===view || (view==='detalle' && (b.dataset.page==='cedis'||b.dataset.page==='tiendas'))));
}

// ===== CRUD ENTIDADES =====
function modalNuevaEntidad(tipo) {
    const titulo = tipo==='cedi' ? 'Nuevo CEDI' : 'Nueva Tienda';
    showModal(`<div class="modal"><div class="modal-h"><h3>${titulo}</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
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
    if(!nombre || !ciudad || !region || !telefono || !direccion) { toast('Complete campos obligatorios'); return; }
    const col = tipo==='cedi' ? 'cedis' : 'tiendas';
    try {
        await addDoc(collection(db, col), {
            nombre, ciudad, region, telefono, email: email||'', direccion,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });
        closeModal();
        await cargarDatos();
        toast(`✅ ${tipo==='cedi'?'CEDI':'Tienda'} guardado`);
    } catch(e) { toast('Error: '+e.message); }
}
// (Por simplicidad, omito editar y eliminar entidades, pero se pueden agregar fácilmente)

// ===== CRUD EQUIPOS =====
function modalNuevoEquipo(entidadId, entidadTipo) {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
        <div class="fr"><div><label class="fl">Marca *</label><input class="fi" id="eqMarca"></div><div><label class="fl">Modelo *</label><input class="fi" id="eqModelo"></div></div>
        <label class="fl">Serie</label><input class="fi" id="eqSerie">
        <label class="fl">Ubicación</label><input class="fi" id="eqUbicacion" placeholder="Opcional">
        <label class="fl">Tipo</label><input class="fi" id="eqTipo" placeholder="Ej: Montacarga, UPS...">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarEquipo('${entidadId}','${entidadTipo}')">Guardar</button></div>
    </div></div>`);
}
async function guardarEquipo(entidadId, entidadTipo) {
    const marca = document.getElementById('eqMarca')?.value.trim();
    const modelo = document.getElementById('eqModelo')?.value.trim();
    if(!marca || !modelo) { toast('Marca y modelo requeridos'); return; }
    try {
        await addDoc(collection(db,'equipos'), {
            entidadId, entidadTipo, marca, modelo,
            serie: document.getElementById('eqSerie')?.value || '',
            ubicacion: document.getElementById('eqUbicacion')?.value || '',
            tipo: document.getElementById('eqTipo')?.value || ''
        });
        closeModal();
        await cargarDatos();
        toast('Activo guardado');
        if(entidadTipo==='cedi') goTo('detalle',entidadId,'cedi');
        else goTo('detalle',entidadId,'tienda');
    } catch(e) { toast('Error: '+e.message); }
}

// ===== LOGIN =====
function abrirLogin(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal"><div class="modal-h"><h3>Ingresar como ${t.nombre}</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
        <label class="fl">Cédula</label><input class="fi" id="loginCedula" type="text">
        <label class="fl">Clave (4 dígitos)</label><input class="fi" id="loginClave" type="password" maxlength="4">
        <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="validarLogin('${tid}')">Ingresar</button></div>
    </div></div>`);
}
function validarLogin(tid) {
    const t = getTec(tid);
    const ced = document.getElementById('loginCedula')?.value.trim();
    const clv = document.getElementById('loginClave')?.value.trim();
    if(t.cedula === ced && t.clave === clv) {
        sesionActual = t;
        closeModal();
        actualizarTopbar();
        renderView();
        toast(`Bienvenido ${t.nombre}`);
    } else {
        toast('Credenciales incorrectas');
    }
}
function modalNuevoTecnico() { toast('Función de crear técnico disponible para admin'); }
function modalEditarTecnico() {}
function eliminarTecnico() {}

// ===== INICIALIZACIÓN =====
window.goTo = goTo;
window.cerrarSesion = cerrarSesion;
window.modalNuevaEntidad = modalNuevaEntidad;
window.guardarEntidad = guardarEntidad;
window.modalNuevoEquipo = modalNuevoEquipo;
window.guardarEquipo = guardarEquipo;
window.modalNuevoServicio = (eid) => toast('Módulo de servicios en desarrollo');
window.filtrarEntidades = filtrarEntidades;
window.abrirLogin = abrirLogin;
window.validarLogin = validarLogin;
window.closeModal = closeModal;
window.modalNuevoTecnico = modalNuevoTecnico;

document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if(!sesionActual && page !== 'panel' && page !== 'tecnicos') {
            toast('Inicie sesión desde la pestaña Técnicos');
            return;
        }
        goTo(page);
    });
});

(async () => {
    await sembrarTecnicos();
    await cargarDatos();
})();