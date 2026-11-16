import { Download, FileSpreadsheet, PlusCircle, Printer } from 'lucide-react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';

export function ReportsPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const nonEmptyDatasets = savedDatasets.filter((d) => d.rows.length > 0);
  const [selectedId, setSelectedId] = useState<string>('');

  const activeDs =
    nonEmptyDatasets.find((d) => d.id === selectedId) ?? nonEmptyDatasets[0] ?? null;

  if (!activeDs) {
    return (
      <div className="max-w-xl mx-auto mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
        <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Belum Ada Data untuk Diekspor</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2">
          Silakan catat transaksi atau isi database usaha terlebih dahulu sebelum mengunduh laporan Excel/PDF.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Isi Database Usaha</span>
        </button>
      </div>
    );
  }

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(activeDs.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan_UMKM');
    XLSX.writeFile(wb, `Laporan-${activeDs.fileName.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportToCsv = () => {
    const ws = XLSX.utils.json_to_sheet(activeDs.rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan-${activeDs.category}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold">Unduh & Cetak Laporan Usaha</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih database yang ingin diunduh menjadi file Excel, CSV, atau PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeDs.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold"
          >
            {nonEmptyDatasets.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.fileName} ({ds.rows.length} baris)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={exportToExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Excel</span>
          </button>

          <button
            type="button"
            onClick={exportToCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Unduh CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex justify-between text-xs">
          <div>
            <p className="font-bold text-sm">{businessProfile.name}</p>
            <p className="text-slate-500">{businessProfile.city}</p>
          </div>
          <p className="text-slate-500">Tanggal: {new Date().toLocaleDateString('id-ID')}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                {activeDs.columns.map((c) => (
                  <th key={c.originalName} className="px-3 py-2 whitespace-nowrap">
                    {c.originalName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {activeDs.rows.slice(0, 30).map((row, idx) => (
                <tr key={`rep_${activeDs.id}_${idx}`}>
                  {activeDs.columns.map((c) => (
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
    </div>
  );
}