# 功能规格：拖拽多行框选（二期）

**状态**：已落地（2026-10-18，随选择域 P2 提前实现；用户指定批次）。实现落点与行为以本文 §3–§5、§7 为准，实现细则见 [selection.md](../selection.md) §3.4/§4.2（决策 S9/S10）
**效力**：§3–§5、§7 为行为规格（权威）；§6 为实现指引，落地时按 tech.md §2/§6 架构执行
**沿革**：v1 原稿针对 VexFlow 自渲染原型撰写（Canvas 固定行布局，含约 600 行原型代码）。2026-10-17 文档重组时移除过时代码、按 v2 架构改写；v1 原稿见 git 历史（`git log --follow docs/features/text-selection.md`）。

---

## 1. 概述

实现类似文本编辑器的拖拽选择体验：用户在五线谱上按下并拖拽，跨行连续选中一段音符区间，用于圈定练习范围。它是现有选择模型（单击 = 小节、双击两点 = 乐句，tech.md §6.2 / [selection.md](../selection.md) §4）之外的第三种输入方式，产物同样是 `LoopRange`。

## 2. 命名映射（v1 → v2）

v1 原稿使用的历史命名在 v2 架构中的对应：

| v1 原稿 | v2 架构 | 说明 |
| --- | --- | --- |
| `NotationDisplay.tsx` | `src/components/OsmdNotation.tsx` | 乐谱渲染容器 |
| `vexflowHelpers.ts` | `src/utils/notation/layout.ts` | 行/坐标几何工具 |
| `useNoteSelection` hook | `src/utils/notation/selection.ts`（+ `usePlayback`） | 选择状态与范围计算 |
| `RowConfig`（固定每行 5 小节） | `RowGeometry`（由 OSMD 实际换行推导） | v2 不自定布局，行边界来自渲染结果 |
| `SelectionCanvas` / `SelectionOverlay` | 覆盖层组件（`PhraseMarkers` 同款叠加模式） | 叠加层绘制高亮，不重渲染乐谱 |
| `IndicatorCanvas` | OSMD 播放光标（tech §5） | v1 的播放指示器需求已被光标方案取代 |

## 3. 交互设计

### 3.1 交互状态机

```
┌─────────────┐
│    空闲      │ ←─────────────────────────────┐
└──────┬──────┘                              │
       │ 指针按下 (非音符/非句柄区域)           │
       ▼                                    │
┌─────────────┐                              │
│  范围选择中  │ ←──────────────────────┐     │
└──────┬──────┘                           │     │
       │ 指针移动                          │     │
       │    │                              │     │
       │    ▼                              │     │
       │  ┌─────────────────┐              │     │
       │  │ 检测跨行换行     │ ←───────────┘     │
       │  │ 更新选择区域     │                  │
       │  └─────────────────┘                  │
       │         │                             │
       └─────────┴─────────────────────────────┘
                │ 指针抬起
                ▼
         ┌─────────────┐
         │  选择完成    │
         │ 选中范围内音符 │
         └─────────────┘
```

### 3.2 拖拽选择行为

| 场景 | 行为 |
|------|------|
| 起始行内拖拽 | 正常 X 轴范围选择 |
| 拖到行尾继续向右 | 自动扩展到下一行的起始位置 |
| 跨行连续选择 | 每行都高亮选中，形成连续选择块 |
| 反向拖拽 | 自动调整选择起点与终点 |
| 拖拽到上一行 | 自动收缩/扩展到上一行 |

### 3.3 选择效果示例

```
  ┌─────────────────────────────────────────────┐
行1 │ A A A │ # # # # │                           │  ← 选中前3个音符
  │       │         │                           │
  ├───────┼─────────┼───────────────────────────┤  ← 行间隔（换行处）
行2 │ # # │ A A A A A                           │  ← 跳过2个音符，选中后5个
  │       │                                     │
  └─────────────────────────────────────────────┘

  选中音符: (0,0)-(0,2), (1,2)-(1,6)
  选择范围: 跨行 2 行，9 个音符
```

**效果说明：**
- `A` = 已选中 (highlighted)
- `#` = 未选中
- `│` = 选择边界竖线（可拖拽调整）
- 跨行时选择区域保持视觉连续性

### 3.4 与现有选择模型的共存（对 [selection.md](../selection.md) §4 的扩充）

- 在音符上按下 = 既有单击语义（选小节；300ms 窗口内二次按下 = 双击乐句起点），不进入框选；
- 在空白区域按下并拖动 = 框选；按下后未拖动（位移低于阈值）即抬起 = 不产生选择；
- 框选完成即替换当前选择（与单击/双击一致：最新一次交互定义当前 `LoopRange`），边界句柄可拖拽微调。

### 3.5 键盘组合键

| 按键 | 行为 |
|------|------|
| Shift + 拖拽 | 扩展现有选择（add 模式） |
| Ctrl/Cmd + 拖拽 | 切换选择（toggle 模式） |

> 落地语义（2026-10-18，selection.md 决策 S10）：选择产物是单区间 `LoopRange`（tech.md §3），
> toggle 在该模型下近似为——框选与现有选择**重叠**则裁剪（取较长剩余段，全消则清除），
> **不重叠**则并入扩展。完整多区间 toggle 需要选择状态支持区间集合，暂不引入。

## 4. 数据结构（v2 适配）

选择的**事实来源是全曲连续音符索引区间**（与 tech §3 `PlaybackEntry.noteIndex` 同源；命中层按 [selection.md](../selection.md) §2.1 同时维护 graphicIndex——高亮切片用——与 noteIndex——持久化与播放用）；跨行高亮矩形是派生的显示产物，不是持久化状态。以下为建议签名，落地时可调整：

```typescript
// selection.ts —— 框选结果
interface DragSelection {
  startIndex: number;    // 全曲连续 noteIndex（含休止占位；遍历序同 audio.md §2.2）
  endIndex: number;
}

// layout.ts —— 行几何（由 OSMD 渲染结果推导，取代 v1 的固定每行 5 小节）
interface RowGeometry {
  rowIndex: number;
  startMeasure: number;
  endMeasure: number;
  y: number;             // 行外接框（容器坐标）
  height: number;
}

// 派生产物 —— 每行高亮矩形（供覆盖层渲染）
interface RowHighlightRect {
  rowIndex: number;
  x1: number; x2: number;              // 该行内选中的起止 X
  isStartRow: boolean; isEndRow: boolean;
}
```

音符坐标复用 tech §6.2 的 `NotePosition` 缓存，行几何同批构建，渲染后一并失效（tech §6.1）。

## 5. 视觉设计

### 5.1 选择区域样式（示意）

```css
.selection-background {
  background-color: rgba(59, 130, 246, 0.2); /* 半透明 */
  border-radius: 2px;
  pointer-events: none;
}

.selection-range-bar {
  width: 2px;
  cursor: ew-resize;
}

.selection-range-handle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: ew-resize;
}
```

> 色值沿 v1 草案的蓝色仅作示意；落地时对齐 [ui-design.html](../ui-design.html) v3 的语义色（练习循环 = 朱砂 `--verm`，交互进行中 = 墨 `--ink` 低透明度填充，细则见 [selection.md](../selection.md) §5.2）。

### 5.2 多行选择的视觉连接

```
┌─────────────────────────────────────────────┐
│     │█████████████████████│                 │  ← 第一行
│     │█████████████│                        │
├─────┼─────────────┼─────────────────────────┤  ← 行间隔
│     │                        │█████████████│  ← 第二行
│     │                        │█████████████│
└─────────────────────────────────────────────┘
        ↑
   虚线连接（视觉提示跨行连续）
```

## 6. 实现指引（v2 架构）

原则（自 v1 原稿继承，仍然成立）：

1. **原生实现，减少 React 介入**：pointer 事件用原生监听；拖拽中的高频更新不整体进 React state——橡皮筋矩形直写覆盖层 style，选中区域实时预览按覆盖到的 noteIndex 区间**变化门控**进 state（rAF 合帧，selection.md §4.2 v1.6），抬手才提交 `DragSelection`。
2. **只更新覆盖层**：选择高亮与边界句柄画在独立覆盖层（`PhraseMarkers` 同款叠加模式），任何选择变化都不得触发 OSMD 重渲染。
3. **坐标缓存**：音符位置与行几何渲染后缓存、渲染后失效（机制已在 tech §6.1 与 [selection.md](../selection.md) §3.2 中，框选复用）。
4. **索引同源**：命中与范围一律以全曲连续 `noteIndex` 为准（selection.md §2.1 双索引约束：与 `buildPlaybackData` 同一遍历序、装饰音/延音不占位），坐标只用于命中与绘制。

落点：

| 职责 | 文件 |
| --- | --- |
| 行几何推导 | `src/utils/notation/layout.ts` |
| 命中测试（坐标 → noteIndex） | `src/utils/notation/NoteInteraction.ts` |
| 框选状态与 `LoopRange` 计算 | `src/utils/notation/selection.ts` |
| 高亮/边界句柄覆盖层 | 新组件（参照 `PhraseMarkers` 模式） |
| 事件接管与集成 | `src/components/OsmdNotation.tsx` |

v1 原稿的完整原型代码（双层 Canvas 渲染、Indicator 组件、SelectionCanvas 两版实现、`saveNoteBounds`、原生事件处理等）已随本次重组移除：它们绑定 VexFlow/Canvas 与固定行布局，对 OSMD SVG 无直接复用价值，需要时查 git 历史。

## 7. 验收标准

- [ ] 单行内可拖拽选择任意范围的音符
- [ ] 拖到行尾继续向右自动延续到下一行；多行选择每行连续高亮且有跨行视觉连接
- [ ] 拖拽期间选中区域实时预览（行带/音符高亮随拖动扩展收缩；矩形下没有音符时保持现有选择；pointercancel 清除预览；抬手提交）
- [ ] 反向拖拽自动收缩/扩展
- [ ] 选中区域左右边界有可拖拽的竖线句柄
- [ ] Shift+拖拽扩展选择；Ctrl/Cmd+拖拽切换选择
- [ ] 拖拽期间不触发单击选小节 / 双击选乐句；选择变更通知 UI（等价 v1 的 `onSelectionChange`）
- [ ] 只更新覆盖层，不重绘乐谱（OSMD 不重渲染）
- [ ] 性能：100+ 小节、5+ 行时拖拽流畅（60fps）

---

*二期功能规格；文档地图见 [../README.md](../README.md)。基线（PRD / UI 设计稿 / tech）冲突时以基线为准。*
