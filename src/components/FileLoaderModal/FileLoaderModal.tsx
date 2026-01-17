import { FileLoader } from '../FileLoader/FileLoader';
import type { ParsedScore } from '../../types/notation';
import type { StoredFile } from '../../types/storedFile';
import type { TranslationSet } from '../../locales';

interface FileLoaderModalProps {
  show: boolean;
  error: string | null;
  onClose: () => void;
  onScoreLoaded: (score: ParsedScore, file?: StoredFile) => void;
  onError: (error: string) => void;
  t: TranslationSet;
}

export function FileLoaderModal({
  show,
  error,
  onClose,
  onScoreLoaded,
  onError,
  t,
}: FileLoaderModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md p-6 mx-4 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t.loadSheetMusic}</h3>
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
          <div className="p-3 mb-4 border border-red-200 rounded-md bg-red-50">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <FileLoader onScoreLoaded={onScoreLoaded} onError={onError} />

        <p className="mt-4 text-xs text-center text-gray-500">
          {t.supportedFormats}
        </p>
      </div>
    </div>
  );
}
