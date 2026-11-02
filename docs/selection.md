# TuneTutor 乐谱选择交互技术规格

**版本**: 1.6
**日期**: 2026-10-18
**状态**: P2 已落地（实现与本文同步；偏差随实现回写本文）
**变更**: 自 [tech.md](./tech.md) v2.1 §6 的选择交互部分（原 §6.2 命中测试 / §6.3 选择模型）拆分并扩写;成文前完成同类实现调研（乐谱类:OSMD、osmd-audio-player、alphaTab、Flat embed、Soundslice、MuseScore;通用选区模型:DOM Selection API、ProseMirror、Pointer 事件与 rubber-band 模式,摘录见 §9）与三样例谱的 spike 实测（§8）。本文生效后 tech.md 对应章节降为摘要。v1.1 将 §5.2 语义色对齐 ui-design v3「纸墨排练室」tokens——v1.0 引用的 v2 变量（`--iris` 鸢尾紫/`--loop` 橙）在 v3 已不存在,且 v3 中 START/END 括号同为朱砂 `--verm`、仅箭头方向区分（原「END = 红」作废）。v1.2 随 audio.md v2.0 架构变更:秒域「时间轴」表述全部改为乐谱时域「播放数据」;`LoopRange` 字段改 `startRv/endRv/skipBeats`（乐谱时域 + 拍,BPM 无关）;§2.3/§2.4/§4.5/§7/§9.4/决策 S8 同步——BPM 变更不再影响任何选择产物。v1.3 补触控缺口:iOS/iPadOS Safari 触控不触发原生 `dblclick`（WebKit bug 202143）,S6 的乐句双击在触控面必须并用 pointer 双击检测（§4.3,原曲页已落地 `useDoubleTap` 同款机制）;PC 鼠标与 iPad 触控双平台是硬要求（AGENTS.md 交互约定）。**v1.4（2026-10-18,P2 落地回写）**:①命中链拆分为「路由命中」（closest + elementsFromPoint,不做最近邻吸附——空白必须可达为框选入口,决策 S9）与「完整命中链」（句柄微调才走 GetNearestNote 回落）,§3.4 同步;②graphicIndex 只计可渲染音符（PrintObject ≠ false）,不可渲染音符仍占 noteIndex 播放位,§3.3 同步;③小节模式区间内无发音条目时由区间外条目夹出（曲首全休止小节可选,spike V6）,§2.4 同步;④框选修饰键在单区间 LoopRange 模型下的 toggle 语义 = 重叠裁剪取较长剩余段（决策 S10,features/text-selection.md §3.5 同步）;⑤pending 清零走显式信号（selection 保持 null 时 effect 不可达）,§4.3 同步;⑥autoResize 关闭,重渲染统一由组件 ResizeObserver 防抖驱动、与音符缓存失效同路,§3.2 同步。**v1.5（2026-10-18,随 audio.md v2.7 决策 A17）**:§2.3 发音/装饰音端点解析改**同 noteIndex 组跨度**——倚音发声与装饰音展开后,切片子条目与主音共号（audio.md §2.2-8/9）,区间 = 组首起到组末条目末刻（循环区间含倚音起点、终点不砍主音尾）;装饰音宿主为休止占位时回落下一发音条目。`noteIndex` 计数与 `occupiesPlaybackSlot` 不变。**v1.6（2026-10-18,框选拖拽实时预览）**:§4.2 拖拽期间选中区域实时预览——橡皮筋矩形仍直写覆盖层不进 state,选中视觉（行带/音符高亮/括号/句柄/pill）每帧由矩形现算覆盖区间,**区间变化门控**后才进 React state（未盖到音符时回落 committed 选择,`pointercancel` 清除预览）;修饰键取拖拽中**最新事件状态**（提交同值,所见即所提）;起板帧缓存容器原点,拖拽中零 `getBoundingClientRect`;提交与预览共用同一 `resolveBox` 解析（§6 规则 8 同步）。

---

## 0. 定位与范围

本文是 [tech.md](./tech.md) 在**选择域**的细化规格:tech.md 定框架（模块划分、数据契约、构建约束）,本文定乐谱页选择交互的全部细则。效力与 tech.md 同级,**选择域内冲突以本文为准**,并回改 tech.md。

- **覆盖**:`src/utils/notation/NoteInteraction.ts`（命中测试与音符坐标）、`selection.ts`（选择状态、端点解析、LoopRange 推导）、`layout.ts`（行几何）、选择覆盖层（`PhraseMarkers` 及框选覆盖层）、`OsmdNotation.tsx` 的指针事件接线。
- **不覆盖**:OSMD 渲染本身（tech.md §6.1）、播放数据构建与播放（[audio.md](./audio.md)——本文的 `LoopRange` 产物交给音频域消费）、数据契约唯一权威在 tech.md §3（本文只引用）、原曲页波形切片选择（audio.md §5,本文仅交互模式互相参照）、React 组件层级（prd.md §7.1）、用户可见文案（tech.md §8）。
- **产品锚点**:选择 = 圈定练习范围,产物统一是 `LoopRange`;KR2「建立一次乐句循环 ≤ 2 次双击」是交互设计的硬指标（prd.md §4）。

---

## 1. 模块与数据流

| 模块 | 职责 | 依赖 | 可测性 |
| --- | --- | --- | --- |
| `NoteInteraction.ts` | 图形遍历 → `NotePosition[]`（双索引）、DOM 配对、命中测试 | OSMD graphic + SVG DOM | 纯遍历可 mock 单测;DOM 命中走手动/spike |
| `selection.ts` | 选择状态机、端点解析、`LoopRange` 推导（唯一入口） | 播放数据（`playbackData`） | 纯函数 |
| `layout.ts` | 行几何推导（OSMD 换行 → `RowGeometry[]`,二期框选用） | OSMD graphic | 纯函数 + mock |
| 覆盖层组件 | 高亮/括号/范围条/（二期）框选矩形 | `NotePosition[]` + 行几何 | 手动 |
| `OsmdNotation.tsx` | 指针事件接管、覆盖层挂载 | 上述全部 | 手动 |

```
OSMD render ──waitForSvgContent──┬─▶ 图形遍历:NotePosition[]（graphicIndex + noteIndex 双索引, §2）
                                 └─▶ SVG DOM:.vf-notehead 元素 ──配对(§3.3)──▶ element↔NotePosition map
                                                                        │
指针事件(OsmdNotation, §4) ──命中──▶ 选择状态机(selection.ts) ──resolveEndpoint──▶ LoopRange ──▶ usePlayback/PlaybackEngine
                                                                        │
                                                     覆盖层(§5) ◀── 缓存 rect + 行几何 ──┘
```

---

## 2. 选择域数据模型

### 2.1 双索引空间（决策 S1,硬约束）

同一个音符存在两个正交的序号,**不得混用**（这是旧实现的潜伏缺陷,见 §8 V-S2）:

| 索引 | 计数规则 | 用途 |
| --- | --- | --- |
| `graphicIndex` | 图形遍历序:每个图形音符 +1,**含**休止符、装饰音、连音线延续音 | 与 `.vf-notehead` DOM 序配对、高亮切片、命中返回 |
| `noteIndex` | 复刻 buildPlaybackData 计数规则（audio.md §2.2）:装饰音、连音线延续音**不占位**;休止符与发音音符占位 | 选择状态、`LoopRange` 映射（`PlaybackEntry.noteIndex` 同源） |

- **对齐纪律**:任何一侧改动遍历顺序或计数规则,必须双侧同改 + 重跑双遍历一致性验证（§7/§8）。
- **单声部承诺**:产品范围 = 第一声部跟练旋律谱。实测单声部谱（含装饰音/延音/休止/双声部步）两层遍历顺序完全一致（V-S1）;多声部全音域选择的索引对齐依赖 buildPlaybackData 声部策略演进,在范围外（§10 后续候选）。
- 旧实现的错位量实测:连音符谱偏移 2,刻在我心底的名字偏移最大 36（首个分歧在图形序 21）——凡延音/装饰音之后的双击乐句与高亮都系统性错位。重写必须消除。

### 2.2 NotePosition（v2 修订）

```typescript
interface NotePosition {
  measureIndex: number;
  graphicIndex: number;   // 图形遍历序（DOM 配对序）
  noteIndex: number;      // 播放数据索引（grace/tieCont 不占位,§2.1）
  x: number; y: number;   // notehead 元素 getBoundingClientRect（容器相对像素）
  width: number; height: number;
}
```

`x/y/width/height` 一律取自 DOM rect（决策 S4,§3.5）;旧实现从 `PositionAndShape` 读宽高,实测运行时为 `undefined`（V-S4）,作废。

### 2.3 端点解析 `resolveEndpoint`（决策 S2）

选中音符 → 播放数据端点区间的唯一入口（`selection.ts` 纯函数）。`noteIndex` 沿播放数据严格单调递增（构建规则保证）,可二分查找:

| 选中端点类型 | 解析规则 |
| --- | --- |
| 发音音符 `n` | 二分找 `noteIndex === n` 的**组**（同号条目可能多条——倚音/装饰音切片与主音共享 noteIndex,audio.md v2.7 决策 A17）→ 区间 = 首条目 `startRv` 到末条目 `startRv + durationRv`（循环终点不砍主音尾） |
| 休止符 `n` | 播放数据无该条目:作为**起点** = 前一条目的 `startRv + durationRv`（前面无条目则 0）;作为**终点** = 后一条目的 `startRv`（后面无条目则曲终） |
| 装饰音 | 倚音发声后（audio.md §2.2-8）装饰音不再「无独立时长」:其 `noteIndex` = 宿主主音 → 解析为所在**组跨度**;宿主为休止占位（无同号组）时回落到下一个发音条目,不存在则端点无效 |
| 连音线延续音 | 解析为其 `NoteTie.StartNote` 的 `noteIndex`（播放数据条目已含 tie 合并时长,audio.md §2.2） |

解析失败（`noteIndex` 不在任何端点规则覆盖内、区间 `start ≥ end` − ε）→ 本次选择无效,不产生 `LoopRange`,UI 提示（走 i18n）。

### 2.4 LoopRange 推导（唯一入口 `selection.ts`）

| 模式 | 端点 | `skipBeats` |
| --- | --- | --- |
| 乐句循环 | 双击两端点分别 `resolveEndpoint` | 0 |
| 小节选择 | 按 `measureIndex` 过滤播放数据取首/末条目 | 用户设置（1–8 拍） |
| 全曲 | 0 → 曲终 | 用户设置（> 0 才循环,否则顺序播放） |

小节模式兜底（v1.4）:区间内无发音条目（如曲首全休止小节,spike V6 实测「第 0 小节可只有休止符」）→ 由区间外条目夹出（起点 = 区间前最后条目末刻/0,终点 = 区间后首条目起刻/曲终）,与休止符端点规则同构;区间外也无条目（空播放数据）或 `start ≥ end` − ε → null（无效选择）。

优先级:乐句 > 小节 > 全曲（tech.md §6.2 摘要）。组件**禁止**自算 `LoopRange`——与音频域「一切拍秒换算走 TempoConverter」同一纪律,防止多处推导漂移;秒只在引擎入口/UI 显示时现算（audio.md §2.1）。`LoopRange` 是乐谱时域（tech.md §3）,**BPM 无关**:变速、重建播放数据都不影响已产生的范围与选择状态（audio.md A2/A12）。

---

## 3. 命中测试与音符坐标（NoteInteraction）

### 3.1 双源结构与身份链

- **OSMD graphic**（`osmd.graphic.measureList[m][staff].staffEntries[].graphicalVoiceEntries[].notes[]`）:结构与索引的权威。图形音符的 `sourceNote` 与光标层 `Iterator.CurrentVoiceEntries[].Notes[]` 是**同一对象**（V-S1 身份链验证）,以此对齐两层。
- **SVG DOM**（`.vf-notehead` 元素）:命中与像素的权威。命中测试不用坐标换算（决策 D6 沿承）。

### 3.2 构建流程（渲染后一次,缓存至下次渲染）

```
waitForSvgContent（tech.md §6.1）
→ 图形遍历:产出 NotePosition[]（双索引按 §2.1 规则）
→ DOM 配对:element ↔ NotePosition（§3.3 三层防线）
→ rect 缓存:批量 getBoundingClientRect（容器相对）,存入 NotePosition
→ 自检:配对数守卫 + 几何抽查（§3.3）;失败部分降级,console.warn
```

缓存（positions、element map、rect）在 OSMD `clear()`/重渲染/缩放/换肤/容器尺寸变化时全量失效（tech.md §6.1 渲染单例与失效契约沿用）。v1.4 落地:OSMD `autoResize` 关闭,组件以 ResizeObserver 防抖（200ms、宽度变化才触发）调用同一条重渲染路径（渲染 → waitForSvgContent → 重建缓存）,避免 OSMD 自行重渲染绕过缓存失效。

### 3.3 DOM 配对三层防线（决策 S3）

**禁止假设图形音符与 notehead 全局 1:1**:实测存在洞——刻在我心底的名字有 3 个小节（m33/m58/m69）图形层有音符但 DOM 无 notehead,且 `vf-measure` 分组数（70）少于小节数（73）（V-S3）。旧实现 `min()` 全局 zip 在洞之后**整体错位**,是必须消除的第二个潜伏缺陷。

1. **主路径:全局 zip + 计数守卫**——图形遍历序与 `querySelectorAll('.vf-notehead')` 序 zip;两侧数量不等即整条放弃,降级到 2。图形序只计**可渲染音符**（`PrintObject !== false`）:配对序必须与 DOM 序对齐;不可渲染音符不占 graphicIndex 但仍占 noteIndex 播放位（播放数据经光标层计数,跳过会错位,v1.4）。
2. **几何自检**——配对完成后,逐项比对元素 rect 与 `PositionAndShape.AbsolutePosition × 10 × zoom`（仿射关系已实测成立,V-S4;容差 5px）。不合格配对从 map 剔除。
3. **回落路径:几何最近邻**——对自检后仍无元素的图形音符,用「px ÷ 10 ÷ zoom → unit」换算 + `GetNearestVoiceEntry`/`GetNearestNote`（官方命中原语,1.9.7 实测存在;issue #857 的推荐姿势）反查。

洞小节（无元素）的音符不可点击、不高亮——产品可接受（无视觉物可点）;其所在小节的选择通过小节内其他音符落点（小节选择按 `measureIndex` 取整小节区间,§2.4）兜底。

### 3.4 命中策略（v1.4 拆分:路由命中 vs 完整命中链,决策 S9）

- **路由命中**（`pointerdown`/`dblclick` 的分发）:`event.target.closest('.vf-notehead')` → element map 查 `NotePosition`（主路径,永远精确）;不中回落 `document.elementsFromPoint`。两者皆不中（空白区域）→ 返回 null = **框选入口**（§4.2）,不是错误。**不做最近邻吸附**:路由层若吸附最近音符,空白按下会变成「点音符」,框选入口在音符邻域不可达;Soundslice 式空白吸附是 §10 后续候选。
- **完整命中链**（框选边界句柄微调等显式吸附场景）:在路由命中之上追加 §3.3 防线 3 的 `GetNearestNote` 回落（px ÷ 10 ÷ zoom → unit,官方原语）。

### 3.5 坐标系规则（决策 S4）

- **屏幕像素的唯一来源是 `getBoundingClientRect`**（容器相对换算）。滚动、缩放（`osmd.zoom`）、CSS 布局天然被 DOM rect 吸收。
- OSMD 内部 unit 只用于与官方 API 交互,换算一律用官方公式 **px = unit × 10 × zoom**（issue #504;实测吻合,V-S4）。`PositionAndShape` 的 `Width`/`Height` 运行时为 `undefined`,禁止读取。
- 旧实现 PhraseMarkers 因「OSMD 内部坐标 vs CSS 布局错位」改用 DOM rect,结论通用化为本规则。

---

## 4. 选择状态机与指针管线

### 4.1 状态与产物

```
idle ──双击Y──▶ pending(start=Y,弱高亮) ──双击Z──▶ committed(start=Y,end=Z)──┐
 ▲ ▲                              │单击W(500ms无dblclick)                    │双击W
 │ └──────────单击Y(即时选Y小节)───┘（pending 延迟销毁,乐句意图放弃）            │pending(start=W)
 │                                                                           │
 └─────────────────── Esc / 清除按钮（全部清零）◀─── committed ──双击外音符───┘
```

- `committed` 乱序自动换位（`start > end` 时换位,tech.md §6.2）;再次双击已选乐句外音符 = 开始新乐句（同 tech.md）。
- 单击任意音符**即时**选中其所在小节并替换 `committed` 乐句（「最新一次交互定义当前 `LoopRange`」）;`pending` 只存于 ref,单击不直接破坏它（§4.3 竞态处理）。
- 外部清零（Esc/清除按钮）经**显式信号**通知交互层销毁 `pending`（v1.4:selection 保持 null 时 prop-effect 不可达,信号递增即清）;换谱/重渲染路径由装载 effect 直接销毁。

### 4.2 指针事件管线（决策 S5）

| 阶段 | 行为 |
| --- | --- |
| `pointerdown` | 命中 notehead → 记录候选点击,`setPointerCapture` 到乐谱容器;命中空白 → 二期框选入口（features/text-selection.md §3.4） |
| `pointermove` | 位移超 slop（**4px**,与 ProseMirror 同款）→ 进入拖拽态,置 suppressClick 标记;二期框选自此起板,拖拽中选中区域实时预览（v1.6,见下） |
| `pointerup` | 位移 < slop → 提交单击语义（§4.1）;拖拽态 → 提交 `DragSelection`（text-selection.md） |
| `pointercancel` | 中止,不产生任何选择（浏览器接管手势,如滚动/缩放） |

乐谱卡拖拽面设 `touch-action: none`,否则滚动接管手势后 `pointermove` 停发;拖拽结束抑制后续 `click`（d3-drag `clickDistance` 语义的手动实现）。拖拽期间高频更新分两路（v1.6）:橡皮筋矩形走 ref + rAF 节流直写覆盖层 style,**不进 React state**;选中区域（行带/音符高亮/括号/句柄/pill）**实时预览**——每帧由矩形现算覆盖区间,区间**变化时**才进 React state（rAF 合帧 + 门控,一次拖拽只渲染区间跨越次数）,矩形下没有音符时回落 committed 选择（不闪烁清空）,`pointercancel` 清除预览。抬手提交不变,提交与预览共用同一解析函数（所见即所提）。修饰键（Shift/Ctrl-Cmd）取**最新事件状态**:拖拽中按下/松开即时反映到预览,提交同值。容器原点在起板帧缓存一次,拖拽中零 `getBoundingClientRect`（features/text-selection.md §6 原则 1,通用模式见 §9.3）。

### 4.3 双击检测（决策 S6:原生 `dblclick` + pending ref + 延迟销毁窗口）

旧实现用 300ms 自定义定时器双击窗口,代价是**每次单击都延迟 300ms** 才选中小节,且定时器状态机复杂。v2 改为:

- 单击（pointerup 且 < slop）:**立即**选小节,零延迟。
- 乐句起点/终点:原生 `dblclick` 事件承载（KR2 的「双击」语义不变）。
- `pending` startNote 存独立 ref。竞态在于:双击的第二击（endNote）其第一击也是一次 `click`,若单击直接清除乐句意图会吞掉 `pending`。处理:`click`（detail=1）时若 `pending` 非空,**延迟 500ms 销毁**;窗口内来了 `dblclick` 则取消销毁并提交 `committed`。窗口对齐浏览器双击阈值（Chrome 500ms）,误保留 `pending` 半秒无害（仅弱高亮起点）。

> **触控补充（v1.3,双平台硬要求）**:iOS/iPadOS Safari 触控**不触发**原生 `dblclick`（WebKit bug 202143）,乐句双击在触控面必须并用 pointer 双击检测（两次 `pointerdown` 的时间窗 + 位移判定,参照已落地的 `src/hooks/useDoubleTap.ts`:窗口 400ms、位移 slop 24px、`isPrimary` 过滤多指、`pointercancel` 重置）。桌面侧原生 `dblclick` 事件保留,两条路径并存,**处理必须幂等**（会先后触发,由选择状态护栏去重）;`pending` 销毁窗口的取消条件相应放宽为「原生 `dblclick` **或** pointer 双击到达」。

### 4.4 修饰键与键盘

二期框选的 Shift（扩展）/Ctrl-Cmd（切换）语义沿用 features/text-selection.md §3.5;`Space`/`Esc` 走 `useKeyboardShortcuts`（tech.md §6.3）。方向键导航选择、APG listbox 式键盘模型（§9.3）不在本期范围（§10 后续候选）。

### 4.5 与播放域的契约

选择状态每次变化（含进入/退出 `pending`）→ `selection.ts` 重推 `LoopRange` → `usePlayback.setLoopRange`（null = 清除,无选择时按空拍规则循环全曲或顺序播放,audio.md §3.4）。播放中改变选择:允许,新边界写入引擎循环状态,当前段播完回跳时按新边界执行——不重定位进行中的迭代（audio.md §3.4）。

---

## 5. 选择视觉（覆盖层）

### 5.1 统一覆盖层栈（决策 S7）

容器内绝对定位 HTML 覆盖层（`PhraseMarkers` 同款叠加模式）,承载全部选择视觉:pending 起点弱高亮、committed 音符高亮矩形、START/END 括号、范围条、（二期）框选矩形与边界句柄。除边界句柄外 `pointer-events: none`。z-index 高于 OSMD 内容（播放光标是 zIndex −2 的 `<img>` 覆盖,section 9.2;设置 PageBackgroundColor 时会升到 1,覆盖层取 8+ 避让）。

**挂载锚盒（2026-10-18 实测补记）**:覆盖层根节点必须挂在**与 OSMD 容器同原点的相对定位盒**上（OsmdNotation 的 `sheetBox` 包裹层）,不得直接挂在乐谱卡 stage 上——stage 是垂直居中的 grid 且 `flex: 1` 撑满卡面,坐标随卡面高度漂移（症状:播放光标带悬空在谱表上方百余像素）。框选拖拽矩形同一坐标系（`localRect`/`writeDragRect` 减**容器** rect 而非 stage rect）。

**不采用的两种高亮路径**（调研依据 §9.1/§9.2）:官方 `sourceNote.NoteheadColor` + 重渲染（issue #434 的推荐路线,重渲染代价违反「选择变化不得触发 OSMD 重渲染」）;直接改 SVG `style.fill`（旧实现路径,`<use>` 元素上验证可行,但侵入 OSMD SVG、需自管恢复属性、与 React 重渲染纠缠）。覆盖层方案与 alphaTab 的 `div.at-selection` 同构（§9.1）。

### 5.2 坐标来源与更新

- 覆盖层全部坐标读 §3.2 的 rect 缓存——选择变化**零 DOM 读取**;OSMD 重渲染/缩放 → 缓存失效重建。
- 括号标记取整小节谱行高度:`GraphicalMeasure.ParentStaffLine.StaffLines[0/4].SVGElement` 的 `getBoundingClientRect()`（旧实现已验证路径）。
- 语义色对齐 [ui-design.html](./ui-design.html) v3「纸墨排练室」tokens（v1.1 修订：v1.0 曾引 ui-design v2 的鸢尾紫/橙，v3 已无 `--iris`/`--loop` 变量）：练习循环语义 = 朱砂 `--verm #c2431f`——committed 音符高亮矩形、范围条与范围带、START/END 括号与箭头旗标**两端同色**，仅 `|▶`/`◀|` 箭头方向区分（设计稿实测 `.sel-band` = rgba(194,67,31,0.07)、`--verm-soft` = rgba(194,67,31,0.09)，括号/旗标 = `--verm`）；交互进行中（pending 起点弱高亮、二期框选矩形）= 交互主色墨 `--ink #241f15` 低透明度填充（v3 无 ink-soft 变量，参照既有 soft 格式取 rgba(36,31,21,0.08) 一档）；`--red #b04a3f` 是状态色（删除悬停等），不用于 END 括号。
- 多行框选的逐行矩形与跨行连接视觉 → features/text-selection.md §5（本图景不重复）。

---

## 6. 工程约束清单（选择域硬规则）

1. `graphicIndex`/`noteIndex` 双索引计数规则见 §2.1;任何一侧改动必须双侧同改 + 双遍历一致性回归（§7）。graphicIndex 只计可渲染音符（PrintObject ≠ false,v1.4）。
2. DOM 配对禁止假设全局 1:1;zip 必须带计数守卫 + 几何自检（§3.3）。
3. 屏幕像素唯一来源 `getBoundingClientRect`;unit 换算只用官方公式 `×10×zoom`;禁止读 `PositionAndShape.Width/Height`（§3.5）。
4. `LoopRange` 一律由 `selection.ts` 推导,组件禁止自算（§2.4）。
5. 任何选择变化不得触发 OSMD 重渲染;高亮画在覆盖层（§5.1）。
6. 命中/配对/rect 缓存随渲染、缩放、换肤、容器尺寸变化全量失效;autoResize 关闭,重渲染与缓存失效走同一条路径（§3.2,tech.md §6.1）。
7. 指针管线:`setPointerCapture` + `touch-action: none` + 4px slop + 拖拽后抑制双击;`pointercancel` 中止一切（§4.2）。
8. 拖拽高频更新不整体进 React state:橡皮筋矩形直写 style;选中预览按覆盖区间变化门控进 state（rAF 合帧）;抬手提交（§4.2 v1.6,text-selection.md §6）。
9. 乐句双击（S6）双路径:桌面原生 `dblclick` + 触控 pointer 双击检测（iOS/iPadOS 不触发原生 dblclick）;两路径处理幂等——同一手势的双信号（刚提交的终点音符窗口内重复信号、同音符重复双击）由状态护栏去重（§4.3）。
10. 命中路由不做最近邻吸附（空白 = 框选入口必须可达）;GetNearestNote 回落仅用于句柄微调等显式吸附（§3.4,S9）。
11. 外部清零必须经显式信号销毁 pending（selection 保持 null 时 prop-effect 不可达,§4.1）。

---

## 7. 测试策略（选择域）

| 层 | 对象 | 要点 | 状态 |
| --- | --- | --- | --- |
| 纯函数 | `resolveEndpoint` | 四类端点 × 起点/终点;边界:曲首休止、曲尾休止、tie 端点、装饰音后无发音、`start ≥ end` 无效区间 | vitest（tests/utils/notation/selection.test.ts） |
| 纯函数 | `computeLoopRange` | 三模式 × skipBeats;优先级;空播放数据守卫;小节模式空区间兜底 | vitest（同上） |
| 纯函数 | 计数规则镜像 | `occupiesPlaybackSlot`（图形遍历计数 = buildPlaybackData 计数的唯一判定,P1 复用）;装饰音指向下一占位音、延续音指向起始音;PrintObject 仍占位 | vitest（tests/utils/notation/NoteInteraction.test.ts） |
| 纯函数 | 框选几何 | 行几何、每行高亮分片、拖拽矩形 → 区间（正向/反向/跨行/无命中）、修饰键语义 | vitest（tests/utils/notation/layout.test.ts） |
| 组件 | 指针管线与覆盖层 | 单击小节/双击乐句（幂等）/框选/句柄微调/pointercancel 中止/外部清零信号/缩放步进（jsdom + OSMD 假件,rect 钉值） | vitest（tests/components/OsmdNotation.test.tsx、tests/pages/ScorePage.test.tsx） |
| 手动 | 三样例谱回归 | 单击小节正确（**重点:m33/m58/m69 洞小节邻域**）;双击乐句跨延音/装饰音区段后循环范围与高亮一致;Esc/清除;BPM 变更后循环范围随乐谱位置不变 | 待播放域（P1）接入后过单 |
| 手动 | spike 复验 | `pnpm dev` + `node spike/selection-check.mjs`,V-S1–V-S6 作回归基线 | 待过 |

> jsdom 限制:无布局引擎,`elementsFromPoint` 无几何语义——命中路由只测 closest 路径,几何层以 spike（headless Chrome）+ 手动覆盖。

---

## 8. 技术验证记录（spike ③:选择域,2026-10-17,成文前实测）

脚本:`spike/selection.html` + `selection-main.ts` + `selection-check.mjs`（headless Chrome + Vite dev,复跑方式见 §7）。三样例谱:刻在我心底的名字（73 小节）、musicxml/连音符、public/twinkle-twinkle-little-star。

| # | 结论 | 数据 | 对重写的影响 |
| --- | --- | --- | --- |
| V-S1 | 单声部谱两层遍历顺序一致;身份链（graphic.sourceNote ≡ cursor 层 Note 对象）成立 | 三谱 `orderMismatches=0`;刻谱 mapped 427 + unmapped 36（=32 tieCont + 4 graces,分毫不差） | §2.1 双索引方案可行;身份链可作对齐锚 |
| V-S2 | 旧实现单索引混用两义 → 延音/装饰音后系统性错位 | 连音符 maxOffset=2;刻谱 maxOffset=36,首个分歧图形序 21 | 决策 S1;双击乐句/高亮错位为旧实现潜伏 bug |
| V-S3 | DOM 配对存在洞,禁止全局 1:1 假设 | 刻谱 3 个小节 dom=0/struct=1（m33/m58/m69,rest+print=true+inCursor=true）;vf-measure 组 70 < 小节 73;twinkle 48 图形音符 = 48 notehead（休止符**有** notehead）;连音符 18=18 | 决策 S3 三层防线;旧 `min()` zip 从洞后整体错位 |
| V-S4 | 坐标仿射:px ≈ `AbsolutePosition × 10 × zoom` + 标定偏移（±3px 锚点方差）;`PAS.Width/Height` 运行时 `undefined` | twinkle 实测斜率 9.7–10.0、偏移 ≈ −6px（容器 padding） | 决策 S4;几何自检可行（容差 5px）;旧 NotePosition 宽高从来无效 |
| V-S5 | OSMD 开源版无公开选区/点击 API;官方命中原语存在且 1.9.7 可用 | issue #262/#1056（open,2018–）;`GetNearestNote`/`svgToOsmd`/`domToSvg`/`svgToDom`/`GetNearestVoiceEntry` 在 1.9.7 build 实测命中（§9.2） | 选择交互必须自建;回落路径可用官方原语 |
| V-S6 | 官方开源 demo 仅有 cursor 按钮（next/reset/show/hide）,无任何音符交互 | spike 内嵌 demo 源码检查 | 同上;`CursorOptions`（含 `CurrentArea` 整小节光标型）仅作备用 |

**开放疑点**（不阻塞,记录在案）:V-S3 的 3 个洞小节成因未深查（音符 print=true 且在光标层可见,但 OSMD 未渲染）;3 个缺失的 vf-measure 分组归属未定位。两者都被三层防线覆盖。

---

## 9. 同类实现调研摘要（2026-10-17,成文前调研）

### 9.1 乐谱类产品

| 项目 | 选区单位 | 命中测试 | 区间存储 | 鼠标交互 | 高亮渲染 |
| --- | --- | --- | --- | --- | --- |
| [OSMD 开源版](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | 无公开选区 API | 手动:px ÷10÷zoom → [`GetNearestNote`](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/857) | `MusicSheet.SelectionStart/End`（Fraction 时间戳,仅数据层,[#262](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/262) open） | 无内置（事件系统在闭源 sponsors 版,#1056） | 应用层自绘;cursor 为 `<img>` 覆盖（`CursorOptions`,含 `CurrentArea` 整小节型） |
| [osmd-audio-player](https://github.com/jimutt/osmd-audio-player)（停维） | 播放步（= 声部条目） | 无 | 无区间/循环（仅 `jumpToStep`） | 无 | 驱动 `osmd.cursor.next()`,无自有高亮 |
| [alphaTab](https://alphatab.net/docs/reference/types/alphatabapi)（最完整参照） | Beat（交互）;MIDI tick（落库） | [`boundsLookup.getBeatAtPos/getNoteAtPos`](https://alphatab.net/docs/reference/types/rendering/boundslookup)（库暴露逐拍屏幕矩形） | [`highlightPlaybackRange(startBeat,endBeat)`（高亮）与 `applyPlaybackRangeFromHighlight()`（提交）分离](https://alphatab.net/docs/releases/release1_8);提交后 `playbackRange = {startTick,endTick}` | 库内置拖拽选拍 + `beatMouseDown/Move/Up` 事件,应用自定义句柄（拖拽中持续发 `playbackRangeHighlightChanged`） | DOM 覆盖层（`div.at-selection` 等 CSS 类）,非重绘 |
| [Flat embed](https://flat.io/developers/docs/embed/api/) | 音符序号 + measure/voice UUID | 黑盒 | [`rangeSelection` 事件](https://flat.io/developers/docs/embed/api/events):`{left:{measureUuid,noteIdx…},right:{…}}`（right 含端）;无 setter | 内部实现未公开 | 黑盒 |
| [Soundslice](https://www.soundslice.com/help/en/embedding/javascript-api/39/playback)（闭源） | 秒（UI 层吸附音符/休止/小节线） | 黑盒 | [`setLoop([startSec,endSec])`](https://www.soundslice.com/help/en/player/basic/4/looping) | 桌面任意处拖选循环（自动吸附）;边缘拖拽调宽;点击清除;移动端按钮建当前小节循环 | 黑盒;循环外乐谱变暗 |
| MuseScore 4（交互参照） | 范围端点 = **音符/休止**（非小节） | 原生元素模型 | 范围 = 时间跨度 × 声部;列表选择不连续 | [点击/Ctrl 加选/Shift+点击定终点/Shift+拖框](https://handbook.musescore.org/basics/selecting-elements) | 选中元素着色 |

### 9.2 OSMD 内部设施盘点（开源 1.9.7,经 spike 与源码核实）

- **没有公开的选区/点击 API**:点击事件 [issue #262](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/262)（2018 起 open）、[#1056 通用事件](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/1056)（维护者:实现复杂,事件系统在闭源 osmd-extended 内）。`MusicSheet.SelectionStart/End` 是 `Fraction` 时间戳（公开读写但无 UI,主要约束渲染范围/内部播放器）;`DrawingParameters.drawSelectionStart/EndSymbol` 是内部兼容符号绘制,非选区状态机。
- **官方命中原语**（1.9.7 实测存在）:`GetNearestNote(clickPoint, maxDist, page?)`、`GetNearestVoiceEntry(point, skipGraces, staffIdx?)`、坐标换算 `svgToOsmd`（÷10,不除 zoom——zoom 调用方处理）/`domToSvg`/`svgToDom`（经 `getScreenCTM`）。推荐姿势 = [#857](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/857):`(clientX − container.offsetLeft) ÷ 10 ÷ zoom` → `GetNearestNote`。
- **单位制**:1 unit = 10px @ zoom 1（[#504](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/504),与 spike 实测吻合）。
- **播放光标是 `<img>` 覆盖**（非 SVG）,`CursorType.CurrentArea` 可整小节高亮——本产品小节选择不用它（光标已是播放指示,复用会冲突）,记录备用。
- **音符着色官方路线** = `sourceNote.NoteheadColor` + 重渲染（[#434](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/434)）——重渲染代价,不采用（§5.1）。
- **升级注意**:2.x 起 `osmd.graphic` 转 protected,公开入口为 `osmd.GraphicSheet`;`cursor.nextMeasure()/previousMeasure()` 为新版新增（1.9 是否含未核实）。升级 OSMD 大版本必须回归命中/配对（对齐 audio.md §4 的升级纪律）。

### 9.3 通用选区模型（web 平台）

- **anchor/head 模型**（[MDN Selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection)、[ProseMirror](https://prosemirror.net/docs/ref/)）:anchor（起点,不动）与 head（动端）分离表达方向,`from=min/to=max` 供消费;选择存**文档位置而非屏幕坐标**,像素只在绘制时映射。`Range.getClientRects` 的逐行盒模型 = 多行选择的分片矩形绘制模式。
- **点击 vs 拖拽判定惯例**:ProseMirror 4px、[viselect](https://github.com/simonwep/viselect) 默认 10px 起板阈值;拖拽后抑制 click 用 [d3-drag `clickDistance`](https://d3js.org/d3-drag) 语义。React Aria `usePress` 无像素阈值（以 `pointercancel`/滚动为准）——不同库按场景取舍,本文取 4px（§4.2）。
- **Pointer 管线**:[`setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) 重定向后续事件到容器;`touch-action: none` 防滚动接管（否则 `pointercancel`）;拖拽中 rAF 节流 + 命令式更新（viselect `frames()` 同构）。
- **实体级选择**（ProseMirror `NodeSelection`）:以节点为单位的选区与文本范围选区同构共存——对应本产品「单击 = 小节（实体级）/ 双击两点 = 音符范围」的双模式。
- **键盘模型**（[W3C APG listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)）:Shift+方向扩展、Ctrl+A 全选;平台 Shift/Ctrl+Click 惯例无 web 标准,按平台惯例实现。

### 9.4 结论（去向见 §10）

1. **OSMD 生态没有任何可直接复用的选择层**（开源无 API、osmd-audio-player 无区间、闭源版不公开）——与音频域「不自研调度器」相反,选择交互只能自建,本文即其规格。
2. alphaTab 是最完整的参照:高亮/提交分离、库暴露几何 + 应用组合语义、DOM 覆盖层渲染——三点全部采纳（S3 几何、S5 管线、S7 覆盖层）。
3. 区间存储业界两派:alphaTab 用 tick（速度无关）、Soundslice 用秒。v1.0 曾沿用秒域;随 audio.md v2.0（决策 A12）改入速度无关阵营——`LoopRange` 以乐谱时域存储（tech.md §3 权威）+ 索引态选择,与 alphaTab 同派,变速零影响。
4. 旧实现的两处潜伏缺陷（索引混用、全局 zip）在同类项目的实现里都有对应防护（alphaTab 显式 beat 边界、Flat 双端音符序号）,本文规则不是过度设计。
5. Soundslice 的「边缘拖拽调宽 + 拖选自动吸附」验证二期框选句柄设计的可行性（text-selection.md §7 的句柄验收项）。

---

## 10. 决策记录

| # | 决策 | 理由（调研/实测依据见 §8/§9） |
| --- | --- | --- |
| S1 | 双索引空间:graphicIndex（配对/高亮）与 noteIndex（时间轴映射）分离 | 旧实现混用导致延音/装饰音后错位 2–36（V-S2）;两层计数规则本就不同,混用无解 |
| S2 | 端点解析为 `selection.ts` 纯函数（发音/休止/装饰音/延音四类规则 + 二分） | 旧实现在端点无条目时静默失败;规则集中一处可单测 |
| S3 | DOM 配对三层防线:全局 zip + 计数守卫 → 几何自检（容差 5px）→ `GetNearestNote` 回落 | 洞实测存在（V-S3）;仿射关系实测成立（V-S4）;官方原语 1.9.7 可用（V-S5） |
| S4 | 屏幕像素唯一来源 `getBoundingClientRect`;unit 只经官方公式换算 | PAS 宽高运行时 undefined（V-S4）;DOM rect 吸收滚动/缩放/布局（旧 PhraseMarkers 教训通用化） |
| S5 | Pointer 事件管线:down 路由 + setPointerCapture + touch-action:none + 4px slop + 拖拽抑制双击 + pointercancel 中止 | ProseMirror/d3-drag/viselect 同款惯例（§9.3）;跨设备统一鼠标/触控 |
| S6 | 乐句用原生 `dblclick`;单击零延迟选小节;pending startNote 存 ref + 500ms 延迟销毁窗口 | 旧 300ms 定时器让每次单击延迟 300ms;延迟销毁解决「双击第二击的第一击破坏 pending」竞态,窗口对齐 Chrome 双击阈值 |
| S7 | 高亮/括号/框选统一 HTML 覆盖层;坐标读渲染后 rect 缓存;不改 SVG fill、不用 NoteheadColor 重渲染 | alphaTab 同构（§9.1）;零 DOM 读取支撑拖拽 60fps;fill 侵入 OSMD SVG 需自管恢复（旧路径）,NoteheadColor 要重渲染（#434） |
| S8 | 选择是会话态,不持久化;`LoopRange` 每次由 selection + 播放数据现算 | 旧实现亦然;乐谱时域下 `LoopRange` 与 BPM 无关,变速/重建播放数据都无需重推（audio.md A2/A12） |
| S9 | 命中链拆分:路由命中（closest + elementsFromPoint）不做最近邻吸附;GetNearestNote 回落仅用于句柄微调 | 路由层吸附会让音符邻域的空白按下变成「点音符」,框选入口不可达（v1.4 落地时定案）;Soundslice 式空白吸附留 §10 候选 |
| S10 | 框选修饰键在单区间 LoopRange 模型下的语义:Shift = 并集;Ctrl/Cmd = 重叠裁剪取较长剩余段、不重叠并入 | 单区间是 LoopRange 产品的形状（§2.4）;完整 toggle 需多区间状态,先以裁剪近似并在 UI 呈现上保持单一选区（v1.4） |

**后续候选（不在本期,记录调研到的实现路径）**:

- 多声部全音域选择:依赖 buildPlaybackData 声部策略演进（audio 域）,索引对齐需重新推导,先不做;
- 方向键导航选择 + APG 键盘模型（Shift+方向扩展、Ctrl+A）:交互扩展,不阻塞 KR2;
- OSMD 升级 2.x:接入 `osmd.GraphicSheet`/`svgToOsmd` 官方换算替换自写仿射;升级必回归命中/配对（§9.2）;
- 空白点击/框选起点的音符吸附:用 `GetNearestVoiceEntry(skipGraces=true)` 实现 Soundslice 式吸附。

---

*本文为 tech.md 选择域拆分件;工程约定见根目录 [AGENTS.md](../AGENTS.md),冲突时以 AGENTS.md 为准。*
