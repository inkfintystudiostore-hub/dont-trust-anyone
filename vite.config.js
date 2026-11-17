import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // works from any sub-path / iframe on the store
  build: {
    target: 'es2022', // top-level await in src/main.js
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
      '/api': { target: 'http://127.0.0.1:8787' },
    },
  },
  test: { include: ['src/**/*.test.js', 'worker/**/*.test.js'] },
});
