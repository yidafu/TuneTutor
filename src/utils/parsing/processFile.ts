/**
 * MusicXML file processing utilities
 */

import { parseMusicXML, isValidXML } from '../notation/musicXMLParser';
import type { ParsedScore } from '../../types/notation';
import type { StoredFile } from '../../types/storedFile';
import { generateFileId, saveFile } from '../storage/indexedDB';

/**
 * Process a MusicXML file - parse it and save to IndexedDB
 */
export async function processMusicXMLFile(file: File): Promise<{
  score: ParsedScore;
  storedFile: StoredFile;
}> {
  const content = await file.text();

  // Validate XML content
  if (!isValidXML(content)) {
    throw new Error('Invalid file format');
  }

  // Parse the MusicXML file
  const score = parseMusicXML(content);

  // Save to IndexedDB
  const storedFile: StoredFile = {
    id: generateFileId(),
    fileName: file.name,
    title: score.title,
    composer: score.composer,
    uploadedAt: Date.now(),
    fileSize: file.size,
    rawContent: content,
    parsedScore: score,
  };
  await saveFile(storedFile);

  return { score, storedFile };
}
