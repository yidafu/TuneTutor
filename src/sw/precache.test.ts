import { describe, expect, it, vi } from 'vitest'
import {
  buildPrecacheIndex,
  createPrecacheKey,
  decideFetch,
  installPrecacheEntries,
  INSTALL_RETRY_DEFAULTS,
  serveFromPrecacheOrNetwork,
} from './precache'
import type { CacheLike, FetchResponseLike, InstallDeps, PrecacheEntry } from './precache'

const SCOPE = 'https://yidafu.github.io/TuneTutor/'

/** 构造结构化假响应(jsdom 无 Response 全局) */
function fakeResponse(init: { status?: number; body?: string } = {}): FetchResponseLike {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: { get: () => null } as unknown as Headers,
    arrayBuffer: async () => new TextEncoder().encode(init.body ?? '').buffer as ArrayBuffer,
  }
}

const EMPTY_MANIFEST: readonly PrecacheEntry[] = [
  { url: 'index.html', revision: 'hash-html' },
  { url: 'assets/index-x.js', revision: null },
  { url: 'fonts/bravura.woff2', revision: 'hash-bravura' },
]

function noopDeps(): InstallDeps {
  return {
    baseUrl: SCOPE,
    fetch: async () => fakeResponse(),
    openCache: async () => stubCache(),
    makeResponse: () => ({}) as Response,
  }
}

function stubCache(entries = new Map<string, Response>()): CacheLike {
  return {
    put: async (key, body) => {
      entries.set(key, body)
    },
    match: async (key) => entries.get(key),
  }
}

describe('createPrecacheKey', () => {
  it('带 revision 的条目追加 __WB_REVISION__ 查询参数', () => {
    expect(createPrecacheKey({ url: 'fonts/bravura.woff2', revision: 'abc123' })).toBe(
      'fonts/bravura.woff2?__WB_REVISION__=abc123',
    )
  })

  it('hashed 资产(revision null)保持原 URL', () => {
    expect(createPrecacheKey({ url: 'assets/index-x.js', revision: null })).toBe('assets/index-x.js')
  })
})

describe('buildPrecacheIndex', () => {
  it('建立 相对 URL → cache key 索引', () => {
    const index = buildPrecacheIndex(EMPTY_MANIFEST)
    expect(index.get('assets/index-x.js')).toBe('assets/index-x.js')
    expect(index.get('index.html')).toBe('index.html?__WB_REVISION__=hash-html')
  })
})

describe('decideFetch', () => {
  const index = buildPrecacheIndex(EMPTY_MANIFEST)

  it('导航请求回 precache 的 index.html(含 query 参数的导航同样命中)', () => {
    expect(decideFetch(`${SCOPE}?lang=zh-CN`, 'GET', 'navigate', null, SCOPE, index)).toEqual({
      kind: 'navigate',
      cacheKey: 'index.html?__WB_REVISION__=hash-html',
    })
    expect(decideFetch(`${SCOPE}`, 'GET', 'navigate', null, SCOPE, index)).toEqual({
      kind: 'navigate',
      cacheKey: 'index.html?__WB_REVISION__=hash-html',
    })
    // 无斜杠根路径(Pages 会 302)也算 scope 内导航
    expect(decideFetch('https://yidafu.github.io/TuneTutor', 'GET', 'navigate', null, SCOPE, index).kind).toBe(
      'navigate',
    )
  })

  it('scope 内 GET 命中索引则回 precache,query/hash 不影响命中', () => {
    expect(decideFetch(`${SCOPE}assets/index-x.js`, 'GET', 'cors', null, SCOPE, index)).toEqual({
      kind: 'precache',
      cacheKey: 'assets/index-x.js',
    })
    expect(decideFetch(`${SCOPE}fonts/bravura.woff2?v=2#frag`, 'GET', 'cors', null, SCOPE, index)).toEqual({
      kind: 'precache',
      cacheKey: 'fonts/bravura.woff2?__WB_REVISION__=hash-bravura',
    })
    expect(decideFetch(`${SCOPE}index.html`, 'GET', 'same-origin', null, SCOPE, index).kind).toBe('precache')
  })

  it('未命中索引的路径、scope 外路径、跨源请求不拦截', () => {
    expect(decideFetch(`${SCOPE}assets/unknown.js`, 'GET', 'cors', null, SCOPE, index).kind).toBe('ignore')
    expect(decideFetch(`${SCOPE}twinkle-twinkle-little-star.musicxml`, 'GET', 'cors', null, SCOPE, index).kind).toBe(
      'ignore',
    )
    expect(decideFetch('https://yidafu.github.io/other/page.js', 'GET', 'cors', null, SCOPE, index).kind).toBe('ignore')
    expect(decideFetch('https://example.com/TuneTutor/assets/index-x.js', 'GET', 'cors', null, SCOPE, index).kind).toBe(
      'ignore',
    )
  })

  it('非 GET、带 Range 头(流式音频加载)、非法 URL 不拦截', () => {
    expect(decideFetch(`${SCOPE}assets/index-x.js`, 'POST', 'cors', null, SCOPE, index).kind).toBe('ignore')
    expect(decideFetch(`${SCOPE}assets/index-x.js`, 'GET', 'cors', 'bytes=0-1023', SCOPE, index).kind).toBe('ignore')
    expect(decideFetch('not-a-url', 'GET', 'cors', null, SCOPE, index).kind).toBe('ignore')
  })
})

describe('installPrecacheEntries', () => {
  function captureSleeps() {
    const sleeps: number[] = []
    const sleep = async (ms: number) => {
      sleeps.push(ms)
    }
    return { sleeps, sleep }
  }

  it('成功:按 cache key put,makeResponse 收到整读后的响应体与源状态', async () => {
    const put = vi.fn(async () => {})
    const makeResponse = vi.fn(
      (body: ArrayBuffer, source: FetchResponseLike) =>
        ({ buffered: new TextDecoder().decode(body), status: source.status }) as unknown as Response,
    )
    const cache: CacheLike = { put, match: async () => undefined }
    await installPrecacheEntries(
      [{ url: 'assets/index-x.js', revision: null }],
      { ...noopDeps(), openCache: async () => cache, makeResponse },
    )
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledWith('assets/index-x.js', expect.anything())
    const [body, source] = makeResponse.mock.calls[0]
    expect(new TextDecoder().decode(body)).toBe('') // fakeResponse 默认空体
    expect(source.status).toBe(200)
  })

  it('fetch 以 reload 绕过 HTTP 缓存,并以 scope 解析为绝对 URL', async () => {
    const fetchSpy = vi.fn(async () => fakeResponse({ body: 'ok' }))
    await installPrecacheEntries([{ url: 'index.html', revision: 'h1' }], {
      ...noopDeps(),
      fetch: fetchSpy as unknown as InstallDeps['fetch'],
    })
    expect(fetchSpy).toHaveBeenCalledWith('https://yidafu.github.io/TuneTutor/index.html', { cache: 'reload' })
  })

  it('瞬时网络错误按指数退避重试后成功', async () => {
    const { sleeps, sleep } = captureSleeps()
    let attempts = 0
    const fetchSpy = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) throw new TypeError('Failed to fetch')
      return fakeResponse({ body: 'ok' })
    })
    const put = vi.fn(async () => {})
    await installPrecacheEntries(
      [{ url: 'assets/index-x.js', revision: null }],
      { ...noopDeps(), fetch: fetchSpy as unknown as InstallDeps['fetch'], openCache: async () => ({ put, match: async () => undefined }), sleep },
    )
    expect(attempts).toBe(2)
    expect(put).toHaveBeenCalledTimes(1)
    expect(sleeps).toEqual([INSTALL_RETRY_DEFAULTS.baseDelayMs])
  })

  it('非 2xx(如部署窗口 503)也重试,退避序列为 500、1000', async () => {
    const { sleeps, sleep } = captureSleeps()
    let attempts = 0
    const fetchSpy = vi.fn(async () => {
      attempts += 1
      return attempts < 3 ? fakeResponse({ status: 503 }) : fakeResponse({ body: 'ok' })
    })
    await installPrecacheEntries(
      [{ url: 'assets/index-x.js', revision: null }],
      { ...noopDeps(), fetch: fetchSpy as unknown as InstallDeps['fetch'], sleep },
    )
    expect(attempts).toBe(3)
    expect(sleeps).toEqual([500, 1000])
  })

  it('重试耗尽仍失败则整体 reject(install 失败,旧 SW 继续服务)', async () => {
    const { sleep } = captureSleeps()
    const fetchSpy = vi.fn(async () => fakeResponse({ status: 503 }))
    await expect(
      installPrecacheEntries(
        [{ url: 'assets/index-x.js', revision: null }],
        { ...noopDeps(), fetch: fetchSpy as unknown as InstallDeps['fetch'], sleep },
      ),
    ).rejects.toThrow('HTTP 503')
    expect(fetchSpy).toHaveBeenCalledTimes(INSTALL_RETRY_DEFAULTS.retries + 1)
  })

  it('各条目并发安装,均收到各自的 cache key', async () => {
    const puts: string[] = []
    const cache: CacheLike = {
      put: async (key) => {
        puts.push(key)
      },
      match: async () => undefined,
    }
    await installPrecacheEntries(EMPTY_MANIFEST, { ...noopDeps(), openCache: async () => cache })
    expect([...puts].sort()).toEqual([
      'assets/index-x.js',
      'fonts/bravura.woff2?__WB_REVISION__=hash-bravura',
      'index.html?__WB_REVISION__=hash-html',
    ])
  })

  it('同一 url 的重复条目(includeAssets 与 dist glob 叠加)只安装一次', async () => {
    const fetchSpy = vi.fn(async () => fakeResponse({ body: 'ok' }))
    const put = vi.fn(async () => {})
    const duplicated: readonly PrecacheEntry[] = [
      { url: 'fonts/bravura.woff2', revision: 'hash-bravura' },
      { url: 'fonts/bravura.woff2', revision: 'hash-bravura' },
    ]
    await installPrecacheEntries(duplicated, {
      ...noopDeps(),
      fetch: fetchSpy as unknown as InstallDeps['fetch'],
      openCache: async () => ({ put, match: async () => undefined }),
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledTimes(1)
  })
})

describe('serveFromPrecacheOrNetwork', () => {
  const request = { url: 'https://yidafu.github.io/TuneTutor/assets/index-x.js' } as Request

  it('precache 命中:回缓存,不发网络请求', async () => {
    const cached = { ok: true } as Response
    const openCache = vi.fn(async () => ({ put: async () => {}, match: async () => cached }))
    const fetchSpy = vi.fn()
    const served = await serveFromPrecacheOrNetwork(
      { kind: 'precache', cacheKey: 'assets/index-x.js' },
      request,
      { openCache, fetch: fetchSpy as unknown as (input: Request) => Promise<Response> },
    )
    expect(served).toBe(cached)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('precache 未命中(首装未完成):回退网络', async () => {
    const networked = { ok: true } as Response
    const openCache = async () => stubCache()
    const fetchSpy = vi.fn(async () => networked)
    const served = await serveFromPrecacheOrNetwork(
      { kind: 'precache', cacheKey: 'assets/index-x.js' },
      request,
      { openCache, fetch: fetchSpy as unknown as (input: Request) => Promise<Response> },
    )
    expect(served).toBe(networked)
    expect(fetchSpy).toHaveBeenCalledWith(request)
  })

  it('navigate 但 index.html 尚未进缓存(cacheKey null):回退网络', async () => {
    const networked = { ok: true } as Response
    const openCache = vi.fn(async () => stubCache())
    const served = await serveFromPrecacheOrNetwork(
      { kind: 'navigate', cacheKey: null },
      request,
      { openCache, fetch: async () => networked },
    )
    expect(served).toBe(networked)
    expect(openCache).not.toHaveBeenCalled()
  })
})
