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
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useApp();

  if (!mobileMenuOpen) return null;

  const handleSelectPage = (page: PageId) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className="relative w-68 max-w-[82vw] h-full z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <BrandLogo />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-1">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
            {businessProfile.name}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {businessProfile.city || 'UMKM'}
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPage(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}