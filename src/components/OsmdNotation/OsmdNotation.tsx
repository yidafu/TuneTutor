/**
 * OSMD Notation Display Component
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { OpenSheetMusicDisplay, Note } from 'opensheetmusicdisplay';
import { renderOsmd, clearOsmd, getOsmdInstance, cursorShow, cursorHide } from '../../utils/notation/OsmdRender';
import { findOsmdNoteAtPosition } from '../../utils/notation/NoteInteraction';
import type { GraphicalNote } from 'opensheetmusicdisplay';
import { PlaybackEngine, PlaybackEvent } from '../../audio/PlaybackEngine';

export interface SelectedNote {
  measureIndex: number;
  noteIndex: number;
}

interface OsmdNotationProps {
  musicXml: string;
  onNoteSelect?: (notes: SelectedNote[], mode: 'replace' | 'add') => void;
  onOsmdReady?: (osmd: OpenSheetMusicDisplay) => void;
  playbackEngine?: PlaybackEngine;
  isPlaying?: boolean;
  indicatorMeasure?: number;
  indicatorNote?: number;
  className?: string;
}

export function OsmdNotation({
  musicXml,
  onNoteSelect,
  onOsmdReady,
  playbackEngine,
  isPlaying = false,
  indicatorMeasure = -1,
  indicatorNote = -1,
  className = '',
}: OsmdNotationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerId] = useState(() => `osmd-${Math.random().toString(36).substr(2, 9)}`);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDimensions] = useState({ width: 0, height: 0 });

  // Ref to track highlighted notes for cleanup
  const highlightedNotesRef = useRef<GraphicalNote[]>([]);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

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
  }, [musicXml, containerId]);

  // Handle note click
  const handleNoteClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left + container.scrollLeft;
    const y = event.clientY - rect.top + container.scrollTop;

    const note = findOsmdNoteAtPosition(x, y);
    if (note && onNoteSelect) {
      const clickedNote: SelectedNote = {
        measureIndex: note.measureIndex,
        noteIndex: note.noteIndex,
      };
      onNoteSelect([clickedNote], 'replace');
    }
  }, [onNoteSelect]);

  // Update cursor position based on playing state
  useEffect(() => {
    const osmd = getOsmdInstance();
    if (!osmd?.cursor) return;

    if (isPlaying && indicatorMeasure >= 0) {
      cursorShow();
    } else {
      cursorHide();
    }
  }, [isPlaying, indicatorMeasure, indicatorNote]);

  // Subscribe to PlaybackEngine events for note highlighting
  useEffect(() => {
    const osmd = getOsmdInstance();
    if (!osmd || !playbackEngine) return;

    osmdRef.current = osmd;

    const handleIteration = (notes: unknown[]) => {
      // Clear previous highlights
      highlightedNotesRef.current.forEach((gNote) => {
        gNote.setColor('black', { applyToNoteheads: true, applyToStem: true });
      });
      highlightedNotesRef.current = [];

      // Highlight current notes
      const typedNotes = notes as Note[];
      for (const note of typedNotes) {
        const gnote = osmd.EngravingRules.GNote(note);
        if (gnote) {
          gnote.setColor('#3b82f6', { applyToNoteheads: true, applyToStem: true });
          highlightedNotesRef.current.push(gnote);
        }
      }
    };

    const handleStateChange = (state: unknown) => {
      // When playback stops, clear all highlights
      if (state === 'STOPPED') {
        highlightedNotesRef.current.forEach((gNote) => {
          gNote.setColor('black', { applyToNoteheads: true, applyToStem: true });
        });
        highlightedNotesRef.current = [];
      }
    };

    playbackEngine.on(PlaybackEvent.ITERATION, handleIteration);
    playbackEngine.on(PlaybackEvent.STATE_CHANGE, handleStateChange);

    return () => {
      // Cleanup: clear highlights when unmounting
      highlightedNotesRef.current.forEach((gNote) => {
        gNote.setColor('black', { applyToNoteheads: true, applyToStem: true });
      });
      highlightedNotesRef.current = [];
    };
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