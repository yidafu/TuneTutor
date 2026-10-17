/**
 * OriginalAudioPage - Original-audio slice-loop practice page.
 *
 * Uses wavesurfer.js (v7) for the waveform, playback, and drag-to-select slice
 * region. Loop-with-empty-beats is implemented manually (wavesurfer v7 has no
 * loop API): a `timeupdate` handler pauses at the slice end and schedules the
 * restart after the empty-beat gap. Audio files persist in IndexedDB and are
 * restored on page mount; slice + gap persist in localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.js';
import { useTranslation } from '../locales/I18nContext';
import type { AudioSlice } from '../types/audio';
import { beatsToSeconds } from '../audio/TempoConverter';
import { formatTime, buildAudioLoopPlan } from '../audio/sliceUtils';
import {
  generateFileId,
  getLatestAudioFile,
  saveAudioFile,
  deleteAudioFile,
} from '../utils/storage';
import { isBrowser } from '../utils/isBrowser';
import { GapBeatsSelector } from '../components/OriginalAudio/GapBeatsSelector';

const AUDIO_SLICE_KEY = 'note-slice-audio-slice';
const AUDIO_GAP_KEY = 'note-slice-audio-gap';
const REGION_COLOR = 'rgba(249, 115, 22, 0.18)';

// ── localStorage persistence helpers ────────────────────

function getSavedAudioSlice(): AudioSlice | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(AUDIO_SLICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AudioSlice>;
    if (typeof parsed.startTime === 'number' && typeof parsed.endTime === 'number') {
      return { startTime: parsed.startTime, endTime: parsed.endTime };
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

function saveAudioSlice(slice: AudioSlice): void {
  if (isBrowser) localStorage.setItem(AUDIO_SLICE_KEY, JSON.stringify(slice));
}

function clearSavedAudioSlice(): void {
  if (isBrowser) localStorage.removeItem(AUDIO_SLICE_KEY);
}

function getSavedAudioGap(): number {
  if (!isBrowser) return 0;
  const raw = localStorage.getItem(AUDIO_GAP_KEY);
  const n = raw !== null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 8 ? n : 0;
}

function saveAudioGap(beats: number): void {
  if (isBrowser) localStorage.setItem(AUDIO_GAP_KEY, String(beats));
}

function clearSavedAudioGap(): void {
  if (isBrowser) localStorage.removeItem(AUDIO_GAP_KEY);
}

// ── Component ───────────────────────────────────────────

interface OriginalAudioPageProps {
  tempo: number;
}

function OriginalAudioPage({ tempo }: OriginalAudioPageProps) {
  const { t } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const regionRef = useRef<Region | null>(null);
  const dragSelectionCleanupRef = useRef<(() => void) | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const audioIdRef = useRef<string | null>(null);

  // Refs mirroring current state for async wavesurfer callbacks
  const tRef = useRef(t);
  const sliceRef = useRef<AudioSlice | null>(null);
  const gapBeatsRef = useRef(0);
  const tempoRef = useRef(tempo);
  const isPlayingRef = useRef(false);

  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioSlice, setAudioSlice] = useState<AudioSlice | null>(null);
  const [gapBeats, setGapBeats] = useState<number>(getSavedAudioGap);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { tRef.current = t; }, [t]);
  useEffect(() => { sliceRef.current = audioSlice; }, [audioSlice]);
  useEffect(() => { gapBeatsRef.current = gapBeats; }, [gapBeats]);
  useEffect(() => { tempoRef.current = tempo; }, [tempo]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── Create wavesurfer + restore saved audio ──────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      waveColor: '#e5e7eb',
      progressColor: '#f97316',
      cursorColor: '#f97316',
      height: 120,
      dragToSeek: false,
    });
    const regions = ws.registerPlugin(RegionsPlugin.create());
    wavesurferRef.current = ws;
    regionsRef.current = regions;

    // Drag on the waveform to create a slice region
    const cleanupDrag = regions.enableDragSelection({ color: REGION_COLOR, drag: true, resize: true });
    dragSelectionCleanupRef.current = cleanupDrag;

    // On any new region (user drag or programmatic addRegion): keep a single
    // slice by removing the previous region, and sync state on resize/drag end.
    regions.on('region-created', (region) => {
      if (regionRef.current && regionRef.current !== region) {
        regionRef.current.remove();
      }
      regionRef.current = region;

      region.on('update-end', () => {
        const slice: AudioSlice = {
          startTime: Math.min(region.start, region.end),
          endTime: Math.max(region.start, region.end),
        };
        setAudioSlice(slice);
        saveAudioSlice(slice);
      });

      // Double-click removes the region (wavesurfer does not auto-remove)
      region.on('dblclick', () => {
        region.remove();
        regionRef.current = null;
        setAudioSlice(null);
        clearSavedAudioSlice();
      });
    });

    ws.on('ready', () => setDuration(ws.getDuration()));
    ws.on('play', () => setIsPlaying(true));
    ws.on('finish', () => setIsPlaying(false));
    ws.on('error', (err) => {
      console.error('[OriginalAudio] wavesurfer error:', err);
      setError(tRef.current.unsupportedAudioFormat);
    });

    // Loop driver: when playback reaches the slice end, pause and schedule a
    // restart after the empty-beat gap (gap = 0 restarts on the next frame).
    ws.on('timeupdate', (time) => {
      if (!isPlayingRef.current) return;
      const slice = sliceRef.current;
      if (!slice || time < slice.endTime) return;

      ws.pause();
      const gapSeconds = beatsToSeconds(gapBeatsRef.current, tempoRef.current, 4);
      if (restartTimerRef.current !== null) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        ws.setTime(slice.startTime);
        ws.play();
      }, Math.max(0, gapSeconds * 1000));
    });

    // Restore the latest saved audio (and persisted slice/gap) on mount
    let cancelled = false;
    (async () => {
      try {
        const stored = await getLatestAudioFile();
        if (cancelled || !stored) return;
        audioIdRef.current = stored.id;
        setAudioFileName(stored.fileName);
        await ws.loadBlob(new Blob([stored.data]));
        const savedSlice = getSavedAudioSlice();
        if (savedSlice) {
          setAudioSlice(savedSlice);
          regions.addRegion({
            start: savedSlice.startTime,
            end: savedSlice.endTime,
            color: REGION_COLOR,
            drag: true,
            resize: true,
          });
        }
      } catch (err) {
        console.error('[OriginalAudio] restore error:', err);
        if (!cancelled) setError(tRef.current.unsupportedAudioFormat);
      }
    })();

    return () => {
      cancelled = true;
      if (restartTimerRef.current !== null) clearTimeout(restartTimerRef.current);
      dragSelectionCleanupRef.current?.();
      ws.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────

  const handleImport = useCallback(async (file: File) => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    // Defensive MIME check; empty type is allowed (decode is the real gate)
    if (file.type && !file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a)$/i.test(file.name)) {
      setError(t.unsupportedAudioFormat);
      return;
    }

    try {
      if (restartTimerRef.current !== null) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      ws.pause();
      regionsRef.current?.clearRegions();
      regionRef.current = null;

      const id = generateFileId();
      await ws.loadBlob(file);
      await saveAudioFile({
        id,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: Date.now(),
        data: await file.arrayBuffer(),
      });

      audioIdRef.current = id;
      setAudioFileName(file.name);
      setDuration(ws.getDuration());
      setAudioSlice(null);
      setGapBeats(0);
      setError(null);
      clearSavedAudioSlice();
      clearSavedAudioGap();
    } catch (err) {
      console.error('[OriginalAudio] import error:', err);
      setError(t.unsupportedAudioFormat);
    }
  }, [t]);

  const handlePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    if (audioSlice) {
      const plan = buildAudioLoopPlan(audioSlice.startTime, audioSlice.endTime, 0, ws.getDuration());
      if (!plan.loop) return; // slice too short to loop
      ws.setTime(plan.offset);
      ws.play();
    } else {
      ws.setTime(0);
      ws.play();
    }
    setIsPlaying(true);
  }, [audioSlice]);

  const handleStop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (ws) {
      ws.pause();
      ws.setTime(0);
    }
    setIsPlaying(false);
  }, []);

  const handleRemove = useCallback(async () => {
    const ws = wavesurferRef.current;
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (ws) {
      ws.pause();
      regionsRef.current?.clearRegions();
      regionRef.current = null;
      ws.empty();
    }
    if (audioIdRef.current) {
      try { await deleteAudioFile(audioIdRef.current); } catch { /* ignore */ }
    }
    audioIdRef.current = null;
    setAudioFileName(null);
    setAudioSlice(null);
    setGapBeats(0);
    setDuration(0);
    setIsPlaying(false);
    setError(null);
    clearSavedAudioSlice();
    clearSavedAudioGap();
  }, []);

  const handleGapBeatsChange = useCallback((beats: number) => {
    setGapBeats(beats);
    saveAudioGap(beats);
  }, []);

  // ── Import zone drag-and-drop ────────────────────────────

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) handleImport(file);
  }, [handleImport]);

  // ── Render ───────────────────────────────────────────────

  const playLabel = audioSlice ? t.audioPlayLoop : t.audioPlayWhole;

  return (
    <main className="w-full px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8" role="main" aria-label={t.originalAudio}>
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">{t.originalAudio}</h2>
          <p className="mb-4 text-sm text-gray-500">{t.dragToSelect}</p>

          {error && (
            <div className="p-3 mb-4 border border-red-200 rounded-md bg-red-50">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* File row (only when an audio file is loaded) */}
          {audioFileName && (
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span aria-hidden="true">🎵</span>
                <span className="text-sm font-medium text-gray-800 truncate">{audioFileName}</span>
                {duration > 0 && (
                  <span className="text-xs text-gray-500">
                    {t.audioDuration.replace('{0}', formatTime(duration))}
                  </span>
                )}
              </div>
              <button
                onClick={handleRemove}
                className="px-3 py-1.5 text-sm text-gray-600 transition-colors bg-gray-200 rounded-md hover:bg-gray-300"
                aria-label={t.removeAudio}
              >
                {t.removeAudio}
              </button>
            </div>
          )}

          {/* Waveform container — always rendered so the mount effect can attach wavesurfer */}
          <div className="relative" onDragOver={handleDragOver} onDrop={handleDrop}>
            <div ref={containerRef} className="w-full" style={{ minHeight: 120 }} />

            {!audioFileName && (
              /* Import overlay on the (empty) waveform container */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer border-blue-300 hover:border-blue-400 hover:bg-blue-50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                    e.target.value = '';
                  }}
                />
                <div className="mb-2 text-4xl">🎵</div>
                <p className="font-medium text-gray-700">{t.importAudio}</p>
                <p className="mt-1 text-sm text-gray-500">{t.importAudioHint}</p>
              </div>
            )}
          </div>

          {/* Slice readout + transport (only when loaded) */}
          {audioFileName && (
            <>
              <p className="mt-2 text-sm text-gray-600">
                {audioSlice ? (
                  <>
                    {t.sliceRange
                      .replace('{0}', formatTime(audioSlice.startTime))
                      .replace('{1}', formatTime(audioSlice.endTime))}
                    {' · '}
                    {t.sliceDurationLabel.replace('{0}', formatTime(audioSlice.endTime - audioSlice.startTime))}
                  </>
                ) : (
                  t.dragToSelect
                )}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-4">
                <button
                  onClick={isPlaying ? handleStop : handlePlay}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  aria-label={isPlaying ? t.stop : playLabel}
                >
                  <span aria-hidden="true">{isPlaying ? '⏹️' : '▶️'}</span>
                  {isPlaying ? t.stop : playLabel}
                </button>

                <GapBeatsSelector value={gapBeats} onChange={handleGapBeatsChange} t={t} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default OriginalAudioPage;
