/**
 * Selection-related types for the Notation Display component
 */

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
 * Unified selection item type for both highlights and selections
 */
export interface RowSelectionItem {
  row: RowConfig;
  lineStartX: number;
  lineEndX: number;
}

export type RowHighlight = RowSelectionItem;
export type RowSelection = RowSelectionItem;

/**
 * Selection rectangle for SelectionCanvas component
 */
export interface SelectionRect {
  rowIndex: number;
  rowY: number;
  rowHeight: number;
  startX: number;
  endX: number;
  selectionType?: 'range' | 'note';
}
