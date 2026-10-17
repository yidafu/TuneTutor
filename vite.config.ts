import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * 品牌图标的唯一源文件放在 `docs/brand/`（设计资产目录），
 * 构建时产出根路径下的 `logo.svg`，供 favicon 与 PWA manifest 共用。
 * 这样 `public/` 里不必再存一份品牌文件的副本。
 */
function brandFavicon(): Plugin {
  const source = new URL('./docs/brand/tunetutor-app-icon.svg', import.meta.url)
  const read = () => readFileSync(source, 'utf8')

  return {
    name: 'tunetutor-brand-favicon',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (!path.endsWith('/logo.svg')) return next()
        res.setHeader('Content-Type', 'image/svg+xml')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(read())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'logo.svg', source: read() })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    brandFavicon(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2'],
      manifest: {
        name: 'TuneTutor',
        short_name: 'TuneTutor',
        description: 'Music learning application with sheet music support',
        theme_color: '#f0ebdd',
        background_color: '#f0ebdd',
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
