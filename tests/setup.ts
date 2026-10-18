import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import '@testing-library/jest-dom/vitest'

// jsdom 未实现 Pointer Capture API（原曲页波形拖拽需要）
if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {}
  Element.prototype.releasePointerCapture = function releasePointerCapture() {}
}

// jsdom 的 Blob 缺 arrayBuffer()/text()（processFile / 音频导入依赖）：经 FileReader 补齐
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
      reader.readAsArrayBuffer(this)
    })
  }
  Blob.prototype.text = async function text(): Promise<string> {
    return new TextDecoder().decode(await this.arrayBuffer())
  }
}

// jsdom 未实现 IndexedDB：每个测试注入独立的 fake-indexeddb 工厂，测试间互不串库
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

// vitest globals 未开启，RTL 的自动清理不生效，手动注册
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
