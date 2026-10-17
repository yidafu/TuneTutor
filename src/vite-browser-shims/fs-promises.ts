/**
 * Browser-compatible stub for Node.js fs/promises module
 * Used by musicxml-io when running in browser environments
 */

export const readFile = async (): Promise<Uint8Array> => {
  throw new Error('readFile is not available in browser environment');
};

export const writeFile = async (): Promise<void> => {
  throw new Error('writeFile is not available in browser environment');
};
