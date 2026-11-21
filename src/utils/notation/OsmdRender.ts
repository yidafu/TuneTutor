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

/** EngravingRules 中由皮肤 token 驱动的取色面（skin-switching.html §④-04） */
export interface EngravingColors {
  StaffLineColor: string
  LedgerLineColorDefault: string
  DefaultColorMusic: string
  /** 音符头填充（OSMD 1.9.7：无 XML 音符色时的回落是 DefaultColorNotehead，非 DefaultColorMusic——e2e 实测） */
  DefaultColorNotehead: string
  DefaultColorTitle: string
  DefaultColorLabel: string
}

/**
 * §④-04 取色映射（纯函数，token 读取注入以便测试）：谱线/加线读 `--color-staff`；
 * 音符墨色同时写 DefaultColorMusic（连线/表情记号）与 DefaultColorNotehead（符头填充，
 * 符干随符头色）。宫墙/红木回归：不能读 `--color-line-strong`——那是 UI 边框线 token，
 * 深木面主题下是浅奶油低透明，落在浅色纸面上谱线不可见。小节线在 OSMD 中随 VexFlow
 * Stave 的 fill_style 与谱线同色（EngravingRules 无独立小节线色入口），barline token
 * 无处注入。token 缺失时保持 OSMD 默认（黑白）。
 */
export function applyEngravingColors(
  rules: EngravingColors,
  read: (name: string) => string | null,
): void {
  const staff = read('--color-staff')
  if (staff !== null) {
    rules.StaffLineColor = staff
    rules.LedgerLineColorDefault = staff
  }
  const ink = read('--color-ink')
  if (ink !== null) {
    rules.DefaultColorMusic = ink
    rules.DefaultColorNotehead = ink
  }
  const fg = read('--color-fg')
  if (fg !== null) rules.DefaultColorTitle = fg
  const ink2 = read('--color-ink-2')
  if (ink2 !== null) rules.DefaultColorLabel = ink2
}

/**
 * OSMD 实例管理（docs/tech.md §6.1）：一个容器一个实例，load 同一份 rawContent 幂等
 * （React 严格模式二次执行 effect 不重渲染）。rawContent 是唯一渲染输入（决策 M2，
 * 禁止喂 serialize() 重序列化产物）。
 * 每次渲染前按皮肤 token 重写 EngravingRules 取色（§④-04 契约：谱线 staff、音符/文字
 * ink，纸面底色由乐谱卡 CSS 承担，OSMD 保持透明背景；换肤触发重渲染，T6）。
 */
export class OsmdRender {
  private readonly osmd: OpenSheetMusicDisplay
  private readonly container: HTMLElement
  private loadedContent: string | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.osmd = new OpenSheetMusicDisplay(container, OSMD_OPTIONS)
    // endless 模式默认 PageBottomMargin=5（50px），叠加末系统底部预留后 svg 下缘死空白
    // ≈100px（上缘标题距仅 46.5px），谱面在卡内视觉偏上（2026-10-18 实测）；归零后上下
    // 空白对称（≈46.5/49.8，谱面无关），垂直居中交给 stage 网格（OsmdNotation alignItems）。
    this.osmd.EngravingRules.PageBottomMargin = 0
    // 关闭连续空小节自动折叠 multirest（OSMD 1.9.7 默认开）：折叠把 N 个源小节并成 1 个
    // 图形音符、其余小节从 MeasureList 消失，图形遍历数不到被吞小节的占位休止，noteIndex
    // 与 buildPlaybackData（按源小节逐休止计数）从此错位，选择端点会映射到错误音符。
    // 显式 <multiple-rest> 标记不受影响（RenderMultipleRestMeasures 保持默认）；
    // 源谱印刷本就是逐小节全休止，不折叠也更贴近原貌（2026-10-19「世界赠予我的」m2–m6 实测）。
    this.osmd.EngravingRules.AutoGenerateMultipleRestMeasuresFromRestMeasures = false
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

  /**
   * 谱内标题/作曲者绘制开关（phone-compat P9）：手机竖屏容器 ~330px，OSMD 自绘
   * 大标题左右溢出被裁（卡片头部 ScoreInfo 已展示同源标题），窄屏关掉、宽屏恢复。
   * drawingParameters 是 protected，读回判断退而求其次只看本类记账；setOptions
   * 幂等且级联关 Subtitle（调用方负责跟随 render()）。
   */
  private titlesDrawn = true

  setDrawTitles(enabled: boolean): void {
    if (this.titlesDrawn === enabled) return
    this.titlesDrawn = enabled
    this.osmd.setOptions({ drawTitle: enabled, drawComposer: enabled })
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

  /** 渲染前从 :root 读皮肤 token 注入取色（§④-04，映射见 applyEngravingColors） */
  private applyThemeColors(): void {
    if (typeof document === 'undefined') return
    const computed = getComputedStyle(document.documentElement)
    applyEngravingColors(this.osmd.EngravingRules, (name) => {
      const value = computed.getPropertyValue(name).trim()
      return value !== '' ? value : null
    })
  }
}
