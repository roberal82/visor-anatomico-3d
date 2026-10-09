# Fuentes y licencias

## Modelos anatómicos
Todas las geometrías provienen de **Z-Anatomy** (<https://github.com/Z-Anatomy/Models-of-human-anatomy>), atlas anatómico 3D abierto,
publicado bajo **Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)**.
Z-Anatomy deriva de **BodyParts3D** (© The Database Center for Life Science, Japón; licencia **CC BY-SA 2.1 Japón**).
La licencia completa que acompaña al repositorio original está en `public/modelos/LICENCIA-Z-Anatomy.txt`.
Los nombres en español salen de la tabla `TA2.csv` de Z-Anatomy (Terminología Anatómica).

### Qué se modificó (adaptación)
- Se abrió el atlas `Startup.blend` en Blender y se evaluó la geometría de cada estructura (modificadores incluidos).
- Se agruparon las estructuras en cinco capas (piel, músculos, esqueleto, órganos, sistema circulatorio) y se fusionó cada capa en una sola malla,
  conservando un identificador por estructura (atributo `_STRUCT`) y su nombre en `indice.json`.
- Se redujo la cantidad de polígonos (decimación cuadrática) en dos calidades y se comprimió con Draco.
- Se asignaron colores por vértice. **No se usaron texturas.**
- Por la licencia CC BY-SA, **esta adaptación se distribuye bajo CC BY-SA 4.0** y debe mantener esta atribución.

### Qué quedó fuera, y por qué
- Riñones, pelvis renal y oído interno (cóclea, laberinto): la licencia de esas piezas en el atlas figura como no comercial o no verificada.
- Sistema nervioso (incluido el encéfalo): origen/licencia no verificados en el atlas.
- Ganglios linfáticos, inserciones y estructuras de referencia (marcadores del atlas).
- Fuentes consultadas pero no usadas: BodyParts3D directo y Sketchfab (no accesibles desde el entorno de construcción; además Z-Anatomy ya incorpora BodyParts3D).

## Software
- [three.js](https://threejs.org) (MIT) · [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) (MIT) · [Vite](https://vitejs.dev) (MIT)
- Decodificador [Draco](https://github.com/google/draco) (Apache 2.0), incluido en `public/draco/`.
- Código propio de este repositorio: MIT.

## Lesión gástrica
Los datos clínicos que se muestran son únicamente los del informe endoscópico (órgano, región, localización y descripción).
No se muestran ni se inventan histopatología, estadio, metástasis, dimensiones, profundidad de invasión ni extensión.
El marcador es una ubicación aproximada sobre la malla del estómago del atlas; no es una reconstrucción del tumor.
