import { describe, expect, it } from 'vitest'
import {
  decideFetch,
  isCdnSampleUrl,
  RUNTIME_CACHE_NAME,
  serveFromRuntimeCacheOrNetwork,
} from '@/sw/precache'
import type { CacheLike, FetchResponseLike } from '@/sw/precache'

/**
 * SW 运行时缓存单测（决策 A20）：CDN 采样 mp3 的 allowlist 决策与 cache-first 应答。
 * 依赖全部注入（CacheLike / fetch / makeResponse），jsdom 无 Response 全局也能测。
 */

const SCOPE = 'https://yidafu.github.io/TuneTutor/'
const CDN_MP3 = 'https://cdn.jsdelivr.net/npm/tonejs-instrument-piano-mp3@1.1.2/C1.mp3'

interface StoreEntry {
  url: string
  body: ArrayBuffer
  status: number
}

/** Cache 替身：put 经 makeResponse 替身对象上的 __entry 记录条目，match 按键回放 */
function makeCacheStub() {
  const store = new Map<string, StoreEntry>()
  const cache: CacheLike & { _store: Map<string, StoreEntry> } = {
    _store: store,
    async put(key, body) {
      const entry = (body as unknown as { __entry?: StoreEntry }).__entry
      if (entry) store.set(key, entry)
    },
    async match(key) {
      const entry = store.get(key)
      return entry ? (entry as unknown as Response) : undefined
    },
  }
  return cache
}

function fakeResponse(fields: Partial<FetchResponseLike> & { bodyBytes?: number }): FetchResponseLike {
  return {
    ok: fields.ok ?? true,
    status: fields.status ?? 200,
    statusText: fields.statusText ?? 'OK',
    headers: fields.headers ?? ({} as Headers),
    type: fields.type,
    arrayBuffer: async () => new ArrayBuffer(fields.bodyBytes ?? 279228),
  }
}

/** 测试 makeResponse：把来源条目挂到替身对象上，供 stub cache.put 记录断言 */
function makeResponse(body: ArrayBuffer, source: FetchResponseLike): Response {
  const entry: StoreEntry = { url: '', body, status: source.status }
  return { __entry: entry } as unknown as Response
}

function requestOf(url: string): Request {
  return { url } as Request
}

describe('decideFetch CDN 采样 allowlist（决策 A20）', () => {
  const index = new Map([['index.html', 'index.html?__WB_REVISION__=abc']])

  it('jsdelivr 的 tonejs-instrument mp3 → runtime', () => {
    expect(decideFetch(CDN_MP3, 'GET', 'cors', null, SCOPE, index)).toEqual({ kind: 'runtime' })
    expect(isCdnSampleUrl(new URL(CDN_MP3))).toBe(true)
  })

  it('jsdelivr 非 mp3 / 其他域名 / 其他 CDN 镜像域 → ignore', () => {
    expect(decideFetch('https://cdn.jsdelivr.net/npm/tonejs-instrument-piano-mp3@1.1.2/index.js', 'GET', 'cors', null, SCOPE, index).kind).toBe('ignore')
    expect(decideFetch('https://fastly.jsdelivr.net/npm/tonejs-instrument-piano-mp3@1.1.2/C1.mp3', 'GET', 'cors', null, SCOPE, index).kind).toBe('ignore')
    expect(decideFetch('https://example.com/some/C1.mp3', 'GET', 'cors', null, SCOPE, index).kind).toBe('ignore')
  })

  it('非 GET / Range 流式请求不拦截（含 CDN mp3）', () => {
    expect(decideFetch(CDN_MP3, 'POST', 'cors', null, SCOPE, index).kind).toBe('ignore')
    expect(decideFetch(CDN_MP3, 'GET', 'cors', 'bytes=0-1023', SCOPE, index).kind).toBe('ignore')
  })

  it('同源 precache 决策不受 allowlist 影响（navigate / 命中 / 未命中）', () => {
    expect(decideFetch(`${SCOPE}`, 'GET', 'navigate', null, SCOPE, index)).toEqual({ kind: 'navigate', cacheKey: 'index.html?__WB_REVISION__=abc' })
    expect(decideFetch(`${SCOPE}assets/index-x.js`, 'GET', 'cors', null, SCOPE, new Map([['assets/index-x.js', 'assets/index-x.js']]))).toEqual({ kind: 'precache', cacheKey: 'assets/index-x.js' })
    // mp3 不进 precache glob：同源 mp3 请求仍不拦截
    expect(decideFetch(`${SCOPE}assets/C1-x.mp3`, 'GET', 'cors', null, SCOPE, new Map()).kind).toBe('ignore')
  })
})

describe('serveFromRuntimeCacheOrNetwork（cache-first，A20）', () => {
  it('缓存命中直接回缓存，不发起网络', async () => {
    const cache = makeCacheStub()
    const entry: StoreEntry = { url: CDN_MP3, body: new ArrayBuffer(3), status: 200 }
    cache._store.set(CDN_MP3, entry)
    let fetchCalled = false
    const response = await serveFromRuntimeCacheOrNetwork(requestOf(CDN_MP3), {
      openCache: async () => cache,
      fetch: async () => {
        fetchCalled = true
        return fakeResponse({}) as unknown as Response
      },
      makeResponse,
    })
    expect(fetchCalled).toBe(false)
    expect(response).toBe(entry as unknown as Response)
  })

  it('未命中 → 网络 → 整读响应体后 put（键为完整 URL）并应答', async () => {
    const cache = makeCacheStub()
    const source = fakeResponse({ ok: true, status: 200, type: 'cors', bodyBytes: 1024 })
    const response = await serveFromRuntimeCacheOrNetwork(requestOf(CDN_MP3), {
      openCache: async () => cache,
      fetch: async () => source as unknown as Response,
      makeResponse,
    })
    const put = cache._store.get(CDN_MP3)
    expect(put).toBeDefined()
    expect(put!.status).toBe(200)
    expect(put!.body.byteLength).toBe(1024)
    expect((response as unknown as { __entry: StoreEntry }).__entry?.body.byteLength).toBe(1024)
  })

  it('非 2xx / opaque 不入缓存，直接透传', async () => {
    const notOk = fakeResponse({ ok: false, status: 404, type: 'cors' })
    const opaque = fakeResponse({ ok: true, status: 200, type: 'opaque' })
    for (const source of [notOk, opaque]) {
      const cache = makeCacheStub()
      await serveFromRuntimeCacheOrNetwork(requestOf(CDN_MP3), {
        openCache: async () => cache,
        fetch: async () => source as unknown as Response,
        makeResponse,
      })
      expect(cache._store.size).toBe(0)
    }
  })

  it('cache.put 失败不阻塞应答（运行时缓存尽力而为）', async () => {
    const cache = makeCacheStub()
    cache.put = async () => {
      throw new Error('quota exceeded')
    }
    const source = fakeResponse({ ok: true, type: 'cors' })
    const response = await serveFromRuntimeCacheOrNetwork(requestOf(CDN_MP3), {
      openCache: async () => cache,
      fetch: async () => source as unknown as Response,
      makeResponse,
    })
    expect((response as unknown as { __entry: StoreEntry }).__entry?.status).toBe(200)
  })

  it('缓存名常量契约（activate 清理与文档引用依赖此名）', () => {
    expect(RUNTIME_CACHE_NAME).toBe('tt-runtime')
  })
})
