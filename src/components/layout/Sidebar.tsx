import {
  BarChart3,
  Bot,
  Database,
  FileText,
  LayoutDashboard,
  Settings,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { PageId } from '../../types/navigation';
import { BrandLogo } from '../BrandLogo';

const MENU_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'ringkasan', label: 'Ringkasan Usaha', icon: LayoutDashboard },
  { id: 'analitik', label: 'Analitik & Grafik', icon: BarChart3 },
  { id: 'database', label: 'Data & Import', icon: Database },
  { id: 'laporan', label: 'Laporan Keuangan', icon: FileText },
  { id: 'ai', label: 'Asisten AI', icon: Bot },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

export function Sidebar() {
  const {
    activePage,
    setActivePage,
    businessProfile,
    savedDatasets,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useApp();

  const totalRows = savedDatasets.reduce((sum, ds) => sum + ds.rows.length, 0);

  const handleSelectPage = (page: PageId) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const renderMenuContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <BrandLogo />
        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
            {businessProfile.name}
          </p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {businessProfile.city || 'Usaha UMKM'}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2.5 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectPage(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span className="text-sm truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs flex items-center justify-between">
          <span className="text-slate-500">Data Tersimpan</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {totalRows.toLocaleString('id-ID')} baris
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30">
        {renderMenuContent(false)}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] h-full z-10 shadow-2xl">
            {renderMenuContent(true)}
          </div>
        </div>
      )}
    </>
  );
}