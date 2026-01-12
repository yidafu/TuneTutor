/**
 * VexFlow type definitions and exports
 */

import type { ParsedScore, Measure, Note, VexFlowDuration } from '../../types/notation';

export type { ParsedScore, Measure, Note, VexFlowDuration };

export interface NotationDisplayProps {
  score?: ParsedScore;
  selectedMeasures?: number[];
  currentMeasure?: number;
  onMeasureSelect?: (measureIndex: number, addToSelection: boolean) => void;
  onRangeSelect?: (startMeasure: number, endMeasure: number) => void;
  className?: string;
}
