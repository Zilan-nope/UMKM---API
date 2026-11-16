import type { ImportHistoryItem, StoredDataset } from '../context/AppContext';

const DB_NAME = 'smart_umkm_db';
const DB_VERSION = 2;
const DATASETS_STORE = 'datasets_store';
const HISTORY_STORE = 'import_history_store';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATASETS_STORE)) {
        db.createObjectStore(DATASETS_STORE);
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDatasetsFromDB(): Promise<StoredDataset[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DATASETS_STORE, 'readonly');
      const req = tx.objectStore(DATASETS_STORE).get('all');
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as StoredDataset[]) : []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveDatasetsToDB(datasets: StoredDataset[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DATASETS_STORE, 'readwrite');
      const req = tx.objectStore(DATASETS_STORE).put(datasets, 'all');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Tetap aman di memori sesi jika IndexedDB dibatasi browser
  }
}

export async function loadImportHistoryFromDB(): Promise<ImportHistoryItem[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readonly');
      const req = tx.objectStore(HISTORY_STORE).get('history');
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? (req.result as ImportHistoryItem[]) : []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveImportHistoryToDB(items: ImportHistoryItem[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readwrite');
      const req = tx.objectStore(HISTORY_STORE).put(items.slice(0, 50), 'history');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Abaikan jika IndexedDB dibatasi
  }
}