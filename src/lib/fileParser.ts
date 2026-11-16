import * as XLSX from 'xlsx';
import { normalizeBusinessDate } from './dateUtils';
import { isSummaryLabel, parseNumericValue, toNumber } from './numberUtils';

export { parseNumericValue, toNumber };

export type DatasetCategory = 'sales' | 'finance' | 'inventory' | 'employee' | 'general';
export type BusinessCategory = Exclude<DatasetCategory, 'general'>;
export type ImportMode = 'merge' | 'append' | 'replace';

export const MAX_IMPORT_FILE_SIZE_MB = 15;
export const MAX_IMPORT_ROWS_PER_SHEET = 25_000;

export interface ColumnMappingField {
  targetField: string;
  label: string;
  sourceColumn: string;
  required?: boolean;
}

export interface ValidationReport {
  totalRawRows: number;
  validRowsCount: number;
  skippedEmptyRows: number;
  skippedSummaryRows: number;
  duplicateInFileCount: number;
  duplicateWithExistingCount: number;
  missingHppCount: number;
  zeroNominalCount: number;
  truncatedByRowLimit: boolean;
  warnings: string[];
}

export interface ParsedSheetBundle {
  sheetName: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  skippedEmptyRows: number;
  truncatedByRowLimit: boolean;
}

export interface ParsedBusinessFileResult {
  fileName: string;
  fileSizeBytes: number;
  format: 'csv' | 'xls' | 'xlsx' | 'json';
  sheets: ParsedSheetBundle[];
  activeSheetName: string;
  detectedCategory: BusinessCategory;
  detectionReason: string;
  mappings: ColumnMappingField[];
  normalizedRows: Record<string, unknown>[];
  validation: ValidationReport;
}

export interface DatasetDetectionResult {
  detectedCategory: BusinessCategory;
  confidence: 'Tinggi' | 'Sedang';
  reason: string;
  matchedColumns: string[];
  rawRows: Record<string, unknown>[];
  normalizedRows: Record<string, unknown>[];
}

const TARGET_FIELDS_BY_CATEGORY: Record<
  BusinessCategory,
  { field: string; label: string; aliases: string[]; required?: boolean }[]
> = {
  inventory: [
    {
      field: 'Nama_Produk',
      label: 'Nama Produk',
      aliases: ['nama_produk', 'nama_barang', 'produk', 'barang', 'item', 'product_name', 'nama'],
      required: true,
    },
    {
      field: 'Kategori',
      label: 'Kategori',
      aliases: ['kategori', 'jenis', 'golongan', 'category', 'grup'],
    },
    {
      field: 'Stok_Saat_Ini',
      label: 'Stok Saat Ini',
      aliases: ['stok_saat_ini', 'sisa_stok', 'stok_akhir', 'stok_awal', 'stok', 'stock', 'qty'],
    },
    {
      field: 'Stok_Minimum',
      label: 'Stok Minimum',
      aliases: ['stok_minimum', 'stok_min', 'min_stok', 'batas_aman', 'minimum'],
    },
    {
      field: 'Harga_Modal',
      label: 'Harga Modal / Beli',
      aliases: ['harga_modal', 'harga_beli', 'hpp', 'modal', 'cost', 'beli'],
    },
    {
      field: 'Harga_Jual',
      label: 'Harga Jual',
      aliases: ['harga_jual', 'harga_satuan', 'harga', 'price', 'jual'],
    },
  ],
  sales: [
    {
      field: 'Tanggal',
      label: 'Tanggal Transaksi',
      aliases: ['tanggal', 'tgl', 'date', 'waktu', 'created_at'],
      required: true,
    },
    {
      field: 'Nama_Produk',
      label: 'Nama Produk',
      aliases: ['nama_produk', 'nama_barang', 'produk', 'barang', 'item', 'nama'],
      required: true,
    },
    {
      field: 'Kategori',
      label: 'Kategori',
      aliases: ['kategori', 'jenis', 'category'],
    },
    {
      field: 'Qty',
      label: 'Jumlah (Qty)',
      aliases: ['qty', 'jumlah', 'terjual', 'kuantitas', 'unit'],
    },
    {
      field: 'Harga_Satuan',
      label: 'Harga Satuan',
      aliases: ['harga_satuan', 'harga_jual', 'harga', 'price'],
    },
    {
      field: 'Harga_Modal',
      label: 'Harga Modal (HPP)',
      aliases: ['harga_modal', 'hpp', 'modal', 'harga_beli'],
    },
    {
      field: 'Total',
      label: 'Total Omzet',
      aliases: ['total', 'subtotal', 'omzet', 'jumlah_harga', 'nominal', 'pendapatan'],
    },
  ],
  finance: [
    {
      field: 'Tanggal',
      label: 'Tanggal',
      aliases: ['tanggal', 'tgl', 'date', 'waktu'],
      required: true,
    },
    {
      field: 'Nama_Barang_Keperluan',
      label: 'Keterangan / Keperluan',
      aliases: [
        'nama_barang_keperluan',
        'keperluan',
        'keterangan',
        'deskripsi',
        'nama_barang',
        'item',
        'nama',
      ],
      required: true,
    },
    {
      field: 'Jenis',
      label: 'Jenis Arus (Masuk/Keluar)',
      aliases: ['jenis', 'tipe', 'arus', 'mutasi', 'kategori_kas', 'type'],
    },
    {
      field: 'Supplier',
      label: 'Supplier / Pihak',
      aliases: ['supplier', 'pemasok', 'vendor', 'toko', 'pihak'],
    },
    {
      field: 'Nominal',
      label: 'Nominal (Rp)',
      aliases: ['nominal', 'total', 'jumlah', 'biaya', 'pengeluaran', 'pemasukan', 'harga'],
      required: true,
    },
  ],
  employee: [
    {
      field: 'Nama_Karyawan',
      label: 'Nama Karyawan',
      aliases: ['nama_karyawan', 'nama_pegawai', 'karyawan', 'pegawai', 'staf', 'nama'],
      required: true,
    },
    {
      field: 'Jabatan',
      label: 'Jabatan',
      aliases: ['jabatan', 'posisi', 'divisi', 'bagian', 'role'],
    },
    {
      field: 'Gaji_Bulanan',
      label: 'Gaji Bulanan',
      aliases: ['gaji_bulanan', 'gaji', 'upah', 'salary', 'nominal'],
    },
  ],
};

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildRowSignature(
  category: BusinessCategory,
  row: Record<string, unknown>
): string {
  if (category === 'inventory') {
    return `inv:${String(row['Nama_Produk'] ?? '').trim().toLowerCase()}`;
  }
  if (category === 'sales') {
    const tgl = normalizeBusinessDate(row['Tanggal']);
    const prod = String(row['Nama_Produk'] ?? '').trim().toLowerCase();
    const qty = toNumber(row['Qty'], 1);
    const total = toNumber(row['Total'], 0);
    return `sal:${tgl}|${prod}|${qty}|${total}`;
  }
  if (category === 'finance') {
    const tgl = normalizeBusinessDate(row['Tanggal']);
    const desc = String(row['Nama_Barang_Keperluan'] ?? '').trim().toLowerCase();
    const nom = toNumber(row['Nominal'], 0);
    const jenis = String(row['Jenis'] ?? '').trim().toLowerCase();
    return `fin:${tgl}|${desc}|${jenis}|${nom}`;
  }
  const emp = String(row['Nama_Karyawan'] ?? '').trim().toLowerCase();
  const role = String(row['Jabatan'] ?? '').trim().toLowerCase();
  return `emp:${emp}|${role}`;
}

export function detectCategoryFromSheet(
  fileName: string,
  headers: string[]
): { category: BusinessCategory; reason: string } {
  const lowerFile = fileName.toLowerCase();
  const normHeaders = headers.map(normalizeKey);

  const scores: Record<BusinessCategory, number> = {
    inventory: 0,
    sales: 0,
    finance: 0,
    employee: 0,
  };

  if (/(produk|barang|stok|stock|gudang|katalog|inventaris|inventory|master)/.test(lowerFile)) {
    scores.inventory += 7;
  }
  if (/(jual|penjualan|sales|transaksi|kasir|omzet|pos)/.test(lowerFile)) {
    scores.sales += 7;
  }
  if (/(beli|pembelian|kulakan|pengeluaran|biaya|kas|keuangan|finance)/.test(lowerFile)) {
    scores.finance += 7;
  }
  if (/(karyawan|pegawai|gaji|sdm|staff|staf|employee)/.test(lowerFile)) {
    scores.employee += 7;
  }

  const hasDate = normHeaders.some((h) => /(tanggal|tgl|date|waktu)/.test(h));
  const hasStock = normHeaders.some((h) => /(stok|stock|sisa|min_stok|stok_min|sku|barcode)/.test(h));
  const hasCostAndSell =
    normHeaders.some((h) => /(modal|beli|hpp|cost)/.test(h)) &&
    normHeaders.some((h) => /(jual|price|harga)/.test(h));
  const hasSalesTotal = normHeaders.some((h) =>
    /(total|subtotal|omzet|nota|invoice|terjual)/.test(h)
  );
  const hasFinanceCol = normHeaders.some((h) =>
    /(supplier|pemasok|keperluan|pengeluaran|pemasukan|debit|kredit|mutasi|biaya)/.test(h)
  );
  const hasEmpCol = normHeaders.some((h) =>
    /(karyawan|pegawai|jabatan|posisi|gaji|upah|salary)/.test(h)
  );

  if (hasStock) scores.inventory += 9;
  if (hasCostAndSell) scores.inventory += 6;
  if (!hasDate && normHeaders.some((h) => /(produk|barang|item|nama)/.test(h))) {
    scores.inventory += 5;
  }

  if (hasDate && hasSalesTotal) scores.sales += 9;
  if (normHeaders.some((h) => /(terjual|nota|invoice|kasir)/.test(h))) scores.sales += 7;

  if (hasFinanceCol) scores.finance += 9;
  if (hasDate && normHeaders.some((h) => /(nominal|debit|kredit)/.test(h))) scores.finance += 5;

  if (hasEmpCol) scores.employee += 10;

  let winner: BusinessCategory = 'inventory';
  let maxScore = -1;
  (Object.keys(scores) as BusinessCategory[]).forEach((cat) => {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      winner = cat;
    }
  });

  const reasons: Record<BusinessCategory, string> = {
    inventory: 'Kolom stok/daftar barang terdeteksi otomatis sebagai Produk & Stok.',
    sales: 'Kolom tanggal & nominal transaksi terdeteksi otomatis sebagai Penjualan.',
    finance: 'Kolom kas/supplier/pengeluaran terdeteksi otomatis sebagai Pembelian & Kas.',
    employee: 'Kolom staf/jabatan/gaji terdeteksi otomatis sebagai Data Karyawan.',
  };

  return { category: winner, reason: reasons[winner] };
}

export function suggestColumnMappings(
  headers: string[],
  category: BusinessCategory
): ColumnMappingField[] {
  const normHeaderMap = new Map<string, string>();
  headers.forEach((h) => {
    normHeaderMap.set(normalizeKey(h), h);
  });

  return TARGET_FIELDS_BY_CATEGORY[category].map((spec) => {
    let matchedSource = '';
    for (const alias of spec.aliases) {
      const exact = normHeaderMap.get(alias);
      if (exact) {
        matchedSource = exact;
        break;
      }
    }
    if (!matchedSource) {
      for (const [normH, origH] of normHeaderMap.entries()) {
        if (spec.aliases.some((a) => normH.includes(a))) {
          matchedSource = origH;
          break;
        }
      }
    }
    return {
      targetField: spec.field,
      label: spec.label,
      sourceColumn: matchedSource,
      required: spec.required,
    };
  });
}

function classifyCashflowDirection(rawType: unknown): 'Pemasukan' | 'Pengeluaran' {
  const text = String(rawType ?? '').trim().toLowerCase();
  if (/(masuk|pemasukan|income|debit|terima|pendapatan|\bin\b)/.test(text)) {
    return 'Pemasukan';
  }
  return 'Pengeluaran';
}

export function normalizeAndValidateRows(
  sheet: ParsedSheetBundle,
  category: BusinessCategory,
  mappings: ColumnMappingField[],
  existingSignatures: Set<string>
): { normalizedRows: Record<string, unknown>[]; validation: ValidationReport } {
  const mapByTarget = new Map<string, string>();
  mappings.forEach((m) => {
    if (m.sourceColumn) mapByTarget.set(m.targetField, m.sourceColumn);
  });

  const getVal = (row: Record<string, unknown>, targetField: string): unknown => {
    const src = mapByTarget.get(targetField);
    return src ? row[src] : undefined;
  };

  let skippedSummaryRows = 0;
  let duplicateInFileCount = 0;
  let duplicateWithExistingCount = 0;
  let missingHppCount = 0;
  let zeroNominalCount = 0;

  const seenInFile = new Set<string>();
  const normalizedRows: Record<string, unknown>[] = [];
  const todayIso = new Date().toISOString().slice(0, 10);

  for (const rawRow of sheet.rawRows) {
    const firstFewTexts = Object.values(rawRow).slice(0, 3);
    if (firstFewTexts.some((v) => isSummaryLabel(v))) {
      skippedSummaryRows += 1;
      continue;
    }

    let normalized: Record<string, unknown>;

    if (category === 'inventory') {
      const nama = String(getVal(rawRow, 'Nama_Produk') ?? '').trim();
      if (!nama || isSummaryLabel(nama)) {
        skippedSummaryRows += 1;
        continue;
      }
      const kategori = String(getVal(rawRow, 'Kategori') ?? 'Umum').trim() || 'Umum';
      const stok = toNumber(getVal(rawRow, 'Stok_Saat_Ini'), 0);
      const minStok = toNumber(getVal(rawRow, 'Stok_Minimum'), 5);
      const modal = toNumber(getVal(rawRow, 'Harga_Modal'), 0);
      const jual = toNumber(getVal(rawRow, 'Harga_Jual'), 0);

      if (jual <= 0) zeroNominalCount += 1;

      normalized = {
        Nama_Produk: nama,
        Kategori: kategori,
        Stok_Saat_Ini: stok,
        Stok_Minimum: minStok,
        Harga_Modal: modal,
        Harga_Jual: jual,
      };
    } else if (category === 'sales') {
      const nama = String(getVal(rawRow, 'Nama_Produk') ?? '').trim();
      if (!nama || isSummaryLabel(nama)) {
        skippedSummaryRows += 1;
        continue;
      }
      const rawDate = getVal(rawRow, 'Tanggal');
      const tgl = normalizeBusinessDate(rawDate) || todayIso;
      const kategori = String(getVal(rawRow, 'Kategori') ?? 'Umum').trim() || 'Umum';
      const qty = Math.max(1, toNumber(getVal(rawRow, 'Qty'), 1));
      const hargaSatuan = toNumber(getVal(rawRow, 'Harga_Satuan'), 0);
      const hargaModal = toNumber(getVal(rawRow, 'Harga_Modal'), 0);
      const rawTotal = parseNumericValue(getVal(rawRow, 'Total'));
      const total = rawTotal !== null && rawTotal > 0 ? rawTotal : qty * hargaSatuan;

      if (total <= 0) zeroNominalCount += 1;
      if (hargaModal <= 0) missingHppCount += 1;

      normalized = {
        Tanggal: tgl,
        Nama_Produk: nama,
        Kategori: kategori,
        Qty: qty,
        Harga_Satuan: hargaSatuan > 0 ? hargaSatuan : qty > 0 ? Math.round(total / qty) : 0,
        Harga_Modal: hargaModal,
        Total: total,
      };
    } else if (category === 'finance') {
      const keperluan = String(getVal(rawRow, 'Nama_Barang_Keperluan') ?? '').trim();
      if (!keperluan || isSummaryLabel(keperluan)) {
        skippedSummaryRows += 1;
        continue;
      }
      const tgl = normalizeBusinessDate(getVal(rawRow, 'Tanggal')) || todayIso;
      const supplier = String(getVal(rawRow, 'Supplier') ?? '-').trim() || '-';
      const jenis = classifyCashflowDirection(getVal(rawRow, 'Jenis'));
      const nominal = Math.abs(toNumber(getVal(rawRow, 'Nominal'), 0));

      if (nominal <= 0) zeroNominalCount += 1;

      normalized = {
        Tanggal: tgl,
        Nama_Barang_Keperluan: keperluan,
        Supplier: supplier,
        Nominal: nominal,
        Jenis: jenis,
      };
    } else {
      const namaEmp = String(getVal(rawRow, 'Nama_Karyawan') ?? '').trim();
      if (!namaEmp || isSummaryLabel(namaEmp)) {
        skippedSummaryRows += 1;
        continue;
      }
      const jabatan = String(getVal(rawRow, 'Jabatan') ?? 'Staf').trim() || 'Staf';
      const gaji = Math.abs(toNumber(getVal(rawRow, 'Gaji_Bulanan'), 0));

      normalized = {
        Nama_Karyawan: namaEmp,
        Jabatan: jabatan,
        Gaji_Bulanan: gaji,
      };
    }

    const sig = buildRowSignature(category, normalized);
    if (seenInFile.has(sig)) {
      duplicateInFileCount += 1;
    } else {
      seenInFile.add(sig);
    }
    if (existingSignatures.has(sig)) {
      duplicateWithExistingCount += 1;
    }

    normalizedRows.push(normalized);
  }

  const warnings: string[] = [];
  if (sheet.truncatedByRowLimit) {
    warnings.push(
      `File dibatasi maksimal ${MAX_IMPORT_ROWS_PER_SHEET.toLocaleString('id-ID')} baris pertama agar browser & laptop tetap ringan.`
    );
  }
  if (skippedSummaryRows > 0) {
    warnings.push(
      `${skippedSummaryRows.toLocaleString('id-ID')} baris rekap (TOTAL / SUBTOTAL) dilewati otomatis agar angka tidak terhitung ganda.`
    );
  }
  if (duplicateInFileCount > 0) {
    warnings.push(
      `Terdeteksi ${duplicateInFileCount.toLocaleString('id-ID')} baris duplikat di dalam file.`
    );
  }
  if (duplicateWithExistingCount > 0) {
    warnings.push(
      `${duplicateWithExistingCount.toLocaleString('id-ID')} baris sudah ada di database (mode Merge akan mencegah duplikasi).`
    );
  }
  if (category === 'sales' && missingHppCount > 0) {
    warnings.push(
      `${missingHppCount.toLocaleString('id-ID')} transaksi belum memiliki kolom Harga Modal (sistem mencocokkan HPP dari katalog Produk & Stok jika tersedia).`
    );
  }
  if (zeroNominalCount > 0) {
    warnings.push(`${zeroNominalCount.toLocaleString('id-ID')} baris memiliki nominal Rp 0.`);
  }

  return {
    normalizedRows,
    validation: {
      totalRawRows: sheet.rawRows.length + sheet.skippedEmptyRows,
      validRowsCount: normalizedRows.length,
      skippedEmptyRows: sheet.skippedEmptyRows,
      skippedSummaryRows,
      duplicateInFileCount,
      duplicateWithExistingCount,
      missingHppCount,
      zeroNominalCount,
      truncatedByRowLimit: sheet.truncatedByRowLimit,
      warnings,
    },
  };
}

function parseCsvToMatrix(rawText: string): unknown[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  if (!text.trim()) return [];

  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;

  const delimiter =
    semiCount > commaCount && semiCount >= tabCount
      ? ';'
      : tabCount > commaCount
        ? '\t'
        : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

function cleanMatrixToSheetBundle(sheetName: string, matrix: unknown[][]): ParsedSheetBundle {
  if (matrix.length < 2) {
    return {
      sheetName,
      headers: [],
      rawRows: [],
      skippedEmptyRows: 0,
      truncatedByRowLimit: false,
    };
  }

  let headerIdx = 0;
  let maxCols = 0;
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    const filled = (matrix[i] ?? []).filter((c) => String(c ?? '').trim() !== '').length;
    if (filled > maxCols) {
      maxCols = filled;
      headerIdx = i;
    }
  }

  const headers = (matrix[headerIdx] ?? []).map((h, idx) => {
    const label = String(h ?? '').trim();
    return label || `Kolom_${idx + 1}`;
  });

  const rawRows: Record<string, unknown>[] = [];
  let skippedEmptyRows = 0;
  let truncatedByRowLimit = false;

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? [];
    const hasContent = cells.some((c) => String(c ?? '').trim() !== '');
    if (!hasContent) {
      skippedEmptyRows += 1;
      continue;
    }
    if (rawRows.length >= MAX_IMPORT_ROWS_PER_SHEET) {
      truncatedByRowLimit = true;
      break;
    }
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    rawRows.push(obj);
  }

  return {
    sheetName,
    headers,
    rawRows,
    skippedEmptyRows,
    truncatedByRowLimit,
  };
}

export async function parseBusinessFile(
  file: File,
  existingSignatures: Set<string> = new Set()
): Promise<ParsedBusinessFileResult> {
  if (file.size === 0) {
    throw new Error('File kosong (0 byte). Pilih file yang berisi data.');
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_IMPORT_FILE_SIZE_MB) {
    throw new Error(
      `Ukuran file (${sizeMb.toFixed(1)} MB) melebihi batas aman ${MAX_IMPORT_FILE_SIZE_MB} MB. Bagi file menjadi beberapa bagian agar laptop tidak lambat.`
    );
  }

  const lower = file.name.toLowerCase();
  let format: ParsedBusinessFileResult['format'];
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) format = 'csv';
  else if (lower.endsWith('.xlsx')) format = 'xlsx';
  else if (lower.endsWith('.xls')) format = 'xls';
  else if (lower.endsWith('.json')) format = 'json';
  else {
    throw new Error('Format file tidak didukung. Gunakan file .CSV, .XLS, .XLSX, atau .JSON.');
  }

  const sheets: ParsedSheetBundle[] = [];

  if (format === 'csv') {
    const text = await file.text();
    sheets.push(cleanMatrixToSheetBundle('CSV Data', parseCsvToMatrix(text)));
  } else if (format === 'json') {
    const text = await file.text();
    const parsedJson = JSON.parse(text) as unknown;
    const arr = Array.isArray(parsedJson)
      ? parsedJson
      : typeof parsedJson === 'object' &&
          parsedJson !== null &&
          Array.isArray((parsedJson as Record<string, unknown>).data)
        ? ((parsedJson as Record<string, unknown>).data as unknown[])
        : [];

    const objectRows = arr.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
    );
    const headers = objectRows.length > 0 ? Object.keys(objectRows[0]) : [];
    const truncated = objectRows.length > MAX_IMPORT_ROWS_PER_SHEET;

    sheets.push({
      sheetName: 'JSON Data',
      headers,
      rawRows: objectRows.slice(0, MAX_IMPORT_ROWS_PER_SHEET),
      skippedEmptyRows: 0,
      truncatedByRowLimit: truncated,
    });
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    for (const name of workbook.SheetNames) {
      const ws = workbook.Sheets[name];
      if (!ws) continue;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const bundle = cleanMatrixToSheetBundle(name, matrix);
      if (bundle.rawRows.length > 0) {
        sheets.push(bundle);
      }
    }
  }

  const validSheets = sheets.filter((s) => s.rawRows.length > 0);
  if (validSheets.length === 0) {
    throw new Error('Tidak ditemukan baris data yang dapat dibaca di dalam file ini.');
  }

  const activeSheet = validSheets[0];
  const { category, reason } = detectCategoryFromSheet(file.name, activeSheet.headers);
  const mappings = suggestColumnMappings(activeSheet.headers, category);
  const { normalizedRows, validation } = normalizeAndValidateRows(
    activeSheet,
    category,
    mappings,
    existingSignatures
  );

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    format,
    sheets: validSheets,
    activeSheetName: activeSheet.sheetName,
    detectedCategory: category,
    detectionReason: reason,
    mappings,
    normalizedRows,
    validation,
  };
}

export async function parseSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
  const res = await parseBusinessFile(file);
  return res.normalizedRows;
}

export function detectCategoryAndNormalize(
  fileName: string,
  rawRows: Record<string, unknown>[]
): DatasetDetectionResult {
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const { category, reason } = detectCategoryFromSheet(fileName, headers);
  const mappings = suggestColumnMappings(headers, category);
  const bundle: ParsedSheetBundle = {
    sheetName: 'Sheet1',
    headers,
    rawRows,
    skippedEmptyRows: 0,
    truncatedByRowLimit: false,
  };
  const { normalizedRows } = normalizeAndValidateRows(bundle, category, mappings, new Set());
  return {
    detectedCategory: category,
    confidence: 'Tinggi',
    reason,
    matchedColumns: headers.slice(0, 6),
    rawRows,
    normalizedRows,
  };
}

export function reNormalizeRowsForCategory(
  rawRows: Record<string, unknown>[],
  category: BusinessCategory
): Record<string, unknown>[] {
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const mappings = suggestColumnMappings(headers, category);
  const bundle: ParsedSheetBundle = {
    sheetName: 'Sheet1',
    headers,
    rawRows,
    skippedEmptyRows: 0,
    truncatedByRowLimit: false,
  };
  return normalizeAndValidateRows(bundle, category, mappings, new Set()).normalizedRows;
}