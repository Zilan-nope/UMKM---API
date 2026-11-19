import { Menu, PlusCircle } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { AppProvider, useApp } from './context/AppContext';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DatabasePage } from './pages/DatabasePage';
import { OverviewPage } from './pages/OverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  ringkasan: {
    title: 'Ringkasan Usaha',
    subtitle: 'Omzet aktual, HPP, laba kotor & kondisi stok',
  },
  analitik: {
    title: 'Analitik & Grafik',
    subtitle: 'Tren kronologis & audit kualitas data',
  },
  database: {
    title: 'Database Usaha',
    subtitle: 'Smart File Import (CSV/Excel/JSON) & pencatatan',
  },
  laporan: {
    title: 'Laporan & Ekspor',
    subtitle: 'Ikhtisar laba rugi & ekspor Excel, CSV, PDF',
  },
  ai: {
    title: 'Asisten Analisis Usaha',
    subtitle: 'Diagnosa kesehatan usaha & tanya jawab berbasis data',
  },
  pengaturan: {
    title: 'Pengaturan',
    subtitle: 'Profil usaha, mata uang & tema',
  },
};

function DashboardShell() {
  const { activePage, setActivePage, setMobileMenuOpen } = useApp();
  const currentMeta = PAGE_TITLES[activePage] ?? PAGE_TITLES.ringkasan;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold truncate">{currentMeta.title}</h1>
                <p className="text-xs text-slate-500 truncate">{currentMeta.subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActivePage('database')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Impor / Catat Data</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">
          {activePage === 'ringkasan' && <OverviewPage />}
          {activePage === 'analitik' && <AnalyticsPage />}
          {activePage === 'database' && <DatabasePage />}
          {activePage === 'laporan' && <ReportsPage />}
          {activePage === 'ai' && <AiAssistantPage />}
          {activePage === 'pengaturan' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <DashboardShell />
    </AppProvider>
  );
}

export default App;