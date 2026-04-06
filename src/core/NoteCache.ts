/**
 * Note bounds cache manager
 * Replaces global noteBoundsCache from utils/notation/types.ts
 */

import type { NoteBounds } from './types';

export class NoteCacheManager {
  private cache: NoteBounds[] = [];

  // Array-like methods
  getAll(): NoteBounds[] {
    return this.cache;
  }

  set(notes: NoteBounds[]): void {
    this.cache = notes;
  }

  add(note: NoteBounds): void {
    this.cache.push(note);
  }

  addAll(notes: NoteBounds[]): void {
    this.cache.push(...notes);
  }

  clear(): void {
    this.cache = [];
  }

  // Array iteration methods
  find(predicate: (note: NoteBounds) => boolean): NoteBounds | undefined {
    return this.cache.find(predicate);
  }

  filter(predicate: (note: NoteBounds) => boolean): NoteBounds[] {
    return this.cache.filter(predicate);
  }

  map<T>(callback: (note: NoteBounds, index: number) => T): T[] {
    return this.cache.map(callback);
  }

  findIndex(predicate: (note: NoteBounds) => boolean): number {
    return this.cache.findIndex(predicate);
  }

  slice(start?: number, end?: number): NoteBounds[] {
    return this.cache.slice(start, end);
  }

  forEach(callback: (note: NoteBounds, index: number) => void): void {
    this.cache.forEach(callback);
  }

  // Position-based find
  findByPosition(x: number, y: number, tolerance: number = 10): NoteBounds | undefined {
    return this.cache.find(note =>
      x >= note.x - tolerance &&
      x <= note.x + note.width + tolerance &&
      y >= note.y - tolerance &&
      y <= note.y + note.height + tolerance
    );
  }

  // Filter by measure/row
  getByMeasure(measureIndex: number): NoteBounds[] {
    return this.cache.filter(note => note.measureIndex === measureIndex);
  }

  getByRow(rowIndex: number): NoteBounds[] {
    return this.cache.filter(note => note.rowIndex === rowIndex);
  }

  // Properties
  get length(): number {
    return this.cache.length;
  }

  get size(): number {
    return this.cache.length;
  }

  // Iterator for spread operator
  [Symbol.iterator](): Iterator<NoteBounds> {
    return this.cache[Symbol.iterator]();
  }
}

export const noteCache = new NoteCacheManager();