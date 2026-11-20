import { Menu, Plus } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { AppProvider, useApp } from './context/AppContext';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DatabasePage } from './pages/DatabasePage';
import { OverviewPage } from './pages/OverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { PageId } from './types/navigation';

const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  ringkasan: {
    title: 'Ringkasan Usaha',
    subtitle: 'Omzet aktual, HPP, laba kotor & kondisi stok',
  },
  analitik: {
    title: 'Analitik & Kalender Waktu',
    subtitle: 'Lihat performa harian, mingguan, bulanan & kalender transaksi',
  },
  database: {
    title: 'Data & Import',
    subtitle: 'Unggah CSV/Excel dan kelola seluruh catatan usaha',
  },
  laporan: {
    title: 'Laporan Keuangan',
    subtitle: 'Laba rugi, arus kas & ekspor laporan pembukuan',
  },
  ai: {
    title: 'Asisten AI Usaha',
    subtitle: 'Tanya jawab cepat berbasis data aktual usaha Anda',
  },
  pengaturan: {
    title: 'Pengaturan',
    subtitle: 'Profil toko UMKM, API Key AI & preferensi tampilan',
  },
};

function AppShell() {
  const { activePage, setActivePage, setMobileMenuOpen } = useApp();
  const meta = PAGE_META[activePage] || PAGE_META.ringkasan;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Sidebar />

      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                {meta.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActivePage('database')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Impor / Catat Data</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activePage === 'ringkasan' && <OverviewPage />}
        {activePage === 'analitik' && <AnalyticsPage />}
        {activePage === 'database' && <DatabasePage />}
        {activePage === 'laporan' && <ReportsPage />}
        {activePage === 'ai' && <AiAssistantPage />}
        {activePage === 'pengaturan' && <SettingsPage />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default App;