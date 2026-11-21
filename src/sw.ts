/**
 * 自研 Service Worker(vite-plugin-pwa `injectManifest` 模式)。
 *
 * 更新语义与 generateSW 的 autoUpdate 一致:install 全量预缓存成功后
 * skipWaiting,activate 清理旧缓存并 clients.claim;页面端 registerSW
 * (autoUpdate 内联注册脚本)在 `activated` 事件后自动整页刷新。
 * install 失败(重试耗尽)则整个 install 事件失败:新 SW 被丢弃,旧 SW
 * 继续服务,下次访问重装——绝不半量激活。
 *
 * 预缓存清单由 workbox-build 在构建期注入:下方 `self.__WB_MANIFEST`
 * 字面量会被替换为 {url, revision} 数组(见 src/sw/precache.ts 顶部说明)。
 */
import {
  buildPrecacheIndex,
  decideFetch,
  installPrecacheEntries,
  LEGACY_CACHE_PREFIXES,
  PRECACHE_CACHE_NAME,
  RUNTIME_CACHE_NAME,
  serveFromPrecacheOrNetwork,
  serveFromRuntimeCacheOrNetwork,
} from './sw/precache'
import type { PrecacheEntry } from './sw/precache'

/**
 * TS 5.9 起 lib.dom 移除了 ServiceWorker 专属类型(移入 lib.webworker);
 * 为不把 webworker lib 混进全程序(与 DOM lib 双份全局冲突),这里自持
 * SW 运行时实际用到的最小接口面。lib.dom 保留的 CacheStorage /
 * ServiceWorkerRegistration / Request / Response / fetch 直接复用。
 */
interface SWExtendableEvent {
  waitUntil(promise: Promise<unknown>): void
}

interface SWFetchEvent {
  request: Request
  respondWith(response: Response | Promise<Response>): void
}

interface SWScope {
  /** workbox-build 构建期注入点:被替换为 {url, revision} 清单数组 */
  __WB_MANIFEST: readonly PrecacheEntry[]
  registration: ServiceWorkerRegistration
  caches: CacheStorage
  skipWaiting(): Promise<void>
  clients: { claim(): Promise<void> }
  addEventListener(type: 'install' | 'activate', listener: (event: SWExtendableEvent) => void): void
  addEventListener(type: 'fetch', listener: (event: SWFetchEvent) => void): void
}

declare const self: SWScope

const manifest = self.__WB_MANIFEST
const index = buildPrecacheIndex(manifest)
const scope = self.registration.scope

self.addEventListener('install', (event) => {
  event.waitUntil(
    installPrecacheEntries(manifest, {
      baseUrl: scope,
      fetch,
      openCache: () => self.caches.open(PRECACHE_CACHE_NAME),
    }).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name !== PRECACHE_CACHE_NAME && LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)),
            )
            .map((name) => self.caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const decision = decideFetch(
    event.request.url,
    event.request.method,
    event.request.mode,
    event.request.headers.get('range'),
    scope,
    index,
  )
  if (decision.kind === 'ignore') return
  // CDN 采样 mp3(A20):runtime 缓存 cache-first,离线可用;其余同源走 precache/网络
  if (decision.kind === 'runtime') {
    event.respondWith(
      serveFromRuntimeCacheOrNetwork(event.request, {
        openCache: () => self.caches.open(RUNTIME_CACHE_NAME),
        fetch,
      }),
    )
    return
  }
  event.respondWith(
    serveFromPrecacheOrNetwork(decision, event.request, {
      openCache: () => self.caches.open(PRECACHE_CACHE_NAME),
      fetch,
    }),
  )
})
