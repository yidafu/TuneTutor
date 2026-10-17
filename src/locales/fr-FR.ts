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
  loop: 'Boucle',
  off: 'Désactivé',
  metronome: 'Métronome',
  metronomeSound: 'Son',
  metronomeSound_classic: 'Classique',
  metronomeSound_digital: 'Numérique',
  metronomeSound_kick: 'Kick',
  metronomeSound_click: 'Clic',
  metronomeStrongBeat: 'Temps fort',
  metronomeWeakBeat: 'Temps faible',

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

  // Loop modes
  loopPhrase: 'Phrase',
  phraseSelected: 'Phrase',

  // Navigation
  navScore: 'Partition',
  navOriginalAudio: 'Audio original',

  // OriginalAudio page
  originalAudio: 'Pratique audio original',
  importAudio: 'Importer un audio',
  importAudioHint: 'Déposez un audio ici ou cliquez pour parcourir (mp3, wav, ogg, m4a)',
  removeAudio: 'Retirer',
  audioDuration: 'Durée: {0}',
  sliceRange: '{0} – {1}',
  sliceDurationLabel: 'Extrait: {0}',
  gapBeats: 'Temps vides',
  dragToSelect: 'Glissez sur la forme d\'onde pour sélectionner un extrait à répéter',
  audioPlayLoop: 'Répéter l\'extrait',
  audioPlayWhole: 'Lecture complète',
  unsupportedAudioFormat: 'Format audio non pris en charge. Essayez mp3, wav, ogg ou m4a.',
} as const;

export type French = typeof frFR;
