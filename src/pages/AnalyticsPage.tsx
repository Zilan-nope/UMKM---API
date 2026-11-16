import {
  AlertTriangle,
  PlusCircle,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { buildUnifiedBusinessSnapshot } from '../lib/analyticsEngine';
import { normalizeBusinessDate } from '../lib/dateUtils';
import {
  formatCompactAxis,
  formatCompactRupiah,
  formatFullRupiah,
} from '../lib/formatters';
import { toNumber } from '../lib/numberUtils';

const PIE_COLORS = ['#16a34a', '#0d9488', '#0284c7', '#d97706', '#65a30d', '#059669'];

interface IndexedRecord {
  datasetId: string;
  rowIndex: number;
  date: string;
  name: string;
  total: number;
  isAnomaly: boolean;
  anomalyReason: string;
}

export function AnalyticsPage() {
  const { savedDatasets, businessProfile, saveDataset, deleteDataset, setActivePage } = useApp();
  const currency = businessProfile.currency || 'IDR';
  const rpCompact = (n: number) => formatCompactRupiah(n, currency);
  const rpFull = (n: number) => formatFullRupiah(n, currency);

  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const snapshot = useMemo(
    () => buildUnifiedBusinessSnapshot(savedDatasets),
    [savedDatasets]
  );

  const recordsWithAnomaly = useMemo<IndexedRecord[]>(() => {
    const rawList: Omit<IndexedRecord, 'isAnomaly' | 'anomalyReason'>[] = [];
    for (const ds of savedDatasets) {
      if (ds.category !== 'sales') continue;
      ds.rows.forEach((r, idx) => {
        const name = String(r['Nama_Produk'] ?? r['Produk'] ?? '').trim();
        const isoDate = normalizeBusinessDate(r['Tanggal']);
        const total = toNumber(r['Total'] ?? r['Harga_Satuan'], 0);
        rawList.push({
          datasetId: ds.id,
          rowIndex: idx,
          date: isoDate,
          name: name || '(Tanpa Nama)',
          total,
        });
      });
    }
    if (rawList.length === 0) return [];

    const sortedVals = [...rawList].map((x) => x.total).sort((a, b) => a - b);
    const median = sortedVals[Math.floor(sortedVals.length / 2)] || 0;
    const outlierThreshold = median > 0 ? Math.max(median * 10, 50_000_000) : 100_000_000;

    return rawList.map((item) => {
      const reasons: string[] = [];
      if (item.total >= outlierThreshold || item.total <= 0) {
        reasons.push(item.total <= 0 ? 'Nominal Rp 0' : 'Nominal ekstrem');
      }
      if (!item.date) reasons.push('Tanggal tidak valid');
      if (item.name === '(Tanpa Nama)') reasons.push('Nama kosong');
      return {
        ...item,
        isAnomaly: reasons.length > 0,
        anomalyReason: reasons.join(', '),
      };
    });
  }, [savedDatasets]);

  const anomalyRecords = useMemo(
    () => recordsWithAnomaly.filter((r) => r.isAnomaly),
    [recordsWithAnomaly]
  );

  const visibleAuditRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? recordsWithAnomaly.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.date.toLowerCase().includes(q) ||
            r.anomalyReason.toLowerCase().includes(q)
        )
      : recordsWithAnomaly;

    return [...filtered].sort((a, b) => b.total - a.total).slice(0, 30);
  }, [recordsWithAnomaly, searchTerm]);

  const handleDeleteRecord = (datasetId: string, rowIndex: number) => {
    const target = savedDatasets.find((d) => d.id === datasetId);
    if (!target) return;
    const remaining = target.rows.filter((_, idx) => idx !== rowIndex);
    if (remaining.length === 0) deleteDataset(datasetId);
    else saveDataset({ ...target, rows: remaining, uploadedAt: new Date().toISOString() });
    setNotice('Baris data dihapus dan seluruh grafik diperbarui.');
    setTimeout(() => setNotice(null), 3500);
  };

  if (snapshot.totalTransactions === 0 && snapshot.dailyTrend.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
        <Sparkles className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Belum Ada Data Transaksi untuk Grafik</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
          Impor file penjualan atau kas di Database Usaha agar tren kronologis muncul otomatis.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Impor Data Sekarang</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-medium">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-500">Total Omzet (Tersinkronisasi)</span>
          <p className="text-xl font-extrabold mt-1" title={rpFull(snapshot.totalRevenue)}>
            {rpCompact(snapshot.totalRevenue)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-500">HPP Aktual</span>
          <p className="text-xl font-extrabold mt-1" title={rpFull(snapshot.totalActualHpp)}>
            {rpCompact(snapshot.totalActualHpp)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-500">Laba Kotor Aktual</span>
          <p
            className="text-xl font-extrabold text-emerald-600 mt-1"
            title={rpFull(snapshot.totalGrossProfitActual)}
          >
            {rpCompact(snapshot.totalGrossProfitActual)}
          </p>
        </div>
      </div>

      {anomalyRecords.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              Terdeteksi {anomalyRecords.length} Baris Anomali
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/80 mt-0.5">
              Periksa tabel audit di bawah untuk menghapus baris dengan nominal ekstrem atau tanggal kosong.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="font-bold text-sm sm:text-base mb-1">Tren Pemasukan & Pengeluaran</h3>
          <p className="text-xs text-slate-500 mb-4">Urutan tanggal terstandarisasi kronologis</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={snapshot.dailyTrend.slice(-30)}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gwRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatCompactAxis} tick={{ fontSize: 11 }} width={58} />
                <Tooltip formatter={(value) => rpFull(Number(value ?? 0))} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Pemasukan"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="url(#gwRevGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Pengeluaran"
                  stroke="#d97706"
                  strokeWidth={2}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="font-bold text-sm sm:text-base mb-1">Produk Kontributor Terbesar</h3>
          <p className="text-xs text-slate-500 mb-4">Perbandingan omzet per produk</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={snapshot.topProducts.slice(0, 6)}
                layout="vertical"
                margin={{ top: 5, right: 16, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCompactAxis} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => rpFull(Number(value ?? 0))} />
                <Bar dataKey="revenue" name="Omzet" fill="#16a34a" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {snapshot.categoryBreakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="font-bold text-sm sm:text-base mb-1">Proporsi Penjualan per Kategori</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={snapshot.categoryBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  label={({ name, value }) =>
                    `${String(name ?? '')}: ${rpCompact(Number(value ?? 0))}`
                  }
                >
                  {snapshot.categoryBreakdown.map((_, index) => (
                    <Cell key={`cell_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => rpFull(Number(val ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-sm sm:text-base">
            Audit Baris Penjualan ({recordsWithAnomaly.length.toLocaleString('id-ID')} baris)
          </h3>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari produk atau tanggal..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Produk</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center w-16">Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleAuditRows.map((rec) => (
                <tr
                  key={`${rec.datasetId}_${rec.rowIndex}`}
                  className={rec.isAnomaly ? 'bg-amber-50/70 dark:bg-amber-950/25' : ''}
                >
                  <td className="p-3 whitespace-nowrap text-slate-500">
                    {rec.date || '(Kosong)'}
                  </td>
                  <td className="p-3 font-semibold max-w-44 truncate">{rec.name}</td>
                  <td className="p-3">
                    {rec.isAnomaly ? (
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-semibold">
                        Anomali: {rec.anomalyReason}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Normal</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold whitespace-nowrap" title={rpFull(rec.total)}>
                    {rpCompact(rec.total)}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(rec.datasetId, rec.rowIndex)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}