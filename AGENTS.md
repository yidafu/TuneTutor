# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

TuneTutor (package `tune-tutor`, repo `note-slice`) is a web-based music notation practice player: load MusicXML scores, render them with OpenSheetMusicDisplay (OSMD), select measures/notes/phrases, and play back via Tone.js with adjustable tempo and instrument. Deployed as a PWA to GitHub Pages.

**Status (2026-10-17): re-implementation in progress.** The previous implementation was removed (`src/` except the entry skeleton and the `fs/promises` shim; full code in git history up to commit `666183c`). Authoritative baselines for the rewrite: `docs/tech.md` (v2.3, technical), `docs/audio.md` (v2.0, audio playback spec — architecture aligned with the official OSMD player), `docs/musicxml.md` (v1.0, MusicXML import & notation-marking parsing spec), `docs/prd.md` (product), `docs/ui-design.html` (v3, visual). Pre-rewrite validation scripts live in `spike/` with findings recorded in `docs/tech.md` §13 — delete `spike/` once the rewrite settles.

## Commands

```bash
pnpm dev        # dev server (base /TuneTutor/; picks 5174+ if 5173 is taken)
pnpm build      # tsc -b + vite production build (also the typecheck)
pnpm lint       # eslint
pnpm test       # vitest watch/UI mode (currently --passWithNoTests until tests return)
pnpm test:run   # vitest CI mode
pnpm test:e2e   # tester-army/e2e browser integration tests (see below)
```

Package manager is pnpm; Node 18+. There is no separate typecheck script — `pnpm build` is the type gate.

## Browser E2E tests (tester-army/e2e)

- Specs live in `tests/e2e/*.e2e.ts`; config in `e2e.config.ts`; runner artifacts under `.e2e/` (gitignored). The type gate covers them via the `tsconfig.e2e.json` reference in root `tsconfig.json`.
- The runner self-hosts the Vite dev server with port `0` (it picks a free port and substitutes `{port}`) — it never races the 5173/5174 dev servers. Vite `base` is `/TuneTutor/`, so tests open absolute paths like `/TuneTutor/#/audio` (see `openApp` in `tests/e2e/helpers.ts`).
- All steps are deterministic locators/assertions — no `agent.*` steps, so **no model API key is needed**. Requires Playwright chromium once (`npx playwright install chromium`).
- UI-label assertions run in en-US: `openApp` pins `localStorage['note-slice-language']` via an init script before the first navigation.
- `tests/e2e/phone.e2e.ts` pins a 390×844 viewport via `browser.setViewport` in `beforeEach` (PRD G18 phone-layout spec); every other spec runs at the engine default. The engine cannot emulate `pointer`/`hover` media — coarse-pointer rules are covered by unit/CSS-text tests and manual TC-MAN-10, not e2e.

## Target Architecture (docs/tech.md §2 is normative)

- `src/audio/` — playback core, modeled on the official OSMD player (spike/sponsors-demo-extract): `PlaybackEngine` (look-ahead window scheduling, loop state machine, metronome), `playbackData` (playback entries derived from the OSMD cursor — single source of truth, musical-time domain, BPM-independent), `TimingSource` (injectable anchor clock on AudioContext.currentTime), `InstrumentLoader` (tonejs-instrument-* sample loading), `TempoConverter`, `sliceUtils`.
- `src/utils/notation/` — MusicXML ingestion and OSMD integration: `processFile` (accepts `.xml`/`.musicxml` and zipped `.mxl` via jszip), `musicXMLParser`, `OsmdRender`, `selection`/`NoteInteraction`/`layout`.
- `src/components/` — React UI (flat, no barrel files): `OsmdNotation`, `PhraseMarkers`, `PlaybackControls/`, `FileLoaderModal`, plus `Header`/`ScoreInfo`/`SelectionInfo`/`StatusBar`.
- `src/pages/` — router pages: `ScorePage` (/), `OriginalAudioPage` (/audio), HashRouter.
- `src/hooks/` — `usePlayback` (playback state machine), keyboard shortcuts, localStorage helpers.
- `src/utils/storage/` — IndexedDB-backed file history; tests use `fake-indexeddb`.
- `src/locales/` — hand-rolled i18n (`I18nContext`), no i18n library.

Data flow: MusicXML file → `processFile` → `musicxml-io` → OSMD renders; OSMD cursor → `buildPlaybackData` (musical-time entries); selection → `usePlayback` → `PlaybackEngine` schedules notes via a look-ahead tick driven by `TimingSource`.

## Conventions and Gotchas

- **Unit tests are required**: all code (new modules and modifications alike) must be verified by unit tests — passing `pnpm build` (type gate) and `pnpm lint` alone is not done. Write vitest specs colocated as `src/**/*.test.ts(x)` or mirrored under `tests/` (both are in the `vitest.config.ts` include), run `pnpm test:run`, and make them pass before considering the task complete. Keep logic testable: prefer pure functions and injected dependencies (e.g. `TimingSource`) over hard-wired globals so core logic stays testable without a browser or real audio output.
- **Cross-platform interaction is a hard requirement — PC (mouse/keyboard) AND iPad (touch/Apple Pencil) AND phone portrait ≤639px**: every interaction must work on all. New pointer handling uses Pointer Events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`) — never add mouse-only (`mousedown`/`mousemove`) or touch-only listeners; see `useClickOutside`/`useDoubleTap` for the house pattern. Drag surfaces set `touch-action: none` (wavesurfer ships none of its own) + `setPointerCapture` + a move-slop check (4px) + click suppression after drag; `pointercancel` always aborts the gesture (docs/selection.md §4.2, S5). On the score stage the phone default is scroll mode (`touch-action: pan-x pan-y` + explicit box-select toggle chip) — see docs/selection.md §4.7 before touching that pipeline; phone layout rules (breakpoint 640, popover clamping, modal scroll, hover gating) are specced in docs/features/phone-compat.md.
- **Never rely on native `dblclick` alone on touch surfaces**: iOS/iPadOS Safari does not fire `dblclick` for double-taps (WebKit bug 202143 — double-tap only produces the mouse compatibility sequence and `click`). Pair it with pointer-based double-tap detection (`src/hooks/useDoubleTap.ts`: 400ms window, 24px slop, `isPrimary` filter, injectable clock); desktop fires both paths, so handlers must be idempotent (guard on current state, like `sliceRegionRef`). Same rule will apply to the score page's phrase double-click (docs/selection.md §4.3, v1.3).
- **Keyboard is an accelerator only; hover is enhancement only**: every action must be reachable through touch-usable controls (buttons, sliders); never gate a feature behind a keyboard shortcut or a `:hover`-only affordance. StyleX `':hover'` must be wrapped in `'@media (hover: hover)'` (sticky hover on touch), and StyleX media keys must never be compound (`'a and b'`) — the 0.19.1 dev runtime silently drops all but the first rule under a compound query (use nested single-condition keys). Both are enforced by `tests/themes/stylexConventions.test.ts`.
- **Phone layout pass (PRD G18) is landed**: phone breakpoint is `max-width: 639px` (pairs with the existing 640 min-width); popovers are clamped via `src/hooks/usePopoverClamp.ts` (apply it to any new anchored popover); modals must keep `maxHeight` + internal scroll; safe-area insets: top on Header, sides on App main (once), bottom on the truly docked bars. See `docs/features/phone-compat.md` (P1–P12) before touching layout.
- **Sample loading goes CDN-first with same-origin fallback (audio.md A20)**: the `tonejs-instrument-*-mp3` packages are pure mp3 asset sources — their JS is never imported (their constructors swallow `onerror`, which made sample-load failures hang forever with no UI). `src/audio/sampleSources.generated.ts` (committed, produced by `scripts/generateSampleSources.mjs`) pins each package's exact version + note→filename map: samples load from jsdelivr versioned URLs (CORS + immutable caching), and any failure silently rebuilds the Sampler against the bundled same-origin assets; the SW runtime-caches CDN sample mp3s (`tt-runtime`). **After upgrading any sample package, re-run `node scripts/generateSampleSources.mjs` and commit the regenerated file** (`tests/audio/sampleSources.test.ts` guards freshness). The old cello pnpm patch is gone (the illegal `import F2 v2` identifiers only mattered when the package JS was parsed). Note `ToneAudioBuffers.add` concatenates `baseUrl + url` with no slash compensation — cdnBase must end with `/`. The precache per-file limit stays raised to 3 MiB in `vite.config.ts`'s `injectManifest` options (main bundle crossed the 2 MiB default); sample mp3s are deliberately NOT in the precache glob.
- **pnpm settings live in `pnpm-workspace.yaml`** (pnpm 10+ no longer reads the `pnpm` field from package.json): `allowBuilds` records the approved postinstalls (`@swc/core`, `esbuild`, `gl` — platform binaries actually ship via optional platform packages, so skipping/succeeding their postinstalls is equivalent).
- **The service worker is hand-rolled (`src/sw.ts`, vite-plugin-pwa `injectManifest`)**: it imports no workbox runtime modules — vite-plugin-pwa only ships `workbox-build`/`workbox-window`, and runtime workbox packages are not resolvable from app source under pnpm's isolated node_modules. Precache install (`src/sw/precache.ts`) fully reads each response body before `cache.put` and retries transient failures with exponential backoff — Chrome's streaming `cache.put` throws `Cache.put() encountered a network error` on interrupted transfers and workbox has neither retry nor a plugin hook for it. Update semantics match generateSW autoUpdate (skipWaiting on successful install, `clients.claim()` + legacy-cache cleanup on activate; a failed install keeps the old SW serving). Config invariants are pinned by `tests/pwa/swConfig.test.ts`; TS 5.9 removed the SW types from `lib.dom`, so `src/sw.ts` declares its own minimal worker interface instead of referencing `lib.webworker` (which would conflict with `lib.dom` program-wide).
- **jsdom has no PointerEvent before setup, no layout, and no pointer capture**: tests dispatch `fireEvent.pointerDown(el, { isPrimary: true, ... })` (constructors default `isPrimary: false`), stub rects via `Object.defineProperty`/`vi.spyOn` (`stubStageRect` in tests/pages/OriginalAudioPage.test.tsx), and shared polyfills live in `tests/setup.ts`.
- **i18n**: any user-facing string must be added to all four locale files (`en-US`, `zh-CN`, `zh-TW`, `fr-FR`); `tests/locales/index.test.ts` asserts key completeness and language detection (localStorage key `note-slice-language`). Restore this test when re-adding locales.
- **TypeScript is strict**: `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for types), `erasableSyntaxOnly` (no enums/namespaces/parameter properties).
- **Browser shim**: `fs/promises` is aliased to `src/vite-browser-shims/fs-promises.ts` in `vite.config.ts` because `musicxml-io` imports Node `fs`. Keep this alias and the shim file; removing it breaks the Vite build.
- **Path alias**: `@` → `src/` is configured in `tsconfig.app.json` and `vitest.config.ts` (used by tests); app code in `src/` uses relative imports — follow the file you're editing.
- **Deployment**: Vite `base` and PWA scope are `/TuneTutor/` for GitHub Pages. Don't change to `/`.
- **Brand assets live in `docs/brand/`, not `public/`**: `public/` is the served/build directory, so design sources stay out of it. The favicon is generated by the `brandFavicon` plugin in `vite.config.ts` (emits `dist/logo.svg` from `docs/brand/tunetutor-app-icon.svg`, and serves `/logo.svg` in dev); `index.html` references it as `%BASE_URL%logo.svg`, and the PWA manifest points at `logo.svg`. Don't re-add a copy under `public/` — it will silently diverge from the source.
- Barrel `index.ts` files were removed in commit `db430e3` — prefer direct imports over creating new barrel files.
- **musicxml-io field names** (verified, docs/tech.md §13): score title is `metadata.workTitle` (not `movementTitle`); dot count field is `dots` (not `dot`); sample scores carry no `<sound tempo>`, so the tempo-60 fallback is a required path.
- **Sample scores**: `刻在我心底的名字.musicxml`, `musicxml/连音符.musicxml`, and `public/twinkle-twinkle-little-star.musicxml` are real scores for manual testing. Rhythm-drill training scores live in `musicxml/training/` (八分音符/切分/十六分音符节奏训练, each 20 bars — a leading whole-rest count-in at m1 and a whole-rest breath break after every 4 playing bars (m6/m11/m16), the 16 playing bars being eighth/sixteenth syncopation material pitched in the same written G-major alto-sax context as 世界赠予我的, tempo 62) and are asserted by `tests/utils/notation/trainingScores.test.ts`. Synthetic import-regression fixtures (`marks-*`/`rhythm-*`/`keys-*` in `musicxml/`) are asserted end-to-end by `tests/utils/notation/fixtures.test.ts` — update its fixture list when adding files there (it scans `musicxml/` non-recursively, so the `training/` subdir is not swept). The root `.mxl` is **corrupted** (text-mangled zip) — don't use it to test the `.mxl` path.

## Docs to Read Before Sensitive Changes

- `docs/README.md` — 文档导读：文档地图、阅读顺序、冲突裁决；先读这篇。
- `docs/tech.md` — v2.3 technical spec (module layout, data contracts, playback-data model, constraints); read before any re-implementation work.
- `docs/audio.md` — 音频播放技术规格（tech.md 音频域拆分：播放数据模型（乐谱时域）、look-ahead 播放引擎与可注入时钟、乐器、节拍器、原曲波形可视化与切片循环，含决策 A1–A20 与官方播放器逆向对照）；动 `src/audio/`、`PlaybackControls/` 或原曲页播放逻辑前先读。
- `docs/selection.md` — 选择交互技术规格（tech.md 选择域拆分：音符命中测试、graphicIndex/noteIndex 双索引对齐、端点解析、选择状态机、覆盖层，含决策 S1–S8 与 spike 实测）；动 `src/utils/notation/` 或选择覆盖层组件前先读。
- `docs/musicxml.md` — MusicXML 导入解析规格（tech.md 导入解析域拆分：导入管线与 .mxl 解包、连线符（连结线/连线）、停顿、连音、装饰音、倚音等全部标记的解析映射与契约承载、错误分类，含决策 M1–M11 与 musicxml-io 0.2.11 实测）；动 `processFile.ts`、`musicXMLParser.ts` 或标记域契约（`src/types/notation.ts`）前先读。
- `docs/features/text-selection.md` — 二期拖拽多行框选规格（中文）；动框选相关代码（`selection.ts`/`layout.ts` 的拖拽部分）前先读。
- `docs/features/phone-compat.md` — 手机端布局兼容规格（PRD G18：断点/弹层钳制/弹窗内滚/单指滚动与框选模式开关，决策 P1–P12）；动窄视口布局、弹层定位或触屏手势归属前先读。
- `docs/prd.md` — feature list F1–F14 (F14 is phase-2) plus roadmap G1–G17, and interaction flows; `docs/ui-design.html` — visual/interaction baseline.
- `docs/test-cases.md` — 测试用例清单（功能 → 自动化用例映射 TC-*、手动验收过单 TC-MAN、样例谱/夹具清单、已知盲区 §12）；补测试或动测试策略前先读，新增用例落对应域小节，盲区落地后注销。
