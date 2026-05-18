/**
 * Notation utilities
 */

// Re-export core types and constants
export {
  STAVE_WIDTH,
  STAVE_HEIGHT,
  PADDING,
  STAVE_PADDING,
  ROW_SPACING,
  TOP_Y,
  VERTICAL_OFFSET,
  COLORS,
  type NoteBounds,
  type RowConfig,
  type ScoreLayout,
} from '../../core';

// Re-export types and createDemoScore
export * from '../../types/notation';

// Layout utilities
export * from './layout';

// OSMD Rendering utilities
export * from './OsmdRender';

// Note Interaction utilities
export * from './NoteInteraction';

// Parser utilities
export { parseMusicXML, isMusicXMLFile } from './musicXMLParser';
