/**
 * useClickOutside Hook - Calls a handler when a click occurs outside the
 * referenced element, with optional Escape key handling.
 */

import { useEffect, useRef, type RefObject } from 'react';

interface UseClickOutsideOptions {
  /** Called when a mousedown event is detected outside the element */
  onOutsideClick: () => void;
  /** If true, also calls onOutsideClick on Escape keydown */
  handleEscape?: boolean;
}

/**
 * Returns a ref to attach to the element you want to detect outside-clicks on.
 * Handles mousedown (and optionally Escape keydown) outside that element.
 *
 * @example
 * ```tsx
 * const panelRef = useClickOutside({ onOutsideClick: () => setOpen(false) });
 * return <div ref={panelRef}>...</div>;
 * ```
 */
export function useClickOutside<T extends HTMLElement>({
  onOutsideClick,
  handleEscape = false,
}: UseClickOutsideOptions): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const isOutside = (target: Node) =>
      ref.current && !ref.current.contains(target);

    const onMouseDown = (e: MouseEvent) => {
      if (isOutside(e.target as Node)) {
        onOutsideClick();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (handleEscape && e.key === 'Escape') {
        onOutsideClick();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    if (handleEscape) {
      document.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      if (handleEscape) {
        document.removeEventListener('keydown', onKeyDown);
      }
    };
  }, [onOutsideClick, handleEscape]);

  return ref;
}
