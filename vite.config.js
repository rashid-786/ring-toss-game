import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Read PORT from .env so the Socket.IO proxy matches the server port.
    var env = loadEnv(mode, process.cwd(), '');
    var serverPort = Number(env.PORT) || 3001;
    return {
        plugins: [react()],
        base: './',
        server: {
            port: 5173,
            proxy: {
                '/socket.io': {
                    target: "http://localhost:".concat(serverPort),
                    ws: true,
                },
            },
        },
    };
});
