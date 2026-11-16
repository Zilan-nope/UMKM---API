import {
  AlertTriangle,
  Plus,
  PlusCircle,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
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
import { useApp, type StoredDataset } from '../context/AppContext';
import { calculateSalesMetrics } from '../lib/analyticsEngine';
import {
  formatCompactAxis,
  formatCompactRupiah,
  formatFullRupiah,
} from '../lib/formatters';
import { parseNumericValue, profileColumns } from '../lib/fileParser';

const PIE_COLORS = ['#16a34a', '#0d9488', '#0284c7', '#d97706', '#65a30d', '#059669'];

interface IndexedRecord {
  datasetId: string;
  rowIndex: number;
  date: string;
  name: string;
  category: string;
  qty: number;
  total: number;
  isAnomaly: boolean;
  anomalyReason: string;
}

export function AnalyticsPage() {
  const appContext = useApp();
  const { savedDatasets, saveDatasets, businessProfile, deleteDataset, setActivePage } = appContext;
  const currency = businessProfile.currency || 'IDR';

  const rpCompact = (n: number) => formatCompactRupiah(n, currency);
  const rpFull = (n: number) => formatFullRupiah(n, currency);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'largest' | 'newest'>('largest');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newTotal, setNewTotal] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const salesDatasets = useMemo(
    () => savedDatasets.filter((d) => d.category === 'sales' && d.rows.length > 0),
    [savedDatasets]
  );

  const recordsWithAnomaly = useMemo<IndexedRecord[]>(() => {
    const rawList: Omit<IndexedRecord, 'isAnomaly' | 'anomalyReason'>[] = [];

    for (const ds of salesDatasets) {
      ds.rows.forEach((r, idx) => {
        const name = String(r['Nama_Produk'] ?? r['Produk'] ?? '').trim();
        const date = String(r['Tanggal'] ?? '').trim();
        const category = String(r['Kategori'] ?? 'Umum').trim() || 'Umum';
        const qty = parseNumericValue(r['Qty']) ?? 1;
        const total = parseNumericValue(r['Total'] ?? r['Harga_Satuan']) ?? 0;

        rawList.push({
          datasetId: ds.id,
          rowIndex: idx,
          date,
          name: name || '(Tanpa Nama)',
          category,
          qty,
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
      if (!item.date || item.date.toLowerCase().includes('tidak')) {
        reasons.push('Tanggal kosong');
      }
      if (item.name === '(Tanpa Nama)' || item.name === '0') {
        reasons.push('Nama tidak valid');
      }

      return {
        ...item,
        isAnomaly: reasons.length > 0,
        anomalyReason: reasons.join(', '),
      };
    });
  }, [salesDatasets]);

  const anomalyRecords = useMemo(
    () => recordsWithAnomaly.filter((r) => r.isAnomaly),
    [recordsWithAnomaly]
  );

  const mergedSalesDataset = useMemo<StoredDataset | null>(() => {
    if (salesDatasets.length === 0) return null;
    return {
      ...salesDatasets[0],
      rows: salesDatasets.flatMap((d) => d.rows),
    };
  }, [salesDatasets]);

  const salesMetrics = useMemo(
    () => (mergedSalesDataset ? calculateSalesMetrics(mergedSalesDataset) : null),
    [mergedSalesDataset]
  );

  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    for (const rec of recordsWithAnomaly) {
      const label = rec.date || 'Tanpa Tanggal';
      map.set(label, (map.get(label) ?? 0) + rec.total);
    }
    return Array.from(map.entries())
      .map(([tanggal, omzet]) => ({ tanggal, omzet }))
      .slice(-15);
  }, [recordsWithAnomaly]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const rec of recordsWithAnomaly) {
      map.set(rec.category, (map.get(rec.category) ?? 0) + rec.total);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [recordsWithAnomaly]);

  const visibleTableRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? recordsWithAnomaly.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.date.toLowerCase().includes(q) ||
            r.anomalyReason.toLowerCase().includes(q)
        )
      : recordsWithAnomaly;

    const sorted = [...filtered];
    if (sortBy === 'largest') {
      sorted.sort((a, b) => b.total - a.total);
    }
    return sorted.slice(0, 30);
  }, [recordsWithAnomaly, searchTerm, sortBy]);

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleDeleteRecord = (datasetId: string, rowIndex: number) => {
    const target = savedDatasets.find((d) => d.id === datasetId);
    if (!target) return;
    const remaining = target.rows.filter((_, idx) => idx !== rowIndex);

    if (remaining.length === 0) {
      deleteDataset(datasetId);
    } else {
      const updated: StoredDataset = {
        ...target,
        rows: remaining,
        lastUpdatedAt: new Date().toISOString(),
      };
      const nextList = savedDatasets.map((d) => (d.id === datasetId ? updated : d));
      saveDatasets(nextList);
    }
    notify('Data berhasil dihapus dan grafik diperbarui.');
  };

  const handleCleanAllAnomalies = () => {
    if (anomalyRecords.length === 0) return;
    if (
      !window.confirm(
        `Hapus ${anomalyRecords.length} data anomali yang terdeteksi agar grafik kembali akurat?`
      )
    ) {
      return;
    }

    const byDataset = new Map<string, Set<number>>();
    anomalyRecords.forEach((rec) => {
      if (!byDataset.has(rec.datasetId)) byDataset.set(rec.datasetId, new Set());
      byDataset.get(rec.datasetId)!.add(rec.rowIndex);
    });

    let workingList = [...savedDatasets];
    byDataset.forEach((idxSet, dsId) => {
      const ds = workingList.find((d) => d.id === dsId);
      if (!ds) return;
      const cleanRows = ds.rows.filter((_, i) => !idxSet.has(i));
      if (cleanRows.length === 0) {
        workingList = workingList.filter((d) => d.id !== dsId);
      } else {
        const updated: StoredDataset = {
          ...ds,
          rows: cleanRows,
          lastUpdatedAt: new Date().toISOString(),
        };
        workingList = workingList.map((d) => (d.id === dsId ? updated : d));
      }
    });
    saveDatasets(workingList);

    notify(`${anomalyRecords.length} data anomali berhasil dibersihkan!`);
  };

  const handleQuickAddRecord = (e: FormEvent) => {
    e.preventDefault();
    const totalVal = Math.max(0, Number(newTotal) || 0);
    const qtyVal = Math.max(1, Number(newQty) || 1);
    if (!newName.trim() || totalVal <= 0) return;

    const newRow = {
      Tanggal: newDate,
      Nama_Produk: newName.trim(),
      Kategori: 'Umum',
      Qty: qtyVal,
      Harga_Satuan: Math.round(totalVal / qtyVal),
      Total: totalVal,
    };

    const existing = salesDatasets[0];
    if (existing) {
      const updated: StoredDataset = {
        ...existing,
        rows: [newRow, ...existing.rows],
        lastUpdatedAt: new Date().toISOString(),
      };
      const nextList = savedDatasets.map((d) => (d.id === existing.id ? updated : d));
      saveDatasets(nextList);
    } else {
      const created: StoredDataset = {
        id: `ds_sales_${Date.now()}`,
        fileName: 'Catatan Penjualan',
        category: 'sales',
        columns: profileColumns(Object.keys(newRow), [newRow]),
        rows: [newRow],
        lastUpdatedAt: new Date().toISOString(),
      };
      saveDatasets([created, ...savedDatasets]);
    }

    setNewName('');
    setNewQty('1');
    setNewTotal('');
    notify('Data baru ditambahkan ke grafik.');
  };

  if (recordsWithAnomaly.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
        <Sparkles className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Belum Ada Data Penjualan untuk Grafik</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
          Tambahkan transaksi penjualan di Database Usaha agar grafik tren dan produk terlaris muncul otomatis.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Isi Data Penjualan</span>
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

      {anomalyRecords.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                Terdeteksi {anomalyRecords.length} Data Anomali yang Memengaruhi Grafik
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                Terdapat baris dengan nominal ekstrem (seperti{' '}
                <strong>{rpCompact(anomalyRecords[0].total)}</strong>) atau tanggal kosong yang membuat analisa melenceng.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCleanAllAnomalies}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan Semua Anomali ({anomalyRecords.length})</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="font-bold text-sm sm:text-base mb-1">Tren Omzet Harian</h3>
          <p className="text-xs text-slate-500 mb-4">Pergerakan pemasukan berdasarkan tanggal</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gwAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatCompactAxis} tick={{ fontSize: 11 }} width={58} />
                <Tooltip
                  formatter={(value: unknown) => [rpFull(Number(value ?? 0)), 'Omzet']}
                />
                <Area
                  type="monotone"
                  dataKey="omzet"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="url(#gwAreaGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="font-bold text-sm sm:text-base mb-1">Produk Kontributor Terbesar</h3>
          <p className="text-xs text-slate-500 mb-4">Perbandingan omzet per nama produk</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(salesMetrics?.topProducts ?? []).slice(0, 6)}
                layout="vertical"
                margin={{ top: 5, right: 16, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCompactAxis} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={95}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: unknown) => [rpFull(Number(value ?? 0)), 'Omzet']}
                />
                <Bar dataKey="revenue" fill="#16a34a" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <h3 className="font-bold text-sm sm:text-base mb-1">Proporsi Penjualan per Kategori</h3>
        <p className="text-xs text-slate-500 mb-3">Distribusi total pendapatan usaha</p>
        <div className="h-60 flex flex-col sm:flex-row items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={82}
                label={({ name, value }) => `${name}: ${rpCompact(Number(value ?? 0))}`}
              >
                {categoryData.map((_, index) => (
                  <Cell key={`cell_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val: unknown) => rpFull(Number(val ?? 0))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base">
              Kelola & Audit Data Grafik ({recordsWithAnomaly.length.toLocaleString('id-ID')} baris)
            </h3>
            <p className="text-xs text-slate-500">
              Cek data sumber grafik, tambahkan data yang kurang, atau hapus baris anomali yang merusak analisa.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'largest' | 'newest')}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="largest">Urutkan: Nominal Terbesar (Cek Anomali)</option>
              <option value="newest">Urutkan: Input Terbaru</option>
            </select>
          </div>
        </div>

        <form
          onSubmit={handleQuickAddRecord}
          className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
        >
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            required
          />
          <input
            type="text"
            placeholder="Nama produk..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            required
          />
          <input
            type="number"
            min="1"
            placeholder="Qty"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
          />
          <input
            type="number"
            min="1"
            placeholder="Total Omzet (Rp)"
            value={newTotal}
            onChange={(e) => setNewTotal(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            required
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah ke Grafik</span>
          </button>
        </form>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter nama produk atau tanggal di tabel grafik..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />
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
              {visibleTableRecords.map((rec) => (
                <tr
                  key={`${rec.datasetId}_${rec.rowIndex}`}
                  className={
                    rec.isAnomaly
                      ? 'bg-amber-50/70 dark:bg-amber-950/25'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }
                >
                  <td className="p-3 whitespace-nowrap text-slate-500">
                    {rec.date || '(Kosong)'}
                  </td>
                  <td className="p-3 font-semibold max-w-44 truncate">{rec.name}</td>
                  <td className="p-3">
                    {rec.isAnomaly ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-semibold">
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
                      title="Hapus data ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recordsWithAnomaly.length > 30 && (
          <p className="text-[11px] text-slate-400">
            Menampilkan 30 data teratas. Gunakan kotak pencarian di atas untuk menemukan baris spesifik.
          </p>
        )}
      </div>
    </div>
  );
}