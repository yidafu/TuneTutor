/**
 * Notation utilities
 */

// Re-export core types and constants
export { noteCache, rowCache } from '../../core';
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

// Position utilities
export * from './positions';

// Selection utilities
export * from './selection';

// Playback utilities
export * from './playback';

// Note Coordinate Mapper
export * from './NoteCoordinateMapper';

// Parser utilities
export { parseMusicXML, isMusicXMLFile } from './musicXMLParser';
