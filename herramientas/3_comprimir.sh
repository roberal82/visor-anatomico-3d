#!/usr/bin/env bash
# Comprime con Draco los GLB generados por 2_construir_capas.py y los deja en modelos/{alta,baja}/
# Uso: herramientas/3_comprimir.sh <carpeta_con_GLB_sin_comprimir>
set -euo pipefail
ORIGEN="${1:?indicá la carpeta con los GLB sin comprimir}"
DESTINO="$(dirname "$0")/../public/modelos"
for t in alta baja; do
  mkdir -p "$DESTINO/$t"
  for l in piel musculos esqueleto organos vasos; do
    npx --yes @gltf-transform/cli draco "$ORIGEN/${l}_$t.glb" "$DESTINO/$t/$l.glb" \
      --method edgebreaker --quantize-position 14 --quantize-normal 9 --quantize-color 8 --quantize-generic 12
  done
done
cp "$ORIGEN/indice.json" "$DESTINO/indice.json"
