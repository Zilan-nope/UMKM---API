import { ArrowLeft, Layers } from 'lucide-react';
import { NAV_ITEMS } from '../components/layout/Sidebar';
import { useApp } from '../context/AppContext';

export function ModulePlaceholderPage() {
  const { activePage, setActivePage } = useApp();
  const current = NAV_ITEMS.find((item) => item.id === activePage);

  return (
    <div className="max-w-xl mx-auto mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-4">
        <Layers className="w-6 h-6" />
      </div>
      <span className="inline-block text-xs font-semibold uppercase px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
        {current?.description ?? 'Modul Sistem'}
      </span>
      <h2 className="text-xl font-bold">{current?.label ?? 'Modul Sistem'}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
        Kerangka navigasi modul ini sudah siap dibangun pada tahap berikutnya.
      </p>
      <button
        onClick={() => setActivePage('ringkasan')}
        className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
      >
        <ArrowLeft className="w-4 h-4" /> <span>Kembali ke Ringkasan</span>
      </button>
    </div>
  );
}