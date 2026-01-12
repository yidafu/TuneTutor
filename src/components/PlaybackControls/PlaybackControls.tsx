/**
 * PlaybackControls - Main playback control component
 */

import { INSTRUMENTS, type InstrumentType } from '../../types/audio';

interface PlaybackControlsProps {
  isPlaying: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  loopEnabled: boolean;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  instrument: InstrumentType;
  onInstrumentChange: (instrument: InstrumentType) => void;
  measureInterval: number;
  onMeasureIntervalChange: (interval: number) => void;
  availableInstruments?: InstrumentType[];
}

export function PlaybackControls({
  isPlaying,
  canPlay,
  onPlay,
  onPause,
  onStop,
  onToggleLoop,
  loopEnabled,
  tempo,
  onTempoChange,
  instrument,
  onInstrumentChange,
  measureInterval,
  onMeasureIntervalChange,
  availableInstruments = INSTRUMENTS.map(i => i.type),
}: PlaybackControlsProps) {
  const currentInstrument = INSTRUMENTS.find(i => i.type === instrument) || INSTRUMENTS[0];

  return (
    <div className="bg-white border-t border-gray-200 p-4 sm:p-6" role="region" aria-label="Playback controls">
      <div className="max-w-7xl mx-auto">
        {/* Main Controls */}
        <div className="flex flex-col items-center space-y-4 sm:space-y-6">
          {/* Transport Controls */}
          <div className="flex justify-center items-center space-x-3 sm:space-x-4" role="group" aria-label="Transport controls">
            {/* Play/Pause Button */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              disabled={!canPlay && !isPlaying}
              className={`px-6 py-3 rounded-full font-medium transition-colors flex items-center gap-2 ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
              aria-pressed={isPlaying}
            >
              <span aria-hidden="true">{isPlaying ? '⏸️' : '▶️'}</span>
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            {/* Stop Button */}
            <button
              onClick={onStop}
              disabled={!isPlaying}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label="Stop playback"
              aria-disabled={!isPlaying}
            >
              <span aria-hidden="true">⏹️</span>
              Stop
            </button>

            {/* Loop Toggle */}
            <button
              onClick={onToggleLoop}
              className={`px-4 py-3 rounded-full font-medium transition-colors flex items-center gap-2 ${
                loopEnabled
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              aria-label="Toggle loop playback"
              aria-pressed={loopEnabled}
            >
              <span aria-hidden="true">🔁</span>
              Loop
            </button>
          </div>

          {/* Sliders Row */}
          <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Tempo Slider */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="tempo-slider" className="text-sm font-medium text-gray-700">Tempo</label>
                <output htmlFor="tempo-slider" className="text-sm text-gray-900 font-bold">
                  {tempo} BPM
                </output>
              </div>
              <input
                id="tempo-slider"
                type="range"
                min="40"
                max="240"
                value={tempo}
                onChange={(e) => onTempoChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                aria-label="Tempo adjustment"
                aria-valuemin={40}
                aria-valuemax={240}
                aria-valuenow={tempo}
                aria-valuetext={`${tempo} beats per minute`}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>40</span>
                <span>240</span>
              </div>
            </div>

            {/* Instrument Selector */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="instrument-select" className="text-sm font-medium text-gray-700">
                  Instrument
                </label>
                <span className="text-sm text-gray-900 font-bold">
                  <span aria-hidden="true">{currentInstrument.icon}</span>
                  {currentInstrument.name}
                </span>
              </div>
              <select
                id="instrument-select"
                value={instrument}
                onChange={(e) => onInstrumentChange(e.target.value as InstrumentType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                aria-label="Select instrument"
              >
                {INSTRUMENTS.filter(inst => availableInstruments.includes(inst.type)).map((inst) => (
                  <option key={inst.type} value={inst.type}>
                    {inst.icon} {inst.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Measure Interval */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Measure Interval
                </label>
                <output className="text-sm text-gray-900 font-bold">
                  {measureInterval} beats
                </output>
              </div>
              <div className="flex gap-1" role="group" aria-label="Select measure interval beats">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((beat) => (
                  <button
                    key={beat}
                    onClick={() => onMeasureIntervalChange(beat)}
                    className={`w-8 h-8 rounded-md font-medium text-sm transition-colors ${
                      beat <= measureInterval
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                    aria-label={`${beat} beat${beat > 1 ? 's' : ''}`}
                    aria-pressed={beat <= measureInterval}
                  >
                    {beat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaybackControls;
