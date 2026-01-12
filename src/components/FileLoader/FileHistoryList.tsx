/**
 * File History List Component - Displays list of previously loaded files
 */

import { useEffect, useState } from 'react';
import type { StoredFile } from '../../types/storedFile';
import { getAllFiles, deleteFile } from '../../utils/storage/indexedDB';

interface FileHistoryListProps {
  onFileSelect: (file: StoredFile) => void;
  onFileDelete?: (id: string) => void;
}

export function FileHistoryList({ onFileSelect, onFileDelete }: FileHistoryListProps) {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const loadedFiles = await getAllFiles();
      setFiles(loadedFiles);
    } catch (error) {
      console.error('Failed to load file history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      onFileDelete?.(id);
    } catch (error) {
      console.error('Failed to delete file:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="py-4 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
        Loading...
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500 text-sm">
        No recent files
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Files</h4>
      <ul className="max-h-60 overflow-y-auto space-y-1">
        {files.map((file) => (
          <li key={file.id}>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onFileSelect(file)}
              onClick={() => onFileSelect(file)}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-between group disabled:opacity-50 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.title || file.fileName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {file.composer || 'Unknown composer'} • {formatDate(file.uploadedAt)} • {formatFileSize(file.fileSize)}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(e, file.id)}
                disabled={deletingId === file.id}
                className="ml-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                aria-label={`Delete ${file.title}`}
              >
                {deletingId === file.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FileHistoryList;
