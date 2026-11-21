# TuneTutor 音频播放技术规格

**版本**: 2.9
**日期**: 2026-11-02
**状态**: Ready for Re-implementation
**变更**: 自 [tech.md](./tech.md) v2.0 §4(时间轴模型)/§5(播放引擎)拆分并扩写;成文前完成同类实现调研(osmd-audio-player、alphaTab、abcjs、wavesurfer 官方示例、LoopMate,摘录见 §9);v1.1 补充 §5.1 波形可视化方法(渲染管线、进度机制、peaks 预载否决,决策 A9);v1.2 依据官方播放器逆向行为规格(2026-10-17 REA,见 [spike/sponsors-demo-extract/rea/REA-ANALYSIS.md](../spike/sponsors-demo-extract/rea/REA-ANALYSIS.md),下称「官方规格」)全面复核(新增 A10/A11)。**v2.0 架构改版(2026-10-18)**:按决策「参考 osmd-player 实现」整体对齐官方播放器架构——废弃 buildTimeline 绝对秒时间轴与 Tone.Transport + Part 路线,改为 `playbackData`(乐谱时域播放数据,构建与 BPM 解耦)+ `TimingSource`(可注入锚点时钟)+ `PlaybackEngine` 内 look-ahead 窗口调度与循环状态机;A1/A2 推翻重写,新增 A12;BPM 变更由「全停重建」改为「即时重锚定」;`LoopRange` 由秒域改乐谱时域(tech.md §3、selection.md §2.4 同步)。本文生效后 tech.md 对应章节降为摘要。**v2.1(2026-10-18)**:§5.1 补波形缩放(官方 ZoomPlugin + 适应宽度基准步进控件,新增 A13)与拖放导入入口;服务 F10 精准定位切片。**v2.2(2026-10-18)**:§5.1 播放头自动跟随改为切片域规则(新增 A14)——存在切片即关 autoScroll,无切片全曲播放保留官方默认;消除切片循环与视口自动右滚的冲突。**v2.3(2026-10-18)**:§5.1 进度高亮域改为切片域规则(新增 A15)——切片内内置进度层退化为波形色,高亮只来自切片 region 覆盖层;消除 [0, 切片起点] 被进度层越界涂色的冲突。**v2.4(2026-10-18)**:§5.1 多音频库(新增 A16)——文件选择器与拖放支持多选逐个入库(活动音频取最后一个合法文件),新增 AudioLibraryModal 音频库弹窗(切换/库内删除)与空态「最近音频」陈列;切片持久化键由全局单键改按音频归属 `note-slice-audio-slice:<id>`,多音频互不串切片、切回即恢复,旧全局键启动时迁移到恢复音频名下。**v2.5(2026-10-18)**:§5.1 落地 A15 让位的切片内已播段高亮——第二 RegionsPlugin 实例驱动一条 `[切片起点, min(播放头, 切片终点)]` 的深朱砂 region(timeupdate 跟随、`pointerEvents: none` 不挡把手、随切片改界/移除重算),切片内已播/未播明暗区分,§8 对应候选移除。**v2.6(2026-10-18)**:§2.2-3 重写——`startRv` 由「累计步长」改为迭代器绝对时间戳 `currentTimeStamp`:非邻接 tie(marks-tie m2→m3 D5 链)下累计把合并时值当步长,后续条目整体漂移且不回位(光标带/音频同步滞后,实测确认);官方 enrolledTimestamp 同语义,§10 补真实 OSMD 集成回归。**v2.7(2026-10-18)**:§2.2 新增规则 8/9(决策 A17)——倚音发声与波音/颤音/回音演奏展开,`src/audio/ornaments.ts` 纯函数 + playbackData OSMD 提取;子条目共享主音 noteIndex,selection.ts `resolveEndpoint` 改同号组跨度解析(selection.md §2.3 同步);§10 补 ornaments 纯函数表与三 fixture 真实 OSMD 集成回归。**v2.8(2026-10-18)**:§5.1 修切片生效时机——拖选新建 region 只发 `region-created`、无初始 `update-end`(wavesurfer 7.12.11 源码核实),`AudioSlice` 回写与持久化移到 `region-created` 即时完成;修复首次拖选切片后播放键拿不到切片起点、从 0 开始播放的缺陷,恢复/拖移/resize 路径行为不变。**v2.9(2026-11-02)**:§2.2 新增规则 10(决策 A18)——移调乐器谱播放折算:`attributes/transpose` 经 musicxml.md M11 入 `ParsedScore.transpose`,`transposeSemitonesByMeasure` 逐小节半音表传 `buildPlaybackData`,noteName(主音/倚音/装饰音邻音)按小节统一平移到实际发声音高;中音萨克斯谱(记谱比实际高大六度)整曲偏高的实测缺陷由此修复,OSMD 渲染仍记谱音高。
---

## 0. 定位与范围

本文是 [tech.md](./tech.md) 在**音频域**的细化规格:tech.md 定框架(模块划分、数据契约、存储/构建约束),本文定音频播放的全部细则。效力与 tech.md 同级,**音频域内冲突以本文为准**,并回改 tech.md。

- **覆盖**:`src/audio/` 全部(`PlaybackEngine` / `playbackData` / `TimingSource` / `InstrumentLoader` / `TempoConverter` / `sliceUtils`)、原曲页(`OriginalAudioPage`)的播放驱动、两页共享的速度与空拍换算、播放与 UI 的接口契约(事件、光标跟随、进度推导)。
- **不覆盖**:渲染与选择交互(tech.md §6)、存储 schema 与键名(tech.md §7)、React 组件层级(prd.md §7.1)、用户可见文案(i18n,tech.md §8)。数据契约(`PlaybackEntry` / `LoopRange` / `MetronomeSoundType` / `InstrumentType` / `AudioSlice`)**以 tech.md §3 为唯一权威**,本文只引用不重复;唯一例外是 `sliceUtils` 内的 `AudioLoopPlan`(tech.md 未收录,见 §5.3)。

产品上是两个播放子系统,共享同一速度轴:

| | 乐谱页 ScorePage(F3–F9) | 原曲页 OriginalAudioPage(F10) |
| --- | --- | --- |
| 音源 | `Tone.Sampler` 采样合成(tonejs-instrument-\*-mp3 ×7) | 用户导入音频(mp3/wav/ogg/m4a) |
| 调度 | 引擎内 look-ahead 窗口调度(音频时钟,采样精确 when) | wavesurfer 回放 + region-out 事件驱动循环 |
| 循环+空拍 | 引擎内循环状态机:回跳 + 空拍等待(官方 LoopPauseMs 同构) | region-out → 空拍等待 → 回卷(§5.2) |
| 共享 | 同一 `tempo`(40–240,App 持有)、同一 `beatsToSeconds` 空拍换算 | 同左 |

---

## 1. 模块与数据流

| 模块 | 职责 | 依赖 | 可测性 |
| --- | --- | --- | --- |
| `playbackData.ts` | OSMD 光标 → `PlaybackEntry[]`(乐谱时域,单一事实来源;构建与 BPM 无关) | OSMD cursor | mock cursor 可单测 |
| `TimingSource.ts` | 锚点时钟:乐谱时域时间戳 ↔ 毫秒(可注入;实时实现锚定 AudioContext.currentTime) | TempoConverter | fake 时钟可单测 |
| `TempoConverter.ts` | RealValue→秒、拍→秒(纯函数) | — | 纯函数 |
| `PlaybackEngine.ts` | look-ahead 窗口调度、节拍器、循环状态机、事件(官方 PlaybackManager 同构) | TimingSource、playbackData、InstrumentLoader | fake 时钟 + fake 采样器可单测 |
| `InstrumentLoader.ts` | 7 种采样器加载与缓存 | tonejs-instrument-\* | mock 包 |
| `sliceUtils.ts` | 原曲切片钳制/循环计划(纯函数) | — | 纯函数(已有单测) |

```
OSMD 光标 ──buildPlaybackData──▶ PlaybackEntry[]（乐谱时域,单一事实来源）──▶ PlaybackEngine（look-ahead tick 调度采样）
选择模型(tech §6.3)──▶ LoopRange ──▶ PlaybackEngine.setLoop
TimingSource（锚点时钟,可注入）──驱动──▶ PlaybackEngine；usePlayback 进度 = 时钟直读
PlaybackEngine ──iteration / state-change──▶ OsmdNotation（光标跟随, §3.8）
```

---

## 2. 播放数据模型(单一事实来源)

### 2.1 换算(唯一入口 = TempoConverter)

```
realValueToSeconds(rv, bpm)  = rv × 4 × (60 / bpm)                    // RealValue 是全音符分数(四分音 = 0.25)
beatsToSeconds(beats, tempo, beatValue = 4) = beats × (60/tempo) × (4/beatValue)   // 空拍等
```

任何「拍 ↔ 秒」换算必须走 TempoConverter,禁止组件内自写乘法(防多处公式漂移)。spike V7 已端到端验证:附点四分 rv = 0.375 @ 90 BPM → 1.000s。

### 2.2 buildPlaybackData 构建规则

条目形状(tech.md §3 权威):`PlaybackEntry { startRv, durationRv, measureIndex, noteIndex, noteName }`——全部时间为**乐谱时域**(RealValue,全音符分数),不含秒。

1. `cursor.reset()` 后逐步 `cursor.next()`,取 `Iterator.CurrentVoiceEntries`;空步跳过。
2. 跳过装饰音(`IsGrace` / `note.IsGraceNote`);**跳过连音线延续音**(`note.NoteTie && note !== note.NoteTie.StartNote`),起始音 `durationRv` 取 `NoteTie.Duration.RealValue`(延音合并)——官方同语义(官方规格 §3.10:tie 只播起始音)。
3. 条目 `startRv` = 迭代器**绝对时间戳** `iterator.currentTimeStamp.RealValue`(曲首为 0;官方 enrolledTimestamp 为 Fraction 同语义)。**禁止从步长累计推导**:tie 起始步的有效值是合并时值(规则 2),而光标下一步可能直达后续音符而非延续音(非邻接 tie),累计会整体漂移且不回位(marks-tie 实测:m2 D5 三连链合并 0.75 被当步长,m2 后半段起晚 0.5 并带至曲尾,2026-10-18 修复);绝对时间戳下多声部/空步天然对齐,无需步长 max 归并。
4. 休止符不产出条目,但 `noteIndex` 仍递增(与命中测试索引对齐,§2.4)。
5. 音名:`Frequency(note.halfTone + 12, 'midi').toNote()`——**OSMD `Note.halfTone` 比 MIDI 低 12**(源码 `halfTone = 12×XML八度 + 音级 + 变化音`,C4 = 48;调号、谱面变化音、小节内继承均已烘入,2026-10-18 实测:小星星 C4 直喂 Frequency 会整曲降八度播放,《刻》的三连音段 E5/D5/B♭4 实测 222ms 间隔与变音名全部吻合后确认换算)。
6. **构建与 BPM 解耦(决策 A12)**:加载/渲染后构建一次,条目存乐谱时域;BPM 只在引擎时钟边界进入换算(§3.5/§3.9),变更零重建。这是与 v1 绝对秒时间轴的本质区别,也是官方 PlaybackNoteGenerator 的做法(官方规格 §3.10:enrolledTimestamp 为 Fraction,速度无关)。
7. 数据终点 `endRv` = 末条目 `startRv + durationRv`:自动停止(§3.2)必须等「最后一音播完」而非停在最后一个**发音**时刻——官方 NextEntryTimestamp 同语义(官方规格 §3.10:播完末条目后 iterator 仍报「末条目 enrolled+Length」为下一到期时刻,让最后一音驱动结尾判定)。
8. **倚音发声(决策 A17)**:倚音以独立 Grace VoiceEntry 与主音同光标步出现(`IsGrace=true`,排在主音前,Length 不推进光标)——逐个记下音名、不占 noteIndex,挂到本步**首个发音条目**上:总时值 = min(个数 × 1/16, 主音一半),贴主音起点向前铺;主音前空闲(前条目末刻到主音起点,休止后才有)够放则整块前移(主音不动),不够则差额**挤占主音头部**(主音顺延、时长扣减,长倚音式)。无处安放(主音过短)整组丢弃;宿主是休止/延续音时挂到下一发音条目。子条目共享主音 `noteIndex`(选择域组跨度解析,selection.md §2.3)。OSMD Note 不暴露 slash,长/短倚音 v1 统一挤压式。
9. **装饰音展开(决策 A17)**:带 `VoiceEntry.OrnamentContainer` 的占位音符展开为切片子条目(`src/audio/ornaments.ts` 纯函数,OSMD `createVoiceEntriesForOrnament` 同款切片语义):trill 8 等分主/上邻交替;turn/inverted-turn 4 等分上/下起图形;delayed(-inverted)-turn 前半主音+后半图形;mordent = 主(1/4)+**下邻**(1/4)+主(1/2),inverted-mordent 上邻(MusicXML 标准方向,OSMD 枚举实现相反,A17 记录)。邻音 = 音级表 ±1(音级取 `Pitch.FundamentalNote`,八度从 halfTone 推导——`Pitch.Octave` 是内部相对八度,直用低三度),变化音取当前小节调号(`iterator.CurrentMeasure.getKeyInstruction(0)`);子条目共享主音 noteIndex,noteIndex 计数不变(§2.4 硬约束)。
10. **移调折算(决策 A18,v2.9 新增)**:`buildPlaybackData(cursor, transposeByMeasure?)` 第二参 = 逐小节有效移调半音表(`transposeSemitonesByMeasure` 产物,声明与继承规则归 musicxml.md M11);OSMD 解析器不读 `attributes/transpose`(min.js 无 octaveChange 符号,2026-11-02 实测),光标 halfTone 恒**记谱音高**,折算只能在此对 noteName 施加——主音、倚音、装饰音邻音三处同源平移(邻音在记谱域解析音程结构、再整体平移落发声域,颤音/波音音程不变),音名恒升号记法(diatonic 拼写折算不消费);表缺省/短于小节数/undefined 项回落 0(原样)。索引域零影响:noteIndex/startRv/durationRv 与折算无关,选择交互不受移调波及。缺省不传 = C 调乐器谱原样播放,旧行为不变。

### 2.3 起播定位与范围(替代 v1「范围过滤 + 时间平移」)

- 播放区间 = `LoopRange`(乐谱时域):`startRv` 定位 = 二分找首个 `startRv ≥ 起点 − ε` 的条目;定位时**已结束或已开始超过安全间隔的条目不补播**(官方 PlaybackIterator.Reset 规则;安全间隔 = 0.02 RealValue,官方 `PlaybackSkipNotesSafetyInterval` 同值,官方规格 §3.10);`endRv` 是 look-ahead 窗口右界与自动停止哨兵。时间戳保持全曲绝对、**不平移**——时钟锚点直接设在起点(§3.9)。
- 首小节可能全是休止符(spike V6 实测):定位必须容忍「区间内无发音条目」——区间内条目数为 0 时 `play()` 告警并直接返回(空区间守卫)。

### 2.4 索引对齐(硬约束)

`PlaybackEntry.noteIndex` 是全曲连续编号(休止符占位递增);`NoteInteraction` 命中测试产出/消费的 noteIndex 必须与之**同一遍历顺序**派生,否则乐句范围映射错位。任何一侧改动遍历顺序 = 双侧同改 + 手测双击选择回归。

### 2.5 时间比较容差(决策 A10)

官方时间戳域是「1/1024 四分音符网格 + Fraction 容差 1e-4」的有理数,毫秒只在时钟边界换算且 round 到整毫秒——这是其 closestNextTimestamp 比较稳定的来源(官方规格 §3.9;ms→时值反变换量化到网格、量化为 0 时取最小格,防零抖动)。v2 播放数据为 RealValue 浮点,对齐如下:

- RealValue 域:ε = 1e-4(与官方 Fraction 容差同值);适用:§2.3 定位端点与安全间隔、§3.4 loop 端点判定、窗口查询边界;**禁止裸 `===`/`<` 浮点比较**;
- 秒域:只在 when 换算边界出现,一律 **round 到整毫秒**(官方同款),不引入秒域比较。

---

## 3. 播放引擎(PlaybackEngine)

### 3.1 调度模型(决策 A1,v2.0 重写)

自调度 look-ahead tick,参数整体采用官方值(官方规格 §3.1/§3.2):

- `LOOK_AHEAD_MS = 100`(官方 `PlaybackAudioLookAheadMs` 默认同值);tick 自调度收敛 `wait = min(距下一事件的等待, max(10, LOOK_AHEAD_MS/2))` → tick ≤50ms;等待毫秒一律 round 整毫秒(官方 getWaitingTimeForTimestampInMs 同款)。
- 每 tick(官方 handlePlaybackEvent 对照,裁剪到单声部):① 读时钟 `ts = timingSource.getCurrentTimestamp()`;② 结尾/循环判定(§3.4);③ 窗口查询:取 `(ts, ts + lookAheadRv]` 内条目,**循环时窗口右端钳到 `endRv`**(循环段外的音永不入窗,§3.4);④ 逐条调度:`when = ac.currentTime + 等待ms/1000`,触发 `sampler.triggerAttackRelease(entry.noteName, realValueToSeconds(entry.durationRv, bpm), when, 0.7)`(velocity 固定 0.7,力度链见 §8 候选);⑤ 节拍器到期拍调度(§3.7);⑥ `Draw.schedule(() => emit('iteration', entry), when)` 广播。
- UI 更新一律 `Draw.schedule(cb, when)` 搬到最近 rAF;过期事件(>250ms,如后台标签页堆积)**直接丢弃、不补发**——光标恢复不得依赖 Draw 队列,应从时钟重推导(§3.8)。
- **单飞纪律**:同一时刻至多一个 pending `setTimeout(loop)`;任何停止路径必须先清 pending tick——否则最后一次自调度会让已停止的引擎「复活」。

推翻 v1(A1 旧文「不自研 lookahead 调度器,用 Tone.Transport + Part」)的理由:旧决策针对的是 osmd-audio-player 的从零自研(−35ms 光标提前量、300-tick 首音补偿等 hack);官方逆向规格已把这条路线的**全部参数与坑**定死(窗口/收敛比/整毫秒/回跳防炸音/负时间轴,均可按行号对照),照抄经生产验证的行为规格不是盲目自研。而 Transport + Part 要求把时间轴冻结为绝对秒——正是 buildTimeline 与「BPM 变更全停重建」的根因;改走官方路线后,即时变速、真暂停、离线导出三条候选路径全部解锁(§8)。

### 3.2 play() 调用序列

```
await Tone.start()                    // 必须在用户手势内;被拒则本次放弃
守卫:playbackData 已构建且区间内有发音条目(§2.3 空区间守卫);sampler 已就绪
engine.reset()                        // 迭代位置定位到区间起点(§2.3);循环/节拍计数归位
timingSource.start()                  // 锚点定时(时钟与音频图同源, §3.9)
启动自调度 tick(§3.1);emit PLAYING
```

接线序列(每次 OSMD 渲染后,官方 premium 接线同构):`stop() → load(buildPlaybackData(osmd)) → [有选择则 setLoop(range)] → reset()`。

### 3.3 停止语义与清理顺序(硬约束)

官方纪律照抄(官方规格 §3.11/§5-8):**全停声音 → 清调度状态 → 停时钟**,三步连续完成,不得在中间态停留或依赖外部再补救:

```
stop(): 清 pending tick(setTimeout) → sampler.releaseAll()(全停已发声与已提交采样)
        → timingSource.pause() + reset() → 循环/节拍计数清零 → emit STOPPED
```

Tone Sampler `releaseAll` 可立即释放全部发声采样(官方 `stopSound` 粒度是按声道全停、不分音符,v2 不继承该限制);窗口右端钳制(§3.1)保证不存在「已排未触发的循环段外音符」,无需官方 `doReset(keepNotes)` 绕行。乐谱页路由卸载同样调用 stop()(tech.md §2.3)。播放中按钮语义如实标注「停止」,无暂停/续播(PRD L2;零漂移暂停路径已由时钟内置,见 §8 候选)。

### 3.4 循环与空拍(核心差异化功能;官方 §3.3 循环状态机的 v2 同构)

- 范围优先级:**乐句(双击)> 单击小节区间 > 全曲**;无选择时空拍 > 0 循环全曲,否则顺序播放至自动停止。
- 循环实现:引擎内状态机 `loop { startRv, endRv, skipBeats }`(v2 无限循环;次数与 BPM 递增见 §8 候选)。tick 判定「`ts ≥ endRv − ε`」→ 空拍等待 = `setTimeout(beatsToSeconds(skipBeats, bpm) × 1000)`(官方 `LoopPauseMs` 同构;0 拍 = setTimeout(0) 立即回跳)→ 迭代位置重置到 `startRv`、节拍计数按起点重推 → emit `iteration`(带 `resetOccurred`,§3.8)→ 恢复 tick。空拍等待期间挂起循环判定(重入护栏),与官方 handleLoopJumpBack 的 setTimeout 回跳同构。
- **回跳不炸音**:窗口右端钳到 endRv(§3.1)+ 已发声采样自然收尾——官方 keepNotes 语义的 v2 等价物,无需特殊绕行。
- `skipBeats` 以拍为单位定义、随 BPM 现算秒,禁止缓存绝对秒(决策 A3);空拍是 setTimeout 的无事件等待,不调度静音音符(决策 A4)。
- 已知小瑕疵:采样 release 尾音可能渗入空拍开头。tonejs-instrument 包未定制 release(§4);如需收紧,由 InstrumentLoader 构造后统一设置,不逐音处理。
- 播放中改变选择(新 loop 边界):写入引擎循环状态,当前段播完回跳时按新边界执行——不重定位进行中的迭代(selection.md §4.5)。
- 官方对照(官方规格 §3.3):官方循环是引擎内状态机(次数/`LoopPauseMs`/BPM 递增/回跳 pre-count),本节即其 v2 同构;「每次回跳也数预备拍」在官方是独立开关(`DoLoopPreCount`,demo 默认关),归入 §8 count-in 候选,实现时默认关;「循环 BPM 递增」官方靠临时覆盖全部小节 tempo + `IgnoreTempoInstructions` 实现,v2 下 = 每次回跳 `setBpm(min(当前BPM+增量, 上限))` 零重建(§8 候选)。

### 3.5 BPM 变更(决策 A2,v2.0 重写)

`engine.setBpm(bpm)` → `timingSource.setBpm`:**先把锚点改为当前时间戳,再换 BPM**(变速不跳时刻;官方 AbstractTimingSource.setBpm 语义,官方规格 §3.9)→ 即时生效、不停止、零重建。look-ahead 窗口内(≤100ms)已排采样按旧速触发,误差上界 = 窗口宽,官方同款接受。TempoSlider 播放中拖动即时变速(产品行为随 v2.0 变更,prd F6 同步;旧「变更即停止 + 全量重建」是绝对秒时间轴的被迫代价,随 buildTimeline 废弃;rampTo 概念随 Transport 一并消失)。

### 3.6 乐器切换

仅在**停止态**切换(osmd-audio-player 的教训:已调度事件不会换音色,播放中切换会延迟生效甚至新旧混排)。经 `InstrumentLoader` 缓存获取/加载;引擎构造时预载钢琴(默认音色)。

### 3.7 节拍器

- 4 种预设:`classic`(MembraneSynth,C4/C3)、`digital`(Synth square,C5/C4)、`kick`(MembraneSynth,C2/C1)、`click`(NoiseSynth 白噪);强/弱拍独立音量 0–1,`beatCounter % beatsPerMeasure === 0` 判强拍;`beatsPerMeasure` 取拍号分子。
- 调度(v2.0 改):tick 内逐拍推进——拍点在乐谱时域等间隔(一拍 = 1/beatValue RealValue,4/4 即 0.25),引擎维护 `nextBeatRv` 算术推进,窗口内到期拍逐个以精确 `when` 调度合成器;拍点「过去」判定线与条目一致用安全间隔 0.02(§2.3)——真实 `setTimeout(0)` 的 ≥1ms 延迟足以越过 ε 线,起拍/回跳点节拍曾被判成过去吞掉、节拍器听感慢一拍进来(2026-10-18 实测修复;单测 fake 时钟按定时器 delay 推进、恰停在起拍点上,须显式模拟定时器延迟才复现);与主播放同一速度轴天然成立(同乐谱时域,变速/回跳后不错拍)。官方每 tick 由小节内相对位置重推 beatCounter 的做法(官方规格 §3.2-3)记为实现备注:恒定拍号谱下与算术推进等价,变拍号谱(中途换号)启用时改官方做法(§8 候选)。
- 生命周期:音色/开关变化 → dispose 旧合成器重建;音量变化只改字段不重建;NoiseSynth 用 `triggerAttackRelease('16n', time, velocity)`,其余用预设音名。
- 官方对照(官方规格 §3.5/§3.11):官方节拍器固定走音源通道 ch9(Woodblock 采样),默认静音靠 `Volume=0` 而非关开关;每拍先广播节拍事件(`{volume, firstBeat}`,UI 节拍灯的数据源)再真正发声,强拍判定与本节一致。v2 节拍器走合成器、不占音源通道(§4 音源方案不同),但「节拍事件先行、供 UI 可视化」的接法在做节拍灯时照抄;pre-count 段节拍器用独立音量的行为记入 §8 count-in 候选。

### 3.8 事件接口与光标跟随(决策 A7)

事件只有两级(与 osmd-audio-player 同构,实践证明够用):

| 事件 | 载荷 | 消费方 |
| --- | --- | --- |
| `iteration` | `PlaybackEntry` + `resetOccurred` 标志 | OsmdNotation:播放光标带推进/回卷跟随 |
| `state-change` | `'PLAYING'` / `'STOPPED'` | usePlayback / UI 状态 |

光标跟随契约(OsmdNotation 实现;2026-10-18 视觉改版:播放光标 = 选择覆盖层栈里的**金铜带**(ScoreSelectionOverlay,`--color-gold-bright` token,行带再外扩盖过五线谱 + 左缘金铜竖线),OSMD 自带光标仅装载时遍历播放数据用、从不 show——其颜色经 canvas 导出 PNG 吃不了 CSS 变量、高度锁死谱表内,`cursorOptions` 定制不满足视觉规格):

- PLAYING:清上一轮光标带,首 iteration 到来前不显示;
- iteration:rAF 合并同帧多击;**光标带目标 = 事件载荷的 `entry.noteIndex`(刚发声条目),不读引擎活指针**——指针在 look-ahead 调度时刻已前进(窗口内多音、调度 tick 与 rAF 之间的竞态),按指针走会在密集段提前到下一音(2026-10-18 实测修复);`resetOccurred`(循环回跳)无需特判,回跳事件载荷即循环起点条目(官方 `CursorPosChangedData.ResetOccurred` 同构,官方规格 §3.13);
- 重渲染(缩放/换肤/resize)无需重同步:视觉活在覆盖层、几何缓存重建后按同一 noteIndex 现算;
- STOPPED:立即清带,不等帧;
- **视觉对齐「听感」**:Draw 调度时刻叠加 `outputLatency`(InstrumentLoader `drawWhenSeconds`,Safari 无此 API 时为 0)——采样与 Draw 同在 context 时间轴,但用户听到的是输出延迟之后的声音。

真机对齐实测(2026-10-18,demo 谱 90 BPM):光标带跳动间隔 664~677ms 与音符网格逐拍锁合、二分音符处自动加倍,误差 ≤30ms(Draw 8ms anticipation + 帧量化)。

进度推导(usePlayback,v2.0 简化):不走事件流,播放期间轮询 `timingSource.getCurrentTimestamp()`——当前音符 = 引擎迭代器指针直读(不再对数组二分),progress 相对当前播放区间(全曲或 loop 区间)归一;推导与调度同出一个时钟,天然一致(D1)。所有比较遵守 §2.5 容差。

官方对照(官方规格 §3.2-9/10、§3.13):官方光标同为事件驱动——监听器收 `CursorPosChangedData` 完整载荷(measureIndex/BPM/IsPreCounting/ResetOccurred/PlaybackStartTimestamp 等),且渲染就绪时只在拍点到期或结尾才推进。一处现成教训(官方规格 §3.8):官方「高亮已播音符」的 set 端受 `highlightPlayedNotes` 门控、unset 端却**无条件**执行(残留表达式所致)的不对称——v2 若做已播音符高亮,**关闭开关时必须主动清除全部已置状态**,不能指望对称回滚。

### 3.9 时钟(TimingSource)与引擎开关默认值

- **锚点模型**(官方 AbstractTimingSource 同构,官方规格 §3.9):`getCurrentTimestamp() = anchorRv + elapsedRealValue(elapsedMs)`;`setBpm(b)` 先把锚点改为当前时间戳再换 BPM(变速不跳时刻);`getWaitingTimeInMs(target) = round(到 target 的等待毫秒)`;`setTimestampAndBpm(ts, bpm)` 把锚点直接设到任意时间戳——count-in 负时间轴与中途定位的支点(§8 候选)。
- **LinearTimingSource**(实时实现):`elapsedMs = 1000 × (ac.currentTime − lastResetTime)`。**时钟与音频图同源**:pause = 挂起(可直接 `ac.suspend()`,同时冻结已排采样与时间轴——暂停/恢复零漂移、免对表,官方全部秘密,官方规格 §3.9/§5-6;为 G1 真暂停铺路);reset = 锚点归零、lastResetTime = ac.currentTime。**时钟做成可注入接口**(决策 A12):离线导出的 CaptureTimingSource(纯虚拟时钟)与实时实现同一抽象(§8 候选 G13)。
- 决策 A11(v2.0 保留):引擎**不设隐式出声总闸**,一切影响出声的开关(state、节拍器开关、loop、音量)都是显式字段,构造完成即处于「`play()` 即出声」状态;今后新增开关时,**默认值必须写进本文决策记录**再实现。官方 `DoPlayback` 隐式总闸是反例(官方规格 §4/§5-10);官方默认 `DoPreCount = false`(预备拍默认关)、`PreCountMeasures = 1` 记为 count-in 候选默认值。

---

## 4. 乐器音色(InstrumentLoader)

- 7 个 `tonejs-instrument-*-mp3` 包:piano / guitar-acoustic / bass-electric / violin / flute / saxophone / trumpet。包族源流:nbrosowsky/tonejs-instruments 采样库 → Makefully-Studios 打包发布;实现即 `class extends Sampler`,**无 release 定制**;`minify: true` 只加载 9 个采样靠 repitch 覆盖全音域。
- **不用 minify**(9 音 repitch 音质损失大,练习器听感优先);钢琴全量 85 个 mp3 ≈ 15.6MB,靠 Vite 静态打包 + PWA 缓存,不做运行时 CDN 加载(同类项目均自托管音源防 CDN 失效)。
- 缓存:`Map<InstrumentType, Sampler>`;同类型并发请求共享同一加载 Promise(防重复构造);`dispose()` 全量释放(测试/卸载用)。
- 包族 peerDeps 只声明 `tone ^14.7.77`,Tone 15 属实测兼容——**升级 Tone 大版本必须回归验证音色加载**(§6-5)。
- **接线(2026-10-18 实测补记)**:包族只 `extends Sampler`,**不接 destination**(Tone 节点亦不自动连输出,官方播放器为自行 `.toDestination()`);连接由 InstrumentLoader 负责,构造后 `.toDestination()`,漏接表现为播放状态正常推进但全程无声。采样异步加载,ready 前 `triggerAttackRelease` 会被 Tone 以 `No available buffers for note` 抛错、且异常落在引擎 tick 内会打死自调度——包装层 ready 前静默丢弃,引擎构造等 `piano.ready` 才返回(usePlayback 的 `ready` 即「钢琴预载完成」,§3.6)。
- 可选优化:构造后统一 `sampler.release = 0.5~1` 改善钢琴尾音(官方暴露属性,非 hack;空拍渗音见 §3.4)。

---

## 5. 原曲页播放(OriginalAudioPage)

### 5.1 波形可视化与切片管理

**可视化方法(mp3 → 波形,决策 A9)**:渲染全部交给 wavesurfer v7 内建 canvas 管线,应用层只传参数、订阅事件,不自绘 canvas。管线经 7.12.11 源码核实,重写照此对齐:

1. **装载**:IndexedDB 取出 `ArrayBuffer` → `new Blob([data])` → `loadBlob(blob)`(勿用 `load(url)` 造成二次 fetch);`decode` 事件 = 波形解码完成,`ready` = 渲染完成、可建 region。
2. **双次解码**(WebAudio 后端固有):播放 buffer 由 WebAudioPlayer 以**原生采样率**自行 `decodeAudioData`;波形峰值另按 `sampleRate` 选项(默认 **8000 Hz**)解码一份 `decodedData`,仅作峰值来源。8 kHz 只影响波形分辨率、不影响播放音质;无特殊理由不改默认。
3. **峰值绘制**:逐像素列分桶取 min/max → canvas 2D 填充;默认连续折线多边形,`barWidth` > 0 转柱状(`barGap`/`barRadius`/`barAlign`)。ui-design 波形卡片为柱状,**`barWidth` 必设**。
4. **双层进度**:每个波形 canvas 克隆一份、以 progressColor 经 `source-in` 合成重绘为进度层,随播放位置裁切;播放中由 rAF Timer(每帧 ≈16 ms)驱动重绘并 emit `timeupdate`/`audioprocess`——§5.2 的 region-in/out 即挂在其上;播放头是独立 DOM 线(`cursorColor`/`cursorWidth`,默认取 progressColor)。
5. **内建能力禁止重造**:HiDPI(devicePixelRatio 缩放画布)、容器 resize 自动重绘(ResizeObserver)、长音频多 canvas 分片 + 滚动懒渲染、`normalize` 峰值归一化、`splitChannels` 分声道;仅当确认默认绘制不满足 UI 时才用 `renderFunction` 自定义,不得整层自绘。

- **peaks 预载不采用**:`load(url, peaks, duration)` 的预计算峰值服务于「先展示后解码」的网络流场景;本产品音频全在本地(IndexedDB ArrayBuffer),全量解码不可避免,预载零收益,反而多一份要持久化/校验的数据。
- **region 是 DOM 覆盖层,不画进 canvas**:RegionsPlugin 在波形 wrapper 上叠绝对定位容器(z-index 5),region 按时间百分比定位、两侧 6px 拖动把手;切片的朱砂色即 region color(取值随 ui-design 基线);`enableDragSelection` 返回解绑函数,卸载时必须调用。
- `WaveSurfer.create`(WebAudio 后端)+ `RegionsPlugin`;**`addRegion` / `enableDragSelection` 统一在 `ready` 事件后调用**(7.12 起 addRegion 早于 ready 会自动挂起到 ready 再建区,勿依赖该行为;拖选换算与回写本就依赖已解码时长)。
- 单切片约束与生效时机(v2.8 修正):`region-created` 时移除旧 region,并**立即回写 `AudioSlice` 并持久化**(键 `note-slice-audio-slice:<audioId>`,A16)——拖选新建的 region 只发 `region-created`,插件不会为新建 region 补发初始 `update-end`(7.12.11 源码核实:`update-end` 仅在拖移 region、resize 把手结束、contentEditable 失焦时发),若等 `update-end` 才生效,首次拖选后播放键拿不到切片起点、从 0 播;`update-end`(拖动/resize 结束)是改界后的再回写点。双击 region = 移除切片与持久化(触控端 iOS Safari 不触发原生 dblclick,页面另挂 pointer 双击检测,双方经切片状态护栏幂等)。
- **波形缩放(决策 A13,v2.1)**:渲染仍全走内建管线,缩放 = 官方 ZoomPlugin(波形上滚轮/双指捏合,指针锚定)+ 页面步进控件 `－ / 倍率 / ＋`(倍率钮即适应窗口复位)。细则:
  - 步进以「适应窗口宽度」(`containerWidth / duration` px/s)为基准逐级 ×2 / ÷2,钳到 `ZOOM_MAX_PX_PER_SEC = 2000`(1px ≈ 0.5ms,足够精准定位切片边界);阶梯纯函数 `zoomInPx` / `zoomOutPx` / `zoomPercent` 收在 sliceUtils(可单测),控件只做 DOM 接线;
  - 控件与滚轮/捏合共享单一事实来源 `ws.zoom(minPxPerSec)`(核心广播 `zoom` 事件),页面不持第二份缩放状态;适应宽度不可得(容器 0 宽/无时长)时步进不动作;
  - 缩放后内建管线自动重渲染(多 canvas 分片 + wrapper 滚动),region 按时间百分比定位天然跟随;播放中 `autoScroll` 保持播放头可见(默认开;切片域的开关闭合规则见 A14);
  - `minPxPerSec` 落在核心 options 与 ZoomPlugin `maxZoom`,两处共用同一常量。
- **播放头自动跟随(决策 A14,v2.2)**:存在切片即 `ws.setOptions({ autoScroll: false })`,无切片的全曲顺序播放保留官方默认跟随。切片循环把播放头锁在切片内,放任 autoScroll 会在放大到切片宽于视口时每次循环回卷都把视口猛拉一次,且与用户手动平移(触控板横扫/横向滚轮——ZoomPlugin 只拦 deltaY 主导的滚轮,deltaX 主导穿透为原生横向滚动)形成拉锯,拖 region 把手微调同理;关闭后视图完全由用户掌控(缩放 A13/原生平移/点选定位)。同步点收在切片状态唯一变更口 `updateSlice`,region 替换/恢复/移除各路径自然收敛。
- **进度高亮域(决策 A15,v2.3;已播段补强 v2.5)**:内置双层进度的下层恒从 0 画到播放头、无空间裁剪能力——存在切片时进度层退化为波形色(`progressColor = waveColor`,视觉关闭),高亮只来自切片 region 覆盖层 + 金色播放头;无切片恢复朱砂双层进度。配色与 A14 同口同步(`updateSlice` 与主题切换 effect 共用 `waveColors(sliceActive)`)。切片内「已播/未播」明暗区分由**第二 RegionsPlugin 实例**驱动一条 `[切片起点, min(播放头, 切片终点)]` 的深朱砂 region(v2.5 落地,原记 §8 候选):`timeupdate` 逐帧 `setOptions({ start, end })`,setTime/点击定位也广播 timeupdate 故暂停态即时;播放头 ≤ 切片起点即整条移除,切片改界/移除经 `updateSlice` 单一变更口重算;region 元素 `pointerEvents: none` 不挡切片拖移与把手,第二实例只挂 region、页面不订阅其事件——与切片约束/循环判定天然隔离;主题切换 effect 同步重读两层 region 配色。
- **音频持久化与多音频库(决策 A16,v2.4)**:IndexedDB `audioFiles`(ArrayBuffer,tech.md §7)存全量音频历史;启动恢复最新一条 + 该音频的切片与空拍(`note-slice-audio-gap` 全局共享)。切片键按音频归属 `note-slice-audio-slice:<id>`——多音频各持切片互不覆盖,切回即恢复(练习多首乐曲免重拉切片);切换音频(导入替换/库点选)只换 UI 状态、不动旧音频的键,新实例 ready 后读自己的键,「不继承旧切片」由归属天然保证;库内删除条目连其切片键一并清除;旧全局键 `note-slice-audio-slice`(v2.3 及前)无归属信息,启动恢复读取时迁移到被恢复音频名下后删除。
- 导入校验:MIME 白名单 + 解码(wavesurfer `error` 事件)双重校验;失败提示走 i18n。入口三条:文件选择器(`multiple` 多选)、**页面级拖放**(FileLoaderModal 同款 `data-drag-active` 高亮约定)与**音频库弹窗**(AudioLibraryModal,FileLoaderModal 同构:拖放区 + 最近音频列表 + Esc/遮罩关闭,空态另有「最近音频」直接陈列)——三条入口复用同一校验管线;多选/多文件投放逐个过白名单与转存,非法文件跳过并报 `errorUnsupportedAudio`,全部合法文件入库,活动音频取最后一个合法文件(其 `uploadedAt` 最新,与库列表 uploadedAt 降序头部一致);已装载态投放/切换即替换当前音频(切片归属见 A16)。

### 5.2 切片循环 + 空拍(决策 A5,v2 变更)

**v1(旧实现)做法废弃**:手写 `timeupdate` 边界检测(播到 `slice.endTime` 即 pause + setTimeout 回卷)。wavesurfer 官方文档明确建议边界检测交给插件(region-in/out,新版内置 0.05s 容差防抖动);自写检测需自行处理容差、拖动期间误判等全部边界,且 7.8.x 前后正是这类问题的高发区(§9.5)。

v2 循环驱动(对齐官方示例写法):

```
region-out(且 region === 当前切片):
  空拍等待中 → 忽略(重入护栏)
  ws.pause()
  setTimeout(beatsToSeconds(gapBeats, tempo) × 1000):
    ws.setTime(slice.startTime); ws.play()        // 空拍 0 拍 = setTimeout(0) 立即回卷
播放键:有切片 → 从切片起点播;无切片 → 全曲顺序
拖动/resize 进行中(region-update…update-end)→ 暂停循环判定,松手恢复
```

- 间隔用 setTimeout 是同类项目的**事实标准**(LoopMate 等同构,§9.5):间隔通常 <30s 且循环持续出声,不受 Chrome 隐藏页密集节流影响;无人采用静音 buffer 占位等更重机制,我们不必发明。
- **后台标签页**:WebAudio 后端的 timeupdate/region-out 挂在 rAF,后台 rAF 停摆 → 事件不触发、音频越过切片尾继续放。约束:`visibilitychange` 隐藏即暂停循环(最小正确解);真后台循环需求出现时再评估 AudioContext 时钟预排(§8 后续候选)。
- 版本约束:保持 `wavesurfer.js ^7.12`(含 region 边界 0.05s 容差修复 PR #4359,避开 7.8.x 事件回归期)。

### 5.3 sliceUtils(纯函数,单一钳制入口)

`buildAudioLoopPlan(startTime, endTime, gapSeconds, bufferDuration) → AudioLoopPlan`:

- 字段:`offset` / `duration` / `cycleDuration = duration + max(0, gapSeconds)` / `loop`;
- 起止乱序先换位;钳制 `0 ≤ start ≤ end ≤ bufferDuration`;
- `duration < 0.05s`(MIN_SLICE_SECONDS)→ `loop: false`,拒绝循环(F10 规则)。

UI 与播放共用此函数,保证「显示的切片」与「循环的切片」永远一致;`formatTime`(m:ss)一并在此。已有单测,重写保留。

---

## 6. 工程约束清单(音频域硬规则)

1. `Tone.start()` 必须在用户手势内(播放按钮/空格)调用,先于任何调度;被拒即放弃本次播放。
2. 全停顺序固定:清 pending tick → `sampler.releaseAll()` → 时钟 pause+reset;三步连续,禁止只停不清(自调度 tick 会复活引擎)(§3.3/§3.1)。
3. BPM 唯一入口 `engine.setBpm`(锚点重锚定,即时生效不停止);禁止绕过引擎直改时钟/数据内部状态(§3.5)。
4. 一切拍 ↔ 秒换算走 TempoConverter;空拍秒数现算、不缓存(§3.4)。
5. 乐器切换只在停止态(§3.6);Tone 大版本升级需回归验证 tonejs-instrument 包兼容(§4)。
6. Draw 过期事件不补发;光标/进度恢复一律从时钟重推导(§3.1/§3.8)。
7. wavesurfer:渲染走内建 canvas 管线,不自绘、不引 peaks 预载;addRegion 在 `ready` 后;页面隐藏暂停循环;版本 ≥ 7.12(§5.1/§5.2)。
8. 离开乐谱页(路由卸载)必须 stop 引擎(tech.md §2.3)。
9. RealValue 域时间比较统一带容差 1e-4(定位端点、loop 端点、窗口边界);when 换算 round 整毫秒;禁止裸浮点比较(§2.5,A10)。
10. 引擎不设隐式出声总闸;出声相关开关一律显式字段,新增开关的默认值先写进决策记录(§3.9,A11)。

---

## 7. 测试策略(音频域)

| 层 | 对象 | 要点 |
| --- | --- | --- |
| 纯函数 | `TempoConverter` | rv/拍换算边界(0、附点、beatValue ≠ 4) |
| 纯函数 | `buildPlaybackData`(mock cursor) | 计数规则:休止符占位递增、tie 合并、装饰音跳过;`startRv` = 光标绝对时间戳(非累计,规则 3);倚音发声/装饰音展开(规则 8/9,grace VE 与 OrnamentContainer 替身);终点 `endRv`(§2.2-7);移调折算(规则 10,A18):transposeByMeasure 平移主音/倚音/邻音、表长不足回落 0、缺省原样;**同一数据对任意 BPM 断言不变**(乐谱时域,§2.2-6);另设真实 OSMD 集成回归(marks-tie/marks-grace/marks-mordent/marks-trill 装载即断言,防 mock 与真实光标语义脱钩;连音符 transpose −5/−9 折算端到端:记谱 B4 → 发声 D4,索引/时间不变) |
| 纯函数 | `ornaments.ts`(切片/倚音安放) | 七种装饰音切片时长与顺序、切片总时值守恒、倚音空闲前移/挤占主音/钳半/丢弃四路径(A17,§2.2-8/9) |
| 纯函数 | `TimingSource`(fake 时钟) | 锚点模型、`setBpm` 重锚定不跳时刻、等待毫秒 round、pause/reset 冻结语义(§3.9) |
| 引擎 | `PlaybackEngine`(fake TimingSource + fake Sampler) | 窗口查询与端点容差(§2.5)、窗口右端钳到 endRv(§3.4)、空拍回跳时序、自动停止哨兵、播放中 `setBpm`、`resetOccurred` 广播(§3.8) |
| 纯函数 | `sliceUtils` | 换位/钳制/过短拒绝/gap(已有用例,保留) |
| 手动 | 样例谱 | `刻在我心底的名字.musicxml`(73 小节 462 步)、`musicxml/连音符.musicxml`、`public/twinkle-twinkle-little-star.musicxml`;过 F5–F9 |
| 手动 | spike 复验 | V6–V10 结论作回归基线(V8 的 Transport 验证保留为历史结论与 headless 装置依据);官方播放器行为参数对照源 = `spike/sponsors-demo-extract/rea/REA-ANALYSIS.md` |
| 手动 | 原曲页 | 导入 mp3/wav/ogg/m4a、波形柱状渲染与双层进度配色、窗口缩放后自动重绘、拖选/拖动/双击移除、空拍 0–8 拍、后台 tab 暂停行为;过 F10 |

---

## 8. 决策记录

| # | 决策 | 理由(调研依据见 §9) |
| --- | --- | --- |
| A1 | (v2.0 推翻重写)调度 = 引擎内自调度 look-ahead tick,参数照抄官方:100ms 窗口、≤50ms 收敛、整毫秒 when | Transport + Part 要求绝对秒冻结时间轴,是 buildTimeline 与「BPM 全停重建」的根因;官方逆向规格(§3.1/§3.2)已把该路线全部参数与坑定死,照抄生产验证的行为规格 ≠ osmd-audio-player 式从零自研;换得即时变速/真暂停/可注入时钟(§3.1) |
| A2 | (v2.0 推翻重写)BPM 变更即时重锚定,不停止、零重建 | 官方 `bpmChanged`/`setBpm` 同款(官方规格 §3.6/§3.9);乐谱时域数据 + 锚点时钟下变速天然免重建;旧「全停重建、禁 rampTo」随绝对秒时间轴废弃(§3.5) |
| A3 | 空拍以拍为单位定义,播放时现算秒 | 随 BPM 自然缩放,两页共享同一换算;alphaTab「速度只是播放系数」同思路 |
| A4 | (v2.0 表述更新)空拍 = 循环回跳前的 setTimeout 无事件等待(官方 LoopPauseMs 同构),不调度静音音符 | 机制从 Part.loopEnd 改为引擎状态机,「零额外事件」原则不变(§3.4) |
| A5 | 原曲页循环驱动用 region-out(废弃 v1 手写 timeupdate 检测) | 官方文档建议边界交给插件(内置 0.05s 容差);官方示例即此写法 |
| A6 | 采样包不用 minify;全量采样 + Vite 打包 + PWA 缓存 | 9 音 repitch 音质差;静态自托管防 CDN 失效(同类项目均自托管音源) |
| A7 | (v2.0 微调)引擎事件仍只有 iteration / state-change 两级;iteration 携带 resetOccurred,进度由时钟直读 | osmd-audio-player 同构验证够用;显式回卷标志消除时间比较(官方 ResetOccurred 同构);时钟直读消灭二分(§3.8) |
| A8 | (v2.0 乐谱页半句更新)乐谱页调度 tick 为 setTimeout:发声页豁免 Chrome 密集节流,窗口内已排采样由 AudioContext 精确触发;长静音段(全休止)存在节流断流风险——官方同为 setTimeout 方案、承受同一特性,实测出现时以静音保活节点兜底(候选);Draw 过期即弃;原曲页 visibilitychange 暂停 | 依据同 v1(Chrome 88 节流规则,§9.3);官方架构同款实证 |
| A9 | mp3 波形用 wavesurfer 内建 canvas 管线渲染,不自绘、不引 peaks 预载 | v7 内建 HiDPI/resize 重绘/长音频懒渲染/双层进度遮罩;本地文件全量解码不可避免,peaks 预载只服务网络流场景(§5.1) |
| A10 | (v2.0 适用点更新)RealValue 域比较统一带容差 1e-4(定位端点/loop 端点/窗口边界);when 换算 round 整毫秒;禁止裸浮点比较 | 官方以「1/1024 网格 + Fraction 容差 1e-4」保证 closestNextTimestamp 比较稳定(官方规格 §3.9);v2 无秒域比较场景,毫秒只在换算边界出现(§2.5) |
| A11 | 引擎不设隐式出声总闸;出声开关一律显式字段,默认值先写决策记录 | 官方 `DoPlayback` 隐式总闸是反例(新实例默认不出声,demo 由 premium 显式打开,无声故障难排查,官方规格 §4/§5-10);官方默认 `DoPreCount=false` 同时记为 v2 count-in 默认关的依据(§3.9) |
| A12 | (v2.0 新增)架构对齐官方播放器:播放数据存乐谱时域(构建与 BPM 解耦)+ 可注入锚点时钟 + 引擎内 look-ahead 调度与循环状态机;废弃 buildTimeline 绝对秒时间轴与 Tone.Transport + Part | 决策「参考 osmd-player 实现」(2026-10-18);官方为唯一逆向到行为参数级的参照(REA);一次换型解锁即时变速(A2)、真暂停(G1)、离线导出(G13);Transport 的网格对齐能力对拍点调度不再必要——节拍器与音符同处乐谱时域(§3.7) |
| A13 | (v2.1 新增)波形缩放 = 官方 ZoomPlugin(滚轮/双指捏合,指针锚定)+ 步进控件(适应窗口宽度为基准 ×2/÷2,钳到 2000px/s),两路共用 `ws.zoom()` 单一事实来源;不自研滚轮换算、不自绘缩放 | 服务 F10 精准定位切片边界(用户需求「波形可缩放」);官方插件即 wavesurfer 示例同款,内建多 canvas 分片/滚动/autoScroll/自动重绘全保留;阶梯换算收 sliceUtils 纯函数(可单测);上限 2000px/s ≈ 0.5ms/px(§5.1) |
| A14 | (v2.2 新增)播放头自动跟随按切片域开闭:存在切片即 `autoScroll: false`(视图由用户掌控),无切片全曲播放保留官方默认;同步点收在 `updateSlice` 单一变更口 | 切片循环把播放头锁在切片内,官方默认 autoScroll(播放头出视口即瞬移滚动容器)在放大到切片宽于视口时每次回卷猛拉视口,播放中手动平移(deltaX 主导滚轮不被 ZoomPlugin 拦截,走原生滚动)即被拉回形成拉锯;无切片长音频仍需跟随防播放头出屏(§5.1) |
| A15 | (v2.3 新增)进度高亮域:存在切片即 `progressColor = waveColor`(内置进度层视觉关闭),高亮只来自切片 region 覆盖层;无切片保留朱砂双层进度;配色与 A14 同口(`updateSlice`/主题 effect 共用 `waveColors(sliceActive)`)。v2.5 补强:切片内已播段由第二 RegionsPlugin 实例驱动深朱砂 region(`[起点, min(播放头, 终点)]`,timeupdate 跟随、pointerEvents:none) | 内置进度层恒从 0 画到播放头,无法裁剪进切片——切片循环下 [0, 切片起点] 恒被涂成朱砂且回卷不清除,与「只有选区内容高亮」直接冲突;裁剪需 renderFunction 自绘,成本不成比例;切片内明暗区分用第二实例已播段 region 补强落地(v2.5,§5.1)——第二实例事件总线与切片约束天然隔离,不碰循环判定 |
| A16 | (v2.4 新增)多音频库:IndexedDB `audioFiles` 即库,文件选择器/拖放/音频库弹窗三条入口共用同一校验管线,多选逐个入库(活动音频取最后一个合法文件);切片持久化键按音频归属 `note-slice-audio-slice:<id>`,切换不落盘、切回即恢复,旧全局键启动迁移 | 用户需求「导入多个音频进行练习」;全局单键在多音频下会把 A 曲切片套在 B 曲上(时长可容纳即错恢复),按 id 归属一次性消除该类串扰并免除「替换音频先清切片」特例;活动音频取最后与库列表 uploadedAt 降序头部一致(§5.1) |
| A17 | (v2.7 新增)装饰音域自研(官方播放器不消费装饰音,`VoiceEntry.createVoiceEntriesForOrnament` 为 OSMD 暴露但无人调用的接口):倚音发声(挤压式插在前一发音与主音之间,空闲不足挤占主音头部,总时值钳主音一半)+ 波音/颤音/回音按 OSMD 切片语义展开为子条目(§2.2-8/9);子条目共享主音 noteIndex,选择域按组跨度解析(selection.ts `resolveEndpoint`),`occupiesPlaybackSlot` 计数硬约束不动;波音方向按 MusicXML 标准语义(mordent=下邻音)——OSMD 枚举实现方向相反(其 VexFlow 字形映射也互换,音画同时反向一致),偏离点记此;邻音音级 ±1、变化音取当前小节调号(`CurrentMeasure.getKeyInstruction(0)`),八度从 halfTone 推导(OSMD `Pitch.Octave` 是内部相对八度 C5 返 2,直用低三度,实测踩坑);OSMD Note 不暴露倚音 slash,长/短倚音 v1 统一挤压式(细化候选 §8) | 用户实测反馈「Grace/Mordent/Trill fixture 倚音没声音、颤音没实现」(2026-10-18);切片语义照抄 OSMD 官方实现(逆向对照,颤音 8 等分、回音 4 等分、延滞回音前半主音后半图形)是唯一有出处的行为规格;不展开 = 练习播放器缺装饰音听感,展开层在播放数据纯函数域、引擎零改动 |
| A18 | (v2.9 新增)移调乐器谱播放折算:`buildPlaybackData` 增 `transposeByMeasure` 逐小节半音表,noteName(主音/倚音/装饰音邻音)按小节统一平移到实际发声音高;声明/继承/半音折算规则归 musicxml.md M11(`ParsedScore.transpose`),接线 ScorePage → OsmdNotation prop | 用户实测反馈「中音萨克斯谱播放整曲偏高」(2026-11-02):移调记谱直接按记谱播 = 高大六度,练习者无法对照乐器;OSMD 解析器不读 transpose 元素(实测),光标 halfTone 恒记谱音高,折算只能落在播放数据构建层;只动 noteName 不动 noteIndex/时间戳——选择/光标域零波及;邻音在记谱域解析音程再整体平移,颤音/波音音程结构保持;「记谱/实际音高切换 UI」不在 v2(musicxml.md §9 候选) |

**后续候选(不在 v2 范围,记录调研到的实现路径;官方行为参数对照源 = 官方规格 §3,坐标可对照验证)**:

- count-in 预备拍:负时间轴在 v2 时钟下是原生操作——`setTimestampAndBpm(起点 − 预备拍时值, bpm)` 锚点直设(官方 `setTimeAndBpm` 同款);预备拍时值 = 拍号分子 × measures / 拍号分母;中途起播向前伸出谱头按差距收缩(差距占比 <50% 延伸、否则直接对齐谱头);预备拍段节拍器用独立 `PreCountVolume`(未单设继承主音量);「循环回跳是否带预备拍」独立开关(默认关,官方规格 §3.4);
- 真暂停/续播(G1,升为最优先候选):零漂移路径已内置于 v2.0 时钟——pause = 挂起(同时冻结已排采样与时间轴,§3.9),续播 = 恢复;只差 UI 与状态机(官方规格 §3.9/§5-6);
- 力度记号影响音量(官方规格 §3.7,全链已验证):`finalV = (v − default) × impactFactor + default`;归一化分母 = **全谱最大 note Velocity** 而非固定 127(无任何力度记号的谱子 reference = 0,力度链整体旁路);可选感知曲线 `gain = 10^((v−1) × rangeDb / 20)`;velocity 只来自力度记号标注(`DynamicsVolume/100×90`)。v2 当前固定 velocity 0.7;引入时 impactFactor 需自定默认(官方实现 0.6 但未暴露 UI);
- 循环 BPM 递增(G3):v2 下 = 每次回跳 `setBpm(min(当前BPM + 增量, 上限BPM))`,零重建(官方经临时覆盖全部小节 tempo + `IgnoreTempoInstructions` 实现,官方规格 §3.3;上下限与增量齐备才启用);
- 延音记号(fermata)表情放慢(G5,官方规格 §3.6):保持期 `setBpm(preFermataBpm × FermataSlowdownFactor)`、保持时长 = 该处最长音符时值、到点恢复;局部变速成本已降,仍候选;
- 变拍号谱(中途换号):节拍器改官方做法——每 tick 由小节内相对位置重推 beatCounter(官方规格 §3.2-3);单声部旋律谱暂无需求;
- 装饰音偷时值:官方完整规则(前装饰音按比例切前一同音高音符尾/挤占主音头 + 间隙参数,官方规格 §3.10);v2 装饰音整体跳过,引入时照抄;
- 离线导出(G13,官方规格 §3.12,方案可整段对照):时钟已可注入(A12)——`CaptureTimingSource`(纯虚拟时钟)+ 捕获式播放器只记录 `{when, channel, key, volume, duration}`,再手工逐参数复刻采样包络合成波形(10ms 线性 attack、sustain 0.9、指数 decay/release τ=ln1.1/ln100 与 ln1.3/ln100、0.3s 释放尾;增益链与实播一致 → 导出波形 = 实听);
- 原曲页保调变速:WebAudio 后端 `setPlaybackRate` 是纯重采样会变调;保调需 mediaElement + `preservesPitch`(或 SoundTouchJS);
- 原曲页真后台循环:AudioContext 时钟预排替代 setTimeout。

(A15 的「切片内已播/未播明暗区分」候选已于 v2.5 落地,从清单移除——实现即原候选路径:第二 RegionsPlugin 实例 + 已播段 region,见 §5.1 进度高亮域。)

(v1 的「播放区间以 tick/拍存储」候选已随 A12 落地——LoopRange 即乐谱时域,从清单移除。)

---

## 9. 同类实现调研摘要(2026-10-17,成文前调研)

### 9.1 乐谱播放器

| 项目 | 调度/时钟 | 光标同步 | 播放中变速 | 循环/区间 | 节拍器/count-in |
| --- | --- | --- | --- | --- | --- |
| [osmd-audio-player](https://github.com/jimutt/osmd-audio-player)(jimutt,停维) | 自研 setInterval(200ms)+ 500ms lookahead;soundfont-player 按音频时钟触发 | UI 线程 setTimeout,−35ms 提前量 | 即时改 tick 时长,已排事件不重排 → 短暂错位 | 无(roadmap 未做) | 无 |
| [alphaTab](https://alphatab.net/docs/reference/api)(CoderLine) | worker pull 型合成;**消费采样数即时钟** | tick→beat 查表;beat 去重;事件按实际播出释放 | playbackSpeed 只是播放系数,**零重建** | playbackRange 以 tick 存 | 节拍器混入主事件流同网格;count-in 数到起拍 |
| [abcjs](https://github.com/paulrosen/abcjs)(Paul Rosen) | 整曲预渲染 AudioBuffer,播放期零调度 | performance.now + rAF(+setTimeout 后备) | warp = 全量重渲染 buffer | 整曲 toggleLoop | drumIntro 渲染进同一 buffer |
| **OSMD 官方 audio player**(sponsors-ts-demo,闭源,**编译产物已逆向**) | 迭代器 + 自调度 setTimeout tick;LinearTimingSource = 挂起的 AudioContext.currentTime 锚点时钟;look-ahead 窗口 100ms + 采样精确 when | 光标即播放监听者(`CursorPosChangedData` 完整载荷);拍点到期才推进 | `bpmChanged` 即时换速;循环 BPM 递增走临时覆盖小节 tempo | 引擎内状态机:次数/`LoopPauseMs`/BPM 递增;回跳走 pre-count、`keepNotes` 防炸音 | 节拍器走音源通道 ch9;pre-count 负时间轴;`DoPlayback` 隐式总闸(demo 显式开) |

OSMD 开源 demo 本身无音频播放(仅手动光标);官方播放器是 sponsors 早期访问版、源码闭源,但其编译产物已提取并经静态语义逆向为**带代码坐标的行为规格**(2026-10-17,[spike/sponsors-demo-extract/rea/REA-ANALYSIS.md](../spike/sponsors-demo-extract/rea/REA-ANALYSIS.md))——本文各处「官方规格」即指此文,行为结论可按行号对照验证;专有代码只作行为参考,不得拷入仓库。

### 9.2 音频切片循环(原曲页同类)

| 项目 | 循环驱动 | 空拍/间隔 | 变速 |
| --- | --- | --- | --- |
| [wavesurfer 官方示例](https://wavesurfer.xyz/examples/?regions.js) | region-out → region.play(true) | — | setPlaybackRate(WebAudio 后端,变调) |
| [LoopMate / ModernABLoopPlayer](https://github.com/mxggle/ModernABLoopPlayer)(语言学习/扒谱) | MediaElement timeupdate + 5ms 容差 | loopDelay = 间隔秒(setTimeout);isDelaying 防状态翻转 | playbackRate 保调(preservesPitch) |

wavesurfer 历史坑(v7 时代,均与 region 边界/循环相关):#3631/#3658/#3781(边界抖动、in/out 连发)、#3866(mediaElement 下 region.play 误触发 out)——由 [PR #4359](https://github.com/katspaugh/wavesurfer.js/pull/4359)(0.05s 容差)修复,故有 §5.2 版本约束。`region.play()` 播完不停(传 `true` 才在端点停),v7 无内置 loop/`playLoop()`,循环必须自搭。

### 9.3 调度理论

Web Audio 双时钟模型(主线程定时器 vs 音频时钟 + lookahead 排队)是上述所有实现的共同底座:[A Tale of Two Clocks](https://www.html5rocks.com/en/tutorials/audio/scheduling/);Chrome 隐藏页定时器节流规则(发声页豁免、静音页密集节流至每分钟 1 次):[timer throttling in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)。

### 9.4 Tone.js 用法核实(官方文档 + 维护者 issue;v2.0 起调度不用 Transport,本节保留为调研记录与 §9.5-1 依据)

- Transport 回调的 `time` 是事件将发生的 AudioContext 时间,须传给发声对象;回调提前触发、不与动画帧对齐 → UI 必须 `Draw.schedule`(rAF 对齐,过期 250ms 丢弃不补发)。lookAhead 是 Context 级属性(默认 0.1s)。Draw.schedule 的用法 v2.0 仍然依赖(§3.1/§3.8)。
- `Transport.cancel(after)` 按时间清、`Transport.clear(id)` 按 id 清、`Part.cancel` 只清 start/stop 状态——三者语义不同,cancel 不撤销已提交音频(v1 §3.3 依据;v2.0 不再使用)。
- bpm 是 TickParam:一切已排事件以 ticks 存储,`bpm.value` 变更框架原生重排([#962](https://github.com/Tonejs/Tone.js/issues/962) 维护者确认);但 bpm 自动化走 AudioContext 时钟([#1194](https://github.com/Tonejs/Tone.js/issues/1194)),且存在变速后调度异常报告([#1306](https://github.com/Tonejs/Tone.js/issues/1306))——v1 A2 的依据,v2.0 不再相关。
- Sampler:采样自动 repitch 覆盖空隙(越稀疏音质越差)、`release` 为官方暴露属性、`triggerAttackRelease` 的 duration 为保持秒数,超采样自然长度即自然截止;`releaseAll` 可立即释放全部发声(v2.0 停止路径依赖,§3.3)。
- `Tone.start()` = resume AudioContext,必须在用户手势内(官方引用浏览器自动播放策略)。
- tonejs-instrument 包族:源流 [nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) → [Makefully-Studios](https://github.com/Makefully-Studios/tonejs-instruments) 打包;`class extends Sampler`、无 release、minify = 9 音 repitch、peerDeps 仅 `tone ^14.7.77`(§4 依据)。更重的官方替代 @tonejs/piano(多力度层 Salamander)当前不必引入。

### 9.5 结论(去向见 §8)

1. 采样触发(回调传 when)与 Draw.schedule(过期丢弃)与 Tone 官方文档/示例逐条一致,写死为规格;§9.4 的 Transport 条目保留为历史调研——v2.0 起调度不再依赖 Transport(A1/A12)。
2. 变速是所有同类项目的共同软肋(错位/重渲染/漂移);v2.0 走官方路线后变速即时零重建(A2),前提是播放数据存乐谱时域(A12)。
3. 原曲页 v1 的手写边界检测是官方明示不建议的做法,v2 改 region-out;后台 tab 的 rAF 停摆两类后端都存在,visibilitychange 暂停是最小正确解。
4. 「带空拍循环」在语言学习/扒谱工具中是成熟模式,事件 + setTimeout 是事实标准,无需发明更重机制。
5. 官方播放器逆向规格的地位随 v2.0 从「行为对照源」升级为「架构蓝本」:调度参数(100ms/50ms/整毫秒)、循环语义(引擎内状态机/窗口钳制/keepNotes 等价物)、时钟模型(锚点/同源/可注入)直接采用;A10(容差)/A11(无隐式总闸)与 §3.8 高亮不对称教训继续有效。

---

*本文为 tech.md 音频域拆分件;工程约定见根目录 [AGENTS.md](../AGENTS.md),冲突时以 AGENTS.md 为准。*
