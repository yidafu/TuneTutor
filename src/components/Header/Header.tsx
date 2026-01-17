import type { InstrumentType } from '../../types/audio';
import { INSTRUMENTS, getInstrumentName } from '../../types/audio';
import { languageNames, type Language, type TranslationSet } from '../../locales';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  selectedInstrument: InstrumentType;
  onSelectInstrument: (instrument: InstrumentType) => void;
  onOpenFileLoader: () => void;
  t: TranslationSet;
}

const LANGUAGES: Language[] = ['en-US', 'zh-CN', 'zh-TW', 'fr-FR'];

export function Header({
  language,
  onLanguageChange,
  selectedInstrument,
  onSelectInstrument,
  onOpenFileLoader,
  t,
}: HeaderProps) {
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm" role="banner">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">{t.appTitle}</h1>
          </div>

          {/* Toolbar */}
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200"
                aria-label={t.language}
                aria-expanded={isLangMenuOpen}
              >
                <span aria-hidden="true">🌐</span>
                {languageNames[language]}
                <span className="ml-1 text-xs">▼</span>
              </button>

              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        onLanguageChange(lang);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        lang === language ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {languageNames[lang]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Instrument Selector */}
            <div className="relative">
              <select
                value={selectedInstrument}
                onChange={(e) => onSelectInstrument(e.target.value as InstrumentType)}
                className="px-8 py-2 pr-8 text-white transition-colors bg-purple-600 rounded-lg appearance-none cursor-pointer hover:bg-purple-700"
                aria-label="Select instrument"
              >
                {INSTRUMENTS.map(inst => (
                  <option key={inst.type} value={inst.type} className="text-gray-900 bg-white">
                    {inst.icon} {getInstrumentName(inst.type, t)}
                  </option>
                ))}
              </select>
              {/* Custom dropdown arrow */}
              <span className="absolute text-white -translate-y-1/2 pointer-events-none select-none right-3 top-1/2">
                ▼
              </span>
            </div>

            <button
              onClick={onOpenFileLoader}
              className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              aria-label="Load sheet music file"
            >
              <span aria-hidden="true">📁</span>
              {t.loadFile}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
