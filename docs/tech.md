# TuneTutor 技术规格说明书

**版本**: 2.3
**日期**: 2026-10-18
**状态**: Ready for Re-implementation
**变更**: v2.0 全面重写，取代 v1.x 的 VexFlow + WebAudioFont 方案（渲染栈自 commit `4dbf604` 起为 OpenSheetMusicDisplay；旧版全文见 git 历史）；v2.1 将音频播放细则（原 §4/§5）拆分至 [audio.md](./audio.md) 并按同类实现调研扩写；v2.2 将选择交互细则（原 §6.2/§6.3）拆分至 [selection.md](./selection.md) 并按同类实现调研与 spike 实测扩写；v2.3 音频域架构对齐官方播放器（[audio.md](./audio.md) v2.0，决策「参考 osmd-player 实现」）：播放数据 `playbackData`（乐谱时域，与 BPM 解耦）+ `TimingSource` 可注入锚点时钟 + 引擎内 look-ahead 调度与循环状态机，废弃 `buildTimeline` 绝对秒时间轴与 Tone.Transport + Part 路线；BPM 变更改即时重锚定（D2 重写）；§1/§2/§3/§4/§5/§10/§11 同步。本文对应章节降为摘要。

---

## 0. 文档定位与基线

本文档是系统级技术规格，作为代码重写的实施蓝图。文档地图、阅读顺序与冲突裁决统一维护在 [README.md](./README.md)（文档导读）。一句话版：PRD/UI 设计稿定「做什么」，本文定「怎么做」；实现与文档冲突时，先修文档再修代码。**音频域**（播放数据、播放引擎、乐器、节拍器、原曲切片循环）的细则规格在 [audio.md](./audio.md)，音频域内冲突以该文为准；**选择域**（命中测试、选择模型、覆盖层）的细则规格在 [selection.md](./selection.md)，选择域内冲突以该文为准；**导入解析域**（MusicXML 导入管线、连线符/停顿/连音/装饰音/倚音等标记域契约映射）的细则规格在 [musicxml.md](./musicxml.md)，导入解析域内冲突以该文为准。

---

## 1. 技术栈

| 组件 | 技术 | 版本约束 |
| --- | --- | --- |
| UI 框架 | React + TypeScript（strict） | React 19、TS ~5.9 |
| 构建 | Vite + `@vitejs/plugin-react-swc` | Vite 7 |
| 样式 | StyleX（`@stylexjs/rollup-plugin` 编译期原子 CSS；`stylex.css` 构建期产出，dev 运行时注入。颜色一律引用 `index.css` 的 `--color-*` token，皮肤机制不变） | ^0.19 |
| 乐谱渲染 | OpenSheetMusicDisplay（OSMD，SVG 后端） | ^1.9 |
| 音频引擎 | Tone.js（Sampler 采样触发、Draw 动画对齐；调度不用 Transport，见 audio.md A1/A12） | ^15 |
| 播放调度 | 自研 look-ahead 引擎（官方播放器 PlaybackManager 同构，audio.md §3.1） | — |
| 采样音色 | `tonejs-instrument-*-mp3` ×7（钢琴/萨克斯/吉他/贝斯/小提琴/长笛/小号） | ^1.1 |
| 乐谱解析 | `musicxml-io`（`fs/promises` 需浏览器垫片，见 §9） | ^0.2 |
| 压缩包 | `jszip`（`.mxl` 解包） | ^3.10 |
| 波形 | `wavesurfer.js` v7（Regions 插件） | ^7 |
| 路由 | `react-router-dom`（**HashRouter**，兼容 GitHub Pages 静态托管） | ^7 |
| PWA | `vite-plugin-pwa`（autoUpdate，injectManifest）+ 自研 SW（`src/sw.ts`：整读响应体后 `cache.put` + 指数退避重试，workbox 运行时模块 pnpm 隔离下不可解析故不引入） | — |
| 测试 | Vitest 4 + `fake-indexeddb` + jsdom | — |
| 包管理 | pnpm（Node 18+） | — |

TypeScript 严格性约束（`tsconfig.app.json`，重写必须遵守）：`strict`、`noUnusedLocals`、`noUnusedParameters`、`verbatimModuleSyntax`（类型导入必须 `import type`）、`erasableSyntaxOnly`（禁用 enum/namespace/参数属性）、路径别名 `@` → `src/`（测试代码使用；`src/` 应用代码沿用相对导入，跟随所改文件现状）。

---

## 2. 系统架构

### 2.1 模块图

```
src/
├── main.tsx                  # 入口：I18nProvider + HashRouter
├── App.tsx                   # 路由壳：Header 导航 + 共享 tempo（两页共享，乐谱页可回写）
├── pages/
│   ├── ScorePage.tsx         # 乐谱练习页（/）
│   └── OriginalAudioPage.tsx # 原曲切片页（/audio）
├── audio/                    # 播放核心（无 React 依赖）
│   ├── PlaybackEngine.ts     # look-ahead 窗口调度、节拍器、循环状态机、事件（官方 PlaybackManager 同构）
│   ├── TimingSource.ts       # 锚点时钟（可注入；实时实现锚定 AudioContext.currentTime）
│   ├── playbackData.ts       # 由 OSMD 光标构建播放数据（乐谱时域，单一事实来源）
│   ├── InstrumentLoader.ts   # 12 种采样器加载与缓存
│   ├── TempoConverter.ts     # RealValue ↔ 秒 换算（纯函数）
│   └── sliceUtils.ts         # 音频切片钳制/循环计划（纯函数，可单测）
├── utils/
│   ├── notation/
│   │   ├── processFile.ts    # 文件读取、.mxl 解包、校验、入库
│   │   ├── musicXMLParser.ts # musicxml-io → ParsedScore 转换
│   │   ├── OsmdRender.ts     # OSMD 实例管理（渲染/缩放/光标）
│   │   ├── NoteInteraction.ts# 音符命中测试（DOM ↔ 图形结构映射）
│   │   ├── selection.ts      # 选择状态与范围计算
│   │   └── layout.ts         # 行/坐标几何工具
│   ├── storage/indexedDB.ts  # 乐谱 + 音频历史持久化
│   ├── createDemoScore.ts    # 内置示范曲（回落用）
│   └── isBrowser.ts          # SSR/测试环境守卫
├── components/               # 展示组件（扁平结构，不用桶文件）
│   ├── Header.tsx  ScoreInfo.tsx  SelectionInfo.tsx  StatusBar.tsx
│   ├── OsmdNotation.tsx  PhraseMarkers.tsx  FileLoaderModal.tsx
│   ├── FileLoader/           # 加载弹窗内最近文件列表
│   └── PlaybackControls/     # TransportButtons / TempoSlider / LoopSkipSelector
│                             # / MetronomeToggle（含设置面板）
├── hooks/
│   ├── usePlayback.ts        # 播放状态机 + 进度推导（直读引擎时钟）
│   ├── useKeyboardShortcuts.ts
│   ├── useLocalStorage.ts    # useClickOutside.ts
├── locales/                  # 手写 i18n（§8）
├── types/                    # 数据契约（§3）
└── vite-browser-shims/fs-promises.ts  # musicxml-io 的 Node fs 垫片（必须保留）
```

### 2.2 数据流

```
MusicXML 文件 ──processFile──▶ rawContent ──▶ OSMD.load/render（SVG）
                                  │
                                  └─musicxml-io─▶ ParsedScore（曲名/拍号/速度，供 UI 与历史缓存）
                                                        │
OSMD 光标 ──buildPlaybackData──▶ PlaybackEntry[]（乐谱时域，与 BPM 无关）◀────┘（播放数据只认光标，不认 ParsedScore）
                                     │
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
  PlaybackEngine（look-ahead 调度 + TimingSource 时钟）   usePlayback（进度 = 时钟直读）
                  ▲                                     ▲
                  └──── 选择模型 → LoopRange ────────────┘
```

关键原则：**播放数据只有一个来源**——OSMD 光标。`ParsedScore` 仅用于元信息展示与存储缓存，禁止再从音符时长表近似推算时间（这是 v1 双轨计算的根因，见 §12 决策 D1）。播放数据存**乐谱时域**（RealValue，全音符分数），与 BPM 无关——BPM 只在引擎时钟边界进入换算，变更即时重锚定、不停止、零重建（决策 D2、audio.md A2/A12）。

### 2.3 页面与共享状态

- 路由：`/` → ScorePage，`/audio` → OriginalAudioPage；`App` 持有 `tempo`（40–240），乐谱页可修改，原曲页只读（空拍秒数换算用同一 BPM）。
- 离开乐谱页必须停止乐谱播放（路由卸载时停止 PlaybackEngine，audio.md §3.3）。

---

## 3. 核心数据契约（`src/types/`）

```typescript
// notation.ts —— musicxml-io 转换产物，只取第一 part（乐器），voice 全保留
interface ParsedScore {
  title: string;                  // 取 metadata.workTitle，回落 movementTitle（spike §13-V2）
  composer?: string;              // 取 metadata.creators 中 type=composer 的 value
  measures: Measure[];            // Measure { index, notes, timeSignature?, keySignature?, divisions?, multipleRest?, transpose? }（transpose = attributes/transpose 声明，docs/musicxml.md 决策 M11）
  tempo: number;                  // MusicXML <sound tempo>；样例谱普遍缺失，必须兜底 60
  timeSignature: string;          // "4/4"
  keySignature?: string;          // 五度圈 → 调名
  divisions: number;
}
interface Note {
  pitch: string;                  // "C4" / "rest"
  duration: string;               // 显示标签（noteType+dots 派生："q."/"8"；反推不中 → "x"）
  realValue: number;              // ⭐ 权威发声时值（全音符分数，= duration/有效divisions/4；附点与连音缩放已含）
  isRest: boolean;
  dots: number;                   // ⚠️ musicxml-io 字段名是 dots（旧代码误读 dot，恒为 0）
  octave: number; accidentals?: string;
  voice?: number; type?: string; isChord?: boolean;
  // 标记域扩展：tie / tuplet / isGrace / isCue / markings——字段与映射细则见 musicxml.md §2（域内冲突以该文为准）
}

// playback.ts —— 播放数据与循环（乐谱时域，与 BPM 无关，audio.md §2）
interface PlaybackEntry {
  startRv: number;     // 距曲首 RealValue（全音符分数）；构建一次，BPM 变更零重建
  durationRv: number;  // RealValue；tie 起始音取 NoteTie.Duration（延音合并）
  measureIndex: number;
  noteIndex: number;   // 全曲连续编号，与命中测试索引同源（休止符占位递增）
  noteName: string;    // Tone Frequency 可解析的音名
}
interface LoopRange { startRv: number; endRv: number; skipBeats: number; }  // 乐谱时域 + 拍；skipBeats = 空拍（秒在引擎入口现算）
type MetronomeSoundType = 'classic' | 'digital' | 'kick' | 'click';

// audio.ts —— 音色与切片
type InstrumentType = 'piano'|'saxophone'|'clarinet'|'flute'|'trumpet'|'frenchHorn'|'trombone'
  |'violin'|'cello'|'guitar'|'guitarNylon'|'bass';   // 12 种，guitar 恒指钢弦民谣
interface AudioSlice { startTime: number; endTime: number; }   // 原曲页切片（秒）

// storedFile.ts —— IndexedDB 行
interface StoredFile { id; fileName; title; composer?; uploadedAt; fileSize; rawContent; parsedScore; }
interface StoredAudioFile { id; fileName; fileSize; uploadedAt; data: ArrayBuffer; }  // 存 ArrayBuffer 保证 structured-clone 兼容
```

注意：`PlaybackEntry.noteIndex` 是**全曲连续编号**（含休止符占位递增），`NoteInteraction` 的命中索引必须与它同源（同一遍历顺序），否则乐句范围映射会错位。

---

## 4. 播放数据模型（细则见 [audio.md](./audio.md) §2）

**播放数据只有一个来源**——OSMD 光标（决策 D1）：`buildPlaybackData` 以光标步进产出 `PlaybackEntry[]`，全部时间为乐谱时域 RealValue、与 BPM 无关（装饰音/连音线延续音跳过、延音合并、多声部步长取 max、休止符占位递增索引、终点 = 末条目末刻）；起播定位与区间裁剪、`noteIndex` 与命中测试的同源对齐约束、时间比较容差（RealValue 域 1e-4），全部细则见 audio.md。

---

## 5. 播放引擎（细则见 [audio.md](./audio.md) §3–§5）

`PlaybackEngine`（官方播放器 PlaybackManager 同构）以 `TimingSource` 锚点时钟驱动自调度 look-ahead tick（100ms 窗口、采样精确 `when`）调度采样、`Draw.schedule` 同步光标、引擎内循环状态机实现「循环 + 空拍」、tick 内逐拍调度节拍器；BPM 变更即时重锚定、不停止、零重建（audio.md A2）；时钟可注入（实时实现锚定 AudioContext.currentTime，暂停/恢复零漂移路径内置）。乐器音色加载（tonejs-instrument 包族）、原曲页 wavesurfer 波形可视化与切片循环、音频域工程约束与决策记录（A1–A12，含官方播放器逆向对照，官方行为规格见 tech §13 V10）见 audio.md。

---

## 6. 乐谱渲染与选择交互（选择域细则见 [selection.md](./selection.md)）

### 6.1 渲染（`OsmdRender`）

- OSMD 选项基线：`autoResize: false`（重渲染由组件 ResizeObserver 防抖驱动、与音符缓存失效同路，selection.md §3.2）、`backend: 'svg'`、`disableCursor: false`、`drawTitle/Composer/PartNames`、`coloringEnabled`；EngravingRules 颜色读皮肤 token（谱线/音符/文字，§7.2，换肤触发重渲染 T6）。`EngravingRules.PageBottomMargin = 0`（构造器内设置）：endless 模式默认 5（50px）叠加末系统底部预留 ≈100px 死空白，谱面在卡内视觉偏上（2026-10-18 实测 svg 上空 46.5 / 下空 99.8）；归零后上下空白对称（≈46.5/49.8，与谱面无关），垂直居中交给 stage 网格（OsmdNotation `alignItems: center`）。`EngravingRules.AutoGenerateMultipleRestMeasuresFromRestMeasures = false`（2026-10-19）：自动 multirest 折叠把连续全休止小节并成 1 个图形音符、被吞小节从 MeasureList 消失，图形遍历数不到其占位休止，noteIndex 与 buildPlaybackData 错位、选择端点映射到错误音符（「世界赠予我的」m2–m6 实测）；显式 `<multiple-rest>` 标记不受影响，源谱逐小节印刷也更贴近原貌。
- 渲染后 `waitForSvgContent`（rAF 轮询等待 SVG 有子节点，超时放行），再构建音符映射。
- 实例单例（每容器一个）；重渲染/清除/缩放时必须失效音符缓存（缩放页脚 －/＋ 乘性步进 0.5–2.0）。
- 手机窄屏（≤639px，G18 / [features/phone-compat.md](./features/phone-compat.md) P9）：`setDrawTitles(false)` 关谱内自绘标题/作曲者（卡片头部 ScoreInfo 已有同源标题，~330px 容器里 OSMD 大标题左右溢出被裁），跨断点跟随重排；舞台 grid 列轨 `minmax(0, 1fr)` 保证容器可随视口缩回（否则 ResizeObserver 不触发、旋转后谱面不重排）。StyleX 媒体键禁写 `'a and b'` 复合查询（dev 运行时去重丢规则，守卫 `tests/themes/stylexConventions.test.ts`）。

### 6.2 选择交互（摘要）

音符命中测试、双索引（graphicIndex/noteIndex）对齐、端点解析与 `LoopRange` 推导、选择状态机、覆盖层渲染的全部细则在 [selection.md](./selection.md)（自本节拆分扩写，含同类实现调研与决策 S1–S8，选择域内冲突以该文为准）。一句话版：

| 模式 | 交互 | 产物 |
| --- | --- | --- |
| 乐句循环 | 双击起始音符 → 再双击结束音符（顺序颠倒自动换位） | `LoopRange` + START/END 括号标记（覆盖层）+ 音符高亮 |
| 小节选择 | 单击音符 | 其所在小节区间 → `LoopRange` |
| 无选择 | — | 空拍 > 0 时循环全曲，否则顺序播放 |

命中测试以 `event.target.closest('.vf-notehead')` 为主、`elementsFromPoint` 为辅（决策 D6）；`noteIndex` 与播放数据同源对齐是硬约束（selection.md §2）。拖拽多行框选为二期，规格见 [features/text-selection.md](./features/text-selection.md)，实现落点为 `selection.ts` + `layout.ts`。

### 6.3 键盘快捷键

`Space` 播放/停止切换；`Esc` 停止并清除；输入框聚焦时忽略（`useKeyboardShortcuts`）。

---

## 7. 存储层

### 7.1 IndexedDB（库名 `tune-tutor-db`，版本 2）

| Store | keyPath | 索引 | 内容 |
| --- | --- | --- | --- |
| `files` | `id` | `uploadedAt`, `title` | StoredFile（含 rawContent + parsedScore 解析缓存） |
| `audioFiles` | `id` | `uploadedAt`, `fileName` | StoredAudioFile（`data: ArrayBuffer`） |

### 7.2 localStorage 键

| 键 | 值 |
| --- | --- |
| `note-slice-language` | 语言代码 |
| `note-slice-theme` | 皮肤 id（`paper`/`nocturne`/`walnut`/`celadon`/`stage`/`cobalt`/`palace`/`rosewood`/`lacquer`，原始字符串非 JSON；缺省 `paper`，非法值回落） |
| `note-slice-preferred-instrument` | InstrumentType |
| `note-slice-metronome-sound` / `-strong-volume` / `-weak-volume` | 节拍器偏好 |
| `note-slice-audio-slice` / `note-slice-audio-gap` | 原曲页切片与空拍 |

皮肤系统（2026-10-18 已实现，视觉与交互基准见 [features/skin-switching.html](./features/skin-switching.html) v1.1）：皮肤 = 在 `:root[data-theme=<id>]` 重定义 `src/index.css` 的 `--color-*` token（34 色 + 三组阴影），组件零写死色值、派生色走 `color-mix`；`ThemeProvider`/`useTheme`（`src/hooks/useTheme.tsx`）持全局皮肤状态并写 `document.documentElement.dataset.theme` + 本键，`index.html` head 内联脚本首帧写入防闪白；语义角色跨皮肤不变、色相允许重定（T1–T10 决策见设计稿 §④-05）。**图标（2026-10-18 用户决策，取代设计稿 T10「只换色不换形」）**：功能图标与乐器字形全部 SVG 化（`src/components/icons/`，几何共享于 `geometry.tsx`），每款皮肤以自己的笔触（`styles.ts` THEME_ICON_STYLES：线宽/端头/附属件填充）渲染出各自的一套图标，随 ThemeProvider 换肤整体重渲染；品牌标（反复记号）不在其列，几何恒定仍按 [brand.html](./brand.html) 铁律。OSMD 接入时 EngravingRules 取色须读 token（§6.1 契约，见设计稿 §④-04）。

### 7.3 启动恢复

读 `files` 最新一条 → 有则直接用 `rawContent` 渲染；无/失败 → 内置示范曲（`createDemoScore`，对应 `public/twinkle-twinkle-little-star.musicxml`）。原曲页同理取 `audioFiles` 最新一条。

---

## 8. i18n（手写，不引库）

- `I18nContext` 提供 `t`（TranslationSet）、`language`、`setLanguage`；四语言：`en-US`、`zh-CN`、`zh-TW`、`fr-FR`，各一 key 结构完全一致的文件。
- 语言检测顺序：localStorage `note-slice-language` → 浏览器语言 → 默认 `en-US`；切换即时生效并持久化。
- **硬约束**：任何用户可见文案必须进四语言文件；`tests/locales/index.test.ts` 断言四语言 key 集合一致 + 语言检测逻辑（重写时必须保留此测试）。

---

## 9. 构建与部署约束（不可破坏）

1. **`fs/promises` 垫片**：`vite.config.ts` 将 `fs/promises` 别名到 `src/vite-browser-shims/fs-promises.ts`（musicxml-io 引 Node fs）。删除该别名 = Vite 构建失败。
2. **GitHub Pages**：Vite `base` 与 PWA `scope`/`start_url` 均为 `/TuneTutor/`；路由用 HashRouter 规避静态托管 404。
3. **类型门禁**：无独立 typecheck 脚本，`pnpm build`（`tsc -b && vite build`）即类型检查；`pnpm lint`（eslint flat config + react-hooks/react-refresh）与 `pnpm test:run` 必须绿。
4. 组件目录扁平、不建桶文件 `index.ts`（历史教训：commit `db430e3` 已全量移除）。

---

## 10. 测试策略

| 层 | 对象 | 环境 |
| --- | --- | --- |
| 纯函数 | `sliceUtils`（钳制/循环计划）、`TempoConverter`、`buildPlaybackData`（mock OSMD cursor）、`TimingSource`（fake 时钟）、`PlaybackEngine`（fake 时钟 + fake 采样器）、`musicXMLParser`（样例 XML 片段） | node/jsdom |
| 存储 | `indexedDB` 增删查、启动恢复 | jsdom + `fake-indexeddb` |
| i18n | 四语言 key 完整性、语言检测 | node |
| 手动 | 用仓库根目录样例谱（`刻在我心底的名字.musicxml`、`musicxml/连音符.musicxml`、`public/twinkle-twinkle-little-star.musicxml`）过一遍 F1–F13 | 浏览器 |

---

## 11. 范围与里程碑

**范围**：与 PRD F1–F13 完全对齐（PRD F14 拖拽框选与 §7.2.2 规划功能 G1–G17 不入初始范围）。

**建议顺带修复（可选，改动极小）**：
- L3：FileLoaderModal 硬编码英文走 i18n；
- L4：文件选择器与文案开放 `.mxl`（解析层已支持）；
- L2：播放中按钮语义如实标注为「停止」（真暂停/续播为后续项）。

**重写里程碑**（对应 PRD §8 交付序，作为重写顺序）：

| 阶段 | 交付 | 验收 |
| --- | --- | --- |
| P0 基础设施 | 类型、垫片、i18n 骨架、存储层、示范曲 | build/test 绿 |
| P1 音频核心 | InstrumentLoader、TempoConverter、playbackData、TimingSource、PlaybackEngine | 单测绿；无 UI 可用样例谱验证调度 |
| P2 渲染与选择 | OsmdRender、NoteInteraction、selection、PhraseMarkers、OsmdNotation | 手动：加载样例谱、单击/双击选择正确 |
| P3 页面与控制 | ScorePage、PlaybackControls 全家、FileLoaderModal、StatusBar、快捷键 | F1–F9、F13 手动过单 |
| P4 原曲页 | OriginalAudioPage、wavesurfer 切片、空拍同步、持久化 | F10 手动过单 |
| P5 收尾 | i18n 四语言补全、PWA、README/tech 校对 | KR1–KR4 达成 |

---

## 12. 决策记录

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 播放数据只从 OSMD 光标派生（乐谱时域），废弃 ParsedScore 时长表近似 | 双轨计算漂移（RealValue vs 时长映射），统一后调度与指示器天然一致 |
| D2 | BPM 变更即时重锚定（引擎时钟 setBpm），不停止、零重建（v2.3 重写） | 乐谱时域数据 + 锚点时钟下变速天然免重建（官方 bpmChanged 同款）；旧「全量重建」随绝对秒时间轴废弃 |
| D3 | 音频文件存 ArrayBuffer 而非 Blob | structured-clone 兼容（fake-indexeddb、Safari） |
| D4 | 手写 i18n 而非引库 | 仅四语言、key 集合固定，测试可强制完整性，零依赖 |
| D5 | HashRouter + `/TuneTutor/` base | GitHub Pages 静态托管无 SPA 回退 |
| D6 | 命中测试以 event.target 为主、elementsFromPoint 为辅 | DOM target 永远精确；坐标换算受缩放/滚动影响 |

---

## 13. 技术验证记录（2026-10-17，重写前 spike）

验证脚本位于 `spike/`（临时资产，重写完成后可删除）：`parse-check.mjs`（Node，musicxml-io + jszip）；`osmd.html` + `osmd-main.ts` + `browser-check.mjs`（音频域，headless Chrome + Vite dev；注意 base 为 `/TuneTutor/`，dev 端口被占时顺延）；`selection.html` + `selection-main.ts` + `selection-check.mjs`（选择域，结论见 [selection.md](./selection.md) §8）；`sponsors-demo-extract/`（OSMD 官方赞助版 audio player 编译产物提取 + REA 静态语义逆向，行为规格见其 `rea/REA-ANALYSIS.md`）。

| # | 结论 | 对重写的影响 |
| --- | --- | --- |
| V1 | musicxml-io 输出形状与 §3 契约一致：`parts[0].measures[].entries[]`，`attributes.divisions/time/key`、note 的 `duration/pitch/rest/chord/grace/notations.ties` 均可用 | 解析层映射可按 §3 直写 |
| V2 | 曲名在 `metadata.workTitle`（两首样例的 `movementTitle` 均为 undefined）；作曲者在 `metadata.creators[type=composer].value` | 旧代码只读 movementTitle/无 composer 来源，属待修 bug |
| V3 | 附点字段名为 `dots`（样例实测 `"dots":1`）；旧代码读 `entry.dot` 恒为 0 | 重写用 `dots` |
| V4 | 仓库样例 `刻在我心底的名字.mxl` 已损坏（字节流含 U+FFFD，zip 长度字段污染，JSZip 报 Corrupted）；用合法 mxl 验证 container.xml → rootfile → 主谱链路可通 | 补一个合法 .mxl 样例；错误提示需覆盖损坏 zip 情形 |
| V5 | 两首样例均无 `<sound tempo>` 条目 | `tempo` 兜底 60 是必须路径，不是防御式冗余 |
| V6 | OSMD 加载渲染 73 小节样例（SVG 58 子节点）；光标遍历 462 步：387 发音 / 43 休止 / 32 连音线延续 / 4 装饰音；第 0 小节可只有休止符 | audio.md §2.2 规则实测成立；范围过滤需容忍「首小节无发音」 |
| V7 | 换算链端到端正确：附点四分 → RealValue 0.375 → `×4×(60/90)` = 1.000s（实测 `rv=0.375, 1.000s` 吻合） | audio.md §2.1 公式与实现一致 |
| V8 | Tone.js `Transport + Part + Draw.schedule` 在 headless Chrome 按 0.25s 间隔精确触发 4/4 | `Draw.schedule` 语义与 headless 验证装置可用（v2.3 起调度不用 Transport，本条保留为历史验证） |
| V9 | wavesurfer v7 `RegionsPlugin.create()` + `addRegion` 无需已解码音频即可建区 | 原曲页插件路径可用 |
| V10 | REA 逆向官方播放器（sponsors-demo-extract/rea/）：迭代器+自调度 setTimeout 驱动；loop 含次数/pauseMs/BPM 递增，回跳走 pre-count（DoLoopPreCount、keepNotes 不炸音）；pre-count 负时间轴（起点前移、越界 <50% 收缩）；力度归一化参考=全谱最大 velocity + 可选感知 dB 曲线；已播音符高亮 set/unset 不对称 | `src/audio/` 行为参数对照见 rea/REA-ANALYSIS.md §3/§5；与 audio.md 决策冲突时先复核该文 |
| V11 | musicxml-io 0.2.11 逐标记实测（2026-10-18）：倚音 `duration=0`+`grace.slash`、三连音 `duration` 已含缩放、divisions 逐小节继承（`[12, undefined]`）、query 函数收 `Score` 非 `Part`、错误分类（损坏 mxl / 仅支持 partwise） | 导入域细则与完整实测见 [musicxml.md](./musicxml.md) §4/§7（决策 M1–M10、I1–I8） |

---

*TuneTutor（包名 `tune-tutor`，仓库 `note-slice`）。工程约定详见 [AGENTS.md](AGENTS.md)，二者冲突时以 AGENTS.md 为准。*


