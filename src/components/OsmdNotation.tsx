/**
 * OSMD Notation Display Component
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { renderOsmd, clearOsmd, getOsmdInstance, cursorShow, cursorHide, cursorNext, cursorReset } from '../utils/notation/OsmdRender';
import { findOsmdNoteAtPosition, getNoteElementsInRange } from '../utils/notation/NoteInteraction';
import { PlaybackEngine, PlaybackEvent, type PlaybackStateType } from '../audio/PlaybackEngine';
import type { TimelineEntry } from '../types/playback';
import type { SelectedNote, PhraseSelection } from '../types/notation';
import { PhraseMarkers } from './PhraseMarkers';

interface OsmdNotationProps {
  musicXml: string;
  onNoteSelect?: (notes: SelectedNote[]) => void;
  onOsmdReady?: (osmd: OpenSheetMusicDisplay) => void;
  playbackEngine?: PlaybackEngine;
  className?: string;
  onPhraseNoteSelected?: (note: SelectedNote) => void;
  phraseSelection?: PhraseSelection | null;
  onClearPhrase?: () => void;
}

export function OsmdNotation({
  musicXml,
  onNoteSelect,
  onOsmdReady,
  playbackEngine,
  className = '',
  onPhraseNoteSelected,
  phraseSelection = null,
  onClearPhrase,
}: OsmdNotationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [containerId] = useState(() => `osmd-${Math.random().toString(36).substr(2, 9)}`);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDimensions] = useState({ width: 0, height: 0 });

  // Prevent cursor from advancing multiple times for chord notes (same timestamp)
  const cursorStepLocked = useRef(false);
  const lastIterationTime = useRef<number>(-1);

  // Double-click detection
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickNote = useRef<SelectedNote | null>(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Highlight noteheads within the phrase selection range
  // Only highlights when both start and end are set (after second double-click)
  // Uses inline style.fill for reliable SVG element coloring (works on <use> elements)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Restore original fill and remove stored data
    container.querySelectorAll<SVGElement>('.vf-notehead[data-phrase-fill]')
      .forEach(el => {
        el.style.fill = el.getAttribute('data-phrase-fill') ?? '';
        el.removeAttribute('data-phrase-fill');
        el.classList.remove('phrase-selected');
      });

    // Also clean any that were left with the class but without data attribute
    container.querySelectorAll<SVGElement>('.vf-notehead.phrase-selected')
      .forEach(el => el.classList.remove('phrase-selected'));

    if (!phraseSelection?.endNote) return;

    const noteheads = getNoteElementsInRange(
      container,
      phraseSelection.startNote,
      phraseSelection.endNote,
    );
    noteheads.forEach(el => {
      // Save original fill
      const originalFill = el.style.fill || el.getAttribute('fill') || '';
      el.setAttribute('data-phrase-fill', originalFill);
      el.style.fill = '#f97316';
      el.classList.add('phrase-selected');
    });
  }, [phraseSelection]);

  // Render score when MusicXML changes
  useEffect(() => {
    if (!musicXml || !containerRef.current) return;

    setIsLoading(true);
    setError(null);

    const render = async () => {
      try {
        await renderOsmd(containerId, musicXml);

        // Get rendered dimensions
        const osmd = getOsmdInstance();
        if (osmd) {
          // Access graphic through type casting
          const graphic = osmd as unknown as { graphic: { MusicPages: { PositionAndShape: { Width: number; Height: number } }[] } };
          if (graphic?.graphic?.MusicPages?.length) {
            const pages = graphic.graphic.MusicPages;
            if (pages.length > 0) {
              const lastPage = pages[pages.length - 1];
              setDimensions({
                width: lastPage.PositionAndShape.Width,
                height: lastPage.PositionAndShape.Height,
              });
            }
          }
        }

        setIsLoading(false);
        if (osmd && onOsmdReady) {
          onOsmdReady(osmd);
        }
      } catch (err) {
        console.error('Error rendering score:', err);
        setError(err instanceof Error ? err.message : 'Failed to render score');
        setIsLoading(false);
      }
    };

    render();

    return () => {
      clearOsmd();
    };
  }, [musicXml, containerId, onOsmdReady]);

  // Handle note click with double-click detection
  const handleNoteClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) {
      console.log('[OsmdNotation] handleNoteClick: no container ref');
      return;
    }

    console.log('[OsmdNotation] handleNoteClick fired:', { clientX: event.clientX, clientY: event.clientY, targetTag: (event.target as Element)?.tagName });

    const note = findOsmdNoteAtPosition(event.clientX, event.clientY, event.target);
    if (!note) {
      console.log('[OsmdNotation] handleNoteClick: no note found');
      return;
    }

    const clickedNote: SelectedNote = {
      measureIndex: note.measureIndex,
      noteIndex: note.noteIndex,
    };
    const hasTimer = !!clickTimer.current;
    const last = lastClickNote.current;
    const isSameNote = last && last.measureIndex === clickedNote.measureIndex && last.noteIndex === clickedNote.noteIndex;

    // Check if this is a double-click (same note within 300ms)
    if (hasTimer && isSameNote) {
      clearTimeout(clickTimer.current!);
      clickTimer.current = null;
      lastClickNote.current = null;
      onPhraseNoteSelected?.(clickedNote);
      return;
    }

    // First click — wait to see if it's a double-click
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      if (onNoteSelect && lastClickNote.current) {
        onNoteSelect([lastClickNote.current]);
      }
    }

    lastClickNote.current = clickedNote;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      lastClickNote.current = null;
      if (onNoteSelect) {
        onNoteSelect([clickedNote]);
      }
    }, 300);
  }, [onNoteSelect, onPhraseNoteSelected]);

  // Drive OSMD cursor via PlaybackEngine events during playback
  useEffect(() => {
    const osmd = getOsmdInstance();
    if (!osmd || !playbackEngine) return;

    const handleStateChange = (state: PlaybackStateType) => {
      if (state === 'PLAYING') {
        cursorStepLocked.current = false;
        lastIterationTime.current = -1;
        cursorReset();
        requestAnimationFrame(() => {
          cursorShow();
        });
      } else if (state === 'STOPPED') {
        cursorStepLocked.current = false;
        cursorHide();
        cursorReset();
      }
    };

    const handleIteration = (entry: TimelineEntry) => {
      const eventTime = entry.time;
      if (cursorStepLocked.current) return;
      cursorStepLocked.current = true;

      const time = typeof eventTime === 'number' ? eventTime : -1;

      requestAnimationFrame(() => {
        // Detect loop wrap-around: time reset indicates the loop restarted
        if (time >= 0 && lastIterationTime.current >= 0 && time < lastIterationTime.current) {
          cursorReset();
        }

        cursorNext();
        lastIterationTime.current = time;
        cursorStepLocked.current = false;
      });
    };

    playbackEngine.on(PlaybackEvent.ITERATION, handleIteration);
    playbackEngine.on(PlaybackEvent.STATE_CHANGE, handleStateChange);
  }, [playbackEngine]);

  if (!musicXml) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-500">No music loaded</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`osmd-container ${className}`}
      onClick={handleNoteClick}
      style={{
        overflow: 'auto',
        padding: '1rem',
        position: 'relative',
        minHeight: '200px',
      }}
    >
      {/* Always render container for OSMD */}
      <div id={containerId} className="osmd-score" />

      {/* Phrase markers (visible after double-click selection) */}
      {phraseSelection && (
        <PhraseMarkers phraseSelection={phraseSelection} onClearPhrase={onClearPhrase} container={containerRef.current} />
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <p className="text-gray-500">Loading notation...</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50/90">
          <p className="text-red-500">Error: {error}</p>
        </div>
      )}
    </div>
  );
}

export default OsmdNotation;
