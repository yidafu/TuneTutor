import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from '@/hooks/useLocalStorage'

describe('useLocalStorage', () => {
  it('键不存在时返回 initialValue', () => {
    const { result } = renderHook(() => useLocalStorage('tt-missing', 'piano'))

    expect(result.current[0]).toBe('piano')
  })

  it('键存在时读取并反序列化存储值', () => {
    window.localStorage.setItem('tt-existing', JSON.stringify('violin'))
    const { result } = renderHook(() => useLocalStorage('tt-existing', 'piano'))

    expect(result.current[0]).toBe('violin')
  })

  it('存储值损坏（非法 JSON）时回落 initialValue', () => {
    window.localStorage.setItem('tt-corrupt', '{oops')
    const { result } = renderHook(() => useLocalStorage('tt-corrupt', 0.8))

    expect(result.current[0]).toBe(0.8)
  })

  it('set 更新状态并写入 JSON', () => {
    const { result } = renderHook(() => useLocalStorage('tt-write', 'classic'))
    const [, set] = result.current

    act(() => set('kick'))

    expect(result.current[0]).toBe('kick')
    expect(window.localStorage.getItem('tt-write')).toBe(JSON.stringify('kick'))
  })

  it('set 写入失败（存储不可用）不影响会话内状态', () => {
    // vi.spyOn 拦截不到 jsdom Storage 方法，整体替换 window.localStorage
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
      clear: () => {},
    })
    const { result } = renderHook(() => useLocalStorage('tt-frozen', 0.5))

    act(() => result.current[1](0.9))

    expect(result.current[0]).toBe(0.9)

    vi.unstubAllGlobals()
    expect(window.localStorage.getItem('tt-frozen')).toBeNull()
  })

  it('新值在重新挂载后仍可读回（持久化）', () => {
    const first = renderHook(() => useLocalStorage('tt-persist', 0))
    act(() => first.result.current[1](42))

    const second = renderHook(() => useLocalStorage('tt-persist', 0))
    expect(second.result.current[0]).toBe(42)
  })

  it('键变化不触发重读（调用方约定 key 固定）；写入落入新键', () => {
    window.localStorage.setItem('tt-key-b', JSON.stringify(7))
    const { result, rerender } = renderHook(({ key }) => useLocalStorage(key, 0), {
      initialProps: { key: 'tt-key-a' },
    })

    rerender({ key: 'tt-key-b' })
    // 初始值仅在挂载时读取一次
    expect(result.current[0]).toBe(0)

    act(() => result.current[1](3))
    expect(window.localStorage.getItem('tt-key-b')).toBe('3')
  })
})
