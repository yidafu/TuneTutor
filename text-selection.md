# 多行五线谱文本选择效果 Spec

## 概述

实现类似文本编辑器的拖拽选择体验，让用户可以通过鼠标拖拽在多行五线谱上连续选择音符和小节。

## 核心交互设计

### 交互状态机

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

### 拖拽选择行为

| 场景 | 行为 |
|------|------|
| 起始行内拖拽 | 正常 X 轴范围选择 |
| 拖到行尾继续向右 | 自动扩展到下一行的起始位置 |
| 跨行连续选择 | 每行都高亮选中，形成连续选择块 |
| 反向拖拽 | 自动调整 selection.startX 和 endX |
| 拖拽到上一行 | 自动收缩/扩展到上一行 |

### 选择效果示例

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

### 键盘组合键

| 按键 | 行为 |
|------|------|
| Shift + 拖拽 | 扩展现有选择（add 模式） |
| Ctrl/Cmd + 拖拽 | 切换选择（toggle 模式） |

## 数据结构设计

### RowConfig (现有)

```typescript
interface RowConfig {
  startMeasure: number;  // 该行起始小节索引
  endMeasure: number;    // 该行结束小节索引
  y: number;             // 该行的 Y 坐标
  height: number;        // 行高 (用于跨行检测)
}
```

### SelectionRange (扩展)

```typescript
interface SelectionRange {
  startX: number;      // 起始 X 坐标
  endX: number;        // 结束 X 坐标
  startRow: number;    // 起始行索引
  endRow: number;      // 结束行索引
  startY?: number;     // 起始 Y 坐标（可选，用于精确检测）
  endY?: number;       // 结束 Y 坐标（可选）
}
```

### RowHighlight (现有，需扩展)

```typescript
interface RowHighlight {
  row: RowConfig;       // 行配置
  lineStartX: number;   // 该行高亮起始 X
  lineEndX: number;     // 该行高亮结束 X
  isStartRow: boolean;  // 是否是起始行（用于视觉样式）
  isEndRow: boolean;    // 是否是结束行
}
```

## 视觉设计

### 选择区域样式

```css
.selection-background {
  background-color: rgba(59, 130, 246, 0.2); /* 半透明蓝色 */
  border-radius: 2px;
  pointer-events: none;
}

.selection-range-bar {
  width: 2px;
  background-color: rgb(59, 130, 246);
  cursor: ew-resize;
}

.selection-range-handle {
  width: 12px;
  height: 12px;
  background-color: rgb(59, 130, 246);
  border-radius: 50%;
  cursor: ew-resize;
}
```

### 多行选择的视觉连接

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

## 实现计划

### 核心原则：原生实现，减少 React 介入

- Canvas 渲染五线谱（只渲染一次）
- Canvas 上方覆盖透明 div
- 在覆盖层 Canvas 上绘制选择效果（不需要重绘五线谱）

### 1. 双层渲染架构

```
┌─────────────────────────┐
│  覆盖层 (透明 div)       │  ← 绘制选择背景和边界
│  ┌───────────────────┐  │
│  │                   │  │
│  │   选择区域        │  │
│  │                   │  │
│  └───────────────────┘  │
├─────────────────────────┤  ← pointer-events: none (透传点击)
│  Canvas (五线谱)        │  ← 渲染后不重绘
└─────────────────────────┘
```

### 2. 覆盖层 DOM 结构

```tsx
<div className="relative">
  {/* 五线谱 Canvas */}
  <canvas ref={canvasRef} className="absolute" />

  {/* 选择覆盖层 */}
  <div ref={overlayRef} className="absolute inset-0 pointer-events-none">
    <canvas ref={selectionCanvasRef} />
  </div>

  {/* Indicator（播放时移动的红色指示器） */}
  <Indicator
    x={indicatorX}
    visible={isPlaying}
    rowIndex={indicatorRowIndex}
  />
</div>
```

### 3. Indicator 覆盖层组件

**文件**: 新建 `src/components/NotationDisplay/IndicatorCanvas.tsx`

使用 div 实现，方便 CSS 动画：

```tsx
import React from 'react';

interface IndicatorProps {
  x: number;           // X 坐标（像素）
  visible: boolean;
  rowIndex: number;    // 当前行索引
  rowY?: number;       // 行的 Y 坐标（可选，从缓存获取）
}

export function Indicator({ x, visible, rowIndex, rowY }: IndicatorProps & { rowY?: number }) {
  if (!visible) return null;

  const rowHeight = 80;
  const top = rowY ?? (50 + rowIndex * (rowHeight + 20));

  return (
    <div
      className="indicator"
      style={{
        left: x,
        top,
        height: rowHeight,
      }}
    >
      {/* 顶部三角形 */}
      <div className="indicator-arrow indicator-arrow-top" />
      {/* 竖线 */}
      <div className="indicator-line" />
      {/* 底部三角形 */}
      <div className="indicator-arrow indicator-arrow-bottom" />
    </div>
  );
}
```

**CSS 动画样式**：

```css
.indicator {
  position: absolute;
  width: 4px;
  pointer-events: none;
  z-index: 10;
}

.indicator-line {
  width: 2px;
  height: 100%;
  background-color: #ef4444;
  margin-left: 1px;
}

.indicator-arrow {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
}

.indicator-arrow-top {
  top: -8px;
  border-bottom: 8px solid #ef4444;
}

.indicator-arrow-bottom {
  bottom: -8px;
  border-top: 8px solid #ef4444;
}

/* 流畅移动动画 */
.indicator {
  transition: left 0.1s ease-out;
}
```

**更新 Indicator 位置**：

```typescript
function getIndicatorPosition(
  measureIndex: number,
  noteIndex: number,
  noteBoundsCache: NoteBounds[]
): { x: number; rowIndex: number } | null {
  const note = noteBoundsCache.find(
    n => n.measureIndex === measureIndex && n.noteIndex === noteIndex
  );
  if (!note) return null;

  // 直接使用音符缓存中的五线谱信息
  return {
    x: note.x + note.width / 2,
    rowIndex: note.rowIndex,
  };
}

// 根据行索引获取行的 Y 坐标
function getRowY(rowIndex: number, rowConfigsCache: RowConfig[]): number {
  const row = rowConfigsCache.find(r => r.rowIndex === rowIndex);
  return row?.y ?? 0;
}
```

### 4. 绘制选择效果

**文件**: 新建 `src/components/NotationDisplay/SelectionCanvas.tsx`

使用 div 实现选择区域：

```tsx
import React from 'react';

interface SelectionRect {
  startX: number;
  endX: number;
  rowIndex: number;
  rowY: number;
  rowHeight: number;
}

interface SelectionCanvasProps {
  selections: SelectionRect[];
  visible: boolean;
}

export function SelectionCanvas({ selections, visible }: SelectionCanvasProps) {
  if (!visible || selections.length === 0) return null;

  return (
    <div className="selection-overlay">
      {selections.map((rect, index) => {
        const width = rect.endX - rect.startX;
        return (
          <React.Fragment key={index}>
            {/* 背景高亮 */}
            <div
              className="selection-background"
              style={{
                left: rect.startX,
                top: rect.rowY,
                width,
                height: rect.rowHeight,
              }}
            />
            {/* 左侧边界竖线 */}
            <div
              className="selection-bar selection-bar-left"
              style={{
                left: rect.startX,
                top: rect.rowY,
                height: rect.rowHeight,
              }}
            />
            {/* 右侧边界竖线 */}
            <div
              className="selection-bar selection-bar-right"
              style={{
                left: rect.endX,
                top: rect.rowY,
                height: rect.rowHeight,
              }}
            />
            {/* 左侧句柄圆点 */}
            <div
              className="selection-handle"
              style={{
                left: rect.startX,
                top: rect.rowY,
              }}
            />
            {/* 右侧句柄圆点 */}
            <div
              className="selection-handle"
              style={{
                left: rect.endX,
                top: rect.rowY,
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

**CSS 样式**：

```css
.selection-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.selection-background {
  position: absolute;
  background-color: rgba(59, 130, 246, 0.2);
  border-radius: 2px;
}

.selection-bar {
  position: absolute;
  width: 2px;
  background-color: #3b82f6;
}

.selection-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #3b82f6;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: ew-resize;
}

/* 跨行连接虚线 */
.selection-connector {
  position: absolute;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    #3b82f6 0px,
    #3b82f6 4px,
    transparent 4px,
    transparent 8px
  );
}
```

**计算选择区域**：

```typescript
// 选择区域配置
interface SelectionRect {
  startX: number;       // 起始 X
  endX: number;         // 结束 X
  rowIndex: number;     // 行索引
  rowY: number;         // 行 Y 坐标
  rowHeight: number;    // 行高
}

interface SelectionCanvasProps {
  selections: SelectionRect[];
  visible: boolean;
}

export function SelectionCanvas({ selections, visible }: SelectionCanvasProps) {
  if (!visible || selections.length === 0) return null;

  // 按行索引排序
  const sortedSelections = [...selections].sort((a, b) => a.rowIndex - b.rowIndex);

  return (
    <div className="selection-overlay">
      {sortedSelections.map((rect, index) => {
        const width = rect.endX - rect.startX;
        const prevRow = sortedSelections[index - 1];

        return (
          <React.Fragment key={rect.rowIndex}>
            {/* 跨行连接虚线 */}
            {prevRow && (
              <div
                className="selection-connector"
                style={{
                  left: Math.max(rect.startX, prevRow.startX),
                  top: prevRow.rowY + prevRow.rowHeight,
                  height: rect.rowY - (prevRow.rowY + prevRow.rowHeight),
                }}
              />
            )}

            {/* 背景高亮 */}
            <div
              className="selection-background"
              style={{
                left: rect.startX,
                top: rect.rowY,
                width,
                height: rect.rowHeight,
              }}
            />

            {/* 左侧边界竖线 */}
            <div
              className="selection-bar"
              style={{
                left: rect.startX,
                top: rect.rowY,
                height: rect.rowHeight,
              }}
            />

            {/* 右侧边界竖线 */}
            <div
              className="selection-bar"
              style={{
                left: rect.endX,
                top: rect.rowY,
                height: rect.rowHeight,
              }}
            />

            {/* 左侧句柄圆点 */}
            <div
              className="selection-handle"
              style={{
                left: rect.startX,
                top: rect.rowY,
              }}
            />

            {/* 右侧句柄圆点 */}
            <div
              className="selection-handle"
              style={{
                left: rect.endX,
                top: rect.rowY,
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

**CSS 样式**：

```css
.selection-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.selection-background {
  position: absolute;
  background-color: rgba(59, 130, 246, 0.2);
  border-radius: 2px;
}

.selection-bar {
  position: absolute;
  width: 2px;
  background-color: #3b82f6;
}

.selection-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #3b82f6;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: ew-resize;
}

/* 跨行连接虚线 */
.selection-connector {
  position: absolute;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    #3b82f6 0px,
    #3b82f6 4px,
    transparent 4px,
    transparent 8px
  );
}
```

### 5. 音符位置缓存

**文件**: [vexflowHelpers.ts](src/utils/notation/vexflowHelpers.ts)

渲染 VexFlow 后保存音符位置：

```typescript
// 全局音符边界缓存
export let noteBoundsCache: NoteBounds[] = [];

export function saveNoteBounds(renderer: any, score: ParsedScore) {
  noteBoundsCache = [];
  rowConfigsCache = [];

  const canvasRect = renderer.canvas.getBoundingClientRect();
  const STAVE_WIDTH = 200;
  const STAVE_HEIGHT = 80;
  const MEASURES_PER_ROW = 5;
  const PADDING = 20;
  const TOP_Y = 50;

  // 1. 先构建行配置
  const totalMeasures = score.measures.length;
  let currentMeasure = 0;
  let rowIndex = 0;

  while (currentMeasure < totalMeasures) {
    const endMeasure = Math.min(currentMeasure + MEASURES_PER_ROW - 1, totalMeasures - 1);
    const y = PADDING + rowIndex * (STAVE_HEIGHT + 20);

    rowConfigsCache.push({
      rowIndex,
      startMeasure: currentMeasure,
      endMeasure,
      y,
      height: STAVE_HEIGHT,
    });

    // 2. 为该行的每个小节保存五线谱信息
    for (let m = currentMeasure; m <= endMeasure; m++) {
      const staveX = PADDING + (m - currentMeasure) * (STAVE_WIDTH + 20);

      // 查找该小节内的音符
      const measureEl = document.querySelector(`[data-measure="${m}"]`);
      measureEl?.querySelectorAll('[data-note]').forEach((noteEl, noteIdx) => {
        const noteRect = noteEl.getBoundingClientRect();

        noteBoundsCache.push({
          measureIndex: m,
          noteIndex: noteIdx,
          x: noteRect.left - canvasRect.left,
          y: noteRect.top - canvasRect.top,
          width: noteRect.width,
          height: noteRect.height,
          staveX,
          staveY: y,
          staveWidth: STAVE_WIDTH,
          staveHeight: STAVE_HEIGHT,
          rowIndex,
        });
      });
    }

    currentMeasure = endMeasure + 1;
    rowIndex++;
  }

  return { noteBounds: noteBoundsCache, rows: rowConfigsCache };
}

// 获取指定范围内的音符
export function getNotesInRange(
  startNote: NoteBounds,
  endNote: NoteBounds
): NoteBounds[] {
  const startIdx = noteBoundsCache.findIndex(
    n => n.measureIndex === startNote.measureIndex && n.noteIndex === startNote.noteIndex
  );
  const endIdx = noteBoundsCache.findIndex(
    n => n.measureIndex === endNote.measureIndex && n.noteIndex === endNote.noteIndex
  );

  if (startIdx === -1 || endIdx === -1) return [];

  return noteBoundsCache.slice(
    Math.min(startIdx, endIdx),
    Math.max(startIdx, endIdx) + 1
  );
}
```

### 6. 原生事件处理

**文件**: [NotationDisplay.tsx](src/components/NotationDisplay/NotationDisplay.tsx)

基于 `noteBoundsCache` 检查音符位置和跨行逻辑：

```typescript
import { noteBoundsCache, rowConfigsCache, getNotePositions } from '../../utils/notation/vexflowHelpers';

// 选择状态（使用 useRef 避免重渲染）
const selectionRef = useRef({
  isSelecting: false,
  isDraggingHandle: false,
  activeHandle: null as 'start' | 'end' | null,
  anchorNote: null as NoteBounds | null,
  startX: 0,
  startY: 0,
});

// 根据坐标查找音符
function findNoteAtPosition(x: number, y: number): NoteBounds | null {
  for (const note of noteBoundsCache) {
    if (
      x >= note.x &&
      x <= note.x + note.width &&
      y >= note.y &&
      y <= note.y + note.height
    ) {
      return note;
    }
  }
  return null;
}

// 检测点击是否在句柄区域
function hitTestHandle(x: number, y: number): 'start' | 'end' | null {
  const HANDLE_WIDTH = 20;
  const HANDLE_HEIGHT = 80;
  const TOP_Y = 50;

  if (!selectionRef.current.anchorNote) return null;

  // 获取当前选择的边界位置
  const { startX, endX } = getSelectionBounds();
  if (!startX || !endX) return null;

  // 检测左侧句柄
  const leftY = TOP_Y + selectionRef.current.anchorNote.rowIndex * 100;
  if (
    Math.abs(x - startX) < HANDLE_WIDTH / 2 &&
    y >= leftY - 20 &&
    y <= leftY + HANDLE_HEIGHT
  ) {
    return 'start';
  }

  // 检测右侧句柄
  if (
    Math.abs(x - endX) < HANDLE_WIDTH / 2 &&
    y >= leftY - 20 &&
    y <= leftY + HANDLE_HEIGHT
  ) {
    return 'end';
  }

  return null;
}

// 获取当前选择区域的边界 X 坐标
function getSelectionBounds(): { startX: number | null; endX: number | null } {
  if (!selectionRef.current.anchorNote) {
    return { startX: null, endX: null };
  }

  const { anchorNote } = selectionRef.current;
  const startNote = anchorNote.startNote;
  const endNote = anchorNote.endNote;

  if (startNote && endNote) {
    return {
      startX: Math.min(startNote.x, endNote.x),
      endX: Math.max(startNote.x + startNote.width, endNote.x + endNote.width),
    };
  }

  return { startX: null, endX: null };
}

// 计算跨行选择区域的音符
function getSelectionRects(startNote: NoteBounds, endNote: NoteBounds): SelectionRect[] {
  const rects: SelectionRect[] = [];
  const STAVE_HEIGHT = 80;
  const PADDING = 20;
  const rowConfigs = rowConfigsCache;

  // 确定起始和结束行的索引
  const startRow = Math.min(startNote.rowIndex, endNote.rowIndex);
  const endRow = Math.max(startNote.rowIndex, endNote.rowIndex);

  for (let row = startRow; row <= endRow; row++) {
    const rowConfig = rowConfigs.find(r => r.rowIndex === row);
    if (!rowConfig) continue;

    const rowY = rowConfig.y;

    // 当前行的起始和结束音符
    let rowStartNote: NoteBounds;
    let rowEndNote: NoteBounds;

    if (row === startRow && row === endRow) {
      // 同一行
      rowStartNote = startNote.rowIndex === row ? startNote : endNote;
      rowEndNote = startNote.rowIndex === row ? endNote : startNote;
    } else if (row === startRow) {
      // 起始行：使用 startNote 到该行最后一个音符
      const rowNotes = noteBoundsCache.filter(n => n.rowIndex === row);
      rowStartNote = startNote.rowIndex === row ? startNote : rowNotes[0];
      rowEndNote = rowNotes[rowNotes.length - 1];
    } else if (row === endRow) {
      // 结束行：使用该行第一个音符到 endNote
      const rowNotes = noteBoundsCache.filter(n => n.rowIndex === row);
      rowStartNote = rowNotes[0];
      rowEndNote = endNote.rowIndex === row ? endNote : rowNotes[rowNotes.length - 1];
    } else {
      // 中间行：整行选择
      const rowNotes = noteBoundsCache.filter(n => n.rowIndex === row);
      rowStartNote = rowNotes[0];
      rowEndNote = rowNotes[rowNotes.length - 1];
    }

    rects.push({
      startX: rowStartNote.x,
      endX: rowEndNote.x + rowEndNote.width,
      rowIndex: row,
      rowY,
      rowHeight: STAVE_HEIGHT,
    });
  }

  return rects;
}

useEffect(() => {
  const overlay = overlayRef.current;
  if (!overlay) return;

  const handlePointerDown = (e: PointerEvent) => {
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1. 检测是否点击句柄
    const handle = hitTestHandle(x, y);
    if (handle) {
      selectionRef.current.isDraggingHandle = true;
      selectionRef.current.activeHandle = handle;
      return;
    }

    // 2. 检测是否点击音符
    const clickedNote = findNoteAtPosition(x, y);
    if (clickedNote) {
      // 单个音符点击处理
      selectionRef.current.anchorNote = {
        startNote: clickedNote,
        endNote: clickedNote,
      };
      selectionRef.current.isSelecting = true;
      onNoteSelect?.([clickedNote], 'replace');
      return;
    }

    // 3. 开始范围选择
    selectionRef.current.isSelecting = true;
    selectionRef.current.startX = x;
    selectionRef.current.startY = y;

    // 查找起始位置的音符作为锚点
    const startNote = findNoteAtPosition(x, y);
    if (startNote) {
      selectionRef.current.anchorNote = {
        startNote,
        endNote: startNote,
      };
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1. 句柄拖拽
    if (selectionRef.current.isDraggingHandle && selectionRef.current.anchorNote) {
      // 更新对应边界位置
      // ... 实现句柄拖拽逻辑
      return;
    }

    // 2. 范围选择
    if (!selectionRef.current.isSelecting || !selectionRef.current.anchorNote) return;

    const endNote = findNoteAtPosition(x, y);
    if (endNote) {
      selectionRef.current.anchorNote = {
        ...selectionRef.current.anchorNote,
        endNote,
      };

      // 计算选择区域并更新 SelectionCanvas
      const rects = getSelectionRects(
        selectionRef.current.anchorNote.startNote,
        endNote
      );
      // 更新 SelectionCanvas 的 selections prop
    }
  };

  const handlePointerUp = () => {
    selectionRef.current.isSelecting = false;
    selectionRef.current.isDraggingHandle = false;
    selectionRef.current.activeHandle = null;

    // 完成选择后通知父组件
    if (selectionRef.current.anchorNote) {
      const notes = getNotesInRange(
        selectionRef.current.anchorNote.startNote,
        selectionRef.current.anchorNote.endNote!
      );
      onNoteSelect?.(notes, 'replace');
    }
  };

  overlay.addEventListener('pointerdown', handlePointerDown);
  overlay.addEventListener('pointermove', handlePointerMove);
  overlay.addEventListener('pointerup', handlePointerUp);

  return () => {
    overlay.removeEventListener('pointerdown', handlePointerDown);
    overlay.removeEventListener('pointermove', handlePointerMove);
    overlay.removeEventListener('pointerup', handlePointerUp);
  };
}, [onNoteSelect]);
```

### 7. 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| [SelectionCanvas.tsx](src/components/NotationDisplay/SelectionCanvas.tsx) | 新建：选择覆盖层组件 |
| [IndicatorCanvas.tsx](src/components/NotationDisplay/IndicatorCanvas.tsx) | 新建：红色播放指示器覆盖层 |
| [NotationDisplay.tsx](src/components/NotationDisplay/NotationDisplay.tsx) | 集成双层架构和原生事件 |

### 8. 验收测试

- [ ] 拖拽选择流畅（只更新覆盖层，不重绘五线谱）
- [ ] 跨行选择正确高亮
- [ ] 选择边界可拖拽调整
- [ ] 反向拖拽正常工作

## API 设计

### useNoteSelection Hook 扩展

```typescript
interface UseNoteSelectionReturn {
  // ... 现有 API

  // 新增：范围选择（带跨行支持）
  startRangeSelection: (x: number, y: number, options?: {
    mode?: 'replace' | 'add' | 'toggle';
  }) => void;
  updateRangeSelection: (x: number, y: number) => void;
  endRangeSelection: () => void;

  // 新增：获取跨行范围内的音符
  getNotesInCrossRowRange: (range: SelectionRange) => SelectedNote[];
}
```

### 组件 Props 扩展

```typescript
interface SelectionOverlayProps {
  // ... 现有 props

  // 新增：显示范围信息
  showRangeInfo?: boolean;
  rangeInfoPosition?: 'top' | 'bottom' | 'floating';
}
```

## 验收标准

- [ ] 用户可以在单行五线谱内拖拽选择任意范围的音符
- [ ] 拖拽到行尾时自动延续到下一行的对应位置
- [ ] 多行选择时，每行都有连续的高亮背景
- [ ] 选中区域左右边界有可拖拽的竖线句柄
- [ ] 支持 Shift+拖拽扩展选择
- [ ] 选择变更时触发 `onSelectionChange` 回调
- [ ] 性能：100+ 小节、5+ 行时拖拽仍流畅（60fps）

## 相关文件

| 文件路径 | 功能 |
|---------|------|
| [src/hooks/useNoteSelection.ts](src/hooks/useNoteSelection.ts) | 选择状态管理 |
| [src/components/NotationDisplay/SelectionOverlay.tsx](src/components/NotationDisplay/SelectionOverlay.tsx) | 选择覆盖层渲染 |
| [src/components/NotationDisplay/SelectionRangeBar.tsx](src/components/NotationDisplay/SelectionRangeBar.tsx) | 边界句柄 |
| [src/utils/notation/vexflowHelpers.ts](src/utils/notation/vexflowHelpers.ts) | VexFlow 渲染辅助 |
| [src/types/notation.ts](src/types/notation.ts) | 类型定义 |
| [src/types/selection.ts](src/types/selection.ts) | 选择类型定义 |
