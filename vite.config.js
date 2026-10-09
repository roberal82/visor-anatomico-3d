import { defineConfig } from 'vite';
// Las fuentes están en fuente/. La compilación se escribe en la raíz del repositorio porque
// GitHub Pages de este repo publica la rama main desde la raíz (modelos/ y draco/ ya viven ahí).
export default defineConfig({
  root: 'fuente',
  base: '/visor-anatomico-3d/',
  publicDir: false,
  build: { outDir: '..', emptyOutDir: false, chunkSizeWarningLimit: 900, assetsDir: 'assets' },
  server: { fs: { allow: ['..'] } },
});
