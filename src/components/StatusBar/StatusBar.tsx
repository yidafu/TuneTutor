import type { SelectedNote } from '../../types/notation';
import { formatSelectionRange } from '../../utils/formatting';

interface LoopConfig {
  skipBeats: number;
}

interface StatusBarProps {
  selectedNotes: SelectedNote[];
  tempo: number;
  instrumentName: string;
  loopConfig?: LoopConfig;
}

export function StatusBar({
  selectedNotes,
  tempo,
  instrumentName,
  loopConfig = { skipBeats: 0 },
}: StatusBarProps) {
  const selectionText = formatSelectionRange(selectedNotes, {
    emptyText: 'No selection',
  });

  return (
    <footer className="bg-gray-800 text-white py-3 px-6" role="contentinfo" aria-label="Status bar">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center text-sm gap-2">
        <div className="flex items-center space-x-4 sm:space-x-6">
          <span className="flex items-center" aria-label="Selected notes">
            <span className="mr-2" aria-hidden="true">🎵</span>
            <span>
              Selected:{' '}
              <span className="font-bold text-blue-400 ml-1">{selectionText}</span>
            </span>
          </span>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-4 text-gray-400">
          <span aria-label="Tempo setting">
            Tempo: <span className="text-white font-bold">{tempo}</span> BPM
          </span>
          <span aria-label="Current instrument">
            Instrument: <span className="text-white font-bold">{instrumentName}</span>
          </span>
          {loopConfig.skipBeats > 0 && (
            <span aria-label="Loop config" className="text-purple-400">
              🔁 Skip: {loopConfig.skipBeats}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
