/**
 * All utilities - Barrel export
 */

// Notation utilities (includes formatting and processing)
export {
  parseMusicXML,
  isMusicXMLFile,
  processMusicXMLFile,
  formatSelectionRange,
} from './notation';

// Storage utilities
export {
  saveFile,
  getAllFiles,
  deleteFile,
  generateFileId,
} from './storage';
