import { Menu, PlusCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NAV_ITEMS } from './Sidebar';

export function Topbar() {
  const { activePage, setActivePage, setMobileMenuOpen } = useApp();
  const current = NAV_ITEMS.find((n) => n.id === activePage);

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold">{current?.label ?? 'Ringkasan Usaha'}</h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            {current?.description ?? 'Kelola catatan dan analisis UMKM'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setActivePage('database')}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Catat Data Usaha</span>
      </button>
    </header>
  );
}