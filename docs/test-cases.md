# TuneTutor 测试用例文档

**版本**：1.3
**日期**：2026-11-02
**状态**：随实现维护的用例清单（本版快照：单元/集成 529 例 · 51 文件全绿；e2e 9 例 · 6 规格全绿；手动用例 9 例）
**变更**：初版。tech.md §10 只定测试策略分层（纯函数/存储/i18n/手动），本文补全**用例级清单**：PRD 功能（F1–F14 + 二期皮肤）→ 自动化用例映射（单元/集成/e2e）、里程碑手动过单（TC-MAN）、样例谱与夹具清单、已知盲区。用例按域分组，编号 `TC-<域>-<序号>`，每例给出验证点与自动化落点（测试文件）。**v1.3（2026-11-02）**：新增 TC-SEL-15（双指视口手势，selection.md v1.10 / PRD G12 触控专项回写）；快照计数随新增用例更新。**v1.2（2026-10-28）**：装饰音/倚音单测补全覆盖——TC-IMP-07/09 补倚音和弦与装饰音全家族（io 0.2.11 可产出 13 种、other-ornament/inverted-vertical-turn 声明但被丢弃）、TC-PBD-02 补倚音宿主悬起/倚音+装饰音同主音/邻音 B↔C 八度进位与邻音调号变化音、TC-PBD-03 补 marks-turn 真实 OSMD 回归。**v1.1（2026-10-28）**：新增 TC-E2E-06（真实谱选择+光标带，selection.md v1.9 回归）；§5.1 TC-SEL-03 补分类标定；§12.2 盲区随防线 1 成员判定补全与防线 2 分类标定落地改写。

---

## 0. 定位与范围

本文是**测试用例清单**（coverage catalog），不是行为规格：用例所验证的行为契约以各基线为准（[tech.md](./tech.md)、[audio.md](./audio.md)、[selection.md](./selection.md)、[musicxml.md](./musicxml.md)、[prd.md](./prd.md)、[ui-design.html](./ui-design.html)、`features/`），实现、规格、用例三者冲突时先修规格再修用例（README.md 冲突裁决第 4 条）。

三个用途：

1. **改动的回归范围**：动某域代码后，按 §3–§9 对应小节跑单，按 §10 做手动过单；
2. **里程碑验收**：tech.md §11 P2–P5 的「手动过单」直接引用 §10；
3. **覆盖缺口追踪**：§12 记录已知盲区，补测试时从这里认领。

## 1. 测试分层与门禁

| 层 | 对象 | 环境 | 命令 | 规模（2026-10-28） |
| --- | --- | --- | --- | --- |
| 类型门禁 | 全仓（含 `tests/e2e/`，经 `tsconfig.e2e.json` 引用） | tsc | `pnpm build` | — |
| Lint | 全仓 | eslint | `pnpm lint` | — |
| 单元/集成 | 纯函数、组件、hooks、页面、存储、i18n | vitest + jsdom + `fake-indexeddb` | `pnpm test:run` | 502 例 / 49 文件（部分用例由夹具循环动态生成） |
| e2e | 真浏览器关键路径 | tester-army + Playwright chromium | `pnpm test:e2e` | 9 例 / 6 规格 |
| 手动 | 出声、真机触控、PWA、性能 | 浏览器 / iPad | §10 | 9 例 |

约定（AGENTS.md 为准，此处摘要）：

- **单测是硬要求**：新模块与修改 alike 都要有单测，`build`/`lint` 绿不算完成；用例统一放 `tests/`（镜像 `src/` 结构），由 `vitest.config.ts` include 收拢。
- **可测性前置**：核心逻辑用注入依赖（`TimingSource` 时钟、fake 采样器、mock OSMD cursor）保持无浏览器/无真声可测。
- **jsdom 已知坑**：无 PointerEvent（`tests/setup.ts` polyfill）、无布局（rect 用 `stubStageRect` 打桩）、无 pointer capture（事件派发到路由 target）；`Storage` 用 `stubGlobal` 拦截。
- **触控等价路径**：iOS/iPadOS 无原生 `dblclick`（WebKit bug 202143），触控双击一律走 `useDoubleTap`（400ms 窗 / 24px slop / `isPrimary`）；指针管线只允许 Pointer Events。单测对双击同时覆盖原生 `dblclick` 与 pointer 双击两条路径。
- **e2e 运行注意**：首次 `npx playwright install chromium`；runner 自托管 Vite（端口 0 自选，不与 5173/5174 竞争），打开 `/TuneTutor/#/…` 绝对路径；`openApp` 预置 `localStorage['note-slice-language']` 为 en-US；无模型 API key 依赖。

## 2. 功能 → 用例映射总表

| 功能（PRD §7.2.1） | 用例小节 | 自动化落点 | 手动补充 |
| --- | --- | --- | --- |
| F1 乐谱加载 | §3.1 | TC-IMP-01…04（processFile 错误分类） | TC-MAN-02/09 |
| F2 文件历史与启动恢复 | §3.3 / §8.1 | TC-STO-01…02、TC-APP-02、TC-AUP-01/06 | TC-MAN-02 |
| F3 五线谱渲染与光标 | §4 | TC-RND-01…05 | TC-MAN-02/08 |
| F4 选择交互 | §5 | TC-SEL-01…14 | TC-MAN-02/03 |
| F5 播放走带 | §6.1–6.2 | TC-ENG、TC-HPB、TC-E2E-05/06 | TC-MAN-01/02 |
| F6 速度调节 | §6.3 | TC-TMP、TC-CLK、TC-ENG-04、TC-HPB-02 | TC-MAN-02 |
| F7 循环跳过（空拍） | §6.2 | TC-ENG-02、TC-HPB-01/03 | TC-MAN-02 |
| F8 节拍器 | §6.4 | TC-ENG-05、TC-INS-03 | TC-MAN-01/04 |
| F9 乐器音色 | §6.5 | TC-INS-01…04、TC-HPB-02 | TC-MAN-01 |
| F10 原曲切片循环 | §7 | TC-SLC、TC-AUD-01、TC-AUP-01…06 | TC-MAN-03/04/06 |
| F11 多语言 | §8.2–8.3 | TC-I18N-01…03 | TC-MAN-07 |
| F12 PWA 与部署 | §12（盲区） | 无自动化 | TC-MAN-05 |
| F13 键盘快捷键 | §8.4 | TC-KBD-01 | TC-MAN-02 |
| F14 拖拽多行框选（二期，已提前落地） | §5.3–5.4 | TC-SEL-09…12、TC-SEL-14、TC-E2E-03 | TC-MAN-03 |
| 皮肤切换（`features/skin-switching.html`，PRD 外补录） | §8.5 | TC-THM-01…04、TC-RND-02、TC-E2E-04 | TC-MAN-07 |
| 原曲页音频库与多选导入（audio.md A16） | §7.6 | TC-AUP-06 | — |

G1–G17 规划功能不入用例范围（PRD §7.2.2）；落地时按域增补对应小节。

## 3. 导入解析域用例（F1 / F2 数据面）

依据 [musicxml.md](./musicxml.md)（决策 M1–M10）。全部无浏览器依赖（jsdom / node）。

### 3.1 导入管线（`tests/utils/notation/processFile.test.ts`）

| 编号 | 用例 | 关键验证点 / 预期 |
| --- | --- | --- |
| TC-IMP-01 | 明文 `.musicxml` / `.xml` 导入 | `rawContent` = 原文；`parsedScore` 元信息在位；两种扩展等价 |
| TC-IMP-02 | 合法 `.mxl` 解包（M1） | `container.xml` → 首个 rootfile → 主谱；无 container.xml 回落 META-INF 外首个 `.xml` 条目 |
| TC-IMP-03 | 魔数判定与宽容路径（§1.1） | 扩展名非 `.mxl` 但带 zip 魔数仍按压缩包解包；未知扩展（`.txt`）但内容合法 XML 走文本管线照常解析（浏览器 MIME 不可信） |
| TC-IMP-04 | 错误分类 E1–E4（musicxml.md §6） | E1 损坏 zip / zip 内无 MusicXML 条目；E2 非 XML 文本 / timewise 根元素；E3 XML 语法错误；E4 非 UTF-8 声明（GB2312 报错不静默转码，M9），且 E4 同样作用于 `.mxl` 解包后的主谱文本 |

### 3.2 解析映射（`tests/utils/notation/musicXMLParser.test.ts`）

| 编号 | 用例 | 关键验证点 / 预期 |
| --- | --- | --- |
| TC-IMP-05 | 元信息 | title 取 `workTitle`、无则回落 `movementTitle`；composer 取 `creators[type=composer]`；tempo 取首个 `<sound tempo>`、缺失兜底 60（V5）；composite 拍号受 io 0.2.11 限制退化 `"3+2"→"3"`；fifths → 调名（大调/关系小调） |
| TC-IMP-06 | 部件与顶层契约（M3、顶层取首声明） | 只解析 `parts[0]`；顶层拍号/调号/divisions 取首个声明，后续变更只进对应小节；小节 index 从 0 连续 |
| TC-IMP-07 | 时值权威 realValue（M4/M5） | 四分 0.25、附点 0.375（V7 锚点）；realValue 随逐小节有效 divisions 换算；连音 duration 已含缩放、realValue 直算（1/12、1/6、1/24）；休止/和弦/cue/unpitched/倚音（duration=0，slash 分短长，含倚音和弦每音 isGrace+isChord、变化音 accidentals 照常、steal-time 属性丢弃）各形态在位；noteType 反推不中 → `"x"` |
| TC-IMP-08 | 连结线 tie（M6） | 只如实标记不合并：start/stop；同现 stop+start 推导 continue（io 不产出 continue）；tied notations 不进 markings |
| TC-IMP-09 | 标记域 capture-only（M8） | 演奏记号/装饰音/技法/延音记号/琶音 → 扁平标签；装饰音全家族 `ornament:<name>` 逐枚举透传（io 0.2.11 可产出 13 种；other-ornament/inverted-vertical-turn 声明但被解析丢弃；`long`/`accelerate`/`beath` 修饰属性不透出）；slur → `slur:<type>#<number>`（嵌套按 number 区分）；direction 瞬时力度挂其后第一条 note、乐句末尾 direction 丢弃；多小节休止 → `Measure.multipleRest`；forward/backup 游标跳过不产出 Note |
| TC-IMP-10 | 全量夹具回归（`fixtures.test.ts`） | `musicxml/` 全部 14 个合成夹具导入不抛错 + 清单在位（防误删）：marks-tie/slur/grace/mordent/turn/trill、rhythm-mixed/tuplets/syncopation/meters、keys-sharps/flats/minor/extremes 逐族断言解析契约 |
| TC-IMP-11 | 真实谱回归 | 「乌兰巴托的夜」63 小节 beam 导入 + 12 组 tie 配对完整（无悬空 stop）+ OSMD 光标侧 tie 链合并为单条目（`wulanbatuo-import.test.ts`）；「世界赠予我的」58 小节 beam 导入、note 数对账（`shijie-beams.test.ts`） |

### 3.3 存储层（F2，`tests/utils/storage/indexedDB.test.ts`）

| 编号 | 用例 | 关键验证点 / 预期 |
| --- | --- | --- |
| TC-STO-01 | files store（乐谱历史） | 保存/读回 rawContent + parsedScore 完整往返；列表按 uploadedAt 降序且只投影元信息；`getLatestStoredFile` 最新一条、空库 undefined；单条删除 |
| TC-STO-02 | audioFiles store | ArrayBuffer 结构化克隆往返字节一致（D3）；最新一条与删除；两 store 同库 v2 升级、互不干扰 |

## 4. 渲染域用例（F3）

依据 tech.md §6.1 与 skin-switching §④-04 取色契约。

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-RND-01 | OSMD 构造参数 | `PageBottomMargin` 归零（endless 模式留白对称）；关闭 multirest 自动折叠（折叠吞小节 → noteIndex 与播放数据错位，v1.8 教训） | `tests/utils/notation/OsmdRender.test.ts` |
| TC-RND-02 | 皮肤取色映射 | 谱线/加线读 `--color-staff`（非 line-strong）；音符/标题/辅助文字 → ink/fg/ink-2；符头填充写 `DefaultColorNotehead`（OSMD 1.9.7 回落字段）；token 缺失保持 OSMD 默认不覆写 | 同上 |
| TC-RND-03 | 页脚缩放阶梯 | `nextZoomStep` 乘性步进、保留两位小数、钳制 [ZOOM_MIN, ZOOM_MAX] | 同上 |
| TC-RND-04 | 组件装载与缩放（`OsmdNotation`） | 无谱占位文案；rawContent 以原文加载 + 注入音符 DOM；缩放按钮步进并重渲染 | `tests/components/OsmdNotation.test.tsx` |
| TC-RND-05 | 播放光标带（audio.md §3.8） | 装载后上报播放数据（乐谱时域条目 + 谱键）且光标遍历后复位；未播放无光标带，PLAYING + 首 iteration 起显示；同帧多次 iteration 合并取最新指针、回跳自动跟随；播放中缩放重渲染光标带不丢不跳；STOPPED 立即移除 | 同上 |

## 5. 选择域用例（F4 / F14）

依据 [selection.md](./selection.md)（决策 S1–S10）与 `features/text-selection.md`（框选）。

### 5.1 双索引与命中（`tests/utils/notation/NoteInteraction.test.ts`）

| 编号 | 用例 | 关键验证点 / 预期 |
| --- | --- | --- |
| TC-SEL-01 | 占位规则镜像 | `occupiesPlaybackSlot`：装饰音与连结线延续音不占位；休止符与发音音符占位（与 audio.md §2.2 计数规则一致） |
| TC-SEL-02 | 双索引计数 | `noteIndex` 只对占位音符递增；装饰音指向下一占位音、延续音指向起始音；`PrintObject=false` 不产图形序但占播放位；解析休止一律渲染 notehead、计入图形序（OSMD 1.9.7 实测，v1.8 结论）；行号按 ParentStaffLine 身份分配 |
| TC-SEL-03 | DOM 配对三层防线（§3.3） | 防线 1 数量不等整条放弃；成员判定排除 `TypeLength=0` 休止（`<rest measure="yes"/>` 无 `<type>` 不产 notehead，v1.9）；防线 2 按休止/音符分类标定、类内偏离 >5px 配对剔除（类间 bbox 差不再整类误杀）；rect 缓存为容器相对像素、命中链 closest → 元素映射；`hitFromClientPoint` 按坐标命中（capture 重定向场景）；计数守卫失败 → degraded 不抛错；全小节休止（带 `<type>`）照常配对（「世界赠予我的」实测矩阵）；缺 GraphicSheet 降级不抛错 |
| TC-SEL-04 | 坐标换算（S4） | px = unit × 10 × zoom 及其逆 |
| TC-SEL-05 | 命中视图三分类 | 发音占位 / 装饰音 / 延续音 → 端点解析入参 |

### 5.2 选择模型（`tests/utils/notation/selection.test.ts`）

| 编号 | 用例 | 关键验证点 / 预期 |
| --- | --- | --- |
| TC-SEL-06 | 端点解析四类规则（§2.3） | 发音 = [startRv, startRv+durationRv)；休止起点 = 前条目末刻、休止终点 = 后条目起刻（曲端取 0/曲终）；装饰音解析到下一发音、其后无发音 → 无效；延续音解析到起始音、缺起始 → 无效；空数据 → null；`dataEndRv` = 末条目末刻；同 noteIndex 组跨度（A17：倚音/装饰音切片与主音共组） |
| TC-SEL-07 | 三种选择创建 | 乐句乱序自动换位且端点类别随换位搬运；小节 = 该小节占位音符包络、无占位（洞小节）→ null；框选区间归一化 + 小节范围取区间内占位音符 |
| TC-SEL-08 | 循环区间推导（§2.4） | 乐句双端点解析 + skipBeats 透传；端点含休止按 06 规则；解析失败 → null；小节按 measureIndex 取首/末条目；小节内无发音由区间外条目夹出（曲首全休止可选，V6）；空数据/区间 start ≥ end → null |
| TC-SEL-09 | 框选修饰键（text-selection §3.5 / S10） | 无修饰 = 替换（自动归一化）；Shift = 扩展（并集）；Ctrl/Cmd 重叠 = 裁剪取较长剩余段、全消 → null；不重叠 = 并入 |
| TC-SEL-10 | 摘要与描述 | 只数占位音符（装饰音/延续不计）；kind 区分乐句/小节/框选 |

### 5.3 行几何与框选（`tests/utils/notation/layout.test.ts`）

| 编号 | 用例 | 关键验证点 / 预期 |
| --- | --- | --- |
| TC-SEL-11 | 行几何 | `buildRowGeometries` 按 OSMD 换行分组、外接框带 padding、行号升序；`computeRowHighlights` 首/末行取音符水平包络 + isStartRow/isEndRow、跨行补中间无占位行整行高亮 |
| TC-SEL-12 | 矩形 → 区间 | `computeBoxSelection`：单行正向、反向归一化、跨行首截左/末截右/中间整行、未盖到任何音符 → null |

### 5.4 覆盖层与交互（组件层）

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-SEL-13 | 覆盖层渲染优先级（§4.2 v1.6） | committed 渲染行带/音符高亮/pill/边界句柄、装饰音不占位不高亮；`previewSelection` 非空优先于 committed；预览 null 回落 committed（不闪烁清空）；committed 空且无预览无任何选择视觉；pending 起点弱高亮独立于选择区间 | `tests/components/ScoreSelectionOverlay.test.tsx` |
| TC-SEL-14 | 乐谱页交互管线 | 单击音符即时选小节（零延迟）；双击两点设乐句（原生 dblclick 路径 + capture 重定向后按坐标命中；重复信号幂等）；空白拖拽框选、抬手提交跨行区间、音符上拖拽不产生选择；拖拽期间实时预览不提交；拖拽中按下 Shift 即时并入预览与提交（修饰键取最新事件状态）；`pointercancel` 中止并清除实时预览；未过拖拽阈值的空白单击不选；边界句柄拖拽微调吸附最近音符；外部清零信号销毁 pending（双击第一击后清零，再双击按新乐句起点处理不提交） | `tests/components/OsmdNotation.test.tsx` |
| TC-SEL-15 | 双指视口手势（selection.md §4.6，PRD G12） | 纯函数：跨度/中点、目标缩放 `zoom0 × span/span0` 钳制、滚动钳制、提交后锚定外推（总宽 0 回退）；组件管线：双指捏合抬手提交缩放（页脚倍率同步 + OSMD 重排）、拖拽中 CSS transform 预览在位、并拢落下再展开 move 补建、第二指作废第一指候选 tap（双指不产生选择）、`pointercancel` 回退显示不重排、双指平移写 stage 滚动且纯平移不重排 | `tests/utils/notation/pinchZoom.test.ts`、`tests/components/OsmdNotation.test.tsx` |

## 6. 播放引擎域用例（F5–F9）

依据 [audio.md](./audio.md)（决策 A1–A17）。

### 6.1 播放数据（乐谱时域）

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-TMP-01 | 拍秒换算唯一入口 | 附点四分 0.375 @90 = 1.000s（V7 端到端锚点）；四分 @60 = 1s、全音符 = 4s、0 → 0；beatValue=8 减半；`secondsToRealValue` 为逆 | `tests/audio/TempoConverter.test.ts` |
| TC-PBD-01 | 音名换算 | `halfToneToNoteName` 与 Tone `Frequency.toNote` 同构（60→C4 等） | `tests/audio/playbackData.test.ts` |
| TC-PBD-02 | `buildPlaybackData`（§2.2） | startRv 累计步长、noteIndex 连续、measureIndex 取光标当前小节；休止不产条目但占位计步；tie 延续不占位不播、起始音合并 `NoteTie.Duration`、链后步长不二次累计；**非邻接 tie startRv 取绝对时间戳不漂移**（marks-tie 回归）；装饰音整体跳过；倚音发声挤压在前共享主音 noteIndex（含宿主为休止/延续音时悬起挂下一发音条目）；装饰音展开（mordent 三片/trill 8 等分）共享 noteIndex；倚音+装饰音同主音（切片在挤压后窗口内展开）；装饰音邻音取调号（G 大调下邻音不带升号、D 大调下邻 F 带 #、B5 上邻 C6 八度进位）；多声部步长取 max；构建与 BPM 无关（A12）；空谱无条目 | 同上 |
| TC-PBD-03 | 真实 OSMD 光标回归 | marks-tie 跨小节链 / marks-grace 挤压 / marks-mordent 三片 / marks-turn 回音三态（turn 上起/inverted-turn 下起/delayed-turn 前半主音）/ marks-trill 8 等分五条 jsdom 加载不渲染路径 | 同上 |
| TC-ORN-01 | 装饰音枚举映射 | `ornamentKindFromEnum` 0–6 全映射、越界 null | `tests/audio/ornaments.test.ts` |
| TC-ORN-02 | 装饰音切片语义 | trill 8 等分主/上邻交替；turn/inverted-turn 上起/下起；delayed-turn 主音占前半；mordent 主-下邻-主 比例；切片总时值守恒 = 主音 durationRv | 同上 |
| TC-ORN-03 | 倚音时间安放 | 主音前空闲充足整块前移；无空闲挤占主音头部；部分空闲先吃空闲；总时值钳到主音一半、多倚音均分；无处安放 → null 整组丢弃 | 同上 |

### 6.2 时钟与引擎

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-CLK-01 | 锚点时钟（§3.9） | 未起播 timestamp=0；秒表推进换算；`setBpm` 先重锚再换速（A2 不跳时刻）；`setTimestampAndBpm` 直设锚点；等待时间 round 整毫秒、过去为负；pause 冻结/start 恢复零漂移；暂停中改锚保持冻结；reset 归零解冻；音频钟直通；换算自洽 | `tests/audio/TimingSource.test.ts` |
| TC-ENG-01 | look-ahead 调度（§2.5） | 首 tick 入窗条目按精确 when/velocity 0.7/BPM 换算时长调度；窗口右界 ±ε 含端点；定位安全间隔：起点前 0.02rv 内立即补播、更早不补；窗口右端钳到 loop.endRv（循环段外永不入窗） | `tests/audio/PlaybackEngine.test.ts` |
| TC-ENG-02 | 循环与空拍（A3/§3.4） | 空拍回跳 setTimeout 现算、回跳重锚定、广播 resetOccurred；空拍秒数播放中 setBpm 现算不缓存；播放中改 loop 边界当前段播完按新边界执行 | 同上 |
| TC-ENG-03 | 自动停止与守卫 | 顺序播放等最后一音播完（非最后一个发音时刻）才停；区间内无发音条目告警直接返回；未构建数据 play 告警返回 | 同上 |
| TC-ENG-04 | 停止与变速（A2） | stop 三步连续（清 tick → releaseAll → 时钟冻结锚回起点）；空拍等待期 stop 连定时器一并清；播放中 setBpm 传播到时钟、后续按新速换算 | 同上 |
| TC-ENG-05 | 节拍器（§3.7） | 拍点等间隔、强/弱拍按 beatsPerMeasure 判定；回跳节拍计数按起点重推（强拍对齐小节）；起拍节拍不被首 tick 定时器吞（回看线 = 安全间隔）；回跳后起拍同样不吞；音色/开关变化重建声部、音量只改字段；默认关闭只推进不出声 | 同上 |
| TC-ENG-06 | 事件与收尾 | iteration 只经 Draw 发射、resetOccurred 仅回跳为真；reset 接线序列末步定位+锚定；dispose 停止+释放声部+清事件；乐器切换仅停止态、播放中 setSampler 忽略（§3.6） | 同上 |

### 6.3 乐器与接线

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-INS-01 | 视觉对齐 | `drawWhenSeconds` 叠加 outputLatency；API 缺失/非法原样返回 | `tests/audio/InstrumentLoader.test.ts` |
| TC-INS-02 | 采样器缓存与守卫（§4） | 同类型并发单飞；七种乐器各构造对应包；**构造即接 destination**（漏接 = 全程无声）；ready 前 triggerAttackRelease 静默丢弃；统一 release 尾音；onload 后 isReady；dispose 全量释放清缓存 | 同上 |
| TC-INS-03 | 节拍器音色 | classic/digital/kick/click 四款强/弱拍映射与调用签名 | 同上 |
| TC-INS-04 | 真实接线默认件（§3.2/§3.9） | 构造即预载钢琴、时钟锚定注入音频钟；节拍器声部经注入工厂创建 | 同上 |
| TC-HPB-01 | 循环范围优先级（§3.4） | 有选择交 `computeLoopRange`（含 skipBeats）；无选择空拍 >0 循环全曲、否则 null 顺序播放 | `tests/hooks/usePlayback.test.tsx` |
| TC-HPB-02 | 引擎接线与生命周期 | 就绪后按接线序列挂播放数据、换谱重挂；tempo 即时传播（A2）；节拍器设置传播、卸载 dispose；乐器切换经 loadInstrument → setSampler；playing 随状态事件翻转、进度相对区间归一 | 同上 |
| TC-HPB-03 | 选择热更新 | 播放中改选择只写循环状态不停止（下一轮生效，selection.md §4.5）；空拍循环不自动停 vs 顺序播放自动停 | 同上 |

## 7. 原曲页用例（F10）

依据 audio.md §5（A5/A8/A13–A16）。页面用例均以 wavesurfer fake 驱动（jsdom 无 canvas 波形）。

### 7.1 纯函数（`tests/utils/audio/`）

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-AUD-01 | 音频文件校验 | 扩展名白名单四类（mp3/wav/ogg/m4a）；MIME 缺失视为未提供 | `audioFile.test.ts` |
| TC-SLC-01 | 循环计划（§5.3） | offset/duration/cycleDuration/loop；起止乱序换位；钳制 [0, bufferDuration]；duration < 0.05s 拒绝循环（F10）、恰在阈值允许；负 gap 钳 0 | `sliceUtils.test.ts` |
| TC-SLC-02 | 波形缩放阶梯（A13） | zoomIn 以 max(当前, 适应宽度) 基准倍增钳上限；zoomOut 折半不低于适应宽度；zoomPercent 相对适应宽度取整、最小 100 | 同上 |
| TC-SLC-03 | 显示格式化 | `formatTime` m:ss 负值钳 0；`formatFileSize` KB/MB、不足 1KB 取 1KB | 同上 |
| TC-SLC-04 | 双击命中 | `isTapWithinSlice` 区间内/两端边界命中；两侧越界不中；零矩形/未就绪一律不中 | 同上 |

### 7.2 页面行为（`tests/pages/OriginalAudioPage.test.tsx`）

| 编号 | 用例 | 关键验证点 / 预期 |
| --- | --- | --- |
| TC-AUP-01 | 空态与导入 | 空态入口 + accept 白名单；非法文件报 errorUnsupportedAudio 不建 wavesurfer 不入库；合法 mp3 入库 → 建 wavesurfer → loadBlob；ready 显示时长/采样率、拖选可用；启动恢复自动装载最新音频 |
| TC-AUP-02 | 切片循环（A5/A8/F10） | 已存切片恢复 region；region-out：暂停 → 空拍（0 拍 setTimeout(0)）→ 回卷重播；空拍拍数按 BPM 现算（2 拍 @90 ≈ 1333ms）；等待期重复 region-out 重入护栏忽略；update-end 回写持久化（键按音频归属）；拖选新建即生效持久化、播放键从切片起点播；二次拖选替换单切片；双击 region 移除并清持久化；**pointer 双击触控路径移除**（iOS 无原生 dblclick）与区间外不删；过短切片不恢复 region；播放键单按钮：有切片从起点播、播放中再按暂停在原位；`visibilitychange` 隐藏即暂停循环（A8）；移除音频回空态并删行删切片键；解码失败报 errorAudioDecode（第二道闸） |
| TC-AUP-03 | 拖放导入 | drop 合法入库建波形；非法报错不入库；dragover 高亮 / dragleave·drop 清除；已装载态 drop 替换音频、不继承旧切片、旧音频切片键保留（A16 归属隔离） |
| TC-AUP-04 | 波形缩放（A13） | ready 渲染控件（100%、ZoomPlugin 上限 2000px/s）；＋ 以适应宽度基准逐级倍增；− 折半不低于适应宽度、归位后禁用；倍率按钮回 fit（滚轮非整倍率也能归位）；连续放大钳上限后 ＋ 禁用 |
| TC-AUP-05 | 进度高亮域（A15） | 有切片进度层退化为波形色（不越界涂色）、高亮只来自 region；移除切片恢复朱砂双层进度；已播段：播放头进切片出现 [起点, 播放头] 深朱砂 region 不挡指针、越过终点钳到终点、回卷即移除、未进不出现；移除切片随之移除、改界按当前播放头重钳 |
| TC-AUP-06 | 多选与音频库（A16） | 隐藏 input multiple、多选逐个入库装载最后合法文件；drop 混合合法/非法分流；移除当前音频后空态陈列最近音频点选装载；音频库弹窗（头部按钮/当前高亮/库内删除不动当前装载）；切换音频不继承切片、切回自身切片恢复；弹窗打开时全局快捷键停用（Space 不播、Esc 只关弹窗） |

## 8. 外壳与通用用例

### 8.1 路由壳与页面骨架

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-APP-01 | App 路由壳 | 默认路由乐谱页；`/audio` 原曲页空态导入入口；导航两页切换；tempo 两页共享（乐谱页改、原曲页持有）；语言切换持久化 | `tests/App.test.tsx` |
| TC-APP-02 | 乐谱页集成 | 初始回落内置示范曲（ScoreInfo 来自解析、渲染区接管）；加载弹窗开/关；合法导入 解析→入库→ScoreInfo 更新→关弹窗；非法纯文本报 errorNotMusicXML 不入库弹窗保留；损坏 .mxl 报 errorCorruptArchive；弹窗历史展示/载入/删除；启动恢复最新一份替代示范曲；快捷键 Space/Esc；弹窗打开时 Space 让位；速度滑杆透传 App 共享；空拍透传状态栏；乐器选择持久化 localStorage；单击/双击选择 → SelectionInfo/覆盖层 chip；Esc = 停止并清除选择、播放中 Space 不受影响 | `tests/pages/ScorePage.test.tsx` |

### 8.2 i18n（F11，KR3 硬约束）

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-I18N-01 | 四语言键完整 | en-US/zh-CN/zh-TW/fr-FR key 集合完全一致；叶子均非空字符串或插值函数；theme.* 13 键 ×4、每款皮肤 id 有名称（与 themes.ts 对齐）、关键取值符合设计稿键表 | `tests/locales/index.test.ts` |
| TC-I18N-02 | 语言检测 | 存储合法优先；非法回落浏览器候选顺序；中文变体映射（简体默认、繁体地区 zh-TW）；无法识别 en-US；四码支持 | 同上 |
| TC-I18N-03 | Provider 行为 | Provider 外 `useI18n` 抛错；默认 en-US；localStorage 存储优先；浏览器语言回落（zh-TW 候选）；setLanguage 即时生效并持久化；无痕写入失败仅会话内生效 | `tests/locales/I18nProvider.test.tsx` |

### 8.3 通用 hooks

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-HOOK-01 | `useLocalStorage` | 缺省 initialValue；反序列化；损坏 JSON 回落；写 JSON；写入失败不影响会话内状态；重挂读回；key 固定约定 | `tests/hooks/useLocalStorage.test.tsx` |
| TC-HOOK-02 | `useClickOutside` | 外点触发、内点不触发、卸载移除监听、回调热更新 | `tests/hooks/useClickOutside.test.tsx` |
| TC-HOOK-03 | `useDoubleTap`（触控硬要求） | 窗口内两按触发一次（回调收第二次事件）；超 400ms 不触发、恰在边界触发；位移超 24px 不触发、恰为 slop 触发；两按之间点容器外打断；pointercancel 重置；非主指针不参与；容器外不触发；卸载移除；回调热更新不重挂；自定义阈值生效 | `tests/hooks/useDoubleTap.test.tsx` |
| TC-HOOK-04 | `useTheme` | 无存储默认 paper 且不回写 dataset（首帧归 index.html 内联脚本）；合法读取；非法回落 paper（T4）；setTheme 即时写 dataset + 原始字符串持久化；localStorage 不可写状态仍生效 | `tests/hooks/useTheme.test.tsx` |

### 8.4 键盘快捷键（F13）

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-KBD-01 | 全局快捷键 | Space 播放切换 + 阻默认；Esc 停止；提供 onEscape 时走清除路径（tech §6.3）；input/textarea/contentEditable 聚焦忽略；enabled=false 停用 | `tests/hooks/useKeyboardShortcuts.test.tsx` |

### 8.5 皮肤系统（`features/skin-switching.html` §③/④）

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-THM-01 | token 覆盖块全表契约 | 除 paper（:root 默认）外八款各有覆盖块；:root 值域 = paper 全部颜色 token；7 个皮肤化新增 ★ token；派生色走 color-mix、无写死色值 | `tests/themes/css.test.ts` |
| TC-THM-02 | StyleX 无写死色（T1） | 组件/页面/hooks 源码不出现写死 hex | 同上 |
| TC-THM-03 | 主题切换器 | 入口显当前皮肤名；弹层经典/古风两组 9 款（字形 + 三色预览 + 英文副标 + 选中 ✓）；点选即时换肤（dataset.theme + 持久化）弹层收起；非法存储回落 paper；Esc/外点/再点入口关闭 | `tests/components/ThemeSwitcher.test.tsx` |
| TC-THM-04 | 每主题专形专绘图标 | 九款各注册整 17 枚无遗漏；走带键恒实心（SOLID_ICONS）；path d 语法合法（M 起笔、无 NaN）；每枚图标跨皮肤字形互异（专形专绘非共用几何）；每款定义笔触；换肤同时切笔触与字形；play/stop 恒实心；palace 方折笔触；17×9 全渲染；乐器 7 种全 SVG 无 emoji；ThemeGlyph 笔触固定取本主题、9 字形 × 9 皮肤均有内容 | `tests/components/icons/ThemeIcon.test.tsx`、`ThemeGlyph.test.tsx` |

### 8.6 通用组件

| 编号 | 用例 | 关键验证点 / 预期 | 落点 |
| --- | --- | --- | --- |
| TC-CMP-01 | 展示组件 | Header 品牌/副标题/双页导航/语言菜单（展开、选中态、切换持久化即时生效、外点关闭）；ScoreInfo 曲名 + 元信息行、可选字段缺省不出分隔符；SelectionInfo 空态/朱砂 chip（乐句·小节范围·音符数）/kind 区分/无效选择提示；StatusBar 停止态乐器 BPM、播放指示、空拍拍数简称与单数文案 | `Header/ScoreInfo/SelectionInfo/StatusBar.test.tsx` |
| TC-CMP-02 | 播放控制族 | PlaybackControls 四区块渲染 + 回调透传；TempoSlider 范围/BPM 大字/拖动回调/disabled 只读；TransportButtons 单按钮 Play↔Stop 语义切换；LoopSkipSelector 1–8 拍、点当前归零、aria-pressed 与说明文案；MetronomeToggle 开关回调、On 文案、设置面板（音色四选一 + 强/弱音量）、Esc/外点关闭 | `PlaybackControls/*.test.tsx` |
| TC-CMP-03 | 乐器选择 | 触发按钮显当前乐器；展开列 7 种并标选中；选择回调收起；点非当前值不误触发 onChange；instrumentMeta 四语言非空标签、en-US 映射正确 | `InstrumentSelect/instrumentMeta.test.ts` |
| TC-CMP-04 | 文件弹窗族 | FileLoaderModal / AudioLibraryModal：open=false 不渲染；对话框结构（标题/上传区 accept/最近计数/隐藏 input）；历史条目回调与 data-active 高亮；Esc/✕/遮罩关闭、内部点击不关；上传区键盘操作（Enter/Space）；文件回调双入口（change + drop）；导入中文案 aria-busy 且键盘不触发；错误横幅 role=alert；空态文案；拖拽悬停高亮；FileHistoryList 逐条渲染/删除可访问名/点选回调/缺省不触发/icon 换图/activeId 标记 | `FileLoaderModal/AudioLibraryModal/FileLoader/FileHistoryList.test.tsx` |

## 9. e2e 用例（真浏览器）

`tests/e2e/*.e2e.ts`，tester-army 驱动 Playwright chromium；单测绿但真浏览器坏的缺陷由这一层兜底（StrictMode 双渲染毒化几何、capture 吞 dblclick、DefaultColorNotehead、双路径覆盖序均由此抓出）。

| 编号 | 用例 | 关键验证点 / 预期 | 规格 |
| --- | --- | --- | --- |
| TC-E2E-01 | 启动 | 示范曲渲染乐谱页（真 OSMD SVG 在位）；导航到原曲页再返回 | `boot.e2e.ts` |
| TC-E2E-02 | 导入与恢复 | 经加载弹窗导入 MusicXML，reload 后从 IndexedDB 恢复 | `import.e2e.ts` |
| TC-E2E-03 | 选择 | 单击符头选所在小节；双击两点设乐句循环；空白拖拽实时预览、抬手提交 | `selection.e2e.ts` |
| TC-E2E-04 | 换肤 | 切宫墙红：staff token 替换、谱面重新上色 | `theme.e2e.ts` |
| TC-E2E-05 | 走带 | 走带按钮 Play ↔ Stop 切换（用户手势内 Tone.start） | `transport.e2e.ts` |
| TC-E2E-06 | 真实谱选择+光标带（selection.md v1.9 回归） | 导入「刻在我心底的名字」（含 `<rest measure="yes"/>` 无 `<type>` 休止）：单击选小节、双击设乐句在真实谱上生效（防线 1 计数对齐回归）；Play 后光标带跨过前导全小节休止静默期出现（m1 @ ♩=65 ≈ 3.7s） | `real-score.e2e.ts` |

## 10. 手动验收用例（浏览器 / iPad）

自动化不覆盖、或只能在真机/真声上验证的部分。跑单前先 `pnpm dev`，样例谱见 §11。

| 编号 | 前置 | 步骤 | 预期 |
| --- | --- | --- | --- |
| TC-MAN-01 | 动过 `src/audio/`、`PlaybackControls/` 或乐器采样 | 加载《小星星》→ Space 播放听钢琴声、音随光标；停止态依次切换 7 种乐器再播；开节拍器切四音色、拖强弱音量 | 全程有声（验证「构造即接 destination」真实生效——单测只验接线，jsdom 无声）；节拍器强弱拍可辨；变速拖动中不炸音不跳拍 |
| TC-MAN-02 | 三份权威样例谱 + 内置示范曲 | 每份谱走 F1–F13 全链：导入→渲染→单击/双击/框选→清除→播放/停止→循环空拍 1–8→节拍器→播放中拖速度滑杆→乐器切换→语言切换→刷新恢复历史 | 《刻》谱（含空小节全休止，v1.8 教训谱）选择/播放/光标不错位；《连音符》谱三连音时值正确；《小星星》作兜底示范曲；非法文件（损坏 `.mxl`、纯文本、GB2312 老谱）用户可见报错文案正确（TC-IMP-04 的 i18n 面） |
| TC-MAN-03 | iPad 真机（Safari / PWA），手指 + Apple Pencil | 单击选小节；双击两点设乐句（触控无原生 dblclick，走 pointer 双击路径）；空白拖拽框选 + 抬手提交 + 边界句柄微调；乐谱页滚动/缩放不误触选择（touch-action）；原曲页切片拖选/拖动/边界微调/双击删切片；全程无 300ms 点击延迟感 | 各交互与桌面等价；触控双击响应在 400ms 窗内；拖拽有 4px slop（微抖不成选）；滚动流畅无选中残影 |
| TC-MAN-04 | 桌面 Chrome + iPad Safari | 播放中观察光标带推进 vs 声音节拍；开节拍器对拍 | 视听对齐（drawWhenSeconds 叠加 outputLatency 生效）；iPad 输出延迟下光标不明显超前/滞后 |
| TC-MAN-05 | GitHub Pages 部署 | 直开 `/TuneTutor/`；浏览器安装 PWA；飞行模式重开；刷新 `/#/audio` 深链 | 页面可达不 404（HashRouter + base `/TuneTutor/`）；可安装；离线可用；图标为品牌反复记号（构建期生成） |
| TC-MAN-06 | 原曲页已装载音频并设切片循环 | 播放循环中切后台标签页再切回；乐谱页播放中切后台观察连续性 | 原曲页隐藏即暂停循环（A8）、回前台不重复回卷；乐谱页后台表现按 audio.md §3 现状做记录性检查（不设硬预期） |
| TC-MAN-07 | — | 四语言逐一切换走查两页全部文案（含琴名、拍数、状态栏、弹窗、错误提示） | 无裸 key、无缺译；插值（数字/名称）正确；zh-TW 用词与 zh-CN 区分 |
| TC-MAN-08 | 大谱两份 | 导入「世界赠予我的」（58 小节）与「乌兰巴托的夜」（63 小节、12 组 tie）：渲染耗时、缩放/框选/播放流畅度；「乌」谱设含 tie 段的循环回跳听衔接 | 渲染秒级完成、交互不掉帧；tie 段循环无重音/断音（延续音合并正确）；内存无持续增长 |
| TC-MAN-09 | 仓库根损坏样例 `刻在我心底的名字.mxl` | 作为 F1 报错路径的实物材料走导入 | 报「压缩包损坏」类错误（E1），不白屏不卡死；该文件仅作 E1 材料，勿用于 `.mxl` 正常路径验证 |

## 11. 样例谱与夹具清单

| 文件 | 用途 | 用例引用 |
| --- | --- | --- |
| `public/twinkle-twinkle-little-star.musicxml` | 内置示范曲回落（F2）；出声回归首选 | TC-MAN-01、TC-APP-02 |
| `刻在我心底的名字.musicxml`（根） | 真实谱：`<rest measure="yes"/>` 无 `<type>` 休止（v1.9 成员判定教训谱） | TC-MAN-02、TC-SEL-02/03、TC-E2E-06 |
| `musicxml/连音符.musicxml` | 真实谱：连音时值 | TC-MAN-02、TC-IMP-07 |
| `musicxml/世界赠予我的.musicxml` | 真实谱：58 小节 beam、10 处全小节休止（配对实测矩阵） | TC-IMP-11、TC-SEL-03、TC-MAN-08 |
| `musicxml/乌兰巴托的夜.musicxml` | 真实谱：63 小节 beam、12 组跨小节 tie | TC-IMP-11、TC-PBD-03、TC-MAN-08 |
| `刻在我心底的名字.mxl`（根，**已损坏**：文本损坏的 zip） | 仅作 E1 报错材料；**勿**用于 `.mxl` 正常路径 | TC-MAN-09、TC-IMP-04 |
| `musicxml/marks-{tie,slur,grace,mordent,turn,trill}.musicxml` | 合成标记夹具（决策 M6/M8、A17） | TC-IMP-10、TC-PBD-03 |
| `musicxml/rhythm-{mixed,tuplets,syncopation,meters}.musicxml` | 合成节奏夹具（M4/M5） | TC-IMP-07/10 |
| `musicxml/keys-{sharps,flats,minor,extremes}.musicxml` | 合成调号夹具（§4.9、A17 邻音取调号） | TC-IMP-10、TC-PBD-02 |

在 `musicxml/` 新增合成夹具时必须同步 `tests/utils/notation/fixtures.test.ts` 的夹具清单断言（AGENTS.md）。

## 12. 已知盲区与遗留

按优先级排列；补测试从这里认领，落地后删条目并更新本文。

1. **真实出声不在自动化内**：jsdom 无 WebAudio 输出，采样器漏接 destination、包族加载失败等只有 TC-MAN-01 能兜住；新音频代码落地前先真浏览器验声（audio.md 既有约定）。
2. **命中防线 2 残余（v1.9 收窄）**：38% 剔除率的主因已修——防线 1 成员判定补 `<rest measure="yes"/>` 无 `<type>`（TypeLength=0，曾致《刻》谱整谱选择死区，TC-E2E-06 兜底）；防线 2 改按休止/音符分类标定（类间 bbox 差曾被混合中位数整类误杀）。残余为**个体**雕版漂移：《刻》谱 4/460（dx ≈ −28~−31px，含装饰音 PAS 不反映绘制位）成路由命中死区；乌兰巴托的夜个别音符、连音符首音符同类。类内再分档（grace 校准表）待跨真实谱回归数据支撑。
3. **PWA（F12）零自动化**：可安装/离线/manifest 正确性无用例，仅 TC-MAN-05；e2e 也只到 boot 级两页，覆盖浅。
4. **wavesurfer 真插件行为差异**：原曲页单测用 fake（真插件拖选只发 region-created），region 拖动/边界微调的手感与事件序列靠 e2e + TC-MAN-03。
5. **G12 移动端触控专项未启动**：单测/e2e 已覆盖触控等价路径（Pointer Events + `useDoubleTap`），但真机手感（slop 值、双击窗、滚动误触）只有 TC-MAN-03。
6. **性能无基线**：大谱渲染/播放流畅度（TC-MAN-08）只有手动观察，无指标断言。
7. **G1–G17 规划功能无用例**：随落地按域增补（真暂停 G1 落地时补 usePlayback/Engine 暂停态用例；count-in G2 补节拍器预备拍用例等）。
