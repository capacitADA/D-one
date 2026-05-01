// ============================================
// D1 · CEDI IBAGUÉ — App Coordinador
// Versión 1.0 — Firebase + Firestore
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, deleteDoc,
    doc, updateDoc, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── FIREBASE CONFIG ──
// ⚠️ Reemplaza con tu proyecto Firebase para D1 CEDI Ibagué
const firebaseConfig = {
  apiKey: "AIzaSyDw1faNff7uMXR6JbHOhZa7eA5WiiNAJNw",
  authDomain: "donecapacitada-4fa37.firebaseapp.com",
  projectId: "donecapacitada-4fa37",
  storageBucket: "donecapacitada-4fa37.firebasestorage.app",
  messagingSenderId: "449540711283",
  appId: "1:449540711283:web:01efe4696daafc4e215b06"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ── DATOS GLOBALES ──
let equiposCedi = [];  // activos del CEDI
let tecnicos = [];
let serviciosCedi = [];  // historial de mantenimientos del CEDI

// ── REGIONALES (escalable) ──
// De momento numeradas; se ingresarán los nombres reales posteriormente
const REGIONALES = [
    { num: 1, nombre: 'Regional 1', descripcion: 'Por definir' },
    { num: 2, nombre: 'Regional 2', descripcion: 'Por definir' },
    { num: 3, nombre: 'Regional 3', descripcion: 'Por definir' },
    { num: 4, nombre: 'Regional 4', descripcion: 'Por definir' },
    { num: 5, nombre: 'Regional 5', descripcion: 'Por definir' },
];

// Regional asignada a este CEDI
const CEDI_INFO = {
    nombre: 'CEDI Ibagué',
    ciudad: 'Ibagué',
    departamento: 'Tolima',
    regional: 3,  // número de regional asignada
    direccion: 'Calle ejemplo # 00 - 00, Zona Industrial',
    coordinador: '',  // se llena con la sesión
    telefono: '',
};

const TIPOS_EQUIPO_CEDI = [
    'Montacargas eléctrico',
    'Estibador eléctrico',
    'Banda transportadora',
    'Compresor',
    'Sistema de refrigeración',
    'UPS / Planta eléctrica',
    'Equipo de cómputo / Red',
    'Báscula industrial',
    'Sistema contra incendios',
    'Luminaria industrial',
    'Otro',
];

const ESTADOS_EQUIPO = [
    { id: 'operativo', label: 'Operativo', cls: 'ok' },
    { id: 'revision', label: 'En revisión', cls: 'warn' },
    { id: 'fuera', label: 'Fuera de servicio', cls: 'error' },
];

const TIPOS_SERVICIO = ['Mantenimiento preventivo', 'Mantenimiento correctivo', 'Instalación', 'Inspección'];

const TIPOS_DOC = ['CC', 'CE', 'PA', 'NIT', 'TI'];

const ESPECIALIDADES = [
    { id: 'electrico', label: 'Electricista' },
    { id: 'mecanico', label: 'Mecánico' },
    { id: 'refrigeracion', label: 'Refrigeración' },
    { id: 'electronico', label: 'Electrónico' },
    { id: 'planta', label: 'Plantas eléctricas' },
    { id: 'redes', label: 'Redes / Cómputo' },
    { id: 'civil', label: 'Civil / Locativo' },
];

// ── ESTADO ──
let currentView = 'panel';
let sesionActual = null;
let selectedEquipoId = null;
let fotosNuevas = [null, null, null];
let mlPinActual = '';

// ── HELPERS ──
const getEq = id => equiposCedi.find(e => e.id === id);
const getTec = id => tecnicos.find(t => t.id === id);
const getServEq = eid => serviciosCedi.filter(s => s.equipoId === eid);

function fmtFecha(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES');
}

function fmtFechaLarga(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function hoy() {
    return new Date().toISOString().split('T')[0];
}

function esAdmin() { return sesionActual?.rol === 'admin' || sesionActual?.rol === 'coordinador'; }

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
        r.innerHTML = `<span style="font-size:0.72rem;color:#666;">Sin sesión</span>`;
    } else {
        const ini = sesionActual.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        r.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <div class="topbar-avatar">${ini}</div>
                <div>
                    <div class="topbar-name">${sesionActual.nombre.split(' ')[0]}</div>
                    <div style="font-size:0.62rem;color:var(--red);font-weight:700;">${sesionActual.rol?.toUpperCase()}</div>
                </div>
                <button class="topbar-salir" onclick="cerrarSesion()">Salir</button>
            </div>`;
    }
}

function cerrarSesion() {
    sesionActual = null;
    actualizarTopbar();
    goTo('panel');
    toast('👋 Sesión cerrada');
}

// ── NAVEGACIÓN ──
function goTo(view, eid = null) {
    currentView = view;
    selectedEquipoId = eid;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'historialEq' && b.dataset.page === 'activos')
        );
    });
}

function renderView() {
    const protegidas = ['cedi', 'activos', 'agenda'];
    if (!sesionActual && protegidas.includes(currentView)) {
        currentView = 'panel';
    }
    const main = document.getElementById('mainContent');
    switch (currentView) {
        case 'panel':       main.innerHTML = renderPanel(); break;
        case 'cedi':        main.innerHTML = renderCedi(); break;
        case 'tiendas':     main.innerHTML = renderTiendas(); break;
        case 'activos':     main.innerHTML = renderActivos(); break;
        case 'historialEq': main.innerHTML = renderHistorialEq(); break;
        case 'agenda':      main.innerHTML = renderAgenda(); break;
        case 'tecnicos':    main.innerHTML = renderTecnicos(); break;
        default:            main.innerHTML = renderPanel();
    }
}

// ─────────────────────────────────────────────
// ── PANEL ──
// ─────────────────────────────────────────────
function renderPanel() {
    const totalEq = equiposCedi.length;
    const operativos = equiposCedi.filter(e => (e.estado || 'operativo') === 'operativo').length;
    const revision = equiposCedi.filter(e => e.estado === 'revision').length;
    const fueraServ = equiposCedi.filter(e => e.estado === 'fuera').length;

    const hoyStr = hoy();
    const proximos = serviciosCedi
        .filter(s => s.proximoMantenimiento && s.proximoMantenimiento >= hoyStr)
        .sort((a, b) => a.proximoMantenimiento.localeCompare(b.proximoMantenimiento))
        .slice(0, 4);

    const ultimosServ = [...serviciosCedi]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 3);

    return `<div class="page">
        <div class="hero">
            <div class="hero-label">Coordinador · CEDI</div>
            <div class="hero-title">Centro de<br>Distribución D1</div>
            <div class="hero-sub">📍 Ibagué, Tolima · Regional ${CEDI_INFO.regional}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-val">${totalEq}</div>
                <div class="stat-label">Activos registrados</div>
            </div>
            <div class="stat-card">
                <div class="stat-val red">${fueraServ + revision}</div>
                <div class="stat-label">Requieren atención</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">${operativos}</div>
                <div class="stat-label">Operativos</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">${serviciosCedi.length}</div>
                <div class="stat-label">Servicios históricos</div>
            </div>
        </div>

        ${proximos.length ? `
        <div class="sec-head">
            <h2>Próximos mantenimientos</h2>
        </div>
        <div class="card" style="padding:0;overflow:hidden;">
            ${proximos.map(s => {
                const e = getEq(s.equipoId);
                const diasDiff = Math.round((new Date(s.proximoMantenimiento) - new Date(hoyStr)) / 86400000);
                const urgente = diasDiff <= 7;
                return `<div class="act-item" style="padding:0.7rem 1rem;">
                    <div class="act-dot ${urgente ? 'red' : 'amber'}"></div>
                    <div style="flex:1;">
                        <div style="font-size:0.85rem;font-weight:600;">${e?.nombre || e?.marca + ' ' + e?.modelo || 'Equipo'}</div>
                        <div style="font-size:0.75rem;color:var(--text3);">${fmtFecha(s.proximoMantenimiento)} · ${diasDiff === 0 ? 'Hoy' : `en ${diasDiff} días`}</div>
                    </div>
                    ${urgente ? `<span class="badge b-red">Urgente</span>` : `<span class="badge b-amber">Próximo</span>`}
                </div>`;
            }).join('')}
        </div>` : ''}

        ${ultimosServ.length ? `
        <div class="sec-head" style="margin-top:0.5rem;">
            <h2>Última actividad</h2>
        </div>
        <div class="card" style="padding:0;overflow:hidden;">
            ${ultimosServ.map(s => {
                const e = getEq(s.equipoId);
                return `<div class="act-item" style="padding:0.7rem 1rem;">
                    <div class="act-dot green"></div>
                    <div style="flex:1;">
                        <div style="font-size:0.85rem;font-weight:600;">${s.tipo}</div>
                        <div style="font-size:0.75rem;color:var(--text3);">${e?.nombre || 'Equipo'} · ${fmtFecha(s.fecha)}</div>
                        <div style="font-size:0.75rem;color:var(--text2);">${s.tecnico}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>` : `
        <div class="empty">
            <div class="empty-icon">📋</div>
            <p>Sin actividad registrada aún</p>
        </div>`}

        ${!sesionActual ? `
        <div class="card" style="text-align:center;margin-top:1rem;">
            <p style="font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem;">Inicia sesión para acceder a todas las funciones</p>
            <button class="btn btn-red btn-full" onclick="goTo('tecnicos')">🔑 Iniciar sesión</button>
        </div>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────
// ── CEDI ──
// ─────────────────────────────────────────────
function renderCedi() {
    const regional = REGIONALES.find(r => r.num === CEDI_INFO.regional) || {};
    return `<div class="page">
        <div class="cedi-hero">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <div class="cedi-name">CEDI Ibagué</div>
                    <div class="cedi-loc">📍 Ibagué · Tolima</div>
                    <div class="cedi-info">${CEDI_INFO.direccion}</div>
                </div>
                <div class="cedi-tag">Regional ${CEDI_INFO.regional}</div>
            </div>
        </div>

        <div class="sec-head">
            <h2>Información del CEDI</h2>
        </div>

        <div class="card">
            <div class="card-title">Centro de Distribución</div>
            <div class="card-meta">Ciudad: <strong>Ibagué, Tolima</strong></div>
            <div class="card-meta">Dirección: ${CEDI_INFO.direccion}</div>
            <div class="card-meta">Operador logístico: D1 S.A.S.</div>
        </div>

        <div class="card">
            <div class="card-title">Coordinador asignado</div>
            <div class="card-meta">${sesionActual ? sesionActual.nombre : '— Sin sesión activa —'}</div>
            ${sesionActual ? `<div class="card-meta">📞 ${sesionActual.telefono || 'Sin teléfono'}</div>` : ''}
            ${sesionActual ? `<span class="rol-badge rol-coord">${sesionActual.rol}</span>` : ''}
        </div>

        <div class="sec-head" style="margin-top:0.5rem;">
            <h2>Regionales</h2>
        </div>
        <p style="font-size:0.78rem;color:var(--text3);margin-bottom:0.75rem;">Escalable — los nombres de regionales serán asignados posteriormente.</p>

        ${REGIONALES.map(r => `
        <div class="regional-row ${r.num === CEDI_INFO.regional ? 'style="border-color:var(--red);border-width:2px;"' : ''}">
            <div class="regional-num">${r.num}</div>
            <div style="flex:1;">
                <div class="regional-name">${r.nombre}</div>
                <div class="regional-sub">${r.descripcion}</div>
            </div>
            ${r.num === CEDI_INFO.regional ? `<span class="badge b-red">Este CEDI</span>` : ''}
        </div>`).join('')}

        <div style="margin-top:1rem;" class="card">
            <div class="card-title" style="margin-bottom:0.5rem;">Resumen de activos</div>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                ${ESTADOS_EQUIPO.map(est => {
                    const count = equiposCedi.filter(e => (e.estado || 'operativo') === est.id).length;
                    return `<div style="text-align:center;">
                        <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;${est.id==='operativo'?'color:var(--green)':est.id==='revision'?'color:var(--amber)':'color:var(--red)'}">${count}</div>
                        <div style="font-size:0.7rem;color:var(--text3);">${est.label}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>

        ${esAdmin() ? `
        <div class="sec-head" style="margin-top:0.5rem;">
            <h2>Editar CEDI</h2>
        </div>
        <div class="card">
            <p style="font-size:0.8rem;color:var(--text3);">Funcionalidad de configuración disponible para coordinadores. Próximamente podrás editar dirección, regional y datos del CEDI.</p>
            <button class="btn btn-ghost btn-sm btn-full" style="margin-top:0.75rem;" onclick="toast('⚙️ Próximamente')">⚙️ Configurar CEDI</button>
        </div>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────
// ── TIENDAS (vacío por ahora) ──
// ─────────────────────────────────────────────
function renderTiendas() {
    return `<div class="page">
        <div class="sec-head"><h2>Tiendas</h2></div>
        <div class="coming-soon">
            <div class="cs-icon">🏪</div>
            <div class="cs-title">Módulo de Tiendas</div>
            <p style="font-size:0.82rem;line-height:1.6;">Este módulo estará disponible próximamente.<br>Aquí podrás gestionar las tiendas asociadas al CEDI Ibagué y su regional.</p>
            <div style="margin-top:1.5rem;padding:1rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);width:100%;max-width:320px;">
                <div style="font-size:0.72rem;color:var(--text3);font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Funciones planificadas</div>
                ${['Listado de tiendas por regional', 'Datos de coordinadores de tienda', 'Historial de visitas', 'Contacto directo por WhatsApp', 'Mapa de cobertura'].map(f => `
                <div style="font-size:0.8rem;color:var(--text2);padding:4px 0;border-bottom:1px solid var(--border);">· ${f}</div>`).join('')}
            </div>
        </div>
    </div>`;
}

// ─────────────────────────────────────────────
// ── ACTIVOS (exclusivo CEDI) ──
// ─────────────────────────────────────────────
function renderActivos() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Activos CEDI (${equiposCedi.length})</h2>
            ${esAdmin() ? `<button class="btn btn-red btn-sm" onclick="modalNuevoEquipo()">+ Nuevo</button>` : ''}
        </div>
        <input class="search" placeholder="🔍 Buscar activo..." oninput="filtrarActivos(this.value)" id="searchEq">
        <div id="activosGrid">
        ${equiposCedi.length === 0 ? `
        <div class="empty">
            <div class="empty-icon">📦</div>
            <p>No hay activos registrados aún.</p>
            ${esAdmin() ? `<button class="btn btn-red btn-sm" style="margin-top:0.75rem;" onclick="modalNuevoEquipo()">+ Registrar primer activo</button>` : ''}
        </div>` : equiposCedi.map(e => {
            const est = getEstado(e.estado || 'operativo');
            const servsEq = getServEq(e.id);
            const ultimo = servsEq.sort((a,b) => new Date(b.fecha)-new Date(a.fecha))[0];
            return `<div class="card" data-search="${(e.nombre+e.marca+e.modelo+e.tipo+e.serie).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="flex:1;">
                        <div class="card-title">${e.nombre || (e.marca + ' ' + e.modelo)}</div>
                        <div class="card-meta">${e.tipo}</div>
                        <div class="card-meta">📍 ${e.ubicacion || 'Sin ubicación'}</div>
                        ${e.serie ? `<div class="card-meta" style="font-size:0.72rem;">Serie: ${e.serie}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <span class="badge ${est.cls === 'ok' ? 'b-green' : est.cls === 'warn' ? 'b-amber' : 'b-red'}">${est.label}</span>
                        ${ultimo ? `<div style="font-size:0.68rem;color:var(--text3);margin-top:4px;">Ult. serv: ${fmtFecha(ultimo.fecha)}</div>` : ''}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-ghost btn-sm" onclick="goTo('historialEq','${e.id}')">📋 Historial (${servsEq.length})</button>
                    ${esAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="modalNuevoServicio('${e.id}')">➕ Servicio</button>` : ''}
                    ${esAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="modalEditarEquipo('${e.id}')">✏️</button>` : ''}
                    ${esAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="modalEliminarEquipo('${e.id}')">🗑️</button>` : ''}
                </div>
            </div>`;
        }).join('')}
        </div>
    </div>`;
}

function filtrarActivos(v) {
    document.querySelectorAll('#activosGrid .card').forEach(c => {
        c.style.display = (c.dataset.search || '').includes(v.toLowerCase()) ? '' : 'none';
    });
}

// Historial de un equipo
function renderHistorialEq() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('activos'); return ''; }
    const est = getEstado(e.estado || 'operativo');
    const ss = getServEq(e.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('activos')">← Volver</button>
            <div>
                <div class="card-title">${e.nombre || e.marca + ' ' + e.modelo}</div>
                <div class="card-meta">${e.tipo} · 📍 ${e.ubicacion || '—'}</div>
            </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:1rem;">
            <span class="badge ${est.cls === 'ok' ? 'b-green' : est.cls === 'warn' ? 'b-amber' : 'b-red'}">${est.label}</span>
            ${e.serie ? `<span class="badge b-gray">Serie: ${e.serie}</span>` : ''}
            ${e.marca ? `<span class="badge b-gray">${e.marca} ${e.modelo}</span>` : ''}
        </div>
        <div class="sec-head">
            <h2>Historial (${ss.length})</h2>
            ${esAdmin() ? `<button class="btn btn-red btn-sm" onclick="modalNuevoServicio('${e.id}')">+ Servicio</button>` : ''}
        </div>
        ${ss.length === 0 ? `<div class="empty"><div class="empty-icon">📝</div><p>Sin servicios registrados.</p></div>` :
        ss.map(s => `<div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                <span class="badge ${s.tipo.includes('preventivo') ? 'b-blue' : s.tipo.includes('correctivo') ? 'b-red' : s.tipo.includes('Instalación') ? 'b-green' : 'b-gray'}">${s.tipo}</span>
                <span style="font-size:0.75rem;color:var(--text3);">${fmtFecha(s.fecha)}</span>
            </div>
            <div class="card-meta">🔧 ${s.tecnico}</div>
            <div style="font-size:0.85rem;color:var(--text);margin-top:4px;line-height:1.5;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div class="card-meta" style="color:var(--amber);margin-top:4px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            ${(s.fotos || []).length ? `<div class="foto-strip">${s.fotos.map(f => `<img class="fthumb" src="${f}" loading="lazy">`).join('')}</div>` : ''}
            ${esAdmin() ? `<div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;">
                <button class="btn btn-ghost btn-sm" onclick="modalEliminarServicio('${s.id}')">🗑️ Eliminar</button>
            </div>` : ''}
        </div>`).join('')}
    </div>`;
}

// ─────────────────────────────────────────────
// ── AGENDA (exclusivo CEDI) ──
// ─────────────────────────────────────────────
function renderAgenda() {
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const año = new Date().getFullYear();
    const mant = serviciosCedi.filter(s => s.proximoMantenimiento);

    const tieneAlgo = mant.length > 0;

    return `<div class="page">
        <div class="sec-head"><h2>Agenda ${año}</h2></div>
        ${!tieneAlgo ? `<div class="empty"><div class="empty-icon">📅</div><p>No hay mantenimientos programados.</p></div>` :
        `<div class="tbl-wrap">
            <table>
                <thead><tr><th>Mes</th><th>Fecha</th><th>Activo</th><th>Técnico</th><th></th></tr></thead>
                <tbody>
                ${MESES.map((mes, idx) => {
                    const mp = String(idx + 1).padStart(2, '0');
                    const lista = mant.filter(m => m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                    if (!lista.length) return `<tr><td style="color:var(--text3);font-size:0.78rem;">${mes}</td><td colspan="4" style="color:var(--border2);">—</td></tr>`;
                    return lista.map((m, i) => {
                        const e = getEq(m.equipoId);
                        const hoyStr = hoy();
                        const vencido = m.proximoMantenimiento < hoyStr;
                        const urgente = !vencido && Math.round((new Date(m.proximoMantenimiento) - new Date(hoyStr)) / 86400000) <= 7;
                        return `<tr>
                            ${i === 0 ? `<td rowspan="${lista.length}" style="font-weight:700;font-size:0.78rem;background:var(--surface2);white-space:nowrap;">${mes}</td>` : ''}
                            <td>
                                ${vencido ? `<span class="badge b-red">Vencido</span><br>` : urgente ? `<span class="badge b-amber">Pronto</span><br>` : ''}
                                <span style="font-size:0.78rem;">${fmtFecha(m.proximoMantenimiento)}</span>
                            </td>
                            <td style="font-size:0.78rem;">${e ? (e.nombre || e.marca + ' ' + e.modelo) : 'N/A'}</td>
                            <td style="font-size:0.78rem;">${m.tecnico || '—'}</td>
                            <td>
                                <button class="btn btn-ghost btn-sm" onclick="goTo('historialEq','${e?.id}')" ${!e ? 'disabled' : ''}>Ver</button>
                            </td>
                        </tr>`;
                    }).join('');
                }).join('')}
                </tbody>
            </table>
        </div>`}
    </div>`;
}

// ─────────────────────────────────────────────
// ── TÉCNICOS ──
// ─────────────────────────────────────────────
function renderTecnicos() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Técnicos (${tecnicos.length})</h2>
            ${esAdmin() ? `<button class="btn btn-red btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>` : ''}
        </div>
        ${tecnicos.map(t => {
            const esps = (t.especialidades || []).map(id => ESPECIALIDADES.find(e => e.id === id)?.label || id);
            const rolCls = t.rol === 'admin' ? 'rol-admin' : t.rol === 'coordinador' ? 'rol-coord' : 'rol-tec';
            return `<div class="card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <div class="card-title">${t.nombre}</div>
                        <div class="card-meta">${t.tipoDoc}: ${t.cedula}</div>
                        <div class="card-meta">${t.cargo || 'Sin cargo'}</div>
                        <div class="card-meta">📞 ${t.telefono || '—'}</div>
                        ${t.regional ? `<div class="card-meta">🗺️ Regional ${t.regional}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <span class="rol-badge ${rolCls}">${t.rol}</span>
                        ${esAdmin() ? `<div style="display:flex;gap:4px;margin-top:8px;justify-content:flex-end;">
                            <button class="btn btn-ghost btn-sm" onclick="modalEditarTecnico('${t.id}')">✏️</button>
                            <button class="btn btn-ghost btn-sm" onclick="eliminarTecnico('${t.id}')">🗑️</button>
                        </div>` : ''}
                    </div>
                </div>
                ${esps.length ? `<div style="margin-top:8px;">${esps.map(e => `<span class="chip">${e}</span>`).join('')}</div>` : ''}
                <button class="btn btn-dark btn-sm btn-full" style="margin-top:0.65rem;" onclick="abrirLogin('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button>
            </div>`;
        }).join('')}
        ${tecnicos.length === 0 ? `<div class="empty"><div class="empty-icon">👷</div><p>Sin técnicos registrados.</p></div>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────
// ── MODALES ──
// ─────────────────────────────────────────────

// ── LOGIN PIN ──
function abrirLogin(tid) {
    mlPinActual = '';
    const t = getTec(tid);
    showModal(`<div class="modal">
        <div class="modal-h">
            <h3>🔑 Ingresar</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <div style="font-weight:700;margin-bottom:4px;">${t.nombre}</div>
            <div class="card-meta" style="margin-bottom:12px;">${t.cargo || t.rol}</div>
            <label class="fl">Cédula</label>
            <input class="fi" id="mlCedula" type="number" placeholder="Tu número de cédula">
            <label class="fl">Clave (4 dígitos)</label>
            <div class="pin-display">
                <div class="pin-digit active" id="mlpd0"></div>
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
        else if (i === mlPinActual.length) { d.textContent = ''; d.classList.add('active'); }
        else { d.textContent = ''; }
    }
}

function mlLogin(tid) {
    const t = getTec(tid);
    const cedula = document.getElementById('mlCedula')?.value?.trim();
    const msg = document.getElementById('mlMsg');
    if (!cedula) { if (msg) msg.innerHTML = `<div class="login-warn">⚠️ Ingresa tu cédula</div>`; return; }
    if (mlPinActual.length < 4) { if (msg) msg.innerHTML = `<div class="login-warn">⚠️ Clave de 4 dígitos</div>`; return; }
    if (t.cedula !== cedula || t.clave !== mlPinActual) {
        if (msg) msg.innerHTML = `<div class="login-error">❌ Credenciales incorrectas</div>`;
        mlPinActual = ''; mlUpdateDisplay(); return;
    }
    sesionActual = t;
    mlPinActual = '';
    closeModal();
    actualizarTopbar();
    currentView = 'panel';
    renderView();
    toast(`✅ Bienvenido, ${t.nombre.split(' ')[0]}`);
}

// ── NUEVO EQUIPO ──
function modalNuevoEquipo() {
    if (!esAdmin()) { toast('🔒 Solo coordinadores pueden registrar activos'); return; }
    showModal(`<div class="modal modal-wide">
        <div class="modal-h">
            <h3>📦 Nuevo Activo CEDI</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <label class="fl">Nombre / Descripción del activo *</label>
            <input class="fi" id="eqNombre" placeholder="Ej: Montacargas 01">
            <label class="fl">Tipo de activo *</label>
            <select class="fi" id="eqTipo">
                ${TIPOS_EQUIPO_CEDI.map(t => `<option>${t}</option>`).join('')}
            </select>
            <div class="fr">
                <div><label class="fl">Marca</label><input class="fi" id="eqMarca" placeholder="Marca"></div>
                <div><label class="fl">Modelo</label><input class="fi" id="eqModelo" placeholder="Modelo"></div>
            </div>
            <label class="fl">Número de serie</label>
            <input class="fi" id="eqSerie" placeholder="Serial del equipo">
            <label class="fl">Ubicación dentro del CEDI</label>
            <input class="fi" id="eqUbicacion" placeholder="Ej: Zona de cargue, Bodega 2...">
            <label class="fl">Estado inicial</label>
            <select class="fi" id="eqEstado">
                ${ESTADOS_EQUIPO.map(e => `<option value="${e.id}">${e.label}</option>`).join('')}
            </select>
            <label class="fl">Fecha de adquisición</label>
            <input class="fi" type="date" id="eqFechaAdq" value="${hoy()}">
            <label class="fl">Observaciones</label>
            <textarea class="fi" id="eqObs" rows="2" placeholder="Notas adicionales..."></textarea>
            <div class="modal-foot">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="guardarEquipo()">✅ Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarEquipo() {
    const nombre = document.getElementById('eqNombre')?.value?.trim();
    if (!nombre) { toast('⚠️ El nombre es obligatorio'); return; }
    try {
        await addDoc(collection(db, 'equipos_cedi'), {
            nombre,
            tipo: document.getElementById('eqTipo')?.value || '',
            marca: document.getElementById('eqMarca')?.value?.trim() || '',
            modelo: document.getElementById('eqModelo')?.value?.trim() || '',
            serie: document.getElementById('eqSerie')?.value?.trim() || '',
            ubicacion: document.getElementById('eqUbicacion')?.value?.trim() || '',
            estado: document.getElementById('eqEstado')?.value || 'operativo',
            fechaAdquisicion: document.getElementById('eqFechaAdq')?.value || hoy(),
            observaciones: document.getElementById('eqObs')?.value?.trim() || '',
            fechaRegistro: hoy(),
            cediId: 'ibague',
        });
        closeModal();
        await cargarDatos();
        goTo('activos');
        toast('✅ Activo registrado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

// ── EDITAR EQUIPO ──
function modalEditarEquipo(eid) {
    const e = getEq(eid);
    if (!e) return;
    showModal(`<div class="modal modal-wide">
        <div class="modal-h">
            <h3>✏️ Editar Activo</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <label class="fl">Nombre</label>
            <input class="fi" id="eqNombreE" value="${e.nombre || ''}">
            <label class="fl">Tipo</label>
            <select class="fi" id="eqTipoE">
                ${TIPOS_EQUIPO_CEDI.map(t => `<option ${t === e.tipo ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <div class="fr">
                <div><label class="fl">Marca</label><input class="fi" id="eqMarcaE" value="${e.marca || ''}"></div>
                <div><label class="fl">Modelo</label><input class="fi" id="eqModeloE" value="${e.modelo || ''}"></div>
            </div>
            <label class="fl">Serie</label>
            <input class="fi" id="eqSerieE" value="${e.serie || ''}">
            <label class="fl">Ubicación</label>
            <input class="fi" id="eqUbicacionE" value="${e.ubicacion || ''}">
            <label class="fl">Estado</label>
            <select class="fi" id="eqEstadoE">
                ${ESTADOS_EQUIPO.map(est => `<option value="${est.id}" ${est.id === e.estado ? 'selected' : ''}>${est.label}</option>`).join('')}
            </select>
            <label class="fl">Observaciones</label>
            <textarea class="fi" id="eqObsE" rows="2">${e.observaciones || ''}</textarea>
            <div class="modal-foot">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="actualizarEquipo('${eid}')">✅ Actualizar</button>
            </div>
        </div>
    </div>`);
}

async function actualizarEquipo(eid) {
    const nombre = document.getElementById('eqNombreE')?.value?.trim();
    if (!nombre) { toast('⚠️ El nombre es obligatorio'); return; }
    try {
        await updateDoc(doc(db, 'equipos_cedi', eid), {
            nombre,
            tipo: document.getElementById('eqTipoE')?.value || '',
            marca: document.getElementById('eqMarcaE')?.value?.trim() || '',
            modelo: document.getElementById('eqModeloE')?.value?.trim() || '',
            serie: document.getElementById('eqSerieE')?.value?.trim() || '',
            ubicacion: document.getElementById('eqUbicacionE')?.value?.trim() || '',
            estado: document.getElementById('eqEstadoE')?.value || 'operativo',
            observaciones: document.getElementById('eqObsE')?.value?.trim() || '',
        });
        closeModal();
        await cargarDatos();
        renderView();
        toast('✅ Activo actualizado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

function modalEliminarEquipo(eid) {
    const e = getEq(eid);
    showModal(`<div class="modal">
        <div class="modal-h">
            <h3>🗑️ Eliminar activo</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <p style="font-size:0.9rem;margin-bottom:1rem;">¿Eliminar <strong>${e?.nombre || 'este activo'}</strong> y todo su historial? Esta acción no se puede deshacer.</p>
            <div class="modal-foot">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="confirmarEliminarEquipo('${eid}')">🗑️ Eliminar</button>
            </div>
        </div>
    </div>`);
}

async function confirmarEliminarEquipo(eid) {
    try {
        await deleteDoc(doc(db, 'equipos_cedi', eid));
        // También eliminar sus servicios
        const servsEq = getServEq(eid);
        for (const s of servsEq) {
            await deleteDoc(doc(db, 'servicios_cedi', s.id));
        }
        closeModal();
        await cargarDatos();
        goTo('activos');
        toast('✅ Activo eliminado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

// ── NUEVO SERVICIO ──
function modalNuevoServicio(eid) {
    if (!sesionActual) { toast('🔒 Debes iniciar sesión'); return; }
    const e = getEq(eid);
    showModal(`<div class="modal modal-wide">
        <div class="modal-h">
            <h3>➕ Nuevo Servicio</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:10px;font-size:0.82rem;">
                📦 <strong>${e?.nombre || e?.marca + ' ' + e?.modelo}</strong> · ${e?.ubicacion || ''}
            </div>
            <label class="fl">Tipo de servicio *</label>
            <select class="fi" id="sTipo" onchange="onTipoChange()">
                ${TIPOS_SERVICIO.map(t => `<option>${t}</option>`).join('')}
            </select>
            <label class="fl">Fecha *</label>
            <input class="fi" type="date" id="sFecha" value="${hoy()}">
            <label class="fl">Técnico responsable</label>
            <input class="fi" id="sTecnico" value="${sesionActual?.nombre || ''}" readonly>
            <label class="fl">Diagnóstico / Descripción *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Describe el trabajo realizado..."></textarea>
            <label class="fl">Repuestos o materiales utilizados</label>
            <textarea class="fi" id="sRepuestos" rows="2" placeholder="Opcional..."></textarea>
            <div id="proxMantenimientoBlock" style="display:none;">
                <label class="fl">Fecha próximo mantenimiento</label>
                <input class="fi" type="date" id="proxFecha">
            </div>
            <div class="modal-foot">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="guardarServicio('${eid}')">✅ Guardar</button>
            </div>
        </div>
    </div>`);
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value || '';
    const blk = document.getElementById('proxMantenimientoBlock');
    if (blk) blk.style.display = tipo.includes('preventivo') ? '' : 'none';
}

async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if (!desc) { toast('⚠️ El diagnóstico es obligatorio'); return; }
    const tipo = document.getElementById('sTipo').value;
    const fecha = document.getElementById('sFecha').value;
    const prox = tipo.includes('preventivo') ? (document.getElementById('proxFecha')?.value || null) : null;
    const repuestos = document.getElementById('sRepuestos')?.value?.trim() || '';
    try {
        await addDoc(collection(db, 'servicios_cedi'), {
            equipoId: eid,
            tipo,
            fecha,
            tecnico: sesionActual?.nombre || '',
            descripcion: desc,
            repuestos,
            proximoMantenimiento: prox,
            cediId: 'ibague',
            registradoPor: sesionActual?.id || '',
        });
        closeModal();
        await cargarDatos();
        goTo('historialEq', eid);
        toast('✅ Servicio guardado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

function modalEliminarServicio(sid) {
    showModal(`<div class="modal">
        <div class="modal-h">
            <h3>🗑️ Eliminar servicio</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <p style="font-size:0.9rem;margin-bottom:1rem;">¿Eliminar este registro de servicio? No se puede deshacer.</p>
            <div class="modal-foot">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="confirmarEliminarServicio('${sid}')">🗑️ Eliminar</button>
            </div>
        </div>
    </div>`);
}

async function confirmarEliminarServicio(sid) {
    try {
        await deleteDoc(doc(db, 'servicios_cedi', sid));
        closeModal();
        await cargarDatos();
        goTo('historialEq', selectedEquipoId);
        toast('✅ Servicio eliminado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

// ── NUEVO TÉCNICO ──
function modalNuevoTecnico() {
    showModal(`<div class="modal modal-wide">
        <div class="modal-h">
            <h3>👷 Nuevo Técnico</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <label class="fl">Nombre completo *</label>
            <input class="fi" id="tNombre" placeholder="Nombre y apellidos">
            <div class="fr">
                <div><label class="fl">Tipo doc</label><select class="fi" id="tTipoDoc">${TIPOS_DOC.map(t => `<option>${t}</option>`).join('')}</select></div>
                <div><label class="fl">Cédula *</label><input class="fi" id="tCedula" type="number"></div>
            </div>
            <label class="fl">Cargo</label>
            <input class="fi" id="tCargo" placeholder="Ej: Técnico de mantenimiento">
            <label class="fl">Rol</label>
            <select class="fi" id="tRol">
                <option value="tecnico">Técnico</option>
                <option value="coordinador">Coordinador</option>
                <option value="admin">Admin</option>
            </select>
            <label class="fl">Teléfono</label>
            <input class="fi" id="tTel" type="tel" placeholder="3XX XXX XXXX">
            <label class="fl">Regional (número)</label>
            <select class="fi" id="tRegional">
                <option value="">Sin regional asignada</option>
                ${REGIONALES.map(r => `<option value="${r.num}">Regional ${r.num}</option>`).join('')}
            </select>
            <label class="fl">Especialidades</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
                ${ESPECIALIDADES.map(e => `<label style="font-size:0.8rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" value="${e.id}" class="esp-check"> ${e.label}</label>`).join('')}
            </div>
            <label class="fl">Clave de acceso (4 dígitos) *</label>
            <input class="fi" id="tClave" type="password" maxlength="4" placeholder="****">
            <div class="modal-foot">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="guardarTecnico()">✅ Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarTecnico() {
    const nombre = document.getElementById('tNombre')?.value?.trim();
    const cedula = document.getElementById('tCedula')?.value?.trim();
    const clave = document.getElementById('tClave')?.value?.trim();
    if (!nombre) { toast('⚠️ El nombre es obligatorio'); return; }
    if (!cedula) { toast('⚠️ La cédula es obligatoria'); return; }
    if (!clave || clave.length !== 4) { toast('⚠️ La clave debe ser de 4 dígitos'); return; }
    const esps = [...document.querySelectorAll('.esp-check:checked')].map(c => c.value);
    const regional = document.getElementById('tRegional')?.value;
    try {
        await addDoc(collection(db, 'tecnicos'), {
            nombre,
            tipoDoc: document.getElementById('tTipoDoc')?.value || 'CC',
            cedula,
            cargo: document.getElementById('tCargo')?.value?.trim() || '',
            rol: document.getElementById('tRol')?.value || 'tecnico',
            telefono: document.getElementById('tTel')?.value?.trim() || '',
            regional: regional ? parseInt(regional) : null,
            especialidades: esps,
            clave,
            cediId: 'ibague',
        });
        closeModal();
        await cargarDatos();
        renderView();
        toast('✅ Técnico guardado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

function modalEditarTecnico(tid) {
    const t = getTec(tid);
    if (!t) return;
    showModal(`<div class="modal modal-wide">
        <div class="modal-h">
            <h3>✏️ Editar Técnico</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <label class="fl">Nombre completo</label>
            <input class="fi" id="tNombreE" value="${t.nombre}">
            <div class="fr">
                <div><label class="fl">Tipo doc</label><select class="fi" id="tTipoDocE">${TIPOS_DOC.map(td => `<option ${td === t.tipoDoc ? 'selected' : ''}>${td}</option>`).join('')}</select></div>
                <div><label class="fl">Cédula</label><input class="fi" id="tCedulaE" value="${t.cedula}"></div>
            </div>
            <label class="fl">Cargo</label>
            <input class="fi" id="tCargoE" value="${t.cargo || ''}">
            <label class="fl">Rol</label>
            <select class="fi" id="tRolE">
                <option value="tecnico" ${t.rol === 'tecnico' ? 'selected' : ''}>Técnico</option>
                <option value="coordinador" ${t.rol === 'coordinador' ? 'selected' : ''}>Coordinador</option>
                <option value="admin" ${t.rol === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            <label class="fl">Teléfono</label>
            <input class="fi" id="tTelE" value="${t.telefono || ''}">
            <label class="fl">Regional</label>
            <select class="fi" id="tRegionalE">
                <option value="">Sin regional</option>
                ${REGIONALES.map(r => `<option value="${r.num}" ${t.regional == r.num ? 'selected' : ''}>Regional ${r.num}</option>`).join('')}
            </select>
            <label class="fl">Especialidades</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
                ${ESPECIALIDADES.map(e => `<label style="font-size:0.8rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" value="${e.id}" class="esp-check-e" ${(t.especialidades || []).includes(e.id) ? 'checked' : ''}> ${e.label}</label>`).join('')}
            </div>
            <label class="fl">Nueva clave (dejar vacío para no cambiar)</label>
            <input class="fi" id="tClaveE" type="password" maxlength="4" placeholder="****">
            <div class="modal-foot">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="actualizarTecnico('${tid}')">✅ Actualizar</button>
            </div>
        </div>
    </div>`);
}

async function actualizarTecnico(tid) {
    const nombre = document.getElementById('tNombreE')?.value?.trim();
    if (!nombre) { toast('⚠️ El nombre es obligatorio'); return; }
    const esps = [...document.querySelectorAll('.esp-check-e:checked')].map(c => c.value);
    const claveNueva = document.getElementById('tClaveE')?.value?.trim();
    const regional = document.getElementById('tRegionalE')?.value;
    const updates = {
        nombre,
        tipoDoc: document.getElementById('tTipoDocE')?.value || 'CC',
        cedula: document.getElementById('tCedulaE')?.value?.trim() || '',
        cargo: document.getElementById('tCargoE')?.value?.trim() || '',
        rol: document.getElementById('tRolE')?.value || 'tecnico',
        telefono: document.getElementById('tTelE')?.value?.trim() || '',
        regional: regional ? parseInt(regional) : null,
        especialidades: esps,
    };
    if (claveNueva && claveNueva.length === 4) updates.clave = claveNueva;
    try {
        await updateDoc(doc(db, 'tecnicos', tid), updates);
        closeModal();
        await cargarDatos();
        renderView();
        toast('✅ Técnico actualizado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

async function eliminarTecnico(tid) {
    if (!esAdmin()) return;
    if (!confirm('¿Eliminar este técnico?')) return;
    try {
        await deleteDoc(doc(db, 'tecnicos', tid));
        await cargarDatos();
        renderView();
        toast('✅ Técnico eliminado');
    } catch (err) {
        toast('❌ Error: ' + err.message);
    }
}

// ─────────────────────────────────────────────
// ── CARGAR DATOS ──
// ─────────────────────────────────────────────
async function cargarDatos() {
    try {
        const [eqSnap, tecSnap, servSnap] = await Promise.all([
            getDocs(collection(db, 'equipos_cedi')),
            getDocs(collection(db, 'tecnicos')),
            getDocs(query(collection(db, 'servicios_cedi'), orderBy('fecha', 'desc'))),
        ]);
        equiposCedi = eqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos = tecSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        serviciosCedi = servSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error cargando datos:', err);
        toast('⚠️ Error de conexión con Firebase');
    }
}

// ─────────────────────────────────────────────
// ── SEMBRAR DATOS INICIALES ──
// ─────────────────────────────────────────────
async function sembrarDatos() {
    const snap = await getDocs(collection(db, 'tecnicos'));
    if (!snap.empty) return;
    toast('⚙️ Configurando app por primera vez...');
    // Coordinador inicial
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Coordinador CEDI Ibagué',
        tipoDoc: 'CC',
        cedula: '0000001',
        cargo: 'Coordinador de CEDI',
        rol: 'coordinador',
        telefono: '3000000000',
        regional: 3,
        especialidades: [],
        clave: '1234',
        cediId: 'ibague',
    });
    // Equipo demo
    await addDoc(collection(db, 'equipos_cedi'), {
        nombre: 'Montacargas 01',
        tipo: 'Montacargas eléctrico',
        marca: 'Toyota',
        modelo: '8FBE18',
        serie: 'MTC-2023-001',
        ubicacion: 'Zona de cargue',
        estado: 'operativo',
        fechaAdquisicion: '2023-01-15',
        observaciones: 'Equipo de demo inicial',
        fechaRegistro: hoy(),
        cediId: 'ibague',
    });
    toast('✅ App configurada. Cédula: 0000001 · Clave: 1234');
}

// ─────────────────────────────────────────────
// ── GLOBALS ──
// ─────────────────────────────────────────────
window.goTo = goTo;
window.closeModal = closeModal;
window.filtrarActivos = filtrarActivos;
window.abrirLogin = abrirLogin;
window.mlPin = mlPin;
window.mlDel = mlDel;
window.mlLogin = mlLogin;
window.cerrarSesion = cerrarSesion;
window.onTipoChange = onTipoChange;
window.modalNuevoEquipo = modalNuevoEquipo;
window.modalEditarEquipo = modalEditarEquipo;
window.modalEliminarEquipo = modalEliminarEquipo;
window.confirmarEliminarEquipo = confirmarEliminarEquipo;
window.guardarEquipo = guardarEquipo;
window.actualizarEquipo = actualizarEquipo;
window.modalNuevoServicio = modalNuevoServicio;
window.guardarServicio = guardarServicio;
window.modalEliminarServicio = modalEliminarServicio;
window.confirmarEliminarServicio = confirmarEliminarServicio;
window.modalNuevoTecnico = modalNuevoTecnico;
window.guardarTecnico = guardarTecnico;
window.modalEditarTecnico = modalEditarTecnico;
window.actualizarTecnico = actualizarTecnico;
window.eliminarTecnico = eliminarTecnico;

// ─────────────────────────────────────────────
// ── NAV BUTTONS ──
// ─────────────────────────────────────────────
document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        const protegidas = ['cedi', 'activos', 'agenda'];
        if (!sesionActual && protegidas.includes(page)) {
            toast('🔒 Inicia sesión desde Técnicos');
            return;
        }
        selectedEquipoId = null;
        goTo(page);
    });
});

// ─────────────────────────────────────────────
// ── INIT ──
// ─────────────────────────────────────────────
(async () => {
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando CEDI Ibagué...</p></div>`;
    await sembrarDatos();
    await cargarDatos();
    renderView();
})();
