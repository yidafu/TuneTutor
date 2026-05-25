/**
 * processFile Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMusicXMLFile } from '@/utils/notation/processFile';
import JSZip from 'jszip';

// Mock the indexedDB utilities
vi.mock('../../../src/utils/storage/indexedDB', () => ({
  generateFileId: vi.fn(() => 'test-file-id'),
  saveFile: vi.fn(),
}));

// Sample MusicXML for testing
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
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

// Helper to create a mock File with text() method mocked
const createMockFile = (name: string, content: string): File => {
  const blob = new Blob([content], { type: 'application/xml' });
  const file = new File([blob], name);
  // jsdom File doesn't have text() method, so we need to add it
  file.text = vi.fn().mockResolvedValue(content);
  return file;
};

// Helper to create a mock .mxl File (ZIP archive)
const createMockMxlFile = async (musicXmlContent: string, mainFilePath: string = 'test.musicxml'): Promise<File> => {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="${mainFilePath}"/>
  </rootfiles>
</container>`);
  zip.file(mainFilePath, musicXmlContent);

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const file = new File([arrayBuffer], 'test.mxl', { type: 'application/vnd.recordare.musicxml+xml' });
  file.arrayBuffer = vi.fn().mockResolvedValue(arrayBuffer);
  return file;
};

// Helper to create a mock .mxl File without container.xml
const createMockMxlFileWithoutContainer = async (): Promise<File> => {
  const zip = new JSZip();
  zip.file('test.musicxml', SAMPLE_MUSICXML);

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const file = new File([arrayBuffer], 'test.mxl', { type: 'application/vnd.recordare.musicxml+xml' });
  file.arrayBuffer = vi.fn().mockResolvedValue(arrayBuffer);
  return file;
};

// Helper to create a mock .mxl File with invalid container.xml
const createMockMxlFileWithInvalidContainer = async (): Promise<File> => {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><rootfiles/>');

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const file = new File([arrayBuffer], 'test.mxl', { type: 'application/vnd.recordare.musicxml+xml' });
  file.arrayBuffer = vi.fn().mockResolvedValue(arrayBuffer);
  return file;
};

// Helper to create a mock .mxl File with missing main file
const createMockMxlFileWithMissingMainFile = async (): Promise<File> => {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="nonexistent.musicxml"/>
  </rootfiles>
</container>`);

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const file = new File([arrayBuffer], 'test.mxl', { type: 'application/vnd.recordare.musicxml+xml' });
  file.arrayBuffer = vi.fn().mockResolvedValue(arrayBuffer);
  return file;
};

describe('processMusicXMLFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('.musicxml file processing', () => {
    it('should parse .musicxml file and return score and storedFile', async () => {
      const file = createMockFile('test.musicxml', SAMPLE_MUSICXML);
      const result = await processMusicXMLFile(file);

      expect(result.score).toBeDefined();
      expect(result.score.title).toBe('Test Score');
      expect(result.score.tempo).toBe(120);
      expect(result.score.measures).toHaveLength(1);

      expect(result.storedFile).toBeDefined();
      expect(result.storedFile.fileName).toBe('test.musicxml');
      expect(result.storedFile.title).toBe('Test Score');
      expect(result.storedFile.rawContent).toBe(SAMPLE_MUSICXML);
    });
  });

  describe('.xml file processing', () => {
    it('should parse .xml file and return score and storedFile', async () => {
      const file = createMockFile('test.xml', SAMPLE_MUSICXML);
      const result = await processMusicXMLFile(file);

      expect(result.score).toBeDefined();
      expect(result.score.title).toBe('Test Score');

      expect(result.storedFile).toBeDefined();
      expect(result.storedFile.fileName).toBe('test.xml');
    });
  });

  describe('.mxl file processing', () => {
    it('should parse .mxl file and return score and storedFile', async () => {
      const file = await createMockMxlFile(SAMPLE_MUSICXML);
      const result = await processMusicXMLFile(file);

      expect(result.score).toBeDefined();
      expect(result.score.title).toBe('Test Score');

      expect(result.storedFile).toBeDefined();
      expect(result.storedFile.fileName).toBe('test.mxl');
    });
  });

  describe('invalid XML handling', () => {
    it('should throw error for invalid XML content', async () => {
      const file = createMockFile('test.musicxml', 'not valid xml at all');

      await expect(processMusicXMLFile(file)).rejects.toThrow('Invalid file format');
    });

    it('should throw error for empty content', async () => {
      const file = createMockFile('test.musicxml', '');

      await expect(processMusicXMLFile(file)).rejects.toThrow('Invalid file format');
    });
  });

  describe('.mxl error handling', () => {
    it('should throw error for .mxl missing META-INF/container.xml', async () => {
      const file = await createMockMxlFileWithoutContainer();

      await expect(processMusicXMLFile(file)).rejects.toThrow(
        'Invalid .mxl file: missing META-INF/container.xml'
      );
    });

    it('should throw error for .mxl with invalid container.xml', async () => {
      const file = await createMockMxlFileWithInvalidContainer();

      await expect(processMusicXMLFile(file)).rejects.toThrow(
        'Invalid .mxl file: missing rootfile in container.xml'
      );
    });

    it('should throw error for .mxl with missing main file', async () => {
      const file = await createMockMxlFileWithMissingMainFile();

      await expect(processMusicXMLFile(file)).rejects.toThrow(
        /cannot find main file at/
      );
    });
  });

  describe('IndexedDB integration', () => {
    it('should call saveFile with correct storedFile', async () => {
      const { saveFile } = await import('../../../src/utils/storage/indexedDB');
      const file = createMockFile('test.musicxml', SAMPLE_MUSICXML);

      await processMusicXMLFile(file);

      expect(saveFile).toHaveBeenCalledTimes(1);
      const savedFile = (saveFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedFile.fileName).toBe('test.musicxml');
      expect(savedFile.title).toBe('Test Score');
    });

    it('should use generateFileId for storedFile id', async () => {
      const { generateFileId, saveFile } = await import('../../../src/utils/storage/indexedDB');
      const file = createMockFile('test.musicxml', SAMPLE_MUSICXML);

      await processMusicXMLFile(file);

      expect(generateFileId).toHaveBeenCalledTimes(1);
      const savedFile = (saveFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedFile.id).toBe('test-file-id');
    });
  });
});
