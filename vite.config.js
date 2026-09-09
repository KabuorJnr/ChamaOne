import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built assets load from Capacitor's file:// origin on device.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
});
