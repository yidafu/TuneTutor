# TuneTutor

A web-based music notation player designed to help beginners practice sheet music. Load MusicXML files, select specific measures or notes, and play them back with adjustable tempo and instrument selection.

## Demo

[https://yidafu.github.io/TuneTutor/](https://yidafu.github.io/TuneTutor/)

## Features

- **MusicXML Support** - Load and parse standard MusicXML files
- **Professional Notation** - Render sheet music with VexFlow
- **Smart Selection** - Click or Shift+Click to select measures and individual notes
- **Multi-Instrument Playback** - Piano, saxophone, flute, violin, trumpet, guitar, bass, and more
- **Tempo Control** - Adjustable 40-240 BPM with presets (Largo, Andante, Moderato, Allegro)
- **Practice Tools** - Add pause beats between measures for practice time
- **Loop Playback** - Repeat selected sections for focused practice
- **Keyboard Shortcuts** - Efficient navigation without mouse
- **File History** - IndexedDB storage for recently loaded files

## Keyboard Shortcuts

| Key    | Action                         |
| ------ | ------------------------------ |
| Space  | Play / Pause                   |
| Escape | Clear selection                |
| ← / →  | Navigate to previous / next    |
| ↑ / ↓  | Adjust tempo                   |

## Tech Stack

- **UI Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Notation Rendering**: VexFlow 5.0.0
- **Audio Engine**: Tone.js 15
- **Instruments**: tonejs-instrument-* packages
- **File Parsing**: musicxml-io, xml-js
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
pnpm build
```

The built files will be in the `dist` directory.

### Testing

```bash
pnpm test        # Run tests with UI
pnpm test:run    # Run tests in CI mode
```
## Project Structure

```text
src/
├── components/          # React components
│   ├── FileLoader/     # File upload and history
│   ├── Header/         # App header
│   ├── NotationDisplay/# VexFlow notation renderer
│   ├── PlaybackControls/# Playback UI
│   ├── ScoreInfo/      # Score metadata display
│   ├── SelectionInfo/  # Selection status
│   └── StatusBar/      # Bottom status bar
├── hooks/               # Custom React hooks
│   ├── useAudioEngine.ts
│   ├── useNoteSelection.ts
│   └── usePlayback.ts
├── utils/               # Utility functions
│   ├── audio/          # Audio-related helpers
│   └── notation/       # MusicXML parsing
├── types/               # TypeScript type definitions
├── App.tsx              # Main application component
└── main.tsx             # Entry point
```

## License

MIT License
