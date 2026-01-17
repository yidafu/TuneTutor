/**
 * Layout calculation utilities for music notation rendering
 */

import type { RowConfig, ScoreLayout } from './types';
import { STAVE_WIDTH, STAVE_HEIGHT, PADDING, STAVE_PADDING, ROW_SPACING, TOP_Y } from './types';

/**
 * Calculate score layout for automatic wrapping
 */
export function calculateScoreLayout(
  measureCount: number,
  options: {
    staveWidth?: number;
    padding?: number;
    stavePadding?: number;
    rowSpacing?: number;
    topY?: number;
    measuresPerRow?: number;
  } = {}
): ScoreLayout {
  const {
    staveWidth = STAVE_WIDTH,
    padding = PADDING,
    stavePadding = STAVE_PADDING,
    rowSpacing = ROW_SPACING,
    topY = TOP_Y,
    measuresPerRow = 4,
  } = options;

  // Total rows needed
  const totalRows = Math.ceil(measureCount / measuresPerRow);

  // SVG dimensions
  const svgWidth = padding + measuresPerRow * staveWidth + (measuresPerRow - 1) * stavePadding;
  const svgHeight = topY + totalRows * (STAVE_HEIGHT + rowSpacing) + 20;

  // Generate row configurations
  const rowConfigs: RowConfig[] = [];
  for (let row = 0; row < totalRows; row++) {
    const startMeasure = row * measuresPerRow;
    const endMeasure = Math.min(startMeasure + measuresPerRow - 1, measureCount - 1);
    rowConfigs.push({
      startMeasure,
      endMeasure,
      rowIndex: row,
      y: topY + row * (STAVE_HEIGHT + rowSpacing),
    });
  }

  return {
    measuresPerRow,
    totalRows,
    svgWidth,
    svgHeight,
    rowConfigs,
  };
}

/**
 * Get row configurations for a score
 * @param measureCount Number of measures
 * @param options Options including measuresPerRow and staveWidth
 * @returns Array of row configurations
 */
export function getRowConfigs(measureCount: number, options?: { measuresPerRow?: number; staveWidth?: number }): RowConfig[] {
  const layout = calculateScoreLayout(measureCount, options);
  return layout.rowConfigs;
}
