import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import stylex from '@stylexjs/rollup-plugin'
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

/**
 * StyleX 的产物 CSS（stylex.css）由 rollup-plugin 在构建期以资产形式产出，
 * 但不会自动挂到页面上；dev 走 babel dev 模式的运行时注入，无需此文件。
 * 这里只在构建时向 index.html 补一条样式表 link。
 */
function stylexHtmlLink(): Plugin {
  let base = '/'
  return {
    name: 'tunetutor-stylex-html-link',
    configResolved(resolved) {
      base = resolved.base
    },
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html
      // 不用 %BASE_URL% 占位符：只对构建期原始 HTML 生效，hook 注入的内容不会被替换
      return html.replace(
        '</head>',
        `    <link rel="stylesheet" href="${base}stylex.css" />\n  </head>`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    brandFavicon(),
    react(),
    // 必须排在 react() 之后：先由 SWC 剥离 TS/JSX，StyleX 再做编译。
    // dev：runtimeInjection 让 babel 以 stylex.inject 运行时注入样式（无 CSS 文件）；
    // build：收集规则由 generateBundle 产出 stylex.css（配合 stylexHtmlLink 挂载）。
    // importSources 收窄到精确包名：默认值含裸词 'stylex'，会把注释里
    // 提到 stylex 的 CSS/文档模块也拖进 Babel 处理而炸掉构建
    stylex({
      dev: command === 'serve',
      runtimeInjection: command === 'serve',
      importSources: ['@stylexjs/stylex'],
    }),
    stylexHtmlLink(),
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
}))

function resolve(_dir: string, file: string) {
  return new URL(file, import.meta.url).href
}
