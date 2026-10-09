# Visor anatómico 3D

Visor web interactivo del cuerpo humano adulto con cinco capas (piel, músculos, esqueleto, órganos internos y sistema circulatorio),
hecho con modelos reales de [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy). Pensado para Chrome en Android.

**En línea:** <https://roberal82.github.io/visor-anatomico-3d/>

> Esquema ilustrativo, no reemplaza las imágenes ni el criterio del equipo médico.

## Funciones
Rotar (1 dedo), zoom y desplazamiento (2 dedos), selección con información, capas con transparencia, búsqueda por nombre (español),
vistas anterior/posterior/laterales, plano de corte horizontal, restablecer cámara, y el módulo **IR A LA LESIÓN**
(estómago resaltado, región descrita, marcador pulsante calibrado, volver a la vista general).
Calidad adaptable (alta/baja), carga progresiva con indicador, y efectos (oclusión ambiental, brillo) que se apagan solos en equipos lentos.

## Desarrollo
```bash
npm ci
npm run dev        # servidor local (los modelos se sirven desde la raíz)
npm test           # comprobaciones estáticas de los GLB y la configuración
npm run build      # genera dist/ (base /visor-anatomico-3d/)
```
Pruebas en navegador (opcional, requiere Playwright de Python y Chromium): `npm run build && npx vite preview --port 4173` y luego `python3 tests/e2e.py`.

## Cómo actualizar
- **Publicar cambios:** editar en `fuente/`, correr `npm run build` (escribe `index.html` y `assets/` en la raíz) y hacer commit y push a `main`. GitHub Pages sirve la rama `main` desde la raíz; no hace falta tocar su configuración.
- **Textos de la lesión, marcador, cámara y parámetros visuales:** `fuente/src/config/lesion.js`.
  Si cambia el modelo del estómago hay que recalcular la posición y poner `calibrada: false` hasta verificarla (sin calibración no se dibuja el marcador).
- **Regenerar los modelos** (requiere Blender como módulo `bpy`, `fast-simplification` y `numpy`): ver `herramientas/`
  1. `1_extraer_z_anatomy.py` (abre `Startup.blend` de Z-Anatomy y extrae las estructuras),
  2. `2_construir_capas.py -- <salida>` (une, simplifica y exporta GLB en dos calidades),
  3. `3_comprimir.sh <salida>` (Draco → `modelos/`),
  4. `4_verificar_glb.mjs` (comprueba identificadores y cajas).

## Estructura
`modelos/{alta,baja}/*.glb` · `modelos/indice.json` (nombres) · `draco/` (decodificador) · `fuente/src/main.js` · `fuente/src/config/lesion.js`

Fuentes y licencias: [FUENTES-Y-LICENCIAS.md](FUENTES-Y-LICENCIAS.md). Modelos y adaptación: CC BY-SA 4.0.
