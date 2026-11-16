import {
  AlertTriangle,
  DollarSign,
  Filter,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp, type StoredDataset } from '../context/AppContext';
import {
  calculateFinanceMetrics,
  calculateGenericMetrics,
  calculateInventoryMetrics,
  calculateSalesMetrics,
} from '../lib/analyticsEngine';
import type { DatasetCategory } from '../types/dataset';

const PIE_COLORS = ['#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48', '#0d9488'];

const CATEGORY_TITLES: Record<DatasetCategory, string> = {
  sales: 'Analitik Penjualan (Sales)',
  finance: 'Analitik Keuangan & Arus Kas (Finance)',
  inventory: 'Analitik Stok & Inventaris (Inventory)',
  customer: 'Analitik Pelanggan (Customer)',
  employee: 'Analitik Karyawan (Employee)',
  product: 'Analitik Produk (Product)',
  unknown: 'Analitik Dataset Umum',
};

export function AutoDashboardPage({ forcedCategory }: { forcedCategory?: DatasetCategory }) {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: businessProfile.currency,
      maximumFractionDigits: 0,
    }).format(val);

  const sortedDatasets = [...savedDatasets].sort((a, b) =>
    b.lastUpdatedAt.localeCompare(a.lastUpdatedAt)
  );

  const matchingDatasets = forcedCategory
    ? sortedDatasets.filter((d) => d.category === forcedCategory)
    : sortedDatasets;

  const activeDataset =
    matchingDatasets.find((d) => d.id === selectedId) ?? matchingDatasets[0] ?? null;

  if (!activeDataset) {
    return (
      <div className="max-w-2xl mx-auto mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">
          {forcedCategory
            ? `Belum Ada Data ${CATEGORY_TITLES[forcedCategory]}`
            : 'Belum Ada Dataset untuk Dibuatkan Dashboard'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Unggah file CSV atau Excel yang sesuai terlebih dahulu agar sistem dapat menyusun kartu KPI dan grafik secara otomatis dari data asli usahamu.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Unggah File Sekarang</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            {CATEGORY_TITLES[activeDataset.category]}
          </span>
          <h2 className="text-base sm:text-lg font-bold mt-0.5">
            Sumber: {activeDataset.fileName} ({activeDataset.rows.length} baris)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {matchingDatasets.length > 1 && (
            <select
              value={activeDataset.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold"
            >
              {matchingDatasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.fileName} ({ds.category})
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter produk/kategori..."
              className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {activeDataset.category === 'sales' && (
        <SalesDashboardSection
          dataset={activeDataset}
          formatMoney={formatMoney}
          searchTerm={searchTerm}
        />
      )}

      {activeDataset.category === 'finance' && (
        <FinanceDashboardSection dataset={activeDataset} formatMoney={formatMoney} />
      )}

      {activeDataset.category === 'inventory' && (
        <InventoryDashboardSection dataset={activeDataset} searchTerm={searchTerm} />
      )}

      {!['sales', 'finance', 'inventory'].includes(activeDataset.category) && (
        <GenericDashboardSection dataset={activeDataset} searchTerm={searchTerm} />
      )}
    </div>
  );
}

function SalesDashboardSection({
  dataset,
  formatMoney,
  searchTerm,
}: {
  dataset: StoredDataset;
  formatMoney: (n: number) => string;
  searchTerm: string;
}) {
  const m = calculateSalesMetrics(dataset);
  const filteredProducts = m.topProducts.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const coloredCategories = m.categoryBreakdown.map((item, idx) => ({
    ...item,
    fill: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between text-xs font-semibold uppercase text-slate-500">
            <span>Total Omzet Penjualan</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-2">{formatMoney(m.totalRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">{m.totalTransactions} transaksi tercatat</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between text-xs font-semibold uppercase text-slate-500">
            <span>Total Barang Terjual</span>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold mt-2">{m.totalUnits.toLocaleString('id-ID')} Unit</p>
          <p className="text-xs text-slate-500 mt-1">
            Rata-rata {formatMoney(m.averageOrderValue)} / transaksi
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between text-xs font-semibold uppercase text-slate-500">
            <span>Laba Kotor</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          {m.hasCostData ? (
            <>
              <p className="text-2xl font-bold mt-2">{formatMoney(m.totalGrossProfit)}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                Margin kotor {m.grossMarginPercent.toFixed(1)}%
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold mt-2 text-slate-400">Belum Tersedia</p>
              <p className="text-xs text-slate-500 mt-1">File tidak memiliki kolom Harga Modal</p>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between text-xs font-semibold uppercase text-slate-500">
            <span>Produk Unggulan</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base font-bold mt-2 truncate">
            {m.topProducts[0]?.name ?? 'Tidak ada kolom produk'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {m.topProducts[0] ? `${m.topProducts[0].qty} unit terjual` : '-'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {m.dailyTrend.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0">
            <h3 className="text-sm font-bold mb-1">Tren Penjualan Harian</h3>
            <p className="text-xs text-slate-500 mb-4">Akumulasi omzet berdasarkan tanggal transaksi</p>
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={m.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={65} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="omzet"
                  name="Omzet"
                  stroke="#059669"
                  fill="#10b981"
                  fillOpacity={0.25}
                />
                {m.hasCostData && (
                  <Area
                    type="monotone"
                    dataKey="laba"
                    name="Laba Kotor"
                    stroke="#0284c7"
                    fill="#38bdf8"
                    fillOpacity={0.2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0">
            <h3 className="text-sm font-bold mb-1">Peringkat Produk Berdasarkan Omzet</h3>
            <p className="text-xs text-slate-500 mb-4">Produk dengan kontribusi pendapatan tertinggi</p>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={filteredProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" name="Omzet" fill="#059669" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {coloredCategories.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0">
          <h3 className="text-sm font-bold mb-1">Proporsi Penjualan per Kategori</h3>
          <p className="text-xs text-slate-500 mb-4">Distribusi omzet berdasarkan kelompok produk</p>
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={coloredCategories}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {coloredCategories.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between text-xs sm:text-sm p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.fill }}
                    />
                    {cat.name}
                  </span>
                  <span className="font-bold">{formatMoney(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceDashboardSection({
  dataset,
  formatMoney,
}: {
  dataset: StoredDataset;
  formatMoney: (n: number) => string;
}) {
  const m = calculateFinanceMetrics(dataset);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Pemasukan</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatMoney(m.totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Pengeluaran</p>
          <p className="text-2xl font-bold text-rose-500 mt-2">{formatMoney(m.totalExpense)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Selisih Arus Kas Bersih</p>
          <p className="text-2xl font-bold mt-2">{formatMoney(m.netCashflow)}</p>
        </div>
      </div>

      {m.dailyCashflow.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0">
          <h3 className="text-sm font-bold mb-4">Arus Kas Masuk vs Keluar</h3>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={m.dailyCashflow}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={65} />
              <Tooltip />
              <Bar dataKey="masuk" name="Kas Masuk" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="keluar" name="Kas Keluar" fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function InventoryDashboardSection({
  dataset,
  searchTerm,
}: {
  dataset: StoredDataset;
  searchTerm: string;
}) {
  const m = calculateInventoryMetrics(dataset);
  const filteredChart = m.stockChart.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Jenis Barang</p>
          <p className="text-2xl font-bold mt-2">{m.totalItems} SKU</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Unit Tersedia</p>
          <p className="text-2xl font-bold mt-2">{m.totalStockUnits.toLocaleString('id-ID')} Unit</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Stok Perlu Restock</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">{m.lowStockItems.length} Barang</p>
        </div>
      </div>

      {m.lowStockItems.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Peringatan Barang Hampir Habis</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {m.lowStockItems.map((item) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 text-xs"
              >
                <p className="font-bold truncate">{item.name}</p>
                <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                  Sisa stok: <strong>{item.current}</strong> (Batas min: {item.min})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0">
        <h3 className="text-sm font-bold mb-4">Level Stok Barang Terendah</h3>
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={filteredChart} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="stok" name="Sisa Stok" fill="#d97706" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GenericDashboardSection({
  dataset,
  searchTerm,
}: {
  dataset: StoredDataset;
  searchTerm: string;
}) {
  const m = calculateGenericMetrics(dataset);
  const filtered = m.groupedChart.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Baris Data</p>
          <p className="text-2xl font-bold mt-2">{m.totalRecords}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Akumulasi ({m.numericLabel})</p>
          <p className="text-2xl font-bold mt-2">{m.totalNumericValue.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0">
        <h3 className="text-sm font-bold mb-4">Ringkasan Visual Otomatis</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" name={m.numericLabel} fill="#059669" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}