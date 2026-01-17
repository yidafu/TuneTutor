import type { InstrumentType } from '../../types/audio';
import { INSTRUMENTS } from '../../types/audio';

interface HeaderProps {
  selectedInstrument: InstrumentType;
  onSelectInstrument: (instrument: InstrumentType) => void;
  onOpenFileLoader: () => void;
}

export function Header({
  selectedInstrument,
  onSelectInstrument,
  onOpenFileLoader,
}: HeaderProps) {

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm" role="banner">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">Tune Tutor</h1>
          </div>

          {/* Toolbar */}
          <div className="flex items-center space-x-4">
            {/* Instrument Selector */}
            <div className="relative">
              <select
                value={selectedInstrument}
                onChange={(e) => onSelectInstrument(e.target.value as InstrumentType)}
                className="px-8 py-2 pr-8 text-white transition-colors bg-purple-600 rounded-lg appearance-none cursor-pointer hover:bg-purple-700"
                aria-label="Select instrument"
              >
                {INSTRUMENTS.map(inst => (
                  <option key={inst.type} value={inst.type} className="text-gray-900 bg-white">
                    {inst.icon} {inst.name}
                  </option>
                ))}
              </select>
              {/* Custom dropdown arrow */}
              <span className="absolute text-white -translate-y-1/2 pointer-events-none select-none right-3 top-1/2">
                ▼
              </span>
            </div>

            <button
              onClick={onOpenFileLoader}
              className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
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

export default Header;
