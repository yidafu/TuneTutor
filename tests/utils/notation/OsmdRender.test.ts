import { describe, expect, it } from 'vitest'

import {
  OsmdRender,
  ZOOM_MAX,
  ZOOM_MIN,
  applyEngravingColors,
  nextZoomStep,
  type EngravingColors,
} from '@/utils/notation/OsmdRender'

describe('OsmdRender 构造器（tech.md §6.1）', () => {
  it('EngravingRules.PageBottomMargin 归零：endless 模式 svg 上下留白对称，居中交给 stage 网格', () => {
    const renderer = new OsmdRender(document.createElement('div'))
    expect(renderer.instance.EngravingRules.PageBottomMargin).toBe(0)
  })

  it('关闭连续空小节自动折叠 multirest：折叠吞掉源小节，noteIndex 与播放数据镜像会错位', () => {
    // 行为级回归（「世界赠予我的」m2–m6 折叠后图形遍历缺 5 个占位休止 → 选择端点错音）
    // 依赖真实渲染，jsdom 无法复现；此处钉住开关本身，显式 <multiple-rest> 标记仍走
    // RenderMultipleRestMeasures。
    const renderer = new OsmdRender(document.createElement('div'))
    expect(
      renderer.instance.EngravingRules.AutoGenerateMultipleRestMeasuresFromRestMeasures,
    ).toBe(false)
  })
})

describe('applyEngravingColors（skin-switching.html §④-04 取色映射）', () => {
  const osmdDefaults = (): EngravingColors => ({
    StaffLineColor: '#000000',
    LedgerLineColorDefault: '#000000',
    DefaultColorMusic: '#000000',
    DefaultColorNotehead: '#000000',
    DefaultColorTitle: '#000000',
    DefaultColorLabel: '#000000',
  })
  const palaceTokens: Record<string, string> = {
    '--color-staff': '#dbc69e',
    '--color-ink': '#241511',
    '--color-fg': '#f7ecd9',
    '--color-ink-2': '#a1845c',
  }

  it('谱线/加线读 --color-staff（宫墙/红木回归：line-strong 是 UI 边框线，浅纸面上不可见）', () => {
    const rules = osmdDefaults()
    applyEngravingColors(rules, (name) => palaceTokens[name] ?? null)
    expect(rules.StaffLineColor).toBe('#dbc69e')
    expect(rules.LedgerLineColorDefault).toBe('#dbc69e')
  })

  it('查询的 token 与 §④-04 契约一致：staff/ink/fg/ink-2，不碰 line-strong', () => {
    const queried: string[] = []
    applyEngravingColors(osmdDefaults(), (name) => {
      queried.push(name)
      return palaceTokens[name] ?? null
    })
    expect(queried).toEqual(['--color-staff', '--color-ink', '--color-fg', '--color-ink-2'])
  })

  it('音符/标题/辅助文字分别映射 ink/fg/ink-2', () => {
    const rules = osmdDefaults()
    applyEngravingColors(rules, (name) => palaceTokens[name] ?? null)
    expect(rules.DefaultColorMusic).toBe('#241511')
    expect(rules.DefaultColorTitle).toBe('#f7ecd9')
    expect(rules.DefaultColorLabel).toBe('#a1845c')
  })

  it('符头填充写 DefaultColorNotehead（OSMD 1.9.7 音符头回落字段，DefaultColorMusic 只管连线/表情）', () => {
    const rules = osmdDefaults()
    applyEngravingColors(rules, (name) => palaceTokens[name] ?? null)
    expect(rules.DefaultColorNotehead).toBe('#241511')
  })

  it('token 缺失时保持 OSMD 默认不覆写', () => {
    const rules = osmdDefaults()
    applyEngravingColors(rules, () => null)
    expect(rules).toEqual(osmdDefaults())
  })
})

describe('nextZoomStep（页脚 －/＋ 阶梯）', () => {
  it('乘性步进并保留两位小数', () => {
    expect(nextZoomStep(1, 1)).toBe(1.1)
    expect(nextZoomStep(1, -1)).toBe(0.91)
    expect(nextZoomStep(1.1, 1)).toBe(1.21)
  })

  it('钳制在 [ZOOM_MIN, ZOOM_MAX]', () => {
    expect(nextZoomStep(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
    expect(nextZoomStep(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
  })
})
