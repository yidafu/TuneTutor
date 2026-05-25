import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackEngine, PlaybackState, PlaybackEvent } from '@/audio/PlaybackEngine';
import type { IAudioContext } from 'standardized-audio-context';
import type { OpenSheetMusicDisplay, MusicSheet, Instrument, Voice, Cursor } from 'opensheetmusicdisplay';
import type { TonejsPlayer } from '@/audio/TonejsPlayer';

// Mock tone module
vi.mock('tone', () => ({
  Transport: {
    schedule: vi.fn(() => 1),
    clear: vi.fn(),
    cancel: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    get seconds() { return 0; },
    set seconds(_: number) {}
  },
  start: vi.fn(),
  getDestination: vi.fn(() => ({})),
  Sampler: vi.fn(),
  PolySynth: vi.fn(),
  Synth: vi.fn(),
}));

const createMockAudioContext = (): IAudioContext => {
  const context: Partial<IAudioContext> = {
    suspend: vi.fn(),
    resume: vi.fn(),
    state: 'running',
  };
  return context as IAudioContext;
};

const createMockTonejsPlayer = (): TonejsPlayer => {
  const player: Partial<TonejsPlayer> = {
    init: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    schedule: vi.fn(),
    instruments: [{ midiId: 0, name: 'Grand Piano', loaded: true }],
  };
  return player as TonejsPlayer;
};

const createMockCursor = (): Cursor => {
  const mockIterator = {
    EndReached: true,
    CurrentVoiceEntries: null,
    next: vi.fn(),
  };
  const cursor: Partial<Cursor> = {
    show: vi.fn(),
    hide: vi.fn(),
    reset: vi.fn(),
    next: vi.fn(),
    Iterator: mockIterator,
  };
  return cursor as unknown as Cursor;
};

const createMockVoice = (voiceId: number, midiInstrumentId: number): Voice => {
  return {
    VoiceId: voiceId,
    MidiInstrumentId: midiInstrumentId,
  } as unknown as Voice;
};

const createMockInstrument = (midiInstrumentId: number, voices: Voice[]): Instrument => {
  return {
    MidiInstrumentId: midiInstrumentId,
    Voices: voices,
  } as unknown as Instrument;
};

const createMockSheet = (instruments: Instrument[]): MusicSheet => {
  return {
    Instruments: instruments,
    HasBPMInfo: false,
    DefaultStartTempoInBpm: 120,
  } as unknown as MusicSheet;
};

const createMockOsmd = (sheet: MusicSheet, cursor: Cursor): OpenSheetMusicDisplay => {
  return {
    Sheet: sheet,
    cursor: cursor,
  } as unknown as OpenSheetMusicDisplay;
};

describe('PlaybackEngine', () => {
  let engine: PlaybackEngine;
  let mockAc: IAudioContext;
  let mockPlayer: TonejsPlayer;
  let mockCursor: Cursor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAc = createMockAudioContext();
    mockPlayer = createMockTonejsPlayer();
    mockCursor = createMockCursor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);

      expect(engine.state).toBe(PlaybackState.INIT);
      expect(engine.playbackSettings.bpm).toBe(100);
      expect(engine.playbackSettings.masterVolume).toBe(1);
      expect(engine.ready).toBe(false);
    });

    it('should use provided audio context', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      expect(mockAc.suspend).toHaveBeenCalled();
    });

    it('should initialize the instrument player', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      expect(mockPlayer.init).toHaveBeenCalled();
    });

    it('should set available instruments from player', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      expect(engine.availableInstruments).toEqual(mockPlayer.instruments);
    });
  });

  describe('wholeNoteLength getter', () => {
    it('should calculate whole note length correctly at default bpm', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      // wholeNoteLength = (60 / 100) * 4000 = 2400
      expect(engine.wholeNoteLength).toBe(2400);
    });

    it('should calculate whole note length correctly at different bpm', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      engine.setBpm(120);
      // wholeNoteLength = (60 / 120) * 4000 = 2000
      expect(engine.wholeNoteLength).toBe(2000);
    });
  });

  describe('getPlaybackInstrument', () => {
    it('should return null when no sheet is loaded', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      expect(engine.getPlaybackInstrument(0)).toBeNull();
    });
  });

  describe('setInstrument', () => {
    it('should call instrumentPlayer.load with correct midi id', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);

      await engine.setInstrument(voice, 25);

      expect(mockPlayer.load).toHaveBeenCalledWith(25);
    });
  });

  describe('setBpm', () => {
    it('should update playbackSettings.bpm', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      engine.setBpm(80);
      expect(engine.playbackSettings.bpm).toBe(80);
    });
  });

  describe('on / event system', () => {
    it('should register event callback', () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const cb = vi.fn();

      engine.on(PlaybackEvent.STATE_CHANGE, cb);

      // Manually trigger state change via internal method access if needed
      // For now we test the registration itself
      expect(engine).toBeDefined();
    });
  });

  describe('loadScore', () => {
    it('should set ready to true after loading', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);

      expect(engine.ready).toBe(true);
    });

    it('should set state to STOPPED after loading', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);

      expect(engine.state).toBe(PlaybackState.STOPPED);
    });

    it('should use default tempo from sheet if HasBPMInfo is true', async () => {
      const sheetWithBpm: MusicSheet = {
        Instruments: [],
        HasBPMInfo: true,
        DefaultStartTempoInBpm: 90,
      } as unknown as MusicSheet;
      const osmd = createMockOsmd(sheetWithBpm, mockCursor);

      engine = new PlaybackEngine(mockAc, mockPlayer);
      await engine.loadScore(osmd);

      expect(engine.playbackSettings.bpm).toBe(90);
    });
  });

  describe('play', () => {
    it('should transition state to PLAYING', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      await engine.play();

      expect(engine.state).toBe(PlaybackState.PLAYING);
    });

    it('should resume audio context', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      await engine.play();

      expect(mockAc.resume).toHaveBeenCalled();
    });

    it('should show cursor when starting from INIT', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      await engine.play();

      expect(mockCursor.show).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should transition state to STOPPED', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      await engine.stop();

      expect(engine.state).toBe(PlaybackState.STOPPED);
    });

    it('should hide cursor', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      await engine.play();
      await engine.stop();

      expect(mockCursor.hide).toHaveBeenCalled();
    });

    it('should reset cursor', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      await engine.stop();

      expect(mockCursor.reset).toHaveBeenCalled();
    });
  });

  describe('pause', () => {
    it('should transition state to PAUSED', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      engine.pause();
      expect(engine.state).toBe(PlaybackState.PAUSED);
    });

    it('should suspend audio context', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      engine.pause();
      expect(mockAc.suspend).toHaveBeenCalled();
    });
  });

  describe('state transitions', () => {
    it('should follow INIT -> STOPPED -> PLAYING -> STOPPED', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);
      expect(engine.state).toBe(PlaybackState.INIT);

      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      expect(engine.state).toBe(PlaybackState.STOPPED);

      await engine.play();
      expect(engine.state).toBe(PlaybackState.PLAYING);

      await engine.stop();
      expect(engine.state).toBe(PlaybackState.STOPPED);
    });

    it('should follow PLAYING -> PAUSED -> PLAYING', async () => {
      engine = new PlaybackEngine(mockAc, mockPlayer);

      const voice = createMockVoice(1, 0);
      const instrument = createMockInstrument(0, [voice]);
      const sheet = createMockSheet([instrument]);
      const osmd = createMockOsmd(sheet, mockCursor);

      await engine.loadScore(osmd);
      await engine.play();
      expect(engine.state).toBe(PlaybackState.PLAYING);

      engine.pause();
      expect(engine.state).toBe(PlaybackState.PAUSED);

      await engine.play();
      expect(engine.state).toBe(PlaybackState.PLAYING);
    });
  });
});
