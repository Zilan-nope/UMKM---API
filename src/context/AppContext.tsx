import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  clearAllDatasetsChunked,
  deleteDatasetChunked,
  loadAllDatasetsLight,
  saveDatasetChunked,
  type DatasetRow,
  type SavedDataset,
} from '../lib/datasetStorage';
import type { PageId } from '../types/navigation';

export interface BusinessProfile {
  name: string;
  ownerName: string;
  city: string;
  businessType: string;
  currency: string;
}

interface IncomingDatasetInput {
  id: string;
  name: string;
  category: string;
  rows: DatasetRow[];
  createdAt?: string;
}

interface AppContextValue {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  businessProfile: BusinessProfile;
  updateBusinessProfile: (patch: Partial<BusinessProfile>) => void;
  setBusinessProfile: (next: BusinessProfile) => void;
  savedDatasets: SavedDataset[];
  saveDataset: (
    dataset: IncomingDatasetInput,
    onProgress?: (percent: number) => void
  ) => Promise<SavedDataset>;
  addDataset: (
    dataset: IncomingDatasetInput,
    onProgress?: (percent: number) => void
  ) => Promise<SavedDataset>;
  upsertDataset: (
    dataset: IncomingDatasetInput,
    onProgress?: (percent: number) => void
  ) => Promise<SavedDataset>;
  removeDataset: (id: string) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
  clearDatasets: () => Promise<void>;
  resetAllData: () => Promise<void>;
  isLoadingDatasets: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;
}

const DEFAULT_PROFILE: BusinessProfile = {
  name: 'Usaha UMKM',
  ownerName: 'Pemilik Usaha',
  city: 'Bandung, Jawa Barat',
  businessType: 'Toko Kelontong / Retail',
  currency: 'IDR',
};

const PROFILE_STORAGE_KEY = 'smart_umkm_business_profile';
const THEME_STORAGE_KEY = 'smart_umkm_dark_mode';

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<PageId>('ringkasan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true);
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);

  const [businessProfile, setBusinessProfileState] = useState<BusinessProfile>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<BusinessProfile>) };
      }
    } catch {
      // Abaikan
    }
    return DEFAULT_PROFILE;
  });

  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, String(darkMode));
    } catch {
      // Abaikan
    }
  }, [darkMode]);

  useEffect(() => {
    let active = true;
    loadAllDatasetsLight()
      .then((loaded) => {
        if (active) setSavedDatasets(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingDatasets(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setBusinessProfile = useCallback((next: BusinessProfile) => {
    setBusinessProfileState(next);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Abaikan
    }
  }, []);

  const updateBusinessProfile = useCallback((patch: Partial<BusinessProfile>) => {
    setBusinessProfileState((prev) => {
      const merged = { ...prev, ...patch };
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Abaikan
      }
      return merged;
    });
  }, []);

  const upsertDataset = useCallback(
    async (
      dataset: IncomingDatasetInput,
      onProgress?: (percent: number) => void
    ): Promise<SavedDataset> => {
      const lightSaved = await saveDatasetChunked(dataset, onProgress);
      setSavedDatasets((prev) => {
        const idx = prev.findIndex((d) => d.id === lightSaved.id);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = lightSaved;
          return copy;
        }
        return [...prev, lightSaved];
      });
      return lightSaved;
    },
    []
  );

  const removeDataset = useCallback(async (id: string) => {
    await deleteDatasetChunked(id);
    setSavedDatasets((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearDatasets = useCallback(async () => {
    await clearAllDatasetsChunked();
    setSavedDatasets([]);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState((v) => !v);
  }, []);

  return (
    <AppContext.Provider
      value={{
        activePage,
        setActivePage,
        businessProfile,
        updateBusinessProfile,
        setBusinessProfile,
        savedDatasets,
        saveDataset: upsertDataset,
        addDataset: upsertDataset,
        upsertDataset,
        removeDataset,
        deleteDataset: removeDataset,
        clearDatasets,
        resetAllData: clearDatasets,
        isLoadingDatasets,
        mobileMenuOpen,
        setMobileMenuOpen,
        darkMode,
        setDarkMode: setDarkModeState,
        toggleDarkMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus digunakan di dalam AppProvider');
  return ctx;
}