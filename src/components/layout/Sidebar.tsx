import type { ComponentType } from 'react';
import {
  Bot,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  PieChart,
  Settings,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { NavItem, PageId } from '../../types/navigation';
import { BrandLogo } from '../BrandLogo';

export const NAV_ITEMS: NavItem[] = [
  { id: 'ringkasan', label: 'Ringkasan Usaha', description: 'Pantau kondisi harian warung' },
  { id: 'database', label: 'Database Usaha', description: 'Kelola file & catatan transaksi' },
  { id: 'analisis', label: 'Grafik & Analisis', description: 'Visualisasi & pembersihan anomali data' },
  { id: 'asisten-ai', label: 'Asisten AI Usaha', description: 'Tanya jawab & saran bisnis cerdas' },
  { id: 'laporan', label: 'Laporan & Ekspor', description: 'Unduh rekap Excel, CSV & PDF' },
  { id: 'pengaturan', label: 'Pengaturan', description: 'Profil usaha, tema & kunci AI' },
];

const MAIN_MENU: NavItem[] = NAV_ITEMS.filter((item) => item.id !== 'pengaturan');

const ICON_MAP: Record<PageId, ComponentType<{ className?: string }>> = {
  ringkasan: LayoutDashboard,
  database: Database,
  analisis: PieChart,
  'asisten-ai': Bot,
  laporan: FileSpreadsheet,
  pengaturan: Settings,
};

export function Sidebar() {
  const { activePage, setActivePage, mobileMenuOpen, setMobileMenuOpen, businessProfile } = useApp();

  const selectPage = (id: PageId) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  const body = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64">
      {/* Header Logo */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <BrandLogo size="md" subtitle="Website Manajemen UMKM" />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Info Usaha Aktif */}
      <div className="px-4 pt-5 pb-2 shrink-0">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Usaha Aktif
          </p>
          <p className="text-xs font-bold truncate mt-1">{businessProfile.name}</p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {businessProfile.city} • {businessProfile.currency}
          </p>
        </div>
      </div>

      {/* Menu Utama (Lega & Terpisah) */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-2">
        {MAIN_MENU.map((item) => {
          const Icon = ICON_MAP[item.id];
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectPage(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Pengaturan Paling Bawah Sidebar */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => selectPage('pengaturan')}
          className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
            activePage === 'pengaturan'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Pengaturan</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{body}</aside>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 flex">{body}</div>
        </div>
      )}
    </>
  );
}