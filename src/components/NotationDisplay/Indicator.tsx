/**
 * Indicator - 播放指示器组件
 * 显示红色竖线和三角形箭头，指示当前播放位置
 */

import styles from './NotationDisplay.module.css';
import { STAVE_HEIGHT, TOP_Y, ROW_SPACING, VERTICAL_OFFSET } from '../../utils/notation/types';

interface IndicatorProps {
  x: number;           // X 坐标（像素）
  visible: boolean;
  rowIndex: number;    // 当前行索引
  rowY?: number;       // 行的 Y 坐标（可选，从缓存获取）
  rowHeight?: number;  // 行高（默认 80）
}

export function Indicator({
  x,
  visible,
  rowIndex,
  rowY,
  rowHeight = STAVE_HEIGHT,
}: IndicatorProps) {
  if (!visible) return null;

  const top = rowY ?? (TOP_Y + rowIndex * (rowHeight + ROW_SPACING));

  return (
    <div
      className={styles.indicator}
      style={{
        left: x,
        top: top + VERTICAL_OFFSET,
        height: rowHeight,
      }}
    >
      {/* 顶部三角形 */}
      <div className={`${styles.indicatorArrow} ${styles.indicatorArrowTop}`} />
      {/* 竖线 */}
      <div className={styles.indicatorLine} />
      {/* 底部三角形 */}
      <div className={`${styles.indicatorArrow} ${styles.indicatorArrowBottom}`} />
    </div>
  );
}

export default Indicator;
