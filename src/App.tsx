/**
 * App - Router shell. Owns the shared tempo (used by the score page for
 * playback and by the original-audio page for empty-beat→seconds conversion)
 * plus the shared Header navigation.
 */

import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import ScorePage from './pages/ScorePage';
import OriginalAudioPage from './pages/OriginalAudioPage';
import { useTranslation, useSetLanguage, type Language } from './locales/I18nContext';

function App() {
  const { t, language } = useTranslation();
  const setLanguage = useSetLanguage();
  const [tempo, setTempo] = useState(60);

  const handleLanguageChange = useCallback((newLang: Language) => {
    setLanguage(newLang);
  }, [setLanguage]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <Header
        language={language}
        onLanguageChange={handleLanguageChange}
        t={t}
      />

      {/* Routed pages */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <Routes>
          <Route path="/" element={<ScorePage tempo={tempo} onTempoChange={setTempo} />} />
          <Route path="/audio" element={<OriginalAudioPage tempo={tempo} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
