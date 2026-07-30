/**
 * useLocalStorage Hook - Persist a value to localStorage with SSR-safe
 * read/write.  Returns [value, setValue] matching the useState signature.
 */

import { useState, useCallback } from 'react';
import { isBrowser } from '../utils/isBrowser';

/**
 * Reads a value from localStorage, validating it against the provided guard.
 * Returns `fallback` when the stored value is missing or invalid.
 */
function readValidated<T>(
  key: string,
  guard: (raw: unknown) => raw is T,
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && guard(raw)) return raw;
  } catch {
    // localStorage may throw (quota, private browsing, etc.)
  }
  return fallback;
}

/**
 * React hook that mirrors useState but persists the value to localStorage.
 * The `guard` function validates stored values at read time, providing a type-safe
 * alternative to raw `as T` casts.
 *
 * @example
 * ```ts
 * const [sound, setSound] = useLocalStorage('my-key', 'classic', isMetronomeSound);
 * ```
 */
export function useLocalStorage<T extends string>(
  key: string,
  defaultValue: T,
  guard: (raw: unknown) => raw is T,
): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    if (!isBrowser) return defaultValue;
    return readValidated(key, guard, defaultValue);
  });

  const setValue = useCallback(
    (value: T) => {
      setStored(value);
      try {
        localStorage.setItem(key, value);
      } catch {
        // Silently ignore storage errors
      }
    },
    [key],
  );

  return [stored, setValue];
}

/** Helper that creates a type guard from an array of allowed values */
export function createEnumGuard<T extends string>(allowed: readonly T[]) {
  return (raw: unknown): raw is T => allowed.includes(raw as T);
}

/** Helper that creates a guard for numeric values stored as strings in localStorage */
export function createNumericGuard(min: number, max: number) {
  return (raw: unknown): raw is string => {
    if (typeof raw !== 'string') return false;
    const n = parseFloat(raw);
    return !isNaN(n) && n >= min && n <= max;
  };
}
