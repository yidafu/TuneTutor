/**
 * Selection formatting utilities
 */
import type { SelectedNote } from '../../types/notation';
import type { TranslationSet } from '../../locales';

/**
 * Format selection range for display
 */
export function formatSelectionRange(
  selectedNotes: SelectedNote[],
  options?: {
    emptyText?: string;
    prefix?: string;
  },
  t?: TranslationSet
): string {
  const { emptyText = '', prefix = '' } = options || {};

  // Handle empty selection
  if (selectedNotes.length === 0) {
    return emptyText;
  }

  // Extract and deduplicate measure indices
  const measureIndices = selectedNotes.map(n => n.measureIndex);
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