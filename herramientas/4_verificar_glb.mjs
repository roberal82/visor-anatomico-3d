import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import fs from 'fs';
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
const idx=JSON.parse(fs.readFileSync('/home/claude/zdata/out/indice.json'));
for(const t of ['alta','baja'])for(const l of ['piel','musculos','esqueleto','organos','vasos']){
 const d=await io.read(`/home/claude/visor-anatomico-3d/modelos/${t}/${l}.glb`);
 const p=d.getRoot().listMeshes()[0].listPrimitives()[0];
 const pos=p.getAttribute('POSITION'),st=p.getAttribute('_STRUCT'),col=p.getAttribute('COLOR_0');
 const s=st.getArray();const ids=new Set();for(const v of s)ids.add(Math.round(v));
 const n=idx[t][l].structures.length;
 let mx=0;for(const v of ids)mx=Math.max(mx,v);
 let maxdev=0;for(const v of s)maxdev=Math.max(maxdev,Math.abs(v-Math.round(v)));
 console.log(t,l,'verts',pos.getCount(),'tris',p.getIndices().getCount()/3,'color',!!col,'ids',ids.size,'/',n,'max',mx,'dev',maxdev.toFixed(3),'bbox',pos.getMin([]).map(x=>+x.toFixed(2)),pos.getMax([]).map(x=>+x.toFixed(2)));
}
