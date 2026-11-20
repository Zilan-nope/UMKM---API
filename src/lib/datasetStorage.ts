export type DatasetCategory =
  | 'penjualan'
  | 'produk'
  | 'keuangan'
  | 'karyawan'
  | 'lainnya';

export type DatasetRow = Record<string, unknown>;

export interface SavedDataset {
  id: string;
  name: string;
  category: DatasetCategory | string;
  rows: DatasetRow[];
  createdAt: string;
  updatedAt?: string;
}

interface DatasetMetaRecord {
  id: string;
  name: string;
  category: string;
  rowCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DatasetChunkRecord {
  chunkKey: string; // `${datasetId}::${chunkIndex}`
  datasetId: string;
  chunkIndex: number;
  rows: DatasetRow[];
}

const DB_NAME = 'smart_umkm_scale_db_v2';
const DB_VERSION = 1;
const STORE_META = 'datasets_meta';
const STORE_CHUNKS = 'dataset_chunks';
const CHUNK_SIZE = 10000; // 10.000 baris per blok agar tidak membebani memori

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Abaikan jika browser membatasi izin storage persist
  }
}

function openScaleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: 'chunkKey' });
        chunkStore.createIndex('by_dataset', 'datasetId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Gagal membuka database lokal.'));
  });
}

export async function saveDatasetChunked(dataset: SavedDataset): Promise<void> {
  await requestPersistentStorage();
  const db = await openScaleDb();

  // Hapus chunk lama milik dataset ini jika sudah ada
  await deleteDatasetChunksOnly(db, dataset.id);

  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const totalChunks = Math.max(1, Math.ceil(rows.length / CHUNK_SIZE));
  const nowIso = new Date().toISOString();

  for (let i = 0; i < totalChunks; i++) {
    const slice = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkRecord: DatasetChunkRecord = {
      chunkKey: `${dataset.id}::${i}`,
      datasetId: dataset.id,
      chunkIndex: i,
      rows: slice,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, 'readwrite');
      tx.objectStore(STORE_CHUNKS).put(chunkRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Gagal menyimpan blok data.'));
    });

    // Beri jeda 0ms tiap 20.000 baris agar UI tidak membeku saat simpan ratusan ribu data
    if (i > 0 && i % 2 === 0) {
      await yieldToMainThread();
    }
  }

  const meta: DatasetMetaRecord = {
    id: dataset.id,
    name: dataset.name,
    category: dataset.category,
    rowCount: rows.length,
    chunkCount: totalChunks,
    createdAt: dataset.createdAt || nowIso,
    updatedAt: nowIso,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal menyimpan metadata dataset.'));
  });
}

async function deleteDatasetChunksOnly(
  db: IDBDatabase,
  datasetId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    const store = tx.objectStore(STORE_CHUNKS);
    const index = store.index('by_dataset');
    const range = IDBKeyRange.only(datasetId);
    const cursorReq = index.openCursor(range);

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal menghapus chunk lama.'));
  });
}

export async function loadAllDatasetsChunked(): Promise<SavedDataset[]> {
  const db = await openScaleDb();

  const metas = await new Promise<DatasetMetaRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).getAll();
    req.onsuccess = () => resolve((req.result as DatasetMetaRecord[]) || []);
    req.onerror = () => reject(req.error ?? new Error('Gagal membaca metadata dataset.'));
  });

  const results: SavedDataset[] = [];

  for (const meta of metas) {
    const chunks = await new Promise<DatasetChunkRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, 'readonly');
      const index = tx.objectStore(STORE_CHUNKS).index('by_dataset');
      const req = index.getAll(IDBKeyRange.only(meta.id));
      req.onsuccess = () => resolve((req.result as DatasetChunkRecord[]) || []);
      req.onerror = () => reject(req.error ?? new Error('Gagal membaca blok data.'));
    });

    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    // Gabungkan array secara iteratif (aman untuk 500.000+ baris tanpa spread stack overflow)
    const combinedRows: DatasetRow[] = [];
    for (const chunk of chunks) {
      for (let r = 0; r < chunk.rows.length; r++) {
        combinedRows.push(chunk.rows[r]);
      }
    }

    results.push({
      id: meta.id,
      name: meta.name,
      category: meta.category,
      rows: combinedRows,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    });

    await yieldToMainThread();
  }

  return results;
}

export async function deleteDatasetChunked(datasetId: string): Promise<void> {
  const db = await openScaleDb();
  await deleteDatasetChunksOnly(db, datasetId);

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).delete(datasetId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal menghapus dataset.'));
  });
}

export async function clearAllDatasetsChunked(): Promise<void> {
  const db = await openScaleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_META).clear();
    tx.objectStore(STORE_CHUNKS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal mengosongkan database.'));
  });
}