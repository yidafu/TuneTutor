/**
 * SelectionRangeBar - 选择范围竖条和拖拽句柄组件
 */

import React from 'react';
import styles from './NotationDisplay.module.css';

interface SelectionRangeBarProps {
  x: number;
  top: number;
  height: number;
  onPointerDown: (event: React.MouseEvent | React.TouchEvent) => void;
}

export function SelectionRangeBar({
  x,
  top,
  height,
  onPointerDown,
}: SelectionRangeBarProps) {
  return (
    <div
      className={styles.selectionBar}
      style={{ left: x, top: top, height }}
    >
      <div
        className={styles.selectionBarHandle}
        data-selection="handle"
        onMouseDown={onPointerDown}
        onTouchStart={onPointerDown}
      />
    </div>
  );
}
