import { defineConfig } from 'vite';

export default defineConfig({
  base: '/deep-blue-chess',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
});
