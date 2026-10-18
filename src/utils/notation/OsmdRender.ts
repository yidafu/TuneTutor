import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

/** OSMD 选项基线（docs/tech.md §6.1）。autoResize 关闭：重渲染统一走 render()，
 * 由 OsmdNotation 的 ResizeObserver 驱动并同步失效音符缓存（selection.md §3.2） */
const OSMD_OPTIONS = {
  autoResize: false,
  backend: 'svg',
  disableCursor: false,
  drawTitle: true,
  drawComposer: true,
  drawPartNames: true,
  coloringEnabled: true,
}

/** 缩放界限与步进（页脚 －/＋ 控件；乘性步进在低端收敛更均匀） */
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2
export const ZOOM_STEP_FACTOR = 1.1

/** 纯步进函数：方向 ±1，结果保留两位小数并钳制（tests 断言阶梯） */
export function nextZoomStep(current: number, direction: 1 | -1): number {
  const raw = direction === 1 ? current * ZOOM_STEP_FACTOR : current / ZOOM_STEP_FACTOR
  const rounded = Math.round(raw * 100) / 100
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, rounded))
}

/**
 * OSMD 实例管理（docs/tech.md §6.1）：一个容器一个实例，load 同一份 rawContent 幂等
 * （React 严格模式二次执行 effect 不重渲染）。rawContent 是唯一渲染输入（决策 M2，
 * 禁止喂 serialize() 重序列化产物）。
 * 每次渲染前按皮肤 token 重写 EngravingRules 取色（§④-04 契约：谱线/音符/文字读
 * token，纸面底色由乐谱卡 CSS 承担，OSMD 保持透明背景；换肤触发重渲染，T6）。
 */
export class OsmdRender {
  private readonly osmd: OpenSheetMusicDisplay
  private readonly container: HTMLElement
  private loadedContent: string | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.osmd = new OpenSheetMusicDisplay(container, OSMD_OPTIONS)
  }

  get instance(): OpenSheetMusicDisplay {
    return this.osmd
  }

  get currentZoom(): number {
    return this.osmd.zoom
  }

  async load(rawContent: string): Promise<void> {
    if (this.loadedContent === rawContent) return
    await this.osmd.load(rawContent)
    this.render()
    this.loadedContent = rawContent
  }

  /** 重渲染（缩放/换肤/容器尺寸变化后调用）；调用方必须重建音符缓存（tech.md §6.1） */
  render(): void {
    this.applyThemeColors()
    this.osmd.render()
  }

  setZoom(zoom: number): void {
    if (zoom === this.osmd.zoom) return
    this.osmd.zoom = zoom
    this.render()
  }

  /** 渲染后 waitForSvgContent（tech.md §6.1）：rAF 轮询等 SVG 有子节点，超时放行 */
  waitForSvgContent(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve) => {
      const startedAt = Date.now()
      const schedule = (next: () => void): void => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => next())
        else setTimeout(next, 16)
      }
      const tick = (): void => {
        const svg = this.container.querySelector('svg')
        if (svg !== null && svg.hasChildNodes()) {
          resolve()
          return
        }
        if (Date.now() - startedAt > timeoutMs) {
          console.warn('[OsmdRender] waitForSvgContent timed out')
          resolve()
          return
        }
        schedule(tick)
      }
      tick()
    })
  }

  /** 清空渲染并失效内容缓存；重渲染/清除时必须失效音符缓存（tech.md §6.1） */
  clear(): void {
    this.osmd.clear()
    this.loadedContent = null
  }

  /** EngravingRules 取色读 token（skin-switching.html §④-04）；token 缺失时保持 OSMD 默认 */
  private applyThemeColors(): void {
    if (typeof document === 'undefined') return
    const computed = getComputedStyle(document.documentElement)
    const token = (name: string): string | null => {
      const value = computed.getPropertyValue(name).trim()
      return value !== '' ? value : null
    }
    const rules = this.osmd.EngravingRules
    const staffLine = token('--color-line-strong')
    if (staffLine !== null) {
      rules.StaffLineColor = staffLine
      rules.LedgerLineColorDefault = staffLine
    }
    const ink = token('--color-ink')
    if (ink !== null) rules.DefaultColorMusic = ink
    const fg = token('--color-fg')
    if (fg !== null) rules.DefaultColorTitle = fg
    const ink2 = token('--color-ink-2')
    if (ink2 !== null) rules.DefaultColorLabel = ink2
  }
}
