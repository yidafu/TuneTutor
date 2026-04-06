/**
 * MusicXML file processing utilities
 */

import JSZip from 'jszip';
import { parseMusicXML, isValidXML } from '../notation/musicXMLParser';
import type { ParsedScore } from '../../types/notation';
import type { StoredFile } from '../../types/storedFile';
import { generateFileId, saveFile } from '../storage/indexedDB';

/**
 * Extract content from a .mxl (compressed MusicXML) file
 */
async function extractMxlContent(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Read META-INF/container.xml to find the main MusicXML file path
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    throw new Error('Invalid .mxl file: missing META-INF/container.xml');
  }

  // Parse container.xml to get the rootfile path
  const parser = new DOMParser();
  const doc = parser.parseFromString(containerXml, 'text/xml');
  const rootfile = doc.querySelector('rootfile');
  if (!rootfile) {
    throw new Error('Invalid .mxl file: missing rootfile in container.xml');
  }

  const mainFilePath = rootfile.getAttribute('full-path');
  if (!mainFilePath) {
    throw new Error('Invalid .mxl file: missing full-path in rootfile');
  }

  // Read the main MusicXML file
  const mainFile = await zip.file(mainFilePath)?.async('text');
  if (!mainFile) {
    throw new Error(`Invalid .mxl file: cannot find main file at ${mainFilePath}`);
  }

  return mainFile;
}

/**
 * Process a MusicXML file - parse it and save to IndexedDB
 */
export async function processMusicXMLFile(file: File): Promise<{
  score: ParsedScore;
  storedFile: StoredFile;
}> {
  const isMxl = file.name.toLowerCase().endsWith('.mxl');

  let content: string;
  if (isMxl) {
    content = await extractMxlContent(file);
  } else {
    content = await file.text();
  }

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
