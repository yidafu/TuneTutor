/**
 * Notation Display component using VexFlow
 * Main component responsible for coordination and layout
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styles from './NotationDisplay.module.css';
import type { ParsedScore, SelectedNote } from '../../types/notation';
import type { RowHighlight, RowSelection, SelectionRect } from '../../types/selection';
import {
  renderScore,
  clearNotationContainer,
  getNotePositions,
  noteBoundsCache,
  getSelectionRects,
  rowConfigsCache,
  STAVE_WIDTH,
  TOP_Y,
  STAVE_HEIGHT,
} from '../../utils/notation';
import { useNoteSelection, calculateRowHighlights, calculateRowSelections } from '../../hooks/useNoteSelection';
import { PlayButton } from './PlayButton';
import { SelectionCanvas } from './SelectionCanvas';
import { Indicator } from './Indicator';

// Global ref to access the container from outside
let globalContainerRef: React.RefObject<HTMLDivElement | null> | null = null;

interface NotationDisplayProps {
  score?: ParsedScore | null;
  selectedNotes?: SelectedNote[];
  onNoteSelect?: (notes: SelectedNote[], mode: 'replace' | 'add') => void;
  onPlay?: (notes: SelectedNote[]) => void;
  // Playback indicator props
  isPlaying?: boolean;
  indicatorX?: number;
  indicatorRowIndex?: number;
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function NotationDisplay({
  score: propScore,
  selectedNotes = [],
  onNoteSelect,
  onPlay,
  isPlaying = false,
  indicatorX = 0,
  indicatorRowIndex = 0,
  className = '',
  containerRef,
}: NotationDisplayProps) {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const activeContainerRef = containerRef || innerContainerRef;

  // Set global ref for external access (e.g., playback indicator)
  useEffect(() => {
    globalContainerRef = innerContainerRef;
    return () => {
      globalContainerRef = null;
    };
  }, []);

  const [containerId] = useState(() => `vexflow-${Math.random().toString(36).substr(2, 9)}`);
  const [containerWidth, setContainerWidth] = useState(0);

  const score = propScore || null;

  const [selectionState, selectionActions] = useNoteSelection();

  // Unified pointer state (replaces isMouseDown + touch refs)
  const [pointerState, setPointerState] = useState<{
    isDown: boolean;
    x: number;
    y: number;
    startX: number;
    startY: number;
    timestamp: number;
  }>({
    isDown: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    timestamp: 0,
  });

  // Unified get event coordinates (PC/iPad compatible)
  const getEventCoords = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const container = activeContainerRef.current;
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return { x: 0, y: 0 };

    const style = window.getComputedStyle(container);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;

    let clientX: number, clientY: number;

    // Handle both mouse and touch events uniformly
    if ('touches' in event) {
      const touchList = event.touches.length > 0 ? event.touches : event.changedTouches;
      if (touchList.length === 0) return { x: 0, y: 0 };
      clientX = touchList[0].clientX;
      clientY = touchList[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left - paddingLeft + (container.scrollLeft || 0),
      y: clientY - rect.top - paddingTop + (container.scrollTop || 0),
    };
  }, []);

  // Find note at position
  const findNoteAtPosition = useCallback((x: number, y: number): SelectedNote | null => {
    const notePositions = getNotePositions();
    for (const note of notePositions) {
      if (
        x >= note.x &&
        x <= note.x + note.width &&
        y >= note.y &&
        y <= note.y + note.height
      ) {
        return { measureIndex: note.measureIndex, noteIndex: note.noteIndex };
      }
    }
    return null;
  }, []);

  // Find the nearest note to the given position (for empty space clicks)
  const findNearestNote = useCallback((x: number, y: number): SelectedNote | null => {
    const notePositions = getNotePositions();
    let nearestNote: SelectedNote | null = null;
    let minDistance = Infinity;

    for (const note of notePositions) {
      const noteCenterX = note.x + note.width / 2;
      const noteCenterY = note.y + note.height / 2;
      const distance = Math.sqrt(Math.pow(x - noteCenterX, 2) + Math.pow(y - noteCenterY, 2));

      if (distance < minDistance) {
        minDistance = distance;
        nearestNote = { measureIndex: note.measureIndex, noteIndex: note.noteIndex };
      }
    }

    return nearestNote;
  }, []);

  // Resize observer to track container width
  useEffect(() => {
    if (!activeContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(activeContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Row configurations for multi-row rendering
  const rowConfigs = useMemo(() => {
    if (!score || rowConfigsCache.length === 0) return [];
    return rowConfigsCache;
  }, [score]);

  // Render score when it changes or container is resized
  useEffect(() => {
    if (!score || !activeContainerRef.current || containerWidth === 0) return;

    clearNotationContainer(containerId);

    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'vexflow-renderer';
      activeContainerRef.current.appendChild(container);
    }

    try {
      renderScore(containerId, score, { staveWidth: STAVE_WIDTH });

      if (activeContainerRef.current) {
        activeContainerRef.current.style.overflowY = 'auto';
        activeContainerRef.current.style.overflowX = 'hidden';
        activeContainerRef.current.style.padding = '1rem';
      }
    } catch (error) {
      console.error('Error rendering score:', error);
    }
  }, [score, containerId, containerWidth]);

  // Highlight selected notes and dim notes outside range
  useEffect(() => {
    if (!activeContainerRef.current) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('[data-measure]').forEach((el) => {
      el.classList.remove('dimmed');
    });

    if (selectionState.selectionRange) {
      const notesInSelection = selectionActions.getNotesInRange(selectionState.selectionRange, getNotePositions());
      const notesSet = new Set(notesInSelection.map(n => `${n.measureIndex}-${n.noteIndex}`));
      container.querySelectorAll('[data-measure]').forEach((noteEl) => {
        const measureIndex = parseInt(noteEl.getAttribute('data-measure') || '0');
        const noteIndex = parseInt(noteEl.getAttribute('data-note') || '0');
        const noteKey = `${measureIndex}-${noteIndex}`;
        if (!notesSet.has(noteKey)) {
          noteEl.classList.add('dimmed');
        }
      });
    }
  }, [selectionState.selectionRange, selectionActions, containerId]);

  // Check if click is on a handle
  const isOnHandle = useCallback((x: number, y: number): 'start' | 'end' | null => {
    if (!selectionState.selectionRange) return null;

    const handleY = TOP_Y - 30;
    const handleWidth = 38;
    const handleHeight = 80;

    const hitLeft = x >= selectionState.selectionRange.startX - handleWidth / 2 &&
                    x <= selectionState.selectionRange.startX + handleWidth / 2 &&
                    y >= handleY - 20 &&
                    y <= handleY + handleHeight;
    if (hitLeft) return 'start';

    const hitRight = x >= selectionState.selectionRange.endX - handleWidth / 2 &&
                     x <= selectionState.selectionRange.endX + handleWidth / 2 &&
                     y >= handleY - 20 &&
                     y <= handleY + handleHeight;
    if (hitRight) return 'end';

    return null;
  }, [selectionState.selectionRange]);

  // Handle pointer down - unified for PC and iPad
  const handlePointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!score) return;

      const { x, y } = getEventCoords(event);

      // Update pointer state
      setPointerState(prev => ({
        ...prev,
        isDown: true,
        x,
        y,
        startX: x,
        startY: y,
        timestamp: Date.now(),
      }));

      const handle = isOnHandle(x, y);
      if (handle) {
        selectionActions.setActiveHandle(handle);
        return;
      }

      const clickedNoteBounds = findNoteAtPosition(x, y);
      if (clickedNoteBounds) {
        const clickedNote: SelectedNote = {
          measureIndex: clickedNoteBounds.measureIndex,
          noteIndex: clickedNoteBounds.noteIndex,
        };
        // Check if note is already selected
        const isNoteSelected = selectionState.selectedNotes.some(
          n => n.measureIndex === clickedNote.measureIndex && n.noteIndex === clickedNote.noteIndex
        );
        // Toggle selection: if already selected, deselect; otherwise select
        const mode: 'toggle' | 'replace' = isNoteSelected || event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
        selectionActions.selectNote(clickedNote, mode, false);
        if (onNoteSelect) {
          if (mode === 'toggle' && isNoteSelected) {
            // Deselect: send empty array
            onNoteSelect(selectionState.selectedNotes.filter(
              n => !(n.measureIndex === clickedNote.measureIndex && n.noteIndex === clickedNote.noteIndex)
            ), 'replace');
          } else {
            onNoteSelect([clickedNote], 'replace');
          }
        }
        return;
      }

      // Start X-axis range selection with startNote
      const clickedNote = findNoteAtPosition(x, y);
      let startNote: SelectedNote | undefined;
      if (clickedNote) {
        startNote = { measureIndex: clickedNote.measureIndex, noteIndex: clickedNote.noteIndex };
      } else {
        const nearestNote = findNearestNote(x, y);
        if (nearestNote) {
          startNote = nearestNote;
        }
      }
      selectionActions.startRangeSelection(x, y, startNote);
    },
    [score, selectionActions, getEventCoords, isOnHandle, onNoteSelect, findNoteAtPosition, findNearestNote, selectionState.selectedNotes]
  );

  // Handle pointer move - unified for PC and iPad
  const handlePointerMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const { x, y } = getEventCoords(event);

      // Update pointer state
      setPointerState(prev => ({ ...prev, x, y }));

      // Update cursor
      if (activeContainerRef.current) {
        const handle = isOnHandle(x, 0);
        activeContainerRef.current.style.cursor = handle ? 'ew-resize' :
          (selectionState.isRangeSelecting) ? 'crosshair' : 'default';
      }

      if (!pointerState.isDown) return;

      if (selectionState.activeHandle) {
        selectionActions.moveRangeHandle(selectionState.activeHandle, x);
        return;
      }

      if (selectionState.isRangeSelecting) {
        const clickedNote = findNoteAtPosition(x, y);
        let endNote: SelectedNote | undefined;
        if (clickedNote) {
          endNote = { measureIndex: clickedNote.measureIndex, noteIndex: clickedNote.noteIndex };
        } else {
          const nearestNote = findNearestNote(x, y);
          if (nearestNote) {
            endNote = nearestNote;
          }
        }
        selectionActions.updateRangeSelection(x, y, endNote);
      }
    },
    [pointerState.isDown, selectionState, selectionActions, getEventCoords, isOnHandle, findNoteAtPosition, findNearestNote]
  );

  // Handle pointer up - unified for PC and iPad
  const handlePointerUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const { x, y } = getEventCoords(event);

      // Reset pointer state
      setPointerState(prev => ({ ...prev, isDown: false }));

      // Handle range selection completion
      if (selectionState.activeHandle || selectionState.isRangeSelecting) {
        if (selectionState.selectionRange && onNoteSelect) {
          if (selectionState.selectionRange.startNote && selectionState.selectionRange.endNote) {
            const startNoteBounds = noteBoundsCache.find(
              n => n.measureIndex === selectionState.selectionRange!.startNote!.measureIndex &&
                   n.noteIndex === selectionState.selectionRange!.startNote!.noteIndex
            );
            const endNoteBounds = noteBoundsCache.find(
              n => n.measureIndex === selectionState.selectionRange!.endNote!.measureIndex &&
                   n.noteIndex === selectionState.selectionRange!.endNote!.noteIndex
            );
            if (startNoteBounds && endNoteBounds) {
              const rects = getSelectionRects(startNoteBounds, endNoteBounds);
              const notesInRange: SelectedNote[] = [];
              for (const rect of rects) {
                const rowNotes = noteBoundsCache.filter(n => n.rowIndex === rect.rowIndex);
                for (const note of rowNotes) {
                  if (note.x >= rect.startX && note.x + note.width <= rect.endX) {
                    notesInRange.push({ measureIndex: note.measureIndex, noteIndex: note.noteIndex });
                  }
                }
              }
              if (notesInRange.length > 0) {
                onNoteSelect(notesInRange, 'replace');
              }
            }
          } else {
            const notes = selectionActions.getNotesInRange(selectionState.selectionRange, getNotePositions());
            if (notes.length > 0) {
              onNoteSelect(notes, 'replace');
            }
          }
        }
        selectionActions.endRangeSelection();
        return;
      }

      // Click on empty space - clear selection
      // Only clear if this is not a mouse leave event (which doesn't have meaningful coordinates)
      const isMouseLeaveEvent = event.type === 'mouseleave';
      if (!isMouseLeaveEvent && !isOnHandle(x, y) && onNoteSelect) {
        onNoteSelect([], 'replace');
      }
    },
    [selectionState, onNoteSelect, selectionActions, getEventCoords, isOnHandle, noteBoundsCache, getSelectionRects]
  );

  // Calculate row highlights for range selection
  const rowHighlights = useMemo(() => {
    return calculateRowHighlights(selectionState.selectionRange);
  }, [selectionState.selectionRange]);

  // Calculate row selections for selected notes
  const rowSelections = useMemo(
    () => calculateRowSelections(selectedNotes, rowConfigs, getNotePositions),
    [selectedNotes, rowConfigs]
  );

  // Helper to convert selection items to SelectionRect
  const toSelectionRects = (items: RowHighlight[] | RowSelection[], type: 'range' | 'note'): SelectionRect[] =>
    items.map((item) => ({
      rowIndex: item.row.rowIndex,
      rowY: item.row.y,
      rowHeight: STAVE_HEIGHT,
      startX: item.lineStartX,
      endX: item.lineEndX,
      selectionType: type,
    }));

  // Convert to SelectionRect for SelectionCanvas
  const rangeSelections = useMemo(() => toSelectionRects(rowHighlights, 'range'), [rowHighlights]);
  const noteSelections = useMemo(() => toSelectionRects(rowSelections, 'note'), [rowSelections]);

  // Merge all selections into a single array for the SelectionCanvas
  const allSelections = useMemo((): SelectionRect[] => {
    return [...rangeSelections, ...noteSelections];
  }, [rangeSelections, noteSelections]);

  if (!score) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-500">Loading notation...</p>
      </div>
    );
  }

  return (
    <div
      ref={activeContainerRef}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      className={`${styles.container} ${className}`}
    >
      <div id={containerId} className="vexflow-container" />

      {/* Selection overlay - merged range and note selections */}
      <SelectionCanvas selections={allSelections} />

      {/* Playback indicator */}
      <Indicator
        x={indicatorX}
        visible={isPlaying}
        rowIndex={indicatorRowIndex}
      />

      {/* Play button */}
      {onPlay && <PlayButton selectedNotes={selectedNotes} onPlay={onPlay} />}
    </div>
  );
}

/**
 * Create a playback indicator element
 * @param container The container element to append the indicator to
 * @returns The created indicator element
 */
export function createPlaybackIndicator(container: HTMLElement | null): HTMLDivElement {
  const indicator = document.createElement('div');
  indicator.className = styles.playbackIndicator;
  if (container) {
    container.appendChild(indicator);
  }
  return indicator;
}

/**
 * Remove the playback indicator element
 * @param indicator The indicator element to remove
 */
export function removePlaybackIndicator(indicator: HTMLDivElement | null): void {
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }
}

/**
 * Export function to get container for playback indicator
 */
export function getNotationContainerElement(): HTMLElement | null {
  return globalContainerRef?.current ?? null;
}

export default NotationDisplay;
