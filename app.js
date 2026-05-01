// ============================================
// D1 · COORDINADOR DE MANTENIMIENTO
// Versión 2.0 — Firebase + Firestore
// Estructura: CEDIs como "clientes"
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, deleteDoc,
    doc, updateDoc, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── FIREBASE CONFIG ──
const firebaseConfig = {
    apiKey: "AIzaSyDw1faNff7uMXR6JbHOhZa7eA5WiiNAJNw",
    authDomain: "donecapacitada-4fa37.firebaseapp.com",
    projectId: "donecapacitada-4fa37",
    storageBucket: "donecapacitada-4fa37.firebasestorage.app",
    messagingSenderId: "449540711283",
    appId: "1:449540711283:web:01efe4696daafc4e215b06"
};

const D1_LOGO = 'https://raw.githubusercontent.com/capacitADA/D-one/main/D1_logo.png';

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ── DATOS GLOBALES ──
// "clientes" = CEDIs
let clientes = [];   // CEDIs
let equipos  = [];   // activos de cada CEDI
let servicios = [];  // servicios/mantenimientos
let tecnicos  = [];

// ── CONSTANTES ──
const REGIONALES = [
    { num: 1, nombre: 'Regional 1' },
    { num: 2, nombre: 'Regional 2' },
    { num: 3, nombre: 'Regional 3' },
    { num: 4, nombre: 'Regional 4' },
    { num: 5, nombre: 'Regional 5' },
];

const CIUDADES = [
    'Bogota','Medellin','Cali','Barranquilla','Bucaramanga',
    'Ibague','Pereira','Manizales','Cucuta','Villavicencio',
    'Pasto','Monteria','Sincelejo','Valledupar','Santa Marta',
    'Cartagena','Armenia','Neiva','Popayan','Tunja'
];

const TIPOS_EQUIPO = [
    'Montacargas electrico','Estibador electrico','Banda transportadora',
    'Compresor','Sistema de refrigeracion','UPS / Planta electrica',
    'Equipo de computo / Red','Bascula industrial',
    'Sistema contra incendios','Luminaria industrial','Otro',
];

const ESTADOS_EQUIPO = [
    { id: 'operativo', label: 'Operativo',        cls: 'ok'    },
    { id: 'revision',  label: 'En revision',       cls: 'warn'  },
    { id: 'fuera',     label: 'Fuera de servicio', cls: 'error' },
];

const TIPOS_SERVICIO = [
    'Mantenimiento preventivo','Mantenimiento correctivo','Instalacion','Inspeccion'
];

const TIPOS_DOC = ['CC','CE','PA','NIT','TI'];

const ESPECIALIDADES = [
    { id: 'electrico',     label: 'Electricista'       },
    { id: 'mecanico',      label: 'Mecanico'           },
    { id: 'refrigeracion', label: 'Refrigeracion'      },
    { id: 'electronico',   label: 'Electronico'        },
    { id: 'planta',        label: 'Plantas electricas' },
    { id: 'redes',         label: 'Redes / Computo'    },
    { id: 'civil',         label: 'Civil / Locativo'   },
];

// ── ESTADO ──
let currentView      = 'panel';
let sesionActual     = null;
let selectedCediId   = null;   // equivale a selectedClienteId
let selectedEquipoId = null;
let fotosNuevas      = [null, null, null];
let mlPinActual      = '';

// ── HELPERS ──
const getCl  = id  => clientes.find(c => c.id === id);
const getEq  = id  => equipos.find(e => e.id === id);
const getTec = id  => tecnicos.find(t => t.id === id);
const getEquiposCedi    = cid => equipos.filter(e => e.clienteId === cid);
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
function hoy() { return new Date().toISOString().split('T')[0]; }
function getMesActual() { return new Date().toISOString().slice(0, 7); }

function esAdmin() { return sesionActual?.rol === 'admin' || sesionActual?.rol === 'coordinador'; }
function esPropietario(creadoPor) { return sesionActual?.nombre === creadoPor; }
function puedeEditar(creadoPor) { return esAdmin() || esPropietario(creadoPor); }

function getEstado(id) {
    return ESTADOS_EQUIPO.find(e => e.id === id) || ESTADOS_EQUIPO[0];
}

// ── TOAST ──
function toast(msg, duration = 3000) {
    const t = document.getElementById('toastEl');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── MODAL ──
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

// ── TOPBAR ──
function actualizarTopbar() {
    const r = document.getElementById('topbarRight');
    if (!r) return;
    if (!sesionActual) {
        r.innerHTML = `<span style="font-size:0.72rem;color:#666;">Sin sesion</span>`;
    } else {
        const ini = sesionActual.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        r.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <div class="topbar-avatar">${ini}</div>
                <div>
                    <div class="topbar-name">${sesionActual.nombre.split(' ')[0]}</div>
                    <div style="font-size:0.62rem;color:var(--red);font-weight:700;">${(sesionActual.rol||'').toUpperCase()}</div>
                </div>
                <button class="topbar-salir" onclick="cerrarSesion()">Salir</button>
            </div>`;
    }
}
function cerrarSesion() {
    sesionActual = null;
    actualizarTopbar();
    goTo('panel');
    toast('👋 Sesion cerrada');
}

// ── NAVEGACIÓN ──
function goTo(view, cid = null, eid = null) {
    currentView    = view;
    selectedCediId = cid;
    selectedEquipoId = eid;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'detalle'   && b.dataset.page === 'cedis') ||
            (view === 'historial' && b.dataset.page === 'cedis')
        );
    });
}

function renderView() {
    const protegidas = ['cedis','detalle','historial','activos','agenda'];
    if (!sesionActual && protegidas.includes(currentView)) {
        currentView = 'panel';
    }
    const main = document.getElementById('mainContent');
    switch (currentView) {
        case 'panel':     main.innerHTML = renderPanel();        break;
        case 'cedis':     main.innerHTML = renderCedis();        break;
        case 'detalle':   main.innerHTML = renderDetalleCedi();  break;
        case 'historial': main.innerHTML = renderHistorial();    break;
        case 'activos':   main.innerHTML = renderActivos();      break;
        case 'servicios': main.innerHTML = renderServicios(); if (window.aplicarFiltros) aplicarFiltros(); break;
        case 'agenda':    main.innerHTML = renderAgenda();       break;
        case 'tecnicos':  main.innerHTML = renderTecnicos();     break;
        default:          main.innerHTML = renderPanel();
    }
}

// ─────────────────────────────────────────────
// ── PANEL ──
// ─────────────────────────────────────────────
function renderPanel() {
    const mes = getMesActual();
    const totalEq  = equipos.length;
    const operativos = equipos.filter(e => (e.estado || 'operativo') === 'operativo').length;
    const revision   = equipos.filter(e => e.estado === 'revision').length;
    const fueraServ  = equipos.filter(e => e.estado === 'fuera').length;

    const hoyStr = hoy();
    const proximos = servicios
        .filter(s => s.proximoMantenimiento && s.proximoMantenimiento >= hoyStr)
        .sort((a, b) => a.proximoMantenimiento.localeCompare(b.proximoMantenimiento))
        .slice(0, 5);

    const servMes = servicios.filter(s => s.fecha?.startsWith(mes));
    const prevMes = servicios.filter(s => s.tipo?.toLowerCase().includes('preventivo') && s.fecha?.startsWith(mes));
    const corrMes = servicios.filter(s => s.tipo?.toLowerCase().includes('correctivo') && s.fecha?.startsWith(mes));

    return `<div class="page">
        <div class="panel-banner">
            <img src="${D1_LOGO}" class="panel-logo" onerror="this.style.display='none'">
            <div class="panel-banner-sub">Coordinador de Mantenimiento</div>
            <div class="panel-banner-title">Panel Principal</div>
        </div>
        <div class="panel-grid">
            <div class="panel-col">
                <div class="panel-col-head">CEDIs</div>
                <div class="panel-box gold-box"><div class="panel-box-num">${clientes.length}</div><div class="panel-box-lbl">REGISTRADOS</div></div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Activos</div>
                <div class="panel-box"><div class="panel-box-num" style="color:var(--green)">${operativos}</div><div class="panel-box-lbl">OPERATIVOS</div></div>
                <div class="panel-box"><div class="panel-box-num" style="color:#f59e0b">${revision}</div><div class="panel-box-lbl">EN REVISION</div></div>
                <div class="panel-box"><div class="panel-box-num" style="color:var(--red)">${fueraServ}</div><div class="panel-box-lbl">FUERA SERV.</div></div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicios mes</div>
                <div class="panel-box anual-box"><div class="panel-box-num">${servMes.length}</div><div class="panel-box-lbl">TOTAL</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${prevMes.length}</div><div class="panel-box-lbl">PREVENTIVOS</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${corrMes.length}</div><div class="panel-box-lbl">CORRECTIVOS</div></div>
            </div>
        </div>
        ${proximos.length ? `
        <div style="margin-top:1rem;">
            <div style="font-weight:700;margin-bottom:0.5rem;font-size:0.85rem;">📅 Proximos mantenimientos</div>
            ${proximos.map(s => {
                const e = getEq(s.equipoId);
                const c = getCl(e?.clienteId);
                return `<div class="si" style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:0.82rem;font-weight:700;">${e?.nombre || (e?.marca + ' ' + e?.modelo)}</div>
                        <div style="font-size:0.75rem;color:var(--hint);">${c?.nombre || 'CEDI'} · 📍 ${e?.ubicacion || ''}</div>
                    </div>
                    <span style="font-size:0.78rem;color:#b45309;font-weight:700;">${fmtFecha(s.proximoMantenimiento)}</span>
                </div>`;
            }).join('')}
        </div>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────
// ── CEDIS (equivale a renderClientes) ──
// ─────────────────────────────────────────────
function renderCedis() {
    return `<div class="page">
        <div class="sec-head">
            <h2>CEDIs (${clientes.length})</h2>
            ${esAdmin() ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoCedi()">+ Nuevo</button>` : ''}
        </div>
        <input class="search" placeholder="🔍 Buscar CEDI..." oninput="filtrarCedis(this.value)" id="searchCedis">
        <div id="cedisGrid">
            ${clientes.map(c => {
                const eqs = getEquiposCedi(c.id);
                const servs = getServiciosCedi(c.id);
                const reg = REGIONALES.find(r => r.num === c.regional);
                return `<div class="cc" data-search="${(c.nombre + c.ciudad + (c.departamento||'')).toLowerCase()}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                            <div class="cc-name">${c.nombre}</div>
                            ${reg ? `<span class="city-tag" style="background:var(--red);color:white;">${reg.nombre}</span>` : ''}
                        </div>
                        ${esAdmin() ? `<div>
                            <button class="ib" onclick="modalEditarCedi('${c.id}')">✏️</button>
                            <button class="ib" onclick="modalEliminarCedi('${c.id}')">🗑️</button>
                        </div>` : ''}
                    </div>
                    <div class="cc-row">📍 ${c.ciudad}${c.departamento ? ', ' + c.departamento : ''}</div>
                    ${c.direccion ? `<div class="cc-row">🏭 ${c.direccion}</div>` : ''}
                    ${c.telefono  ? `<div class="cc-row">📞 ${c.telefono}</div>` : ''}
                    ${c.coordinador ? `<div class="cc-row">👤 ${c.coordinador}</div>` : ''}
                    <div class="cc-meta">${eqs.length} activo(s) · ${servs.length} servicio(s)</div>
                    <button class="link-btn" onclick="goTo('detalle','${c.id}')">Ver activos →</button>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function filtrarCedis(v) {
    const txt = v.toLowerCase();
    document.querySelectorAll('#cedisGrid .cc').forEach(c => {
        c.style.display = (c.dataset.search || '').includes(txt) ? '' : 'none';
    });
}

// ─────────────────────────────────────────────
// ── DETALLE CEDI (equivale a renderDetalleCliente) ──
// ─────────────────────────────────────────────
function renderDetalleCedi() {
    const c = getCl(selectedCediId);
    if (!c) { goTo('cedis'); return ''; }
    const eqs = getEquiposCedi(c.id);
    const reg  = REGIONALES.find(r => r.num === c.regional);

    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('cedis')">← Volver</button>
            <div>
                <div class="cc-name">${c.nombre}</div>
                <div class="cc-meta">${c.ciudad}${c.departamento ? ', ' + c.departamento : ''}${reg ? ' · ' + reg.nombre : ''}</div>
            </div>
        </div>
        <div class="info-box">
            ${c.direccion   ? `<div class="cc-row">🏭 ${c.direccion}</div>` : ''}
            ${c.telefono    ? `<div class="cc-row">📞 <strong>${c.telefono}</strong></div>` : ''}
            ${c.coordinador ? `<div class="cc-row">👤 ${c.coordinador}</div>` : ''}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
            <span style="font-weight:700;">Activos (${eqs.length})</span>
            ${sesionActual ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${c.id}')">+ Activo</button>` : ''}
        </div>
        ${eqs.map(e => {
            const est = getEstado(e.estado || 'operativo');
            const srvCount = getServiciosEquipo(e.id).length;
            return `<div class="ec">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <div class="ec-name">${e.nombre || (e.marca + ' ' + e.modelo)}</div>
                        <div class="ec-meta">${e.tipo || ''}</div>
                        <div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie || 'S/N'}</div>
                        <div class="ec-meta">${srvCount} servicio(s)</div>
                        <span class="estado-badge estado-${est.cls}">${est.label}</span>
                    </div>
                    ${esAdmin() ? `<div>
                        <button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button>
                        <button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button>
                    </div>` : ''}
                </div>
                <div class="ec-btns">
                    <button class="ab" onclick="goTo('historial','${c.id}','${e.id}')">📋 Servicios</button>
                    ${sesionActual ? `<button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>` : ''}
                    <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                    <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

// ─────────────────────────────────────────────
// ── HISTORIAL EQUIPO ──
// ─────────────────────────────────────────────
function renderHistorial() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('cedis'); return ''; }
    const c  = getCl(e.clienteId);
    const ss = getServiciosEquipo(e.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const est = getEstado(e.estado || 'operativo');

    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('detalle','${e.clienteId}')">← Volver</button>
            <div>
                <div class="ec-name">${e.nombre || (e.marca + ' ' + e.modelo)}</div>
                <div class="ec-meta">${e.ubicacion} · ${c?.nombre}</div>
                <span class="estado-badge estado-${est.cls}">${est.label}</span>
            </div>
        </div>
        <div style="margin-bottom:0.75rem;font-weight:700;">Historial (${ss.length})</div>
        ${ss.map(s => `
        <div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo?.includes('preventivo') ? 'b-blue' : s.tipo?.includes('correctivo') ? 'b-red' : 'b-green'}">${s.tipo}</span>
                <span style="font-size:0.8rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
            </div>
            <div class="si-info">🔧 ${s.tecnico}</div>
            <div class="si-info">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div class="si-info" style="color:var(--gold);">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">${(s.fotos || []).map(f => `<img class="fthumb" src="${f}" loading="lazy">`).join('')}</div>
            <div class="si-top" style="justify-content:flex-end;margin-top:4px;">
                ${puedeEditar(s.tecnico) ? `<button class="ib" onclick="modalEditarServicio('${s.id}')">✏️</button>` : ''}
                ${esAdmin() ? `<button class="ib" onclick="eliminarServicio('${s.id}')">🗑️</button>` : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

// ─────────────────────────────────────────────
// ── ACTIVOS (todos) ──
// ─────────────────────────────────────────────
function renderActivos() {
    return `<div class="page">
        <div class="sec-head"><h2>Activos (${equipos.length})</h2></div>
        <input class="search" placeholder="🔍 Buscar activo..." oninput="filtrarActivos(this.value)" id="searchActivos">
        <div id="activosGrid">
        ${equipos.map(e => {
            const c   = getCl(e.clienteId);
            const est = getEstado(e.estado || 'operativo');
            return `<div class="ec" data-search="${((e.nombre||'')+(e.marca||'')+(e.modelo||'')+(c?.nombre||'')+(e.tipo||'')).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;">
                    <div>
                        <div class="ec-name">${e.nombre || (e.marca + ' ' + e.modelo)}</div>
                        <div class="ec-meta">🏭 ${c?.nombre || 'Sin CEDI'} · 📍 ${e.ubicacion}</div>
                        <div class="ec-meta">${e.tipo || ''}</div>
                        <span class="estado-badge estado-${est.cls}">${est.label}</span>
                    </div>
                </div>
                <div class="ec-btns">
                    <button class="ab" onclick="goTo('historial','${e.clienteId}','${e.id}')">📋 Servicios</button>
                    ${sesionActual ? `<button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>` : ''}
                    <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                </div>
            </div>`;
        }).join('')}
        </div>
    </div>`;
}

function filtrarActivos(v) {
    const txt = v.toLowerCase();
    document.querySelectorAll('#activosGrid .ec').forEach(c => {
        c.style.display = (c.dataset.search || '').includes(txt) ? '' : 'none';
    });
}

// ─────────────────────────────────────────────
// ── SERVICIOS (con filtros) ──
// ─────────────────────────────────────────────
function renderServicios() {
    const años  = [...new Set(servicios.map(s => s.fecha?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `<div class="page">
        <div class="sec-head"><h2>Servicios</h2></div>
        <div class="filtros">
            <select class="fi" id="fAnio"><option value="">Todos los años</option>${años.map(a => `<option>${a}</option>`).join('')}</select>
            <select class="fi" id="fMes"><option value="">Todos los meses</option>${meses.map((m, i) => `<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('')}</select>
            <select class="fi" id="fTipo"><option value="">Todos los tipos</option>${TIPOS_SERVICIO.map(t => `<option>${t}</option>`).join('')}</select>
            <select class="fi" id="fCedi"><option value="">Todos los CEDIs</option>${clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
            <select class="fi" id="fTecnico"><option value="">Todos los tecnicos</option>${tecnicos.map(t => `<option>${t.nombre}</option>`).join('')}</select>
            <button class="btn btn-blue btn-full" onclick="aplicarFiltros()">Aplicar</button>
            <button class="btn btn-gray btn-full" onclick="limpiarFiltros()">Limpiar</button>
        </div>
        <div id="listaServicios"></div>
    </div>`;
}

function aplicarFiltros() {
    const anio = document.getElementById('fAnio')?.value   || '';
    const mes  = document.getElementById('fMes')?.value    || '';
    const tipo = document.getElementById('fTipo')?.value   || '';
    const cid  = document.getElementById('fCedi')?.value   || '';
    const tec  = document.getElementById('fTecnico')?.value|| '';
    let filtrados = [...servicios].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (anio) filtrados = filtrados.filter(s => s.fecha?.startsWith(anio));
    if (mes)  filtrados = filtrados.filter(s => s.fecha?.slice(5, 7) === mes);
    if (tipo) filtrados = filtrados.filter(s => s.tipo === tipo);
    if (cid)  filtrados = filtrados.filter(s => getEquiposCedi(cid).some(e => e.id === s.equipoId));
    if (tec)  filtrados = filtrados.filter(s => s.tecnico === tec);
    const el = document.getElementById('listaServicios');
    if (!el) return;
    if (!filtrados.length) { el.innerHTML = '<p class="cc-meta" style="text-align:center;">Sin resultados.</p>'; return; }
    el.innerHTML = filtrados.map(s => {
        const e = getEq(s.equipoId);
        const c = getCl(e?.clienteId);
        return `<div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo?.includes('preventivo')?'b-blue':s.tipo?.includes('correctivo')?'b-red':'b-green'}">${s.tipo}</span>
                <span>${fmtFecha(s.fecha)}</span>
            </div>
            <div class="si-info">🏭 ${c?.nombre || 'N/A'} · ${e?.nombre || ((e?.marca||'') + ' ' + (e?.modelo||''))}</div>
            <div class="si-info">📍 ${e?.ubicacion || ''} · 🔧 ${s.tecnico}</div>
            <div class="si-info">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div class="si-info" style="color:var(--gold);">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
        </div>`;
    }).join('');
}

function limpiarFiltros() {
    ['fAnio','fMes','fTipo','fCedi','fTecnico'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    aplicarFiltros();
}

// ─────────────────────────────────────────────
// ── AGENDA ──
// ─────────────────────────────────────────────
function renderAgenda() {
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const año   = new Date().getFullYear();
    const mant  = servicios.filter(s => s.proximoMantenimiento);
    return `<div class="page">
        <div class="sec-head"><h2>Agenda ${año}</h2></div>
        <div class="tbl-wrap">
            <table>
                <thead><tr><th>Mes</th><th>Fecha</th><th>CEDI</th><th>Activo</th><th></th></tr></thead>
                <tbody>
                ${MESES.map((mes, idx) => {
                    const mp   = String(idx + 1).padStart(2, '0');
                    const lista = mant.filter(m => m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                    if (!lista.length) return `<tr><td style="color:var(--hint);">${mes}</td><td colspan="4" style="color:#cbd5e1;">—</td></tr>`;
                    return lista.map((m, i) => {
                        const e = getEq(m.equipoId);
                        const c = getCl(e?.clienteId);
                        return `<tr>
                            ${i === 0 ? `<td rowspan="${lista.length}" style="font-weight:700;background:var(--bg2);">${mes}</td>` : ''}
                            <td>${fmtFecha(m.proximoMantenimiento)}</td>
                            <td>${c?.nombre || 'N/A'}</td>
                            <td>${e ? (e.nombre || e.marca + ' ' + e.modelo) : 'N/A'}</td>
                            <td><button class="rec-btn" onclick="modalRecordar('${e?.clienteId}','${e?.id}','${m.proximoMantenimiento}')">📱</button></td>
                        </tr>`;
                    }).join('');
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

// ─────────────────────────────────────────────
// ── TECNICOS ──
// ─────────────────────────────────────────────
function renderTecnicos() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Tecnicos (${tecnicos.length})</h2>
            ${esAdmin() ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>` : ''}
        </div>
        ${tecnicos.map(t => {
            const esps = (t.especialidades || []).map(id => ESPECIALIDADES.find(e => e.id === id)?.label || id);
            const reg  = REGIONALES.find(r => r.num === t.regional);
            return `<div class="ec">
                <div style="display:flex;justify-content:space-between;">
                    <div>
                        <div class="ec-name">${t.nombre}</div>
                        <div class="ec-meta">${t.tipoDoc} ${t.cedula} · ${t.cargo || ''}</div>
                        ${t.telefono ? `<div class="ec-meta">📞 ${t.telefono}</div>` : ''}
                        ${reg ? `<div class="ec-meta">📍 ${reg.nombre}</div>` : ''}
                    </div>
                    <div>
                        <span class="tc-rol-badge ${t.rol === 'admin' || t.rol === 'coordinador' ? 'rol-admin' : 'rol-tec'}">${t.rol === 'admin' ? 'Admin' : t.rol === 'coordinador' ? 'Coord.' : 'Tecnico'}</span>
                        ${esAdmin() ? `<div>
                            <button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button>
                            <button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button>
                        </div>` : ''}
                    </div>
                </div>
                <div>${esps.map(e => `<span class="esp-chip">${e}</span>`).join('')}</div>
                <button class="btn btn-blue btn-sm btn-full" style="margin-top:8px;" onclick="abrirLogin('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button>
            </div>`;
        }).join('')}
    </div>`;
}

// ─────────────────────────────────────────────
// ── LOGIN ──
// ─────────────────────────────────────────────
function abrirLogin(tid) {
    const t = getTec(tid);
    mlPinActual = '';
    showModal(`<div class="modal" style="max-width:320px;">
        <div class="modal-h"><h3>🔑 Ingresar</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="font-weight:700;">${t.nombre}</div>
            <div class="ec-meta">${t.tipoDoc}</div>
            <label class="fl">Cedula</label>
            <input class="fi" id="mlCedula" type="number">
            <label class="fl">Clave (4 digitos)</label>
            <div class="pin-display">
                <div class="pin-digit" id="mlpd0"></div>
                <div class="pin-digit" id="mlpd1"></div>
                <div class="pin-digit" id="mlpd2"></div>
                <div class="pin-digit" id="mlpd3"></div>
            </div>
            <div class="numpad">
                ${[1,2,3,4,5,6,7,8,9].map(n => `<div class="num-btn" onclick="mlPin('${tid}',${n})">${n}</div>`).join('')}
                <div class="num-btn del" onclick="mlDel()">⌫</div>
                <div class="num-btn zero" onclick="mlPin('${tid}',0)">0</div>
                <div class="num-btn ok" onclick="mlLogin('${tid}')">✓</div>
            </div>
            <div id="mlMsg"></div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="mlLogin('${tid}')">Ingresar</button>
            </div>
        </div>
    </div>`);
}

function mlPin(tid, n) {
    if (mlPinActual.length >= 4) return;
    mlPinActual += String(n);
    mlUpdateDisplay();
    if (mlPinActual.length === 4) mlLogin(tid);
}
function mlDel() { mlPinActual = mlPinActual.slice(0, -1); mlUpdateDisplay(); }
function mlUpdateDisplay() {
    for (let i = 0; i < 4; i++) {
        const d = document.getElementById('mlpd' + i);
        if (!d) return;
        d.className = 'pin-digit';
        if (i < mlPinActual.length) { d.textContent = '●'; d.classList.add('filled'); }
        else if (i === mlPinActual.length) { d.textContent = '_'; d.classList.add('active'); }
        else { d.textContent = ''; }
    }
}
function mlLogin(tid) {
    const t      = getTec(tid);
    const cedula = document.getElementById('mlCedula')?.value?.trim();
    const msg    = document.getElementById('mlMsg');
    if (!cedula) { if (msg) msg.innerHTML = '<div class="login-warn">⚠️ Cedula requerida</div>'; return; }
    if (mlPinActual.length < 4) { if (msg) msg.innerHTML = '<div class="login-warn">⚠️ Clave de 4 digitos</div>'; return; }
    if (t.cedula !== cedula || t.clave !== mlPinActual) {
        if (msg) msg.innerHTML = '<div class="login-error">❌ Credenciales incorrectas</div>';
        mlPinActual = ''; mlUpdateDisplay(); return;
    }
    sesionActual = t;
    mlPinActual  = '';
    closeModal();
    actualizarTopbar();
    currentView = 'panel';
    renderView();
    toast(`✅ Bienvenido, ${t.nombre.split(' ')[0]}`);
}

// ─────────────────────────────────────────────
// ── MODAL RECORDAR ──
// ─────────────────────────────────────────────
function modalRecordar(cediId, equipoId, fecha) {
    const e = getEq(equipoId);
    const c = getCl(cediId);
    const fechaF = fmtFechaLarga(fecha);
    const nomActivo = e?.nombre || ((e?.marca || '') + ' ' + (e?.modelo || ''));
    const tel = c?.telefono || '';
    const msg = `Hola *${c?.nombre}*, recordatorio: activo *${nomActivo}* ubicado en *${e?.ubicacion}* requiere mantenimiento el *${fechaF}*. D1 Mantenimiento.`;
    showModal(`<div class="modal">
        <div class="modal-h"><h3>📱 Recordatorio WhatsApp</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="ec-meta">Para <strong>${c?.nombre}</strong> · 📞 ${tel}</div>
            <div class="wa-bubble">${msg}</div>
            <textarea class="fi" id="waMsgEdit" rows="4">${msg}</textarea>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-wa" onclick="enviarWhatsApp('${tel}')">📱 Abrir WhatsApp</button>
            </div>
        </div>
    </div>`);
}

function enviarWhatsApp(tel) {
    const msg = document.getElementById('waMsgEdit')?.value || '';
    const telLimpio = '57' + tel.replace(/\D/g, '');
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    closeModal();
    toast('📱 WhatsApp abierto');
}

// ─────────────────────────────────────────────
// ── NUEVO SERVICIO ──
// ─────────────────────────────────────────────
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function modalNuevoServicio(eid) {
    if (!sesionActual) { toast('🔑 Inicia sesion para continuar'); return; }
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    fotosNuevas = [null, null, null];
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="background:var(--bg2);padding:0.55rem;border-radius:8px;margin-bottom:0.65rem;">
                <strong>${c?.nombre}</strong><br>
                <span style="font-size:0.75rem;">${e?.nombre || ((e?.marca||'') + ' ' + (e?.modelo||''))} · 📍 ${e?.ubicacion}</span>
            </div>
            <div class="fr">
                <div><label class="fl">Tipo *</label>
                    <select class="fi" id="sTipo" onchange="onTipoChange()">
                        ${TIPOS_SERVICIO.map(t => `<option>${t}</option>`).join('')}
                    </select>
                </div>
                <div><label class="fl">Fecha *</label><input class="fi" type="date" id="sFecha" value="${hoy()}"></div>
            </div>
            <label class="fl">Tecnico</label>
            <input class="fi" id="sTecnico" value="${sesionActual?.nombre || ''}" readonly>
            <label class="fl">Diagnostico / Descripcion *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado..."></textarea>
            <div class="mant-box hidden" id="mantBox">
                <label class="fl">📅 Proximo mantenimiento</label>
                <input class="fi" type="date" id="proxFecha">
            </div>
            <label class="fl">Estado del equipo</label>
            <select class="fi" id="sEstado">
                ${ESTADOS_EQUIPO.map(e => `<option value="${e.id}">${e.label}</option>`).join('')}
            </select>
            <label class="fl">📷 Fotos (max 3)</label>
            <div class="foto-row">
                ${[0,1,2].map(i => `<div style="flex:1;"><div class="fslot" id="fslot${i}" onclick="document.getElementById('finput${i}').click()">
                    <div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${i+1}</div>
                    <input type="file" id="finput${i}" accept="image/*" style="display:none" onchange="previewFoto(this,${i})">
                </div></div>`).join('')}
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarServicio('${eid}')">💾 Guardar</button>
            </div>
        </div>
    </div>`);
    onTipoChange();
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const box  = document.getElementById('mantBox');
    if (box) box.classList.toggle('hidden', !tipo?.toLowerCase().includes('preventivo'));
}

async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if (!desc) { toast('⚠️ Ingresa el diagnostico'); return; }
    const tipo  = document.getElementById('sTipo').value;
    const fecha = document.getElementById('sFecha').value;
    const prox  = tipo.toLowerCase().includes('preventivo') ? (document.getElementById('proxFecha')?.value || null) : null;
    const estado = document.getElementById('sEstado')?.value || 'operativo';

    const fotosBase64 = [];
    for (let i = 0; i < fotosNuevas.length; i++) {
        if (fotosNuevas[i]) fotosBase64.push(await fileToBase64(fotosNuevas[i]));
    }
    try {
        await addDoc(collection(db, 'servicios'), {
            equipoId: eid, tipo, fecha,
            tecnico: sesionActual?.nombre || '',
            descripcion: desc,
            proximoMantenimiento: prox,
            fotos: fotosBase64
        });
        // actualizar estado del equipo
        await updateDoc(doc(db, 'equipos', eid), { estado });
        closeModal();
        await cargarDatos();
        const e = getEq(eid);
        if (e) goTo('historial', e.clienteId, eid);
        toast('✅ Servicio guardado con ' + fotosBase64.length + ' foto(s)');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarServicio(sid) {
    const s = servicios.find(x => x.id === sid);
    if (!s) return;
    showModal(`<div class="modal">
        <div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl">Tipo</label>
                    <select class="fi" id="esTipo">${TIPOS_SERVICIO.map(t => `<option ${t===s.tipo?'selected':''}>${t}</option>`).join('')}</select>
                </div>
                <div><label class="fl">Fecha</label><input class="fi" type="date" id="esFecha" value="${s.fecha}"></div>
            </div>
            <label class="fl">Diagnostico</label>
            <textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea>
            <label class="fl">Proximo mantenimiento</label>
            <input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento || ''}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarServicio('${sid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function actualizarServicio(sid) {
    const tipo  = document.getElementById('esTipo')?.value;
    const fecha = document.getElementById('esFecha')?.value;
    const desc  = document.getElementById('esDesc')?.value?.trim();
    const prox  = document.getElementById('esProx')?.value || null;
    try {
        await updateDoc(doc(db, 'servicios', sid), { tipo, fecha, descripcion: desc, proximoMantenimiento: prox });
        closeModal();
        await cargarDatos();
        toast('✅ Servicio actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarServicio(sid) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
        await deleteDoc(doc(db, 'servicios', sid));
        await cargarDatos();
        toast('🗑️ Eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function previewFoto(input, idx) {
    if (!input.files || !input.files[0]) return;
    fotosNuevas[idx] = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const slot = document.getElementById('fslot' + idx);
        if (slot) slot.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">
            <button class="fslot-del" onclick="borrarFoto(event,${idx})">✕</button>
            <input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
    };
    reader.readAsDataURL(input.files[0]);
}

function borrarFoto(e, idx) {
    e.stopPropagation();
    fotosNuevas[idx] = null;
    const slot = document.getElementById('fslot' + idx);
    if (slot) {
        slot.innerHTML = `<div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${idx+1}</div>
            <input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick = () => document.getElementById('finput' + idx).click();
    }
}

// ─────────────────────────────────────────────
// ── CRUD CEDIs ──
// ─────────────────────────────────────────────
function modalNuevoCedi() {
    showModal(`<div class="modal">
        <div class="modal-h"><h3>Nuevo CEDI</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl">Nombre *</label>
            <input class="fi" id="cNombre" placeholder="Ej: CEDI Ibague">
            <div class="fr">
                <div><label class="fl">Ciudad *</label>
                    <select class="fi" id="cCiudad">${CIUDADES.map(ci => `<option>${ci}</option>`).join('')}</select>
                </div>
                <div><label class="fl">Departamento</label>
                    <input class="fi" id="cDepartamento" placeholder="Ej: Tolima">
                </div>
            </div>
            <label class="fl">Regional</label>
            <select class="fi" id="cRegional">
                <option value="">Sin regional</option>
                ${REGIONALES.map(r => `<option value="${r.num}">${r.nombre}</option>`).join('')}
            </select>
            <label class="fl">Direccion</label>
            <input class="fi" id="cDireccion" placeholder="Calle / Carrera...">
            <label class="fl">Coordinador</label>
            <input class="fi" id="cCoordinador">
            <label class="fl">Telefono</label>
            <input class="fi" id="cTelefono" type="tel">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarCedi()">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarCedi() {
    const nombre = document.getElementById('cNombre')?.value?.trim();
    const ciudad = document.getElementById('cCiudad')?.value;
    if (!nombre || !ciudad) { toast('⚠️ Nombre y ciudad son obligatorios'); return; }
    const regional = document.getElementById('cRegional')?.value;
    try {
        await addDoc(collection(db, 'clientes'), {
            nombre,
            ciudad,
            departamento: document.getElementById('cDepartamento')?.value?.trim() || '',
            regional:     regional ? parseInt(regional) : null,
            direccion:    document.getElementById('cDireccion')?.value?.trim() || '',
            coordinador:  document.getElementById('cCoordinador')?.value?.trim() || '',
            telefono:     document.getElementById('cTelefono')?.value?.trim() || '',
            fechaCreacion: hoy()
        });
        closeModal();
        await cargarDatos();
        toast('✅ CEDI guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarCedi(cid) {
    const c = getCl(cid);
    if (!c) return;
    showModal(`<div class="modal">
        <div class="modal-h"><h3>Editar CEDI</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl">Nombre</label>
            <input class="fi" id="ecNombre" value="${c.nombre}">
            <div class="fr">
                <div><label class="fl">Ciudad</label>
                    <select class="fi" id="ecCiudad">${CIUDADES.map(ci => `<option ${ci===c.ciudad?'selected':''}>${ci}</option>`).join('')}</select>
                </div>
                <div><label class="fl">Departamento</label>
                    <input class="fi" id="ecDepartamento" value="${c.departamento || ''}">
                </div>
            </div>
            <label class="fl">Regional</label>
            <select class="fi" id="ecRegional">
                <option value="">Sin regional</option>
                ${REGIONALES.map(r => `<option value="${r.num}" ${c.regional==r.num?'selected':''}>${r.nombre}</option>`).join('')}
            </select>
            <label class="fl">Direccion</label>
            <input class="fi" id="ecDireccion" value="${c.direccion || ''}">
            <label class="fl">Coordinador</label>
            <input class="fi" id="ecCoordinador" value="${c.coordinador || ''}">
            <label class="fl">Telefono</label>
            <input class="fi" id="ecTelefono" value="${c.telefono || ''}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarCedi('${cid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function actualizarCedi(cid) {
    const regional = document.getElementById('ecRegional')?.value;
    try {
        await updateDoc(doc(db, 'clientes', cid), {
            nombre:      document.getElementById('ecNombre').value,
            ciudad:      document.getElementById('ecCiudad').value,
            departamento:document.getElementById('ecDepartamento').value,
            regional:    regional ? parseInt(regional) : null,
            direccion:   document.getElementById('ecDireccion').value,
            coordinador: document.getElementById('ecCoordinador').value,
            telefono:    document.getElementById('ecTelefono').value,
        });
        closeModal();
        await cargarDatos();
        toast('✅ CEDI actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarCedi(cid) {
    if (!confirm('¿Eliminar este CEDI y todos sus activos/servicios?')) return;
    eliminarCedi(cid);
}

async function eliminarCedi(cid) {
    const eids = getEquiposCedi(cid).map(e => e.id);
    try {
        for (const eid of eids) {
            const ss = getServiciosEquipo(eid);
            for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
            await deleteDoc(doc(db, 'equipos', eid));
        }
        await deleteDoc(doc(db, 'clientes', cid));
        await cargarDatos();
        goTo('cedis');
        toast('🗑️ CEDI eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ─────────────────────────────────────────────
// ── CRUD EQUIPOS ──
// ─────────────────────────────────────────────
function modalNuevoEquipo(cid) {
    showModal(`<div class="modal">
        <div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl">Nombre / Descripcion *</label>
            <input class="fi" id="qNombre" placeholder="Ej: Montacargas 01">
            <label class="fl">Tipo</label>
            <select class="fi" id="qTipo">${TIPOS_EQUIPO.map(t => `<option>${t}</option>`).join('')}</select>
            <div class="fr">
                <div><label class="fl">Marca</label><input class="fi" id="qMarca"></div>
                <div><label class="fl">Modelo</label><input class="fi" id="qModelo"></div>
            </div>
            <label class="fl">Serie</label>
            <input class="fi" id="qSerie">
            <label class="fl">Ubicacion *</label>
            <input class="fi" id="qUbic" placeholder="Zona, area...">
            <label class="fl">Estado inicial</label>
            <select class="fi" id="qEstado">${ESTADOS_EQUIPO.map(e => `<option value="${e.id}">${e.label}</option>`).join('')}</select>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarEquipo('${cid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarEquipo(cid) {
    const nombre = document.getElementById('qNombre')?.value?.trim();
    const ubic   = document.getElementById('qUbic')?.value?.trim();
    if (!nombre || !ubic) { toast('⚠️ Nombre y ubicacion son obligatorios'); return; }
    try {
        await addDoc(collection(db, 'equipos'), {
            clienteId:  cid,
            nombre,
            tipo:       document.getElementById('qTipo')?.value || '',
            marca:      document.getElementById('qMarca')?.value?.trim() || '',
            modelo:     document.getElementById('qModelo')?.value?.trim() || '',
            serie:      document.getElementById('qSerie')?.value?.trim() || '',
            ubicacion:  ubic,
            estado:     document.getElementById('qEstado')?.value || 'operativo',
            fechaRegistro: hoy()
        });
        closeModal();
        await cargarDatos();
        toast('✅ Activo guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarEquipo(eid) {
    const e = getEq(eid);
    if (!e) return;
    showModal(`<div class="modal">
        <div class="modal-h"><h3>Editar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl">Nombre / Descripcion</label>
            <input class="fi" id="eNombre" value="${e.nombre || ''}">
            <label class="fl">Tipo</label>
            <select class="fi" id="eTipoEq">${TIPOS_EQUIPO.map(t => `<option ${t===e.tipo?'selected':''}>${t}</option>`).join('')}</select>
            <div class="fr">
                <div><label class="fl">Marca</label><input class="fi" id="eMarca" value="${e.marca || ''}"></div>
                <div><label class="fl">Modelo</label><input class="fi" id="eModelo" value="${e.modelo || ''}"></div>
            </div>
            <label class="fl">Serie</label>
            <input class="fi" id="eSerie" value="${e.serie || ''}">
            <label class="fl">Ubicacion</label>
            <input class="fi" id="eUbic" value="${e.ubicacion || ''}">
            <label class="fl">Estado</label>
            <select class="fi" id="eEstado">${ESTADOS_EQUIPO.map(est => `<option value="${est.id}" ${est.id===e.estado?'selected':''}>${est.label}</option>`).join('')}</select>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function actualizarEquipo(eid) {
    try {
        await updateDoc(doc(db, 'equipos', eid), {
            nombre:    document.getElementById('eNombre').value,
            tipo:      document.getElementById('eTipoEq').value,
            marca:     document.getElementById('eMarca').value,
            modelo:    document.getElementById('eModelo').value,
            serie:     document.getElementById('eSerie').value,
            ubicacion: document.getElementById('eUbic').value,
            estado:    document.getElementById('eEstado').value,
        });
        closeModal();
        await cargarDatos();
        toast('✅ Activo actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarEquipo(eid) {
    if (!confirm('¿Eliminar este activo y sus servicios?')) return;
    eliminarEquipo(eid);
}

async function eliminarEquipo(eid) {
    const ss = getServiciosEquipo(eid);
    try {
        for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
        await deleteDoc(doc(db, 'equipos', eid));
        await cargarDatos();
        toast('🗑️ Activo eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ─────────────────────────────────────────────
// ── CRUD TECNICOS ──
// ─────────────────────────────────────────────
function modalNuevoTecnico() {
    showModal(`<div class="modal modal-wide">
        <div class="modal-h"><h3>Nuevo tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl">Nombre completo *</label>
            <input class="fi" id="tNombre">
            <div class="fr">
                <div><label class="fl">Tipo doc</label>
                    <select class="fi" id="tTipoDoc">${TIPOS_DOC.map(d => `<option>${d}</option>`).join('')}</select>
                </div>
                <div><label class="fl">Cedula *</label><input class="fi" id="tCedula" type="number"></div>
            </div>
            <label class="fl">Cargo</label>
            <input class="fi" id="tCargo">
            <label class="fl">Rol</label>
            <select class="fi" id="tRol">
                <option value="tecnico">Tecnico</option>
                <option value="coordinador">Coordinador</option>
                <option value="admin">Admin</option>
            </select>
            <label class="fl">Telefono</label>
            <input class="fi" id="tTel" type="tel">
            <label class="fl">Regional</label>
            <select class="fi" id="tRegional">
                <option value="">Sin regional</option>
                ${REGIONALES.map(r => `<option value="${r.num}">${r.nombre}</option>`).join('')}
            </select>
            <label class="fl">Especialidades</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
                ${ESPECIALIDADES.map(e => `<label style="font-size:0.8rem;display:flex;align-items:center;gap:4px;">
                    <input type="checkbox" value="${e.id}" class="esp-check"> ${e.label}
                </label>`).join('')}
            </div>
            <label class="fl">Clave (4 digitos) *</label>
            <input class="fi" id="tClave" type="password" maxlength="4" placeholder="****">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarTecnico() {
    const nombre = document.getElementById('tNombre')?.value?.trim();
    const cedula = document.getElementById('tCedula')?.value?.trim();
    const clave  = document.getElementById('tClave')?.value?.trim();
    if (!nombre || !cedula || !clave) { toast('⚠️ Nombre, cedula y clave requeridos'); return; }
    if (clave.length !== 4) { toast('⚠️ Clave de 4 digitos'); return; }
    const esps     = [...document.querySelectorAll('.esp-check:checked')].map(c => c.value);
    const regional = document.getElementById('tRegional')?.value;
    try {
        await addDoc(collection(db, 'tecnicos'), {
            nombre,
            tipoDoc:       document.getElementById('tTipoDoc')?.value || 'CC',
            cedula,
            cargo:         document.getElementById('tCargo')?.value?.trim() || '',
            rol:           document.getElementById('tRol')?.value || 'tecnico',
            telefono:      document.getElementById('tTel')?.value?.trim() || '',
            regional:      regional ? parseInt(regional) : null,
            especialidades: esps,
            clave,
            cediId: 'todos'
        });
        closeModal();
        await cargarDatos();
        renderView();
        toast('✅ Tecnico guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarTecnico(tid) {
    const t = getTec(tid);
    if (!t) return;
    showModal(`<div class="modal modal-wide">
        <div class="modal-h"><h3>✏️ Editar Tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl">Nombre completo</label>
            <input class="fi" id="tNombreE" value="${t.nombre}">
            <div class="fr">
                <div><label class="fl">Tipo doc</label>
                    <select class="fi" id="tTipoDocE">${TIPOS_DOC.map(td => `<option ${td===t.tipoDoc?'selected':''}>${td}</option>`).join('')}</select>
                </div>
                <div><label class="fl">Cedula</label><input class="fi" id="tCedulaE" value="${t.cedula}"></div>
            </div>
            <label class="fl">Cargo</label>
            <input class="fi" id="tCargoE" value="${t.cargo || ''}">
            <label class="fl">Rol</label>
            <select class="fi" id="tRolE">
                <option value="tecnico"     ${t.rol==='tecnico'?'selected':''}>Tecnico</option>
                <option value="coordinador" ${t.rol==='coordinador'?'selected':''}>Coordinador</option>
                <option value="admin"       ${t.rol==='admin'?'selected':''}>Admin</option>
            </select>
            <label class="fl">Telefono</label>
            <input class="fi" id="tTelE" value="${t.telefono || ''}">
            <label class="fl">Regional</label>
            <select class="fi" id="tRegionalE">
                <option value="">Sin regional</option>
                ${REGIONALES.map(r => `<option value="${r.num}" ${t.regional==r.num?'selected':''}>${r.nombre}</option>`).join('')}
            </select>
            <label class="fl">Especialidades</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
                ${ESPECIALIDADES.map(e => `<label style="font-size:0.8rem;display:flex;align-items:center;gap:4px;">
                    <input type="checkbox" value="${e.id}" class="esp-check-e" ${(t.especialidades||[]).includes(e.id)?'checked':''}> ${e.label}
                </label>`).join('')}
            </div>
            <label class="fl">Nueva clave (dejar vacio para no cambiar)</label>
            <input class="fi" id="tClaveE" type="password" maxlength="4" placeholder="****">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarTecnico('${tid}')">✅ Actualizar</button>
            </div>
        </div>
    </div>`);
}

async function actualizarTecnico(tid) {
    const nombre = document.getElementById('tNombreE')?.value?.trim();
    if (!nombre) { toast('⚠️ El nombre es obligatorio'); return; }
    const esps      = [...document.querySelectorAll('.esp-check-e:checked')].map(c => c.value);
    const claveNew  = document.getElementById('tClaveE')?.value?.trim();
    const regional  = document.getElementById('tRegionalE')?.value;
    const updates = {
        nombre,
        tipoDoc:       document.getElementById('tTipoDocE')?.value || 'CC',
        cedula:        document.getElementById('tCedulaE')?.value?.trim() || '',
        cargo:         document.getElementById('tCargoE')?.value?.trim() || '',
        rol:           document.getElementById('tRolE')?.value || 'tecnico',
        telefono:      document.getElementById('tTelE')?.value?.trim() || '',
        regional:      regional ? parseInt(regional) : null,
        especialidades: esps,
    };
    if (claveNew && claveNew.length === 4) updates.clave = claveNew;
    try {
        await updateDoc(doc(db, 'tecnicos', tid), updates);
        closeModal();
        await cargarDatos();
        renderView();
        toast('✅ Tecnico actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarTecnico(tid) {
    if (!esAdmin()) return;
    if (!confirm('¿Eliminar este tecnico?')) return;
    try {
        await deleteDoc(doc(db, 'tecnicos', tid));
        await cargarDatos();
        renderView();
        toast('✅ Tecnico eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ─────────────────────────────────────────────
// ── GENERAR PDF ──
// ─────────────────────────────────────────────
function generarInformePDF(eid) {
    const e  = getEq(eid);
    const c  = getCl(e?.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const serviciosHTML = ss.map(s => {
        const fotosHTML = (s.fotos || []).length > 0
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">${(s.fotos||[]).map(f => `<img src="${f}" style="height:80px;width:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">`).join('')}</div>`
            : '';
        const proxHTML = s.proximoMantenimiento
            ? `<div style="color:#b45309;margin-top:4px;">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>`
            : '';
        return `<div style="border:1px solid #d1d5db;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="background:${s.tipo?.includes('preventivo')?'#1d4ed8':s.tipo?.includes('correctivo')?'#dc2626':'#15803d'};color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">${s.tipo}</span>
                <span style="font-size:13px;color:#555;">${fmtFecha(s.fecha)}</span>
            </div>
            <div style="font-size:13px;color:#374151;margin:3px 0;">🔧 ${s.tecnico}</div>
            <div style="font-size:13px;color:#111;margin:3px 0;">${s.descripcion}</div>
            ${fotosHTML}${proxHTML}
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Informe_${e?.nombre || e?.marca}_${e?.modelo || ''}</title>
<style>@page{size:letter;margin:15mm;}body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;}</style>
</head><body>
<div style="display:flex;align-items:center;border-bottom:3px solid #e30613;padding-bottom:10px;margin-bottom:12px;">
    <img src="${D1_LOGO}" style="height:56px;margin-right:18px;" onerror="this.style.display='none'">
    <div>
        <div style="font-size:13px;color:#555;">Coordinador de Mantenimiento D1</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">INFORME TECNICO</div>
    </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
    <tr>
        <td style="padding:6px 10px;background:#f1f5f9;border:1px solid #ddd;width:50%;-webkit-print-color-adjust:exact;"><strong>CEDI:</strong> ${c?.nombre || 'N/A'}</td>
        <td style="padding:6px 10px;background:#f1f5f9;border:1px solid #ddd;-webkit-print-color-adjust:exact;"><strong>Generado:</strong> ${new Date().toLocaleString()}</td>
    </tr>
    <tr>
        <td colspan="2" style="padding:6px 10px;border:1px solid #ddd;"><strong>Activo:</strong> ${e?.nombre || ''} ${e?.tipo?'· '+e.tipo:''} &nbsp; <strong>Marca/Modelo:</strong> ${e?.marca||''} ${e?.modelo||''} &nbsp; <strong>Serie:</strong> ${e?.serie||'N/A'} &nbsp; <strong>Ubicacion:</strong> ${e?.ubicacion||''}</td>
    </tr>
</table>
<div style="background:#e30613;color:white;font-weight:700;font-size:14px;padding:7px 12px;border-radius:4px;margin-bottom:10px;-webkit-print-color-adjust:exact;">
    HISTORIAL DE SERVICIOS &nbsp; <span style="font-weight:400;font-size:12px;">${ss.length} registro(s)</span>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${serviciosHTML}</div>
</body></html>`;

    const v = window.open('', '_blank');
    if (v) { v.document.open(); v.document.write(html); v.document.close(); setTimeout(() => v.print(), 500); }
}

// ─────────────────────────────────────────────
// ── QR ──
// ─────────────────────────────────────────────
function modalQR(eid) {
    const e   = getEq(eid);
    const c   = getCl(e?.clienteId);
    const url = `${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:280px;height:280px;';
    document.body.appendChild(qrDiv);
    const QRLib = window.QRCode;
    if (!QRLib) { toast('⚠️ QRCode.js no cargado'); return; }
    new QRLib(qrDiv, { text: url, width: 280, height: 280, colorDark: '#e30613', colorLight: '#ffffff' });
    setTimeout(() => {
        const qrCanvas = qrDiv.querySelector('canvas');
        const qrDataUrl = qrCanvas.toDataURL('image/png');
        document.body.removeChild(qrDiv);
        const W = 400, PAD = 16;
        const compCanvas = document.createElement('canvas');
        const ctx = compCanvas.getContext('2d');
        const logoImg = new Image();
        const qrImg   = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = D1_LOGO;
        logoImg.onload = () => {
            qrImg.onload = () => {
                const logoH = 50, infoH = 70, qrH = 280, footH = 24;
                const totalH = PAD + logoH + 8 + infoH + 8 + qrH + 8 + footH + PAD;
                compCanvas.width = W; compCanvas.height = totalH;
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, totalH);
                ctx.strokeStyle = '#e30613'; ctx.lineWidth = 3;
                ctx.strokeRect(2, 2, W-4, totalH-4);
                ctx.fillStyle = '#e30613'; ctx.fillRect(2, 2, W-4, logoH + PAD + 4);
                const logoW = logoImg.width * (logoH / logoImg.height);
                ctx.drawImage(logoImg, (W - logoW)/2, PAD, logoW, logoH);
                let y = PAD + logoH + 8 + 4;
                ctx.fillStyle = '#111'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
                const eqLabel = (e?.tipo ? e.tipo + ' · ' : '') + (e?.nombre || ((e?.marca||'') + ' ' + (e?.modelo||'')));
                ctx.fillText(eqLabel, W/2, y + 16);
                ctx.font = '12px Arial'; ctx.fillStyle = '#444';
                ctx.fillText('📍 ' + (e?.ubicacion||''), W/2, y + 34);
                ctx.fillText('🏭 ' + (c?.nombre||''), W/2, y + 50);
                if (e?.serie) { ctx.font = '10px Arial'; ctx.fillStyle = '#888'; ctx.fillText('Serie: '+e.serie, W/2, y+64); }
                y = PAD + logoH + 8 + 4 + infoH + 8;
                ctx.drawImage(qrImg, (W-280)/2, y, 280, 280);
                y += 280 + 8;
                ctx.font = '10px Arial'; ctx.fillStyle = '#888';
                ctx.fillText('Escanea para ver historial y contactar soporte', W/2, y + 14);
                const compositeUrl = compCanvas.toDataURL('image/png');
                showModal(`<div class="modal" style="max-width:360px;">
                    <div class="modal-h"><h3>📱 Codigo QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
                    <div class="modal-b" style="text-align:center;">
                        <img src="${compositeUrl}" style="width:100%;border-radius:8px;border:2px solid #e30613;">
                        <a href="${compositeUrl}" download="QR_${e?.nombre||e?.marca}_${e?.modelo||''}.png" class="btn btn-blue btn-full" style="margin-top:8px;">⬇️ Descargar QR</a>
                    </div>
                </div>`);
            };
            qrImg.src = qrDataUrl;
        };
        logoImg.onerror = () => {
            showModal(`<div class="modal" style="max-width:340px;">
                <div class="modal-h"><h3>📱 Codigo QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
                <div class="modal-b" style="text-align:center;">
                    <img src="${qrDataUrl}" style="width:100%;">
                    <a href="${qrDataUrl}" download="QR.png" class="btn btn-blue btn-full" style="margin-top:8px;">⬇️ Descargar QR</a>
                </div>
            </div>`);
        };
    }, 200);
}

// ─────────────────────────────────────────────
// ── RUTA QR ──
// ─────────────────────────────────────────────
function manejarRutaQR() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/equipo/')) return false;
    const eid = hash.replace('#/equipo/', '');
    const e   = getEq(eid);
    if (!e) return false;
    const c  = getCl(e.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const main   = document.getElementById('mainContent');
    const topbar = document.querySelector('.topbar');
    const botnav = document.querySelector('.botnav');
    if (topbar) topbar.style.display = 'none';
    if (botnav) botnav.style.display = 'none';
    main.style.background = 'white';
    main.innerHTML = `<div style="max-width:600px;margin:0 auto;padding:1.5rem;">
        <div style="text-align:center;margin-bottom:0.75rem;">
            <img src="${D1_LOGO}" style="height:56px;" onerror="this.style.display='none'">
        </div>
        <div style="background:#e30613;border-radius:14px;padding:14px;color:white;text-align:center;margin-bottom:0.75rem;">
            <div style="font-size:0.85rem;">CEDI ${c?.ciudad || ''} · Mantenimiento</div>
            <div style="font-size:1rem;font-weight:700;">${c?.nombre || ''}</div>
        </div>
        <div style="border:1px solid #ccc;border-radius:12px;padding:1rem;margin-bottom:0.75rem;">
            <h3 style="margin:0 0 6px;">${e.nombre || ((e.marca||'') + ' ' + (e.modelo||''))}</h3>
            <p style="margin:2px 0;">📍 ${e.ubicacion}</p>
            <p style="margin:2px 0;">🏭 ${c?.nombre || ''}</p>
            <p style="margin:2px 0;font-size:0.8rem;color:#888;">Serie: ${e.serie || 'N/A'}</p>
        </div>
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

// ─────────────────────────────────────────────
// ── CARGAR DATOS ──
// ─────────────────────────────────────────────
async function cargarDatos() {
    try {
        const [cs, es, ss, ts] = await Promise.all([
            getDocs(query(collection(db, 'clientes'), orderBy('nombre'))),
            getDocs(collection(db, 'equipos')),
            getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc'))),
            getDocs(collection(db, 'tecnicos')),
        ]);
        clientes  = cs.docs.map(d => ({ id: d.id, ...d.data() }));
        equipos   = es.docs.map(d => ({ id: d.id, ...d.data() }));
        servicios = ss.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos  = ts.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(err) {
        console.error('Error cargando datos:', err);
        toast('⚠️ Error de conexion con Firebase');
    }
}

// ─────────────────────────────────────────────
// ── SEMBRAR DATOS INICIALES ──
// ─────────────────────────────────────────────
async function sembrarDatos() {
    const snap = await getDocs(collection(db, 'tecnicos'));
    if (!snap.empty) return;
    toast('⚙️ Configurando app por primera vez...');

    // CEDI inicial: Ibague Regional 3
    const cediRef = await addDoc(collection(db, 'clientes'), {
        nombre:      'CEDI Ibague',
        ciudad:      'Ibague',
        departamento:'Tolima',
        regional:    3,
        direccion:   'Zona Industrial, Ibague',
        coordinador: 'Coordinador CEDI',
        telefono:    '3000000000',
        fechaCreacion: hoy()
    });

    // Activo demo
    await addDoc(collection(db, 'equipos'), {
        clienteId:   cediRef.id,
        nombre:      'Montacargas 01',
        tipo:        'Montacargas electrico',
        marca:       'Toyota',
        modelo:      '8FBE18',
        serie:       'MTC-2023-001',
        ubicacion:   'Zona de cargue',
        estado:      'operativo',
        fechaRegistro: hoy()
    });

    // Tecnico coordinador
    await addDoc(collection(db, 'tecnicos'), {
        nombre:        'Coordinador CEDI Ibague',
        tipoDoc:       'CC',
        cedula:        '0000001',
        cargo:         'Coordinador de CEDI',
        rol:           'coordinador',
        telefono:      '3000000000',
        regional:      3,
        especialidades: [],
        clave:         '1234',
        cediId:        'ibague'
    });

    toast('✅ App configurada. Cedula: 0000001 · Clave: 1234');
}

// ─────────────────────────────────────────────
// ── GLOBALS ──
// ─────────────────────────────────────────────
window.goTo               = goTo;
window.closeModal         = closeModal;
window.filtrarCedis       = filtrarCedis;
window.filtrarActivos     = filtrarActivos;
window.aplicarFiltros     = aplicarFiltros;
window.limpiarFiltros     = limpiarFiltros;
window.abrirLogin         = abrirLogin;
window.mlPin              = mlPin;
window.mlDel              = mlDel;
window.mlLogin            = mlLogin;
window.cerrarSesion       = cerrarSesion;
window.onTipoChange       = onTipoChange;
window.modalNuevoCedi     = modalNuevoCedi;
window.modalEditarCedi    = modalEditarCedi;
window.modalEliminarCedi  = modalEliminarCedi;
window.guardarCedi        = guardarCedi;
window.actualizarCedi     = actualizarCedi;
window.modalNuevoEquipo   = modalNuevoEquipo;
window.modalEditarEquipo  = modalEditarEquipo;
window.modalEliminarEquipo= modalEliminarEquipo;
window.guardarEquipo      = guardarEquipo;
window.actualizarEquipo   = actualizarEquipo;
window.modalNuevoServicio = modalNuevoServicio;
window.modalEditarServicio= modalEditarServicio;
window.guardarServicio    = guardarServicio;
window.actualizarServicio = actualizarServicio;
window.eliminarServicio   = eliminarServicio;
window.modalNuevoTecnico  = modalNuevoTecnico;
window.modalEditarTecnico = modalEditarTecnico;
window.guardarTecnico     = guardarTecnico;
window.actualizarTecnico  = actualizarTecnico;
window.eliminarTecnico    = eliminarTecnico;
window.modalRecordar      = modalRecordar;
window.enviarWhatsApp     = enviarWhatsApp;
window.generarInformePDF  = generarInformePDF;
window.modalQR            = modalQR;
window.previewFoto        = previewFoto;
window.borrarFoto         = borrarFoto;

// ─────────────────────────────────────────────
// ── NAV BUTTONS ──
// ─────────────────────────────────────────────
document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        const page     = btn.dataset.page;
        const protegidas = ['cedis','detalle','historial','activos','agenda'];
        if (!sesionActual && protegidas.includes(page)) {
            toast('🔒 Inicia sesion desde Tecnicos');
            return;
        }
        selectedCediId   = null;
        selectedEquipoId = null;
        goTo(page);
    });
});

// ─────────────────────────────────────────────
// ── INIT ──
// ─────────────────────────────────────────────
(async () => {
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando D1 Mantenimiento...</p></div>`;
    await sembrarDatos();
    await cargarDatos();
    if (!manejarRutaQR()) renderView();
})();
