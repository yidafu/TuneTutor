# TuneTutor MusicXML 导入解析技术规格

**版本**: 1.2
**日期**: 2026-10-28
**状态**: Ready for Re-implementation
**变更**: 1.2——装饰音/倚音实测补全（§2 文法枚举改 io 0.2.11 可产出 13 种、§3 行 10、§4.5 倚音和弦与 steal-time 丢弃、§4.6 播放消费对齐 audio.md A17、§7-I1/I9 补记），解析/播放域单测补全覆盖同步落地。1.1——夹具谱实测补记（§7-I9/I10）、keySignature「首个」语义澄清（§2，同步修复解析器顶层取值）、测试策略补夹具集成层（§8）。初版自 [tech.md](./tech.md) v2.3 §2.2（数据流）/§3（数据契约）的导入解析域拆分扩写；成文前以 `musicxml-io` 0.2.11 对仓库三份样例谱逐标记实测（§7），给出五线谱**连线符（连结线 tie / 连线 slur）、停顿（休止系）、连音（tuplet）、装饰音（ornament）、倚音（grace note）等全部标记**的解析映射、契约承载与播放/渲染职责边界，含决策 M1–M10。本文生效后 tech.md 对应章节降为摘要。

---

## 0. 定位与范围

本文是 [tech.md](./tech.md) 在**导入解析域**的细化规格：tech.md 定框架（模块划分、数据契约、存储/构建约束），本文定 MusicXML 文件进入系统的全部细则。效力与 tech.md 同级，**导入解析域内冲突以本文为准**，并回改 tech.md。与既有域拆分件的关系：音频域细则在 [audio.md](./audio.md)、选择域细则在 [selection.md](./selection.md)，本文只负责「文件 → 文本 → `Score` → `ParsedScore`」，标记的**播放语义**归 audio.md、**选择语义**归 selection.md。

- **覆盖**：`src/utils/notation/` 的 `processFile.ts`（文件读取、.mxl 解包、错误分类、入库）与 `musicXMLParser.ts`（musicxml-io → `ParsedScore` 映射）的全部逻辑；`ParsedScore`/`Note` 的标记域契约扩展（tech.md §3 的域内权威）；标记 → 播放/渲染的职责边界。
- **不覆盖**：OSMD 渲染与光标（tech.md §6.1）、播放数据构建与播放引擎（audio.md §2–§3）、选择交互（selection.md）、存储 schema 与键名（tech.md §7）。数据契约基础形状**以 tech.md §3 为唯一权威**，本文只定义其标记域扩展（§2）。

产品锚点：F1 导入乐谱（`.xml`/`.musicxml`/`.mxl`）。解析产物有两个独立消费方——① **OSMD 渲染输入**（原始 XML 文本，tech.md §6）；② **`ParsedScore` 元信息**（ScoreInfo 展示、IndexedDB 解析缓存、后续功能的标记数据源）。两个消费方互不依赖，这是本文多条决策的出发点。

### 术语对照

| 本文/音乐术语 | MusicXML 元素 | musicxml-io 形状 |
| --- | --- | --- |
| 连结线（延音线） | `<tie>` / `<tied>` | `NoteEntry.tie`（`TieInfo`） |
| 连线（圆滑线） | `<slur>` | `SlurNotation`；`getSlurSpans` |
| 停顿（休止符） | `<rest>` / `<forward>` / 多小节休止 | `NoteEntry.rest` / `ForwardEntry` / `MeasureStyle.multipleRest` |
| 连音（三连音等） | `<time-modification>` + `<tuplet>` | `NoteEntry.timeModification`；`getTupletGroups` |
| 装饰音记号 | `<ornaments>` | `OrnamentNotation` |
| 倚音/装饰音（音符） | `<grace>`（+`slash`）/ `<cue>` | `NoteEntry.grace` / `NoteEntry.cue` |

---

## 1. 导入管线（`processFile.ts`）

### 1.1 流程

```
<File>（accept: .xml / .musicxml / .mxl）
  │ File.arrayBuffer()
  ▼
processFile
  ├─ 类型判定：扩展名优先；.mxl（或魔数 PK\x03\x04）→ jszip 解包（§1.2）
  ├─ 文本解码：TextDecoder('utf-8')；非 UTF-8 声明 → E4（§6，决策 M9）
  ├─ parse(text)（musicxml-io）→ Score；异常 → E2/E3（§6）
  ├─ musicXMLParser: Score → ParsedScore（§2 映射规则）
  └─ 任何错误：报 i18n 提示、不写 IndexedDB、不留半成品（M10）
  ▼
{ rawContent: 主谱 XML 文本, parsedScore, fileName, fileSize }
  ├─▶ OSMD.load(rawContent)            // 渲染（tech.md §6.1），与解析器同一份文本
  └─▶ IndexedDB StoredFile             // tech.md §7；parsedScore 是可由 rawContent 重建的缓存
```

### 1.2 .mxl 解包（决策 M1）

`.mxl` 是 zip 容器，主谱路径记录在 `META-INF/container.xml` → 第一个 `<rootfile full-path>`（MusicXML 规范：首个 rootfile 即主谱）。解包规则（spike §13-V4 已验证全链路可通）：

1. `JSZip.loadAsync(bytes)`；
2. 读 `META-INF/container.xml`，取第一个 `rootfile@full-path`；
3. 容器缺失/异常时回落：取第一个 `META-INF` 之外的 `.xml`/`.musicxml` 条目；
4. 均失败 → E1（损坏压缩包；仓库根 `刻在我心底的名字.mxl` 即此类真实样本，勿用于正向测试）。

**不使用 `musicxml-io` 自带的 `parseCompressed`/`parseAuto`**：OSMD 需要 XML **文本**输入，`.mxl` 无论如何都要自解一次包；统一「解包 → 文本 → `parse(text)`」单管线后，`.xml` 与 `.mxl` 在解析层零分叉，`rawContent` 语义统一。`jszip` 保留为直接依赖（tech.md §1 不变）。

### 1.3 rawContent 语义（决策 M2）

`rawContent` 一律是**解包后的主谱 XML 原文**：OSMD 与 `parse` 同吃一份文本；禁止把 `serialize(score)` 重序列化产物喂给任何一方（roundtrip 虽号称高保真，但序列化选项/版本是多余变量）。IndexedDB 持久化 `rawContent`；`parsedScore` 丢失可随时由 `rawContent` 重导出——这使标记域可以走 capture-only 轻量策略（M8）。

### 1.4 编码边界（决策 M9）

v2 只承诺 UTF-8：`File.text()`/`TextDecoder` 按 UTF-8 解码。XML 声明 `encoding` 非 UTF-8 系（常见于 GB2312 老谱）时**报错不静默转码**（E4）——静默解码产生 mojibake 比明确报错更糟。中文老谱支持记为后续候选（§9）。

---

## 2. 数据契约：标记域扩展（tech.md §3 之域内权威）

tech.md §3 的 `ParsedScore`/`Note` 基础形状不变，本节定义标记域扩展（重写期无兼容负担，v1 旧字段 `durationValue` 废弃、`tiesToNext` 由 `tie` 取代，tech.md §3 已同步）。**`ParsedScore` 不参与播放数据与索引**（tech.md D1 / audio.md §2.4）：`PlaybackEntry.noteIndex` 与命中测试的同源基准是 OSMD 光标遍历，`measures[].notes` 顺序仅用于展示与缓存。

```typescript
interface ParsedScore {
  title: string;                  // metadata.workTitle，回落 movementTitle（spike §13-V2）
  composer?: string;              // metadata.creators 中 type=composer 的 value
  measures: Measure[];
  tempo: number;                  // 全曲首个 <sound tempo>；样例谱普遍缺失，兜底 60（spike §13-V5）
  timeSignature: string;          // "4/4"，首个 attributes.time（composite 受 io 0.2.11 限制退化为首数字，§4.9）
  keySignature?: string;          // 首个 key.fifths → 调名（如 "G major" / "E minor"；后续变更见 Measure.keySignature；UI 层再做 i18n 转写）
  divisions: number;              // 首小节有效 divisions；逐小节有效值见 Measure.divisions（M4）
}
interface Measure {
  index: number;
  notes: Note[];                  // entries 中 type==='note' 的出现顺序（含和弦音、倚音、全部 voice）
  timeSignature?: string;         // 该小节起生效；无变更则 undefined
  keySignature?: string;
  divisions?: number;             // 该小节声明的 divisions；undefined = 继承上一小节（M4）
  multipleRest?: number;          // 多小节休止小节数（measure-style/multiple-rest，§4.3）
}
interface Note {
  pitch: string;                  // "C4"；休止为 "rest"；unpitched 取 displayStep/Octave（§4.8）
  duration: string;               // 显示标签：noteType+dots 派生（"q."/"8"/"16"…）；反推不中 → "x"
  realValue: number;              // ⭐ 权威发声时值（全音符分数）= duration ÷ 有效divisions ÷ 4；附点与连音缩放已含
  isRest: boolean;
  dots: number;                   // ⚠️ 字段名是 dots（spike §13-V3）
  octave: number; accidentals?: string;
  voice: number; staff?: number; type?: string; isChord?: boolean;
  // —— 标记域扩展（映射细则 §3/§4）——
  tie?: 'start' | 'stop' | 'continue';                    // 连结线（§4.1）；仅同音高合并成立
  tuplet?: { actualNotes: number; normalNotes: number };  // 连音比率（time-modification 原样，§4.4）
  isGrace?: boolean; graceSlash?: boolean;                // 倚音：slash=true 短倚音（斜线），false 长倚音（§4.5）
  isCue?: boolean;                                        // cue 小音符：占时值，按普通音符播放（§4.5）
  markings?: string[];                                    // 其余标记扁平标签（capture-only，M8；§4.6/§4.7）
}
```

- `realValue` 是时值的**唯一权威**：`duration` 标签只服务展示。附点、连音、复附点都超出 `"w|h|q|8|16"` 的标签枚举，但 `realValue` 恒可表达（实测锚点：附点四分 = 0.375，spike §13-V7；三连八分 = 1/12）。它与 `PlaybackEntry.startRv/durationRv` 同域（乐谱时域 RealValue，audio.md §2）——播放数据构建直接消费本字段，无需再换算。
- `markings` 标签文法：`"<kind>"` 或 `"<kind>:<value>"`，带编号时后缀 `#n`。封闭枚举：`ornament:*`（io 0.2.11 实测**可产出 13 种**：trill-mark/mordent/inverted-mordent/turn/inverted-turn/delayed-turn/delayed-inverted-turn/vertical-turn/shake/wavy-line/schleifer/tremolo/haydn；类型声明的 other-ornament/inverted-vertical-turn 被解析丢弃，§7-I9）、`articulation:*`（accent/strong-accent/staccato/staccatissimo/tenuto/detached-legato/marcato/spiccato/scoop/plop/doit/falloff/breath-mark/caesura/stress/unstress/soft-accent）、`technical:*`（up-bow/down-bow/fingering/harmonic/…原样透传）、`dynamics:*`（p/pp/ppp/pppp/f/ff/fff/ffff/mp/mf/sf/sfp/sfpp/fp/rf/rfz/sfz/sfzp/sffz/fz/n/pf/other）、`fermata`、`arpeggiate`、`glissando:<start|stop>#n`、`slide:<start|stop>#n`、`slur:<start|stop|continue>#n`、`unpitched`、未知记号兜底 `notation:<name>`。

---

## 3. 标记支持总表

「不入 ParsedScore」= 解析层不承载、需要时由 `rawContent` 经 musicxml-io 重析（M8/M2）；「capture-only」= 存标签但 v2 播放零消费（velocity 固定 0.7，audio.md §3.2）。

| # | 标记 | MusicXML 源 | musicxml-io 形状 | ParsedScore 承载 | 播放（v2） | 渲染 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 连结线 tie | `note/tie` + `notations/tied` | `NoteEntry.tie: TieInfo` | `Note.tie` | 延音合并（audio.md §2.2-2，不在此层） | OSMD |
| 2 | 连线 slur | `notations/slur` | `SlurNotation{slurType,number}`；`getSlurSpans` | `markings` | 无语义；乐句=用户双击（selection.md） | OSMD |
| 3 | 休止 rest | `note/rest` | `NoteEntry.rest: RestInfo` | `isRest` + `pitch:"rest"` | 占索引不发音（audio.md §2.2-4） | OSMD |
| 4 | 整小节休止 | `rest measure="yes"` | `rest.measure=true` | 同上（时值=整小节） | 同上 | OSMD 整小节符号 |
| 5 | 多小节休止 | `measure-style/multiple-rest` | `MeasureStyle.multipleRest` | `Measure.multipleRest` | 逐小节休止 | OSMD 合并长符号 |
| 6 | 游标 forward/backup | `<forward>/<backup>` | `ForwardEntry/BackupEntry` | **不产出 Note** | 无（多声部排版游标） | — |
| 7 | 连音 tuplet | `time-modification` + `notations/tuplet` | `timeModification`；`TupletNotation`；`getTupletGroups` | `Note.tuplet` | 无需换算（duration 已缩放，M5） | OSMD 括号/数字 |
| 8 | 倚音 grace | `note/grace`(+`slash`) | `grace{slash,stealTime*}`，`duration=0` | `isGrace`+`graceSlash` | 时间轴跳过（audio.md §2.2-2） | OSMD 小音符/斜线 |
| 9 | cue 音 | `note/cue` | `NoteEntry.cue` | `isCue` | 占时值，按普通音符 | OSMD 小音符 |
| 10 | 装饰音记号 | `notations/ornaments` | `OrnamentNotation`（io 0.2.11 可产出 13 种，§7-I9） | `markings` capture-only | 音型合成在播放域（audio.md §2.2-9，A17） | OSMD 记号 |
| 11 | 演奏记号 | `notations/articulations` | `ArticulationNotation`（17 种） | `markings` capture-only | 不实现 | OSMD |
| 12 | 技法 | `notations/technical` | `TechnicalNotation` | `markings` capture-only | 不实现 | OSMD |
| 13 | 力度记号/渐变 | `direction/dynamics` + `wedge` | `DirectionType(kind dynamics/wedge)`；`getDynamics/getWedges` | dynamics 瞬时值 `markings`；wedge 不入 | 不实现（后续候选力度链数据源） | OSMD |
| 14 | 延音记号 fermata | `notations/fermata` | `FermataNotation` | `markings` capture-only | 不改时长（audio.md §8 候选） | OSMD |
| 15 | 琶音/滑音 | `notations/arpeggiate/glissando/slide` | 对应 Notation | `markings` capture-only | 不实现 | OSMD |
| 16 | 和弦 | `note/chord` | `NoteEntry.chord` | `isChord` | 同刻同触发（播放域保证） | OSMD |
| 17 | 符杆/符头/歌词 | `beam/notehead/lyric` | `BeamInfo/NoteheadInfo/Lyric` | **不入 ParsedScore** | 无 | OSMD 全权 |
| 18 | 反复/跳房子/Segno/Coda | `barline/repeat`、`ending`、`sound dacapo/segno/tocoda` | `Barline.repeat/.ending`；`SoundEntry`；`getRepeatStructure/getEndings` | **不入 ParsedScore** | **不展开**，随光标线性走（M7） | OSMD 渲染记号 |
| 19 | 移调 | `attributes/transpose` | `MeasureAttributes.transpose` | 不入（v2） | 按记谱音高播（与光标一致，无 concert pitch 折算） | OSMD 记谱 |
| 20 | 无音高 unpitched | `note/unpitched` | `unpitched{displayStep,displayOctave}` | `pitch`=display + `markings+"unpitched"` | 占索引、播放跳过（开放点，样例无打击乐） | OSMD |
| 21 | 多声部 | `note/voice`、`attributes/staves` | `voice/staff` | `voice/staff` 保留 | 多声部取 max RealValue（audio.md §2.2-3） | OSMD |
| 22 | 拍号/调号/速度 | `attributes/time/key`、`sound tempo` | `MeasureAttributes`；`DirectionSound.tempo` | `Measure/ParsedScore` 顶层 | BPM 一律用户设定（audio.md A2） | OSMD |

---

## 4. 标记域详解

### 4.1 连结线（tie / tied）

- MusicXML 在两处声明：`note/tie`（**声音层**：start/stop/continue）与 `notations/tied`（视觉层，另有 let-ring 等扩展）。musicxml-io 合并为 `NoteEntry.tie`。解析规则：**以 `note/tie` 为准**，`tied` 独有的视图信息（orientation 等）不入契约。
- `continue` = 既止又起（跨小节拆分的延音中段），原样透传为 `'continue'`。
- **解析层不做合并**（M6）：`ParsedScore` 保持逐音符事实；合并只发生在 `buildPlaybackData`（延续音跳过、起始音取 `NoteTie.Duration.RealValue`，audio.md §2.2-2）。选中延音延续音时端点解析归 selection.md（解析为 StartNote 的 noteIndex）。
- 合并前提是**同音高**；不同音高间的弧线是 slur（制谱软件常见错谱源，测试矩阵含负例，§8）。

### 4.2 连线（slur）

- `slurType` start/stop/continue + `number`（编号区分嵌套/重叠弧线；实测刻谱 2 组 `number=1`）。**配对关系（SlurSpan）不入 `ParsedScore`**：逐音符标签 `markings:"slur:start#1"` 足够展示，需要结构时经 `getSlurSpans(score)` 由 `rawContent` 重析（M8）。
- 配对只认 `number`（同声部内），不做位置推断；跨小节跨声部弧线天然由编号覆盖。
- **乐句循环 = 用户双击**（selection.md §4），v2 不按 slur 自动圈乐句；slur 数据仅为后续候选「按连线建议乐句」留存。

### 4.3 停顿（休止系）

- `NoteEntry.rest` 存在即休止；`rest.measure=true` 为整小节休止（时值 = 该小节拍号全长）。
- **多小节休止**（刻谱实测 3 处 `measureStyle:{multipleRest:n}`）：OSMD 渲染合并长符号，但光标逐小节走——解析层**逐小节产出休止符**（时值各自 = 整小节），`Measure.multipleRest` 仅作标注，时间轴无需感知。
- `<forward>/<backup>` 是多声部排版游标，musicxml-io 已解析为独立 entry 类型：**跳过，不产出 Note**；voice > 1 的音符照常入 `notes`（`voice` 字段区分）。
- 休止符占 `noteIndex` 不发音（audio.md §2.2-4）；fermata 可挂在休止符上（notations 直挂，§4.7）。

### 4.4 连音（tuplet）

- 实测形状（刻谱 4 组三连音）：`timeModification:{actualNotes:3, normalNotes:2}`、`noteType:"eighth"`、`duration=4`（divisions=12）、`tuplet` notation `bracket=false`（用数字不用括号）。
- **时值语义（M5 的核心）**：MusicXML `<duration>` 是缩放后的**实际发声时长**（三连八分 = 四分的 1/3），`realValue = duration ÷ 有效divisions ÷ 4` 已含缩放；OSMD 光标 RealValue 同源。**buildPlaybackData 不需要任何连音逻辑**——连音对播放的全部可见影响就是时长序列本身。
- 显示标签取 `noteType`（"8"）：标签与 `realValue` 换算出的名义时值不同是连音的本质，二者并存不矛盾；`type` 与 `duration` 冲突时以 `duration` 为时值权威、`noteType` 仅供显示。
- 嵌套连音（3:2 内套 5:4）：MusicXML 以累计 duration 表达，`realValue` 直算，无特殊处理；`Note.tuplet` 只记录最内层比率。
- `getTupletGroups(score)` 用于测试断言（刻谱组数 = 4，§8）。

### 4.5 倚音（grace）与 cue 音

- 实测形状（刻谱 4 处，v1.2 补和弦/变化音形态）：`grace:{slash:true}`、**`duration=0`**、`noteType:"eighth"`（名义时值保留）、有 pitch；`alter` 照常映射 `accidentals`。`slash=true` = 短倚音（acciaccatura，带斜线）；无 slash = 长倚音（appoggiatura）；`stealTimePrevious/Following` 百分比可选项 io 解析丢弃、契约无承载（占用策略由播放域决定，audio.md §2.2-8 挤压式安放）。倚音和弦（`grace`+`chord`）：每个和弦音均 `grace`（+`chord:true`）、`duration=0`。
- 索引规则（selection.md §2 实测对齐）：倚音**占 graphicIndex**（DOM 序、命中测试）但**不占 noteIndex**（发声但不占位，与主音共享 noteIndex，audio.md §2.2-8）。这是双索引偏移的主要来源之一，`isGrace` 是回归测试锚点。官方偷时值规则（前装饰音按比例切前一同音高音符尾）仍为 audio.md §8 后续候选，v2 统一挤压式。
- cue 音（`cue:true`，总谱提示用小音符）：**占时值、按普通音符播放**（M-decision），仅标记 `isCue` 供展示；与 grace 互斥（MusicXML 语义）。

### 4.6 装饰音记号 / 演奏记号 / 技法 / 琶音 / 滑音（capture-only）

- 音符级 `notations`（ornament/articulation/technical/arpeggiate/glissando/slide）直挂到所在音符：`markings` 追加对应标签（文法见 §2），全量透传、不解释。
- 导入域 capture-only 不解释；播放消费自 audio.md v2.7 起（§2.2-9，决策 A17）：trill/turn/mordent 族按 OSMD 切片语义展开发音，tremolo/wavy-line 等无展开语义的记号仍原样播放。本表其余记号（articulation/technical/琶音/滑音）v2 播放零消费：velocity 固定 0.7（audio.md §3.1），OSMD 渲染不受影响（它直接读 `rawContent`）。
- 设计动机（M8）：capture 成本 ≈ 0（musicxml-io 已解析完），留作后续候选的数据源——力度链（audio.md §8）与表情功能落地时**无需重解析已入库的乐谱**。

### 4.7 力度与表情（direction 层，capture-only）

- `DirectionEntry`（kind=`dynamics`/`wedge` 等）是**独立 entry**，不在音符上：映射规则为「挂到其后第一条 note（同 measure；无后续音符则丢弃）」。瞬时力度（p/mf/f…）进 `markings`；**wedge 渐变起止不入契约**（结构性配对，M8）。
- fermata 是音符级 notations，直挂（含挂在休止符上的常见情形）；v2 不改变时长（官方 `FermataSlowdownFactor` 表情放慢路径见 audio.md §8 候选）。
- 音符级 `<note dynamics>`（velocity 覆写）不入契约：v2 无消费方，需要时由 `rawContent` 重析。

### 4.8 和弦 / 符杆 / 符头 / 歌词 / unpitched / 反复

- 和弦：`chord=true` → `isChord`；同刻同触发由播放域保证（一个时刻多音）。
- 符杆（beam）、符头（notehead）、歌词（lyrics）：纯排版/显示域，**不入 `ParsedScore`**，OSMD 全权（M8）。
- unpitched（打击乐）：`pitch` 取 `displayStep/displayOctave` 拼接（如 "C5"）并追加 `markings:"unpitched"`；占索引、播放跳过——处理策略记为开放点（目标曲库无打击乐谱，风险低）。
- 反复/跳房子/D.C./Segno（M7）：**播放不展开**，时间轴随 OSMD 光标线性走（D1 单源前提是光标语义，展开反复需要自写遍历、破坏同源对齐）。OSMD 照常渲染反复记号；展开播放为后续候选，且需先与 audio.md 复核光标模型。

### 4.9 拍号 / 调号 / 速度 / divisions / 多声部

- **divisions 逐小节有效值（M4）**：`attributes.divisions` 出现即覆写，缺省继承前值（实测刻谱为 `[12, undefined]`）。一切时值换算用「该音符所在小节的有效 divisions」；**禁止假设全曲常量**。
- tempo：取全曲首个 `<sound tempo>`（`SoundEntry.tempo` 或 `DirectionSound.tempo`）作 `ParsedScore.tempo` 展示值，缺失兜底 60（spike §13-V5 是必须路径）；谱面 tempo 与中途变速**不参与播放**——播放数据是乐谱时域（与 BPM 解耦，audio.md A12），BPM 由用户设定、引擎时钟边界生效（audio.md A2）。
- timeSignature：`"beats/beatType"`；**composite 拍受 io 0.2.11 限制退化**——实测 `<beats>3+2</beats>` 解析为 `beats:"3"`（beatsList 亦缺），v2 按 io 实际输出记录（`3/8`），composite 还原需绕过 io 读原文、记为后续候选；节拍器分母取 beatType（audio.md §3.7）。
- keySignature：fifths（−7…7）→ 调名；mode=minor 用关系小调。数据层存英文调名（"G major"/"E minor"），展示层 i18n。
- 多声部：`voice` 全保留（audio.md §2.2-3 多声部取 max）；`staff` 透传；**只取 `parts[0]`**（M3，tech.md §3 既定的单一练习主奏）。

---

## 5. 顺序与索引（易错点集中区）

1. `ParsedScore.measures[].notes` 的顺序 = `Measure.entries` 中 `type==='note'` 的出现顺序（含和弦音、倚音、全部 voice）——**这不是播放索引的来源**。`PlaybackEntry.noteIndex`（全曲连续、休止占位、跳过倚音与延音延续音）由 OSMD 光标遍历派生（audio.md §2.2 / selection.md §2），任何改动必须双侧同改。
2. 一个 entry 一个 `_id`：重渲染与缓存重建时以 `rawContent` 重解析为准，禁止跨会话复用旧 `ParsedScore` 对象。
3. 样例谱实测顺序锚点：刻谱光标 462 步 = 387 发音 + 43 休止 + 32 延音延续 + 4 倚音（spike §13-V6）——四类计数是索引对齐回归的第一断言。

---

## 6. 错误处理（E1–E4，决策 M10）

实测报错原文（musicxml-io 0.2.11，§7-I7）与分类：

| # | 情形 | 实测行为 | i18n 键（四语言，tech.md §8） |
| --- | --- | --- | --- |
| E1 | .mxl 损坏/无主谱 | jszip Corrupted 或解包链路失败（仓库损坏样例实测） | `errorCorruptArchive` |
| E2 | 非 MusicXML / timewise / 根元素不符 | `Error: Unsupported MusicXML format: only score-partwise is supported` | `errorNotMusicXML` |
| E3 | XML 语法错误等解析异常 | **DOMParser 良构性前置闸**：io 0.2.11 为恢复式解析，截断/错配等语法错误实测全被吞、静默产出残缺 Score（2026-10-18 实测），故良构性在 io 之前以 `parsererror` 把关，不中 → E3 | `errorParseFailed` |
| E4 | XML 声明非 UTF-8 编码 | 解码前检查 `encoding=` 声明（M9） | `errorUnsupportedEncoding` |

规则：错误经 StatusBar/FileLoaderModal 提示；**不写 IndexedDB、不渲染半成品**；E2/E3/E4 的原始报错进 console 供排查。文件选择器与文案开放 `.mxl`（tech.md §11-L4，解析层本文已支持）。

---

## 7. 实测记录（2026-10-18，musicxml-io 0.2.11，Node 24）

补充 spike §13（V1–V5 为解析链路结论，不重复）逐标记实测：

| # | 实测 | 对应规则 |
| --- | --- | --- |
| I1 | 倚音：`grace:{slash:true}`、`duration:0`、`noteType:"eighth"`、pitch 正常；倚音和弦（`grace`+`chord`）每音均 `grace:{}`；`steal-time_*` 属性解析丢弃 | §4.5 |
| I2 | 三连音：`duration:4`@`divisions:12`、`timeModification:{3,2}`、tuplet notation `bracket:false` | §4.4 |
| I3 | tie 组：刻谱 32 组（各 2 音）、连音符谱 2 组（1+2）；`getTiedNoteGroups().totalDuration` = 各音 duration 之和 | §4.1 |
| I4 | slur：刻谱 2 组、`number:1`、各含 2 音 | §4.2 |
| I5 | 多小节休止：`attributes.measureStyle:[{multipleRest:1}]`（刻谱 3 处） | §4.3 |
| I6 | 刻谱 divisions 序列 `[12, undefined]`（attributes 未变更的小节为 undefined）；voice `[1]`、staves 1、1 part、73 measures | §4.9 |
| I7 | 错误形态：损坏 .mxl → `isCompressed` 仍为 true，解包报 `Could not find MusicXML file in compressed archive`；纯文本/错误根元素 → `Unsupported MusicXML format: only score-partwise is supported` | §6 |
| I8 | API 形状：`getTupletGroups/getSlurSpans/getTiedNoteGroups` 等 query 函数收 **`Score`**（非 `Part`，传 Part 抛 `Cannot read properties of undefined`）；导出子路径 `musicxml-io/query`；`parseAuto/parseCompressed` 存在但 v2 不用（M1） | §1.2/§4.4 |
| I9 | 装饰音全家族实测（v1.1 夹具谱 marks-*，v1.2 逐枚举补测）：mordent/inverted-mordent（含 long="yes" 长波音）/turn/inverted-turn/delayed-turn/trill-mark/wavy-line 各产出**独立** OrnamentNotation；`long`/`accelerate`/`beath` 等修饰属性不透出，标签只留记号名；wavy-line 的 start/stop 方向不在标签文法（capture-only）。io 0.2.11 类型声明 15 种 OrnamentType，实测**可产出 13 种**——`<other-ornament>`（含带文本）与 `<inverted-vertical-turn>` 被解析整体丢弃（notations 不产出），升级 io 时需重测 | §4.6 |
| I10 | slur `continue` 类型与嵌套编号（number=1/2 重叠弧线）原样透传，记号按 XML 出现顺序保留；tie 的「既止又起」以 note/tie 双元素（stop+start）表达，io 不产出 continue 类型 | §4.1/§4.2 |

---

## 8. 测试策略（导入域）

| 层 | 对象 | 要点 |
| --- | --- | --- |
| 纯函数 | `musicXMLParser`（fixture XML 片段） | 逐标记最小片段：tie continue、嵌套 tuplet、无 slash 倚音、多小节休止、direction dynamics 挂载、composite 拍号；divisions 变更小节的 realValue 换算 |
| 纯函数 | 错误分类 | timewise/非 XML → E2；损坏 zip → E1；GB2312 声明 → E4 |
| 集成 | 三样例谱断言基准 | 刻谱：title=workTitle、73 小节、tie 组 32、tuplet 组 4（3:2）、倚音 4（duration 0）、slur 2、multipleRest 3、divisions 12；连音符谱：tie 组 2、tuplet 组 0；twinkle：无任何标记 |
| 集成 | 夹具谱全量导入（v1.1，`musicxml/marks-*`、`rhythm-*`、`keys-*` + 连音符） | 每份走完整 `processFile` 管线（`tests/utils/notation/fixtures.test.ts`）：tie start/continue/stop 与跨小节链、slur 嵌套编号/continue、长短倚音、装饰音标签、附点/复附点/连音 realValue、拍号/调号逐段变更与 fifths ±7 边界 |
| 回归 | 索引对齐 | §5-3 四类计数（387/43/32/4）+ selection.md §8 的 V-S 系列偏移归零 |
| 手动 | 浏览器 | 三样例谱导入（含 .mxl 正向样本）、损坏 .mxl 报 E1、过 F1–F2 |

---

## 9. 决策记录

| # | 决策 | 理由 |
| --- | --- | --- |
| M1 | .mxl 统一 jszip 解包 → 文本 → `parse(text)` 单管线；不用 musicxml-io `parseCompressed/parseAuto` | OSMD 需要文本输入，.mxl 必须自解包；单管线消除「jszip + musicxml-io」双解包栈与 rawContent 二义（V4 链路已验证，§7-I8） |
| M2 | rawContent = 解包后主谱原文；OSMD 与解析器同吃一份文本；禁止喂 `serialize()` 重序列化产物 | 减少序列化选项/版本变量；parsedScore 是可重建缓存，rawContent 才是持久事实 |
| M3 | 只取 `parts[0]`；voice 全保留 | tech.md §3 既定单一练习主奏；多 part 为后续候选 |
| M4 | divisions 逐小节有效值（覆写/继承），换算禁用全曲常量 | MusicXML 语义即如此（实测 `[12, undefined]`）；常量假设在变 divisions 谱上静默算错时值 |
| M5 | 时值双轨：`realValue`（权威，含附点/连音缩放）+ `duration` 显示标签（noteType 派生，反推不中为 "x"）；type 与 duration 冲突以 duration 为准 | 连音/复附点超出 `"w|h|q|8|16"` 枚举；时值必须单一权威（V7 端到端锚点） |
| M6 | tie 只如实标记不合并；合并仅发生在 buildPlaybackData（audio.md §2.2-2） | 播放数据单一事实来源（tech.md D1）；ParsedScore 保持逐音符事实，展示与索引各有消费方 |
| M7 | 反复/跳房子/D.C./Segno 不展开，播放随光标线性走 | 光标线性是 D1 的前提；展开需自写遍历破坏同源对齐，明确 out of scope |
| M8 | 标记域 capture-only：逐音符扁平标签；结构性配对（slur/tuplet 组、wedge 起止）不入契约，需要时经 `musicxml-io/query` 由 rawContent 重析 | 标签零成本可序列化；rawContent 已持久化，重析是廉价路径；v2 播放零消费但后续候选（力度链/表情/建议乐句）落地时免重解析 |
| M9 | v2 只承诺 UTF-8；XML 声明非 UTF-8 报错不静默转码 | TextDecoder 单编码解码；静默 mojibake 比明确报错更糟；GB2312 老谱为已知边界 |
| M10 | 错误四分类（E1–E4）各自独立 i18n 键；任何错误不入库、不留半成品 | 用户可行动的提示（V4 损坏样例是真实场景）；tech.md §8 四语言硬约束 |

**后续候选（不在 v2 范围）**：按 slur 建议乐句（数据源 §4.2）；力度链 velocity（audio.md §8，数据源 = `markings` dynamics）；fermata 表情放慢（audio.md §8）；多 part/打击乐与 concert pitch；GB2312 等非 UTF-8 编码支持；反复展开播放（需先复核光标模型）。

---

*本文为 tech.md 导入/解析域拆分件；工程约定见根目录 [AGENTS.md](../AGENTS.md)，冲突时以 AGENTS.md 为准。*
