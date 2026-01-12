/**
 * Notation Display component using VexFlow
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { ParsedScore, SelectedNote } from '../../types/notation';
import {
  renderScore,
  clearNotationContainer,
  getNotePositions,
  getRowConfigs,
} from '../../utils/notation/vexflowHelpers';
import { useNoteSelection } from '../../hooks/useNoteSelection';

interface NotationDisplayProps {
  score?: ParsedScore | null;
  currentMeasure?: number;
  selectedNotes?: SelectedNote[];
  onNoteSelect?: (notes: SelectedNote[], mode: 'replace' | 'add') => void;
  onPlay?: (notes: SelectedNote[]) => void;
  className?: string;
}

export function NotationDisplay({
  score: propScore,
  currentMeasure = -1,
  selectedNotes = [],
  onNoteSelect,
  onPlay,
  className = '',
}: NotationDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerId] = useState(() => `vexflow-${Math.random().toString(36).substr(2, 9)}`);
  const [containerWidth, setContainerWidth] = useState(0);

  const score = propScore || null;

  const [selectionState, selectionActions] = useNoteSelection();
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Touch state for iPad support
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isTouchDraggingRef = useRef(false);
  const TOUCH_THRESHOLD = 10;

  // Layout constants
  const STAVE_WIDTH = 200;
  const STAVE_PADDING = 10;
  const PADDING = 20;
  const TOP_Y = 50;
  const STAVE_HEIGHT = 80;
  const MEASURES_PER_ROW = 5;

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

  // Resize observer to track container width
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Row configurations for multi-row rendering
  const rowConfigs = useMemo(() => {
    if (!score) return [];
    return getRowConfigs(score.measures.length, { measuresPerRow: MEASURES_PER_ROW, staveWidth: STAVE_WIDTH });
  }, [score]);

  // Render score when it changes or container is resized
  useEffect(() => {
    if (!score || !containerRef.current || containerWidth === 0) return;

    clearNotationContainer(containerId);

    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'vexflow-renderer';
      containerRef.current.appendChild(container);
    }

    try {
      renderScore(containerId, score, {
        staveWidth: STAVE_WIDTH,
        currentMeasure,
      });

      if (containerRef.current) {
        containerRef.current.style.overflowY = 'auto';
        containerRef.current.style.overflowX = 'hidden';
        containerRef.current.style.padding = '1rem';
      }
    } catch (error) {
      console.error('Error rendering score:', error);
    }
  }, [score, containerId, currentMeasure, containerWidth]);

  // Highlight selected notes and dim notes outside range
  useEffect(() => {
    if (!containerRef.current) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.selected-note-highlight').forEach((el) => el.remove());

    container.querySelectorAll('[data-measure]').forEach((el) => {
      el.classList.remove('dimmed');
    });

    if (selectionState.selectionRange || selectionState.selectionRect) {
      const notesInSelection = selectionState.selectionRange
        ? selectionActions.getNotesInRange(selectionState.selectionRange, getNotePositions())
        : selectionActions.getNotesInRect(selectionState.selectionRect!, getNotePositions());

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

    selectedNotes.forEach(({ measureIndex, noteIndex }) => {
      const noteElement = container.querySelector(
        `[data-measure="${measureIndex}"][data-note="${noteIndex}"]`
      );
      if (noteElement) {
        const rect = noteElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        highlight.classList.add('selected-note-highlight');
        highlight.setAttribute('x', String(rect.left - containerRect.left - 2));
        highlight.setAttribute('y', String(rect.top - containerRect.top - 2));
        highlight.setAttribute('width', String(rect.width + 4));
        highlight.setAttribute('height', String(rect.height + 4));
        highlight.setAttribute('fill', 'none');
        highlight.setAttribute('stroke', '#3b82f6');
        highlight.setAttribute('stroke-width', '2');
        highlight.setAttribute('rx', '4');

        const svg = container.querySelector('svg');
        if (svg) {
          svg.appendChild(highlight);
        }
      }
    });
  }, [selectedNotes, containerId, selectionState.selectionRange, selectionState.selectionRect, selectionActions]);

  // Get event coordinates
  const getEventCoords = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    let clientX: number, clientY: number;

    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left + (containerRef.current?.scrollLeft || 0),
      y: clientY - rect.top,
    };
  }, []);

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

  // Handle pointer down
  const handlePointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!score) return;

      const { x, y } = getEventCoords(event);

      if ('touches' in event) {
        touchStartRef.current = { x, y };
        isTouchDraggingRef.current = false;
      } else {
        setIsMouseDown(true);

        const handle = isOnHandle(x, y);
        if (handle) {
          selectionActions.setActiveHandle(handle);
          return;
        }

        const clickedNote = findNoteAtPosition(x, y);
        if (clickedNote) {
          const isCtrlPressed = event.ctrlKey || event.metaKey;
          selectionActions.selectNote(clickedNote, isCtrlPressed ? 'toggle' : 'replace', false);
          if (onNoteSelect) {
            onNoteSelect(selectionState.selectedNotes, 'replace');
          }
          return;
        }

        selectionActions.startBoxSelection(x, y);
      }
    },
    [score, selectionActions, getEventCoords, isOnHandle, onNoteSelect, selectionState.selectedNotes]
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const { x, y } = getEventCoords(event);

      if (containerRef.current) {
        const handle = isOnHandle(x, y);
        containerRef.current.style.cursor = handle ? 'ew-resize' :
          (selectionState.isRangeSelecting || selectionState.isBoxSelecting) ? 'crosshair' : 'default';
      }

      if ('touches' in event && touchStartRef.current) {
        const deltaX = Math.abs(x - touchStartRef.current.x);
        const deltaY = Math.abs(y - touchStartRef.current.y);
        if (deltaX > TOUCH_THRESHOLD || deltaY > TOUCH_THRESHOLD) {
          isTouchDraggingRef.current = true;
          selectionActions.startRangeSelection(touchStartRef.current.x);
          selectionActions.updateRangeSelection(x);
        }
        return;
      }

      if (!isMouseDown) return;

      if (selectionState.activeHandle) {
        selectionActions.moveRangeHandle(selectionState.activeHandle, x);
        return;
      }

      if (selectionState.isBoxSelecting) {
        selectionActions.updateBoxSelection(x, y);
        return;
      }

      if (selectionState.isRangeSelecting) {
        selectionActions.updateRangeSelection(x);
      }
    },
    [isMouseDown, selectionState, selectionActions, getEventCoords, isOnHandle]
  );

  // Handle pointer up
  const handlePointerUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const { x, y } = getEventCoords(event);

      if ('touches' in event) {
        if (!isTouchDraggingRef.current && touchStartRef.current) {
          const clickedNote = findNoteAtPosition(x, y);
          if (clickedNote && onNoteSelect) {
            const isCtrlPressed = event.ctrlKey || event.metaKey;
            selectionActions.selectNote(clickedNote, isCtrlPressed ? 'toggle' : 'replace', false);
            if (isCtrlPressed) {
              onNoteSelect(selectionState.selectedNotes, 'replace');
            }
          }
        }
        touchStartRef.current = null;
        isTouchDraggingRef.current = false;
        selectionActions.endRangeSelection();
        return;
      }

      if (!isMouseDown) return;
      setIsMouseDown(false);

      if (selectionState.isBoxSelecting) {
        if (selectionState.selectionRect && onNoteSelect) {
          const notes = selectionActions.getNotesInRect(selectionState.selectionRect, getNotePositions());
          if (notes.length > 0) {
            onNoteSelect(notes, 'replace');
          }
        }
        selectionActions.endBoxSelection();
        return;
      }

      if (selectionState.activeHandle || selectionState.isRangeSelecting) {
        if (selectionState.selectionRange && onNoteSelect) {
          const notes = selectionActions.getNotesInRange(selectionState.selectionRange, getNotePositions());
          if (notes.length > 0) {
            onNoteSelect(notes, 'replace');
          }
        }
        selectionActions.endRangeSelection();
        return;
      }

      if (!isOnHandle(x, y) && onNoteSelect) {
        onNoteSelect([], 'replace');
      }
    },
    [isMouseDown, selectionState, onNoteSelect, selectionActions, getEventCoords, isOnHandle]
  );

  // Calculate row highlights
  const rowHighlights = useMemo(() => {
    if (!selectionState.selectionRange || rowConfigs.length === 0) return [];

    return rowConfigs.map(row => {
      const rowStartX = PADDING;
      const rowEndX = PADDING + (row.endMeasure - row.startMeasure) * (STAVE_WIDTH + STAVE_PADDING) + STAVE_WIDTH;
      const lineStartX = Math.max(selectionState.selectionRange!.startX, rowStartX);
      const lineEndX = Math.min(selectionState.selectionRange!.endX, rowEndX);

      if (lineStartX >= lineEndX) return null;

      return { row, lineStartX, lineEndX };
    }).filter(Boolean);
  }, [selectionState.selectionRange, rowConfigs]);

  if (!score) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-500">Loading notation...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      className={`notation-display ${className}`}
      style={{
        cursor: 'default',
        userSelect: 'none',
        position: 'relative',
        touchAction: 'none',
      }}
    >
      <style>{`
        .dimmed {
          opacity: 0.4;
          filter: grayscale(100%);
          transition: opacity 0.2s, filter 0.2s;
        }
        .range-mask {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 50;
        }
        .range-line {
          position: absolute;
          width: 2px;
          background-color: #3b82f6;
          pointer-events: none;
        }
        .range-line-handle {
          width: 14px;
          height: 14px;
          background-color: #3b82f6;
          border: 2px solid white;
          border-radius: 50%;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          z-index: 51;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: transform 0.15s, box-shadow 0.15s, background-color 0.15s;
          cursor: ew-resize;
        }
        .range-line-handle:hover {
          transform: translateX(-50%) scale(1.2);
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
          background-color: #2563eb;
        }
        .range-line-start .range-line-handle {
          top: -7px;
        }
        .range-line-end .range-line-handle {
          bottom: -7px;
        }
        .range-highlight-bar {
          position: absolute;
          height: 4px;
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.25) 100%);
          border-radius: 2px;
          pointer-events: none;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
        }
        .range-info-tooltip {
          position: absolute;
          transform: translateX(-50%);
          background-color: rgba(59, 130, 246, 0.9);
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          z-index: 60;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          pointer-events: none;
        }
        .range-info-tooltip::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 4px solid rgba(59, 130, 246, 0.9);
        }
        .range-connector {
          position: absolute;
          width: 2px;
          background: repeating-linear-gradient(
            to bottom,
            #3b82f6 0px,
            #3b82f6 4px,
            transparent 4px,
            transparent 8px
          );
          pointer-events: none;
        }
        .box-selection-rect {
          position: absolute;
          border: 1px dashed #3b82f6;
          background-color: rgba(59, 130, 246, 0.1);
          pointer-events: none;
          z-index: 100;
        }
        .selected-note-highlight {
          animation: notePopIn 0.2s ease-out;
        }
        @keyframes notePopIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>

      <div id={containerId} className="vexflow-container" />

      {/* Range selection overlay */}
      {selectionState.selectionRange && (
        <div className="range-mask">
          {/* Range info tooltip - show on first row */}
          {(() => {
            const notesInRange = selectionActions.getNotesInRange(selectionState.selectionRange, getNotePositions());
            const startMeasure = Math.min(...notesInRange.map(n => n.measureIndex)) + 1;
            const endMeasure = Math.max(...notesInRange.map(n => n.measureIndex)) + 1;
            const tooltipX = (selectionState.selectionRange.startX + selectionState.selectionRange.endX) / 2;

            return (
              <div
                className="range-info-tooltip"
                style={{
                  left: tooltipX,
                  top: rowConfigs[0]?.y ? rowConfigs[0].y - 45 : TOP_Y - 45,
                }}
              >
                Measures {startMeasure}-{endMeasure} ({notesInRange.length} notes)
              </div>
            );
          })()}

          {rowHighlights.map((item: any, index: number) => {
            const prevItem = rowHighlights[index - 1];
            return (
            <React.Fragment key={`highlight-${item.row.startMeasure}`}>
              {/* Multi-row connector from previous row */}
              {index > 0 && prevItem && (
                <div
                  className="range-connector"
                  style={{
                    left: prevItem.lineEndX,
                    top: prevItem.row.y + STAVE_HEIGHT,
                    height: item.row.y - (prevItem.row.y + STAVE_HEIGHT),
                  }}
                />
              )}
              <div
                className="range-highlight-bar"
                style={{ left: item.lineStartX, top: item.row.y - 18, width: item.lineEndX - item.lineStartX }}
              />
              <div className="range-line range-line-start" style={{ left: item.lineStartX, top: item.row.y, height: STAVE_HEIGHT }}>
                <div className="range-line-handle" />
              </div>
              <div className="range-line range-line-end" style={{ left: item.lineEndX, top: item.row.y, height: STAVE_HEIGHT }}>
                <div className="range-line-handle" />
              </div>
            </React.Fragment>
          );
          })}
        </div>
      )}

      {/* Box selection overlay */}
      {selectionState.selectionRect && (
        <div
          className="box-selection-rect"
          style={{
            left: selectionState.selectionRect.x,
            top: selectionState.selectionRect.y,
            width: selectionState.selectionRect.width,
            height: selectionState.selectionRect.height,
          }}
        />
      )}

      {/* Play button for selected notes */}
      {onPlay && selectedNotes.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(selectedNotes);
          }}
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          播放 ({selectedNotes.length})
        </button>
      )}
    </div>
  );
}

export default NotationDisplay;
