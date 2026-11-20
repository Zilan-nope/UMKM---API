import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import Papa from 'papaparse';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import {
  appendSingleRowToCategory,
  queryCategoryPageRows,
  type DatasetCategory,
  type DatasetRow,
} from '../lib/datasetStorage';

const MAX_UPLOAD_ROWS = 500000;
const PAGE_SIZE = 25;

const CATEGORY_TABS: { id: DatasetCategory; label: string }[] = [
  { id: 'produk', label: 'Produk & Stok' },
  { id: 'penjualan', label: 'Penjualan' },
  { id: 'keuangan', label: 'Pembelian & Kas' },
  { id: 'karyawan', label: 'Karyawan' },
];

function detectCategoryFromHeaders(headers: string[]): DatasetCategory {
  const joined = headers.join(' ').toLowerCase();
  if (joined.includes('gaji') || joined.includes('jabatan') || joined.includes('karyawan')) {
    return 'karyawan';
  }
  if (
    joined.includes('stok_minimum') ||
    (joined.includes('stok') && !joined.includes('qty') && !joined.includes('tanggal'))
  ) {
    return 'produk';
  }
  if (
    joined.includes('nominal') ||
    joined.includes('keperluan') ||
    joined.includes('supplier')
  ) {
    return 'keuangan';
  }
  return 'penjualan';
}

export function DatabasePage() {
  const { savedDatasets, upsertDataset, removeDataset } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State staging sebelum disimpan ke IndexedDB
  const [stagedFileName, setStagedFileName] = useState<string>('');
  const [stagedCategory, setStagedCategory] = useState<DatasetCategory>('penjualan');
  const [stagedRows, setStagedRows] = useState<DatasetRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // State tab & paginasi hemat RAM (hanya memuat 25 baris per halaman dari IndexedDB)
  const [activeTab, setActiveTab] = useState<DatasetCategory>('penjualan');
  const [page, setPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pageRows, setPageRows] = useState<DatasetRow[]>([]);
  const [totalMatchedRows, setTotalMatchedRows] = useState<number>(0);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // State form tambah manual cepat
  const [showManualForm, setShowManualForm] = useState(false);
  const [mDate, setMDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mName, setMName] = useState('');
  const [mQty, setMQty] = useState('1');
  const [mPrice, setMPrice] = useState('');
  const [mCost, setMCost] = useState('');
  const [mType, setMType] = useState<'Pengeluaran' | 'Pemasukan'>('Pengeluaran');

  const categoryCounts = useMemo(() => {
    const counts: Record<DatasetCategory, number> = {
      produk: 0,
      penjualan: 0,
      keuangan: 0,
      karyawan: 0,
      lainnya: 0,
    };
    for (const ds of savedDatasets) {
      const cat = (ds.category || 'penjualan') as DatasetCategory;
      counts[cat] = (counts[cat] || 0) + (ds.rowCount || ds.rows.length);
    }
    return counts;
  }, [savedDatasets]);

  // Ambil HANYA 25 baris halaman aktif dari IndexedDB
  useEffect(() => {
    let active = true;
    setIsLoadingPage(true);
    queryCategoryPageRows({
      category: activeTab,
      page,
      pageSize: PAGE_SIZE,
      searchQuery,
    })
      .then((res) => {
        if (!active) return;
        setPageRows(res.rows);
        setTotalMatchedRows(res.totalMatched);
      })
      .catch(() => {
        if (!active) return;
        setPageRows([]);
        setTotalMatchedRows(0);
      })
      .finally(() => {
        if (active) setIsLoadingPage(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, page, searchQuery, savedDatasets, refreshTrigger]);

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setStatusBanner(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let parsedRows: DatasetRow[] = [];

      if (ext === 'csv') {
        parsedRows = await new Promise<DatasetRow[]>((resolve, reject) => {
          Papa.parse<DatasetRow>(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => resolve(results.data || []),
            error: (err) => reject(err),
          });
        });
      } else if (ext === 'json') {
        const text = await file.text();
        const json = JSON.parse(text) as unknown;
        parsedRows = Array.isArray(json) ? (json as DatasetRow[]) : [];
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        parsedRows = XLSX.utils.sheet_to_json<DatasetRow>(firstSheet, { defval: '' });
      }

      // Filter baris kosong atau baris rekap TOTAL
      const validRows: DatasetRow[] = [];
      const limit = Math.min(parsedRows.length, MAX_UPLOAD_ROWS);
      for (let i = 0; i < limit; i++) {
        const row = parsedRows[i];
        const values = Object.values(row);
        if (values.every((v) => v === '' || v === null || v === undefined)) continue;
        const firstStr = String(values[0] ?? '').trim().toUpperCase();
        if (firstStr === 'TOTAL' || firstStr === 'GRAND TOTAL') continue;
        validRows.push(row);
      }

      const headers = validRows.length > 0 ? Object.keys(validRows[0]) : [];
      const detected = detectCategoryFromHeaders(headers);

      setStagedFileName(file.name);
      setStagedCategory(detected);
      setStagedRows(validRows);
    } catch (err) {
      setStatusBanner(
        err instanceof Error ? `Gagal membaca file: ${err.message}` : 'Gagal membaca file.'
      );
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleConfirmSaveStaged = async () => {
    if (stagedRows.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveProgress(0);
    setStatusBanner(null);

    try {
      const id = `ds_${stagedCategory}_${Date.now()}`;
      await upsertDataset(
        {
          id,
          name: stagedFileName || `Import_${stagedCategory}.csv`,
          category: stagedCategory,
          rows: stagedRows,
          createdAt: new Date().toISOString(),
        },
        (pct) => setSaveProgress(pct)
      );

      const savedCount = stagedRows.length;
      const savedCat = stagedCategory;
      // Kosongkan array staging dari RAM segera setelah tersimpan ke IndexedDB
      setStagedRows([]);
      setStagedFileName('');
      setActiveTab(savedCat);
      setPage(1);
      setRefreshTrigger((v) => v + 1);
      setStatusBanner(
        `Berhasil menyimpan ${savedCount.toLocaleString('id-ID')} baris data ke database lokal!`
      );
    } catch (err) {
      setStatusBanner(
        err instanceof Error ? `Gagal menyimpan: ${err.message}` : 'Gagal menyimpan data.'
      );
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
    }
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mName.trim()) return;

    let newRow: DatasetRow = {};
    if (activeTab === 'penjualan') {
      const qty = Math.max(1, Number(mQty) || 1);
      const price = Number(mPrice) || 0;
      const cost = Number(mCost) || 0;
      newRow = {
        Tanggal: mDate,
        Nama_Produk: mName.trim(),
        Kategori: 'Manual',
        Qty: qty,
        Harga_Satuan: price,
        Harga_Modal: cost,
        Total: qty * price,
      };
    } else if (activeTab === 'produk') {
      newRow = {
        Nama_Produk: mName.trim(),
        Kategori: 'Umum',
        Stok: Number(mQty) || 0,
        Stok_Minimum: 5,
        Harga_Modal: Number(mCost) || 0,
        Harga_Jual: Number(mPrice) || 0,
      };
    } else if (activeTab === 'keuangan') {
      newRow = {
        Tanggal: mDate,
        Keterangan: mName.trim(),
        Jenis: mType,
        Nominal: Number(mPrice) || 0,
      };
    } else {
      newRow = {
        Nama_Karyawan: mName.trim(),
        Jabatan: 'Staf',
        Gaji: Number(mPrice) || 0,
      };
    }

    await appendSingleRowToCategory(activeTab, newRow);
    setMName('');
    setMPrice('');
    setMCost('');
    setShowManualForm(false);
    setPage(1);
    setRefreshTrigger((v) => v + 1);
  };

  const totalPages = Math.max(1, Math.ceil(totalMatchedRows / PAGE_SIZE));
  const tableColumns = pageRows.length > 0 ? Object.keys(pageRows[0]) : [];

  return (
    <div className="space-y-6">
      {/* Zona Upload File (Kapasitas hingga 500.000 baris) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-bold text-sm sm:text-base">
                Impor File Pembukuan (Kapasitas s.d. 500.000 Baris)
              </h2>
              <p className="text-xs text-slate-500">
                Mendukung CSV, Excel (.XLSX/.XLS), dan JSON — disimpan bertahap per 10.000 baris agar hemat RAM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={(e) => void handleFileSelected(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={isParsing || isSaving}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
            >
              {isParsing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{isParsing ? 'Membaca File...' : 'Pilih File CSV / Excel'}</span>
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Pratinjau Staging File Sebelum Disimpan */}
        {stagedRows.length > 0 && (
          <div className="p-4 rounded-2xl border-2 border-emerald-500/70 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm">{stagedFileName}</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  {stagedRows.length.toLocaleString('id-ID')} baris siap disimpan ke database lokal
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold">Kategori:</label>
                <select
                  value={stagedCategory}
                  onChange={(e) => setStagedCategory(e.target.value as DatasetCategory)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                >
                  <option value="penjualan">Penjualan</option>
                  <option value="produk">Produk & Stok</option>
                  <option value="keuangan">Pembelian & Kas</option>
                  <option value="karyawan">Karyawan</option>
                </select>
              </div>
            </div>

            {/* Tabel Pratinjau 5 Baris Pertama */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                  <tr>
                    {Object.keys(stagedRows[0]).map((col) => (
                      <th key={col} className="py-2 px-3 font-bold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stagedRows.slice(0, 5).map((r, idx) => (
                    <tr key={idx}>
                      {Object.keys(stagedRows[0]).map((col) => (
                        <td key={col} className="py-2 px-3 whitespace-nowrap">
                          {String(r[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setStagedRows([]);
                  setStagedFileName('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleConfirmSaveStaged()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ({saveProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan {stagedRows.length.toLocaleString('id-ID')} Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab Kategori & Tabel Paginasi Hemat RAM */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label} ({(categoryCounts[tab.id] || 0).toLocaleString('id-ID')})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari di tab ini..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowManualForm((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Manual</span>
            </button>
          </div>
        </div>

        {/* Form Tambah Manual */}
        {showManualForm && (
          <form
            onSubmit={(e) => void handleManualSubmit(e)}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs"
          >
            {activeTab !== 'produk' && activeTab !== 'karyawan' && (
              <input
                type="date"
                value={mDate}
                onChange={(e) => setMDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            )}
            <input
              type="text"
              required
              value={mName}
              onChange={(e) => setMName(e.target.value)}
              placeholder={
                activeTab === 'karyawan'
                  ? 'Nama Karyawan'
                  : activeTab === 'keuangan'
                    ? 'Keterangan Transaksi'
                    : 'Nama Produk'
              }
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            {(activeTab === 'penjualan' || activeTab === 'produk') && (
              <input
                type="number"
                value={mQty}
                onChange={(e) => setMQty(e.target.value)}
                placeholder={activeTab === 'produk' ? 'Stok' : 'Qty'}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            )}
            {activeTab === 'keuangan' && (
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value as 'Pengeluaran' | 'Pemasukan')}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="Pengeluaran">Pengeluaran</option>
                <option value="Pemasukan">Pemasukan</option>
              </select>
            )}
            <input
              type="number"
              required
              value={mPrice}
              onChange={(e) => setMPrice(e.target.value)}
              placeholder={activeTab === 'karyawan' ? 'Gaji Bulanan' : 'Nominal / Harga'}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Tambahkan
            </button>
          </form>
        )}

        {/* Tabel Data (Hanya render 25 baris per halaman) */}
        {isLoadingPage ? (
          <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Memuat halaman {page}...</span>
          </div>
        ) : pageRows.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">
            Belum ada data pada kategori ini.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 font-bold">#</th>
                  {tableColumns.map((col) => (
                    <th key={col} className="py-2.5 px-3 font-bold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-400">
                      {((page - 1) * PAGE_SIZE + idx + 1).toLocaleString('id-ID')}
                    </td>
                    {tableColumns.map((col) => (
                      <td key={col} className="py-2 px-3 whitespace-nowrap">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Kontrol Paginasi */}
        {totalMatchedRows > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
            <span>
              Menampilkan halaman <strong>{page.toLocaleString('id-ID')}</strong> dari{' '}
              <strong>{totalPages.toLocaleString('id-ID')}</strong> (Total{' '}
              {totalMatchedRows.toLocaleString('id-ID')} baris)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Daftar File Dataset Tersimpan */}
      {savedDatasets.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm">Dataset Tersimpan di Perangkat</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {savedDatasets.map((ds) => (
              <div
                key={ds.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-bold">{ds.name}</p>
                  <p className="text-slate-400">
                    Kategori: {ds.category} •{' '}
                    {(ds.rowCount || ds.rows.length).toLocaleString('id-ID')} baris
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeDataset(ds.id)}
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                  title="Hapus dataset ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}