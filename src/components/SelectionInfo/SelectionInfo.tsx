import type { SelectedNote } from '../../types/notation';

interface SelectionInfoProps {
  selectedMeasures: number[];
  selectedNotes: SelectedNote[];
  onClearSelection: () => void;
}

export function SelectionInfo({
  selectedMeasures,
  selectedNotes,
  onClearSelection,
}: SelectionInfoProps) {
  const getDisplayText = (): string => {
    if (selectedMeasures.length === 0) {
      return 'Click measures to select (Shift+Click for range)';
    }
    if (selectedMeasures.length === 1) {
      return `Selected: Measure ${selectedMeasures[0] + 1}`;
    }
    return `Selected: Measures ${Math.min(...selectedMeasures) + 1}-${Math.max(...selectedMeasures) + 1}`;
  };

  const hasSelection = selectedMeasures.length > 0 || selectedNotes.length > 0;

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-gray-600" aria-live="polite">
        {getDisplayText()}
        {selectedNotes.length > 0 && (
          <span className="ml-2 text-blue-600">
            ({selectedNotes.length} note{selectedNotes.length !== 1 ? 's' : ''} selected)
          </span>
        )}
      </div>
      {hasSelection && (
        <button
          onClick={onClearSelection}
          className="text-sm text-gray-500 hover:text-gray-700"
          aria-label="Clear selection"
        >
          Clear Selection
        </button>
      )}
    </div>
  );
}
