import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Package,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { SalesTrendChartCard } from '../components/dashboard/SalesTrendChartCard';
import { useApp } from '../context/AppContext';
import { buildUnifiedBusinessSnapshot } from '../lib/analyticsEngine';
import { formatCompactRupiah, formatPercent } from '../lib/formatters';

export function OverviewPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const currency = businessProfile.currency || 'IDR';

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
        <h2 className="text-lg font-extrabold">Selamat Datang, Pemilik Usaha!</h2>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          Unggah file CSV, Excel (.XLS/.XLSX), atau JSON — sistem otomatis memvalidasi,
          menampilkan grafik tren, dan menghitung metrik usaha secara akurat.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
        >
          <Upload className="w-4 h-4" />
          <span>Impor Data Usaha Sekarang</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 Kartu KPI Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Omzet Aktual</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold tracking-tight">
            {formatCompactRupiah(snapshot.totalRevenue, currency)}
          </p>
          <p className="text-[11px] text-slate-400">
            {snapshot.totalTransactions.toLocaleString('id-ID')} transaksi unik
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Laba Kotor Aktual</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">
            {formatCompactRupiah(snapshot.totalGrossProfitActual, currency)}
          </p>
          <p className="text-[11px] text-slate-400">
            HPP: {formatCompactRupiah(snapshot.totalActualHpp, currency)} (Margin{' '}
            {formatPercent(snapshot.grossMarginPercent)})
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Katalog Produk & Stok</span>
            <Package className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-extrabold tracking-tight">
            {snapshot.totalProductSku.toLocaleString('id-ID')} SKU
          </p>
          <p className="text-[11px] text-slate-400">
            {snapshot.totalStockUnits.toLocaleString('id-ID')} unit • Nilai{' '}
            {formatCompactRupiah(snapshot.inventoryAssetValue, currency)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pengeluaran & Kas</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold tracking-tight">
            {formatCompactRupiah(snapshot.totalExpense, currency)}
          </p>
          <p className="text-[11px] text-slate-400">
            Arus kas bersih:{' '}
            {formatCompactRupiah(snapshot.netOperatingCashflow, currency)}
          </p>
        </div>
      </div>

      {/* Grafik Tren Penjualan Interaktif + Pengatur Kalender */}
      <SalesTrendChartCard savedDatasets={savedDatasets} currency={currency} />

      {/* Produk Terlaris & Peringatan Stok Menipis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Produk Kontributor Terbesar</h3>
            <button
              type="button"
              onClick={() => setActivePage('analitik')}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
            >
              <span>Lihat Kalender</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {snapshot.topProducts.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Belum ada data penjualan produk.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot.topProducts.slice(0, 6).map((p) => (
                <div
                  key={p.name}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.qtySold.toLocaleString('id-ID')} terjual • Laba{' '}
                      {formatCompactRupiah(p.grossProfit, currency)}
                    </p>
                  </div>
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-600 shrink-0">
                    {formatCompactRupiah(p.revenue, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-sm">
                Peringatan Stok Menipis ({snapshot.lowStockItems.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('database')}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
            >
              <span>Kelola Stok</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {snapshot.lowStockItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Semua stok barang aman di atas batas minimum.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot.lowStockItems.slice(0, 6).map((item) => (
                <div
                  key={item.name}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <span className="text-xs sm:text-sm font-bold truncate">
                    {item.name}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] font-bold shrink-0">
                    Sisa {item.stock} (Min {item.minStock})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}