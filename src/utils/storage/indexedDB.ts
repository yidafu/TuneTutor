/**
 * IndexedDB utilities for storing and retrieving files
 */

import type { StoredFile } from '../../types/storedFile';

const DB_NAME = 'tune-tutor-db';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };
  });
}

/**
 * Get the database instance, initializing if necessary
 */
async function getDB(): Promise<IDBDatabase> {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance!;
}

/**
 * Save a file to IndexedDB
 */
export async function saveFile(file: StoredFile): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save file'));
  });
}

/**
 * Get all files from IndexedDB, sorted by upload date (newest first)
 */
export async function getAllFiles(): Promise<StoredFile[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('uploadedAt');
    const request = index.getAll();

    request.onsuccess = () => {
      // Sort by uploadedAt descending (newest first)
      const files = request.result.sort((a, b) => b.uploadedAt - a.uploadedAt);
      resolve(files);
    };
    request.onerror = () => reject(new Error('Failed to get files'));
  });
}

/**
 * Get a single file by ID
 */
export async function getFileById(id: string): Promise<StoredFile | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get file'));
  });
}

/**
 * Delete a file from IndexedDB
 */
export async function deleteFile(id: string): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete file'));
  });
}

/**
 * Generate a unique ID for a file
 */
export function generateFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
