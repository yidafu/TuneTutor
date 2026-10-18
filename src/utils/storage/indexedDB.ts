import type {
  StoredAudioFile,
  StoredAudioFileMeta,
  StoredFile,
  StoredFileMeta,
} from '../../types/storedFile'

/**
 * IndexedDB 存储层（docs/tech.md §7）：库名 tune-tutor-db、版本 2。
 * - `files`（keyPath id；索引 uploadedAt/title）：乐谱历史，含 rawContent + parsedScore 解析缓存
 * - `audioFiles`（keyPath id；索引 uploadedAt/fileName）：原曲音频，data 存 ArrayBuffer（决策 D3）
 */

const DB_NAME = 'tune-tutor-db'
const DB_VERSION = 2
const FILES_STORE = 'files'
const AUDIO_FILES_STORE = 'audioFiles'

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const store = db.createObjectStore(FILES_STORE, { keyPath: 'id' })
        store.createIndex('uploadedAt', 'uploadedAt')
        store.createIndex('title', 'title')
      }
      if (!db.objectStoreNames.contains(AUDIO_FILES_STORE)) {
        const store = db.createObjectStore(AUDIO_FILES_STORE, { keyPath: 'id' })
        store.createIndex('uploadedAt', 'uploadedAt')
        store.createIndex('fileName', 'fileName')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(`Failed to open ${DB_NAME}`))
    request.onblocked = () => reject(new Error(`${DB_NAME} open blocked`))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

async function withStore<T>(
  name: typeof FILES_STORE | typeof AUDIO_FILES_STORE,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(name, mode)
    const store = transaction.objectStore(name)
    const request = run(store)
    const result = request !== undefined ? await requestToPromise(request) : undefined
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    })
    return result
  } finally {
    db.close()
  }
}

function projectFile(record: StoredFile): StoredFileMeta {
  return {
    id: record.id,
    fileName: record.fileName,
    title: record.title,
    ...(record.composer !== undefined ? { composer: record.composer } : {}),
    uploadedAt: record.uploadedAt,
    fileSize: record.fileSize,
  }
}

function projectAudioFile(record: StoredAudioFile): StoredAudioFileMeta {
  return {
    id: record.id,
    fileName: record.fileName,
    fileSize: record.fileSize,
    uploadedAt: record.uploadedAt,
  }
}

// ── 乐谱历史（files store） ──

export async function saveStoredFile(input: Omit<StoredFile, 'id' | 'uploadedAt'>): Promise<StoredFile> {
  const record: StoredFile = { ...input, id: newId(), uploadedAt: Date.now() }
  await withStore(FILES_STORE, 'readwrite', (store) => store.put(record))
  return record
}

/** 元信息投影列表，uploadedAt 降序；不携带 rawContent/parsedScore 大字段 */
export async function listStoredFiles(): Promise<StoredFileMeta[]> {
  const records = await withStore(FILES_STORE, 'readonly', (store) => store.getAll())
  return (records ?? []).sort((a, b) => b.uploadedAt - a.uploadedAt).map(projectFile)
}

export async function getStoredFile(id: string): Promise<StoredFile | undefined> {
  return withStore(FILES_STORE, 'readonly', (store) => store.get(id))
}

/** 启动恢复用：uploadedAt 最新一条（docs/tech.md §7.3） */
export async function getLatestStoredFile(): Promise<StoredFile | undefined> {
  const cursor = await withStore<IDBCursorWithValue | null>(FILES_STORE, 'readonly', (store) =>
    store.index('uploadedAt').openCursor(null, 'prev'),
  )
  return cursor?.value as StoredFile | undefined
}

export async function deleteStoredFile(id: string): Promise<void> {
  await withStore(FILES_STORE, 'readwrite', (store) => store.delete(id))
}

// ── 音频历史（audioFiles store） ──

export async function saveAudioFile(input: Omit<StoredAudioFile, 'id' | 'uploadedAt'>): Promise<StoredAudioFile> {
  const record: StoredAudioFile = { ...input, id: newId(), uploadedAt: Date.now() }
  await withStore(AUDIO_FILES_STORE, 'readwrite', (store) => store.put(record))
  return record
}

export async function listAudioFiles(): Promise<StoredAudioFileMeta[]> {
  const records = await withStore(AUDIO_FILES_STORE, 'readonly', (store) => store.getAll())
  return (records ?? []).sort((a, b) => b.uploadedAt - a.uploadedAt).map(projectAudioFile)
}

export async function getAudioFile(id: string): Promise<StoredAudioFile | undefined> {
  return withStore(AUDIO_FILES_STORE, 'readonly', (store) => store.get(id))
}

/** 启动恢复用：uploadedAt 最新一条（docs/tech.md §7.3） */
export async function getLatestAudioFile(): Promise<StoredAudioFile | undefined> {
  const cursor = await withStore<IDBCursorWithValue | null>(AUDIO_FILES_STORE, 'readonly', (store) =>
    store.index('uploadedAt').openCursor(null, 'prev'),
  )
  return cursor?.value as StoredAudioFile | undefined
}

export async function deleteAudioFile(id: string): Promise<void> {
  await withStore(AUDIO_FILES_STORE, 'readwrite', (store) => store.delete(id))
}
