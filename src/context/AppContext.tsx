import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type {
  ColumnProfile,
  DatasetCategory,
  ImportMode,
  ParsedDatasetDraft,
} from '../types/dataset';
import type { BusinessProfile, PageId } from '../types/navigation';

export type ManualDbTab = 'sales' | 'finance' | 'inventory' | 'employee';

export interface StoredDataset {
  id: string;
  fileName: string;
  category: DatasetCategory;
  columns: ColumnProfile[];
  rows: Record<string, unknown>[];
  lastUpdatedAt: string;
}

export interface ImportHistoryRecord {
  id: string;
  datasetId: string;
  fileName: string;
  category: DatasetCategory;
  importMode: ImportMode;
  rowsAdded: number;
  rowsSkipped: number;
  previousSnapshot: StoredDataset | null;
  createdAt: string;
}

interface AppContextValue {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  theme: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  businessProfile: BusinessProfile;
  updateBusinessProfile: (profile: Partial<BusinessProfile>) => void;
  savedDatasets: StoredDataset[];
  saveDatasets: (datasets: StoredDataset[]) => void;
  importHistories: ImportHistoryRecord[];
  commitDatasetDraft: (draft: ParsedDatasetDraft, mode: ImportMode) => void;
  addManualRecord: (category: ManualDbTab, row: Record<string, unknown>) => void;
  deleteManualRecord: (category: ManualDbTab, rowIndex: number) => void;
  loadQuickSampleUmkm: () => void;
  deleteDataset: (datasetId: string) => void;
  undoImportRecord: (historyId: string) => void;
}

const DEFAULT_PROFILE: BusinessProfile = {
  name: 'Warung & Toko Maju Bersama',
  businessType: 'retail',
  currency: 'IDR',
  city: 'Sumedang, Jawa Barat',
  ownerName: 'Pemilik Usaha',
  notes: 'Pencatatan harian penjualan, pembelian stok, dan data karyawan UMKM.',
  updatedAt: new Date().toISOString(),
};

const KEYS = {
  THEME: 'smart_umkm_theme',
  PROFILE: 'smart_umkm_business_profile',
  DATASETS: 'smart_umkm_saved_datasets_v1',
  HISTORIES: 'smart_umkm_import_histories_v1',
};

const DEFAULT_SCHEMAS: Record<ManualDbTab, { title: string; columns: ColumnProfile[] }> = {
  sales: {
    title: 'Database Penjualan Usaha',
    columns: [
      { originalName: 'Tanggal', normalizedName: 'tanggal', detectedType: 'date', suggestedRole: 'date', confirmedRole: 'date', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Nama_Produk', normalizedName: 'nama_produk', detectedType: 'string', suggestedRole: 'product_name', confirmedRole: 'product_name', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Kategori', normalizedName: 'kategori', detectedType: 'string', suggestedRole: 'category', confirmedRole: 'category', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Qty', normalizedName: 'qty', detectedType: 'number', suggestedRole: 'quantity', confirmedRole: 'quantity', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Harga_Modal', normalizedName: 'harga_modal', detectedType: 'number', suggestedRole: 'cost_price', confirmedRole: 'cost_price', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Harga_Jual', normalizedName: 'harga_jual', detectedType: 'number', suggestedRole: 'unit_price', confirmedRole: 'unit_price', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Total', normalizedName: 'total', detectedType: 'number', suggestedRole: 'amount', confirmedRole: 'amount', nullCount: 0, sampleValues: [], confidence: 1 },
    ],
  },
  finance: {
    title: 'Database Pembelian & Kas Usaha',
    columns: [
      { originalName: 'Tanggal', normalizedName: 'tanggal', detectedType: 'date', suggestedRole: 'date', confirmedRole: 'date', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Jenis_Transaksi', normalizedName: 'jenis_transaksi', detectedType: 'string', suggestedRole: 'transaction_type', confirmedRole: 'transaction_type', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Nama_Barang_Keperluan', normalizedName: 'nama_barang', detectedType: 'string', suggestedRole: 'product_name', confirmedRole: 'product_name', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Supplier_Keterangan', normalizedName: 'supplier', detectedType: 'string', suggestedRole: 'text', confirmedRole: 'text', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Qty', normalizedName: 'qty', detectedType: 'number', suggestedRole: 'quantity', confirmedRole: 'quantity', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Nominal', normalizedName: 'nominal', detectedType: 'number', suggestedRole: 'amount', confirmedRole: 'amount', nullCount: 0, sampleValues: [], confidence: 1 },
    ],
  },
  inventory: {
    title: 'Database Produk & Stok',
    columns: [
      { originalName: 'Kode_SKU', normalizedName: 'kode_sku', detectedType: 'string', suggestedRole: 'identifier', confirmedRole: 'identifier', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Nama_Produk', normalizedName: 'nama_produk', detectedType: 'string', suggestedRole: 'product_name', confirmedRole: 'product_name', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Kategori', normalizedName: 'kategori', detectedType: 'string', suggestedRole: 'category', confirmedRole: 'category', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Harga_Modal', normalizedName: 'harga_modal', detectedType: 'number', suggestedRole: 'cost_price', confirmedRole: 'cost_price', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Harga_Jual', normalizedName: 'harga_jual', detectedType: 'number', suggestedRole: 'unit_price', confirmedRole: 'unit_price', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Stok_Saat_Ini', normalizedName: 'stok_saat_ini', detectedType: 'number', suggestedRole: 'stock_current', confirmedRole: 'stock_current', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Stok_Minimum', normalizedName: 'stok_minimum', detectedType: 'number', suggestedRole: 'stock_min', confirmedRole: 'stock_min', nullCount: 0, sampleValues: [], confidence: 1 },
    ],
  },
  employee: {
    title: 'Database Karyawan UMKM',
    columns: [
      { originalName: 'Nama_Karyawan', normalizedName: 'nama_karyawan', detectedType: 'string', suggestedRole: 'text', confirmedRole: 'text', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Jabatan', normalizedName: 'jabatan', detectedType: 'string', suggestedRole: 'category', confirmedRole: 'category', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'No_HP', normalizedName: 'no_hp', detectedType: 'string', suggestedRole: 'identifier', confirmedRole: 'identifier', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Gaji_Bulanan', normalizedName: 'gaji_bulanan', detectedType: 'number', suggestedRole: 'amount', confirmedRole: 'amount', nullCount: 0, sampleValues: [], confidence: 1 },
      { originalName: 'Status', normalizedName: 'status', detectedType: 'string', suggestedRole: 'text', confirmedRole: 'text', nullCount: 0, sampleValues: [], confidence: 1 },
    ],
  },
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<PageId>('ringkasan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem(KEYS.THEME) === 'dark' ? 'dark' : 'light'
  );

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => {
    try {
      const saved = localStorage.getItem(KEYS.PROFILE);
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [savedDatasets, setSavedDatasets] = useState<StoredDataset[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.DATASETS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [importHistories, setImportHistories] = useState<ImportHistoryRecord[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.HISTORIES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(KEYS.THEME, theme);
  }, [theme]);

  const setThemeMode = (mode: 'light' | 'dark') => setTheme(mode);

  const persistDatasets = (next: StoredDataset[]) => {
    setSavedDatasets(next);
    localStorage.setItem(KEYS.DATASETS, JSON.stringify(next));
  };

  const persistHistories = (next: ImportHistoryRecord[]) => {
    setImportHistories(next);
    localStorage.setItem(KEYS.HISTORIES, JSON.stringify(next));
  };

  const updateBusinessProfile = (updates: Partial<BusinessProfile>) => {
    setBusinessProfile((prev) => {
      const next = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(next));
      return next;
    });
  };

  const addManualRecord = (category: ManualDbTab, row: Record<string, unknown>) => {
    const idx = savedDatasets.findIndex((d) => d.category === category);
    const schema = DEFAULT_SCHEMAS[category];
    const now = new Date().toISOString();

    if (idx >= 0) {
      const target = savedDatasets[idx];
      const updated: StoredDataset = {
        ...target,
        rows: [row, ...target.rows],
        lastUpdatedAt: now,
      };
      const next = [...savedDatasets];
      next[idx] = updated;
      persistDatasets(next);
    } else {
      const created: StoredDataset = {
        id: `db_${category}_${Date.now()}`,
        fileName: schema.title,
        category,
        columns: schema.columns,
        rows: [row],
        lastUpdatedAt: now,
      };
      persistDatasets([created, ...savedDatasets]);
    }
  };

  const deleteManualRecord = (category: ManualDbTab, rowIndex: number) => {
    const idx = savedDatasets.findIndex((d) => d.category === category);
    if (idx < 0) return;
    const target = savedDatasets[idx];
    const nextRows = target.rows.filter((_, i) => i !== rowIndex);
    const next = [...savedDatasets];
    next[idx] = {
      ...target,
      rows: nextRows,
      lastUpdatedAt: new Date().toISOString(),
    };
    persistDatasets(next);
  };

  const loadQuickSampleUmkm = () => {
    const now = new Date().toISOString();
    const samples: StoredDataset[] = [
      {
        id: `db_inventory_${Date.now()}`,
        fileName: DEFAULT_SCHEMAS.inventory.title,
        category: 'inventory',
        columns: DEFAULT_SCHEMAS.inventory.columns,
        lastUpdatedAt: now,
        rows: [
          { Kode_SKU: 'PRD-01', Nama_Produk: 'Beras Pandan Wangi 5kg', Kategori: 'Sembako', Harga_Modal: 62000, Harga_Jual: 72000, Stok_Saat_Ini: 18, Stok_Minimum: 5 },
          { Kode_SKU: 'PRD-02', Nama_Produk: 'Minyak Goreng 2L', Kategori: 'Sembako', Harga_Modal: 31000, Harga_Jual: 36000, Stok_Saat_Ini: 4, Stok_Minimum: 6 },
          { Kode_SKU: 'PRD-03', Nama_Produk: 'Telur Ayam 1kg', Kategori: 'Bahan Pokok', Harga_Modal: 24000, Harga_Jual: 28000, Stok_Saat_Ini: 25, Stok_Minimum: 8 },
          { Kode_SKU: 'PRD-04', Nama_Produk: 'Gula Pasir 1kg', Kategori: 'Sembako', Harga_Modal: 14500, Harga_Jual: 17500, Stok_Saat_Ini: 3, Stok_Minimum: 5 },
          { Kode_SKU: 'PRD-05', Nama_Produk: 'Gas LPG 3kg', Kategori: 'Energi', Harga_Modal: 18500, Harga_Jual: 22000, Stok_Saat_Ini: 12, Stok_Minimum: 5 },
        ],
      },
      {
        id: `db_sales_${Date.now() + 1}`,
        fileName: DEFAULT_SCHEMAS.sales.title,
        category: 'sales',
        columns: DEFAULT_SCHEMAS.sales.columns,
        lastUpdatedAt: now,
        rows: [
          { Tanggal: '2026-11-12', Nama_Produk: 'Beras Pandan Wangi 5kg', Kategori: 'Sembako', Qty: 5, Harga_Modal: 62000, Harga_Jual: 72000, Total: 360000 },
          { Tanggal: '2026-11-13', Nama_Produk: 'Minyak Goreng 2L', Kategori: 'Sembako', Qty: 8, Harga_Modal: 31000, Harga_Jual: 36000, Total: 288000 },
          { Tanggal: '2026-11-14', Nama_Produk: 'Telur Ayam 1kg', Kategori: 'Bahan Pokok', Qty: 12, Harga_Modal: 24000, Harga_Jual: 28000, Total: 336000 },
          { Tanggal: '2026-11-14', Nama_Produk: 'Gas LPG 3kg', Kategori: 'Energi', Qty: 9, Harga_Modal: 18500, Harga_Jual: 22000, Total: 198000 },
          { Tanggal: '2026-11-15', Nama_Produk: 'Beras Pandan Wangi 5kg', Kategori: 'Sembako', Qty: 6, Harga_Modal: 62000, Harga_Jual: 72000, Total: 432000 },
        ],
      },
      {
        id: `db_finance_${Date.now() + 2}`,
        fileName: DEFAULT_SCHEMAS.finance.title,
        category: 'finance',
        columns: DEFAULT_SCHEMAS.finance.columns,
        lastUpdatedAt: now,
        rows: [
          { Tanggal: '2026-11-11', Jenis_Transaksi: 'Pembelian Stok', Nama_Barang_Keperluan: 'Kulakan Beras & Minyak', Supplier_Keterangan: 'Agen Sumber Makmur', Qty: 1, Nominal: 620000 },
          { Tanggal: '2026-11-13', Jenis_Transaksi: 'Pembelian Stok', Nama_Barang_Keperluan: 'Kulakan Telur Ayam 1 Peti', Supplier_Keterangan: 'Peternakan Jaya', Qty: 1, Nominal: 360000 },
          { Tanggal: '2026-11-15', Jenis_Transaksi: 'Operasional', Nama_Barang_Keperluan: 'Token Listrik & Plastik', Supplier_Keterangan: 'Operasional Toko', Qty: 1, Nominal: 115000 },
        ],
      },
      {
        id: `db_employee_${Date.now() + 3}`,
        fileName: DEFAULT_SCHEMAS.employee.title,
        category: 'employee',
        columns: DEFAULT_SCHEMAS.employee.columns,
        lastUpdatedAt: now,
        rows: [
          { Nama_Karyawan: 'Rina Marlina', Jabatan: 'Kasir & Admin', No_HP: '081234567890', Gaji_Bulanan: 2200000, Status: 'Aktif' },
          { Nama_Karyawan: 'Dedi Kurniawan', Jabatan: 'Gudang & Antar Barang', No_HP: '085712345678', Gaji_Bulanan: 2000000, Status: 'Aktif' },
        ],
      },
    ];
    persistDatasets(samples);
  };

  const commitDatasetDraft = (draft: ParsedDatasetDraft, mode: ImportMode) => {
    const existingIndex = savedDatasets.findIndex((d) => d.category === draft.confirmedCategory);
    const existing = existingIndex >= 0 ? savedDatasets[existingIndex] : null;
    const previousSnapshot = existing ? structuredClone(existing) : null;

    let finalRows: Record<string, unknown>[] = [];
    let rowsAdded = 0;
    let rowsSkipped = 0;

    if (!existing || mode === 'replace') {
      finalRows = draft.rows;
      rowsAdded = draft.rows.length;
    } else if (mode === 'append') {
      finalRows = [...draft.rows, ...existing.rows];
      rowsAdded = draft.rows.length;
    } else {
      const existingHashes = new Set(existing.rows.map((r) => JSON.stringify(r)));
      const uniqueNew: Record<string, unknown>[] = [];
      for (const row of draft.rows) {
        const h = JSON.stringify(row);
        if (existingHashes.has(h)) {
          rowsSkipped++;
        } else {
          existingHashes.add(h);
          uniqueNew.push(row);
        }
      }
      finalRows = [...uniqueNew, ...existing.rows];
      rowsAdded = uniqueNew.length;
    }

    const updatedDataset: StoredDataset = {
      id: existing ? existing.id : `ds_${Date.now()}`,
      fileName: draft.fileName,
      category: draft.confirmedCategory,
      columns: draft.columns,
      rows: finalRows,
      lastUpdatedAt: new Date().toISOString(),
    };

    const nextDatasets = [...savedDatasets];
    if (existingIndex >= 0) {
      nextDatasets[existingIndex] = updatedDataset;
    } else {
      nextDatasets.unshift(updatedDataset);
    }

    const historyEntry: ImportHistoryRecord = {
      id: `hist_${Date.now()}`,
      datasetId: updatedDataset.id,
      fileName: draft.fileName,
      category: draft.confirmedCategory,
      importMode: mode,
      rowsAdded,
      rowsSkipped,
      previousSnapshot,
      createdAt: new Date().toISOString(),
    };

    persistDatasets(nextDatasets);
    persistHistories([historyEntry, ...importHistories].slice(0, 30));
  };

  const deleteDataset = (datasetId: string) => {
    persistDatasets(savedDatasets.filter((d) => d.id !== datasetId));
  };

  const undoImportRecord = (historyId: string) => {
    const target = importHistories.find((h) => h.id === historyId);
    if (!target) return;

    if (target.previousSnapshot) {
      persistDatasets(
        savedDatasets.map((d) => (d.id === target.datasetId ? target.previousSnapshot! : d))
      );
    } else {
      persistDatasets(savedDatasets.filter((d) => d.id !== target.datasetId));
    }
    persistHistories(importHistories.filter((h) => h.id !== historyId));
  };

  return (
    <AppContext.Provider
      value={{
        activePage,
        setActivePage,
        theme,
        setThemeMode,
        mobileMenuOpen,
        setMobileMenuOpen,
        businessProfile,
        updateBusinessProfile,
        savedDatasets,
        saveDatasets: persistDatasets,
        importHistories,
        commitDatasetDraft,
        addManualRecord,
        deleteManualRecord,
        loadQuickSampleUmkm,
        deleteDataset,
        undoImportRecord,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus di dalam AppProvider');
  return ctx;
}