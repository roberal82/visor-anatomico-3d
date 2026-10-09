import { defineConfig } from 'vite';
export default defineConfig({
  base: '/visor-anatomico-3d/',
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
