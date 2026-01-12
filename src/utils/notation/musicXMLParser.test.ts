/**
 * MusicXML Parser Tests
 * Tests based on twinkle-twinkle-little-star.musicxml
 */

import { describe, it, expect } from 'vitest';
import { parseMusicXML, isValidXML, isMusicXMLFile } from '../../utils/notation/musicXMLParser';

// Sample MusicXML content for testing (Twinkle Twinkle Little Star - first 2 measures)
const SAMPLE_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.0">
  <identification>
    <encoding>
      <software>Test</software>
    </encoding>
  </identification>
  <movement-title>Test Score</movement-title>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
          <mode>major</mode>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
      </attributes>
      <sound tempo="120"/>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch>
          <step>A</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note>
        <pitch>
          <step>A</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note>
        <rest/>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

// MusicXML with different divisions (divisions=2 means half note = 1 division)
const COMPLEX_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.0">
  <movement-title>Complex Score</movement-title>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <key>
          <fifths>1</fifths>
          <mode>major</mode>
        </key>
        <time>
          <beats>3</beats>
          <beat-type>4</beat-type>
        </time>
      </attributes>
      <sound tempo="90"/>
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
          <alter>1</alter>
        </pitch>
        <duration>2</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note>
        <pitch>
          <step>D</step>
          <octave>5</octave>
        </pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

describe('parseMusicXML', () => {
  describe('basic parsing', () => {
    it('should parse title from movement-title', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.title).toBe('Test Score');
    });

    it('should parse time signature correctly', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.timeSignature).toBe('4/4');
    });

    it('should parse tempo from sound element', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.tempo).toBe(120);
    });

    it('should parse key signature (fifths=0 = C major)', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.keySignature).toBe('C');
    });

    it('should parse divisions from attributes', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.divisions).toBe(1);
    });
  });

  describe('measure parsing', () => {
    it('should parse correct number of measures', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures).toHaveLength(2);
    });

    it('should parse measure index correctly', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].index).toBe(0);
      expect(score.measures[1].index).toBe(1);
    });

    it('should parse time signature per measure', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].timeSignature).toBe('4/4');
      expect(score.measures[1].timeSignature).toBe('4/4');
    });
  });

  describe('note parsing', () => {
    it('should parse correct number of notes in measure 1', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes).toHaveLength(4);
    });

    it('should parse correct number of notes in measure 2 (includes rest)', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[1].notes).toHaveLength(4);
    });

    it('should parse pitch correctly (C4)', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes[0].pitch).toBe('C4');
    });

    it('should parse pitch correctly (G4)', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes[2].pitch).toBe('G4');
    });

    it('should parse duration as quarter note (q) with divisions=1', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes[0].duration).toBe('q');
    });

    it('should identify rest notes correctly', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      const lastNote = score.measures[1].notes[3];
      expect(lastNote.isRest).toBe(true);
      expect(lastNote.pitch).toBe('rest');
    });

    it('should parse octave correctly', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes[0].octave).toBe(4);
    });

    it('should parse durationValue correctly', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes[0].durationValue).toBe(1);
    });

    it('should parse voice correctly', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes[0].voice).toBe(1);
    });

    it('should parse type correctly', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.measures[0].notes[0].type).toBe('quarter');
    });
  });

  describe('complex MusicXML parsing', () => {
    it('should parse G# (sharp) correctly', () => {
      const score = parseMusicXML(COMPLEX_MUSICXML);
      expect(score.measures[0].notes[0].accidentals).toBe('#');
      expect(score.measures[0].notes[0].pitch).toBe('G4');
    });

    it('should parse divisions=2 correctly', () => {
      const score = parseMusicXML(COMPLEX_MUSICXML);
      expect(score.divisions).toBe(2);
    });

    it('should parse half note (duration=4, divisions=2) correctly', () => {
      const score = parseMusicXML(COMPLEX_MUSICXML);
      // duration=4, divisions=2 => beats=2 => half note
      expect(score.measures[0].notes[1].duration).toBe('h');
      expect(score.measures[0].notes[1].durationValue).toBe(4);
    });

    it('should parse key signature G major (fifths=1)', () => {
      const score = parseMusicXML(COMPLEX_MUSICXML);
      expect(score.keySignature).toBe('G');
    });

    it('should parse time signature 3/4', () => {
      const score = parseMusicXML(COMPLEX_MUSICXML);
      expect(score.timeSignature).toBe('3/4');
    });

    it('should parse tempo 90 correctly', () => {
      const score = parseMusicXML(COMPLEX_MUSICXML);
      expect(score.tempo).toBe(90);
    });
  });

  describe('edge cases', () => {
    it('should handle missing composer gracefully', () => {
      const score = parseMusicXML(SAMPLE_MUSICXML);
      expect(score.composer).toBeUndefined();
    });

    it('should handle empty score', () => {
      const emptyXML = `<?xml version="1.0" encoding="UTF-8"?>
        <score-partwise version="3.0">
          <movement-title>Empty</movement-title>
          <part-list>
            <score-part id="P1"/>
          </part-list>
          <part id="P1"/>
        </score-partwise>`;
      const score = parseMusicXML(emptyXML);
      expect(score.measures).toHaveLength(0);
      expect(score.timeSignature).toBe('4/4');
      expect(score.divisions).toBe(1);
    });
  });
});

describe('isValidXML', () => {
  it('should return true for valid MusicXML with <?xml declaration', () => {
    expect(isValidXML('<?xml version="1.0"?><score-partwise></score-partwise>')).toBe(true);
  });

  it('should return true for valid MusicXML with score-partwise root', () => {
    expect(isValidXML('<score-partwise></score-partwise>')).toBe(true);
  });

  it('should return true for valid MusicXML with DOCTYPE', () => {
    expect(isValidXML('<!DOCTYPE score-partwise><score-partwise></score-partwise>')).toBe(true);
  });

  it('should return false for invalid content', () => {
    expect(isValidXML('not xml at all')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidXML('')).toBe(false);
  });
});

describe('isMusicXMLFile', () => {
  it('should return true for .musicxml extension', () => {
    const file = { name: 'test.musicxml' } as File;
    expect(isMusicXMLFile(file)).toBe(true);
  });

  it('should return true for .xml extension', () => {
    const file = { name: 'test.xml' } as File;
    expect(isMusicXMLFile(file)).toBe(true);
  });

  it('should return true for .mxl extension', () => {
    const file = { name: 'test.mxl' } as File;
    expect(isMusicXMLFile(file)).toBe(true);
  });

  it('should be case insensitive', () => {
    const file = { name: 'test.MUSICXML' } as File;
    expect(isMusicXMLFile(file)).toBe(true);
  });

  it('should return false for other extensions', () => {
    const file = { name: 'test.json' } as File;
    expect(isMusicXMLFile(file)).toBe(false);
  });
});
