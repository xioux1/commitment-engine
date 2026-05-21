import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dashboard-dist',
    emptyOutDir: true,
  },
  server: {
    // In dev, proxy /api to the Express backend
    proxy: { '/api': 'http://localhost:3001' },
  },
});
