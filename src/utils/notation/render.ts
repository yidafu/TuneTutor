/**
 * VexFlow rendering utilities for music notation
 */

import * as VexFlow from 'vexflow';
import type { Measure, ParsedScore, Note } from '../../types/notation';
import { calculateScoreLayout } from './layout';
import {
  STAVE_WIDTH,
  STAVE_HEIGHT,
  PADDING,
  STAVE_PADDING,
  COLORS,
  noteBoundsCache,
  rowConfigsCache,
  clearCaches,
} from './types';

const VF = VexFlow;

// Global store for note references (for bounding box access)
// Note: This is cleared at the start of each renderScore call to prevent memory leaks
let noteRefsStore: { measureIndex: number; noteIndex: number; note: VexFlow.StaveNote }[] = [];

/**
 * Helper to create a note with all required fields
 */
function createNote(pitch: string, duration: string, octave: number): Note {
  return {
    pitch,
    duration,
    durationValue: 1,
    octave,
    isRest: false,
    dots: 0,
  };
}

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
  } = {}
): void {
  const {
    staveWidth = STAVE_WIDTH,
    selectedMeasures = [],
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

  // Clear previous content and note references
  container.innerHTML = '';
  noteRefsStore = [];
  clearCaches();
  rowConfigsCache.push(...layout.rowConfigs);

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

  // Render each row
  layout.rowConfigs.forEach((rowConfig) => {
    // Render each measure in this row
    for (let measureIndex = rowConfig.startMeasure; measureIndex <= rowConfig.endMeasure; measureIndex++) {
      const measure = score.measures[measureIndex];
      const indexInRow = measureIndex - rowConfig.startMeasure;
      const x = PADDING + indexInRow * (staveWidth + STAVE_PADDING);
      const stave = new VF.Stave(x, rowConfig.y, staveWidth);

      // Draw measure background first (for selected measures only)
      const isSelected = selectedMeasures.includes(measureIndex);
      if (isSelected) {
        ctx.fillStyle = COLORS.selected;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, rowConfig.y - 10, staveWidth, STAVE_HEIGHT + 20);
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = '#3b82f6';
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

          // Populate noteBoundsCache for selection and playback
          const box = staveNote.getBoundingBox();
          noteBoundsCache.push({
            measureIndex,
            noteIndex,
            x: box.getX(),
            y: box.getY(),
            width: box.getW(),
            height: box.getH(),
            staveX: x,
            staveY: rowConfig.y,
            staveWidth: staveWidth,
            staveHeight: STAVE_HEIGHT,
            rowIndex: rowConfig.rowIndex,
          });
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
  // Clear the note positions store and caches
  noteRefsStore = [];
  clearCaches();
}
