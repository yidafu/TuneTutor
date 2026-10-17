# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

TuneTutor (package `tune-tutor`, repo `note-slice`) is a web-based music notation practice player: load MusicXML scores, render them with OpenSheetMusicDisplay (OSMD), select measures/notes/phrases, and play back via Tone.js with adjustable tempo and instrument. Deployed as a PWA to GitHub Pages.

## Commands

```bash
pnpm dev        # dev server at http://localhost:5173
pnpm build      # tsc -b + vite production build (also the typecheck)
pnpm lint       # eslint
pnpm test       # vitest watch/UI mode
pnpm test:run   # vitest CI mode
```

Package manager is pnpm; Node 18+. There is no separate typecheck script — `pnpm build` is the type gate.

## Architecture

- `src/audio/` — playback core: `PlaybackEngine` (Tone.js Transport scheduling), `InstrumentLoader` (tonejs-instrument-* sample loading), `buildTimeline` (playback timeline derived from the OSMD cursor), `TempoConverter`, `sliceUtils`.
- `src/utils/notation/` — MusicXML ingestion and OSMD integration: `processFile` (accepts `.xml`/`.musicxml` and zipped `.mxl` via jszip), `musicXMLParser`, `OsmdRender`, `selection`/`NoteInteraction`/`layout` (click, shift-click, and drag text-selection on the score).
- `src/components/` — React UI. `OsmdNotation` renders the score; `PhraseMarkers` overlays phrase/loop regions; `PlaybackControls/`, `FileLoader`, `OriginalAudio/` (wavesurfer.js based).
- `src/pages/` — router pages: `ScorePage`, `OriginalAudioPage` (react-router-dom).
- `src/hooks/` — `usePlayback` (playback state machine), keyboard shortcuts, localStorage helpers.
- `src/utils/storage/` — IndexedDB-backed file history; tests use `fake-indexeddb`.
- `src/locales/` — hand-rolled i18n (`I18nContext`), no i18n library.
- `tests/` — mirrors `src` layout; unit tests also live next to sources as `*.test.ts`.

Data flow: MusicXML file → `processFile` → `musicxml-io` → OSMD renders; user selection → `usePlayback` → `PlaybackEngine` schedules notes on Tone.js Transport.

## Conventions and Gotchas

- **i18n**: any user-facing string must be added to all four locale files (`en-US`, `zh-CN`, `zh-TW`, `fr-FR`); `tests/locales/index.test.ts` asserts key completeness and language detection (localStorage key `note-slice-language`).
- **TypeScript is strict**: `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for types), `erasableSyntaxOnly` (no enums/namespaces/parameter properties).
- **Browser shim**: `fs/promises` is aliased to `src/vite-browser-shims/fs-promises.ts` in `vite.config.ts` because `musicxml-io` imports Node `fs`. Keep this alias; removing it breaks the Vite build.
- **Path alias**: `@` → `src/` is configured in `tsconfig.app.json` and `vitest.config.ts` (used by tests); app code in `src/` currently uses relative imports — follow the file you're editing.
- **Deployment**: Vite `base` and PWA scope are `/TuneTutor/` for GitHub Pages. Don't change to `/`.
- **Stale docs**: `README.md` and `spec.md` still describe the pre-migration VexFlow architecture; notation rendering is OSMD since commit `4dbf604`. Trust the code over those docs.
- Barrel `index.ts` files were removed in commit `db430e3` — prefer direct imports over creating new barrel files.

## Docs to Read Before Sensitive Changes

- `text-selection.md` — spec (Chinese) for drag-based multi-line text selection on the score; read before touching `src/utils/notation/selection.ts` or `NoteInteraction.ts`.
- `spec.md` — original product spec; useful for intent, outdated on tech stack.
- `musicxml/` and the root `.musicxml`/`.mxl` files are real sample scores used for manual testing.
