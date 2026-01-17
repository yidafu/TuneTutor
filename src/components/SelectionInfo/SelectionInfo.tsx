import type { SelectedNote } from '../../types/notation';
import { formatSelectionRange } from '../../utils/formatting';
import type { TranslationSet } from '../../locales';

interface SelectionInfoProps {
  selectedNotes: SelectedNote[];
  onClearSelection: () => void;
  t: TranslationSet;
}

export function SelectionInfo({
  selectedNotes,
  onClearSelection,
  t,
}: SelectionInfoProps) {
  const displayText = formatSelectionRange(selectedNotes, {
    emptyText: t.clickToSelect,
    prefix: `${t.selected} `,
  }, t);

  const hasSelection = selectedNotes.length > 0;

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-gray-600" aria-live="polite">
        {displayText}
        {hasSelection && (
          <span className="ml-2 text-blue-600">
            ({selectedNotes.length} {selectedNotes.length === 1 ? t.note : t.notes})
          </span>
        )}
      </div>
      {hasSelection && (
        <button
          onClick={onClearSelection}
          className="text-sm text-gray-500 hover:text-gray-700"
          aria-label="Clear selection"
        >
          {t.clearSelection}
        </button>
      )}
    </div>
  );
}
