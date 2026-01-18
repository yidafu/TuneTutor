/**
 * SelectionCanvas - 选区绘制组件
 * 使用 div 元素绘制选择背景、边界竖线、句柄和跨行连接线
 * 参考 text-selection.md 文档实现
 */

import React from 'react';
import styles from './NotationDisplay.module.css';
import type { SelectionRect } from '../../types/selection';
import { VERTICAL_OFFSET } from '../../utils/notation/types';

interface SelectionCanvasProps {
  selections: SelectionRect[];
  visible?: boolean;
}

export function SelectionCanvas({ selections, visible = true }: SelectionCanvasProps) {
  if (!visible || selections.length === 0) return null;

  // 按行索引排序，确保渲染顺序正确
  const sortedSelections = [...selections].sort((a, b) => a.rowIndex - b.rowIndex);

  return (
    <div className={styles.selectionOverlay}>
      {sortedSelections.map((rect, index) => {
        const prevRow = sortedSelections[index - 1];
        const width = rect.endX - rect.startX;

        return (
          <React.Fragment key={rect.rowIndex}>
            {/* 跨行连接虚线 */}
            {prevRow && (
              <div
                className={styles.selectionConnector}
                style={{
                  left: Math.max(rect.startX, prevRow.startX),
                  top: prevRow.rowY + prevRow.rowHeight,
                  height: rect.rowY - (prevRow.rowY + prevRow.rowHeight),
                }}
              />
            )}

            {/* 背景高亮 */}
            <div
              className={styles.selectionBackground}
              style={{
                left: rect.startX,
                top: rect.rowY + VERTICAL_OFFSET,
                width,
                height: rect.rowHeight,
              }}
            />

            {/* 左侧边界竖线 */}
            <div
              className={styles.selectionBar}
              style={{
                left: rect.startX,
                top: rect.rowY + VERTICAL_OFFSET,
                height: rect.rowHeight,
              }}
            />

            {/* 右侧边界竖线 */}
            <div
              className={styles.selectionBar}
              style={{
                left: rect.endX,
                top: rect.rowY + VERTICAL_OFFSET,
                height: rect.rowHeight,
              }}
            />

            {/* 左侧句柄圆点 - 垂直居中 */}
            {rect.selectionType !== 'range' && (
              <div
                className={styles.selectionHandle}
                style={{
                  left: rect.startX,
                  top: rect.rowY + rect.rowHeight / 2 - 6,
                }}
                data-handle="start"
                data-row={rect.rowIndex}
              />
            )}

            {/* 右侧句柄圆点 - 垂直居中 */}
            {rect.selectionType !== 'range' && (
              <div
                className={styles.selectionHandle}
                style={{
                  left: rect.endX,
                  top: rect.rowY + rect.rowHeight / 2 - 6,
                }}
                data-handle="end"
                data-row={rect.rowIndex}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default SelectionCanvas;
