import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { LESION } from './config/lesion.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const $ = (s) => document.querySelector(s);
const BASE = import.meta.env.BASE_URL;
const params = new URLSearchParams(location.search);

/* ---------- utilidades ---------- */
const quitaAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function mostrarError(html, recargar = true) {
  const e = $('#error');
  e.innerHTML = `<h2>No se pudo mostrar el modelo 3D</h2><p>${html}</p>` + (recargar ? '<button id="reintentar">Reintentar</button>' : '');
  e.hidden = false;
  $('#reintentar')?.addEventListener('click', () => location.reload());
}

/* ---------- capas ---------- */
const CAPAS = [
  { id: 'organos', nombre: 'Órganos internos', color: '#d9736b', orden: 1, rough: 0.42, visible: true, opac: 1 },
  { id: 'esqueleto', nombre: 'Sistema óseo', color: '#e6dcc0', orden: 3, rough: 0.6, visible: true, opac: 1 },
  { id: 'vasos', nombre: 'Sistema circulatorio', color: '#c8283a', orden: 2, rough: 0.35, visible: true, opac: 1 },
  { id: 'musculos', nombre: 'Sistema muscular', color: '#a8291f', orden: 4, rough: 0.55, visible: false, opac: 1 },
  { id: 'piel', nombre: 'Piel', color: '#dba489', orden: 5, rough: 0.6, visible: true, opac: 0.22 },
];
const POR_ID = Object.fromEntries(CAPAS.map((c) => [c.id, c]));
const ORDEN_CARGA = ['organos', 'esqueleto', 'vasos', 'musculos', 'piel'];

/* ---------- WebGL ---------- */
let renderer;
const lienzo = $('#lienzo');
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (e) {
  console.error(e);
  mostrarError('Tu navegador o dispositivo no permite WebGL. Probá con Google Chrome actualizado, y que la aceleración por hardware esté activada.', true);
  throw e;
}
lienzo.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); mostrarError('Se perdió el contexto gráfico (suele pasar por falta de memoria). Tocá “Reintentar”.'); });

const gl = renderer.getContext();
const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
const gpu = dbgExt ? String(gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL)) : 'desconocida';
const esSoftware = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
const esMovil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
const mem = navigator.deviceMemory || (esMovil ? 4 : 8);
const nucleos = navigator.hardwareConcurrency || 4;

/* ---------- calidad adaptable ---------- */
const prefCalidad = params.get('calidad') || lsGet('calidad') || 'auto';
function calidadAuto() {
  if (esSoftware) return 'baja';
  if (esMovil) return (mem >= 8 && nucleos >= 8) ? 'alta' : 'baja';
  return (mem >= 4 && nucleos >= 4) ? 'alta' : 'baja';
}
const TIER = prefCalidad === 'alta' || prefCalidad === 'baja' ? prefCalidad : calidadAuto();
const efectosPref = params.get('efectos') ?? lsGet('efectos');
let efectosActivos = efectosPref != null ? efectosPref === '1' || efectosPref === 'true' : (TIER === 'alta' && !esSoftware);
let tope = esMovil ? (TIER === 'alta' ? 2 : 1.5) : 2;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tope));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0a1019");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // iluminación por entorno (procedural)
scene.environmentIntensity = 0.6;
const sol = new THREE.DirectionalLight(0xffffff, 1.1);
sol.position.set(1.5, 3, 3);
scene.add(sol);
const relleno = new THREE.DirectionalLight(0x9db8ff, 0.5);
relleno.position.set(-2, 1, -3);
scene.add(relleno);

const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 30);
const controls = new OrbitControls(camera, lienzo);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.screenSpacePanning = true;
controls.minDistance = 0.08;
controls.maxDistance = 6;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

const CUERPO = { centro: new THREE.Vector3(0, 0.87, 0), dist: 3.0, ymin: 0, ymax: 1.75 };
const VISTAS = { anterior: [0, 0, 1], posterior: [0, 0, -1], izquierda: [1, 0, 0], derecha: [-1, 0, 0] }; // izquierda = lado izquierdo del paciente (+X)
function vistaInicial() {
  camera.position.copy(CUERPO.centro).add(new THREE.Vector3(0, 0.05, 1).normalize().multiplyScalar(CUERPO.dist));
  controls.target.copy(CUERPO.centro);
  controls.update();
}
vistaInicial();

/* plano de corte horizontal (oculta lo que está por encima) */
const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
renderer.clippingPlanes = [plano];
renderer.localClippingEnabled = true;

/* ---------- carga de modelos ---------- */
const draco = new DRACOLoader().setDecoderPath(`${BASE}draco/`);
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
const capas = {};          // id -> { malla, geo, ids(Float32Array->Int), nombres, cajas, colorBase, cargada }
const listos = {};         // id -> Promise
let indice = null;
const todasLasEstructuras = [];

const progreso = Object.fromEntries(CAPAS.map((c) => [c.id, 0]));
const pesoCapa = { organos: 3, esqueleto: 3, vasos: 2, musculos: 4, piel: 1 };
function pintarProgreso() {
  const tot = Object.values(pesoCapa).reduce((a, b) => a + b, 0);
  const v = CAPAS.reduce((a, c) => a + progreso[c.id] * pesoCapa[c.id], 0) / tot;
  $('#progreso-barra').style.width = `${Math.round(v * 100)}%`;
  const cargadas = CAPAS.filter((c) => progreso[c.id] >= 1).length;
  $('#progreso-texto').textContent = cargadas === CAPAS.length ? 'Modelos cargados' : `Cargando modelos anatómicos… ${Math.round(v * 100)}% (${cargadas}/${CAPAS.length} capas)`;
  if (cargadas === CAPAS.length) setTimeout(() => $('#progreso').classList.add('listo'), 1200);
}

function crearMaterial(def) {
  const base = { vertexColors: true, roughness: def.rough, metalness: 0, side: def.id === 'piel' ? THREE.FrontSide : THREE.DoubleSide };
  const m = (TIER === 'alta' && def.id === 'organos')
    ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat: 0.35, clearcoatRoughness: 0.35 })
    : new THREE.MeshStandardMaterial(base);
  return m;
}

function idsDe(geo) {
  const a = geo.getAttribute('_struct') || geo.getAttribute('_STRUCT');
  if (!a) throw new Error('El GLB no trae el atributo de identificación de estructuras');
  const out = new Uint16Array(a.count);
  for (let i = 0; i < a.count; i++) out[i] = Math.round(a.getX(i));
  return out;
}

function cargarCapa(id) {
  const def = POR_ID[id];
  const url = `${BASE}modelos/${TIER}/${id}.glb`;
  setEstadoCapa(id, 'Cargando…');
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => {
      let src = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      if (!src) { reject(new Error(`Sin malla en ${url}`)); return; }
      const geo = src.geometry;
      const ids = idsDe(geo);
      const nombres = indice[TIER][id].structures;
      // cajas por estructura
      const pos = geo.getAttribute('position');
      const n = nombres.length;
      const mn = new Float32Array(n * 3).fill(Infinity), mx = new Float32Array(n * 3).fill(-Infinity);
      for (let i = 0; i < pos.count; i++) {
        const s = ids[i];
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (x < mn[s * 3]) mn[s * 3] = x; if (x > mx[s * 3]) mx[s * 3] = x;
        if (y < mn[s * 3 + 1]) mn[s * 3 + 1] = y; if (y > mx[s * 3 + 1]) mx[s * 3 + 1] = y;
        if (z < mn[s * 3 + 2]) mn[s * 3 + 2] = z; if (z > mx[s * 3 + 2]) mx[s * 3 + 2] = z;
      }
      // color base de los vértices (rgba) para poder restaurar
      const col = geo.getAttribute('color');
      if (!col) { reject(new Error('El GLB no trae colores de vértice')); return; }
      const mat = crearMaterial(def);
      const malla = new THREE.Mesh(geo, mat);
      malla.name = `capa-${id}`;
      malla.renderOrder = def.orden;
      malla.frustumCulled = false;
      malla.visible = def.visible;
      scene.add(malla);
      capas[id] = { def, malla, geo, ids, nombres, mn, mx };
      nombres.forEach((e) => todasLasEstructuras.push({ capa: id, id: e.id, es: e.es, en: e.en, clave: quitaAcentos(`${e.es} ${e.en}`) }));
      aplicarOpacidad(id);
      progreso[id] = 1; pintarProgreso();
      setEstadoCapa(id, `${n} estructuras`);
      habilitarCapa(id);
      // BVH en segundo plano para no trabar la carga
      const hacer = () => { try { geo.computeBoundsTree({ targetLeafSize: 12 }); capas[id].bvh = true; } catch (e) { console.warn('BVH', id, e); } };
      (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(hacer, { timeout: 4000 });
      resolve(capas[id]);
    }, (ev) => {
      progreso[id] = ev.lengthComputable && ev.total ? Math.min(0.97, ev.loaded / ev.total) : Math.max(progreso[id], 0.5);
      pintarProgreso();
    }, (err) => {
      console.error(url, err);
      setEstadoCapa(id, 'No disponible');
      reject(new Error(`No se pudo cargar ${url}`));
    });
  });
}

function aplicarOpacidad(id) {
  const c = capas[id], def = POR_ID[id];
  if (!c) return;
  const m = c.malla.material;
  m.opacity = def.opac;
  m.transparent = def.opac < 0.995;
  m.depthWrite = def.opac >= 0.5;
  m.needsUpdate = true;
  c.malla.visible = def.visible;
}

/* ---------- interfaz de capas ---------- */
function construirCapas() {
  const cont = $('#capas');
  for (const def of CAPAS) {
    const d = document.createElement('div');
    d.className = 'capa'; d.id = `capa-${def.id}`;
    d.innerHTML = `<div class="cab"><label><input type="checkbox" ${def.visible ? 'checked' : ''} disabled data-capa="${def.id}"><span class="punto" style="background:${def.color}"></span><span>${def.nombre}</span></label></div>
      <input type="range" min="0" max="100" value="${Math.round(def.opac * 100)}" disabled data-opac="${def.id}" aria-label="Transparencia de ${def.nombre}">
      <div class="est" data-est="${def.id}">En cola…</div>`;
    cont.append(d);
  }
  cont.addEventListener('change', (e) => {
    const id = e.target.dataset.capa; if (!id) return;
    POR_ID[id].visible = e.target.checked; aplicarOpacidad(id); salirDeLesionSiCorresponde();
  });
  cont.addEventListener('input', (e) => {
    const id = e.target.dataset.opac; if (!id) return;
    POR_ID[id].opac = e.target.value / 100; aplicarOpacidad(id);
  });
}
function setEstadoCapa(id, t) { const e = document.querySelector(`[data-est="${id}"]`); if (e) e.textContent = t; }
function habilitarCapa(id) {
  document.querySelector(`[data-capa="${id}"]`).disabled = false;
  document.querySelector(`[data-opac="${id}"]`).disabled = false;
}
function sincronizarUI() {
  for (const def of CAPAS) {
    const ch = document.querySelector(`[data-capa="${def.id}"]`), r = document.querySelector(`[data-opac="${def.id}"]`);
    ch.checked = def.visible; r.value = Math.round(def.opac * 100);
  }
}

/* ---------- cámara ---------- */
let anim = null;
function volarA(objetivo, posicion, ms = 750) {
  anim = { t0: performance.now(), ms, a0: controls.target.clone(), a1: objetivo.clone(), p0: camera.position.clone(), p1: posicion.clone() };
}
function pasoAnimacion(now) {
  if (!anim) return;
  const t = Math.min(1, (now - anim.t0) / anim.ms), e = t * t * (3 - 2 * t);
  controls.target.lerpVectors(anim.a0, anim.a1, e);
  camera.position.lerpVectors(anim.p0, anim.p1, e);
  if (t >= 1) anim = null;
}
function irAVista(nombre) {
  const d = new THREE.Vector3(...VISTAS[nombre]);
  const dist = Math.max(1.4, camera.position.distanceTo(controls.target));
  volarA(controls.target, controls.target.clone().add(d.multiplyScalar(dist)));
}
function restablecer() {
  salirDeLesion(true);
  seleccion.limpiar();
  volarA(CUERPO.centro, CUERPO.centro.clone().add(new THREE.Vector3(0, 0.05, 1).normalize().multiplyScalar(CUERPO.dist)));
}
document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => { irAVista(b.dataset.vista); cerrarMenu(); }));
$('#btn-reiniciar').addEventListener('click', restablecer);

/* ---------- plano de corte ---------- */
function actualizarCorte() {
  const on = $('#corte-on').checked;
  const f = $('#corte').value / 100;
  const y = CUERPO.ymin + (CUERPO.ymax - CUERPO.ymin) * f;
  plano.constant = on ? y : 100;
  $('#corte-info').textContent = on ? `Corte a ${Math.round(f * 100)} % de la altura del cuerpo (se oculta lo superior).` : 'Oculta lo que está por encima del plano.';
}
$('#corte-on').addEventListener('change', actualizarCorte);
$('#corte').addEventListener('input', () => { $('#corte-on').checked = true; actualizarCorte(); });

/* ---------- selección y resaltado ---------- */
const resaltado = new THREE.Group();
scene.add(resaltado);
function crearSuperposicion(capaId, sid, { tinte = '#ffb347', mezcla = 0.45, emisivo = 0.35, regionFn = null, opaca = true } = {}) {
  const c = capas[capaId];
  const idx = c.geo.index;
  const total = idx.count / 3;
  const sel = [];
  for (let f = 0; f < total; f++) { if (c.ids[idx.getX(f * 3)] === sid) sel.push(idx.getX(f * 3), idx.getX(f * 3 + 1), idx.getX(f * 3 + 2)); }
  const g = new THREE.BufferGeometry();
  const pos = c.geo.getAttribute('position');
  g.setAttribute('position', pos);
  g.setAttribute('normal', c.geo.getAttribute('normal'));
  const col = c.geo.getAttribute('color');
  const colores = new Float32Array(pos.count * 3);
  const t = new THREE.Color(tinte);
  for (let i = 0; i < pos.count; i++) {
    if (c.ids[i] !== sid) continue;
    const w = regionFn ? regionFn(pos.getX(i), pos.getY(i), pos.getZ(i)) : mezcla;
    colores[i * 3] = col.getX(i) + (t.r - col.getX(i)) * w;
    colores[i * 3 + 1] = col.getY(i) + (t.g - col.getY(i)) * w;
    colores[i * 3 + 2] = col.getZ(i) + (t.b - col.getZ(i)) * w;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  g.setIndex(sel);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, emissive: new THREE.Color(tinte), emissiveIntensity: emisivo * 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.renderOrder = 0;
  return mesh;
}

const seleccion = {
  actual: null, malla: null,
  elegir(capaId, sid, { volar = false } = {}) {
    this.limpiar(false);
    const c = capas[capaId]; if (!c) return;
    this.actual = { capa: capaId, id: sid };
    if (!(lesionActiva && capaId === 'organos' && sid === estomagoId)) {
      this.malla = crearSuperposicion(capaId, sid);
      resaltado.add(this.malla);
    }
    const e = c.nombres[sid];
    const def = POR_ID[capaId];
    $('#info-cuerpo').innerHTML = `<h3></h3><p class="orig"></p><p class="capa-n"></p><p>Fuente: Z-Anatomy (CC BY-SA 4.0). Nombres según Terminología Anatómica.</p>`;
    $('#info-cuerpo h3').textContent = e.es;
    $('#info-cuerpo .orig').textContent = `Nombre original: ${e.en}`;
    $('#info-cuerpo .capa-n').textContent = `Capa: ${def.nombre}`;
    $('#info').hidden = lesionActiva;
    if (volar) {
      const cen = new THREE.Vector3((c.mn[sid * 3] + c.mx[sid * 3]) / 2, (c.mn[sid * 3 + 1] + c.mx[sid * 3 + 1]) / 2, (c.mn[sid * 3 + 2] + c.mx[sid * 3 + 2]) / 2);
      const tam = Math.max(c.mx[sid * 3] - c.mn[sid * 3], c.mx[sid * 3 + 1] - c.mn[sid * 3 + 1], c.mx[sid * 3 + 2] - c.mn[sid * 3 + 2]);
      const dir = camera.position.clone().sub(controls.target).normalize();
      volarA(cen, cen.clone().add(dir.multiplyScalar(Math.max(0.25, tam * 2.6))));
    }
  },
  limpiar(ocultarInfo = true) {
    if (this.malla) { resaltado.remove(this.malla); this.malla.geometry.dispose(); this.malla.material.dispose(); this.malla = null; }
    this.actual = null;
    if (ocultarInfo) $('#info').hidden = true;
  },
};
$('#info-cerrar').addEventListener('click', () => seleccion.limpiar());

/* toque corto = seleccionar; arrastre = mover cámara */
const rayo = new THREE.Raycaster();
const puntero = new THREE.Vector2();
function capasPickeables() { return Object.values(capas).filter((c) => c.malla.visible && c.malla.material.opacity > 0.05); }
function elegirEn(clientX, clientY) {
  const r = lienzo.getBoundingClientRect();
  puntero.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  rayo.setFromCamera(puntero, camera);
  rayo.firstHitOnly = true;
  let mejor = null;
  for (const c of capasPickeables()) {
    const hits = rayo.intersectObject(c.malla, false);
    for (const h of hits) {
      if (plano.constant < 50 && h.point.y > plano.constant) continue;     // lo cortado no se puede tocar
      const firme = c.malla.material.opacity >= 0.3;      // las capas muy transparentes no tapan lo que tienen detrás
      if (!mejor || (firme && !mejor.firme) || (firme === mejor.firme && h.distance < mejor.distance)) mejor = { ...h, capa: c, firme };
    }
  }
  if (!mejor) return null;
  const sid = mejor.capa.ids[mejor.face.a];
  return { capa: mejor.capa.def.id, id: sid };
}
let down = null;
lienzo.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
lienzo.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
  down = null;
  if (moved > 8 || dt > 600) return;
  const h = elegirEn(e.clientX, e.clientY);
  if (h) seleccion.elegir(h.capa, h.id); else seleccion.limpiar();
});

/* ---------- búsqueda ---------- */
$('#buscar').addEventListener('input', (e) => {
  const q = quitaAcentos(e.target.value.trim());
  const ul = $('#resultados'); ul.innerHTML = '';
  if (q.length < 2) return;
  const palabras = q.split(/\s+/);
  const res = todasLasEstructuras.filter((s) => palabras.every((p) => s.clave.includes(p)))
    .sort((a, b) => a.es.length - b.es.length).slice(0, 12);
  if (!res.length) { const li = document.createElement('li'); li.innerHTML = '<small>No se encontró esa estructura (o su capa aún se está cargando).</small>'; ul.append(li); return; }
  for (const s of res) {
    const li = document.createElement('li'); const b = document.createElement('button');
    b.type = 'button'; b.dataset.capa = s.capa; b.dataset.sid = s.id;
    b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = s.es; b.lastChild.textContent = POR_ID[s.capa].nombre;
    b.addEventListener('click', () => {
      const def = POR_ID[s.capa];
      if (!def.visible || def.opac < 0.3) { def.visible = true; def.opac = Math.max(def.opac, 0.35); aplicarOpacidad(s.capa); sincronizarUI(); }
      for (const o of CAPAS) { if (o.orden > def.orden && o.visible && o.opac > 0.15) { o.opac = 0.15; aplicarOpacidad(o.id); } }
      sincronizarUI();
      seleccion.elegir(s.capa, s.id, { volar: true });
      cerrarMenu();
    });
    li.append(b); ul.append(li);
  }
});

/* ---------- menú ---------- */
function abrirMenu() { $('#menu').classList.add('abierto'); $('#velo').hidden = false; $('#btn-menu').setAttribute('aria-expanded', 'true'); }
function cerrarMenu() { $('#menu').classList.remove('abierto'); $('#velo').hidden = true; $('#btn-menu').setAttribute('aria-expanded', 'false'); }
$('#btn-menu').addEventListener('click', () => ($('#menu').classList.contains('abierto') ? cerrarMenu() : abrirMenu()));
$('#velo').addEventListener('click', cerrarMenu);
$('#menu-cerrar').addEventListener('click', cerrarMenu);

/* ---------- módulo de lesión ---------- */
let lesionActiva = false, estomagoId = null, previo = null, lesionMalla = null, marcador = null, valid = null;
const L = LESION;

function datosEstomago() {
  const c = capas.organos; if (!c) return null;
  if (estomagoId == null) {
    const e = c.nombres.find((n) => n.en === L.organo.en);
    if (!e) return null;
    estomagoId = e.id;
  }
  const s = estomagoId;
  return { c, s, mn: [c.mn[s * 3], c.mn[s * 3 + 1], c.mn[s * 3 + 2]], mx: [c.mx[s * 3], c.mx[s * 3 + 1], c.mx[s * 3 + 2]] };
}

function validarLesion() {
  const d = datosEstomago();
  const r = { estomagoEncontrado: !!d, estomagoALaIzquierda: false, distSuperficie: null, fraccion: null, enCuerpo: false, ladoIzq: false, posterior: false, normalHaciaAfuera: false, ok: false, calibradaEnConfig: L.calibrada };
  if (!d) return r;
  const pos = d.c.geo.getAttribute('position'), ids = d.c.ids;
  const p = L.marcador.posicion;
  let dmin = Infinity, cx = 0, cy = 0, cz = 0, n = 0;
  for (let i = 0; i < pos.count; i++) {
    if (ids[i] !== d.s) continue;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    cx += x; cy += y; cz += z; n++;
    const dd = Math.hypot(x - p[0], y - p[1], z - p[2]);
    if (dd < dmin) dmin = dd;
  }
  const cen = [cx / n, cy / n, cz / n];
  r.centroideEstomago = cen.map((v) => +v.toFixed(3));
  r.distSuperficie = +dmin.toFixed(4);
  const fr = [0, 1, 2].map((k) => (p[k] - d.mn[k]) / (d.mx[k] - d.mn[k]));
  r.fraccion = fr.map((v) => +v.toFixed(2));
  const V = L.validacion;
  r.enCuerpo = fr[1] >= V.fracYMin && fr[1] <= V.fracYMax;
  r.ladoIzq = fr[0] >= V.minLadoIzq;
  r.posterior = fr[2] <= V.maxPosterior;
  const nm = new THREE.Vector3(...L.marcador.normal).normalize();
  r.normalHaciaAfuera = nm.dot(new THREE.Vector3(p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]).normalize()) > 0.3 && nm.z < 0;
  // orientación: estómago en el lado izquierdo del paciente (+X) respecto del hígado y la línea media
  const higado = d.c.nombres.find((e) => e.en === 'Liver');
  if (higado) {
    const h = higado.id;
    r.hígadoX = +((d.c.mn[h * 3] + d.c.mx[h * 3]) / 2).toFixed(3);
  }
  r.estomagoALaIzquierda = cen[0] > 0 && (r.hígadoX === undefined || cen[0] > r.hígadoX);
  r.ok = r.estomagoALaIzquierda && dmin <= V.distMaxSuperficie && r.enCuerpo && r.ladoIzq && r.posterior && r.normalHaciaAfuera && L.calibrada;
  return r;
}

function construirMarcador() {
  if (marcador) return marcador;
  const g = new THREE.Group();
  const m = L.marcador;
  const nucleo = new THREE.Mesh(new THREE.SphereGeometry(m.radio, 24, 16), new THREE.MeshBasicMaterial({ color: m.color, toneMapped: false }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(m.radio * 1.9, 24, 16), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false }));
  halo.renderOrder = 50;
  g.add(nucleo, halo);
  const n = new THREE.Vector3(...m.normal).normalize();
  g.position.set(...m.posicion).addScaledVector(n, m.separacion);
  g.userData = { nucleo, halo };
  g.raycast = () => {};
  scene.add(g);
  marcador = g;
  return g;
}

async function irALaLesion() {
  cerrarMenu();
  if (lesionActiva) return;
  if (!capas.organos) {
    $('#btn-lesion').textContent = 'Cargando órganos…';
    try { await listos.organos; } catch { mostrarError('No se pudo cargar la capa de órganos.'); return; } finally { $('#btn-lesion').textContent = 'IR A LA LESIÓN'; }
  }
  const d = datosEstomago();
  if (!d) { mostrarError('No se encontró el estómago dentro del modelo anatómico.', false); return; }
  valid = validarLesion();
  console.info('[lesión] validación', valid);
  previo = { capas: CAPAS.map((c) => ({ id: c.id, v: c.visible, o: c.opac })), cam: camera.position.clone(), tgt: controls.target.clone() };
  seleccion.limpiar();
  lesionActiva = true;
  // volver transparente lo que estorba
  const estados = { piel: [false, 0.1], musculos: [false, 0.1], esqueleto: [true, 0.14], vasos: [true, 0.3], organos: [true, 0.2] };
  for (const [id, [v, o]] of Object.entries(estados)) { POR_ID[id].visible = v; POR_ID[id].opac = o; if (capas[id]) aplicarOpacidad(id); }
  sincronizarUI();
  // resaltar el estómago, con la región descrita teñida
  const R = L.region;
  const regionFn = (x, y, z) => {
    const fy = (y - d.mn[1]) / (d.mx[1] - d.mn[1]), fx = (x - d.mn[0]) / (d.mx[0] - d.mn[0]), fz = (z - d.mn[2]) / (d.mx[2] - d.mn[2]);
    const s = R.suavizado;
    const wy = smooth(R.y[0] - s, R.y[0], fy) * (1 - smooth(R.y[1], R.y[1] + s, fy));
    return wy * smooth(R.xMin - s, R.xMin, fx) * (1 - smooth(R.zMax, R.zMax + s, fz)) * 0.8;
  };
  lesionMalla = crearSuperposicion('organos', d.s, { tinte: R.color, regionFn, emisivo: 0.35 });
  lesionMalla.material.emissiveIntensity = 0.06;
  resaltado.add(lesionMalla);
  // marcador, solo si está calibrado y validado contra el modelo cargado
  const mostrar = valid.ok;
  if (mostrar) construirMarcador().visible = true;
  // panel
  const D = L.descripcion;
  $('#lesion-datos').innerHTML = `<dt>Órgano</dt><dd>${D.organo}</dd><dt>Región</dt><dd>${D.region}</dd><dt>Localización</dt><dd>${D.localizacion}</dd><dt>Endoscopia</dt><dd>${D.endoscopia}</dd>`;
  $('#lesion-aviso').textContent = L.aviso;
  $('#lesion-estado').textContent = mostrar
    ? 'Marcador rojo: ubicación calibrada y comprobada sobre la malla del estómago de este modelo (lado izquierdo del paciente, pared posterior). Tamaño del marcador solo visual. Zona anaranjada: región descrita, orientativa.'
    : 'No se dibuja el marcador: la ubicación no pasó la comprobación contra el modelo cargado. Solo se resalta el estómago y la región descrita.';
  $('#lesion-panel').hidden = false;
  $('#btn-lesion').hidden = true;
  $('#lesion-etiqueta').hidden = !mostrar;
  // cámara: desde atrás y a la izquierda del paciente
  const t = new THREE.Vector3(...L.camara.objetivo);
  const dir = new THREE.Vector3(...L.camara.direccion).normalize();
  volarA(t, t.clone().add(dir.multiplyScalar(L.camara.distancia)), 1000);
}
function salirDeLesion(rapido = false) {
  if (!lesionActiva) return;
  lesionActiva = false;
  if (lesionMalla) { resaltado.remove(lesionMalla); lesionMalla.geometry.dispose(); lesionMalla.material.dispose(); lesionMalla = null; }
  if (marcador) marcador.visible = false;
  for (const e of previo.capas) { POR_ID[e.id].visible = e.v; POR_ID[e.id].opac = e.o; if (capas[e.id]) aplicarOpacidad(e.id); }
  sincronizarUI();
  $('#lesion-panel').hidden = true; $('#lesion-etiqueta').hidden = true; $('#btn-lesion').hidden = false;
  if (!rapido) volarA(previo.tgt, previo.cam);
}
function salirDeLesionSiCorresponde() { /* el usuario puede tocar capas dentro del modo lesión; se respeta su elección */ }
$('#btn-lesion').addEventListener('click', irALaLesion);
$('#btn-volver').addEventListener('click', () => salirDeLesion(false));
$('#btn-detalles').addEventListener('click', () => { const m = $('#lesion-mas'); m.hidden = !m.hidden; $('#btn-detalles').textContent = m.hidden ? 'Ver aclaraciones ▾' : 'Ocultar aclaraciones ▴'; $('#btn-detalles').setAttribute('aria-expanded', String(!m.hidden)); });

function actualizarMarcador(now) {
  if (!marcador || !marcador.visible) return;
  const p = L.marcador.pulso, s = 1 + p.amplitud * (0.5 + 0.5 * Math.sin(now / 1000 * 2 * Math.PI * p.frecuenciaHz));
  marcador.userData.halo.scale.setScalar(s * 1.15);
  marcador.userData.halo.material.opacity = 0.42 - 0.22 * (s - 1) / p.amplitud;
  marcador.userData.nucleo.scale.setScalar(1 + 0.12 * (s - 1) / p.amplitud);
  // etiqueta anclada al marcador
  const et = $('#lesion-etiqueta');
  const v = marcador.position.clone().project(camera);
  const r = lienzo.getBoundingClientRect();
  const x = (v.x * 0.5 + 0.5) * r.width + r.left + 16, y = (-v.y * 0.5 + 0.5) * r.height + r.top - 28;
  et.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  const n = new THREE.Vector3(...L.marcador.normal).normalize();
  const mira = camera.position.clone().sub(marcador.position).dot(n) > 0;
  et.classList.toggle('atras', !mira);
  et.textContent = mira ? 'Lesión (ilustrativa)' : 'Lesión (cara posterior: girá para verla)';
  et.hidden = v.z > 1;
}

/* ---------- efectos y rendimiento ---------- */
let composer = null, efectosListos = false, aoPass = null, bloomPass = null;
function montarEfectos() {
  if (efectosListos) return;
  try {
    const sz = renderer.getSize(new THREE.Vector2());
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    try {
      aoPass = new GTAOPass(scene, camera, sz.x, sz.y);
      aoPass.output = GTAOPass.OUTPUT.Default;
      aoPass.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      composer.addPass(aoPass);
    } catch (e) { console.warn('AO no disponible', e); aoPass = null; }
    bloomPass = new UnrealBloomPass(sz, 0.22, 0.6, 0.92);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    efectosListos = true;
  } catch (e) {
    console.warn('Efectos desactivados', e);
    composer = null; efectosActivos = false; $('#efectos').checked = false;
  }
}
const nivelesDegradacion = [];
function degradar(motivo) {
  if (aoPass && aoPass.enabled) { aoPass.enabled = false; nivelesDegradacion.push('sin oclusión ambiental'); }
  else if (bloomPass && bloomPass.enabled) { bloomPass.enabled = false; nivelesDegradacion.push('sin brillo'); }
  else if (efectosActivos) { efectosActivos = false; $('#efectos').checked = false; nivelesDegradacion.push('sin efectos'); }
  else if (tope > 1) { tope = 1; ajustarTamano(); nivelesDegradacion.push('resolución reducida'); }
  else return;
  $('#rend-info').textContent = `Rendimiento ajustado automáticamente (${motivo}): ${nivelesDegradacion.join(', ')}.`;
}
function ajustarTamano() {
  const w = lienzo.clientWidth || innerWidth, h = lienzo.clientHeight || innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tope));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  composer?.setPixelRatio?.(Math.min(devicePixelRatio || 1, tope));
  composer?.setSize(w, h);
}
addEventListener('resize', ajustarTamano);
new ResizeObserver(ajustarTamano).observe(lienzo);

$('#calidad').value = ['alta', 'baja'].includes(prefCalidad) ? prefCalidad : 'auto';
$('#calidad').addEventListener('change', (e) => { lsSet('calidad', e.target.value); if (location.search) location.search = ''; else location.reload(); });
$('#efectos').checked = efectosActivos;
$('#efectos').addEventListener('change', (e) => { efectosActivos = e.target.checked; lsSet('efectos', e.target.checked ? '1' : '0'); if (efectosActivos) { montarEfectos(); if (aoPass) aoPass.enabled = true; if (bloomPass) bloomPass.enabled = true; } });
$('#rend-info').textContent = `Modelo: calidad ${TIER}${esSoftware ? ' (se detectó render por software)' : ''}. GPU: ${gpu.slice(0, 60)}.`;
if (efectosActivos) montarEfectos();

/* ---------- bucle de dibujo ---------- */
let ultimo = performance.now(), acum = 0, cuadros = 0, mala = 0;
function bucle(now) {
  requestAnimationFrame(bucle);
  pasoAnimacion(now);
  controls.update();
  actualizarMarcador(now);
  if (efectosActivos && composer) composer.render(); else renderer.render(scene, camera);
  // monitor de FPS: si es bajo varias veces seguidas, se apagan efectos costosos
  const dt = now - ultimo; ultimo = now; acum += dt; cuadros++;
  if (acum >= 2500) {
    const fps = cuadros * 1000 / acum;
    window.__fps = Math.round(fps);
    if (!document.hidden && fps < 24) { if (++mala >= 2) { degradar(`${Math.round(fps)} cuadros/s`); mala = 0; } } else mala = 0;
    acum = 0; cuadros = 0;
  }
}

/* ---------- arranque ---------- */
async function iniciar() {
  construirCapas();
  ajustarTamano();
  pintarProgreso();
  try {
    const r = await fetch(`${BASE}modelos/indice.json`);
    if (!r.ok) throw new Error(`indice.json: HTTP ${r.status}`);
    indice = await r.json();
  } catch (e) {
    console.error(e);
    mostrarError('No se pudo leer el índice de modelos. Revisá tu conexión e intentá de nuevo.');
    return;
  }
  requestAnimationFrame(bucle);
  const errores = [];
  for (const id of ORDEN_CARGA) {
    listos[id] = cargarCapa(id);
    listos[id].catch((e) => errores.push(e.message));
    try { await listos[id]; } catch { /* se informa abajo; se sigue con las demás capas */ }
  }
  if (errores.length) {
    $('#progreso-texto').textContent = `Capas con error: ${errores.length}. Las demás funcionan.`;
    console.error(errores);
  }
  window.__visor.listo = true;
}

/* gancho de pruebas (solo lectura/acciones públicas de la propia interfaz) */
window.__visor = {
  listo: false, tier: TIER, gpu,
  estado: () => ({
    capas: Object.fromEntries(CAPAS.map((c) => [c.id, { visible: c.visible, opacidad: c.opac, cargada: !!capas[c.id], tris: capas[c.id] ? capas[c.id].geo.index.count / 3 : 0 }])),
    seleccion: seleccion.actual, lesionActiva, corte: plano.constant, camara: camera.position.toArray(), objetivo: controls.target.toArray(),
    marcadorVisible: !!(marcador && marcador.visible), validacion: valid, fps: window.__fps,
  }),
  validar: () => validarLesion(),
  proyectar: (capa, nombreEn) => {
    const c = capas[capa]; const e = c.nombres.find((n) => n.en === nombreEn); if (!e) return null;
    const pos = c.geo.getAttribute('position'); const v = new THREE.Vector3(); let best = null, bd = Infinity;
    const cen = new THREE.Vector3((c.mn[e.id * 3] + c.mx[e.id * 3]) / 2, (c.mn[e.id * 3 + 1] + c.mx[e.id * 3 + 1]) / 2, (c.mn[e.id * 3 + 2] + c.mx[e.id * 3 + 2]) / 2);
    // vértice de la estructura más cercano a la cámara y visible desde ella
    for (let i = 0; i < pos.count; i += 3) { if (c.ids[i] !== e.id) continue; v.fromBufferAttribute(pos, i); const d = v.distanceTo(camera.position); if (d < bd) { bd = d; best = v.clone(); } }
    const p = (best || cen).clone().project(camera); const r = lienzo.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width + r.left, y: (-p.y * 0.5 + 0.5) * r.height + r.top };
  },
  pixelCentro: (capa, nombreEn) => {
    const c = capas[capa]; const e = c.nombres.find((n) => n.en === nombreEn); if (!e) return null;
    const cen = new THREE.Vector3((c.mn[e.id * 3] + c.mx[e.id * 3]) / 2, (c.mn[e.id * 3 + 1] + c.mx[e.id * 3 + 1]) / 2, (c.mn[e.id * 3 + 2] + c.mx[e.id * 3 + 2]) / 2);
    const p = cen.project(camera); const r = lienzo.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width + r.left, y: (-p.y * 0.5 + 0.5) * r.height + r.top };
  },
};
iniciar();
