// Pruebas estáticas (sin navegador): rutas, formato y coherencia de los GLB. Se ejecutan con `npm test`.
import fs from 'node:fs';
import path from 'node:path';
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CAPAS = ['piel', 'musculos', 'esqueleto', 'organos', 'vasos'];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'OK   ' : 'FALLA'} ${m}`); if (!c) fallos++; };

const indice = JSON.parse(fs.readFileSync(path.join(raiz, 'public/modelos/indice.json'), 'utf8'));
for (const tier of ['alta', 'baja']) {
  for (const capa of CAPAS) {
    const f = path.join(raiz, `public/modelos/${tier}/${capa}.glb`);
    if (!fs.existsSync(f)) { ok(false, `existe ${tier}/${capa}.glb`); continue; }
    const b = fs.readFileSync(f);
    const magia = b.toString('ascii', 0, 4) === 'glTF';
    const largoJson = b.readUInt32LE(12);
    const j = JSON.parse(b.toString('utf8', 20, 20 + largoJson));
    const draco = (j.extensionsUsed || []).includes('KHR_draco_mesh_compression');
    const prim = j.meshes[0].primitives[0];
    const attr = prim.extensions?.KHR_draco_mesh_compression?.attributes || prim.attributes;
    const esperadas = indice[tier][capa].structures.length;
    ok(magia && draco && '_STRUCT' in attr && 'COLOR_0' in attr && j.meshes.length === 1,
       `${tier}/${capa}.glb: GLB válido, Draco, _STRUCT y COLOR_0, ${esperadas} estructuras, ${(b.length / 1e6).toFixed(2)} MB`);
    ok(esperadas > 0 && b.length < 3e6, `${tier}/${capa}.glb: tamaño razonable para móvil`);
  }
}
for (const f of ['public/draco/draco_decoder.wasm', 'public/draco/draco_wasm_wrapper.js', 'public/modelos/LICENCIA-Z-Anatomy.txt', 'FUENTES-Y-LICENCIAS.md', 'src/config/lesion.js']) {
  ok(fs.existsSync(path.join(raiz, f)), `existe ${f}`);
}
const lesion = fs.readFileSync(path.join(raiz, 'src/config/lesion.js'), 'utf8');
ok(/calibrada:\s*(true|false)/.test(lesion), 'lesion.js declara el estado de calibración');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
ok(html.includes('Esquema ilustrativo, no reemplaza las imágenes ni el criterio del equipo médico.'), 'aviso médico presente en index.html');
const vite = fs.readFileSync(path.join(raiz, 'vite.config.js'), 'utf8');
ok(vite.includes("base: '/visor-anatomico-3d/'"), 'Vite base = /visor-anatomico-3d/');
for (const n of ['Kidney', 'Cochlea', 'Brain']) {
  const hay = ['alta', 'baja'].some((t) => CAPAS.some((c) => indice[t][c].structures.some((s) => s.en.includes(n))));
  ok(!hay, `no hay estructuras excluidas por licencia (${n})`);
}
if (fallos) { console.error(`\n${fallos} comprobaciones fallaron`); process.exit(1); }
console.log('\nTodas las comprobaciones estáticas pasaron.');
