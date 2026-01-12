/**
 * File Loader Component - Upload and parse MusicXML files
 */

import { useCallback, useState } from 'react';
import { parseMusicXML, isMusicXMLFile, isValidXML } from '../../utils/notation/musicXMLParser';
import type { ParsedScore } from '../../types/notation';
import type { StoredFile } from '../../types/storedFile';
import { generateFileId, saveFile } from '../../utils/storage/indexedDB';
import { FileHistoryList } from './FileHistoryList';

interface FileLoaderProps {
  onScoreLoaded: (score: ParsedScore, storedFile?: StoredFile) => void;
  onError?: (error: string) => void;
}

export function FileLoader({ onScoreLoaded, onError }: FileLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset error
      setError(null);

      // Validate file type
      if (!isMusicXMLFile(file)) {
        const errorMsg = 'Please select a .musicxml or .xml file';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      setIsLoading(true);

      try {
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

        onScoreLoaded(score, storedFile);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to parse file';
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setIsLoading(false);
        // Reset input
        event.target.value = '';
      }
    },
    [onScoreLoaded, onError]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const file = event.dataTransfer.files?.[0];
      if (!file) return;

      // Reset error
      setError(null);

      // Validate file type
      if (!isMusicXMLFile(file)) {
        const errorMsg = 'Please drop a .musicxml or .xml file';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      setIsLoading(true);

      try {
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

        onScoreLoaded(score, storedFile);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to parse file';
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [onScoreLoaded, onError]
  );

  const handleFileSelectFromHistory = useCallback(
    async (file: StoredFile) => {
      console.log('[FileLoader] Selected file from history:', file.title);

      // If parsedScore is available and valid, use it directly
      if (file.parsedScore && file.parsedScore.measures && file.parsedScore.measures.length > 0) {
        console.log('[FileLoader] Using cached parsedScore with', file.parsedScore.measures.length, 'measures');
        onScoreLoaded(file.parsedScore, file);
        return;
      }

      console.log('[FileLoader] parsedScore missing or empty, re-parsing from rawContent');
      // Fallback: re-parse from raw content if parsedScore is missing or empty
      if (file.rawContent) {
        setIsLoading(true);
        try {
          const score = parseMusicXML(file.rawContent);
          console.log('[FileLoader] Parsed score:', score.title, '-', score.measures?.length, 'measures');
          onScoreLoaded(score, file);
        } catch (err) {
          console.error('[FileLoader] Parse error:', err);
          const errorMsg = err instanceof Error ? err.message : 'Failed to parse file';
          setError(errorMsg);
          onError?.(errorMsg);
        } finally {
          setIsLoading(false);
        }
      } else {
        console.error('[FileLoader] File data corrupted - no rawContent');
        const errorMsg = 'File data is corrupted';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [onScoreLoaded, onError]
  );

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        type="file"
        accept=".musicxml,.xml"
        onChange={handleFileSelect}
        className="hidden"
        id="file-upload"
        disabled={isLoading}
      />

      {/* Drop zone / upload button */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isLoading ? 'border-gray-300 bg-gray-50' : 'border-blue-300 hover:border-blue-400 hover:bg-blue-50'}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-600">Parsing file...</p>
          </div>
        ) : (
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <div className="text-4xl mb-2">📁</div>
            <p className="text-gray-700 font-medium">
              {error ? 'Try again' : 'Drop MusicXML file here'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              or click to browse (.musicxml, .xml)
            </p>
          </label>
        )}
      </div>

      {/* Error message */}
      {error && !isLoading && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* File History List */}
      <FileHistoryList onFileSelect={handleFileSelectFromHistory} />
    </div>
  );
}

export default FileLoader;
