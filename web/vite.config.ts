import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: {
      // Forward API calls to the Express backend during dev.
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
