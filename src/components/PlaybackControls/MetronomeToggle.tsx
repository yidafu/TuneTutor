import { useState, useRef, useEffect, useCallback } from 'react';
import type { TranslationSet } from '../../locales';
import type { MetronomeSoundType } from '../../types/playback';

const SOUND_OPTIONS: MetronomeSoundType[] = ['classic', 'digital', 'kick', 'click'];

interface MetronomeToggleProps {
  enabled: boolean;
  sound: MetronomeSoundType;
  strongVolume: number;
  weakVolume: number;
  onToggle: () => void;
  onSoundChange: (sound: MetronomeSoundType) => void;
  onStrongVolumeChange: (volume: number) => void;
  onWeakVolumeChange: (volume: number) => void;
  t: TranslationSet;
}

export function MetronomeToggle({
  enabled,
  sound,
  strongVolume,
  weakVolume,
  onToggle,
  onSoundChange,
  onStrongVolumeChange,
  onWeakVolumeChange,
  t,
}: MetronomeToggleProps) {
  const [showSettings, setShowSettings] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        gearRef.current && !gearRef.current.contains(target)
      ) {
        setShowSettings(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showSettings]);

  const handleSoundChange = useCallback((s: MetronomeSoundType) => {
    onSoundChange(s);
  }, [onSoundChange]);

  return (
    <div className="flex items-center gap-1.5 relative">
      <button
        onClick={onToggle}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          enabled
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        aria-label={t.metronome}
        aria-pressed={enabled}
      >
        {t.metronome}
      </button>

          <button
            ref={gearRef}
            onClick={() => setShowSettings((prev) => !prev)}
            className={`p-1.5 rounded-md transition-colors ${
              showSettings
                ? 'bg-orange-100 text-orange-600'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
            aria-label={t.metronomeSound}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {showSettings && (
            <div
              ref={panelRef}
              className="absolute right-0 z-50 w-56 p-3 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg bottom-full"
              role="dialog"
              aria-label={t.metronomeSound}
            >
              <fieldset>
                <legend className="text-xs font-medium text-gray-600 mb-1.5">
                  {t.metronomeSound}
                </legend>
                <div className="flex gap-1" role="radiogroup">
                  {SOUND_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSoundChange(s)}
                      className={`flex-1 px-2 py-1 text-xs rounded font-medium transition-colors ${
                        sound === s
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      aria-pressed={sound === s}
                    >
                      {t[`metronomeSound_${s}`]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-3">
                <label className="block mb-1 text-xs font-medium text-gray-600">
                  {t.metronomeStrongBeat}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={strongVolume}
                  onChange={(e) => onStrongVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-orange-500 cursor-pointer"
                />
              </div>

              <div className="mt-2">
                <label className="block mb-1 text-xs font-medium text-gray-600">
                  {t.metronomeWeakBeat}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weakVolume}
                  onChange={(e) => onWeakVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-orange-500 cursor-pointer"
                />
              </div>
            </div>
          )}
    </div>
  );
}

export default MetronomeToggle;
