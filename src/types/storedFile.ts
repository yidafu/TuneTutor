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

/**
 * An imported original-audio file persisted in IndexedDB.
 * Stored as a decoded `ArrayBuffer` (not a Blob) for reliable structured-clone
 * support in IndexedDB (fake-indexeddb, Safari); reconstructed as a Blob on load.
 */
export interface StoredAudioFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
  data: ArrayBuffer;
}
