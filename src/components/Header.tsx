import { NavLink } from 'react-router-dom';
import { languageNames, type Language, type TranslationSet } from '../locales';
import { useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  t: TranslationSet;
}

const LANGUAGES: Language[] = ['en-US', 'zh-CN', 'zh-TW', 'fr-FR'];

const NAV_LINKS = [
  { to: '/', key: 'navScore' as const },
  { to: '/audio', key: 'navOriginalAudio' as const },
];

export function Header({ language, onLanguageChange, t }: HeaderProps) {
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>({ onOutsideClick: () => setIsLangMenuOpen(false) });

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
            {/* Page Navigation */}
            <nav className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg" aria-label="Page navigation">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                    }`
                  }
                >
                  {t[link.key]}
                </NavLink>
              ))}
            </nav>

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
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
