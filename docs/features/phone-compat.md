# 手机端布局兼容规格（phone-compat）

| | |
| --- | --- |
| 版本 | v1.0（2026-11-09） |
| 状态 | 已实现（PRD G18） |
| 上游 | [tech.md](../tech.md) §2/§6、[selection.md](../selection.md) §4.2/§4.6–4.7、[prd.md](../prd.md) §7.2.2 G18 |
| 下游 | [test-cases.md](../test-cases.md)（TC-MOB / TC-MAN-05） |

目标：**360–430px 竖屏完整可用，横屏不破（不专项优化）**。触控**等价性**（Pointer Events、双指捏合、coarse 命中线）已由 G12 交付，本专项解决的是窄视口**布局**与单指手势归属。测试锚点：e2e `tests/e2e/phone.e2e.ts`（390×844，宽度布局层）；真机手感 TC-MAN-05。

## 1. 决策 P1–P12

### P1 断点与查询写法

- 手机断点 `@media (max-width: 639px)`，与既有 `min-width: 640px` 配对成套；iPad Mini 竖屏（744px）以上保持桌面/平板布局。
- 触屏专属件用嵌套单条件 `'@media (pointer: coarse)': { '@media (max-width: 639px)': { … } }`。
- **禁止把 StyleX 媒体键写成 `'a and b'` 复合查询**：StyleX 0.19.1 dev 运行时注入的去重键正则 `/^@(media|supports|container)\s*\([^)]+\)\s*{$/` 不匹配复合查询，回落为整条查询文本作键——同一复合查询下只有第一条规则被插入，其余在 dev 下**静默丢失**（2026-11-09 框选开关 `display` 规则实测丢失；生产构建静态抽取不受影响）。守卫：`tests/themes/stylexConventions.test.ts`。
- 无 JS 设备探测（全仓不出现 `matchMedia`/`innerWidth` 判断）；模式切换靠 CSS 门控 + 条件类。

### P2 乐谱区单指手势归属（→ selection.md §4.7）

手机触屏默认**滚动模式**：舞台 `touch-action: pan-x pan-y`（`stageScrollMode`，嵌套 coarse+窄屏门控），单指原生滚动（带惯性）、双指平移同理由浏览器接管；**不含 zoom 关键字**——双指捏合仍归 JS 管线（G12 §4.6），且 WebKit 在该面上不触发双击放大（双击设乐句不受影响，真机复核项 TC-MAN-05；若实测仍放大，兜底方案：舞台加非 passive `touchstart`，仅在 400ms 双击窗内第二 tap `preventDefault()`）。

舞台右上角浮动「框选」chip（`boxToggle`，挂在滚动容器外的包装盒 `stageWrap` 上，缩放平移谱面时它不随内容滚动；仅触屏窄屏可见，`aria-pressed`）：开启后舞台回到 `touch-action: none`，单指拖拽恢复空白框选（selection.md §4.2 原语义）。

实现要点：模式**只经 touch-action 生效，指针管线零分支**——滚动模式下浏览器判定为平移会发 `pointercancel`，管线按 S5 原样中止（jsdom 单测覆盖「cancel 后单击照常」）。框选边界把手元素自带 `touch-action: none`（命中链取交集，端点微调在两模式下都保住）。状态为会话态（与选择一样不持久化），`data-touch-mode` 属性供测试锚定。

### P3 弹层钳制

`src/hooks/usePopoverClamp.ts`：纯函数 `clampPopoverX(triggerRect, popWidth, viewportWidth, margin=8)` 计算 translateX 偏移（右对齐锚定，左溢右移 / 右溢左移 / 视口容不下则贴左边距），hook `usePopoverClamp(anchorRef, open, popWidth)` 开启时测量、resize 跟随。应用于 4 个弹层：皮肤（272）/ 语言（176）/ 乐器（176，menuPop 基线）/ 节拍器设置（248，向上弹出）。`menuPop`/`settingsPop` 补 `maxWidth: calc(100vw - 24px)`、`maxHeight: calc(100dvh - 140px)`、`overflowY: auto`（桌面无害——桌面本就放得下）。

### P4 安全区归位

顶部 inset 从 `App main.paddingTop` 移到 **Header 自身**（此前错位：页头贴顶却在下方 main 让 inset，刘海/灵动岛直接压页头）；左右 inset 由 `main` 统一让一次，各页滚动区只加自身内边距（此前 main + 页面双层 `max(16px, env())` 叠加，横屏刘海机型双倍留白）；底部 inset 归真正吸底的 StatusBar / 原曲页 scroller。弹窗遮罩四边补 `max(24px, env())`。

### P5 空拍选择器窄屏网格

≤639 独占控制条整行（`flex-basis: 100%`），网格化为「标签 · 状态」一行 + 8 键 `repeat(8, minmax(0, 1fr))` 等分一行（键宽随可用宽伸缩，360 视口亦不溢出）；触屏键高保持 36px。宽屏行为不变。

### P6 吸底两栏紧凑

控制条 ≤639：colGap 22→10、rowGap 12→8、sliderCell basis 300→240（速度+走带一行、节拍器一行、空拍整行）；状态栏收紧行距并隐藏 BPM cell（与紧贴其上的速度滑杆大字重复）；SelectionInfo 常规操作提示 ≤639 隐藏（窄屏折 3–4 行，且「空白拖拽框选」在滚动模式下不成立；无效选择反馈始终显示）。

### P7 弹窗可达

两个 Modal（FileLoader / AudioLibrary）：dialog `display: flex; flex-direction: column; maxHeight: 100%`（遮罩 padding 已限高），最近文件区为唯一可伸缩段（`minHeight: 0; overflowY: auto; overscroll-behavior: contain`），标题与关闭钮始终可达；overlay ≤639 padding 24→16；关闭钮 coarse 30→38px；页脚 Esc 键提示 `(pointer: coarse)` 隐藏（触屏走 ✕ / 点遮罩）。

### P8 原曲页

头部行允许换行（长文件名不再压没操作钮）；缩放 chip coarse 加高（~20→40px）；tempoCell ≤639 `order: -1` 提到首位与走带同排（与乐谱页控制条同序），空拍整行在下；controlsRow colGap 24→12；波形手势提示触屏常显（原 ≥1280 才显示，触屏手势无从悬停发现）。

### P9 乐谱卡让宽与谱内标题

scoreCard ≤639 paddingInline 28→14（390 视口下渲染宽 ≈300→328）；**OSMD 谱内自绘大标题窄屏关闭**（`OsmdRender.setDrawTitles`，跨 640 断点跟随重排）——卡片头部 ScoreInfo 已有同源标题，~330px 容器里 OSMD 大字号标题左右溢出被裁；页脚渲染器说明 ≤639 隐藏、允许换行。

### P10 补齐小命中面（coarse）

乐谱框选把手 13→22px（视觉竖条不变，对齐原曲页波形把手 14→22 先例）；节拍器开关钮、原曲页头部两个文字钮、弹窗关闭钮。乐谱页脚缩放钮沿用 G12 已有加高。

### P11 悬停门控

全部 `:hover`（StyleX 24 处 + index.css 波形把手）包进 `@media (hover: hover)`——iOS/触屏点按后 `:hover` 粘滞留残影。注意与 `:disabled` 的层叠：门控规则带双类特异性会压过原生 `:disabled`，禁用态改用 JS 条件样式（`chipDisabled`，2026-11-09 编译实测）。守卫：`tests/themes/stylexConventions.test.ts` 源码扫描。

### P12 旋转重排

OSMD 舞台 grid 列轨显式 `minmax(0, 1fr)`：auto 列的最小贡献是 SVG 固定像素宽，视口变窄后列宽卡在旧宽、ResizeObserver 永不触发（旋转/缩窗后谱面不重排）。e2e 覆盖 390→1000→390 的伸缩重排。

## 2. 已知限制

- **apple-touch-icon 不提供**：iOS 不支持 SVG 触屏图标，PNG 需光栅化依赖；「加到主屏幕」以截图回落。后续如引入 PNG 构建产物再补。
- 手机横屏（如 844×390）走桌面布局：不破（无横向溢出、弹窗可达），不做专项优化。
- e2e 引擎无法仿真 `pointer`/`hover` 媒体（`WebOptions` 仅 colorScheme/reducedMotion），coarse 专属规则只在单测（类接线断言）与真机手测（TC-MAN-05）层验证。
- StyleX dev 运行时复合查询丢规则缺陷（P1）是上游 bug，生产构建不受影响；守卫测试防回归，若 StyleX 修复可移除该约定。

## 3. 变更记录

- v1.0（2026-11-09）：首次成文，P1–P12 随实现定稿；PRD G18 / L5 更新；selection.md §4.7 单指手势归属；test-cases TC-MOB-* / TC-MAN-05 / 盲区注销。
