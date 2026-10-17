import { useCallback, useState } from 'react'

/** 读写 localStorage 的 UI 偏好（键名约定见 docs/tech.md §7.2），值为 JSON 序列化。 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? initialValue : (JSON.parse(raw) as T)
    } catch {
      return initialValue
    }
  })

  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // 忽略写入失败（配额 / 隐私模式），会话内状态仍然可用
      }
    },
    [key],
  )

  return [value, set]
}
