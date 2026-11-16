import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
  ColumnDataType,
  ColumnProfile,
  ColumnSemanticRole,
  DatasetCategory,
  ParsedDatasetDraft,
  ValidationIssue,
} from '../types/dataset';

export function parseNumericValue(val: unknown): number | null {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val !== 'string') return null;

  const trimmed = val.trim();
  if (!trimmed) return null;

  const noCurrency = trimmed.replace(/^(Rp\.?|IDR|\$|RM)\s*/i, '').trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(noCurrency)) {
    const num = Number(noCurrency.replace(/\./g, '').replace(',', '.'));
    return Number.isNaN(num) ? null : num;
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(noCurrency)) {
    const num = Number(noCurrency.replace(/,/g, ''));
    return Number.isNaN(num) ? null : num;
  }

  const plain = Number(noCurrency.replace(/,/g, '.'));
  return Number.isNaN(plain) ? null : plain;
}

function isLikelyDateString(val: string): boolean {
  const s = val.trim();
  if (!s || s.length < 6 || s.length > 30) return false;
  const datePattern =
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/;
  if (!datePattern.test(s)) return false;
  return !Number.isNaN(Date.parse(s));
}

function detectColumnType(values: unknown[]): ColumnDataType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNull.length === 0) return 'unknown';

  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const val of nonNull) {
    if (typeof val === 'boolean') {
      boolCount++;
    } else if (typeof val === 'number' && !Number.isNaN(val)) {
      numCount++;
    } else if (typeof val === 'string') {
      if (isLikelyDateString(val)) {
        dateCount++;
      } else if (parseNumericValue(val) !== null) {
        numCount++;
      }
    }
  }

  const total = nonNull.length;
  if (dateCount / total >= 0.6) return 'date';
  if (numCount / total >= 0.6) return 'number';
  if (boolCount / total >= 0.6) return 'boolean';
  return 'string';
}

function suggestSemanticRole(
  normalizedName: string,
  dataType: ColumnDataType
): { role: ColumnSemanticRole; confidence: number } {
  const col = normalizedName.toLowerCase();

  if (/(tanggal|tgl|date|waktu|periode|hari)/.test(col)) {
    return { role: 'date', confidence: 0.95 };
  }
  if (/(jenis_transaksi|tipe|arus|mutasi|debit_kredit|jenis)/.test(col)) {
    return { role: 'transaction_type', confidence: 0.85 };
  }
  if (/(stok_min|minimum|min_stock|batas_stok)/.test(col)) {
    return { role: 'stock_min', confidence: 0.92 };
  }
  if (/(stok|stock|sisa_barang|persediaan)/.test(col)) {
    return { role: 'stock_current', confidence: 0.92 };
  }
  if (/(modal|hpp|harga_beli|cost|pokok)/.test(col)) {
    return { role: 'cost_price', confidence: 0.9 };
  }
  if (/(harga_satuan|harga_jual|unit_price|price|harga)/.test(col)) {
    return { role: 'unit_price', confidence: 0.88 };
  }
  if (/(qty|jumlah|kuantitas|terjual|unit|pcs|volume)/.test(col) && dataType === 'number') {
    return { role: 'quantity', confidence: 0.9 };
  }
  if (/(total|omzet|nominal|pendapatan|pengeluaran|subtotal|amount|nilai|bayar)/.test(col)) {
    return { role: 'amount', confidence: 0.92 };
  }
  if (/(produk|barang|item|menu|nama_barang|nama_produk|product)/.test(col)) {
    return { role: 'product_name', confidence: 0.92 };
  }
  if (/(kategori|category|kelompok|grup)/.test(col)) {
    return { role: 'category', confidence: 0.88 };
  }
  if (/(pelanggan|customer|pembeli|client|member)/.test(col)) {
    return { role: 'customer_name', confidence: 0.88 };
  }
  if (/(id|kode|sku|nota|invoice|faktur|trx)/.test(col)) {
    return { role: 'identifier', confidence: 0.85 };
  }
  if (dataType === 'date') return { role: 'date', confidence: 0.7 };
  if (dataType === 'number') return { role: 'amount', confidence: 0.65 };
  return { role: 'text', confidence: 0.6 };
}

function detectDatasetCategory(columns: ColumnProfile[]): DatasetCategory {
  const roles = new Set(columns.map((c) => c.suggestedRole));
  const names = columns.map((c) => c.normalizedName).join(' ');

  if (roles.has('stock_current') || roles.has('stock_min')) return 'inventory';
  if (roles.has('transaction_type') || /(pengeluaran|arus_kas|kas_masuk|kas_keluar)/.test(names)) {
    return 'finance';
  }
  if (/(karyawan|absen|kehadiran|lembur|gaji)/.test(names)) return 'employee';
  if (roles.has('customer_name') && !roles.has('amount') && !roles.has('unit_price')) {
    return 'customer';
  }
  if (roles.has('amount') || roles.has('unit_price') || roles.has('quantity')) {
    return 'sales';
  }
  if (roles.has('product_name')) return 'product';
  return 'unknown';
}

export function profileColumns(
  headers: string[],
  rows: Record<string, unknown>[]
): ColumnProfile[] {
  return headers.map((header) => {
    const values = rows.map((row) => row[header]);
    const nullCount = values.filter(
      (value) => value === null || value === undefined || String(value).trim() === ''
    ).length;
    const normalizedName = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const detectedType = detectColumnType(values);
    const { role, confidence } = suggestSemanticRole(normalizedName, detectedType);

    return {
      originalName: header,
      normalizedName,
      detectedType,
      suggestedRole: role,
      confirmedRole: role,
      nullCount,
      sampleValues: values.filter((value) => value !== null && String(value).trim() !== '').slice(0, 3),
      confidence,
    };
  });
}

function validateRows(rows: Record<string, unknown>[], columns: ColumnProfile[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenHashes = new Set<string>();

  rows.forEach((row, idx) => {
    const hash = JSON.stringify(row);
    if (seenHashes.has(hash)) {
      issues.push({
        rowIndex: idx + 1,
        column: 'Seluruh Baris',
        severity: 'warning',
        message: 'Terdeteksi baris duplikat identik dengan baris sebelumnya.',
      });
    }
    seenHashes.add(hash);

    for (const col of columns) {
      const val = row[col.originalName];
      const isEmpty = val === null || val === undefined || String(val).trim() === '';

      if (isEmpty && ['date', 'amount', 'product_name'].includes(col.suggestedRole)) {
        issues.push({
          rowIndex: idx + 1,
          column: col.originalName,
          severity: 'warning',
          message: `Kolom penting "${col.originalName}" kosong pada baris ke-${idx + 1}.`,
        });
      } else if (!isEmpty && col.detectedType === 'number' && parseNumericValue(val) === null) {
        issues.push({
          rowIndex: idx + 1,
          column: col.originalName,
          severity: 'error',
          message: `Nilai "${String(val)}" bukan angka yang valid.`,
        });
      }
    }
  });

  return issues.slice(0, 50);
}

function buildDraftFromRows(
  file: File,
  rawRows: Record<string, unknown>[],
  sheetName?: string
): ParsedDatasetDraft {
  const normalizedRows = rawRows
    .map((r) => {
      const cleanObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        cleanObj[k.trim()] = v;
      }
      return cleanObj;
    })
    .filter((r) =>
      Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== '')
    );

  const headers = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
  const columns = profileColumns(headers, normalizedRows);

  const detectedCategory = detectDatasetCategory(columns);
  const issues = validateRows(normalizedRows, columns);

  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fileName: file.name,
    fileSize: file.size,
    sheetName,
    detectedCategory,
    confirmedCategory: detectedCategory,
    totalRows: normalizedRows.length,
    columns,
    rows: normalizedRows,
    issues,
    createdAt: new Date().toISOString(),
  };
}

export async function parseBusinessFile(file: File): Promise<ParsedDatasetDraft> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            reject(new Error('File CSV kosong atau tidak memiliki baris data.'));
            return;
          }
          resolve(buildDraftFromRows(file, results.data));
        },
        error: (err) => reject(new Error(`Gagal membaca CSV: ${err.message}`)),
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('File Excel tidak memiliki sheet yang dapat dibaca.');
    const sheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
    if (rows.length === 0) throw new Error('Sheet pertama pada file Excel kosong.');
    return buildDraftFromRows(file, rows, firstSheet);
  }

  if (ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
    if (rows.length === 0) throw new Error('Format JSON harus berupa array objek data.');
    return buildDraftFromRows(file, rows);
  }

  throw new Error('Format file belum didukung. Gunakan CSV, XLSX, XLS, atau JSON.');
}

export function downloadSampleWarungCsv() {
  const sampleCsv = [
    'Tanggal,Kode_Nota,Nama_Produk,Kategori,Qty,Harga_Modal,Harga_Jual,Total',
    '2026-11-10,TRX-001,Beras Pandan Wangi 5kg,Sembako,3,62000,72000,216000',
    '2026-11-10,TRX-002,Minyak Goreng Bimoli 2L,Sembako,5,31000,36000,180000',
    '2026-11-10,TRX-003,Telur Ayam Negeri 1kg,Bahan Pokok,8,24000,28000,224000',
    '2026-11-11,TRX-004,Gula Pasir Gulaku 1kg,Sembako,6,14500,17500,105000',
    '2026-11-11,TRX-005,Kopi Kapal Api Renteng,Minuman,10,11000,14000,140000',
    '2026-11-12,TRX-006,Indomie Goreng Dus,Makanan Instan,2,108000,120000,240000',
    '2026-11-12,TRX-007,Gas LPG 3kg,Energi,7,18500,22000,154000',
    '2026-11-13,TRX-008,Minyak Goreng Bimoli 2L,Sembako,6,31000,36000,216000',
    '2026-11-14,TRX-009,Beras Pandan Wangi 5kg,Sembako,4,62000,72000,288000',
    '2026-11-15,TRX-010,Telur Ayam Negeri 1kg,Bahan Pokok,10,24000,28000,280000',
  ].join('\n');

  const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'contoh-penjualan-warung.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}