import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'

/**
 * SW 管线守卫:自研 SW(vite-plugin-pwa injectManifest)的构建期契约一旦
 * 回退,离线/更新能力就静默劣化(3 MiB 上限丢失会让 2.1 MiB 主 bundle
 * 静默掉出预缓存)。这里用 fs 直读源码断言关键不变量。
 */
const root = resolve(__dirname, '../..')
const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
const swSource = readFileSync(resolve(root, 'src/sw.ts'), 'utf8')
const precacheSource = readFileSync(resolve(root, 'src/sw/precache.ts'), 'utf8')

describe('PWA SW 构建契约(vite.config.ts)', () => {
  it('使用 injectManifest 模式,入口为 src/sw.ts', () => {
    expect(viteConfig).toContain("strategies: 'injectManifest'")
    expect(viteConfig).toContain("srcDir: 'src'")
    expect(viteConfig).toContain("filename: 'sw.ts'")
  })

  it('预缓存单文件上限保持 3 MiB(主 bundle 2.1 MiB 依赖它)', () => {
    expect(viteConfig).toContain('maximumFileSizeToCacheInBytes: 3 * 1024 * 1024')
  })

  it('预缓存 glob 覆盖 app shell(html/js/css/svg/woff2),不把乐器 mp3 采样拖进预缓存', () => {
    const patterns = /\*\*\/\*\.\{([^}]*)\}/.exec(viteConfig)?.[1] ?? ''
    for (const ext of ['js', 'css', 'html', 'svg', 'woff2']) {
      expect(patterns).toContain(ext)
    }
    expect(viteConfig).not.toContain("'mp3'")
  })

  it('更新模式保持 autoUpdate(activated 后自动刷新)', () => {
    expect(viteConfig).toContain("registerType: 'autoUpdate'")
  })
})

describe('SW 源码契约(src/sw.ts)', () => {
  it('包含注入点 self.__WB_MANIFEST 字面量(workbox-build 按它替换清单,缺失即构建失败)', () => {
    expect(swSource).toContain('self.__WB_MANIFEST')
  })

  it('install 成功后 skipWaiting,activate 时 clients.claim(autoUpdate 页面刷新依赖两者)', () => {
    expect(swSource).toContain('self.skipWaiting()')
    expect(swSource).toContain('self.clients.claim()')
  })

  it('fetch 拦截走 decideFetch 决策,install 走 installPrecacheEntries 重试安装', () => {
    expect(swSource).toContain("addEventListener('fetch'")
    expect(swSource).toContain('decideFetch(')
    expect(swSource).toContain('installPrecacheEntries(')
  })

  it('依赖注入的 fetch 必须绑定全局(裸引用经 deps.fetch 属性调用 = Illegal invocation,SW 安装静默失败)', () => {
    expect(swSource).toContain('fetch.bind(self)')
    expect(swSource).not.toMatch(/^\s+fetch,$/m)
  })

  it('CDN 采样走 runtime 缓存分支(A20):sw.ts 引用 runtime 服务函数与缓存名', () => {
    expect(swSource).toContain('serveFromRuntimeCacheOrNetwork(')
    expect(swSource).toContain('RUNTIME_CACHE_NAME')
    expect(precacheSource).toContain("RUNTIME_CACHE_NAME = 'tt-runtime'")
    // allowlist 只认 jsdelivr 的 tonejs-instrument mp3,其余跨源一律不拦截
    expect(precacheSource).toContain("url.hostname === 'cdn.jsdelivr.net'")
    expect(precacheSource).toContain("url.pathname.startsWith('/npm/tonejs-instrument-')")
    expect(precacheSource).toContain("url.pathname.endsWith('.mp3')")
  })

  it('activate 清理旧版缓存(workbox-precache 前缀)', () => {
    expect(swSource).toContain("addEventListener('activate'")
    expect(precacheSource).toContain('workbox-precache')
  })
})

describe('SW 安装重试契约(src/sw/precache.ts)', () => {
  it('cache.put 前必须整读响应体(修复 Chrome 流式 put 的 NetworkError)', () => {
    const putAt = precacheSource.indexOf('cache.put(')
    const bufferedAt = precacheSource.indexOf('await response.arrayBuffer()')
    expect(putAt).toBeGreaterThan(-1)
    expect(bufferedAt).toBeGreaterThan(-1)
    expect(bufferedAt).toBeLessThan(putAt)
  })

  it('fetch 带 reload 语义(重装时不吃 HTTP 缓存的旧资源)', () => {
    expect(precacheSource).toContain("cache: 'reload'")
  })
})
