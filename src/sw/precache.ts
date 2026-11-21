/**
 * 自研 precache 缓存层(vite-plugin-pwa injectManifest 模式的 SW 运行时)。
 *
 * 为什么不用 workbox-precaching:vite-plugin-pwa 只携带 workbox-build/window,
 * 运行时 workbox 模块在 pnpm 隔离的 node_modules 里无法从业务源码解析;
 * 且 workbox 的 PrecacheStrategy 对 cache.put 失败没有任何插件钩子,
 * 无法对「响应体传输中断」做重试(Chrome 报
 * "Failed to execute 'put' on 'Cache': Cache.put() encountered a network error",
 * 整个 install 即失败)。本模块:先整读响应体再 put(把断流变成可捕获的
 * fetch 阶段错误)+ 指数退避有限次重试。
 *
 * 构建期契约(workbox-build injectManifest):sw.ts 里的 `self.__WB_MANIFEST`
 * 字面量被替换为 {url, revision} 数组——assets/*(hashed)revision 为 null,
 * 其余文件(index.html、fonts/* 等)revision 为内容哈希。
 */

export interface PrecacheEntry {
  url: string
  revision: string | null
}

/**
 * 缓存名:activate 时按 `tt-precache` / `workbox-precache` 前缀清理旧缓存,
 * 版本号变更可强制全体重装(整个 app shell 都在这里,体积 ~3 MiB,不需要分片)。
 */
export const PRECACHE_CACHE_NAME = 'tt-precache-v1'
/**
 * CDN 采样运行时缓存(A20):cache-first 持久化 jsdelivr 采样 mp3,离线可用。
 * 刻意不带版本后缀:条目键是完整 URL(含包@版本),采样包升级后旧条目自然失活
 * 不再被命中;策略本身若变更,改名并加入 LEGACY_CACHE_PREFIXES 让 activate 清理。
 */
export const RUNTIME_CACHE_NAME = 'tt-runtime'
/** 需要在 activate 阶段清掉的旧缓存名前缀(含旧版 generateSW 的 workbox 缓存) */
export const LEGACY_CACHE_PREFIXES = ['workbox-precache', 'tt-precache'] as const

/** 安装重试参数:首次尝试后最多再试 retries 次,退避 base * 2^(n-1) */
export interface InstallRetryOptions {
  retries: number
  baseDelayMs: number
}

export const INSTALL_RETRY_DEFAULTS: InstallRetryOptions = { retries: 2, baseDelayMs: 500 }

/** 与 workbox 同款 cache key:带 revision 的条目追加 __WB_REVISION__ 查询参数 */
export function createPrecacheKey(entry: PrecacheEntry): string {
  return entry.revision ? `${entry.url}?__WB_REVISION__=${entry.revision}` : entry.url
}

/** 相对 URL → cache key 索引,供 fetch 拦截时按路径查找 */
export function buildPrecacheIndex(entries: readonly PrecacheEntry[]): Map<string, string> {
  return new Map(entries.map((entry) => [entry.url, createPrecacheKey(entry)]))
}

export type FetchDecision =
  | { kind: 'precache'; cacheKey: string }
  | { kind: 'navigate'; cacheKey: string | null }
  | { kind: 'runtime' }
  | { kind: 'ignore' }

/**
 * CDN 采样 allowlist(A20):jsdelivr 上 tonejs-instrument 包族的采样 mp3。
 * 只认这条路径形态(包名前缀 + .mp3 后缀),其余跨源请求一律不拦截。
 */
export function isCdnSampleUrl(url: URL): boolean {
  return (
    url.hostname === 'cdn.jsdelivr.net' &&
    url.pathname.startsWith('/npm/tonejs-instrument-') &&
    url.pathname.endsWith('.mp3')
  )
}

/**
 * 纯函数决策:该请求是否由 SW 应答。
 * - 导航请求:scope 下任意路径都回 precache 的 index.html(HashRouter SPA,
 *   没有真实子路径;离线打开/刷新也能拿到 app shell);
 * - 同源 GET 且无 Range 头、路径命中索引:回 precache;
 * - CDN 采样 mp3(GET 且无 Range):回 runtime 缓存(cache-first,离线可用);
 * - 其余(跨源、非 GET、Range 流式加载、未命中):不拦截,交给浏览器默认网络。
 */
export function decideFetch(
  requestUrl: string,
  method: string,
  mode: string,
  rangeHeader: string | null,
  scope: string,
  index: ReadonlyMap<string, string>,
): FetchDecision {
  if (method !== 'GET' || rangeHeader !== null) return { kind: 'ignore' }
  let url: URL
  let scopeUrl: URL
  try {
    url = new URL(requestUrl)
    scopeUrl = new URL(scope)
  } catch {
    return { kind: 'ignore' }
  }
  // CDN 采样放行在同源检查之前:跨源但命中 allowlist 的请求由 runtime 层接管
  if (isCdnSampleUrl(url)) return { kind: 'runtime' }
  if (url.origin !== scopeUrl.origin) return { kind: 'ignore' }
  const scopeDir = scopeUrl.pathname // '/TuneTutor/'
  // '/TuneTutor'(无斜杠根路径,Pages 会 302 到带斜杠的)也算导航
  const inScope = url.pathname === scopeDir.slice(0, -1) || url.pathname.startsWith(scopeDir)
  if (!inScope) return { kind: 'ignore' }
  if (mode === 'navigate') return { kind: 'navigate', cacheKey: index.get('index.html') ?? null }
  if (!url.pathname.startsWith(scopeDir)) return { kind: 'ignore' }
  const cacheKey = index.get(url.pathname.slice(scopeDir.length)) ?? null
  return cacheKey ? { kind: 'precache', cacheKey } : { kind: 'ignore' }
}

/** Cache 的结构化最小接口:真实 Cache 可直接赋值,测试注入 stub */
export interface CacheLike {
  put(key: string, body: Response): Promise<void>
  match(key: string): Promise<Response | undefined>
}

/** fetch 应答的结构化最小接口:真实 Response 可直接赋值,测试注入 stub */
export interface FetchResponseLike {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  /** 真实 Response 有值('cors'/'basic'/'opaque'…);测试 stub 可省略 */
  readonly type?: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface InstallDeps {
  /** SW 的 scope(绝对 URL),用于把清单里的相对 url 解析为绝对 url */
  baseUrl: string
  fetch: (input: string, init?: { cache?: 'reload' }) => Promise<FetchResponseLike>
  openCache: () => Promise<CacheLike>
  /** 测试注入:从缓冲好的响应体重建 Response(jsdom 无 Response 全局) */
  makeResponse?: (body: ArrayBuffer, source: FetchResponseLike) => Response
  /** 测试注入:退避延时 */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const defaultMakeResponse = (body: ArrayBuffer, source: FetchResponseLike) =>
  new Response(body, { status: source.status, statusText: source.statusText, headers: source.headers })

/**
 * 全量预缓存:并发逐条 fetch(绕过 HTTP 缓存)→ 整读响应体 → put;
 * 单条失败(fetch 网络错误、非 2xx、put 失败)按 retry 重试,耗尽则整体
 * install 失败(新 SW 被丢弃、旧 SW 继续服务,下次访问重装——绝不半量激活)。
 */
export async function installPrecacheEntries(
  entries: readonly PrecacheEntry[],
  deps: InstallDeps,
  retry: InstallRetryOptions = INSTALL_RETRY_DEFAULTS,
): Promise<void> {
  // includeAssets(public 目录)与 dist glob 可能对同一文件各出一条(字体等),按 url 去重
  const unique = [...new Map(entries.map((entry) => [entry.url, entry])).values()]
  const cache = await deps.openCache()
  const sleep = deps.sleep ?? defaultSleep
  const makeResponse = deps.makeResponse ?? defaultMakeResponse
  await Promise.all(
    unique.map(async (entry) => {
      const cacheKey = createPrecacheKey(entry)
      const requestUrl = new URL(entry.url, deps.baseUrl).href
      let lastError: unknown = new Error(`precache entry not attempted: ${entry.url}`)
      for (let attempt = 0; attempt <= retry.retries; attempt += 1) {
        if (attempt > 0) await sleep(retry.baseDelayMs * 2 ** (attempt - 1))
        try {
          const response = await deps.fetch(requestUrl, { cache: 'reload' })
          if (!response.ok) throw new Error(`precache fetch ${entry.url} -> HTTP ${response.status}`)
          // 关键:先完整读出响应体再 put(cache.put 本身是流式消费,断流时报错不可重试)
          const body = await response.arrayBuffer()
          await cache.put(cacheKey, makeResponse(body, response))
          return
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    }),
  )
}

export interface ServeDeps {
  openCache: () => Promise<CacheLike>
  fetch: (input: Request) => Promise<Response>
}

/** precache 命中则回缓存;未命中(首装未完成等)回退网络,保证可用性 */
export async function serveFromPrecacheOrNetwork(
  decision: Exclude<FetchDecision, { kind: 'ignore' } | { kind: 'runtime' }>,
  request: Request,
  deps: ServeDeps,
): Promise<Response> {
  if (decision.cacheKey) {
    const cache = await deps.openCache()
    const cached = await cache.match(decision.cacheKey)
    if (cached) return cached
  }
  return deps.fetch(request)
}

export interface RuntimeServeDeps {
  openCache: () => Promise<CacheLike>
  fetch: (input: Request) => Promise<FetchResponseLike>
  /** 测试注入:从缓冲好的响应体重建 Response(jsdom 无 Response 全局) */
  makeResponse?: (body: ArrayBuffer, source: FetchResponseLike) => Response
}

/**
 * CDN 采样应答(A20):cache-first 于 RUNTIME_CACHE_NAME。
 * 未命中 → 网络 fetch → 非 opaque 且 2xx 时整读响应体后 put 再应答
 * (与 install 同纪律:cache.put 是流式消费,断流报错不可重试,先读后 put
 * 把它变成可捕获的 fetch 阶段错误,且绝不缓存半截响应)。
 * put 失败不影响本次应答(采样照常播,下次访问再尝试缓存)。
 */
export async function serveFromRuntimeCacheOrNetwork(
  request: Request,
  deps: RuntimeServeDeps,
): Promise<Response> {
  const cache = await deps.openCache()
  const cached = await cache.match(request.url)
  if (cached) return cached
  const response = await deps.fetch(request)
  const makeResponse = deps.makeResponse ?? defaultMakeResponse
  // opaque(CORS 失败的跨源应答)put 后读回 ~0 字节,非 2xx 无缓存价值:直接透传
  if (!response.ok || response.type === 'opaque') return makeResponse(await response.arrayBuffer(), response)
  const body = await response.arrayBuffer()
  try {
    await cache.put(request.url, makeResponse(body, response))
  } catch {
    // 运行时缓存尽力而为:put 失败不阻塞播放
  }
  return makeResponse(body, response)
}
