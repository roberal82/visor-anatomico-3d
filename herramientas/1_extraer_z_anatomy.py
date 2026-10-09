"""Etapa A (Blender): extrae geometría evaluada del atlas Z-Anatomy, por estructura y por capa.
Salida: /home/claude/zdata/structures.pkl  (lista de dicts con V, F en coordenadas mundo, metros, Z arriba, frente -Y)
"""
import bpy, pickle, time, re, hashlib, numpy as np, sys

SRC = "/home/claude/zdata/Z-Anatomy/Startup.blend"
OUT = "/home/claude/zdata/structures.pkl"
t0 = time.time()
bpy.context.preferences.filepaths.use_scripts_auto_execute = False   # nunca ejecutar scripts de un .blend ajeno
bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)

SKIP_SUFFIX = ('.j', '.g', '.i', '.t', '.s')
# Licencias no verificadas o no compatibles con CC BY-SA 4.0 (ver README del repo Z-Anatomy):
EXCLUDE_WORDS = ('kidney', 'renal pelvis', 'cochlea', 'cochlear', 'vestibul', 'semicircular', 'labyrinth',
                 'utricle', 'saccule', 'ampulla of')
HEART_WORDS = ('ventricle', 'atrium', 'atrial', 'leaflet', 'papillary', 'semilunar', 'valve', 'chordae')
LYMPH_ORGANS = ('Spleen', 'Left lobe of thymus', 'Right lobe of thymus', 'Palatine tonsil.l', 'Palatine tonsil.r')


def layer_of(o, top):
    n = o.name
    nl = n.lower()
    if n.endswith(SKIP_SUFFIX) or o.type not in ('MESH', 'CURVE'):
        return None
    if any(w in nl for w in EXCLUDE_WORDS):
        return None
    if top.startswith('9:'):
        return 'piel' if o.type == 'MESH' else None
    if top.startswith('1:') or top.startswith('3:'):
        return 'esqueleto'
    if top.startswith('4:'):
        return 'musculos'
    if top.startswith('8:'):
        return 'organos'
    if top.startswith('6:'):
        return 'organos' if n in LYMPH_ORGANS else None
    if top.startswith('5:'):
        if o.type == 'MESH' and any(w in nl for w in HEART_WORDS):
            return 'organos'
        return 'vasos'
    return None     # sistema nervioso, nodos linfáticos, inserciones, referencias: fuera de esta versión


# ---- colecciones: ruta de cada objeto + visibilidad total para poder evaluarlos
top_of = {}
def walk(c, top):
    for o in c.objects:
        top_of.setdefault(o.name, top)
    for ch in c.children:
        walk(ch, top)
for ch in bpy.context.scene.collection.children:
    walk(ch, ch.name)

vl = bpy.context.view_layer
def unhide(lc):
    lc.exclude = False
    lc.hide_viewport = False
    lc.collection.hide_viewport = False
    for ch in lc.children:
        unhide(ch)
unhide(vl.layer_collection)
for o in bpy.data.objects:
    o.hide_viewport = False
    try:
        o.hide_set(False)
    except RuntimeError:
        pass
    if o.type == 'CURVE':
        o.data.resolution_u = min(o.data.resolution_u, 4)          # menos subdivisiones a lo largo del vaso
        o.data.bevel_resolution = min(o.data.bevel_resolution, 2)  # sección más liviana
    if o.type == 'MESH':
        raw = len(o.data.polygons)
        for m in o.modifiers:
            if m.type == 'SOLIDIFY':
                m.show_viewport = False          # láminas finas: se dibujan a doble cara
            elif m.type == 'SUBSURF':
                m.levels = 1 if raw < 6000 else 0
                m.show_viewport = m.levels > 0

dg = bpy.context.evaluated_depsgraph_get()
print("depsgraph listo", round(time.time() - t0, 1), "s")


def pick_color(layer, name, mats):
    nl = name.lower()
    ml = ' '.join(mats).lower()
    h = int(hashlib.md5(name.encode()).hexdigest()[:6], 16) / 0xFFFFFF
    j = 0.92 + 0.16 * h                                   # variación leve para distinguir piezas vecinas
    def c(r, g, b): return (min(r * j, 1), min(g * j, 1), min(b * j, 1))
    if layer == 'piel':
        if 'hair' in nl: return (0.12, 0.08, 0.06)
        return (0.86, 0.64, 0.54)
    if layer == 'esqueleto':
        if 'teeth' in ml or 'tooth' in nl or 'teeth' in nl: return (0.95, 0.94, 0.88)
        if 'cartilage' in ml or 'cartilage' in nl or 'disc' in nl: return c(0.62, 0.78, 0.84)
        if 'ligament' in ml or 'ligament' in nl or 'capsule' in nl or 'membrane' in nl: return c(0.86, 0.80, 0.55)
        if 'bursa' in ml or 'synovial' in nl: return (0.30, 0.70, 0.80)
        return c(0.90, 0.86, 0.74)
    if layer == 'musculos':
        if any(w in nl for w in ('tendon', 'aponeurosis', 'fascia', 'tract', 'retinaculum', 'sheath',
                                 'linea alba', 'raphe', 'ligament')) or 'tendon' in ml or 'fascia' in ml:
            return c(0.93, 0.87, 0.78)
        return c(0.66, 0.16, 0.12)
    if layer == 'vasos':
        if 'pulmonary' in nl and 'artery' in nl: return c(0.40, 0.25, 0.80)
        if 'vein' in nl or 'venous' in nl or 'sinus' in nl or 'vena' in nl or 'vein' in ml: return c(0.17, 0.26, 0.78)
        return c(0.80, 0.13, 0.13)
    # órganos
    table = [('liver', (0.45, 0.15, 0.09)), ('stomach', (0.84, 0.46, 0.43)), ('lung', (0.86, 0.58, 0.58)),
             ('bronch', (0.80, 0.78, 0.74)), ('trachea', (0.82, 0.80, 0.76)), ('spleen', (0.40, 0.10, 0.20)),
             ('pancreas', (0.88, 0.68, 0.38)), ('gallbladder', (0.28, 0.45, 0.20)), ('bile', (0.35, 0.50, 0.22)),
             ('duoden', (0.88, 0.58, 0.45)), ('jejun', (0.90, 0.55, 0.50)), ('ileum', (0.88, 0.55, 0.50)),
             ('colon', (0.80, 0.50, 0.40)), ('caecum', (0.80, 0.50, 0.40)), ('append', (0.80, 0.50, 0.40)),
             ('oesophag', (0.86, 0.50, 0.46)), ('bladder', (0.88, 0.76, 0.52)), ('ureter', (0.92, 0.82, 0.55)),
             ('urethra', (0.92, 0.82, 0.55)), ('thyroid', (0.78, 0.32, 0.20)), ('thymus', (0.88, 0.80, 0.55)),
             ('tonsil', (0.85, 0.45, 0.42)), ('tongue', (0.82, 0.36, 0.36)), ('prostate', (0.82, 0.58, 0.40)),
             ('testis', (0.85, 0.75, 0.60)), ('omentum', (0.95, 0.88, 0.60)), ('pleura', (0.78, 0.84, 0.90)),
             ('gland', (0.84, 0.50, 0.28))]
    for k, col in table:
        if k in nl: return c(*col)
    if any(w in nl for w in HEART_WORDS) or 'heart' in nl: return c(0.72, 0.12, 0.13)
    return c(0.82, 0.55, 0.50)


out = []
skipped = 0
for o in bpy.data.objects:
    top = top_of.get(o.name, '')
    layer = layer_of(o, top)
    if layer is None:
        continue
    try:
        oe = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(oe, preserve_all_data_layers=False, depsgraph=dg)
    except Exception as e:
        skipped += 1
        continue
    if me is None or len(me.polygons) == 0:
        if me is not None: bpy.data.meshes.remove(me)
        skipped += 1
        continue
    me.calc_loop_triangles()
    nv, nt = len(me.vertices), len(me.loop_triangles)
    V = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', V); V = V.reshape(-1, 3)
    F = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('vertices', F); F = F.reshape(-1, 3)
    M = np.array(o.matrix_world, np.float64)
    V = (V.astype(np.float64) @ M[:3, :3].T + M[:3, 3]).astype(np.float32)
    mats = [s.material.name for s in o.material_slots if s.material]
    out.append({'name': o.name, 'layer': layer, 'type': o.type, 'coll': top, 'mats': mats,
                'color': pick_color(layer, o.name, mats), 'V': V, 'F': F})
    bpy.data.meshes.remove(me)

pickle.dump(out, open(OUT, 'wb'))
from collections import Counter
cnt = Counter(s['layer'] for s in out); tri = Counter()
for s in out: tri[s['layer']] += len(s['F'])
print("estructuras", len(out), "saltadas", skipped)
for k in cnt: print(f"  {k:10s} {cnt[k]:5d} estructuras  {tri[k]:>9,} triángulos")
print("tiempo", round(time.time() - t0, 1), "s")
