# TuneTutor

A web-based music notation practice player. Load MusicXML scores, select measures or phrases, and practice with adjustable tempo, seven sampled instruments, a customizable metronome, and gap-beat loop training.

> **🚧 Re-implementation in progress (2026-10-17).** The codebase is being rebuilt from the v2 baselines: [docs/tech.md](docs/tech.md) (technical), [docs/prd.md](docs/prd.md) (product), [docs/ui-design.html](docs/ui-design.html) (visual). The previous implementation lives in git history (commits up to `666183c`). Pre-rewrite validation results: [tech.md §13](docs/tech.md).

## Demo

[https://yidafu.github.io/TuneTutor/](https://yidafu.github.io/TuneTutor/)

## Features (baseline for the rewrite)

- **MusicXML support** — `.musicxml` / `.xml` / zipped `.mxl`, parsed locally in the browser
- **Professional notation** — OpenSheetMusicDisplay (SVG) with a playback cursor
- **Phrase loop** — double-click two notes to loop any phrase; click to loop a measure range
- **Gap-beat loop** — insert 1–8 silent beats between loop rounds for response training
- **Original-audio practice** — import audio, drag a slice on the waveform, loop it with the same gap-beat scheme
- **7 sampled instruments** — piano, saxophone, guitar, bass, violin, flute, trumpet (Tone.js)
- **Tempo control** — 40–240 BPM, shared between the score and audio pages
- **Metronome** — four sounds, independent strong/weak beat volume
- **File history** — recent scores and audio persisted in IndexedDB; restores on launch
- **4 languages** — English / 简体中文 / 繁體中文 / Français
- **PWA** — installable, offline-capable (GitHub Pages)

## Tech Stack

- **UI**: React 19 + TypeScript (strict) + Tailwind CSS 4
- **Build**: Vite 7 + vite-plugin-pwa
- **Notation**: OpenSheetMusicDisplay
- **Audio**: Tone.js + tonejs-instrument-* samples + wavesurfer.js v7
- **Parsing**: musicxml-io (+ jszip for `.mxl`)
- **Routing**: react-router-dom (HashRouter)
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open the printed local URL (base path `/TuneTutor/`) in your browser.

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

See [docs/tech.md §2.1](docs/tech.md) for the normative module layout of the rewrite.

## License

MIT License
