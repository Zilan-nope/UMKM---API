import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Info,
  Package,
  ShoppingBag,
  Upload,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { buildUnifiedBusinessSnapshot } from '../lib/analyticsEngine';
import { formatCompactRupiah, formatFullRupiah } from '../lib/formatters';

export function OverviewPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const currency = businessProfile.currency || 'IDR';
  const rpCompact = (n: number) => formatCompactRupiah(n, currency);
  const rpFull = (n: number) => formatFullRupiah(n, currency);

  const snapshot = useMemo(
    () => buildUnifiedBusinessSnapshot(savedDatasets),
    [savedDatasets]
  );

  if (savedDatasets.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
          <Upload className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold">
          Selamat Datang, {businessProfile.ownerName || 'Pemilik Usaha'}!
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Unggah file CSV, Excel (.XLS/.XLSX), atau JSON — sistem otomatis memvalidasi,
          menampilkan pratinjau, dan menghitung metrik usaha secara akurat.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
        >
          <Upload className="w-4 h-4" />
          <span>Impor Data Usaha Sekarang</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {snapshot.salesWithoutHppCount > 0 && (
        <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p>
            <strong>Catatan Akurasi HPP:</strong> Dari{' '}
            {snapshot.totalTransactions.toLocaleString('id-ID')} transaksi penjualan, terdapat{' '}
            <strong>{snapshot.salesWithoutHppCount.toLocaleString('id-ID')} transaksi</strong>{' '}
            (senilai {rpCompact(snapshot.revenueWithoutHpp)}) yang belum memiliki data Harga Modal.
            Sistem hanya menghitung laba kotor dari data HPP aktual tanpa asumsi margin palsu.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Total Omzet Aktual</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold" title={rpFull(snapshot.totalRevenue)}>
            {rpCompact(snapshot.totalRevenue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {snapshot.totalTransactions.toLocaleString('id-ID')} transaksi unik
            {snapshot.dateRange.start
              ? ` (${snapshot.dateRange.start} s.d. ${snapshot.dateRange.end})`
              : ''}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Laba Kotor Aktual</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <p
            className="text-xl sm:text-2xl font-extrabold text-emerald-600"
            title={rpFull(snapshot.totalGrossProfitActual)}
          >
            {rpCompact(snapshot.totalGrossProfitActual)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            HPP Aktual: {rpCompact(snapshot.totalActualHpp)} (Margin{' '}
            {snapshot.grossMarginPercent.toFixed(1)}%)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Katalog Produk & Stok</span>
            <Package className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold">
            {snapshot.totalProductSku.toLocaleString('id-ID')} SKU
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {snapshot.totalStockUnits.toLocaleString('id-ID')} unit • Nilai{' '}
            {rpCompact(snapshot.inventoryAssetValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Pengeluaran & Kas</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold" title={rpFull(snapshot.totalExpense)}>
            {rpCompact(snapshot.totalExpense)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Arus kas bersih: {rpCompact(snapshot.netOperatingCashflow)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>Produk Kontributor Terbesar</span>
            </h3>
            <button
              type="button"
              onClick={() => setActivePage('analitik')}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Lihat Grafik →
            </button>
          </div>

          {snapshot.topProducts.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {snapshot.topProducts.slice(0, 6).map((p, idx) => (
                <div
                  key={idx}
                  className="py-2.5 flex items-center justify-between text-xs sm:text-sm"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.qtySold.toLocaleString('id-ID')} terjual
                      {p.hasActualHpp ? ` • Laba ${rpCompact(p.grossProfit)}` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-600 whitespace-nowrap">
                    {rpCompact(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              Belum ada transaksi penjualan tercatat.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Peringatan Stok Menipis ({snapshot.lowStockItems.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setActivePage('database')}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Kelola Stok →
            </button>
          </div>

          {snapshot.lowStockItems.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {snapshot.lowStockItems.slice(0, 6).map((item, idx) => (
                <div
                  key={idx}
                  className="py-2.5 flex items-center justify-between text-xs sm:text-sm"
                >
                  <span className="font-semibold truncate pr-3">{item.name}</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-bold whitespace-nowrap">
                    Sisa {item.stock} (Min {item.minStock})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              Semua stok produk aman atau belum ada katalog stok.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}