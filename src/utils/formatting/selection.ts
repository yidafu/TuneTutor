/**
 * Selection formatting utilities
 */
import type { SelectedNote } from '../../types/notation';

/**
 * Format selection range for display (supports both measure indices and selected notes)
 */
export function formatSelectionRange(
  selectedMeasures: number[] | SelectedNote[],
  options?: {
    emptyText?: string;
    prefix?: string;
  }
): string {
  const { emptyText = '', prefix = '' } = options || {};

  // Handle empty selection
  if (selectedMeasures.length === 0) {
    return emptyText;
  }

  // Extract measure indices
  let measureIndices: number[];
  const firstItem = selectedMeasures[0] as { measureIndex?: number };
  if ('measureIndex' in firstItem && firstItem.measureIndex !== undefined) {
    measureIndices = (selectedMeasures as SelectedNote[]).map(n => n.measureIndex);
  } else {
    measureIndices = selectedMeasures as number[];
  }

  // Deduplicate measure indices
  const uniqueMeasures = [...new Set(measureIndices)].sort((a, b) => a - b);

  if (uniqueMeasures.length === 1) {
    return `${prefix}Measure ${uniqueMeasures[0] + 1}`;
  }

  return `${prefix}Measures ${Math.min(...uniqueMeasures) + 1}-${Math.max(...uniqueMeasures) + 1}`;
}
