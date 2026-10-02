import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read PORT from .env so the Socket.IO proxy matches the server port.
  const env = loadEnv(mode, process.cwd(), '');
  const serverPort = Number(env.PORT) || 3001;

  return {
    plugins: [react()],
    base: './',
    server: {
      port: 5173,
      proxy: {
        '/socket.io': {
          target: `http://localhost:${serverPort}`,
          ws: true,
        },
      },
    },
  };
});