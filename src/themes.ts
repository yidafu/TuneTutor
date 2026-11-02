/**
 * 皮肤注册表（docs/features/skin-switching.html v1.1 §④，决策 T3/T4/T5）。
 * 九款默认皮肤 id 固定；颜色值域由 src/index.css 的 :root[data-theme] 覆盖块承载，
 * 本文件只管 id、分组与切换器展示数据。
 */
export const THEMES = [
  'paper',
  'nocturne',
  'walnut',
  'celadon',
  'stage',
  'cobalt',
  'palace',
  'rosewood',
  'lacquer',
] as const

export type ThemeId = (typeof THEMES)[number]

/** localStorage 键（T4，对齐 note-slice-language 命名；存原始 id 字符串，非 JSON） */
export const THEME_STORAGE_KEY = 'note-slice-theme'

/** 缺省皮肤 = 纸墨（T4：非法存储值同样回落到此） */
export const DEFAULT_THEME: ThemeId = 'paper'

export type ThemeGroupId = 'classic' | 'antique'

/** 切换器分组（T5）：经典 5 款 + 古风 4 款，古风取材传统工艺见 T9 */
export const THEME_GROUPS: readonly { id: ThemeGroupId; themes: readonly ThemeId[] }[] = [
  { id: 'classic', themes: ['paper', 'nocturne', 'walnut', 'celadon', 'stage'] },
  { id: 'antique', themes: ['cobalt', 'palace', 'rosewood', 'lacquer'] },
]

/** 弹层行三色圆点预览（画布 / 语义 / 墨），取值与设计稿 ① 弹层一致；预览数据不随皮肤级联 */
export const THEME_SWATCHES: Record<ThemeId, readonly [string, string, string]> = {
  paper: ['#f0ebdd', '#c2431f', '#241f15'],
  nocturne: ['#0e1322', '#e2693c', '#ece7d8'],
  walnut: ['#e8dcc6', '#b8501f', '#33261a'],
  celadon: ['#dce3da', '#b3472e', '#1f2d24'],
  stage: ['#0b0b0c', '#ff5c2e', '#f6f2e6'],
  cobalt: ['#dae0ec', '#ac3a28', '#234a8c'],
  palace: ['#8e2f1a', '#4f8a68', '#f7ecd9'],
  rosewood: ['#4e2620', '#3e63a2', '#2a1810'],
  lacquer: ['#19110a', '#d95a30', '#e8dcc2'],
}

/** 英文副标（弹层 <em>，不随语言翻译，范式同 locales/LANGUAGE_NAMES） */
export const THEME_EN_NAMES: Record<ThemeId, string> = {
  paper: 'Paper Ink',
  nocturne: 'Nocturne',
  walnut: 'Walnut',
  celadon: 'Celadon',
  stage: 'Stage',
  cobalt: 'Blue & White',
  palace: 'Palace Red',
  rosewood: 'Rosewood',
  lacquer: 'Black Lacquer',
}

/** 存储值合法性校验（T4）：null / 非法值一律回落 paper */
export function resolveTheme(stored: string | null): ThemeId {
  return stored !== null && (THEMES as readonly string[]).includes(stored)
    ? (stored as ThemeId)
    : DEFAULT_THEME
}
