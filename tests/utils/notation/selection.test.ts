/**
 * Selection formatting utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { formatSelectionRange } from '@/utils/notation/selection';
import type { SelectedNote } from '@/types/notation';

// Mock translation set
const mockTranslationSet = {
  measure: 'Measure {0}',
  measures: 'Measures {0}-{1}',
} as const;

describe('formatSelectionRange', () => {
  describe('empty selection', () => {
    it('should return emptyText for empty array', () => {
      expect(formatSelectionRange([])).toBe('');
    });

    it('should return custom emptyText when provided', () => {
      expect(formatSelectionRange([], { emptyText: 'No selection' })).toBe('No selection');
    });
  });

  describe('single measure (number array)', () => {
    it('should format single measure correctly', () => {
      expect(formatSelectionRange([0])).toBe('Measure 1');
    });

    it('should format single measure with custom prefix', () => {
      expect(formatSelectionRange([0], { prefix: 'Selected: ' })).toBe('Selected: Measure 1');
    });
  });

  describe('multiple measures (number array)', () => {
    it('should format multiple measures correctly', () => {
      expect(formatSelectionRange([0, 1])).toBe('Measures 1-2');
    });

    it('should format multiple non-adjacent measures correctly', () => {
      expect(formatSelectionRange([0, 2, 4])).toBe('Measures 1-5');
    });

    it('should handle unsorted measure indices', () => {
      expect(formatSelectionRange([4, 2, 0])).toBe('Measures 1-5');
    });
  });

  describe('single measure (SelectedNote array)', () => {
    it('should format single SelectedNote correctly', () => {
      const selectedNotes: SelectedNote[] = [{ measureIndex: 0, noteIndex: 0 }];
      expect(formatSelectionRange(selectedNotes)).toBe('Measure 1');
    });

    it('should format single SelectedNote with custom prefix', () => {
      const selectedNotes: SelectedNote[] = [{ measureIndex: 0, noteIndex: 0 }];
      expect(formatSelectionRange(selectedNotes, { prefix: 'Selected: ' })).toBe('Selected: Measure 1');
    });
  });

  describe('multiple measures (SelectedNote array)', () => {
    it('should format multiple SelectedNotes correctly', () => {
      const selectedNotes: SelectedNote[] = [
        { measureIndex: 0, noteIndex: 0 },
        { measureIndex: 1, noteIndex: 0 },
      ];
      expect(formatSelectionRange(selectedNotes)).toBe('Measures 1-2');
    });

    it('should format multiple SelectedNotes with different notes in same measure', () => {
      const selectedNotes: SelectedNote[] = [
        { measureIndex: 0, noteIndex: 0 },
        { measureIndex: 0, noteIndex: 1 },
        { measureIndex: 2, noteIndex: 0 },
      ];
      expect(formatSelectionRange(selectedNotes)).toBe('Measures 1-3');
    });
  });

  describe('measure deduplication', () => {
    it('should deduplicate same measure from number array', () => {
      expect(formatSelectionRange([0, 0, 0])).toBe('Measure 1');
    });

    it('should deduplicate same measure from SelectedNote array', () => {
      const selectedNotes: SelectedNote[] = [
        { measureIndex: 1, noteIndex: 0 },
        { measureIndex: 1, noteIndex: 1 },
        { measureIndex: 1, noteIndex: 2 },
      ];
      expect(formatSelectionRange(selectedNotes)).toBe('Measure 2');
    });
  });

  describe('translation support', () => {
    it('should use translation for single measure', () => {
      expect(formatSelectionRange([0], {}, mockTranslationSet)).toBe('Measure 1');
    });

    it('should use translation for multiple measures', () => {
      expect(formatSelectionRange([0, 1], {}, mockTranslationSet)).toBe('Measures 1-2');
    });
  });
});
