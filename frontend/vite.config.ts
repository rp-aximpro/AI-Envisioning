import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number.parseInt(process.env.WEB_PORT ?? '5173', 10),
    watch: {
      usePolling: true,
      interval: 500,
    },
    proxy: {
      '/api': process.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
