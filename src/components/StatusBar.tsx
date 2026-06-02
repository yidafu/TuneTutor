import type { SelectedNote, PhraseSelection } from '../types/notation';
import { formatSelectionRange } from '../utils/notation';
import type { TranslationSet } from '../locales';

interface LoopConfig {
  skipBeats: number;
}

interface StatusBarProps {
  selectedNotes: SelectedNote[];
  tempo: number;
  instrumentName: string;
  loopConfig?: LoopConfig;
  t: TranslationSet;
  phraseSelection?: PhraseSelection | null;
}

export function StatusBar({
  selectedNotes,
  tempo,
  instrumentName,
  loopConfig = { skipBeats: 0 },
  t,
  phraseSelection = null,
}: StatusBarProps) {
  const selectionText = phraseSelection
    ? `${t.measure?.replace('{0}', String(phraseSelection.startNote.measureIndex + 1))} - ${t.measure?.replace('{0}', String(phraseSelection.endNote.measureIndex + 1))}`
    : formatSelectionRange(selectedNotes, {
        emptyText: t.noSelection,
        prefix: '',
      }, t);

  const hasPhraseLoop = !!phraseSelection;
  const hasSkipLoop = loopConfig.skipBeats > 0 && !phraseSelection;

  return (
    <footer className="bg-gray-800 text-white py-3 px-6" role="contentinfo" aria-label="Status bar">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center text-sm gap-2">
        <div className="flex items-center space-x-4 sm:space-x-6">
          <span className="flex items-center" aria-label="Selected notes">
            <span className="mr-2" aria-hidden="true">🎵</span>
            <span>
              {selectionText}
            </span>
          </span>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-4 text-gray-400">
          <span aria-label="Tempo setting">
            {t.tempoLabel} <span className="text-white font-bold">{tempo}</span> {t.bpm}
          </span>
          <span aria-label="Current instrument">
            {t.instrument} <span className="text-white font-bold">{instrumentName}</span>
          </span>
          {hasPhraseLoop && (
            <span aria-label="Phrase loop active" className="text-green-400">
              🔁 {t.loopPhrase ?? 'Phrase Loop'}
            </span>
          )}
          {hasSkipLoop && (
            <span aria-label="Loop config" className="text-purple-400">
              🔁 {t.loopConfigSkip.replace('{0}', String(loopConfig.skipBeats))}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}