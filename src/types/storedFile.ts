/**
 * Types for files stored in IndexedDB
 */

import type { ParsedScore } from './notation';

export interface StoredFile {
  id: string;
  fileName: string;
  title: string;
  composer?: string;
  uploadedAt: number;
  fileSize: number;
  rawContent: string;
  parsedScore: ParsedScore;
}
