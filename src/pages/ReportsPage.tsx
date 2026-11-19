import {
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Printer,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, type StoredDataset } from '../context/AppContext';
import { buildUnifiedBusinessSnapshot } from '../lib/analyticsEngine';
import { normalizeBusinessDate } from '../lib/dateUtils';
import {
  exportFinancialReportCsv,
  exportFinancialReportXlsx,
} from '../lib/exportUtils';
import {
  formatCompactRupiah,
  formatFullRupiah,
  formatPercent,
} from '../lib/formatters';

type PeriodFilter = 'all' | '30d' | 'month';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'Semua Periode Tercatat',
  '30d': '30 Hari Terakhir',
  month: 'Bulan Berjalan',
};

export function ReportsPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const currency = businessProfile.currency || 'IDR';
  const rpFull = (n: number) => formatFullRupiah(n, currency);
  const rpCompact = (n: number) => formatCompactRupiah(n, currency);

  const filteredDatasets = useMemo<StoredDataset[]>(() => {
    if (period === 'all') return savedDatasets;

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000)
      .toISOString()
      .slice(0, 10);

    return savedDatasets.map((ds) => {
      if (ds.category !== 'sales' && ds.category !== 'finance') {
        return ds;
      }
      const rows = ds.rows.filter((r) => {
        const iso = normalizeBusinessDate(r['Tanggal']);
        if (!iso) return false;
        if (period === 'month') return iso.startsWith(currentMonthPrefix);
        return iso >= thirtyDaysAgo;
      });
      return { ...ds, rows };
    });
  }, [savedDatasets, period]);

  const snapshot = useMemo(
    () => buildUnifiedBusinessSnapshot(filteredDatasets),
    [filteredDatasets]
  );

  if (savedDatasets.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <FileText className="w-10 h-10 text-emerald-600 mx-auto" />
        <h2 className="text-lg font-bold">Belum Ada Data untuk Laporan</h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Impor atau catat transaksi terlebih dahulu agar laporan laba rugi dan file Excel/PDF dapat
          dibuat otomatis.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
        >
          <Upload className="w-4 h-4" />
          <span>Ke Database Usaha</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-sm sm:text-base">
            Laporan Keuangan — {businessProfile.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Periode aktif: <strong>{PERIOD_LABELS[period]}</strong>
            {snapshot.dateRange.start
              ? ` (${snapshot.dateRange.start} s.d. ${snapshot.dateRange.end})`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="all">Semua Periode</option>
            <option value="30d">30 Hari Terakhir</option>
            <option value="month">Bulan Ini</option>
          </select>

          <button
            type="button"
            onClick={() =>
              exportFinancialReportXlsx(
                businessProfile.name,
                PERIOD_LABELS[period],
                snapshot,
                filteredDatasets
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.XLSX)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportFinancialReportCsv(
                businessProfile.name,
                PERIOD_LABELS[period],
                currency,
                snapshot
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {snapshot.salesWithoutHppCount > 0 && (
        <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p>
            Laporan di bawah menggunakan angka transaksi terverifikasi. Sebanyak{' '}
            <strong>{snapshot.salesWithoutHppCount.toLocaleString('id-ID')} transaksi</strong>{' '}
            (omzet {rpCompact(snapshot.revenueWithoutHpp)}) belum memiliki data HPP sehingga HPP-nya
            dicatat Rp 0 agar tidak terjadi distorsi estimasi.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm sm:text-base">
            Ikhtisar Laba Rugi & Arus Kas Operasional
          </h3>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Pendapatan Penjualan (Omzet)</p>
              <p className="text-[11px] text-slate-500">
                Dari {snapshot.totalTransactions.toLocaleString('id-ID')} transaksi penjualan unik
              </p>
            </div>
            <span className="font-bold">{rpFull(snapshot.totalRevenue)}</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Pemasukan Kas Lainnya</p>
              <p className="text-[11px] text-slate-500">Pemasukan non-penjualan tercatat</p>
            </div>
            <span className="font-bold">{rpFull(snapshot.otherIncome)}</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Harga Pokok Penjualan (HPP Aktual)</p>
              <p className="text-[11px] text-slate-500">
                Berdasarkan harga modal transaksi & katalog produk
              </p>
            </div>
            <span className="font-bold text-amber-600">
              - {rpFull(snapshot.totalActualHpp)}
            </span>
          </div>

          <div className="py-3.5 px-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between">
            <div>
              <p className="font-bold text-emerald-800 dark:text-emerald-200">
                Laba Kotor Aktual
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                Margin Kotor: {formatPercent(snapshot.grossMarginPercent)}
              </p>
            </div>
            <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm sm:text-base">
              {rpFull(snapshot.totalGrossProfitActual)}
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Pengeluaran Operasional & Kulakan</p>
              <p className="text-[11px] text-slate-500">Total kas keluar pada periode terpilih</p>
            </div>
            <span className="font-bold text-red-600">- {rpFull(snapshot.totalExpense)}</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Referensi Beban Gaji Bulanan</p>
              <p className="text-[11px] text-slate-500">
                Berdasarkan daftar karyawan terdaftar (tidak otomatis memotong kas harian)
              </p>
            </div>
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {rpFull(snapshot.monthlyPayroll)}
            </span>
          </div>

          <div className="py-3.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
            <div>
              <p className="font-bold">Arus Kas Operasional Bersih</p>
              <p className="text-[11px] text-slate-500">
                (Omzet + Pemasukan Lain) − (HPP Aktual + Pengeluaran Kas)
              </p>
            </div>
            <span
              className={`font-extrabold text-sm sm:text-base ${
                snapshot.netOperatingCashflow >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {rpFull(snapshot.netOperatingCashflow)}
            </span>
          </div>
        </div>
      </div>

      {snapshot.topProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-sm sm:text-base">
            Ringkasan Kontribusi Produk ({snapshot.topProducts.length} produk)
          </h3>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                <tr>
                  <th className="p-3">Produk</th>
                  <th className="p-3 text-right">Qty Terjual</th>
                  <th className="p-3 text-right">Omzet</th>
                  <th className="p-3 text-right">HPP Aktual</th>
                  <th className="p-3 text-right">Laba Kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {snapshot.topProducts.slice(0, 15).map((p) => (
                  <tr key={p.name}>
                    <td className="p-3 font-semibold">{p.name}</td>
                    <td className="p-3 text-right">{p.qtySold.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right font-semibold">{rpFull(p.revenue)}</td>
                    <td className="p-3 text-right text-slate-500">
                      {p.hasActualHpp ? rpFull(p.hpp) : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      {p.hasActualHpp ? rpFull(p.grossProfit) : '-'}
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