/**
 * Selection-related types for the Notation Display component
 */

/**
 * Row configuration for multi-row score rendering
 */
export interface RowConfig {
  startMeasure: number;
  endMeasure: number;
  rowIndex: number;  // Add row index for easier identification
  y: number;
}

/**
 * Highlight item for range selection across rows
 */
export interface RowHighlight {
  row: RowConfig;
  lineStartX: number;
  lineEndX: number;
}

/**
 * Selection item for selected notes across rows
 */
export interface RowSelection {
  row: RowConfig;
  lineStartX: number;
  lineEndX: number;
}

/**
 * Selection rectangle for SelectionCanvas component
 */
export interface SelectionRect {
  rowIndex: number;
  rowY: number;
  rowHeight: number;
  startX: number;
  endX: number;
}
