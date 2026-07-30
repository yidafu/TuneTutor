/**
 * SSR-safe check — true when code runs in a browser environment with access
 * to DOM APIs (window, document, localStorage, etc.).
 */
export const isBrowser = typeof window !== 'undefined';
