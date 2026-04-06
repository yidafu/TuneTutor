/**
 * VexFlow types and constants for music notation rendering
 * @deprecated Use src/core/types.ts instead
 */

// Re-export from core module for backward compatibility
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

// Re-export cache managers for backward compatibility
export { noteCache, rowCache } from '../../core';

// Legacy clearCaches function - delegates to core
import { noteCache, rowCache } from '../../core';

export function clearCaches(): void {
  noteCache.clear();
  rowCache.clear();
}

// For backward compatibility - legacy global cache arrays
// These are initialized as empty and synced via clearCaches/populateCaches
import type { NoteBounds, RowConfig } from '../../core/types';

export const noteBoundsCache: NoteBounds[] = [];
export const rowConfigsCache: RowConfig[] = [];

// Call this after rendering to sync legacy caches with core cache managers
export function syncLegacyCaches(): void {
  noteBoundsCache.length = 0;
  noteBoundsCache.push(...noteCache.getAll());
  rowConfigsCache.length = 0;
  rowConfigsCache.push(...rowCache.getAll());
}

// Initialize with current cache state on module load
syncLegacyCaches();