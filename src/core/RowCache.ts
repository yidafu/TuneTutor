/**
 * Row configuration cache manager
 * Replaces global rowConfigsCache from utils/notation/types.ts
 */

import type { RowConfig } from './types';

export class RowCacheManager {
  private cache: RowConfig[] = [];

  // Array-like methods
  getAll(): RowConfig[] {
    return this.cache;
  }

  set(configs: RowConfig[]): void {
    this.cache = configs;
  }

  clear(): void {
    this.cache = [];
  }

  // Array iteration methods
  find(predicate: (config: RowConfig) => boolean): RowConfig | undefined {
    return this.cache.find(predicate);
  }

  filter(predicate: (config: RowConfig) => boolean): RowConfig[] {
    return this.cache.filter(predicate);
  }

  map<T>(callback: (config: RowConfig, index: number) => T): T[] {
    return this.cache.map(callback);
  }

  findIndex(predicate: (config: RowConfig) => boolean): number {
    return this.cache.findIndex(predicate);
  }

  slice(start?: number, end?: number): RowConfig[] {
    return this.cache.slice(start, end);
  }

  forEach(callback: (config: RowConfig, index: number) => void): void {
    this.cache.forEach(callback);
  }

  // Specific find methods
  getByIndex(rowIndex: number): RowConfig | undefined {
    return this.cache.find(config => config.rowIndex === rowIndex);
  }

  getByMeasure(measureIndex: number): RowConfig | undefined {
    return this.cache.find(config =>
      measureIndex >= config.startMeasure && measureIndex <= config.endMeasure
    );
  }

  // Properties
  get totalRows(): number {
    return this.cache.length;
  }

  get length(): number {
    return this.cache.length;
  }

  getY(rowIndex: number): number {
    const config = this.getByIndex(rowIndex);
    return config?.y ?? 0;
  }

  // Iterator for spread operator
  [Symbol.iterator](): Iterator<RowConfig> {
    return this.cache[Symbol.iterator]();
  }
}

export const rowCache = new RowCacheManager();