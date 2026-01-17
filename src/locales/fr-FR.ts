/**
 * French translations
 */
export const frFR = {
  // Header
  appTitle: 'Tune Tutor',
  loadFile: 'Charger fichier',

  // Instruments
  instrument_piano: 'Piano',
  instrument_saxophone: 'Saxophone',
  instrument_guitar: 'Guitare',
  instrument_bass: 'Basse',
  instrument_violin: 'Violon',
  instrument_flute: 'Flûte',
  instrument_trumpet: 'Trompette',

  // PlaybackControls
  tempo: 'Tempo',
  bpm: 'BPM',
  play: 'Jouer',
  pause: 'Pause',
  stop: 'Arrêter',
  loopSkip: 'Boucle saut',
  off: 'Désactivé',

  // StatusBar
  noSelection: 'Aucune sélection',
  selected: 'Sélection:',
  tempoLabel: 'Tempo:',
  instrument: 'Instrument:',
  loopConfigSkip: 'Saut: {0}',

  // ScoreInfo
  composer: 'Compositeur:',

  // SelectionInfo
  clickToSelect: 'Cliquez sur les notes pour sélectionner',
  note: 'note',
  notes: 'notes',
  clearSelection: 'Effacer sélection',

  // FileLoaderModal
  loadSheetMusic: 'Charger partition',
  supportedFormats: 'Formats supportés: .musicxml, .xml',

  // Selection formatting
  measure: 'Mesure {0}',
  measures: 'Mesures {0}-{1}',

  // Language switcher
  language: 'Langue',
  chinese: '繁體中文',
  english: 'English',
  french: 'Français',
} as const;

export type French = typeof frFR;
