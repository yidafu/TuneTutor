import type { SelectedNote } from '../../types/notation';
import { formatSelectionRange } from '../../utils/formatting';

interface SelectionInfoProps {
  selectedNotes: SelectedNote[];
  onClearSelection: () => void;
}

export function SelectionInfo({
  selectedNotes,
  onClearSelection,
}: SelectionInfoProps) {
  const displayText = formatSelectionRange(selectedNotes, {
    emptyText: 'Click notes to select',
    prefix: 'Selected: ',
  });

  const hasSelection = selectedNotes.length > 0;

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-gray-600" aria-live="polite">
        {displayText}
        {hasSelection && (
          <span className="ml-2 text-blue-600">
            ({selectedNotes.length} note{selectedNotes.length !== 1 ? 's' : ''})
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
