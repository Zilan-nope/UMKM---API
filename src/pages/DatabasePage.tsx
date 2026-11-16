import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FolderOpen,
  Plus,
  Search,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp, type StoredDataset } from '../context/AppContext';
import { formatCompactRupiah, formatFullRupiah } from '../lib/formatters';
import { parseNumericValue, profileColumns } from '../lib/fileParser';

type TabKey = 'sales' | 'finance' | 'inventory' | 'employee' | 'import';

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Penjualan',
  finance: 'Pembelian / Pengeluaran',
  inventory: 'Produk & Stok',
  employee: 'Karyawan & Gaji',
  general: 'Data Umum',
};

const ROWS_PER_PAGE = 20;

function getDatasetTitle(ds: StoredDataset): string {
  return ds.fileName || 'Dataset Usaha';
}

function buildDatasetObject(
  id: string,
  title: string,
  category: StoredDataset['category'],
  headers: string[],
  rows: Record<string, unknown>[]
): StoredDataset {
  return {
    id,
    fileName: title,
    category,
    columns: profileColumns(headers, rows),
    rows,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter);

  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line, delimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h || `Kolom_${idx + 1}`] = vals[idx] ?? '';
    });
    return row;
  });
}

export function DatabasePage() {
  const appContext = useApp();
  const { savedDatasets, saveDatasets, businessProfile, deleteDataset } = appContext;

  const [activeTab, setActiveTab] = useState<TabKey>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importTargetCategory, setImportTargetCategory] = useState<
    'sales' | 'finance' | 'inventory' | 'employee'
  >('sales');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saleProduct, setSaleProduct] = useState('');
  const [saleCategory, setSaleCategory] = useState('Umum');
  const [saleQty, setSaleQty] = useState('1');
  const [salePrice, setSalePrice] = useState('');
  const [saleCost, setSaleCost] = useState('0');

  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [buyItem, setBuyItem] = useState('');
  const [buySupplier, setBuySupplier] = useState('');
  const [buyAmount, setBuyAmount] = useState('');

  const [prodName, setProdName] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodCost, setProdCost] = useState('');
  const [prodSell, setProdSell] = useState('');

  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('Kasir');
  const [empSalary, setEmpSalary] = useState('');

  const currency = businessProfile.currency || 'IDR';
  const rpFull = (n: number) => formatFullRupiah(n, currency);
  const rpCompact = (n: number) => formatCompactRupiah(n, currency);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const activeDatasets = useMemo(() => {
    if (activeTab === 'import') return [];
    return savedDatasets.filter((d) => d.category === activeTab);
  }, [savedDatasets, activeTab]);

  const allRowsWithRef = useMemo(() => {
    const list: {
      datasetId: string;
      datasetName: string;
      rowIndex: number;
      row: Record<string, unknown>;
    }[] = [];

    for (const ds of activeDatasets) {
      const dsTitle = getDatasetTitle(ds);
      ds.rows.forEach((row, idx) => {
        list.push({
          datasetId: ds.id,
          datasetName: dsTitle,
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

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
    setSearchQuery('');
    setSelectedIndices(new Set());
  };

  const appendRowToCategory = (
    category: 'sales' | 'finance' | 'inventory' | 'employee',
    newRow: Record<string, unknown>
  ) => {
    const existing = savedDatasets.find((d) => d.category === category);
    if (existing) {
      const updated: StoredDataset = {
        ...existing,
        rows: [newRow, ...existing.rows],
        lastUpdatedAt: new Date().toISOString(),
      };
      const nextList = savedDatasets.map((d) => (d.id === existing.id ? updated : d));
      saveDatasets(nextList);
    } else {
      const created = buildDatasetObject(
        `ds_${category}_${Date.now()}`,
        `Catatan ${CATEGORY_LABELS[category]}`,
        category,
        Object.keys(newRow),
        [newRow]
      );
      saveDatasets([created, ...savedDatasets]);
    }
  };

  const handleAddSale = (e: FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, Number(saleQty) || 1);
    const price = Math.max(0, Number(salePrice) || 0);
    const cost = Math.max(0, Number(saleCost) || 0);
    if (!saleProduct.trim() || price <= 0) return;

    appendRowToCategory('sales', {
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
    const nominal = Math.max(0, Number(buyAmount) || 0);
    if (!buyItem.trim() || nominal <= 0) return;

    appendRowToCategory('finance', {
      Tanggal: buyDate,
      Nama_Barang_Keperluan: buyItem.trim(),
      Supplier: buySupplier.trim() || '-',
      Nominal: nominal,
      Jenis: 'Pengeluaran',
    });
    setBuyItem('');
    setBuySupplier('');
    setBuyAmount('');
    showNotice('Catatan pembelian berhasil disimpan.');
  };

  const handleAddProduct = (e: FormEvent) => {
    e.preventDefault();
    const stok = Math.max(0, Number(prodStock) || 0);
    const modal = Math.max(0, Number(prodCost) || 0);
    const jual = Math.max(0, Number(prodSell) || 0);
    if (!prodName.trim()) return;

    appendRowToCategory('inventory', {
      Nama_Produk: prodName.trim(),
      Stok_Saat_Ini: stok,
      Stok_Minimum: 5,
      Harga_Modal: modal,
      Harga_Jual: jual,
    });
    setProdName('');
    setProdCost('');
    setProdSell('');
    showNotice('Produk baru berhasil ditambahkan ke stok.');
  };

  const handleAddEmployee = (e: FormEvent) => {
    e.preventDefault();
    const gaji = Math.max(0, Number(empSalary) || 0);
    if (!empName.trim()) return;

    appendRowToCategory('employee', {
      Nama_Karyawan: empName.trim(),
      Jabatan: empRole.trim() || 'Staf',
      Gaji_Bulanan: gaji,
    });
    setEmpName('');
    setEmpSalary('');
    showNotice('Data karyawan berhasil disimpan.');
  };

  const handleDeleteSingleRow = (datasetId: string, rowIndex: number) => {
    const target = savedDatasets.find((d) => d.id === datasetId);
    if (!target) return;
    const updatedRows = target.rows.filter((_, idx) => idx !== rowIndex);

    if (updatedRows.length === 0) {
      deleteDataset(datasetId);
    } else {
      const updated: StoredDataset = {
        ...target,
        rows: updatedRows,
        lastUpdatedAt: new Date().toISOString(),
      };
      const nextList = savedDatasets.map((d) => (d.id === datasetId ? updated : d));
      saveDatasets(nextList);
    }
    setSelectedIndices(new Set());
  };

  const handleDeleteSelectedRows = () => {
    if (selectedIndices.size === 0) return;
    const toDeleteByDs = new Map<string, Set<number>>();

    selectedIndices.forEach((filteredIdx) => {
      const item = filteredRows[filteredIdx];
      if (!item) return;
      if (!toDeleteByDs.has(item.datasetId)) {
        toDeleteByDs.set(item.datasetId, new Set());
      }
      toDeleteByDs.get(item.datasetId)!.add(item.rowIndex);
    });

    let workingList = [...savedDatasets];
    toDeleteByDs.forEach((rowIdxSet, dsId) => {
      const ds = workingList.find((d) => d.id === dsId);
      if (!ds) return;
      const remaining = ds.rows.filter((_, idx) => !rowIdxSet.has(idx));
      if (remaining.length === 0) {
        workingList = workingList.filter((d) => d.id !== dsId);
      } else {
        const updated: StoredDataset = {
          ...ds,
          rows: remaining,
          lastUpdatedAt: new Date().toISOString(),
        };
        workingList = workingList.map((d) => (d.id === dsId ? updated : d));
      }
    });
    saveDatasets(workingList);

    const count = selectedIndices.size;
    setSelectedIndices(new Set());
    showNotice(`${count} baris terpilih berhasil dihapus.`);
  };

  const handleClearActiveCategory = () => {
    if (activeDatasets.length === 0) return;
    if (
      !window.confirm(
        `Hapus seluruh ${allRowsWithRef.length.toLocaleString('id-ID')} catatan di kategori "${CATEGORY_LABELS[activeTab]}"?`
      )
    ) {
      return;
    }
    activeDatasets.forEach((ds) => deleteDataset(ds.id));
    setSelectedIndices(new Set());
    showNotice(`Seluruh data ${CATEGORY_LABELS[activeTab]} berhasil dikosongkan.`);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let parsedRows: Record<string, unknown>[] = [];
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
        const text = await file.text();
        parsedRows = parseCsvText(text);
      } else {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (firstSheet) {
          parsedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet], {
            defval: '',
          });
        }
      }

      if (parsedRows.length === 0) {
        showNotice('File kosong atau format kolom tidak terbaca.');
        return;
      }

      const newDataset = buildDatasetObject(
        `file_${Date.now()}`,
        file.name,
        importTargetCategory,
        Object.keys(parsedRows[0]),
        parsedRows
      );

      saveDatasets([newDataset, ...savedDatasets]);
      setActiveTab(importTargetCategory);
      setPage(1);
      showNotice(
        `File "${file.name}" (${parsedRows.length.toLocaleString('id-ID')} baris) berhasil diimpor!`
      );
    } catch {
      showNotice('Gagal membaca file. Pastikan format .CSV atau .XLSX valid.');
    } finally {
      e.target.value = '';
    }
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
      if (allSelected) {
        pageIndices.forEach((idx) => next.delete(idx));
      } else {
        pageIndices.forEach((idx) => next.add(idx));
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-medium">
          {feedback}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-sm sm:text-base">
              File & Dataset Tersimpan ({savedDatasets.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Hapus satu file/dataset sekaligus tanpa menghapus baris satu per satu
          </span>
        </div>

        {savedDatasets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedDatasets.map((ds) => {
              const title = getDatasetTitle(ds);
              return (
                <div
                  key={ds.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" title={title}>
                        {title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {CATEGORY_LABELS[ds.category] ?? ds.category} •{' '}
                        <strong>{ds.rows.length.toLocaleString('id-ID')} baris</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Hapus seluruh file "${title}" (${ds.rows.length.toLocaleString('id-ID')} baris)?`
                        )
                      ) {
                        deleteDataset(ds.id);
                        setSelectedIndices(new Set());
                        showNotice(`File "${title}" berhasil dihapus.`);
                      }
                    }}
                    title="Hapus File Ini"
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-2">
            Belum ada file atau catatan database yang tersimpan.
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-wrap gap-1.5">
        {(
          [
            { id: 'sales', label: 'Penjualan' },
            { id: 'finance', label: 'Pembelian' },
            { id: 'inventory', label: 'Produk & Stok' },
            { id: 'employee', label: 'Karyawan' },
            { id: 'import', label: 'Impor Excel / CSV' },
          ] as { id: TabKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-base">Impor File Excel (.XLSX) atau CSV</h3>
          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Masukkan ke Kategori Database:
            </label>
            <select
              value={importTargetCategory}
              onChange={(e) =>
                setImportTargetCategory(
                  e.target.value as 'sales' | 'finance' | 'inventory' | 'employee'
                )
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            >
              <option value="sales">Penjualan</option>
              <option value="finance">Pembelian / Pengeluaran</option>
              <option value="inventory">Produk & Stok</option>
              <option value="employee">Karyawan</option>
            </select>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-8 cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-800/40">
            <Upload className="w-8 h-8 text-emerald-600 mb-2" />
            <span className="text-sm font-semibold">Klik untuk memilih file Excel atau CSV</span>
            <span className="text-xs text-slate-500 mt-1">Mendukung .xlsx, .xls, dan .csv</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => void handleFileUpload(e)}
              className="hidden"
            />
          </label>
        </div>
      )}

      {activeTab === 'sales' && (
        <form
          onSubmit={handleAddSale}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <h3 className="font-bold text-base">Catat Penjualan Baru</h3>
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
              <label className="block text-xs font-semibold mb-1">Nama Produk / Barang</label>
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
                placeholder="Contoh: 65000"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Harga Modal Satuan (Opsional)</label>
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
                {rpFull((Number(saleQty) || 0) * (Number(salePrice) || 0))}
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
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <h3 className="font-bold text-base">Catat Pembelian / Pengeluaran Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
              <label className="block text-xs font-semibold mb-1">Keperluan / Barang Kulakan</label>
              <input
                type="text"
                placeholder="Contoh: Kulakan Minyak Goreng"
                value={buyItem}
                onChange={(e) => setBuyItem(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Supplier / Toko</label>
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
                placeholder="Contoh: 350000"
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
              <span>Simpan Pembelian</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'inventory' && (
        <form
          onSubmit={handleAddProduct}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <h3 className="font-bold text-base">Tambah Produk & Stok</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
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

      {activeTab === 'employee' && (
        <form
          onSubmit={handleAddEmployee}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <h3 className="font-bold text-base">Tambah Data Karyawan</h3>
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

      {activeTab !== 'import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                Daftar {CATEGORY_LABELS[activeTab]} Tersimpan (
                {allRowsWithRef.length.toLocaleString('id-ID')} catatan)
              </h3>
            </div>

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
              placeholder="Cari nama produk, tanggal, atau nominal..."
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
                        <button type="button" onClick={toggleSelectCurrentPage} title="Pilih halaman ini">
                          {paginatedRows.every((_, i) =>
                            selectedIndices.has((safePage - 1) * ROWS_PER_PAGE + i)
                          ) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="p-3">Tanggal / Info</th>
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
                          Object.values(r)[1] ??
                          '-'
                      );
                      const dateOrSub = String(
                        r['Tanggal'] ?? r['Jabatan'] ?? item.datasetName
                      );
                      const detail =
                        activeTab === 'sales'
                          ? `${r['Qty'] ?? 1} unit`
                          : activeTab === 'inventory'
                            ? `Stok: ${r['Stok_Saat_Ini'] ?? 0}`
                            : String(r['Supplier'] ?? r['Jabatan'] ?? '-');

                      const rawAmount =
                        parseNumericValue(
                          r['Total'] ?? r['Nominal'] ?? r['Harga_Jual'] ?? r['Gaji_Bulanan']
                        ) ?? 0;

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
      )}
    </div>
  );
}