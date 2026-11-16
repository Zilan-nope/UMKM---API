import {
  BarChart3,
  Database,
  LayoutDashboard,
  Settings,
  Store,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { PageId } from '../../types/navigation';

const MENU_ITEMS: { id: PageId; label: string; desc: string; icon: typeof LayoutDashboard }[] = [
  {
    id: 'ringkasan',
    label: 'Ringkasan Usaha',
    desc: 'Omzet, HPP aktual & stok utama',
    icon: LayoutDashboard,
  },
  {
    id: 'analitik',
    label: 'Analitik & Grafik',
    desc: 'Tren kronologis & audit data',
    icon: BarChart3,
  },
  {
    id: 'database',
    label: 'Database & Import',
    desc: 'Smart File Import & transaksi',
    icon: Database,
  },
  {
    id: 'pengaturan',
    label: 'Pengaturan',
    desc: 'Profil usaha & tema tampilan',
    icon: Settings,
  },
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
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{businessProfile.name}</p>
            <p className="text-[11px] text-slate-500 truncate">
              {businessProfile.city || 'Smart UMKM BI'}
            </p>
          </div>
        </div>

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

      <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectPage(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold truncate">{item.label}</p>
                <p
                  className={`text-[11px] truncate ${
                    isActive ? 'text-emerald-100' : 'text-slate-500'
                  }`}
                >
                  {item.desc}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-xs">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Penyimpanan Offline</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {savedDatasets.length} dataset • {totalRows.toLocaleString('id-ID')} baris
          </p>
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