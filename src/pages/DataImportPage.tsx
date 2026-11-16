import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useApp } from '../context/AppContext';
import { downloadSampleWarungCsv, parseBusinessFile } from '../lib/fileParser';
import type {
  ColumnSemanticRole,
  DatasetCategory,
  ImportMode,
  ParsedDatasetDraft,
} from '../types/dataset';

const CATEGORY_LABELS: Record<DatasetCategory, string> = {
  sales: 'Penjualan (Sales)',
  finance: 'Keuangan & Arus Kas (Finance)',
  inventory: 'Stok & Inventaris (Inventory)',
  product: 'Daftar Produk & Harga (Product)',
  customer: 'Data Pelanggan (Customer)',
  employee: 'Data Karyawan (Employee)',
  unknown: 'Umum / Belum Terklasifikasi',
};

const ROLE_OPTIONS: { value: ColumnSemanticRole; label: string }[] = [
  { value: 'date', label: 'Tanggal / Waktu' },
  { value: 'product_name', label: 'Nama Produk / Barang' },
  { value: 'category', label: 'Kategori' },
  { value: 'quantity', label: 'Kuantitas (Qty)' },
  { value: 'unit_price', label: 'Harga Satuan / Jual' },
  { value: 'cost_price', label: 'Harga Modal / HPP' },
  { value: 'amount', label: 'Total / Nominal Uang' },
  { value: 'transaction_type', label: 'Jenis Transaksi (Masuk/Keluar)' },
  { value: 'stock_current', label: 'Stok Saat Ini' },
  { value: 'stock_min', label: 'Stok Minimum' },
  { value: 'customer_name', label: 'Nama Pelanggan' },
  { value: 'identifier', label: 'Kode / ID / No. Nota' },
  { value: 'text', label: 'Teks Keterangan' },
  { value: 'ignore', label: 'Abaikan Kolom Ini' },
];

export function DataImportPage() {
  const { commitDatasetDraft, setActivePage } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedDatasetDraft | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  const handleFile = async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const parsed = await parseBusinessFile(file);
      setDraft(parsed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat membaca file.');
      setDraft(null);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const updateColumnRole = (colIndex: number, nextRole: ColumnSemanticRole) => {
    if (!draft) return;
    const nextCols = draft.columns.map((col, idx) =>
      idx === colIndex ? { ...col, confirmedRole: nextRole } : col
    );
    setDraft({ ...draft, columns: nextCols });
  };

  const handleConfirmImport = () => {
    if (!draft) return;
    commitDatasetDraft(draft, importMode);
    setDraft(null);
    // Langsung arahkan ke Auto Dashboard agar hasil grafik & KPI langsung terlihat!
    setActivePage('analisis');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">Impor File Laporan Bisnis (CSV / Excel / JSON)</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Unggah file ekspor kasir atau pembukuan warung. Setelah konfirmasi, dashboard otomatis langsung terbentuk.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadSampleWarungCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs sm:text-sm font-semibold shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Unduh Contoh File CSV Warung</span>
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-colors ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          onChange={onFileChange}
          className="hidden"
        />
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
        </div>
        <p className="text-sm sm:text-base font-bold">
          {loading ? 'Sedang memindai struktur file...' : 'Tarik & letakkan file di sini, atau klik untuk memilih file'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Mendukung format .CSV, .XLSX, .XLS, dan .JSON (Diproses 100% offline di perangkat)
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {draft && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base">{draft.fileName}</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold">
                    {draft.totalRows} baris • {draft.columns.length} kolom
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Periksa pemetaan kolom di bawah, lalu klik tombol hijau untuk membuat dashboard otomatis.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Kategori Dataset
                </label>
                <select
                  value={draft.confirmedCategory}
                  onChange={(e) =>
                    setDraft({ ...draft, confirmedCategory: e.target.value as DatasetCategory })
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Mode Penyimpanan
                </label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as ImportMode)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold"
                >
                  <option value="merge">Merge (Gabung & Cegah Duplikat)</option>
                  <option value="append">Append (Tambah Semua Baris Baru)</option>
                  <option value="replace">Replace (Ganti Dataset Lama)</option>
                </select>
              </div>
            </div>
          </div>

          {draft.issues.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/70 dark:border-amber-800 text-xs space-y-1.5">
              <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Ditemukan {draft.issues.length} catatan validasi data:
              </p>
              <ul className="list-disc pl-5 text-amber-900 dark:text-amber-200 space-y-0.5">
                {draft.issues.slice(0, 5).map((issue, idx) => (
                  <li key={idx}>
                    Baris {issue.rowIndex} ({issue.column}): {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              1. Pemetaan Kolom Otomatis (Dapat Disesuaikan)
            </h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Nama Kolom File</th>
                    <th className="px-4 py-2.5">Tipe Data</th>
                    <th className="px-4 py-2.5">Contoh Isi</th>
                    <th className="px-4 py-2.5">Peran di Dashboard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {draft.columns.map((col, idx) => (
                    <tr key={col.originalName}>
                      <td className="px-4 py-2.5 font-semibold">{col.originalName}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                          {col.detectedType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 truncate max-w-48">
                        {col.sampleValues.map(String).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={col.confirmedRole}
                          onChange={(e) =>
                            updateColumnRole(idx, e.target.value as ColumnSemanticRole)
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              2. Pratinjau Isi Data (8 Baris Pertama)
            </h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500">
                  <tr>
                    {draft.columns.map((c) => (
                      <th key={c.originalName} className="px-3 py-2 whitespace-nowrap">
                        {c.originalName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {draft.rows.slice(0, 8).map((row, rIdx) => (
                    <tr key={rIdx}>
                      {draft.columns.map((c) => (
                        <td key={c.originalName} className="px-3 py-2 whitespace-nowrap">
                          {String(row[c.originalName] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Konfirmasi & Buat Dashboard Otomatis</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}