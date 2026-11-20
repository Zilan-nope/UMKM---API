import { BarChart3 } from 'lucide-react';
import { useMemo } from 'react';
import { TimeCalendarExplorer } from '../components/dashboard/TimeCalendarExplorer';
import { useApp } from '../context/AppContext';
import { buildUnifiedBusinessSnapshot } from '../lib/analyticsEngine';
import { formatFullRupiah, formatPercent } from '../lib/formatters';

export function AnalyticsPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const currency = businessProfile.currency || 'IDR';

  const snapshot = useMemo(
    () => buildUnifiedBusinessSnapshot(savedDatasets),
    [savedDatasets]
  );

  if (savedDatasets.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
        <BarChart3 className="w-10 h-10 text-emerald-600 mx-auto" />
        <h2 className="font-bold text-base">Belum Ada Data untuk Dianalisis</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Unggah file penjualan atau pembukuan untuk melihat kalender harian, rekap
          mingguan, dan laporan bulanan.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
        >
          Buka Data & Import
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TimeCalendarExplorer savedDatasets={savedDatasets} currency={currency} />

      {/* Peringkat Produk Terlaris */}
      {snapshot.topProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h3 className="font-bold text-sm">Top 10 Produk Terlaris</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                  <th className="py-2 pr-3 font-bold">#</th>
                  <th className="py-2 px-3 font-bold">Nama Produk</th>
                  <th className="py-2 px-3 font-bold text-right">Terjual</th>
                  <th className="py-2 px-3 font-bold text-right">Omzet</th>
                  <th className="py-2 pl-3 font-bold text-right">Laba Kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {snapshot.topProducts.slice(0, 10).map((p, idx) => (
                  <tr key={p.name}>
                    <td className="py-2.5 pr-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold">{p.name}</td>
                    <td className="py-2.5 px-3 text-right">
                      {p.qtySold.toLocaleString('id-ID')} unit
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {formatFullRupiah(p.revenue, currency)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold">
                      {formatFullRupiah(p.grossProfit, currency)} (
                      {formatPercent(
                        p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0
                      )}
                      )
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}