import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Bot,
  Calendar,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  Package,
  Play,
  Receipt,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SalesTrendChartCard } from '../components/dashboard/SalesTrendChartCard';
import { useApp } from '../context/AppContext';
import { buildUnifiedBusinessSnapshot } from '../lib/analyticsEngine';
import { formatCompactRupiah, formatPercent } from '../lib/formatters';

const DEMO_PRODUCTS = [
  { name: 'Beras Pandan Wangi Super 5kg', category: 'Sembako', cost: 63000, price: 74000, stock: 42, minStock: 15 },
  { name: 'Beras Premium Setra Ramos 5kg', category: 'Sembako', cost: 58000, price: 68000, stock: 38, minStock: 15 },
  { name: 'Minyak Goreng Bimoli Pouch 2L', category: 'Sembako', cost: 31000, price: 36500, stock: 7, minStock: 20 },
  { name: 'Minyak Goreng Tropical Botol 2L', category: 'Sembako', cost: 32000, price: 38000, stock: 29, minStock: 15 },
  { name: 'Telur Ayam Negeri Curah 1kg', category: 'Sembako', cost: 24500, price: 29000, stock: 6, minStock: 15 },
  { name: 'Gula Pasir Putih Gulaku 1kg', category: 'Sembako', cost: 14500, price: 17500, stock: 54, minStock: 20 },
  { name: 'Mie Sedaap Goreng (1 Dus isi 40)', category: 'Makanan Instan', cost: 102000, price: 118000, stock: 19, minStock: 10 },
  { name: 'Indomie Goreng Spesial (5 Bungkus)', category: 'Makanan Instan', cost: 13000, price: 16000, stock: 65, minStock: 20 },
  { name: 'Gas LPG 3kg Subsidi (Refill)', category: 'Energi', cost: 18000, price: 22000, stock: 3, minStock: 10 },
  { name: 'Susu Ultra Milk Full Cream 1000ml', category: 'Minuman', cost: 16500, price: 20000, stock: 34, minStock: 12 },
  { name: 'Kopi Kapal Api Special 165g', category: 'Minuman', cost: 12500, price: 15500, stock: 48, minStock: 15 },
  { name: 'Teh Botol Sosro Kotak 250ml (Pack 6)', category: 'Minuman', cost: 17000, price: 21000, stock: 24, minStock: 10 },
  { name: 'Sabun Mandi Lifebuoy Cair 450ml', category: 'Kebutuhan Rumah', cost: 19000, price: 24000, stock: 5, minStock: 10 },
  { name: 'Deterjen Rinso Anti Noda 770g', category: 'Kebutuhan Rumah', cost: 18500, price: 23000, stock: 27, minStock: 10 },
  { name: 'Tepung Terigu Segitiga Biru 1kg', category: 'Sembako', cost: 11000, price: 13500, stock: 40, minStock: 15 },
];

function generateBulkSalesRows(rowCount: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = new Array(rowCount);
  const startUtc = Date.UTC(2026, 5, 1);
  const totalDays = 173;
  const methods = ['Tunai', 'QRIS', 'Transfer'];

  for (let i = 0; i < rowCount; i++) {
    const dayOffset = Math.floor((i / rowCount) * totalDays);
    const dt = new Date(startUtc + dayOffset * 86400000);
    const dateIso = dt.toISOString().slice(0, 10);
    const prod = DEMO_PRODUCTS[(i * 7 + (i % 13)) % DEMO_PRODUCTS.length];
    const qty = i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1;

    rows[i] = {
      No_Transaksi: `TRX-${String(i + 1).padStart(6, '0')}`,
      Tanggal: dateIso,
      Nama_Produk: prod.name,
      Kategori: prod.category,
      Qty: qty,
      Harga_Modal: prod.cost,
      Harga_Satuan: prod.price,
      Total: qty * prod.price,
      Metode_Bayar: methods[i % methods.length],
    };
  }
  return rows;
}

export function OverviewPage() {
  const {
    savedDatasets,
    businessProfile,
    setActivePage,
    upsertDataset,
    isLoadingDatasets,
  } = useApp();
  const currency = businessProfile.currency || 'IDR';
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  const snapshot = useMemo(
    () => buildUnifiedBusinessSnapshot(savedDatasets),
    [savedDatasets]
  );

  const handleLoad50kSimulation = async () => {
    if (isGeneratingDemo) return;
    setIsGeneratingDemo(true);
    try {
      await new Promise((r) => setTimeout(r, 20));
      const nowIso = new Date().toISOString();
      const salesRows = generateBulkSalesRows(50000);

      const productRows = DEMO_PRODUCTS.map((p, idx) => ({
        Kode_Produk: `PRD-${String(idx + 1).padStart(3, '0')}`,
        Nama_Produk: p.name,
        Kategori: p.category,
        Harga_Modal: p.cost,
        Harga_Jual: p.price,
        Stok: p.stock,
        Stok_Minimum: p.minStock,
      }));

      const expenseRows: Record<string, unknown>[] = [];
      const startUtc = Date.UTC(2026, 5, 1);
      for (let d = 0; d < 173; d++) {
        const dt = new Date(startUtc + d * 86400000);
        expenseRows.push({
          Tanggal: dt.toISOString().slice(0, 10),
          Jenis: 'Pengeluaran',
          Kategori: d % 7 === 0 ? 'Operasional Toko' : 'Kulakan Stok',
          Keterangan: d % 7 === 0 ? 'Listrik & operasional mingguan' : 'Kulakan barang dagangan',
          Nominal: d % 7 === 0 ? 1250000 : 3850000 + (d % 5) * 250000,
        });
      }

      await upsertDataset({
        id: 'sim_penjualan_50000',
        name: 'Simulasi_Penjualan_50000_Baris.csv',
        category: 'penjualan',
        rows: salesRows,
        createdAt: nowIso,
      });

      await upsertDataset({
        id: 'sim_katalog_produk',
        name: 'Simulasi_Katalog_Stok.csv',
        category: 'produk',
        rows: productRows,
        createdAt: nowIso,
      });

      await upsertDataset({
        id: 'sim_arus_kas',
        name: 'Simulasi_Pengeluaran_Kas.csv',
        category: 'keuangan',
        rows: expenseRows,
        createdAt: nowIso,
      });
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const rows = generateBulkSalesRows(50000);
    const headers = [
      'No_Transaksi',
      'Tanggal',
      'Nama_Produk',
      'Kategori',
      'Qty',
      'Harga_Modal',
      'Harga_Satuan',
      'Total',
      'Metode_Bayar',
    ];
    const lines = new Array(rows.length + 1);
    lines[0] = headers.join(',');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      lines[i + 1] = `${r.No_Transaksi},${r.Tanggal},"${r.Nama_Produk}",${r.Kategori},${r.Qty},${r.Harga_Modal},${r.Harga_Satuan},${r.Total},${r.Metode_Bayar}`;
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'uji_coba_umkm_50000_baris.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoadingDatasets) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">Memuat database lokal...</p>
      </div>
    );
  }

  if (savedDatasets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 p-6 sm:p-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dashboard Analitik & Pembukuan {businessProfile.name}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug">
              Kelola Ratusan Ribu Transaksi, Pantau Laba Aktual, & Tanya Asisten AI dalam Satu Layar.
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Belum ada data transaksi yang dimuat. Unggah file CSV/Excel Anda sendiri atau
              jalankan uji beban <strong>50.000 baris data</strong> dalam sekali klik.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActivePage('database')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Impor File Usaha (CSV / Excel)</span>
              </button>

              <button
                type="button"
                disabled={isGeneratingDemo}
                onClick={() => void handleLoad50kSimulation()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-bold disabled:opacity-50"
              >
                {isGeneratingDemo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                )}
                <span>
                  {isGeneratingDemo ? 'Memuat 50.000 Baris...' : 'Uji Coba 50.000 Baris'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-xs sm:text-sm font-semibold"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Unduh CSV 50.000 Baris</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm">1. Kapasitas Ratusan Ribu Baris</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Penyimpanan chunked IndexedDB membaca hanya 25 baris per halaman sehingga RAM tetap ringan.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
            <Calendar className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-sm">2. Kalender & Score Card Lengkap</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pantau margin laba, rata-rata nilai transaksi, kesehatan arus kas, dan tren harian–bulanan.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
            <Bot className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm">3. Asisten AI Berbasis Data Toko</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tempel API Key di menu Pengaturan untuk bertanya langsung seputar performa bisnis Anda.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stockSafePercent =
    snapshot.totalProductSku > 0
      ? Math.max(
          0,
          Math.round(
            ((snapshot.totalProductSku - snapshot.lowStockItems.length) /
              snapshot.totalProductSku) *
              100
          )
        )
      : 100;

  return (
    <div className="space-y-6">
      {/* 1. BARIS UTAMA: 4 KARTU SKOR FINANSIAL & STOK */}
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
            {snapshot.totalTransactions.toLocaleString('id-ID')} transaksi tercatat
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
            HPP: {formatCompactRupiah(snapshot.totalActualHpp, currency)} • Margin{' '}
            {formatPercent(snapshot.grossMarginPercent)}
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

      {/* 2. BARIS SCORE CARD KESEHATAN OPERASIONAL UMKM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              Rata-rata Nilai Struk
            </p>
            <p className="text-base font-extrabold mt-0.5">
              {formatCompactRupiah(snapshot.averageOrderValue, currency)}
            </p>
            <p className="text-[10px] text-slate-400">per 1 transaksi pembeli</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              Rata-rata Omzet Harian
            </p>
            <p className="text-base font-extrabold mt-0.5">
              {formatCompactRupiah(snapshot.averageDailyRevenue, currency)}
            </p>
            <p className="text-[10px] text-slate-400">
              dari {snapshot.activeDaysCount} hari aktif jualan
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              Skor Kesiapan Stok
            </p>
            <p className="text-base font-extrabold mt-0.5">{stockSafePercent}% Aman</p>
            <p className="text-[10px] text-slate-400">
              {snapshot.lowStockItems.length} item perlu kulakan
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              Status Arus Kas
            </p>
            <p
              className={`text-base font-extrabold mt-0.5 ${
                snapshot.netOperatingCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {snapshot.netOperatingCashflow >= 0 ? 'Surplus Positif' : 'Defisit Kas'}
            </p>
            <p className="text-[10px] text-slate-400">
              Pemasukan lain: {formatCompactRupiah(snapshot.otherIncome, currency)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. GRAFIK TREN PENJUALAN & PENGATUR KALENDER */}
      <SalesTrendChartCard savedDatasets={savedDatasets} currency={currency} />

      {/* 4. SCOREBOARD KATEGORI PRODUK & METODE PEMBAYARAN */}
      {(snapshot.categoryBreakdown.length > 0 || snapshot.paymentBreakdown.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {snapshot.categoryBreakdown.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm">Kontribusi per Kategori Produk</h3>
              </div>
              <div className="space-y-3">
                {snapshot.categoryBreakdown.slice(0, 5).map((cat) => (
                  <div key={cat.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{cat.label}</span>
                      <span className="font-bold text-emerald-600">
                        {formatCompactRupiah(cat.revenue, currency)} (
                        {formatPercent(cat.sharePercent)})
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.round(cat.sharePercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {snapshot.paymentBreakdown.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm">Komposisi Metode Pembayaran</h3>
              </div>
              <div className="space-y-3">
                {snapshot.paymentBreakdown.slice(0, 5).map((pay) => (
                  <div key={pay.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        {pay.label} ({pay.count.toLocaleString('id-ID')} trx)
                      </span>
                      <span className="font-bold text-sky-600">
                        {formatCompactRupiah(pay.revenue, currency)} (
                        {formatPercent(pay.sharePercent)})
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.round(pay.sharePercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. PRODUK TERLARIS & PERINGATAN STOK MENIPIS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Produk Kontributor Terbesar</h3>
            <button
              type="button"
              onClick={() => setActivePage('analitik')}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
            >
              <span>Buka Kalender</span>
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

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
        <div className="inline-flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <span>
            Terhubung ke <strong>{savedDatasets.length} dataset</strong> lokal (RAM hemat dengan paginasi 25 baris/halaman)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="font-bold text-emerald-600 hover:underline"
        >
          Buka Data & Import →
        </button>
      </div>
    </div>
  );
}