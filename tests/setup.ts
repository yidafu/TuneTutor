import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// jsdom 未实现 Pointer Capture API（原曲页波形拖拽需要）
if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {}
  Element.prototype.releasePointerCapture = function releasePointerCapture() {}
}

// vitest globals 未开启，RTL 的自动清理不生效，手动注册
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
