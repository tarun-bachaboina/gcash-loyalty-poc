import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: API runs on :4000; /api and the shared /assets logo are proxied to it.
export default defineConfig({
  base: '/customer/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/assets': 'http://localhost:4000',
    },
  },
});
