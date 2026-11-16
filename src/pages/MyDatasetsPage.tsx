import {
  Database,
  Eye,
  History,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import { useApp, type StoredDataset } from '../context/AppContext';

export function MyDatasetsPage() {
  const {
    savedDatasets,
    importHistories,
    deleteDataset,
    undoImportRecord,
    setActivePage,
  } = useApp();
  const [selectedPreview, setSelectedPreview] = useState<StoredDataset | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">My Datasets (Penyimpanan Offline Lokal)</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Seluruh dataset tersimpan aman di perangkat ini dan tetap dapat diakses tanpa koneksi internet.
          </p>
        </div>
        <button
          onClick={() => setActivePage('database')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Impor File Baru</span>
        </button>
      </div>

      {/* Daftar Dataset Tersimpan */}
      {savedDatasets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <Database className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-base">Belum Ada Dataset Tersimpan</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Silakan unggah file CSV atau Excel melalui menu Data Import untuk mulai membangun dashboard bisnismu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedDatasets.map((ds) => (
            <div
              key={ds.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {ds.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(ds.lastUpdatedAt).toLocaleString('id-ID')}
                  </span>
                </div>
                <h3 className="font-bold text-base mt-2 truncate">{ds.fileName}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Total Data: <strong>{ds.rows.length} baris</strong> • {ds.columns.length} kolom
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setSelectedPreview(ds)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Isi</span>
                </button>
                <button
                  onClick={() => {
                    if (selectedPreview?.id === ds.id) setSelectedPreview(null);
                    deleteDataset(ds.id);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-xs font-semibold hover:opacity-80"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Panel Preview Dataset */}
      {selectedPreview && (
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">
              Isi Data: {selectedPreview.fileName} ({selectedPreview.rows.length} baris)
            </h3>
            <button
              onClick={() => setSelectedPreview(null)}
              className="text-xs font-semibold text-slate-500 hover:underline"
            >
              Tutup Preview
            </button>
          </div>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  {selectedPreview.columns.map((c) => (
                    <th key={c.originalName} className="px-3 py-2 whitespace-nowrap">
                      {c.originalName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {selectedPreview.rows.slice(0, 30).map((row, idx) => (
                  <tr key={idx}>
                    {selectedPreview.columns.map((c) => (
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
      )}

      {/* Riwayat Impor & Undo */}
      {importHistories.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Impor File</span>
          </h3>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {importHistories.map((hist) => (
              <div key={hist.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold">
                    {hist.fileName}{' '}
                    <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 ml-1">
                      {hist.importMode}
                    </span>
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    +{hist.rowsAdded} baris ditambahkan ({hist.rowsSkipped} duplikat dilewati) •{' '}
                    {new Date(hist.createdAt).toLocaleString('id-ID')}
                  </p>
                </div>
                <button
                  onClick={() => undoImportRecord(hist.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batalkan (Undo)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
