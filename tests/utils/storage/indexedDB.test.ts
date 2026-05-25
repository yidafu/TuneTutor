/**
 * IndexedDB storage utilities Tests
 */

import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { generateFileId } from '@/utils/storage/indexedDB';

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
