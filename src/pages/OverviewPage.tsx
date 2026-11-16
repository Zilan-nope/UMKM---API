import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Calendar,
  Database,
  FileSpreadsheet,
  Package,
  PlusCircle,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  calculateFinanceMetrics,
  calculateGenericMetrics,
  calculateInventoryMetrics,
  calculateSalesMetrics,
} from '../lib/analyticsEngine';
import { formatCompactRupiah, formatFullRupiah } from '../lib/formatters';

export function OverviewPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const currency = businessProfile.currency || 'IDR';

  const rpCompact = (amount: number) => formatCompactRupiah(amount, currency);
  const rpFull = (amount: number) => formatFullRupiah(amount, currency);

  const salesDs = savedDatasets.find((d) => d.category === 'sales' && d.rows.length > 0);
  const buyDs = savedDatasets.find((d) => d.category === 'finance' && d.rows.length > 0);
  const invDs = savedDatasets.find((d) => d.category === 'inventory' && d.rows.length > 0);
  const empDs = savedDatasets.find((d) => d.category === 'employee' && d.rows.length > 0);

  const salesM = salesDs ? calculateSalesMetrics(salesDs) : null;
  const buyM = buyDs ? calculateFinanceMetrics(buyDs) : null;
  const invM = invDs ? calculateInventoryMetrics(invDs) : null;
  const empM = empDs ? calculateGenericMetrics(empDs) : null;

  const totalOmzet = salesM?.totalRevenue ?? 0;
  const totalPembelian = buyM ? (buyM.totalExpense > 0 ? buyM.totalExpense : buyM.totalIncome) : 0;
  const labaKotor = salesM?.hasCostData ? salesM.totalGrossProfit : totalOmzet - totalPembelian;
  const selisihKas = totalOmzet - totalPembelian;

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const hasAnyData = Boolean(salesDs || buyDs || invDs || empDs);

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <Store className="w-3.5 h-3.5" />
            <span>{businessProfile.city}</span>
            <span className="opacity-50">•</span>
            <Calendar className="w-3.5 h-3.5" />
            <span>{todayFormatted}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight pt-1">
            {businessProfile.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Halo {businessProfile.ownerName}, berikut ringkasan performa & kesehatan usahamu hari ini.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActivePage('database')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Catat Transaksi</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('asisten-ai')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm font-semibold transition-colors"
          >
            <Bot className="w-4 h-4" />
            <span>Tanya AI</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Metrik Utama (Satuan Jt / M agar tidak pernah meluber) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kartu 1: Omzet Penjualan */}
        <div
          title={rpFull(totalOmzet)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Omzet Penjualan
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {rpCompact(totalOmzet)}
            </p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{rpFull(totalOmzet)}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1 truncate">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {salesM
                  ? `${salesM.totalTransactions.toLocaleString('id-ID')} transaksi`
                  : 'Belum ada transaksi'}
              </span>
            </p>
          </div>
        </div>

        {/* Kartu 2: Laba Kotor / Selisih Kas */}
        <div
          title={rpFull(salesM?.hasCostData ? labaKotor : selisihKas)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {salesM?.hasCostData ? 'Laba Kotor Produk' : 'Selisih Kas Bersih'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {rpCompact(salesM?.hasCostData ? labaKotor : selisihKas)}
            </p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {rpFull(salesM?.hasCostData ? labaKotor : selisihKas)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              {salesM?.hasCostData
                ? `Margin ${salesM.grossMarginPercent.toFixed(1)}%`
                : 'Omzet dikurangi belanja'}
            </p>
          </div>
        </div>

        {/* Kartu 3: Pembelian & Pengeluaran */}
        <div
          title={rpFull(totalPembelian)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Belanja & Pengeluaran
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {rpCompact(totalPembelian)}
            </p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{rpFull(totalPembelian)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              {buyDs ? `${buyDs.rows.length} catatan pengeluaran` : 'Belum ada catatan kulakan'}
            </p>
          </div>
        </div>

        {/* Kartu 4: Stok Produk & Tim */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Stok Produk & Tim
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {invM ? `${invM.totalItems} Produk` : '0 Produk'}
            </p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {invM ? `${invM.totalStockUnits.toLocaleString('id-ID')} unit tersedia` : 'Gudang kosong'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{empM?.totalRecords ?? 0} karyawan aktif</span>
            </p>
          </div>
        </div>
      </div>

      {/* Konten Utama 2 Kolom */}
      {hasAnyData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Kolom Kiri (2/3): Produk Paling Laris */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-base">Produk Paling Laris</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kontributor omzet tertinggi berdasarkan catatan penjualan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('analisis')}
                className="text-xs font-semibold text-emerald-600 hover:underline"
              >
                Kelola Grafik & Data →
              </button>
            </div>

            {salesM && salesM.topProducts.length > 0 ? (
              <div className="space-y-3">
                {salesM.topProducts.slice(0, 5).map((item, idx) => {
                  const maxRev = salesM.topProducts[0]?.revenue || 1;
                  const widthPct = Math.max(10, Math.round((item.revenue / maxRev) * 100));
                  return (
                    <div
                      key={`${item.name}_${idx}`}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70"
                    >
                      <div className="flex items-center justify-between text-xs sm:text-sm font-semibold gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{item.name}</span>
                        </div>
                        <div className="text-right shrink-0" title={rpFull(item.revenue)}>
                          <span>{rpCompact(item.revenue)}</span>
                          <span className="text-[11px] text-slate-400 ml-1.5">
                            ({item.qty.toLocaleString('id-ID')} unit)
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2.5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs sm:text-sm text-slate-400">
                Belum ada transaksi penjualan tercatat. Klik <strong>Catat Transaksi</strong> untuk mulai mengisi.
              </div>
            )}
          </div>

          {/* Kolom Kanan (1/3): Pantauan Stok Menipis & Menu Cepat */}
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="font-bold text-sm sm:text-base">Pantauan Stok Menipis</h2>
              </div>

              {invM && invM.lowStockItems.length > 0 ? (
                <div className="space-y-2.5">
                  {invM.lowStockItems.slice(0, 5).map((item, idx) => (
                    <div
                      key={`${item.name}_${idx}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/40 text-xs"
                    >
                      <span className="font-semibold truncate pr-2">
                        {item.name && item.name !== '0' ? item.name : '(Produk Tanpa Nama)'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold shrink-0">
                        Sisa {item.current}
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActivePage('database')}
                    className="w-full mt-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                  >
                    Kelola Stok Produk
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
                  {invM
                    ? 'Semua stok produk dalam batas aman.'
                    : 'Daftar produk belum diisi di Database Usaha.'}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5">
              <h3 className="font-bold text-sm">Menu Cepat</h3>
              <button
                type="button"
                onClick={() => setActivePage('database')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:border-emerald-500 border border-transparent text-xs font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Kelola File & Database</span>
                </span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePage('laporan')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:border-emerald-500 border border-transparent text-xs font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Laporan Excel / PDF</span>
                </span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Database className="w-6 h-6" />
          </div>
          <h2 className="text-base sm:text-lg font-bold">Mulai Catat Data Usahamu</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1.5">
            Tambahkan data produk, penjualan harian, atau pengeluaran di Database Usaha agar seluruh kartu metrik dan grafik di dashboard terisi otomatis.
          </p>
          <button
            type="button"
            onClick={() => setActivePage('database')}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buka Database Usaha</span>
          </button>
        </div>
      )}
    </div>
  );
}