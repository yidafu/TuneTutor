interface StatusBarProps {
  selectedMeasures: number[];
  tempo: number;
  instrumentName: string;
  measureInterval: number;
}

export function StatusBar({
  selectedMeasures,
  tempo,
  instrumentName,
  measureInterval,
}: StatusBarProps) {
  const getSelectionText = (): string => {
    if (selectedMeasures.length === 0) {
      return 'No selection';
    }
    if (selectedMeasures.length === 1) {
      return `Measure ${selectedMeasures[0] + 1}`;
    }
    return `Measures ${Math.min(...selectedMeasures) + 1}-${Math.max(...selectedMeasures) + 1}`;
  };

  return (
    <footer className="bg-gray-800 text-white py-3 px-6" role="contentinfo" aria-label="Status bar">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center text-sm gap-2">
        <div className="flex items-center space-x-4 sm:space-x-6">
          <span className="flex items-center" aria-label="Selected measures">
            <span className="mr-2" aria-hidden="true">🎵</span>
            <span>
              Selected:{' '}
              <span className="font-bold text-blue-400 ml-1">{getSelectionText()}</span>
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
          {measureInterval > 0 && (
            <span aria-label="Measure interval">
              Interval: <span className="text-purple-400 font-bold">{measureInterval} beats</span>
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
