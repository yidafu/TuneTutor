# Music Notation Player - Specification Document

## Project Overview

**Objective**: Build a web-based music notation player to help beginners practice sheet music by allowing them to select specific measures, play notes at adjustable tempo, and choose between piano and saxophone instruments.

**Tech Stack**: React, VexFlow 5.0.0, Web Audio API, Tone.js, WebAudioFont, Tailwind CSS

---

## 1. System Architecture

### 1.1 Technology Stack

| Component              | Technology              | Purpose                                              |
| ---------------------- | ----------------------- | ---------------------------------------------------- |
| **UI Framework**       | React 18+               | Component-based user interface                       |
| **Language**           | TypeScript              | Type safety and better developer experience          |
| **Build Tool**         | Vite                    | Fast development and optimized production builds     |
| **Styling**            | Tailwind CSS 3.x        | Utility-first CSS framework for rapid UI development |
| **Notation Rendering** | VexFlow 5.0.0           | Music notation display on Canvas/SVG                 |
| **Audio Framework**    | Tone.js                 | Audio timing, sequencing, and scheduling             |
| **Instrument Sounds**  | WebAudioFont            | High-quality piano and saxophone samples             |
| **File Parsing**       | MusicXML/MIDI libraries | Import sheet music from files                        |

### 1.1.1 Why Tailwind CSS?

**Benefits for this project:**
- **Rapid Development**: Utility classes allow building UI without writing custom CSS
- **Consistent Design System**: Pre-defined color palette, spacing, and typography scales
- **Responsive Design**: Built-in responsive modifiers (`md:`, `lg:`) for different screen sizes
- **Dark Mode Ready**: Easy to implement dark mode with `dark:` prefix
- **Small Bundle Size**: Only includes used styles in production via PurgeCSS
- **Component-Friendly**: Works seamlessly with React components
- **No CSS Files**: Eliminates context switching between JS and CSS files

### 1.2 Project Structure

```
play-notes/
├── src/
│   ├── components/
│   │   ├── NotationDisplay/
│   │   │   ├── NotationDisplay.tsx       # Main VexFlow renderer
│   │   │   ├── Measure.tsx               # Individual measure component
│   │   │   └── types.ts                  # VexFlow type definitions
│   │   ├── PlaybackControls/
│   │   │   ├── PlaybackControls.tsx      # Play/pause/stop buttons
│   │   │   ├── TempoSlider.tsx          # Tempo adjustment (40-240 BPM)
│   │   │   ├── InstrumentSelector.tsx   # Piano/Sax toggle
│   │   │   └── ProgressBar.tsx          # Playback progress indicator
│   │   ├── FileLoader/
│   │   │   ├── FileLoader.tsx           # File upload component
│   │   │   └── FileParser.tsx           # MusicXML/MIDI parser
│   │   └── App/
│   │       └── App.tsx                   # Main application layout
│   ├── hooks/
│   │   ├── useAudioEngine.ts            # Web Audio API wrapper
│   │   ├── useNotationParser.ts         # Parse MusicXML to VexFlow format
│   │   ├── useMeasureSelection.ts       # Handle measure selection logic
│   │   └── usePlayback.ts               # Playback state management
│   ├── utils/
│   │   ├── audio/
│   │   │   ├── InstrumentFactory.ts     # Create piano/sax instruments
│   │   │   ├── NoteMapper.ts            # Map VexFlow notes to audio frequencies
│   │   │   └── TempoConverter.ts        # Convert note durations to time
│   │   └── notation/
│   │       ├── vexflowHelpers.ts        # VexFlow factory helpers
│   │       └── musicXMLParser.ts        # Parse MusicXML files
│   ├── types/
│   │   ├── notation.ts                  # Note, Measure, Score types
│   │   ├── audio.ts                     # Audio engine types
│   │   └── playback.ts                  # Playback state types
│   └── main.tsx                         # Application entry point
├── public/
│   └── fonts/                           # VexFlow fonts (Bravura, Academico)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js                   # Tailwind CSS configuration
├── postcss.config.js                    # PostCSS configuration for Tailwind
└── README.md
```

---

## 2. Core Features

### 2.1 File Loading (MusicXML/MIDI Import)

**Purpose**: Allow users to load sheet music from external files

**User Flow**:
1. User clicks "Load Sheet Music" button
2. File picker dialog opens (accepts .musicxml, .xml, .mid files)
3. Selected file is parsed into internal note format
4. Notation is rendered using VexFlow
5. Error handling for invalid/corrupted files

**Technical Implementation**:
- Use `xml-js` or similar library to parse MusicXML
- Extract notes, measures, time signatures, key signatures
- Convert to VexFlow-compatible format
- Store parsed data in React state for playback

**Supported Formats**:
- MusicXML (`.musicxml`, `.xml`)
- MIDI (`.mid`) - optional Phase 2 feature

**Data Structure**:
```typescript
interface ParsedScore {
  title: string;
  composer?: string;
  measures: Measure[];
  tempo: number; // BPM
  timeSignature: string; // "4/4", "3/4", etc.
}

interface Measure {
  index: number;
  notes: Note[];
  timeSignature?: string;
  keySignature?: string;
}

interface Note {
  pitch: string; // "C4", "G#5", etc.
  duration: string; // "q" (quarter), "h" (half), etc.
  octave: number;
  accidentals?: string; // "#", "b", "n"
  tiesToNext?: boolean;
}
```

### 2.2 Notation Display with VexFlow

**Purpose**: Render professional sheet music notation in the browser

**Visual Requirements**:
- Display music on a staff with proper clef (treble/bass)
- Show time signatures and key signatures
- Render notes with correct stems, beams, and flags
- Support multiple staves/systems for longer pieces
- Responsive design (scrollable for large scores)

**VexFlow Implementation**:
```typescript
// Use Factory API with EasyScore
const { Factory } = VexFlow;
const vf = new Factory({
  renderer: { elementId: 'notation', width: 800, height: 400 },
});

const score = vf.EasyScore();
const system = vf.System();

// Add measures dynamically from parsed score
parsedScore.measures.forEach((measure) => {
  const notes = measure.notes.map(note =>
    score.note(`${note.pitch}/${note.duration}`)
  );
  system.addStave({ voices: [score.voice(notes)] });
});
```

**Measure Selection Visual States (Tailwind Classes)**:
- **Default**: `bg-white hover:bg-blue-50 cursor-pointer transition-colors`
- **Hovered**: `bg-blue-50`
- **Selected**: `bg-blue-100 border-2 border-blue-500`
- **Playing**: `bg-yellow-200`

### 2.3 Measure Selection (Range-Based)

**Purpose**: Allow users to select which measures to practice

**User Interaction**:
- **Single Click**: Select that measure only (clears previous selection)
- **Range Selection**: Click first measure, Shift+Click last measure to select range
- **Visual Feedback**: All measures in range are highlighted blue
- **Clear Selection**: Click outside notation or press Escape

**Selection State Management**:
```typescript
interface SelectionState {
  selectedMeasures: number[]; // Array of measure indices
  anchorMeasure: number | null; // Starting point for range selection
  isRangeSelecting: boolean;
}
```

**UX Guidelines**:
- Show measure numbers above each measure for easy reference
- Display "Selected: Measures X-Y" indicator
- Gray out playback controls if no measures selected

### 2.4 Playback Controls

**Purpose**: Control audio playback of selected measures

**UI Components**:

#### 2.4.1 Transport Controls
- **Play Button**: Start playback from first selected measure
- **Pause Button**: Pause playback (maintain position)
- **Stop Button**: Reset to beginning and stop audio
- **Loop Toggle**: Repeat selected measures continuously

#### 2.4.2 Tempo Control
- **Slider**: Range 40-240 BPM (default: 120)
- **Preset Buttons**: Largo (60), Andante (80), Moderato (120), Allegro (160)
- **Display**: Show current BPM value
- **Real-time Update**: Tempo changes affect current playback immediately

#### 2.4.3 Instrument Selector
- **Radio Buttons/Tabs**: Piano 🎹 | Saxophone 🎷
- **Visual Indicator**: Show currently selected instrument
- **Persistence**: Remember user's last selection

#### 2.4.4 Measure Interval Control (NEW)
- **Purpose**: Add a rest/pause between measures during playback
- **Slider**: Range 0-8 beats (default: 0, no pause)
- **Preset Buttons**: 0 (None), 1, 2, 4, 8 beats
- **Display**: Show current interval value (e.g., "2 beats", "1 measure")
- **Use Case**: Give beginners time to prepare before the next measure plays
- **Real-time Update**: Interval changes apply to next measure playback

**UI Example:**
```tsx
<div className="bg-gray-50 rounded-lg p-4">
  <div className="flex items-center justify-between mb-2">
    <label className="text-sm font-medium text-gray-700">
      ⏸️ Measure Interval (Pause)
    </label>
    <span className="text-lg font-bold text-purple-600">2 beats</span>
  </div>
  <input
    type="range"
    min="0"
    max="8"
    value="2"
    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
  />
  <div className="flex justify-between mt-2 space-x-2">
    <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">0</button>
    <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">1</button>
    <button className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md">2</button>
    <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">4</button>
    <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">8</button>
  </div>
  <p className="text-xs text-gray-500 mt-2">
    Add a pause between measures for practice time
  </p>
</div>
```

**Implementation Logic:**
```typescript
// Add rest between measures
function createPlaybackPartWithInterval(
  measures: Measure[],
  instrumentFactory: InstrumentFactory,
  intervalBeats: number = 0
) {
  const events: Array<{ time: string; note: string; duration: string }> = [];

  let beatTime = 0;
  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i];

    // Add notes from this measure
    for (const note of measure.notes) {
      events.push({
        time: `${beatTime.toString()}m`,
        note: note.pitch,
        duration: noteDurationToToneTime(note.duration),
      });
      beatTime += Tone.Time(noteDurationToToneTime(note.duration)).toSeconds();
    }

    // Add interval rest after each measure (except the last one)
    if (intervalBeats > 0 && i < measures.length - 1) {
      beatTime += Tone.Time(`4n`).toSeconds() * intervalBeats;
    }
  }

  const part = new Tone.Part((time, value) => {
    instrumentFactory.playNote(value.note, value.duration, time);
  }, events).start(0);

  return part;
}
```

#### 2.4.5 Progress Indicator
- **Progress Bar**: Visual timeline of playback
- **Current Measure Display**: "Playing measure X of Y"
- **Time Display**: Show elapsed time and total duration

### 2.5 Audio Engine

**Purpose**: Play music notes with piano or saxophone sounds

**Architecture**:
```
Tone.js (Sequencer & Timing)
    ↓
Tone.js Instruments (Preset Samples)
    ↓
Web Audio API (Audio Output)
```

**Why Tone.js Instruments?**

Using `@tonejs/instruments` library provides several advantages over WebAudioFont:
- **Pre-built Instrument Samples**: High-quality instrument sounds with minimal setup
- **Saxophone Support**: Includes saxophone and other wind instruments
- **Small Bundle Size**: Samples are optimized and loaded on-demand
- **Easy Integration**: Direct Tone.js compatibility
- **Multiple Instruments**: Piano, saxophone, guitar, strings, brass, and more

**Library Information**:
- **GitHub**: https://github.com/nbrosowsky/tonejs-instruments
- **NPM**: `@tonejs/instruments`
- **Demo**: https://nbrosowsky.github.io/tonejs-instruments/

**Implementation Details**:

#### 2.5.1 Instrument Setup with Tone.js Instruments

```typescript
import * as Tone from 'tone';
import { Piano, Saxophone } from '@tonejs/instruments';

class InstrumentFactory {
  private piano: Piano;
  private sax: Saxophone;
  private currentInstrument: 'piano' | 'sax';

  constructor() {
    // Initialize piano instrument
    this.piano = new Piano({
      // Piano samples are loaded automatically
      velocities: 5, // Number of velocity layers
    });

    // Initialize saxophone instrument
    this.sax = new Saxophone({
      // Saxophone samples (soprano/alto/tenor available)
      type: 'alto', // Options: 'soprano', 'alto', 'tenor'
    });

    // Connect to output
    this.piano.toDestination();
    this.sax.toDestination();

    this.currentInstrument = 'piano';
  }

  // Get current instrument
  getInstrument(): Piano | Saxophone {
    return this.currentInstrument === 'piano' ? this.piano : this.sax;
  }

  // Switch instrument
  setInstrument(instrument: 'piano' | 'sax') {
    this.currentInstrument = instrument;
  }

  // Load samples (call this after user interaction for browser autoplay policy)
  async loadSamples(): Promise<void> {
    await Promise.all([
      this.piano.load(),
      this.sax.load(),
    ]);
  }

  // Play a note
  playNote(noteName: string, duration: string, time: number) {
    const instrument = this.getInstrument();
    instrument.triggerAttackRelease(noteName, duration, time);
  }

  // Play multiple notes (chord)
  playChord(noteNames: string[], duration: string, time: number) {
    const instrument = this.getInstrument();
    instrument.triggerAttackRelease(noteNames, duration, time);
  }
}
```

#### 2.5.2 Available Instruments from @tonejs/instruments

**Supported Instruments:**

| Instrument    | Class Name  | Description                               |
| ------------- | ----------- | ----------------------------------------- |
| **Piano**     | `Piano`     | Grand piano with multiple velocity layers |
| **Saxophone** | `Saxophone` | Alto/Soprano/Tenor saxophone              |
| **Guitar**    | `Guitar`    | Acoustic guitar samples                   |
| **Bass**      | `Bass`      | Electric and acoustic bass                |
| **Strings**   | `Strings`   | Violin, cello, string ensemble            |
| **Brass**     | `Brass`     | Trumpet, trombone, brass section          |
| **Woodwinds** | `Woodwinds` | Flute, clarinet, oboe                     |
| **Synth**     | `Synth`     | Various synthesizer sounds                |
| **Drums**     | `Drums`     | Drum kit samples                          |

**Instrument Usage Examples:**

```typescript
// Piano
import { Piano } from '@tonejs/instruments';
const piano = new Piano();
piano.toDestination();
await piano.load();
piano.triggerAttackRelease('C4', '8n');

// Saxophone (Alto)
import { Saxophone } from '@tonejs/instruments';
const sax = new Saxophone();
sax.toDestination();
await sax.load();
sax.triggerAttackRelease('Eb4', '4n');

// Saxophone with specific type
const altoSax = new Saxophone({ type: 'alto' });
const tenorSax = new Saxophone({ type: 'tenor' });
const sopranoSax = new Saxophone({ type: 'soprano' });
```

#### 2.5.3 Sample Loading Strategy

**Loading Samples:**

Due to browser autoplay policies, samples must be loaded after user interaction:

```typescript
import { InstrumentFactory } from './utils/audio/InstrumentFactory';

// In your React component
const [audioReady, setAudioReady] = useState(false);
const instrumentFactory = useRef<InstrumentFactory>();

const initializeAudio = async () => {
  if (!instrumentFactory.current) {
    instrumentFactory.current = new InstrumentFactory();
  }

  // Load samples (must be triggered by user action)
  await instrumentFactory.current.loadSamples();
  setAudioReady(true);
};

// UI button to initialize audio
<button onClick={initializeAudio}>
  Enable Audio
</button>
```

**Progressive Loading:**

```typescript
class InstrumentFactory {
  private pianoLoaded = false;
  private saxLoaded = false;

  async loadPianoOnly() {
    if (!this.pianoLoaded) {
      await this.piano.load();
      this.pianoLoaded = true;
    }
  }

  async loadSaxOnly() {
    if (!this.saxLoaded) {
      await this.sax.load();
      this.saxLoaded = true;
    }
  }

  // Load on-demand when user switches instrument
  async switchToInstrument(instrument: 'piano' | 'sax') {
    if (instrument === 'piano' && !this.pianoLoaded) {
      await this.loadPianoOnly();
    } else if (instrument === 'sax' && !this.saxLoaded) {
      await this.loadSaxOnly();
    }
    this.currentInstrument = instrument;
  }
}
```

#### 2.5.4 Note Playback Logic

```typescript
// Convert VexFlow note duration to Tone.js timing
function noteDurationToToneTime(duration: string): string {
  const durationMap: Record<string, string> = {
    'w': '1n',   // whole note
    'h': '2n',   // half note
    'q': '4n',   // quarter note
    '8': '8n',   // eighth note
    '16': '16n', // sixteenth note
  };
  return durationMap[duration] || '4n';
}

// Playback sequence with Tone.js timing
async function playMeasures(
  measures: Measure[],
  instrumentFactory: InstrumentFactory,
  bpm: number
) {
  // Set tempo
  Tone.Transport.bpm.value = bpm;

  // Create Tone.js sequence
  const now = Tone.now();
  let currentTime = now;

  for (const measure of measures) {
    for (const note of measure.notes) {
      const duration = noteDurationToToneTime(note.duration);
      instrumentFactory.playNote(note.pitch, duration, currentTime);
      currentTime += Tone.Time(duration).toSeconds();
    }
  }
}

// Using Tone.js Part for more precise timing
function createPlaybackPart(
  measures: Measure[],
  instrumentFactory: InstrumentFactory
) {
  const events: Array<{ time: string; note: string; duration: string }> = [];

  let beatTime = 0;
  for (const measure of measures) {
    for (const note of measure.notes) {
      events.push({
        time: `${beatTime.toString()}m`,
        note: note.pitch,
        duration: noteDurationToToneTime(note.duration),
      });
      beatTime += Tone.Time(noteDurationToToneTime(note.duration)).toSeconds();
    }
  }

  const part = new Tone.Part((time, value) => {
    instrumentFactory.playNote(value.note, value.duration, time);
  }, events).start(0);
}
```

#### 2.5.5 Tempo Adjustment
- Use Tone.js `Transport.bpm.value` for real-time tempo changes
- Tempo changes apply immediately to current playback
- No need to restart when adjusting tempo

```typescript
// Set tempo
function setTempo(bpm: number) {
  Tone.Transport.bpm.value = bpm;
}

// Ramp tempo smoothly
function fadeToTempo(targetBpm: number, duration: number) {
  Tone.Transport.bpm.rampTo(targetBpm, duration);
}

// Get current tempo
function getCurrentTempo(): number {
  return Tone.Transport.bpm.value;
}
```

#### 2.5.6 React Hook for Audio Engine

```typescript
// hooks/useAudioEngine.ts
import { useState, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { InstrumentFactory } from '../utils/audio/InstrumentFactory';

export function useAudioEngine() {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentInstrument, setCurrentInstrument] = useState<'piano' | 'sax'>('piano');
  const [tempo, setTempo] = useState(120);
  const [measureInterval, setMeasureInterval] = useState(0); // NEW: beats between measures

  const instrumentFactory = useRef<InstrumentFactory | null>(null);
  const playbackPart = useRef<Tone.Part | null>(null);

  // Initialize audio engine (must be triggered by user action)
  const initialize = useCallback(async () => {
    if (!instrumentFactory.current) {
      instrumentFactory.current = new InstrumentFactory();
      await Tone.start();
      await instrumentFactory.current.loadSamples();
      setIsReady(true);
    }
  }, []);

  // Play measures
  const play = useCallback(async (measures: Measure[]) => {
    if (!instrumentFactory.current || !isReady) return;

    // Stop any existing playback
    if (playbackPart.current) {
      playbackPart.current.dispose();
    }

    // Create new playback part with interval support
    playbackPart.current = createPlaybackPartWithInterval(
      measures,
      instrumentFactory.current,
      measureInterval
    );

    // Start playback
    await Tone.Transport.start();
    setIsPlaying(true);
  }, [isReady, measureInterval]);

  // Stop playback
  const stop = useCallback(() => {
    if (playbackPart.current) {
      playbackPart.current.dispose();
      playbackPart.current = null;
    }
    Tone.Transport.stop();
    setIsPlaying(false);
  }, []);

  // Pause playback
  const pause = useCallback(() => {
    Tone.Transport.pause();
    setIsPlaying(false);
  }, []);

  // Resume playback
  const resume = useCallback(() => {
    Tone.Transport.start();
    setIsPlaying(true);
  }, []);

  // Switch instrument
  const switchInstrument = useCallback(async (instrument: 'piano' | 'sax') => {
    if (!instrumentFactory.current) return;

    await instrumentFactory.current.switchToInstrument(instrument);
    setCurrentInstrument(instrument);
  }, []);

  // Change tempo
  const changeTempo = useCallback((newTempo: number) => {
    Tone.Transport.bpm.value = newTempo;
    setTempo(newTempo);
  }, []);

  // Change measure interval (NEW)
  const changeMeasureInterval = useCallback((interval: number) => {
    setMeasureInterval(interval);
  }, []);

  return {
    isReady,
    isPlaying,
    currentInstrument,
    tempo,
    measureInterval, // NEW
    initialize,
    play,
    stop,
    pause,
    resume,
    switchInstrument,
    changeTempo,
    changeMeasureInterval, // NEW
  };
}
```

---

## 3. User Interface Design with Tailwind CSS

### 3.1 Layout Structure

```
┌─────────────────────────────────────────────────┐
│              Header / Toolbar                    │
│  [📁 Load File]  [🎹 Piano] [🎷 Sax]  [⚙️ Settings]│
├─────────────────────────────────────────────────┤
│                                                  │
│           Notation Display Area                 │
│        (VexFlow Canvas/SVG Container)            │
│                                                  │
│    ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │
│    │ 1  │ │ 2  │ │ 3  │ │ 4  │                 │
│    └────┘ └────┘ └────┘ └────┘                 │
│                                                  │
├─────────────────────────────────────────────────┤
│              Playback Controls                   │
│                                                  │
│  [▶️ Play] [⏸ Pause] [⏹ Stop] [🔁 Loop]        │
│                                                  │
│  Tempo: [─────●─────] 120 BPM                   │
│  [40]  [60] [80] [120] [160] [240]              │
│                                                  │
│  ⏸️ Interval: [────●────] 2 beats               │
│  [0]   [1]  [2]  [4]  [8]                       │
│                                                  │
│  Progress: [━━━━━●──────] 2:30 / 4:15           │
├─────────────────────────────────────────────────┤
│               Status Bar                        │
│  Measures: 1-8 | 🎹 Piano | ⏸️ 2 beats | 120 BPM│
└─────────────────────────────────────────────────┘
```

### 3.1.1 Component Styling Examples

**Header Component:**
```tsx
<header className="bg-white border-b border-gray-200 shadow-sm">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-16">
      {/* Logo */}
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Play Notes</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center space-x-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          📁 Load File
        </button>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button className="px-4 py-2 rounded-md bg-white shadow-sm">🎹 Piano</button>
          <button className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-200">🎷 Sax</button>
        </div>
      </div>
    </div>
  </div>
</header>
```

**Playback Controls:**
```tsx
<div className="bg-white border-t border-gray-200 p-6">
  <div className="max-w-4xl mx-auto space-y-6">
    {/* Transport Controls */}
    <div className="flex justify-center items-center space-x-4">
      <button className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
        ▶️ Play
      </button>
      <button className="p-3 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 transition-colors">
        ⏸ Pause
      </button>
      <button className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors">
        ⏹ Stop
      </button>
      <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
        🔁 Loop
      </button>
    </div>

    {/* Tempo Slider */}
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Tempo</label>
        <span className="text-lg font-bold text-blue-600">120 BPM</span>
      </div>
      <input
        type="range"
        min="40"
        max="240"
        value="120"
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between mt-2 space-x-2">
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">40</button>
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">60</button>
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">80</button>
        <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md">120</button>
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">160</button>
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">240</button>
      </div>
    </div>

    {/* Measure Interval Slider (NEW) */}
    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">
          ⏸️ Measure Interval (Pause)
        </label>
        <span className="text-lg font-bold text-purple-600">2 beats</span>
      </div>
      <input
        type="range"
        min="0"
        max="8"
        value="2"
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
      />
      <div className="flex justify-between mt-2 space-x-2">
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">0</button>
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">1</button>
        <button className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md">2</button>
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">4</button>
        <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">8</button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Add a pause between measures for practice time
      </p>
    </div>

    {/* Progress Bar */}
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Progress</span>
        <span>2:30 / 4:15</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-blue-600 h-3 rounded-full" style={{ width: '60%' }}></div>
      </div>
    </div>
  </div>
</div>
```

**Status Bar:**
```tsx
<footer className="bg-gray-800 text-white py-3 px-6">
  <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center text-sm gap-2">
    <div className="flex items-center space-x-4 sm:space-x-6">
      <span className="flex items-center">
        <span className="mr-2">🎵</span>
        Selected: Measures <span className="font-bold text-blue-400 mx-1">1-8</span>
      </span>
      <span className="flex items-center">
        <span className="mr-2">🎹</span>
        Instrument: <span className="font-bold text-green-400 ml-1">Piano</span>
      </span>
      <span className="flex items-center">
        <span className="mr-2">⏸️</span>
        Interval: <span className="font-bold text-purple-400 ml-1">2 beats</span>
      </span>
    </div>
    <div className="text-gray-400">
      Tempo: <span className="text-white font-bold">120</span> BPM
    </div>
  </div>
</footer>
```

### 3.2 Color Scheme (Tailwind Colors)

| Element                | Tailwind Color | Custom Hex | Tailwind Class                     |
| ---------------------- | -------------- | ---------- | ---------------------------------- |
| **Primary**            | Blue 600       | #3B82F6    | `bg-blue-600`, `text-blue-600`     |
| **Primary Hover**      | Blue 700       | #2563EB    | `hover:bg-blue-700`                |
| **Secondary**          | Slate 600      | #64748B    | `text-slate-600`, `bg-slate-600`   |
| **Accent (Playing)**   | Yellow 400     | #FBBF24    | `bg-yellow-400`, `text-yellow-400` |
| **Success (Selected)** | Green 600      | #10B981    | `bg-green-600`, `text-green-600`   |
| **Interval (Pause)**   | Purple 600     | #9333EA    | `bg-purple-600`, `text-purple-600` |
| **Background**         | White          | #FFFFFF    | `bg-white`                         |
| **Surface**            | Gray 50/100    | #F3F4F6    | `bg-gray-50`, `bg-gray-100`        |
| **Border**             | Gray 200       | #E5E7EB    | `border-gray-200`                  |
| **Text Primary**       | Gray 900       | #1F2937    | `text-gray-900`                    |
| **Text Secondary**     | Gray 600       | #6B7280    | `text-gray-600`                    |

**Tailwind Configuration (`tailwind.config.js`):**
```javascript
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors for the music player
        'music-primary': '#3B82F6',
        'music-accent': '#FBBF24',
        'music-success': '#10B981',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### 3.3 Responsive Design (Tailwind Breakpoints)

**Tailwind Default Breakpoints:**
- `sm`: 640px (small tablets and large phones)
- `md`: 768px (tablets)
- `lg`: 1024px (desktops)
- `xl`: 1280px (large desktops)
- `2xl`: 1536px (extra large screens)

**Responsive Implementation Examples:**

```tsx
// Header - responsive padding and layout
<header className="bg-white border-b border-gray-200">
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="flex flex-col sm:flex-row justify-between items-center py-4">
      {/* Logo */}
      <h1 className="text-xl sm:text-2xl font-bold">Play Notes</h1>

      {/* Toolbar - stacks on mobile, row on desktop */}
      <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mt-4 sm:mt-0">
        <button className="w-full sm:w-auto px-4 py-2">Load File</button>
      </div>
    </div>
  </div>
</header>

// Notation Display - responsive container
<div className="w-full overflow-x-auto">
  <div className="min-w-[800px] lg:min-w-0 px-4">
    {/* VexFlow canvas */}
  </div>
</div>

// Playback Controls - responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Transport controls */}
  <div className="flex justify-center items-center space-x-2 sm:space-x-4">
    <button className="p-2 sm:p-3">Play</button>
    <button className="p-2 sm:p-3">Pause</button>
  </div>

  {/* Tempo slider */}
  <div className="w-full">
    <input type="range" className="w-full" />
  </div>
</div>
```

**Responsive Breakpoints Summary:**
- **Mobile** (<640px): Single column, larger touch targets, stacked buttons
- **Tablet** (640-1024px): Multi-column layout, horizontal scroll for notation
- **Desktop** (>1024px): Full layout, side-by-side controls, maximum notation width

---

## 4. Technical Implementation Phases

### Phase 1: Project Setup & Basic Rendering
1. Initialize React + Vite + TypeScript project
2. Install dependencies (VexFlow, Tone.js, WebAudioFont, Tailwind CSS)
3. Configure Tailwind CSS with PostCSS
4. Create basic component structure with Tailwind styling
5. Implement VexFlow rendering with sample data
6. Display a static "Twinkle Twinkle Little Star" melody

**Deliverable**: Working app that displays notation with Tailwind CSS styling

### Phase 2: File Loading & Parsing
1. Implement MusicXML parser
2. Create file upload component
3. Parse notes, measures, time/key signatures
4. Convert parsed data to VexFlow format
5. Handle file errors gracefully

**Deliverable**: Load and display any MusicXML file

### Phase 3: Measure Selection
1. Implement click and range selection
2. Add visual feedback for selection states
3. Display measure numbers
4. Show selection info in status bar

**Deliverable**: Interactive measure selection UI

### Phase 4: Audio Engine
1. Set up Tone.js and Web Audio context
2. Integrate WebAudioFont instrument samples
3. Implement piano playback
4. Add saxophone playback
5. Create note-to-frequency mapping

**Deliverable**: Play selected measures with piano

### Phase 5: Playback Controls
1. Implement play/pause/stop functionality
2. Add tempo slider with presets
3. Create instrument selector
4. Build progress indicator
5. Add loop functionality

**Deliverable**: Full playback control system

### Phase 6: Polish & Optimization
1. Add loading states and error handling
2. Optimize audio loading and caching
3. Improve responsive design
4. Add keyboard shortcuts
5. Accessibility improvements (ARIA labels)

**Deliverable**: Production-ready application

---

## 5. Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "vexflow": "^5.0.0",
    "tone": "^14.7.77",
    "@tonejs/instruments": "^1.1.4",
    "xml-js": "^1.6.11"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.3.0",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**Installation Commands:**

```bash
# Install all dependencies
npm install react react-dom vexflow tone @tonejs/instruments xml-js

# Install dev dependencies
npm install -D @types/react @types/react-dom @vitejs/plugin-react typescript vite tailwindcss postcss autoprefixer

# Or install all at once
npm install react react-dom vexflow tone @tonejs/instruments xml-js
npm install -D @types/react @types/react-dom @vitejs/plugin-react typescript vite tailwindcss postcss autoprefixer
```

**Tailwind CSS Setup Commands:**

```bash
# Initialize Tailwind configuration
npx tailwindcss init -p

# This creates:
# - tailwind.config.js
# - postcss.config.js
```

**PostCSS Configuration (`postcss.config.js`):**
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Import Tailwind in `src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 6. Key Features Summary

| Feature            | Description                          | Priority          |
| ------------------ | ------------------------------------ | ----------------- |
| MusicXML Import    | Load sheet music from files          | P0 (Must Have)    |
| VexFlow Rendering  | Display professional notation        | P0 (Must Have)    |
| Measure Selection  | Click/Shift+Click to select measures | P0 (Must Have)    |
| Piano Playback     | Play notes with piano sound          | P0 (Must Have)    |
| Saxophone Playback | Play notes with sax sound            | P0 (Must Have)    |
| Tempo Control      | Adjustable 40-240 BPM                | P0 (Must Have)    |
| Transport Controls | Play/Pause/Stop/Loop                 | P0 (Must Have)    |
| Progress Indicator | Visual playback progress             | P1 (Should Have)  |
| MIDI Import        | Load MIDI files                      | P2 (Nice to Have) |
| Keyboard Shortcuts | Space=play, Arrow keys=navigate      | P2 (Nice to Have) |

---

## 7. Non-Functional Requirements

### 7.1 Performance
- Initial page load: <3 seconds
- File parsing: <1 second for typical piece
- Audio latency: <50ms
- 60 FPS rendering for notation display

### 7.2 Browser Compatibility
- Chrome 90+ (primary target)
- Firefox 88+
- Safari 14+
- Edge 90+

### 7.3 Accessibility
- Keyboard navigation for all controls
- ARIA labels for screen readers
- High contrast mode support
- Font scaling support

### 7.4 Security
- No user data collection
- Client-side only processing
- File size limits (max 10MB)
- Input sanitization for uploaded files

---

## 8. Future Enhancements (Out of Scope)

1. **Multi-instrument support** - Add guitar, violin, flute
2. **Recording feature** - Record user's practice sessions
3. **Transposition** - Change key of piece
4. **Cursors/following** - Auto-scroll during playback
5. **Practice mode** - Wait for user to play correct note
6. **MIDI keyboard support** - Connect physical keyboard
7. **Export to audio** - Save playback as MP3/WAV
8. **Annotation tools** - Add fingerings and text notes
9. **Mobile apps** - Native iOS/Android versions
10. **Cloud storage** - Save and share sheet music library

---

## 9. Success Criteria

The application is considered complete when:
- ✅ User can load a MusicXML file and see notation rendered
- ✅ User can select one or more measures using click/Shift+Click
- ✅ User can click Play and hear selected measures
- ✅ User can switch between Piano and Saxophone
- ✅ User can adjust tempo during playback
- ✅ Playback highlights current measure in real-time
- ✅ Progress bar shows accurate playback position
- ✅ No console errors or memory leaks
- ✅ Works on Chrome, Firefox, and Safari

---

## 10. Development Workflow

1. **Week 1**: Project setup + Phase 1 (Basic rendering)
2. **Week 2**: Phase 2 (File loading) + Phase 3 (Selection)
3. **Week 3**: Phase 4 (Audio engine) + Phase 5 (Controls)
4. **Week 4**: Phase 6 (Polish) + Testing + Deployment

---

**Document Version**: 1.3
**Last Updated**: 2026-01-12
**Status**: Ready for Implementation
**Changes**:
- v1.3: Added Measure Interval (Pause) feature to add rest beats between measures for practice time
- v1.2: Added @tonejs/instruments for saxophone and piano sounds with detailed implementation examples
- v1.1: Added Tailwind CSS as the styling solution with comprehensive configuration and component examples
- v1.0: Initial specification document
