import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FolderOpen,
  History,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  useApp,
  type BusinessCategory,
  type ImportMode,
  type StoredDataset,
} from '../context/AppContext';
import {
  buildRowSignature,
  detectCategoryFromSheet,
  MAX_IMPORT_FILE_SIZE_MB,
  MAX_IMPORT_ROWS_PER_SHEET,
  normalizeAndValidateRows,
  parseBusinessFile,
  suggestColumnMappings,
  type ColumnMappingField,
  type ParsedBusinessFileResult,
} from '../lib/fileParser';
import { formatCompactRupiah, formatFullRupiah } from '../lib/formatters';
import { toNumber } from '../lib/numberUtils';

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Penjualan',
  finance: 'Pembelian & Kas',
  inventory: 'Produk & Stok',
  employee: 'Karyawan & Gaji',
  general: 'Data Umum',
};

const ROWS_PER_PAGE = 20;

export function DatabasePage() {
  const {
    savedDatasets,
    importHistory,
    businessProfile,
    saveDataset,
    commitSmartImport,
    deleteDataset,
  } = useApp();

  const [activeTab, setActiveTab] = useState<BusinessCategory>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const [importDraft, setImportDraft] = useState<ParsedBusinessFileResult | null>(null);
  const [draftSheetName, setDraftSheetName] = useState<string>('');
  const [draftCategory, setDraftCategory] = useState<BusinessCategory>('inventory');
  const [draftMappings, setDraftMappings] = useState<ColumnMappingField[]>([]);
  const [draftMode, setDraftMode] = useState<ImportMode>('merge');

  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saleProduct, setSaleProduct] = useState('');
  const [saleCategory, setSaleCategory] = useState('Umum');
  const [saleQty, setSaleQty] = useState('1');
  const [salePrice, setSalePrice] = useState('');
  const [saleCost, setSaleCost] = useState('0');

  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [buyItem, setBuyItem] = useState('');
  const [buyType, setBuyType] = useState<'Pengeluaran' | 'Pemasukan'>('Pengeluaran');
  const [buySupplier, setBuySupplier] = useState('');
  const [buyAmount, setBuyAmount] = useState('');

  const [prodName, setProdName] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodMin, setProdMin] = useState('5');
  const [prodCost, setProdCost] = useState('');
  const [prodSell, setProdSell] = useState('');

  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('Kasir');
  const [empSalary, setEmpSalary] = useState('');

  const currency = businessProfile.currency || 'IDR';
  const rpFull = (n: number) => formatFullRupiah(n, currency);
  const rpCompact = (n: number) => formatCompactRupiah(n, currency);

  const showNotice = (text: string, type: 'ok' | 'err' = 'ok') => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5500);
  };

  const existingSignatures = useMemo(() => {
    const set = new Set<string>();
    for (const ds of savedDatasets) {
      if (ds.category === 'general') continue;
      for (const r of ds.rows) {
        set.add(buildRowSignature(ds.category, r));
      }
    }
    return set;
  }, [savedDatasets]);

  const evaluatedDraft = useMemo(() => {
    if (!importDraft) return null;
    const sheet =
      importDraft.sheets.find((s) => s.sheetName === draftSheetName) ?? importDraft.sheets[0];
    if (!sheet) return null;
    return normalizeAndValidateRows(sheet, draftCategory, draftMappings, existingSignatures);
  }, [importDraft, draftSheetName, draftCategory, draftMappings, existingSignatures]);

  const handleFileStage = async (file: File) => {
    setIsParsing(true);
    setFeedback(null);
    try {
      const parsed = await parseBusinessFile(file, existingSignatures);
      setImportDraft(parsed);
      setDraftSheetName(parsed.activeSheetName);
      setDraftCategory(parsed.detectedCategory);
      setDraftMappings(parsed.mappings);
      setDraftMode('merge');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca file.';
      showNotice(msg, 'err');
      setImportDraft(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSheetChange = (nextSheetName: string) => {
    if (!importDraft) return;
    setDraftSheetName(nextSheetName);
    const sheet = importDraft.sheets.find((s) => s.sheetName === nextSheetName);
    if (!sheet) return;
    const detected = detectCategoryFromSheet(importDraft.fileName, sheet.headers);
    setDraftCategory(detected.category);
    setDraftMappings(suggestColumnMappings(sheet.headers, detected.category));
  };

  const handleCategoryChange = (nextCat: BusinessCategory) => {
    setDraftCategory(nextCat);
    if (!importDraft) return;
    const sheet =
      importDraft.sheets.find((s) => s.sheetName === draftSheetName) ?? importDraft.sheets[0];
    if (sheet) {
      setDraftMappings(suggestColumnMappings(sheet.headers, nextCat));
    }
  };

  const handleMappingChange = (targetField: string, sourceColumn: string) => {
    setDraftMappings((prev) =>
      prev.map((m) => (m.targetField === targetField ? { ...m, sourceColumn } : m))
    );
  };

  const handleConfirmImport = () => {
    if (!importDraft || !evaluatedDraft || evaluatedDraft.normalizedRows.length === 0) return;

    const rowsToSave = evaluatedDraft.normalizedRows;
    const datasetToStore: StoredDataset = {
      id: `file_${Date.now()}`,
      fileName: `${importDraft.fileName} (${draftSheetName})`,
      name: `${importDraft.fileName} (${draftSheetName})`,
      category: draftCategory,
      columns: Object.keys(rowsToSave[0]),
      rows: rowsToSave,
      uploadedAt: new Date().toISOString(),
    };

    const result = commitSmartImport(datasetToStore, draftMode, {
      fileName: importDraft.fileName,
      sheetName: draftSheetName,
      category: draftCategory,
      mode: draftMode,
      rowsSaved: rowsToSave.length,
      duplicatesSkipped: 0,
      summaryRowsSkipped: evaluatedDraft.validation.skippedSummaryRows,
    });

    setImportDraft(null);
    setActiveTab(draftCategory);
    setPage(1);
    showNotice(
      `Berhasil menyimpan ${result.savedCount.toLocaleString('id-ID')} baris ke ${CATEGORY_LABELS[draftCategory]} (mode: ${draftMode.toUpperCase()}${result.skippedDuplicates > 0 ? `, ${result.skippedDuplicates} duplikat ditangani` : ''}).`
    );
  };

  const activeDatasets = useMemo(
    () => savedDatasets.filter((d) => d.category === activeTab),
    [savedDatasets, activeTab]
  );

  const allRowsWithRef = useMemo(() => {
    const list: {
      datasetId: string;
      datasetName: string;
      rowIndex: number;
      row: Record<string, unknown>;
    }[] = [];

    for (const ds of activeDatasets) {
      ds.rows.forEach((row, idx) => {
        list.push({
          datasetId: ds.id,
          datasetName: ds.fileName,
          rowIndex: idx,
          row,
        });
      });
    }
    return list;
  }, [activeDatasets]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allRowsWithRef;
    return allRowsWithRef.filter((item) =>
      Object.values(item.row).some((val) => String(val ?? '').toLowerCase().includes(q))
    );
  }, [allRowsWithRef, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredRows, safePage]);

  const appendManualRow = (category: BusinessCategory, newRow: Record<string, unknown>) => {
    const existing = savedDatasets.find((d) => d.category === category);
    if (existing) {
      saveDataset({
        ...existing,
        rows: [newRow, ...existing.rows],
        uploadedAt: new Date().toISOString(),
      });
    } else {
      const title = `Catatan ${CATEGORY_LABELS[category]}`;
      saveDataset({
        id: `ds_${category}_${Date.now()}`,
        fileName: title,
        name: title,
        category,
        columns: Object.keys(newRow),
        rows: [newRow],
        uploadedAt: new Date().toISOString(),
      });
    }
  };

  const handleAddProduct = (e: FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    appendManualRow('inventory', {
      Nama_Produk: prodName.trim(),
      Kategori: 'Umum',
      Stok_Saat_Ini: Math.max(0, toNumber(prodStock, 0)),
      Stok_Minimum: Math.max(0, toNumber(prodMin, 5)),
      Harga_Modal: Math.max(0, toNumber(prodCost, 0)),
      Harga_Jual: Math.max(0, toNumber(prodSell, 0)),
    });
    setProdName('');
    setProdCost('');
    setProdSell('');
    showNotice('Produk berhasil disimpan ke katalog stok.');
  };

  const handleAddSale = (e: FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, toNumber(saleQty, 1));
    const price = Math.max(0, toNumber(salePrice, 0));
    const cost = Math.max(0, toNumber(saleCost, 0));
    if (!saleProduct.trim() || price <= 0) return;

    appendManualRow('sales', {
      Tanggal: saleDate,
      Nama_Produk: saleProduct.trim(),
      Kategori: saleCategory.trim() || 'Umum',
      Qty: qty,
      Harga_Satuan: price,
      Harga_Modal: cost,
      Total: qty * price,
    });
    setSaleProduct('');
    setSalePrice('');
    setSaleCost('0');
    showNotice('Transaksi penjualan berhasil disimpan.');
  };

  const handleAddPurchase = (e: FormEvent) => {
    e.preventDefault();
    const nominal = Math.max(0, toNumber(buyAmount, 0));
    if (!buyItem.trim() || nominal <= 0) return;

    appendManualRow('finance', {
      Tanggal: buyDate,
      Nama_Barang_Keperluan: buyItem.trim(),
      Supplier: buySupplier.trim() || '-',
      Nominal: nominal,
      Jenis: buyType,
    });
    setBuyItem('');
    setBuySupplier('');
    setBuyAmount('');
    showNotice(`Catatan ${buyType.toLowerCase()} berhasil disimpan.`);
  };

  const handleAddEmployee = (e: FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) return;
    appendManualRow('employee', {
      Nama_Karyawan: empName.trim(),
      Jabatan: empRole.trim() || 'Staf',
      Gaji_Bulanan: Math.max(0, toNumber(empSalary, 0)),
    });
    setEmpName('');
    setEmpSalary('');
    showNotice('Data karyawan berhasil disimpan.');
  };

  const handleDeleteSingleRow = (datasetId: string, rowIndex: number) => {
    const target = savedDatasets.find((d) => d.id === datasetId);
    if (!target) return;
    const updatedRows = target.rows.filter((_, idx) => idx !== rowIndex);
    if (updatedRows.length === 0) deleteDataset(datasetId);
    else saveDataset({ ...target, rows: updatedRows, uploadedAt: new Date().toISOString() });
    setSelectedIndices(new Set());
  };

  const handleDeleteSelectedRows = () => {
    if (selectedIndices.size === 0) return;
    const toDeleteByDs = new Map<string, Set<number>>();
    selectedIndices.forEach((filteredIdx) => {
      const item = filteredRows[filteredIdx];
      if (!item) return;
      if (!toDeleteByDs.has(item.datasetId)) toDeleteByDs.set(item.datasetId, new Set());
      toDeleteByDs.get(item.datasetId)!.add(item.rowIndex);
    });

    toDeleteByDs.forEach((rowIdxSet, dsId) => {
      const ds = savedDatasets.find((d) => d.id === dsId);
      if (!ds) return;
      const remaining = ds.rows.filter((_, idx) => !rowIdxSet.has(idx));
      if (remaining.length === 0) deleteDataset(dsId);
      else saveDataset({ ...ds, rows: remaining, uploadedAt: new Date().toISOString() });
    });

    const count = selectedIndices.size;
    setSelectedIndices(new Set());
    showNotice(`${count} baris terpilih berhasil dihapus.`);
  };

  const handleClearActiveCategory = () => {
    if (activeDatasets.length === 0) return;
    if (
      !window.confirm(
        `Hapus seluruh ${allRowsWithRef.length.toLocaleString('id-ID')} catatan di "${CATEGORY_LABELS[activeTab]}"?`
      )
    ) {
      return;
    }
    activeDatasets.forEach((ds) => deleteDataset(ds.id));
    setSelectedIndices(new Set());
    showNotice(`Seluruh data ${CATEGORY_LABELS[activeTab]} berhasil dikosongkan.`);
  };

  const toggleSelectRow = (globalFilteredIndex: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(globalFilteredIndex)) next.delete(globalFilteredIndex);
      else next.add(globalFilteredIndex);
      return next;
    });
  };

  const toggleSelectCurrentPage = () => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    const pageIndices = paginatedRows.map((_, i) => start + i);
    const allSelected = pageIndices.every((idx) => selectedIndices.has(idx));
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIndices.forEach((idx) => next.delete(idx));
      else pageIndices.forEach((idx) => next.add(idx));
      return next;
    });
  };

  const activeSheetObj =
    importDraft?.sheets.find((s) => s.sheetName === draftSheetName) ?? importDraft?.sheets[0];

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 ${
            feedback.type === 'err'
              ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {feedback.type === 'err' ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
        <div>
          <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Smart File Import (CSV, XLS, XLSX, JSON)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pemeriksaan ukuran otomatis (maks. {MAX_IMPORT_FILE_SIZE_MB} MB /{' '}
            {MAX_IMPORT_ROWS_PER_SHEET.toLocaleString('id-ID')} baris), pemetaan kolom otomatis,
            filter baris TOTAL, dan pratinjau sebelum disimpan.
          </p>
        </div>

        <label
          onDragOver={(e: DragEvent<HTMLLabelElement>) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e: DragEvent<HTMLLabelElement>) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFileStage(f);
          }}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-colors ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40'
              : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/40'
          }`}
        >
          <Upload className="w-8 h-8 text-emerald-600 mb-2" />
          <span className="text-xs sm:text-sm font-bold text-center">
            {isParsing
              ? 'Sedang menganalisis struktur & memvalidasi baris data...'
              : 'Tarik & Lepas File ke Sini, atau Klik untuk Memilih File'}
          </span>
          <span className="text-[11px] text-slate-500 mt-1">
            Mendukung .CSV, .XLS, .XLSX, dan .JSON (Pratinjau & validasi tampil sebelum simpan)
          </span>
          <input
            type="file"
            accept=".csv,.xls,.xlsx,.json"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0];
              if (f) void handleFileStage(f);
              e.target.value = '';
            }}
            className="hidden"
          />
        </label>

        {importDraft && evaluatedDraft && activeSheetObj && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-emerald-300 dark:border-emerald-800 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pratinjau & Laporan Validasi Sebelum Simpan</span>
                </span>
                <h3 className="font-bold text-sm sm:text-base mt-0.5">{importDraft.fileName}</h3>
                <p className="text-xs text-slate-500">{importDraft.detectionReason}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {importDraft.sheets.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500">
                      Pilih Sheet Excel
                    </label>
                    <select
                      value={draftSheetName}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                    >
                      {importDraft.sheets.map((s) => (
                        <option key={s.sheetName} value={s.sheetName}>
                          {s.sheetName} ({s.rawRows.length.toLocaleString('id-ID')} baris)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500">
                    Kategori Tujuan
                  </label>
                  <select
                    value={draftCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as BusinessCategory)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="inventory">Produk & Stok</option>
                    <option value="sales">Penjualan</option>
                    <option value="finance">Pembelian & Kas</option>
                    <option value="employee">Karyawan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500">
                    Mode Simpan
                  </label>
                  <select
                    value={draftMode}
                    onChange={(e) => setDraftMode(e.target.value as ImportMode)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="merge">Merge (Gabung & Cegah Duplikat)</option>
                    <option value="append">Append (Tambahkan Semua)</option>
                    <option value="replace">Replace (Ganti Data Kategori Ini)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold mb-2">Pemetaan Kolom Otomatis:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {draftMappings.map((m) => (
                  <div
                    key={m.targetField}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <span className="font-semibold truncate">
                      {m.label}
                      {m.required && <span className="text-red-500">*</span>}
                    </span>
                    <select
                      value={m.sourceColumn}
                      onChange={(e) => handleMappingChange(m.targetField, e.target.value)}
                      className="max-w-36 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                    >
                      <option value="">(Tidak dipetakan)</option>
                      {activeSheetObj.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block">Baris Valid</span>
                <strong className="text-base text-emerald-600">
                  {evaluatedDraft.validation.validRowsCount.toLocaleString('id-ID')}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block">Baris TOTAL Dilewati</span>
                <strong className="text-base">
                  {evaluatedDraft.validation.skippedSummaryRows.toLocaleString('id-ID')}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block">Duplikat Terdeteksi</span>
                <strong className="text-base text-amber-600">
                  {(
                    evaluatedDraft.validation.duplicateInFileCount +
                    evaluatedDraft.validation.duplicateWithExistingCount
                  ).toLocaleString('id-ID')}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block">Nominal Rp 0</span>
                <strong className="text-base">
                  {evaluatedDraft.validation.zeroNominalCount.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {evaluatedDraft.validation.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-1">
                {evaluatedDraft.validation.warnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-amber-900 dark:text-amber-200">
                    • {w}
                  </p>
                ))}
              </div>
            )}

            <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    {Object.keys(evaluatedDraft.normalizedRows[0] ?? {}).map((col) => (
                      <th key={col} className="p-2.5 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {evaluatedDraft.normalizedRows.slice(0, 8).map((row, rIdx) => (
                    <tr key={rIdx}>
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx} className="p-2.5 whitespace-nowrap">
                          {String(val ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setImportDraft(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Batalkan
              </button>
              <button
                type="button"
                disabled={evaluatedDraft.normalizedRows.length === 0}
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Konfirmasi & Simpan{' '}
                  {evaluatedDraft.normalizedRows.length.toLocaleString('id-ID')} Baris
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {(savedDatasets.length > 0 || importHistory.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm">Dataset Aktif ({savedDatasets.length})</h3>
            </div>
            {savedDatasets.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedDatasets.map((ds) => (
                  <div
                    key={ds.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{ds.fileName}</p>
                        <p className="text-[11px] text-slate-500">
                          {CATEGORY_LABELS[ds.category] ?? ds.category} •{' '}
                          <strong>{ds.rows.length.toLocaleString('id-ID')} baris</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Hapus seluruh file "${ds.fileName}"?`)) {
                          deleteDataset(ds.id);
                          setSelectedIndices(new Set());
                          showNotice(`File "${ds.fileName}" berhasil dihapus.`);
                        }
                      }}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      title="Hapus file ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Belum ada dataset aktif.</p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm">Riwayat Impor Terakhir ({importHistory.length})</h3>
            </div>
            {importHistory.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
                {importHistory.slice(0, 10).map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate pr-2">{h.fileName}</span>
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                        {h.mode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {CATEGORY_LABELS[h.category]} • +{h.rowsSaved.toLocaleString('id-ID')} baris
                      {h.duplicatesSkipped > 0
                        ? ` • ${h.duplicatesSkipped} duplikat dilewati`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Belum ada riwayat impor file.</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-wrap gap-1.5">
        {(
          [
            { id: 'inventory', label: 'Produk & Stok' },
            { id: 'sales', label: 'Penjualan' },
            { id: 'finance', label: 'Pembelian & Kas' },
            { id: 'employee', label: 'Karyawan' },
          ] as { id: BusinessCategory; label: string }[]
        ).map((tab) => {
          const count = savedDatasets
            .filter((d) => d.category === tab.id)
            .reduce((acc, d) => acc + d.rows.length, 0);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
                setSearchQuery('');
                setSelectedIndices(new Set());
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label} ({count.toLocaleString('id-ID')})
            </button>
          );
        })}
      </div>

      {activeTab === 'inventory' && (
        <form
          onSubmit={handleAddProduct}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-bold text-sm sm:text-base">Tambah Produk & Stok Satuan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Nama Produk</label>
              <input
                type="text"
                placeholder="Contoh: Gula Pasir 1kg"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Stok Awal</label>
              <input
                type="number"
                min="0"
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Stok Minimum</label>
              <input
                type="number"
                min="0"
                value={prodMin}
                onChange={(e) => setProdMin(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Harga Modal</label>
              <input
                type="number"
                min="0"
                placeholder="14000"
                value={prodCost}
                onChange={(e) => setProdCost(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Harga Jual</label>
              <input
                type="number"
                min="0"
                placeholder="16500"
                value={prodSell}
                onChange={(e) => setProdSell(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Produk</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'sales' && (
        <form
          onSubmit={handleAddSale}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-bold text-sm sm:text-base">Catat Penjualan Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Tanggal</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Nama Produk</label>
              <input
                type="text"
                placeholder="Contoh: Beras 5kg"
                value={saleProduct}
                onChange={(e) => setSaleProduct(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Kategori</label>
              <input
                type="text"
                value={saleCategory}
                onChange={(e) => setSaleCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Jumlah Terjual</label>
              <input
                type="number"
                min="1"
                value={saleQty}
                onChange={(e) => setSaleQty(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Harga Jual Satuan</label>
              <input
                type="number"
                min="0"
                placeholder="65000"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Harga Modal Satuan (HPP)</label>
              <input
                type="number"
                min="0"
                value={saleCost}
                onChange={(e) => setSaleCost(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs sm:text-sm font-semibold">
              Total:{' '}
              <strong className="text-emerald-600">
                {rpFull(toNumber(saleQty, 0) * toNumber(salePrice, 0))}
              </strong>
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Penjualan</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'finance' && (
        <form
          onSubmit={handleAddPurchase}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-bold text-sm sm:text-base">Catat Arus Kas / Pembelian</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Tanggal</label>
              <input
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Jenis Arus</label>
              <select
                value={buyType}
                onChange={(e) => setBuyType(e.target.value as 'Pengeluaran' | 'Pemasukan')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              >
                <option value="Pengeluaran">Pengeluaran / Kulakan</option>
                <option value="Pemasukan">Pemasukan Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Keterangan / Barang</label>
              <input
                type="text"
                placeholder="Kulakan Minyak Goreng"
                value={buyItem}
                onChange={(e) => setBuyItem(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Supplier / Pihak</label>
              <input
                type="text"
                placeholder="Agen Sembako"
                value={buySupplier}
                onChange={(e) => setBuySupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Nominal (Rp)</label>
              <input
                type="number"
                min="0"
                placeholder="350000"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Catatan Kas</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'employee' && (
        <form
          onSubmit={handleAddEmployee}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-bold text-sm sm:text-base">Tambah Data Karyawan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Nama Karyawan</label>
              <input
                type="text"
                placeholder="Nama lengkap"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Jabatan</label>
              <input
                type="text"
                value={empRole}
                onChange={(e) => setEmpRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Gaji Bulanan (Rp)</label>
              <input
                type="number"
                min="0"
                placeholder="2000000"
                value={empSalary}
                onChange={(e) => setEmpSalary(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Karyawan</span>
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-sm sm:text-base">
            Daftar {CATEGORY_LABELS[activeTab]} Tersimpan (
            {allRowsWithRef.length.toLocaleString('id-ID')} catatan)
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {selectedIndices.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelectedRows}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih ({selectedIndices.size})</span>
              </button>
            )}

            {allRowsWithRef.length > 0 && (
              <button
                type="button"
                onClick={handleClearActiveCategory}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan Semua</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
              setSelectedIndices(new Set());
            }}
            placeholder="Cari nama produk, tanggal, kategori, atau nominal..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
          />
        </div>

        {paginatedRows.length > 0 ? (
          <>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs">
                  <tr>
                    <th className="p-3 w-10">
                      <button type="button" onClick={toggleSelectCurrentPage}>
                        {paginatedRows.every((_, i) =>
                          selectedIndices.has((safePage - 1) * ROWS_PER_PAGE + i)
                        ) ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3">Tanggal / Kategori</th>
                    <th className="p-3">Nama Item</th>
                    <th className="p-3">Detail</th>
                    <th className="p-3 text-right">Nilai</th>
                    <th className="p-3 text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedRows.map((item, idx) => {
                    const globalIdx = (safePage - 1) * ROWS_PER_PAGE + idx;
                    const isChecked = selectedIndices.has(globalIdx);
                    const r = item.row;

                    const title = String(
                      r['Nama_Produk'] ??
                        r['Nama_Barang_Keperluan'] ??
                        r['Nama_Karyawan'] ??
                        '-'
                    );
                    const dateOrSub = String(
                      r['Tanggal'] ?? r['Kategori'] ?? r['Jabatan'] ?? item.datasetName
                    );
                    const detail =
                      activeTab === 'sales'
                        ? `${r['Qty'] ?? 1} unit (HPP: ${rpCompact(toNumber(r['Harga_Modal'], 0))})`
                        : activeTab === 'inventory'
                          ? `Stok: ${r['Stok_Saat_Ini'] ?? 0} (Modal: ${rpCompact(toNumber(r['Harga_Modal'], 0))})`
                          : activeTab === 'finance'
                            ? `${r['Jenis'] ?? 'Pengeluaran'} • ${r['Supplier'] ?? '-'}`
                            : String(r['Jabatan'] ?? '-');

                    const rawAmount = toNumber(
                      r['Total'] ?? r['Nominal'] ?? r['Harga_Jual'] ?? r['Gaji_Bulanan'],
                      0
                    );

                    return (
                      <tr
                        key={`${item.datasetId}_${item.rowIndex}`}
                        className={
                          isChecked
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }
                      >
                        <td className="p-3">
                          <button type="button" onClick={() => toggleSelectRow(globalIdx)}>
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                          {dateOrSub}
                        </td>
                        <td className="p-3 font-semibold max-w-48 truncate">{title}</td>
                        <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{detail}</td>
                        <td
                          className="p-3 text-right font-bold whitespace-nowrap"
                          title={rpFull(rawAmount)}
                        >
                          {rpCompact(rawAmount)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleRow(item.datasetId, item.rowIndex)}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Menampilkan {(safePage - 1) * ROWS_PER_PAGE + 1} –{' '}
                {Math.min(safePage * ROWS_PER_PAGE, filteredRows.length)} dari{' '}
                <strong>{filteredRows.length.toLocaleString('id-ID')}</strong> data
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-semibold">
                  Hal {safePage} / {totalPages.toLocaleString('id-ID')}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Tidak ada data yang cocok di kategori ini.
          </div>
        )}
      </div>
    </div>
  );
}