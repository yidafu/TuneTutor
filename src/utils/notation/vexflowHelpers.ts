/**
 * VexFlow helper utilities for music notation rendering
 */

import * as VexFlow from 'vexflow';
import type { Measure, ParsedScore, NotePosition, Note } from '../../types/notation';

const VF = VexFlow;

// Global store for note references (for bounding box access)
let noteRefsStore: { measureIndex: number; noteIndex: number; note: VexFlow.StaveNote }[] = [];

// Layout constants
const STAVE_WIDTH = 100;
const STAVE_HEIGHT = 80;
const PADDING = 20;
const STAVE_PADDING = 0;
const ROW_SPACING = 30;
const TOP_Y = 50;

/**
 * Calculate score layout for automatic wrapping
 */
export interface RowConfig {
  startMeasure: number;
  endMeasure: number;
  rowIndex: number;
  y: number;
}

export interface ScoreLayout {
  measuresPerRow: number;
  totalRows: number;
  svgWidth: number;
  svgHeight: number;
  rowConfigs: RowConfig[];
}

export function calculateScoreLayout(
  measureCount: number,
  options: {
    staveWidth?: number;
    padding?: number;
    stavePadding?: number;
    rowSpacing?: number;
    topY?: number;
    measuresPerRow?: number;
  } = {}
): ScoreLayout {
  const {
    staveWidth = STAVE_WIDTH,
    padding = PADDING,
    stavePadding = STAVE_PADDING,
    rowSpacing = ROW_SPACING,
    topY = TOP_Y,
    measuresPerRow = 4,
  } = options;

  // Total rows needed
  const totalRows = Math.ceil(measureCount / measuresPerRow);

  // SVG dimensions
  const svgWidth = padding + measuresPerRow * staveWidth + (measuresPerRow - 1) * stavePadding;
  const svgHeight = topY + totalRows * (STAVE_HEIGHT + rowSpacing) + 20;

  // Generate row configurations
  const rowConfigs: RowConfig[] = [];
  for (let row = 0; row < totalRows; row++) {
    const startMeasure = row * measuresPerRow;
    const endMeasure = Math.min(startMeasure + measuresPerRow - 1, measureCount - 1);
    rowConfigs.push({
      startMeasure,
      endMeasure,
      rowIndex: row,
      y: topY + row * (STAVE_HEIGHT + rowSpacing),
    });
  }

  return {
    measuresPerRow,
    totalRows,
    svgWidth,
    svgHeight,
    rowConfigs,
  };
}

// Colors for measure states
const COLORS = {
  selected: '#dbeafe', // blue-100
  playing: '#fef08a',  // yellow-200
  default: '#ffffff',
  border: '#e5e7eb',   // gray-200
  hover: '#eff6ff',    // blue-50
};

// Helper to create a note with all required fields
const createNote = (pitch: string, duration: string, octave: number): Note => ({
  pitch,
  duration,
  durationValue: 1,
  octave,
  isRest: false,
  dots: 0,
});

/**
 * Create a simple score for demonstration (Twinkle Twinkle Little Star)
 */
export function createDemoScore(): ParsedScore {
  const measures: Measure[] = [
    { index: 0, notes: [createNote('C4', 'q', 4), createNote('C4', 'q', 4)] },
    { index: 1, notes: [createNote('G4', 'q', 4), createNote('G4', 'q', 4)] },
    { index: 2, notes: [createNote('A4', 'q', 4), createNote('A4', 'q', 4)] },
    { index: 3, notes: [createNote('G4', 'h', 4)] },
    { index: 4, notes: [createNote('F4', 'q', 4), createNote('F4', 'q', 4)] },
    { index: 5, notes: [createNote('E4', 'q', 4), createNote('E4', 'q', 4)] },
    { index: 6, notes: [createNote('D4', 'q', 4), createNote('D4', 'q', 4)] },
    { index: 7, notes: [createNote('C4', 'h', 4)] },
  ];

  return {
    title: 'Twinkle Twinkle Little Star',
    composer: 'Traditional',
    measures,
    tempo: 120,
    timeSignature: '4/4',
    keySignature: 'C',
    divisions: 1,
  };
}

/**
 * Render a complete score using VexFlow with Canvas backend
 */
export function renderScore(
  containerId: string,
  score: ParsedScore,
  options: {
    staveWidth?: number;
    onMeasureClick?: (measureIndex: number) => void;
    selectedMeasures?: number[];
    currentMeasure?: number;
  } = {}
): void {
  const {
    staveWidth = 100,
    selectedMeasures = [],
    currentMeasure = -1,
  } = options;

  // Calculate layout for auto-wrapping
  const layout = calculateScoreLayout(score.measures.length, { staveWidth });

  // Get or create container
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'vexflow-renderer';
  }

  // Clear previous content
  container.innerHTML = '';

  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.width = layout.svgWidth;
  canvas.height = layout.svgHeight;
  container.appendChild(canvas);

  // Create renderer with Canvas backend
  const renderer = new VF.Renderer(canvas, VF.Renderer.Backends.CANVAS);
  renderer.resize(layout.svgWidth, layout.svgHeight);
  // VexFlow RenderContext for stave and notes
  const vfContext = renderer.getContext();
  // Configure Bravura font for music symbols
  vfContext.setFont('Bravura', 14);
  // CanvasRenderingContext2D for background and text
  const ctx = canvas.getContext('2d')!;

  // Helper function to get color for selection state
  function getSelectionColor(isPlaying: boolean, isSelected: boolean): { fill: string; stroke: string } | null {
    if (isPlaying) return { fill: COLORS.playing, stroke: '#eab308' };
    if (isSelected) return { fill: COLORS.selected, stroke: '#3b82f6' };
    return null;
  }

  // Render each row
  layout.rowConfigs.forEach((rowConfig) => {
    // Render each measure in this row
    for (let measureIndex = rowConfig.startMeasure; measureIndex <= rowConfig.endMeasure; measureIndex++) {
      const measure = score.measures[measureIndex];
      const indexInRow = measureIndex - rowConfig.startMeasure;
      const x = PADDING + indexInRow * (staveWidth + STAVE_PADDING);
      const stave = new VF.Stave(x, rowConfig.y, staveWidth);

      // Draw measure background first
      const isSelected = selectedMeasures.includes(measureIndex);
      const isPlaying = measureIndex === currentMeasure;
      const selectionColor = getSelectionColor(isPlaying, isSelected);

      if (selectionColor) {
        ctx.fillStyle = selectionColor.fill;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, rowConfig.y - 10, staveWidth, STAVE_HEIGHT + 20);
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = selectionColor.stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, rowConfig.y - 10, staveWidth, STAVE_HEIGHT + 20);
      }

      // Add time signature to first stave of first row
      if (measureIndex === 0) {
        stave.addTimeSignature(score.timeSignature);
        stave.setContext(vfContext).draw();
      } else {
        stave.setContext(vfContext).draw();
      }

      // Create notes for this measure
      const notes = measure.notes.map((note, noteIndex) => {
        // pitch is "C4" format, extract letter and octave
        // VexFlow expects keys like "c/4" (lowercase, octave after slash)
        const noteLetter = note.pitch.charAt(0).toLowerCase();
        const octave = note.pitch.slice(-1);
        const noteKey = `${noteLetter}/${octave}`;
        const staveNote = new VF.StaveNote({ keys: [noteKey], duration: note.duration });

        // Add accidental if needed
        if (note.accidentals) {
          staveNote.addModifier(new VF.Accidental(note.accidentals));
        }

        // Store note position after drawing
        const noteId = `note-${containerId}-${measureIndex}-${noteIndex}`;
        staveNote.setAttribute('id', noteId);
        staveNote.setAttribute('data-measure', String(measureIndex));
        staveNote.setAttribute('data-note', String(noteIndex));

        return staveNote;
      });

      // Create voice and format
      if (notes.length > 0) {
        const voice = new VF.Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
        voice.addTickables(notes);

        // Format and draw the voice
        new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 40);
        voice.draw(vfContext, stave);

        // Collect note positions after rendering
        notes.forEach((staveNote, noteIndex) => {
          // Store note reference for bounding box access
          noteRefsStore.push({ measureIndex, noteIndex, note: staveNote });
        });
      }
    }
  });
}

/**
 * Clear the notation container
 */
export function clearNotationContainer(containerId: string): void {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
  // Clear the note positions store
  noteRefsStore = [];
}

/**
 * Get the positions of all rendered notes
 * @returns Array of note positions with measure and note indices
 */
export function getNotePositions(): NotePosition[] {
  return noteRefsStore.map(({ measureIndex, noteIndex, note }) => {
    const box = note.getBoundingBox();
    return {
      measureIndex,
      noteIndex,
      x: box.getX(),
      y: box.getY(),
      width: box.getW(),
      height: box.getH(),
    };
  });
}

/**
 * Get the SVG element for a specific note
 * @param containerId The container ID
 * @param measureIndex The measure index
 * @param noteIndex The note index within the measure
 * @returns The SVG element for the note, or null if not found
 */
export function getNoteElement(
  containerId: string,
  measureIndex: number,
  noteIndex: number
): Element | null {
  const container = document.getElementById(containerId);
  if (!container) return null;
  return container.querySelector(`[data-measure="${measureIndex}"][data-note="${noteIndex}"]`);
}

/**
 * Get row configurations for a score
 * @param measureCount Number of measures
 * @param options Options including measuresPerRow and staveWidth
 * @returns Array of row configurations
 */
export function getRowConfigs(measureCount: number, options?: { measuresPerRow?: number; staveWidth?: number }): RowConfig[] {
  const layout = calculateScoreLayout(measureCount, options);
  return layout.rowConfigs;
}
