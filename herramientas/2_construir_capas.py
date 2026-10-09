"""Etapa B (Blender + fast-simplification): une, simplifica y exporta las 5 capas a GLB (dos niveles de calidad).
Orientación de salida (glTF): Y arriba, el frente del paciente mira a +Z, lado izquierdo del paciente = +X.
Cada vértice lleva el atributo _STRUCT (id de estructura) para poder identificar la pieza al tocarla.
"""
import bpy, pickle, json, csv, re, sys, time, os, numpy as np
import fast_simplification as fs

OUTDIR = sys.argv[sys.argv.index('--') + 1]
os.makedirs(OUTDIR, exist_ok=True)
t0 = time.time()
S = pickle.load(open('/home/claude/zdata/structures.pkl', 'rb'))

TIERS = {
    'alta': {'piel': 45000, 'esqueleto': 230000, 'musculos': 400000, 'organos': 230000, 'vasos': 140000},
    'baja': {'piel': 18000, 'esqueleto': 80000, 'musculos': 140000, 'organos': 90000, 'vasos': 50000},
}
LAYERS = ['piel', 'musculos', 'esqueleto', 'organos', 'vasos']

# ---- nombres en español (Terminologia Anatomica, TA2.csv de Z-Anatomy)
es = {}
raw = open('/home/claude/z-anatomy/models-of-human-anatomy/TA2.csv', encoding='utf-8-sig', errors='replace').read().splitlines()
for line in raw[1:]:
    line = line.strip().strip('"')
    p = line.split(';')
    if len(p) >= 5 and p[1] and p[4]:
        es.setdefault(p[1].strip().lower(), p[4].strip())

def spanish(name):
    base = re.sub(r'\.(l|r)$', '', name)
    side = ' (izq.)' if name.endswith('.l') else ' (der.)' if name.endswith('.r') else ''
    key = base.lower()
    cand = [key, key.strip('()'), re.sub(r'\s*\([^)]*\)$', '', key)]
    for k in cand:
        if k in es:
            return es[k] + side, True
    return base + side, False


def weld(V, F):
    q = np.round(V.astype(np.float64) * 1e5).astype(np.int64)
    _, idx, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    V2 = V[idx]
    F2 = inv.reshape(-1)[F]
    ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    F2 = F2[ok]
    used = np.unique(F2)
    remap = -np.ones(len(V2), np.int64); remap[used] = np.arange(len(used))
    return V2[used], remap[F2].astype(np.int32)


def decimate(V, F, target):
    n = len(F)
    if n <= target or n < 8:
        return V, F
    red = 1.0 - target / n
    try:
        V2, F2 = fs.simplify(V.astype(np.float32), F.astype(np.int32), target_reduction=float(min(red, 0.97)), agg=5)
        if len(F2) < 4:
            return V, F
        return V2.astype(np.float32), F2.astype(np.int32)
    except Exception:
        return V, F


def allot(sizes, budget, min_t):
    """r tal que sum(max(min_t, n*r)) ≈ budget"""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        r = (lo + hi) / 2
        tot = sum(n if n <= min_t else max(min_t, n * r) for n in sizes)
        if tot > budget: hi = r
        else: lo = r
    return lo


# preparar (soldar una sola vez)
prep = {l: [] for l in LAYERS}
for s in S:
    V, F = weld(s['V'], s['F'])
    if len(F) == 0:
        continue
    prep[s['layer']].append({'name': s['name'], 'color': s['color'], 'V': V, 'F': F})
print('soldado', round(time.time() - t0, 1), 's', {l: len(v) for l, v in prep.items()})

if not bpy.data.materials.get('capa'):
    mat = bpy.data.materials.new('capa'); mat.use_nodes = True

index_all = {}
for tier, budgets in TIERS.items():
    index_all[tier] = {}
    for layer in LAYERS:
        items = prep[layer]
        sizes = [len(i['F']) for i in items]
        min_t = 24 if layer == 'vasos' else 40
        r = allot(sizes, budgets[layer], min_t)
        Vs, Fs, Cs, Ids, meta = [], [], [], [], []
        off = 0
        for sid, it in enumerate(items):
            tgt = int(max(min_t, len(it['F']) * r)) if len(it['F']) > min_t else len(it['F'])
            V, F = decimate(it['V'], it['F'], tgt)
            Vs.append(V); Fs.append(F + off); off += len(V)
            Cs.append(np.tile(np.array(it['color'] + (1.0,), np.float32), (len(V), 1)))
            Ids.append(np.full(len(V), sid, np.float32))
            nm_es, ok = spanish(it['name'])
            meta.append({'id': sid, 'en': it['name'], 'es': nm_es, 'tri': int(len(F))})
        V = np.concatenate(Vs); F = np.concatenate(Fs); C = np.concatenate(Cs); I = np.concatenate(Ids)
        # Blender
        me = bpy.data.meshes.new(f'{layer}_{tier}')
        me.vertices.add(len(V)); me.vertices.foreach_set('co', V.ravel())
        me.loops.add(len(F) * 3); me.loops.foreach_set('vertex_index', F.ravel())
        me.polygons.add(len(F))
        me.polygons.foreach_set('loop_start', np.arange(len(F), dtype=np.int32) * 3)
        me.polygons.foreach_set('loop_total', np.full(len(F), 3, np.int32))
        me.polygons.foreach_set('use_smooth', np.ones(len(F), np.bool_))
        me.update(calc_edges=True)
        ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', C.ravel())
        at = me.attributes.new('_STRUCT', 'FLOAT', 'POINT'); at.data.foreach_set('value', I)
        me.materials.append(bpy.data.materials['capa'])
        ob = bpy.data.objects.new(layer, me)
        bpy.context.scene.collection.objects.link(ob)
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True); bpy.context.view_layer.objects.active = ob
        path = os.path.join(OUTDIR, f'{layer}_{tier}.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                                  export_apply=False, export_cameras=False, export_lights=False,
                                  export_materials='EXPORT', export_vertex_color='ACTIVE',
                                  export_attributes=True, export_normals=True,
                                  export_draco_mesh_compression_enable=True,
                                  export_draco_mesh_compression_level=6,
                                  export_draco_position_quantization=14,
                                  export_draco_normal_quantization=9,
                                  export_draco_color_quantization=8,
                                  export_draco_generic_quantization=12)
        bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
        index_all[tier][layer] = {'tris': int(len(F)), 'verts': int(len(V)), 'structures': meta,
                                  'glb': f'modelos/{tier}/{layer}.glb'}
        print(f'{tier:5s} {layer:10s} estructuras={len(items):4d} tris={len(F):>8,} verts={len(V):>8,} '
              f'{os.path.getsize(path)/1e6:5.1f} MB  t={time.time()-t0:5.0f}s', flush=True)

json.dump(index_all, open(os.path.join(OUTDIR, 'indice.json'), 'w'), ensure_ascii=False)
print('listo', round(time.time() - t0, 1), 's')
