import type { SelectedNote, PhraseSelection } from '../types/notation';
import { formatSelectionRange } from '../utils/notation';
import type { TranslationSet } from '../locales';

interface SelectionInfoProps {
  selectedNotes: SelectedNote[];
  onClearSelection: () => void;
  t: TranslationSet;
  phraseSelection?: PhraseSelection | null;
  onClearPhrase?: () => void;
}

export function SelectionInfo({
  selectedNotes,
  onClearSelection,
  t,
  phraseSelection = null,
  onClearPhrase,
}: SelectionInfoProps) {
  const displayText = formatSelectionRange(selectedNotes, {
    emptyText: phraseSelection ? '' : t.clickToSelect,
    prefix: `${t.selected} `,
  }, t);

  const hasSelection = selectedNotes.length > 0;
  const hasPhrase = !!phraseSelection;

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-gray-600" aria-live="polite">
        {hasPhrase && (
          <span className="text-green-600 font-medium">
            {t.phraseSelected
              ? t.phraseSelected.replace('{0}', '')
              : 'Phrase selected'}
            {' '}
            ({t.measure?.replace('{0}', String(phraseSelection.startNote.measureIndex + 1))} - {t.measure?.replace('{0}', String(phraseSelection.endNote.measureIndex + 1))})
          </span>
        )}
        {!hasPhrase && displayText}
        {hasSelection && !hasPhrase && (
          <span className="ml-2 text-blue-600">
            ({selectedNotes.length} {selectedNotes.length === 1 ? t.note : t.notes})
          </span>
        )}
      </div>
      {hasPhrase && onClearPhrase && (
        <button
          onClick={onClearPhrase}
          className="text-sm text-gray-500 hover:text-gray-700"
          aria-label="Clear phrase selection"
        >
          {t.clearSelection}
        </button>
      )}
      {hasSelection && !hasPhrase && (
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