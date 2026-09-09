import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the built assets load from Capacitor's file:// origin on
// device; on the web host (Vercel) they resolve from the root just the same.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

export default defineConfig({
  base: './',
  // Single source of truth for the version shown in-app and stamped on the APK.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',        // new deploy → picked up on next open
      includeAssets: ['favicon.svg', 'icons/*.png'],
      // The service worker only does anything on the hosted web build; under
      // Capacitor's local scheme it's inert, so this is safe for both targets.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'ChamaOne — Savings Group Manager',
        short_name: 'ChamaOne',
        description: 'Run your Chama with confidence: transparent contributions, loans, meetings and books everyone can trust.',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
