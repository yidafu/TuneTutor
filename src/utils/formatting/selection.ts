/**
 * Selection formatting utilities
 */
import type { SelectedNote } from '../../types/notation';
import type { TranslationSet } from '../../locales';

/**
 * Format selection range for display (supports both measure indices and selected notes)
 */
export function formatSelectionRange(
  selectedMeasures: number[] | SelectedNote[],
  options?: {
    emptyText?: string;
    prefix?: string;
  },
  t?: TranslationSet
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
    const measureNum = uniqueMeasures[0] + 1;
    if (t) {
      return `${prefix}${t.measure.replace('{0}', String(measureNum))}`;
    }
    return `${prefix}Measure ${measureNum}`;
  }

  const startMeasure = Math.min(...uniqueMeasures) + 1;
  const endMeasure = Math.max(...uniqueMeasures) + 1;
  if (t) {
    return `${prefix}${t.measures.replace('{0}', String(startMeasure)).replace('{1}', String(endMeasure))}`;
  }
  return `${prefix}Measures ${startMeasure}-${endMeasure}`;
}
