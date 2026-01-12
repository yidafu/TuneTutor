import { FileLoader } from '../FileLoader/FileLoader';
import type { ParsedScore } from '../../types/notation';
import type { StoredFile } from '../../types/storedFile';

interface FileLoaderModalProps {
  show: boolean;
  error: string | null;
  onClose: () => void;
  onScoreLoaded: (score: ParsedScore, file?: StoredFile) => void;
  onError: (error: string) => void;
}

export function FileLoaderModal({
  show,
  error,
  onClose,
  onScoreLoaded,
  onError,
}: FileLoaderModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Load Sheet Music</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <FileLoader onScoreLoaded={onScoreLoaded} onError={onError} />

        <p className="mt-4 text-xs text-gray-500 text-center">
          Supported formats: .musicxml, .xml
        </p>
      </div>
    </div>
  );
}
