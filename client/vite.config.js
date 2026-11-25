import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Must match the server's API_PORT (default 4100).
const API = `http://localhost:${process.env.API_PORT || 4100}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
