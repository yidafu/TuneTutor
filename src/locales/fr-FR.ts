import type { TranslationSet } from './en-US'

export const frFR: TranslationSet = {
  // En-tête
  appSubtitle: 'Lecteur de partitions pour la pratique',
  navScore: 'Partitions',
  navAudio: 'Audio original',

  // Barre d'outils (page partition)
  libraryTitle: 'Mes partitions',
  loadScore: 'Charger une partition',

  // Instruments
  instrumentPiano: 'Piano',
  instrumentSaxophone: 'Saxophone',
  instrumentGuitar: 'Guitare',
  instrumentBass: 'Basse',
  instrumentViolin: 'Violon',
  instrumentFlute: 'Flûte',
  instrumentTrumpet: 'Trompette',

  // Morceau de démonstration
  demoScoreTitle: 'Ah ! vous dirai-je, maman',
  demoScoreComposer: 'Traditionnel',
  keyCMajor: 'Do majeur',

  // Carte partition papier
  notationPlaceholder: 'La partition s’affichera ici — le moteur de rendu et de lecture n’est pas encore connecté.',
  notationFootInfo: 'OSMD · rendu SVG · largeur adaptative',

  // Informations de sélection
  selectionNone: 'Aucune sélection',
  selectionHint: 'Cliquez une note pour sélectionner sa mesure · double-cliquez deux notes pour délimiter une phrase',

  // Transport
  play: 'Lire',
  stop: 'Arrêter',

  // Tempo
  tempoLabel: 'Tempo',
  bpmUnit: 'BPM',

  // Métronome
  metronomeLabel: 'Métronome',
  metronomeOn: 'Activé',
  metronomeOff: 'Désactivé',
  metronomeSettings: 'Réglages du métronome',
  soundName: 'Timbre',
  metroSoundClassic: 'Classique',
  metroSoundDigital: 'Électronique',
  metroSoundKick: 'Grosse caisse',
  metroSoundClick: 'Clic',
  strongVolume: 'Volume des temps forts',
  weakVolume: 'Volume des temps faibles',

  // Temps creux (boucle avec silence)
  skipLabel: 'Temps creux',
  skipPerLoop: (n: number) => `pause de ${n} temps`,
  skipOff: 'Inactif',
  skipBeatsShort: (n: number) => `${n} temps`,

  // Barre d'état
  statusSelection: 'Sélection',
  statusSkip: 'Silence',
  statusInstrument: 'Instrument',
  statusPlaying: 'Lecture en cours',
  statusStopped: 'Arrêté',

  // Fenêtre de chargement
  loadScoreTitle: 'Charger une partition',
  dropMain: 'Déposez un fichier ici ou',
  dropBrowse: 'parcourez vos fichiers',
  dropHint: 'Formats pris en charge : .musicxml · .xml · .mxl — analyse locale dans votre navigateur',
  recentFiles: 'Fichiers récents',
  recentEmpty: 'Aucun fichier récent',
  delete: 'Supprimer',
  localNote: 'Les fichiers sont stockés dans votre navigateur (IndexedDB)',
  closeHint: 'Fermer',

  // Page audio original
  audioDropMain: 'Déposez un fichier audio ici ou',
  audioDropHint: 'Formats pris en charge : mp3 · wav · ogg · m4a — traitement local dans votre navigateur',
  audioStubHint: 'Mode démo : cliquez pour charger un audio d’exemple (pas encore de son)',
  removeAudio: 'Retirer l’audio',
  sliceTag: (start: string, end: string) => `Extrait ${start} – ${end}`,
  loopChipLabel: (seconds: number) => `BOUCLE ${seconds}s`,
  loopRange: (start: string, end: string) => `Boucle de ${start} à ${end}`,
  gapInfo: (beats: number, duration: string) => `+${beats} temps de silence par tour (≈ ${duration})`,
  waveHint: 'Glissez sur la forme d’onde pour créer un extrait · ajustez les bords · double-cliquez pour supprimer',
  demoAudioName: 'Audio d’exemple.mp3',
}
