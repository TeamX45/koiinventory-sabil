import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'DK Koi — Inventaris Ikan',
        short_name: 'DK Koi',
        description: 'Manajemen inventaris ikan koi: kolam, batch, opname, penjualan, pengeluaran.',
        theme_color: '#06b6d4',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'id',
        scope: '/',
        start_url: '/dashboard',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA fallback supaya navigasi offline tetap render shell
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/up/],
        // Hash-named assets cache forever, sisanya stale-while-revalidate
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/v1\/(grades|fish-types|sales-channels|locations|pond-categories|expense-categories)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-master-data',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        // Jangan cache file > 5 MB (default 2 MB tapi chart vendor 420 KB cukup)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      // Selalu update otomatis tanpa prompt user
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'charts-vendor': ['recharts'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            'lucide-react',
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://nginx:80',
        changeOrigin: true,
      },
    },
  },
});
