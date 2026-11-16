import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  loadDatasetsFromDB,
  loadImportHistoryFromDB,
  saveDatasetsToDB,
  saveImportHistoryToDB,
} from '../lib/datasetStorage';
import {
  buildRowSignature,
  type BusinessCategory,
  type DatasetCategory,
  type ImportMode,
} from '../lib/fileParser';
import type { BusinessProfile, PageId } from '../types/navigation';

export type { BusinessCategory, DatasetCategory, ImportMode };

export interface StoredDataset {
  id: string;
  fileName: string;
  name: string;
  category: DatasetCategory;
  columns: string[];
  rows: Record<string, unknown>[];
  uploadedAt: string;
}

export interface ImportHistoryItem {
  id: string;
  importedAt: string;
  fileName: string;
  sheetName: string;
  category: BusinessCategory;
  mode: ImportMode;
  rowsSaved: number;
  duplicatesSkipped: number;
  summaryRowsSkipped: number;
}

interface AppContextType {
  savedDatasets: StoredDataset[];
  datasets: StoredDataset[];
  importHistory: ImportHistoryItem[];
  activeDataset: StoredDataset | null;
  setActiveDataset: (dataset: StoredDataset | null) => void;
  addDataset: (dataset: StoredDataset) => void;
  saveDataset: (dataset: StoredDataset) => void;
  importDataset: (dataset: StoredDataset) => void;
  commitSmartImport: (
    dataset: StoredDataset,
    mode: ImportMode,
    historyMeta: Omit<ImportHistoryItem, 'id' | 'importedAt'>
  ) => { savedCount: number; skippedDuplicates: number };
  deleteDataset: (id: string) => void;
  clearAllDatasets: () => void;
  businessProfile: BusinessProfile;
  updateBusinessProfile: (patch: Partial<BusinessProfile>) => void;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const PROFILE_KEY = 'smart_umkm_profile_v1';
const THEME_KEY = 'smart_umkm_theme_v1';

const DEFAULT_PROFILE: BusinessProfile = {
  name: 'Warung & Toko Maju Bersama',
  businessType: 'retail',
  currency: 'IDR',
  city: 'Bandung, Jawa Barat',
  ownerName: 'Pemilik Usaha',
  notes: '',
  updatedAt: new Date().toISOString(),
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function normalizeDatasetRecord(raw: Record<string, unknown>): StoredDataset {
  const title = String(raw.fileName ?? raw.name ?? 'Dataset Usaha');
  const rows = Array.isArray(raw.rows) ? (raw.rows as Record<string, unknown>[]) : [];
  const cols = Array.isArray(raw.columns)
    ? (raw.columns as string[])
    : rows.length > 0
      ? Object.keys(rows[0])
      : [];

  return {
    id: String(raw.id ?? `ds_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    fileName: title,
    name: title,
    category: (raw.category as DatasetCategory) || 'general',
    columns: cols,
    rows,
    uploadedAt: String(raw.uploadedAt ?? new Date().toISOString()),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [savedDatasets, setSavedDatasets] = useState<StoredDataset[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [activeDataset, setActiveDataset] = useState<StoredDataset | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadDatasetsFromDB(), loadImportHistoryFromDB()]).then(([dsList, hist]) => {
      if (!mounted) return;
      if (dsList.length > 0) {
        setSavedDatasets(
          dsList.map((d) => normalizeDatasetRecord(d as unknown as Record<string, unknown>))
        );
      }
      if (hist.length > 0) {
        setImportHistory(hist);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return DEFAULT_PROFILE;
      return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<BusinessProfile>) };
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [activePage, setActivePage] = useState<PageId>('ringkasan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const upsertDataset = (incoming: StoredDataset) => {
    const normalized = normalizeDatasetRecord(incoming as unknown as Record<string, unknown>);
    setSavedDatasets((prev) => {
      const exists = prev.some((d) => d.id === normalized.id);
      const next = exists
        ? prev.map((d) => (d.id === normalized.id ? normalized : d))
        : [normalized, ...prev];
      void saveDatasetsToDB(next);
      return next;
    });
  };

  const commitSmartImport = (
    incoming: StoredDataset,
    mode: ImportMode,
    historyMeta: Omit<ImportHistoryItem, 'id' | 'importedAt'>
  ): { savedCount: number; skippedDuplicates: number } => {
    const normalized = normalizeDatasetRecord(incoming as unknown as Record<string, unknown>);
    const cat = (
      normalized.category === 'general' ? 'inventory' : normalized.category
    ) as BusinessCategory;

    let savedCount = normalized.rows.length;
    let skippedDuplicates = 0;

    setSavedDatasets((prev) => {
      let nextDatasets: StoredDataset[];

      if (mode === 'replace') {
        const others = prev.filter((d) => d.category !== cat);
        nextDatasets = [normalized, ...others];
        savedCount = normalized.rows.length;
      } else if (mode === 'append') {
        nextDatasets = [normalized, ...prev];
        savedCount = normalized.rows.length;
      } else {
        const existingSameCat = prev.filter((d) => d.category === cat);
        const otherCat = prev.filter((d) => d.category !== cat);

        if (existingSameCat.length === 0) {
          nextDatasets = [normalized, ...prev];
          savedCount = normalized.rows.length;
        } else if (cat === 'inventory') {
          const incomingByName = new Map<string, Record<string, unknown>>();
          normalized.rows.forEach((r) => {
            const key = String(r['Nama_Produk'] ?? '').trim().toLowerCase();
            if (key) incomingByName.set(key, r);
          });

          const updatedExisting = existingSameCat.map((ds) => ({
            ...ds,
            rows: ds.rows.map((oldRow) => {
              const key = String(oldRow['Nama_Produk'] ?? '').trim().toLowerCase();
              const match = incomingByName.get(key);
              if (match) {
                incomingByName.delete(key);
                skippedDuplicates += 1;
                return { ...oldRow, ...match };
              }
              return oldRow;
            }),
          }));

          const brandNewRows = Array.from(incomingByName.values());
          savedCount = brandNewRows.length + skippedDuplicates;

          if (brandNewRows.length > 0) {
            nextDatasets = [
              { ...normalized, rows: brandNewRows },
              ...updatedExisting,
              ...otherCat,
            ];
          } else {
            nextDatasets = [...updatedExisting, ...otherCat];
          }
        } else {
          const existingSigs = new Set<string>();
          existingSameCat.forEach((ds) =>
            ds.rows.forEach((r) => existingSigs.add(buildRowSignature(cat, r)))
          );

          const uniqueNewRows: Record<string, unknown>[] = [];
          for (const r of normalized.rows) {
            const sig = buildRowSignature(cat, r);
            if (existingSigs.has(sig)) {
              skippedDuplicates += 1;
            } else {
              existingSigs.add(sig);
              uniqueNewRows.push(r);
            }
          }

          savedCount = uniqueNewRows.length;
          nextDatasets =
            uniqueNewRows.length > 0
              ? [{ ...normalized, rows: uniqueNewRows }, ...existingSameCat, ...otherCat]
              : [...existingSameCat, ...otherCat];
        }
      }

      void saveDatasetsToDB(nextDatasets);
      return nextDatasets;
    });

    const historyRecord: ImportHistoryItem = {
      ...historyMeta,
      id: `imp_${Date.now()}`,
      importedAt: new Date().toISOString(),
      rowsSaved: savedCount,
      duplicatesSkipped: skippedDuplicates,
    };

    setImportHistory((prev) => {
      const nextHist = [historyRecord, ...prev];
      void saveImportHistoryToDB(nextHist);
      return nextHist;
    });

    return { savedCount, skippedDuplicates };
  };

  const deleteDataset = (id: string) => {
    setSavedDatasets((prev) => {
      const next = prev.filter((d) => d.id !== id);
      void saveDatasetsToDB(next);
      return next;
    });
    if (activeDataset?.id === id) {
      setActiveDataset(null);
    }
  };

  const clearAllDatasets = () => {
    setSavedDatasets([]);
    setActiveDataset(null);
    void saveDatasetsToDB([]);
  };

  const updateBusinessProfile = (patch: Partial<BusinessProfile>) => {
    setBusinessProfile((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <AppContext.Provider
      value={{
        savedDatasets,
        datasets: savedDatasets,
        importHistory,
        activeDataset,
        setActiveDataset,
        addDataset: upsertDataset,
        saveDataset: upsertDataset,
        importDataset: upsertDataset,
        commitSmartImport,
        deleteDataset,
        clearAllDatasets,
        businessProfile,
        updateBusinessProfile,
        activePage,
        setActivePage,
        theme,
        toggleTheme,
        mobileMenuOpen,
        setMobileMenuOpen,
        sidebarOpen: mobileMenuOpen,
        setSidebarOpen: setMobileMenuOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp harus digunakan di dalam AppProvider');
  }
  return ctx;
}