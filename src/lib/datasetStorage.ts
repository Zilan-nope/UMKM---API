import { parseFlexibleDateIso } from './timeAnalytics';

export type DatasetCategory =
  | 'penjualan'
  | 'produk'
  | 'keuangan'
  | 'karyawan'
  | 'lainnya';

export type DatasetRow = Record<string, unknown>;

export interface DailyRollupBucket {
  transactions: number;
  revenue: number;
  actualHpp: number;
  expense: number;
  otherIncome: number;
  topProducts: { name: string; qty: number; revenue: number }[];
}

export interface ProductRollupBucket {
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  grossProfit: number;
  hasActualHpp: boolean;
}

export interface DatasetRollup {
  totalRows: number;
  transactions: number;
  revenue: number;
  actualHpp: number;
  grossProfit: number;
  expense: number;
  otherIncome: number;
  monthlyPayroll: number;
  productSku: number;
  stockUnits: number;
  inventoryAssetValue: number;
  dailyStats: Record<string, DailyRollupBucket>;
  productSales: Record<string, ProductRollupBucket>;
  paymentBreakdown: Record<string, { count: number; revenue: number }>;
  categoryBreakdown: Record<string, { count: number; revenue: number }>;
  lowStockItems: { name: string; stock: number; minStock: number }[];
}

export interface SavedDataset {
  id: string;
  name: string;
  category: DatasetCategory | string;
  rowCount: number;
  rollup?: DatasetRollup;
  /** Hanya berisi sampel ringan (maks 25 baris) agar RAM browser tetap rendah */
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
  rollup: DatasetRollup;
  sampleRows: DatasetRow[];
  createdAt: string;
  updatedAt: string;
}

interface DatasetChunkRecord {
  chunkKey: string;
  datasetId: string;
  chunkIndex: number;
  rows: DatasetRow[];
}

const DB_NAME = 'smart_umkm_scale_db_v3';
const DB_VERSION = 1;
const STORE_META = 'datasets_meta';
const STORE_CHUNKS = 'dataset_chunks';
export const CHUNK_SIZE = 10000;

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function pickField(row: DatasetRow, candidates: string[]): unknown {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    lower.set(k.toLowerCase().trim(), v);
  }
  for (const key of candidates) {
    const found = lower.get(key.toLowerCase());
    if (found !== undefined && found !== null && found !== '') {
      return found;
    }
  }
  return undefined;
}

export function computeDatasetRollup(
  category: string,
  rows: DatasetRow[]
): DatasetRollup {
  const cat = category.toLowerCase();
  let transactions = 0;
  let revenue = 0;
  let actualHpp = 0;
  let expense = 0;
  let otherIncome = 0;
  let monthlyPayroll = 0;
  let productSku = 0;
  let stockUnits = 0;
  let inventoryAssetValue = 0;

  const dailyMap = new Map<
    string,
    {
      transactions: number;
      revenue: number;
      actualHpp: number;
      expense: number;
      otherIncome: number;
      products: Map<string, { qty: number; revenue: number }>;
    }
  >();

  const productMap = new Map<string, ProductRollupBucket>();
  const paymentMap = new Map<string, { count: number; revenue: number }>();
  const categoryMap = new Map<string, { count: number; revenue: number }>();
  const lowStockItems: { name: string; stock: number; minStock: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (cat === 'produk') {
      const name = String(
        pickField(row, ['Nama_Produk', 'nama_produk', 'produk', 'nama']) || `Produk ${i + 1}`
      ).trim();
      const stock = toNum(pickField(row, ['Stok', 'stok', 'Stok_Saat_Ini', 'stock', 'qty']));
      const minStock = toNum(
        pickField(row, ['Stok_Minimum', 'stok_minimum', 'min_stok', 'minStock'])
      );
      const cost = toNum(pickField(row, ['Harga_Modal', 'harga_modal', 'modal', 'hpp']));

      productSku += 1;
      stockUnits += stock;
      inventoryAssetValue += stock * cost;

      if (minStock > 0 && stock <= minStock) {
        lowStockItems.push({ name, stock, minStock });
      }
      continue;
    }

    if (cat === 'karyawan') {
      const salary = toNum(
        pickField(row, ['Gaji', 'gaji', 'Gaji_Pokok', 'Nominal', 'Total', 'upah'])
      );
      monthlyPayroll += salary;
      continue;
    }

    if (cat === 'keuangan') {
      const nominal = toNum(
        pickField(row, ['Nominal', 'nominal', 'Total', 'total', 'Jumlah', 'jumlah'])
      );
      const jenis = String(
        pickField(row, ['Jenis', 'jenis', 'Tipe', 'tipe', 'type']) || 'Pengeluaran'
      ).toLowerCase();
      const dateIso = parseFlexibleDateIso(
        pickField(row, ['Tanggal', 'tanggal', 'Date', 'date', 'tgl'])
      );

      const isIncome = jenis.includes('masuk') || jenis.includes('income');
      if (isIncome) {
        otherIncome += nominal;
      } else {
        expense += nominal;
      }

      if (dateIso) {
        let d = dailyMap.get(dateIso);
        if (!d) {
          d = {
            transactions: 0,
            revenue: 0,
            actualHpp: 0,
            expense: 0,
            otherIncome: 0,
            products: new Map(),
          };
          dailyMap.set(dateIso, d);
        }
        if (isIncome) d.otherIncome += nominal;
        else d.expense += nominal;
      }
      continue;
    }

    // Default: penjualan / lainnya
    const qty = Math.max(1, toNum(pickField(row, ['Qty', 'qty', 'Jumlah', 'jumlah'])) || 1);
    const unitPrice = toNum(
      pickField(row, ['Harga_Satuan', 'harga_satuan', 'Harga_Jual', 'harga'])
    );
    const rowTotal =
      toNum(pickField(row, ['Total', 'total', 'Omzet', 'omzet'])) || qty * unitPrice;
    const unitCost = toNum(
      pickField(row, ['Harga_Modal', 'harga_modal', 'modal', 'hpp'])
    );
    const rowHpp = unitCost > 0 ? unitCost * qty : 0;
    const rowProfit = rowTotal - rowHpp;

    const prodName = String(
      pickField(row, ['Nama_Produk', 'nama_produk', 'produk', 'nama']) || 'Item Penjualan'
    ).trim();
    const prodCat = String(
      pickField(row, ['Kategori', 'kategori', 'category']) || 'Umum'
    ).trim();
    const payMethod = String(
      pickField(row, ['Metode_Bayar', 'metode_bayar', 'pembayaran', 'payment']) || 'Tunai'
    ).trim();
    const dateIso = parseFlexibleDateIso(
      pickField(row, ['Tanggal', 'tanggal', 'Date', 'date', 'tgl'])
    );

    transactions += 1;
    revenue += rowTotal;
    actualHpp += rowHpp;

    // Agregasi Produk
    const prevProd = productMap.get(prodName) || {
      name: prodName,
      category: prodCat,
      qtySold: 0,
      revenue: 0,
      grossProfit: 0,
      hasActualHpp: unitCost > 0,
    };
    prevProd.qtySold += qty;
    prevProd.revenue += rowTotal;
    prevProd.grossProfit += rowProfit;
    if (unitCost > 0) prevProd.hasActualHpp = true;
    productMap.set(prodName, prevProd);

    // Agregasi Metode Bayar & Kategori
    const prevPay = paymentMap.get(payMethod) || { count: 0, revenue: 0 };
    prevPay.count += 1;
    prevPay.revenue += rowTotal;
    paymentMap.set(payMethod, prevPay);

    const prevCat = categoryMap.get(prodCat) || { count: 0, revenue: 0 };
    prevCat.count += qty;
    prevCat.revenue += rowTotal;
    categoryMap.set(prodCat, prevCat);

    // Agregasi Harian
    if (dateIso) {
      let d = dailyMap.get(dateIso);
      if (!d) {
        d = {
          transactions: 0,
          revenue: 0,
          actualHpp: 0,
          expense: 0,
          otherIncome: 0,
          products: new Map(),
        };
        dailyMap.set(dateIso, d);
      }
      d.transactions += 1;
      d.revenue += rowTotal;
      d.actualHpp += rowHpp;

      const dayProd = d.products.get(prodName) || { qty: 0, revenue: 0 };
      dayProd.qty += qty;
      dayProd.revenue += rowTotal;
      d.products.set(prodName, dayProd);
    }
  }

  const dailyStats: Record<string, DailyRollupBucket> = {};
  for (const [iso, d] of dailyMap.entries()) {
    const topProducts = Array.from(d.products.entries())
      .map(([name, st]) => ({ name, qty: st.qty, revenue: st.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    dailyStats[iso] = {
      transactions: d.transactions,
      revenue: d.revenue,
      actualHpp: d.actualHpp,
      expense: d.expense,
      otherIncome: d.otherIncome,
      topProducts,
    };
  }

  const productSales: Record<string, ProductRollupBucket> = {};
  for (const [k, v] of productMap.entries()) {
    productSales[k] = v;
  }

  const paymentBreakdown: Record<string, { count: number; revenue: number }> = {};
  for (const [k, v] of paymentMap.entries()) {
    paymentBreakdown[k] = v;
  }

  const categoryBreakdown: Record<string, { count: number; revenue: number }> = {};
  for (const [k, v] of categoryMap.entries()) {
    categoryBreakdown[k] = v;
  }

  return {
    totalRows: rows.length,
    transactions,
    revenue,
    actualHpp,
    grossProfit: revenue - actualHpp,
    expense,
    otherIncome,
    monthlyPayroll,
    productSku,
    stockUnits,
    inventoryAssetValue,
    dailyStats,
    productSales,
    paymentBreakdown,
    categoryBreakdown,
    lowStockItems,
  };
}

function openScaleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak didukung di browser ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const store = db.createObjectStore(STORE_CHUNKS, { keyPath: 'chunkKey' });
        store.createIndex('by_dataset', 'datasetId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Gagal membuka IndexedDB.'));
  });
}

async function deleteDatasetChunksOnly(db: IDBDatabase, datasetId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    const index = tx.objectStore(STORE_CHUNKS).index('by_dataset');
    const cursorReq = index.openCursor(IDBKeyRange.only(datasetId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal membersihkan blok lama.'));
  });
}

export async function saveDatasetChunked(
  dataset: {
    id: string;
    name: string;
    category: string;
    rows: DatasetRow[];
    createdAt?: string;
  },
  onProgress?: (percent: number) => void
): Promise<SavedDataset> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  const db = await openScaleDb();
  await deleteDatasetChunksOnly(db, dataset.id);

  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const rollup = computeDatasetRollup(dataset.category, rows);
  const totalChunks = Math.max(1, Math.ceil(rows.length / CHUNK_SIZE));
  const nowIso = new Date().toISOString();

  for (let i = 0; i < totalChunks; i++) {
    const slice = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunk: DatasetChunkRecord = {
      chunkKey: `${dataset.id}::${i}`,
      datasetId: dataset.id,
      chunkIndex: i,
      rows: slice,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, 'readwrite');
      tx.objectStore(STORE_CHUNKS).put(chunk);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Gagal menyimpan blok data.'));
    });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
    if (i % 2 === 1) {
      await yieldToUi();
    }
  }

  const sampleRows = rows.slice(0, 25);
  const meta: DatasetMetaRecord = {
    id: dataset.id,
    name: dataset.name,
    category: dataset.category,
    rowCount: rows.length,
    chunkCount: totalChunks,
    rollup,
    sampleRows,
    createdAt: dataset.createdAt || nowIso,
    updatedAt: nowIso,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal menyimpan metadata.'));
  });

  // Kembalikan objek ringan ke React state agar RAM tidak terbebani ratusan ribu objek
  return {
    id: meta.id,
    name: meta.name,
    category: meta.category,
    rowCount: meta.rowCount,
    rollup: meta.rollup,
    rows: sampleRows,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

export async function loadAllDatasetsLight(): Promise<SavedDataset[]> {
  const db = await openScaleDb();
  const metas = await new Promise<DatasetMetaRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).getAll();
    req.onsuccess = () => resolve((req.result as DatasetMetaRecord[]) || []);
    req.onerror = () => reject(req.error ?? new Error('Gagal membaca daftar dataset.'));
  });

  return metas.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    rowCount: m.rowCount,
    rollup: m.rollup,
    rows: m.sampleRows || [],
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));
}

/**
 * Membaca HANYA 1 halaman (misal 25 baris) langsung dari blok IndexedDB yang relevan.
 * Memori per halaman nyaris 0 MB meskipun total data 500.000 baris.
 */
export async function queryCategoryPageRows(params: {
  category: string;
  page: number;
  pageSize: number;
  searchQuery?: string;
}): Promise<{ rows: DatasetRow[]; totalMatched: number }> {
  const { category, page, pageSize, searchQuery } = params;
  const db = await openScaleDb();

  const allMetas = await new Promise<DatasetMetaRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).getAll();
    req.onsuccess = () => resolve((req.result as DatasetMetaRecord[]) || []);
    req.onerror = () => reject(req.error ?? new Error('Gagal membaca metadata.'));
  });

  const targetMetas = allMetas.filter(
    (m) => m.category.toLowerCase() === category.toLowerCase()
  );

  if (targetMetas.length === 0) {
    return { rows: [], totalMatched: 0 };
  }

  const q = (searchQuery || '').trim().toLowerCase();
  const startIdx = Math.max(0, (page - 1) * pageSize);
  const endIdx = startIdx + pageSize;

  // Jalur super cepat tanpa pencarian: langsung ambil tepat 1 chunk yang memuat halaman tersebut
  if (!q) {
    let cumulative = 0;
    const totalRows = targetMetas.reduce((acc, m) => acc + m.rowCount, 0);
    const pageRows: DatasetRow[] = [];

    for (const meta of targetMetas) {
      const dsStart = cumulative;
      const dsEnd = cumulative + meta.rowCount;
      cumulative = dsEnd;

      if (dsEnd <= startIdx || dsStart >= endIdx) continue;

      const localStart = Math.max(0, startIdx - dsStart);
      const localEnd = Math.min(meta.rowCount, endIdx - dsStart);
      const firstChunk = Math.floor(localStart / CHUNK_SIZE);
      const lastChunk = Math.floor(Math.max(0, localEnd - 1) / CHUNK_SIZE);

      for (let cIdx = firstChunk; cIdx <= lastChunk; cIdx++) {
        const chunkRec = await new Promise<DatasetChunkRecord | undefined>(
          (resolve, reject) => {
            const tx = db.transaction(STORE_CHUNKS, 'readonly');
            const req = tx
              .objectStore(STORE_CHUNKS)
              .get(`${meta.id}::${cIdx}`);
            req.onsuccess = () => resolve(req.result as DatasetChunkRecord | undefined);
            req.onerror = () => reject(req.error);
          }
        );

        if (!chunkRec) continue;
        const chunkGlobalStart = cIdx * CHUNK_SIZE;
        const sliceFrom = Math.max(0, localStart - chunkGlobalStart);
        const sliceTo = Math.min(chunkRec.rows.length, localEnd - chunkGlobalStart);
        for (let r = sliceFrom; r < sliceTo; r++) {
          pageRows.push(chunkRec.rows[r]);
        }
      }
    }

    return { rows: pageRows, totalMatched: totalRows };
  }

  // Jalur pencarian streaming per chunk (tetap hemat RAM)
  let matchedCount = 0;
  const matchedPageRows: DatasetRow[] = [];

  for (const meta of targetMetas) {
    for (let cIdx = 0; cIdx < meta.chunkCount; cIdx++) {
      const chunkRec = await new Promise<DatasetChunkRecord | undefined>(
        (resolve, reject) => {
          const tx = db.transaction(STORE_CHUNKS, 'readonly');
          const req = tx.objectStore(STORE_CHUNKS).get(`${meta.id}::${cIdx}`);
          req.onsuccess = () => resolve(req.result as DatasetChunkRecord | undefined);
          req.onerror = () => reject(req.error);
        }
      );
      if (!chunkRec) continue;

      for (let r = 0; r < chunkRec.rows.length; r++) {
        const row = chunkRec.rows[r];
        const hit = Object.values(row).some((val) =>
          String(val ?? '').toLowerCase().includes(q)
        );
        if (hit) {
          if (matchedCount >= startIdx && matchedCount < endIdx) {
            matchedPageRows.push(row);
          }
          matchedCount += 1;
        }
      }
    }
  }

  return { rows: matchedPageRows, totalMatched: matchedCount };
}

export async function appendSingleRowToCategory(
  category: DatasetCategory,
  newRow: DatasetRow
): Promise<SavedDataset> {
  const db = await openScaleDb();
  const allMetas = await new Promise<DatasetMetaRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).getAll();
    req.onsuccess = () => resolve((req.result as DatasetMetaRecord[]) || []);
    req.onerror = () => reject(req.error);
  });

  const existing = allMetas.find((m) => m.category === category);
  const existingRows: DatasetRow[] = [];

  if (existing) {
    for (let cIdx = 0; cIdx < existing.chunkCount; cIdx++) {
      const chunkRec = await new Promise<DatasetChunkRecord | undefined>(
        (resolve, reject) => {
          const tx = db.transaction(STORE_CHUNKS, 'readonly');
          const req = tx.objectStore(STORE_CHUNKS).get(`${existing.id}::${cIdx}`);
          req.onsuccess = () => resolve(req.result as DatasetChunkRecord | undefined);
          req.onerror = () => reject(req.error);
        }
      );
      if (chunkRec) {
        for (let r = 0; r < chunkRec.rows.length; r++) {
          existingRows.push(chunkRec.rows[r]);
        }
      }
    }
  }

  existingRows.unshift(newRow);
  return saveDatasetChunked({
    id: existing ? existing.id : `manual_${category}`,
    name: existing ? existing.name : `Catatan_${category}.csv`,
    category,
    rows: existingRows,
    createdAt: existing?.createdAt || new Date().toISOString(),
  });
}

export async function deleteDatasetChunked(datasetId: string): Promise<void> {
  const db = await openScaleDb();
  await deleteDatasetChunksOnly(db, datasetId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).delete(datasetId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllDatasetsChunked(): Promise<void> {
  const db = await openScaleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_META).clear();
    tx.objectStore(STORE_CHUNKS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}