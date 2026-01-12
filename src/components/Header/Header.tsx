interface HeaderProps {
  isAudioEnabled: boolean;
  isLoadingAudio: boolean;
  instrumentDisplay: { name: string; icon: string };
  onEnableAudio: () => void;
  onSwitchInstrument: () => void;
  onOpenFileLoader: () => void;
}

export function Header({
  isAudioEnabled,
  isLoadingAudio,
  instrumentDisplay,
  onEnableAudio,
  onSwitchInstrument,
  onOpenFileLoader,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">Note Slice</h1>
          </div>

          {/* Toolbar */}
          <div className="flex items-center space-x-4">
            {!isAudioEnabled ? (
              <button
                onClick={onEnableAudio}
                disabled={isLoadingAudio}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Enable audio for playback"
                aria-busy={isLoadingAudio}
              >
                <span>🔊</span>
                {isLoadingAudio ? 'Loading...' : 'Enable Audio'}
              </button>
            ) : (
              <button
                onClick={onSwitchInstrument}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                aria-label="Switch instrument"
              >
                <span aria-hidden="true">{instrumentDisplay.icon}</span>
                {instrumentDisplay.name}
              </button>
            )}
            <button
              onClick={onOpenFileLoader}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              aria-label="Load sheet music file"
            >
              <span aria-hidden="true">📁</span>
              Load File
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
