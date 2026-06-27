import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Generates local HTTPS certificate required for accelerometer and camera permissions in browsers
  ],
  server: {
    host: true, // Listen on all local interfaces to allow mobile device connection
    port: 5173
  }
});
