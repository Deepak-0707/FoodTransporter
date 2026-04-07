import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to backend in development
    proxy: {
      '/auth': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/bookings': {   // ← ADD THIS
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/requests':{
        target:'http://localhost:5001',
        changeOrigin:true,
      },
      '/notifications': {
        target:      'http://localhost:5001',
        changeOrigin: true,
      },
      // Socket.io — must proxy with ws:true for WebSocket handshake
      '/socket.io': {
        target:      'http://localhost:5001',
        changeOrigin: true,
        ws:           true,
      },
    },
  },
  build: {
    outDir:    'dist',
    sourcemap: false,
  },
});
