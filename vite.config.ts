import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'logo.svg'],
      manifest: {
        name: 'TuneTutor',
        short_name: 'TuneTutor',
        description: 'Music learning application with sheet music support',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/TuneTutor/',
        start_url: '/TuneTutor/',
        icons: [
          {
            src: 'logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  base: '/TuneTutor/',
  resolve: {
    alias: {
      // Provide browser-compatible stubs for Node.js modules used by musicxml-io
      'fs/promises': resolve(__dirname, 'src/vite-browser-shims/fs-promises.ts'),
    },
  },
  optimizeDeps: {
  },
})

function resolve(_dir: string, file: string) {
  return new URL(file, import.meta.url).href
}
