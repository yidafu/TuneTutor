/**
 * VexFlow types and constants for music notation rendering
 */

// Layout constants
export const STAVE_WIDTH = 200;
export const STAVE_HEIGHT = 80;
export const PADDING = 20;
export const STAVE_PADDING = 0;
export const ROW_SPACING = 30;
export const TOP_Y = 30;
export const VERTICAL_OFFSET = 30; // Playback indicator and selection highlight vertical offset

// Colors for measure states
export const COLORS = {
  selected: '#dbeafe', // blue-100
  playing: '#fef08a',  // yellow-200
  default: '#ffffff',
  border: '#e5e7eb',   // gray-200
  hover: '#eff6ff',    // blue-50
};

/**
 * Note bounds for selection and positioning
 */
export interface NoteBounds {
  measureIndex: number;
  noteIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  staveX: number;
  staveY: number;
  staveWidth: number;
  staveHeight: number;
  rowIndex: number;
}

/**
 * Row configuration for multi-row score rendering
 */
export interface RowConfig {
  startMeasure: number;
  endMeasure: number;
  rowIndex: number;
  y: number;
}

/**
 * Score layout result
 */
export interface ScoreLayout {
  measuresPerRow: number;
  totalRows: number;
  svgWidth: number;
  svgHeight: number;
  rowConfigs: RowConfig[];
}

/**
 * Selection rectangle for cross-row selection
 */
export interface SelectionRect {
  startX: number;
  endX: number;
  rowIndex: number;
  rowY: number;
  rowHeight: number;
}

// Global caches (exported for use across modules)
export let noteBoundsCache: NoteBounds[] = [];
export let rowConfigsCache: RowConfig[] = [];

/**
 * Clear all caches
 */
export function clearCaches(): void {
  noteBoundsCache = [];
  rowConfigsCache = [];
}
