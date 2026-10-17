/**
 * IndexedDB storage utilities Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  generateFileId,
  saveAudioFile,
  getAllAudioFiles,
  getLatestAudioFile,
  deleteAudioFile,
} from '@/utils/storage/indexedDB';

describe('generateFileId', () => {
  it('should return a string', () => {
    const id = generateFileId();
    expect(typeof id).toBe('string');
  });

  it('should contain a hyphen separator', () => {
    const id = generateFileId();
    expect(id).toContain('-');
  });

  it('should be unique on each call', () => {
    const id1 = generateFileId();
    const id2 = generateFileId();
    expect(id1).not.toBe(id2);
  });

  it('should start with timestamp', () => {
    const before = Date.now();
    const id = generateFileId();
    const after = Date.now();
    const [timestamp] = id.split('-');
    const parsedTimestamp = parseInt(timestamp, 10);
    expect(parsedTimestamp).toBeGreaterThanOrEqual(before);
    expect(parsedTimestamp).toBeLessThanOrEqual(after);
  });

  it('should have random part after hyphen', () => {
    const id = generateFileId();
    const parts = id.split('-');
    expect(parts.length).toBe(2);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('should generate different ids rapidly', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateFileId());
    }
    // All 100 ids should be unique
    expect(ids.size).toBe(100);
  });
});

describe('audio file storage', () => {
  beforeEach(async () => {
    // Start each test from an empty audio store
    const files = await getAllAudioFiles();
    for (const f of files) {
      await deleteAudioFile(f.id);
    }
  });

  it('saves and retrieves an audio file', async () => {
    await saveAudioFile({
      id: 'audio-1',
      fileName: 'test.mp3',
      fileSize: 4,
      uploadedAt: 1000,
      data: new Uint8Array([1, 2, 3, 4]).buffer,
    });

    const files = await getAllAudioFiles();
    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe('test.mp3');
    // ArrayBuffer round-trips through structured clone
    expect(new Uint8Array(files[0].data)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('returns the newest file first', async () => {
    await saveAudioFile({ id: 'a', fileName: 'old.mp3', fileSize: 1, uploadedAt: 100, data: new ArrayBuffer(1) });
    await saveAudioFile({ id: 'b', fileName: 'new.mp3', fileSize: 1, uploadedAt: 200, data: new ArrayBuffer(1) });

    const latest = await getLatestAudioFile();
    expect(latest?.id).toBe('b');
  });

  it('returns null from getLatestAudioFile when empty', async () => {
    expect(await getLatestAudioFile()).toBeNull();
  });

  it('deletes an audio file', async () => {
    await saveAudioFile({ id: 'x', fileName: 'x.mp3', fileSize: 1, uploadedAt: 1, data: new ArrayBuffer(1) });
    await deleteAudioFile('x');
    expect(await getLatestAudioFile()).toBeNull();
  });
});
