import * as XLSX from 'xlsx';
import type { BusinessCategory } from '../context/AppContext';
import { normalizeBusinessDate } from './dateUtils';
import { toNumber } from './numberUtils';

export const MAX_IMPORT_FILE_SIZE_MB = 15;
export const MAX_IMPORT_ROWS_PER_SHEET = 25000;

export interface ColumnMappingField {
  targetField: string;
  label: string;
  required: boolean;
  sourceColumn: string;
}

export interface ParsedSheetData {
  sheetName: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  hasGeneratedHeaders: boolean;
}

export interface ValidationSummary {
  validRowsCount: number;
  skippedSummaryRows: number;
  duplicateInFileCount: number;
  duplicateWithExistingCount: number;
  zeroNominalCount: number;
  warnings: string[];
}

export interface ParsedBusinessFileResult {
  fileName: string;
  sheets: ParsedSheetData[];
  activeSheetName: string;
  detectedCategory: BusinessCategory;
  detectionReason: string;
  mappings: ColumnMappingField[];
}

const STRICT_SUMMARY_LABEL_REGEX =
  /^(\s*(grand\s*)?(sub\s*)?total|jumlah\s*(total|keseluruhan|akhir)|total\s*(penjualan|omzet|bayar|semua|akhir)|rekap(itulasi)?)\s*:?\s*$/i;

function looksLikeDataCell(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number' || val instanceof Date) return true;
  const s = String(val).trim();
  if (!s) return true;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true;
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) return true;
  if (/^-?\d+([.,]\d+)?$/.test(s)) return true;
  return false;
}

function gridToSheetData(sheetName: string, grid: unknown[][]): ParsedSheetData {
  const nonEmptyRows = grid.filter(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
  );

  if (nonEmptyRows.length === 0) {
    return { sheetName, headers: [], rawRows: [], hasGeneratedHeaders: false };
  }

  const firstRow = nonEmptyRows[0];
  const dataLikeCount = firstRow.filter((cell) => looksLikeDataCell(cell)).length;
  const isHeaderless = dataLikeCount >= Math.max(1, Math.ceil(firstRow.length * 0.4));

  const maxCols = Math.max(...nonEmptyRows.slice(0, 50).map((r) => r.length));
  const usedHeaders = new Set<string>();
  const headers: string[] = [];

  for (let c = 0; c < maxCols; c++) {
    let base = isHeaderless
      ? `Kolom_${c + 1}`
      : String(firstRow[c] ?? '').trim() || `Kolom_${c + 1}`;
    let candidate = base;
    let suffix = 2;
    while (usedHeaders.has(candidate.toLowerCase())) {
      candidate = `${base}_${suffix}`;
      suffix++;
    }
    usedHeaders.add(candidate.toLowerCase());
    headers.push(candidate);
  }

  const startRowIdx = isHeaderless ? 0 : 1;
  const dataRowsSlice = nonEmptyRows.slice(startRowIdx, startRowIdx + MAX_IMPORT_ROWS_PER_SHEET);

  const rawRows: Record<string, unknown>[] = dataRowsSlice.map((rowArr) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = rowArr[idx] ?? '';
    });
    return obj;
  });

  return {
    sheetName,
    headers,
    rawRows,
    hasGeneratedHeaders: isHeaderless,
  };
}

export function detectCategoryFromSheet(
  fileName: string,
  headers: string[],
  sampleRows: Record<string, unknown>[] = []
): { category: BusinessCategory; reason: string } {
  const lowerName = fileName.toLowerCase();
  const joinedHeaders = headers.join(' ').toLowerCase();

  if (/(karyawan|gaji|pegawai|employee|payroll|jabatan)/.test(lowerName + ' ' + joinedHeaders)) {
    return {
      category: 'employee',
      reason: 'Terdeteksi sebagai data Karyawan & Gaji.',
    };
  }

  if (
    /(stok|stock|inventaris|inventory|gudang|katalog|stok_tersisa|stok_saat_ini|batas_minimum|stok_minimum)/.test(
      lowerName + ' ' + joinedHeaders
    ) &&
    !/(tanggal|tgl|date|transaksi)/.test(joinedHeaders)
  ) {
    return {
      category: 'inventory',
      reason: 'Terdeteksi sebagai daftar Produk & Stok.',
    };
  }

  if (
    /(pengeluaran|pemasukan|kas|biaya|expense|kulakan|pembelian|supplier|keperluan)/.test(
      lowerName + ' ' + joinedHeaders
    )
  ) {
    return {
      category: 'finance',
      reason: 'Terdeteksi sebagai catatan Pembelian & Arus Kas.',
    };
  }

  if (
    /(penjualan|sales|omzet|jual|kasir|pos|nota|struk|invoice)/.test(
      lowerName + ' ' + joinedHeaders
    )
  ) {
    return {
      category: 'sales',
      reason: 'Terdeteksi sebagai data Transaksi Penjualan.',
    };
  }

  const hasDateInSamples = sampleRows.slice(0, 10).some((r) =>
    Object.values(r).some((v) => Boolean(normalizeBusinessDate(v)))
  );

  if (hasDateInSamples) {
    return {
      category: 'sales',
      reason: 'Memuat tanggal & nominal transaksi sehingga diarahkan ke Penjualan.',
    };
  }

  return {
    category: 'inventory',
    reason: 'Diarahkan ke katalog Produk & Stok (dapat diubah jika perlu).',
  };
}

function findHeaderByKeywords(headers: string[], patterns: RegExp[]): string {
  for (const pat of patterns) {
    const found = headers.find((h) => pat.test(h.trim()));
    if (found) return found;
  }
  return '';
}

function inferColumnsFromSampleValues(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): {
  dateCol: string;
  textCol: string;
  smallIntCol: string;
  amountCol: string;
} {
  const samples = sampleRows.slice(0, 15);
  let dateCol = '';
  let textCol = '';
  let smallIntCol = '';
  let amountCol = '';
  let maxMedianAmount = -1;

  for (const h of headers) {
    const vals = samples.map((r) => r[h]).filter((v) => String(v ?? '').trim() !== '');
    if (vals.length === 0) continue;

    const dateHits = vals.filter((v) => Boolean(normalizeBusinessDate(v))).length;
    if (!dateCol && dateHits >= Math.ceil(vals.length * 0.5)) {
      dateCol = h;
      continue;
    }

    const numericVals = vals
      .map((v) => toNumber(v, Number.NaN))
      .filter((n) => Number.isFinite(n));

    if (numericVals.length >= Math.ceil(vals.length * 0.6)) {
      const sorted = [...numericVals].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const allSmallInts = numericVals.every((n) => Number.isInteger(n) && n >= 1 && n <= 200);
      if (!smallIntCol && allSmallInts && median <= 50) {
        smallIntCol = h;
      } else if (median > maxMedianAmount) {
        maxMedianAmount = median;
        amountCol = h;
      }
      continue;
    }

    if (!textCol) {
      textCol = h;
    }
  }

  return { dateCol, textCol, smallIntCol, amountCol };
}

export function suggestColumnMappings(
  headers: string[],
  category: BusinessCategory,
  sampleRows: Record<string, unknown>[] = []
): ColumnMappingField[] {
  const inferred = inferColumnsFromSampleValues(headers, sampleRows);

  if (category === 'sales') {
    const dateCol =
      findHeaderByKeywords(headers, [/tanggal/i, /tgl/i, /date/i, /waktu/i]) || inferred.dateCol;
    const prodCol =
      findHeaderByKeywords(headers, [
        /nama.*(produk|barang|item|menu)/i,
        /produk/i,
        /barang/i,
        /item/i,
        /menu/i,
      ]) || inferred.textCol;
    const catCol = findHeaderByKeywords(headers, [/kategori/i, /category/i, /jenis/i, /grup/i]);
    const qtyCol =
      findHeaderByKeywords(headers, [/^qty$/i, /jumlah/i, /terjual/i, /kuantitas/i, /unit/i]) ||
      inferred.smallIntCol;
    const priceCol = findHeaderByKeywords(headers, [
      /harga.*(jual|satuan)/i,
      /^harga$/i,
      /price/i,
    ]);
    const costCol = findHeaderByKeywords(headers, [
      /harga.*(modal|beli|pokok)/i,
      /hpp/i,
      /modal/i,
      /cost/i,
    ]);
    const totalCol =
      findHeaderByKeywords(headers, [/total/i, /omzet/i, /subtotal/i, /nominal/i, /amount/i]) ||
      inferred.amountCol;

    return [
      { targetField: 'Tanggal', label: 'Tanggal', required: true, sourceColumn: dateCol },
      { targetField: 'Nama_Produk', label: 'Nama Barang', required: false, sourceColumn: prodCol },
      { targetField: 'Kategori', label: 'Kategori', required: false, sourceColumn: catCol },
      { targetField: 'Qty', label: 'Jumlah (Qty)', required: false, sourceColumn: qtyCol },
      {
        targetField: 'Harga_Satuan',
        label: 'Harga Jual',
        required: false,
        sourceColumn: priceCol,
      },
      {
        targetField: 'Harga_Modal',
        label: 'Harga Modal (HPP)',
        required: false,
        sourceColumn: costCol,
      },
      { targetField: 'Total', label: 'Total Omzet', required: true, sourceColumn: totalCol },
    ];
  }

  if (category === 'inventory') {
    const prodCol =
      findHeaderByKeywords(headers, [
        /nama.*(produk|barang|item)/i,
        /produk/i,
        /barang/i,
        /item/i,
      ]) || inferred.textCol;
    const catCol = findHeaderByKeywords(headers, [/kategori/i, /category/i, /jenis/i]);
    const stockCol =
      findHeaderByKeywords(headers, [/stok.*(tersisa|saat|awal|akhir)/i, /^stok$/i, /stock/i]) ||
      inferred.smallIntCol;
    const minCol = findHeaderByKeywords(headers, [/min/i, /batas/i, /reorder/i]);
    const costCol = findHeaderByKeywords(headers, [
      /harga.*(modal|beli|pokok)/i,
      /hpp/i,
      /modal/i,
    ]);
    const sellCol =
      findHeaderByKeywords(headers, [/harga.*jual/i, /^harga$/i, /price/i]) || inferred.amountCol;

    return [
      { targetField: 'Nama_Produk', label: 'Nama Barang', required: true, sourceColumn: prodCol },
      { targetField: 'Kategori', label: 'Kategori', required: false, sourceColumn: catCol },
      {
        targetField: 'Stok_Saat_Ini',
        label: 'Stok Tersisa',
        required: false,
        sourceColumn: stockCol,
      },
      {
        targetField: 'Stok_Minimum',
        label: 'Batas Minimum',
        required: false,
        sourceColumn: minCol,
      },
      {
        targetField: 'Harga_Modal',
        label: 'Harga Modal',
        required: false,
        sourceColumn: costCol,
      },
      { targetField: 'Harga_Jual', label: 'Harga Jual', required: false, sourceColumn: sellCol },
    ];
  }

  if (category === 'finance') {
    const dateCol =
      findHeaderByKeywords(headers, [/tanggal/i, /tgl/i, /date/i]) || inferred.dateCol;
    const itemCol =
      findHeaderByKeywords(headers, [
        /keterangan/i,
        /keperluan/i,
        /nama.*barang/i,
        /deskripsi/i,
        /uraian/i,
      ]) || inferred.textCol;
    const typeCol = findHeaderByKeywords(headers, [/jenis/i, /tipe/i, /arus/i, /type/i]);
    const supCol = findHeaderByKeywords(headers, [/supplier/i, /pemasok/i, /toko/i, /pihak/i]);
    const nomCol =
      findHeaderByKeywords(headers, [/nominal/i, /jumlah/i, /total/i, /biaya/i, /amount/i]) ||
      inferred.amountCol;

    return [
      { targetField: 'Tanggal', label: 'Tanggal', required: false, sourceColumn: dateCol },
      {
        targetField: 'Nama_Barang_Keperluan',
        label: 'Keterangan',
        required: true,
        sourceColumn: itemCol,
      },
      { targetField: 'Jenis', label: 'Jenis (Masuk/Keluar)', required: false, sourceColumn: typeCol },
      { targetField: 'Supplier', label: 'Supplier / Pihak', required: false, sourceColumn: supCol },
      { targetField: 'Nominal', label: 'Nominal (Rp)', required: true, sourceColumn: nomCol },
    ];
  }

  const nameCol =
    findHeaderByKeywords(headers, [/nama/i, /karyawan/i, /pegawai/i]) || inferred.textCol;
  const roleCol = findHeaderByKeywords(headers, [/jabatan/i, /posisi/i, /role/i, /bagian/i]);
  const salCol =
    findHeaderByKeywords(headers, [/gaji/i, /upah/i, /salary/i, /nominal/i]) || inferred.amountCol;

  return [
    { targetField: 'Nama_Karyawan', label: 'Nama Karyawan', required: true, sourceColumn: nameCol },
    { targetField: 'Jabatan', label: 'Jabatan', required: false, sourceColumn: roleCol },
    { targetField: 'Gaji_Bulanan', label: 'Gaji Bulanan', required: false, sourceColumn: salCol },
  ];
}

export function buildRowSignature(
  category: BusinessCategory,
  row: Record<string, unknown>
): string {
  if (category === 'sales') {
    return [
      'sales',
      String(row['Tanggal'] ?? '').trim().toLowerCase(),
      String(row['Nama_Produk'] ?? '').trim().toLowerCase(),
      toNumber(row['Qty'], 1),
      toNumber(row['Total'], 0),
    ].join('|');
  }
  if (category === 'inventory') {
    return ['inventory', String(row['Nama_Produk'] ?? '').trim().toLowerCase()].join('|');
  }
  if (category === 'finance') {
    return [
      'finance',
      String(row['Tanggal'] ?? '').trim().toLowerCase(),
      String(row['Nama_Barang_Keperluan'] ?? '').trim().toLowerCase(),
      String(row['Jenis'] ?? 'Pengeluaran').trim().toLowerCase(),
      toNumber(row['Nominal'], 0),
    ].join('|');
  }
  return ['employee', String(row['Nama_Karyawan'] ?? '').trim().toLowerCase()].join('|');
}

function isSummaryOrTotalRow(rawRow: Record<string, unknown>): boolean {
  const nonEmptyCells = Object.values(rawRow)
    .map((v) => String(v ?? '').trim())
    .filter((s) => s !== '');

  if (nonEmptyCells.length === 0) return true;

  return nonEmptyCells.some((cell) => STRICT_SUMMARY_LABEL_REGEX.test(cell));
}

export function normalizeAndValidateRows(
  sheet: ParsedSheetData,
  category: BusinessCategory,
  mappings: ColumnMappingField[],
  existingSignatures: Set<string>
): {
  normalizedRows: Record<string, unknown>[];
  validation: ValidationSummary;
} {
  const mapLookup = new Map<string, string>();
  for (const m of mappings) {
    if (m.sourceColumn) {
      mapLookup.set(m.targetField, m.sourceColumn);
    }
  }

  const getVal = (raw: Record<string, unknown>, target: string): unknown => {
    const src = mapLookup.get(target);
    return src ? raw[src] : undefined;
  };

  const normalizedRows: Record<string, unknown>[] = [];
  const seenInFile = new Set<string>();
  const todayIso = new Date().toISOString().slice(0, 10);

  let skippedSummaryRows = 0;
  let duplicateInFileCount = 0;
  let duplicateWithExistingCount = 0;
  let zeroNominalCount = 0;

  for (const raw of sheet.rawRows) {
    if (isSummaryOrTotalRow(raw)) {
      skippedSummaryRows++;
      continue;
    }

    let normalized: Record<string, unknown> | null = null;

    if (category === 'sales') {
      const rawDate = getVal(raw, 'Tanggal');
      const isoDate = normalizeBusinessDate(rawDate) || todayIso;
      const rawName = String(getVal(raw, 'Nama_Produk') ?? '').trim();
      const prodName = rawName || 'Penjualan Umum';
      const catName = String(getVal(raw, 'Kategori') ?? '').trim() || 'Umum';
      const qty = Math.max(1, toNumber(getVal(raw, 'Qty'), 1));
      let price = Math.max(0, toNumber(getVal(raw, 'Harga_Satuan'), 0));
      const cost = Math.max(0, toNumber(getVal(raw, 'Harga_Modal'), 0));
      let total = Math.max(0, toNumber(getVal(raw, 'Total'), 0));

      if (total === 0 && price > 0) total = qty * price;
      if (price === 0 && total > 0) price = Math.round(total / qty);

      if (total === 0 && !rawName) continue;
      if (total === 0) zeroNominalCount++;

      normalized = {
        Tanggal: isoDate,
        Nama_Produk: prodName,
        Kategori: catName,
        Qty: qty,
        Harga_Satuan: price,
        Harga_Modal: cost,
        Total: total,
      };
    } else if (category === 'inventory') {
      const prodName = String(getVal(raw, 'Nama_Produk') ?? '').trim();
      if (!prodName) continue;
      const catName = String(getVal(raw, 'Kategori') ?? '').trim() || 'Umum';
      const stock = Math.max(0, toNumber(getVal(raw, 'Stok_Saat_Ini'), 0));
      const minStock = Math.max(0, toNumber(getVal(raw, 'Stok_Minimum'), 5));
      const cost = Math.max(0, toNumber(getVal(raw, 'Harga_Modal'), 0));
      const sell = Math.max(0, toNumber(getVal(raw, 'Harga_Jual'), 0));

      if (sell === 0) zeroNominalCount++;

      normalized = {
        Nama_Produk: prodName,
        Kategori: catName,
        Stok_Saat_Ini: stock,
        Stok_Minimum: minStock,
        Harga_Modal: cost,
        Harga_Jual: sell,
      };
    } else if (category === 'finance') {
      const isoDate = normalizeBusinessDate(getVal(raw, 'Tanggal')) || todayIso;
      const item = String(getVal(raw, 'Nama_Barang_Keperluan') ?? '').trim();
      const nominal = Math.max(0, toNumber(getVal(raw, 'Nominal'), 0));
      if (!item && nominal === 0) continue;

      const rawType = String(getVal(raw, 'Jenis') ?? '').trim().toLowerCase();
      const jenis = /(masuk|income|terima|pendapatan)/.test(rawType)
        ? 'Pemasukan'
        : 'Pengeluaran';
      const supplier = String(getVal(raw, 'Supplier') ?? '').trim() || '-';

      if (nominal === 0) zeroNominalCount++;

      normalized = {
        Tanggal: isoDate,
        Nama_Barang_Keperluan: item || 'Catatan Kas',
        Supplier: supplier,
        Nominal: nominal,
        Jenis: jenis,
      };
    } else {
      const empName = String(getVal(raw, 'Nama_Karyawan') ?? '').trim();
      if (!empName) continue;
      const role = String(getVal(raw, 'Jabatan') ?? '').trim() || 'Staf';
      const salary = Math.max(0, toNumber(getVal(raw, 'Gaji_Bulanan'), 0));

      normalized = {
        Nama_Karyawan: empName,
        Jabatan: role,
        Gaji_Bulanan: salary,
      };
    }

    const sig = buildRowSignature(category, normalized);
    if (seenInFile.has(sig)) {
      duplicateInFileCount++;
    } else {
      seenInFile.add(sig);
    }

    if (existingSignatures.has(sig)) {
      duplicateWithExistingCount++;
    }

    normalizedRows.push(normalized);
  }

  const warnings: string[] = [];
  if (sheet.hasGeneratedHeaders) {
    warnings.push(
      'File tidak memiliki baris judul kolom di baris pertama, sehingga seluruh baris dibaca sebagai data transaksi.'
    );
  }
  if (skippedSummaryRows > 0) {
    warnings.push(`${skippedSummaryRows.toLocaleString('id-ID')} baris rekap TOTAL dilewati otomatis.`);
  }
  if (duplicateWithExistingCount > 0) {
    warnings.push(
      `${duplicateWithExistingCount.toLocaleString('id-ID')} baris sudah pernah tersimpan sebelumnya (akan digabung tanpa ganda).`
    );
  }

  return {
    normalizedRows,
    validation: {
      validRowsCount: normalizedRows.length,
      skippedSummaryRows,
      duplicateInFileCount,
      duplicateWithExistingCount,
      zeroNominalCount,
      warnings,
    },
  };
}

export async function parseBusinessFile(
  file: File,
  _existingSignatures: Set<string>
): Promise<ParsedBusinessFileResult> {
  const maxBytes = MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Ukuran file melebihi batas maksimal ${MAX_IMPORT_FILE_SIZE_MB} MB.`);
  }

  const lower = file.name.toLowerCase();
  const sheets: ParsedSheetData[] = [];

  if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsedJson: unknown = JSON.parse(text);
    const arr = Array.isArray(parsedJson)
      ? parsedJson
      : parsedJson && typeof parsedJson === 'object' && Array.isArray((parsedJson as { data?: unknown }).data)
        ? (parsedJson as { data: unknown[] }).data
        : [];

    const validObjs = arr.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'
    );
    const headers = validObjs.length > 0 ? Object.keys(validObjs[0]) : [];
    sheets.push({
      sheetName: 'Data_JSON',
      headers,
      rawRows: validObjs.slice(0, MAX_IMPORT_ROWS_PER_SHEET),
      hasGeneratedHeaders: false,
    });
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    for (const sName of workbook.SheetNames) {
      const ws = workbook.Sheets[sName];
      if (!ws) continue;
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const sheetData = gridToSheetData(sName, grid);
      if (sheetData.rawRows.length > 0) {
        sheets.push(sheetData);
      }
    }
  }

  if (sheets.length === 0 || sheets[0].rawRows.length === 0) {
    throw new Error('File kosong atau tidak berisi baris data yang dapat dibaca.');
  }

  const firstSheet = sheets[0];
  const detection = detectCategoryFromSheet(file.name, firstSheet.headers, firstSheet.rawRows);
  const mappings = suggestColumnMappings(
    firstSheet.headers,
    detection.category,
    firstSheet.rawRows
  );

  return {
    fileName: file.name,
    sheets,
    activeSheetName: firstSheet.sheetName,
    detectedCategory: detection.category,
    detectionReason: detection.reason,
    mappings,
  };
}