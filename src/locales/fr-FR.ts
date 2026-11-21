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
  instrumentClarinet: 'Clarinette',
  instrumentFlute: 'Flûte',
  instrumentTrumpet: 'Trompette',
  instrumentFrenchHorn: 'Cor d\'harmonie',
  instrumentTrombone: 'Trombone',
  instrumentViolin: 'Violon',
  instrumentCello: 'Violoncelle',
  instrumentGuitar: 'Guitare folk',
  instrumentGuitarNylon: 'Guitare classique',
  instrumentBass: 'Basse',

  // Morceau de démonstration
  untitledScore: 'Partition sans titre',

  // Carte partition papier
  notationPlaceholder: 'La partition s’affichera ici — le moteur de rendu et de lecture n’est pas encore connecté.',
  notationFootInfo: 'OSMD · rendu SVG · largeur adaptative',
  notationZoomIn: 'Agrandir la partition',
  notationZoomOut: 'Réduire la partition',
  notationBoxSelect: 'Encadrer',
  notationBoxSelectHint: 'Activé : glisser un doigt sélectionne par cadre. Désactivé : un doigt fait défiler la partition.',

  // Informations de sélection
  selectionNone: 'Aucune sélection',
  selectionHint:
    'Cliquez une note pour sélectionner sa mesure · double-cliquez deux notes pour une phrase · faites glisser dans le vide pour une sélection rectangulaire',
  selectionPhrase: 'Phrase',
  selectionMeasure: 'Mesure',
  selectionBox: 'Sélection rectangulaire',
  selectionMeasures: (from: number, to: number) =>
    from === to ? `Mesure ${from}` : `Mesures ${from}–${to}`,
  selectionNoteCount: (n: number) => `${n} note${n > 1 ? 's' : ''}`,
  selectionClear: 'Effacer la sélection',
  selectionInvalid: 'Aucune plage jouable dans cette sélection',

  // Transport
  play: 'Lire',
  stop: 'Arrêter',
  samplesLoading: 'Chargement de l’instrument…',
  samplesFailed: 'Échec du chargement de l’instrument',
  retryLoad: 'Réessayer',

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
  removeAudio: 'Retirer l’audio',
  sliceTag: (start: string, end: string) => `Extrait ${start} – ${end}`,
  loopChipLabel: (seconds: number) => `BOUCLE ${seconds}s`,
  loopRange: (start: string, end: string) => `Boucle de ${start} à ${end}`,
  gapInfo: (beats: number, duration: string) => `+${beats} temps de silence par tour (≈ ${duration})`,
  waveHint: 'Glissez sur la forme d’onde pour créer un extrait · déplacez-le en le faisant glisser · ajustez les bords · double-cliquez pour supprimer · deux doigts pour naviguer et zoomer',
  audioDropOverlay: 'Déposez pour charger l’audio',
  zoomOut: 'Zoom arrière de la forme d’onde',
  zoomIn: 'Zoom avant de la forme d’onde',
  zoomFit: 'Ajuster à la fenêtre',
  audioLibraryTitle: 'Bibliothèque audio',
  recentAudio: 'Audio récents',
  audioRecentEmpty: 'Aucun audio importé',
  importingAudio: 'Importation audio…',

  // Erreurs d’import de partition (docs/musicxml.md §6, E1–E4)
  importing: 'Analyse de la partition…',
  errorCorruptArchive: 'Archive corrompue : impossible d’ouvrir ce fichier .mxl',
  errorNotMusicXML: 'Format non pris en charge : seules les partitions MusicXML score-partwise sont acceptées',
  errorParseFailed: 'Échec de l’analyse de ce fichier de partition',
  errorUnsupportedEncoding: 'Encodage non pris en charge : seuls les fichiers MusicXML UTF-8 sont acceptés',

  // Erreurs d’import audio (docs/audio.md §5.1, double validation)
  errorUnsupportedAudio: 'Fichier audio non pris en charge : utilisez mp3, wav, ogg ou m4a',
  errorAudioDecode: 'Impossible de décoder ce fichier audio',

  // Changement de thème (skin-switching.html v1.1 §③)
  theme: {
    label: 'Thème',
    group: {
      classic: 'Classiques',
      antique: 'Classique chinois',
    },
    paper: 'Encre & papier',
    nocturne: 'Nocturne',
    walnut: 'Noyer',
    celadon: 'Céladon',
    stage: 'Scène',
    cobalt: 'Bleu & blanc',
    palace: 'Palais',
    rosewood: 'Palissandre',
    lacquer: 'Laque noire',
    appliedHint: 'Appliqué immédiatement · mémorisé localement',
  },
}
