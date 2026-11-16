import type { StoredDataset } from '../../context/AppContext';
import { buildUnifiedBusinessSnapshot } from '../analyticsEngine';
import { normalizeBusinessDate } from '../dateUtils';
import { normalizeAndValidateRows, suggestColumnMappings } from '../fileParser';
import { parseNumericValue, toNumber } from '../numberUtils';

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `[GAGAL] ${label}: diharapkan "${String(expected)}", didapat "${String(actual)}"`
    );
  }
}

export function runFinancialAccuracyTests(): string {
  assertEqual(parseNumericValue('Rp 15.000'), 15000, 'Format Rp titik ribuan');
  assertEqual(parseNumericValue('1.250.500,50'), 1250500.5, 'Format Indonesia desimal koma');
  assertEqual(parseNumericValue('25,000.00'), 25000, 'Format Internasional koma ribuan');
  assertEqual(parseNumericValue('(10.000)'), -10000, 'Format akuntansi negatif kurung');
  assertEqual(parseNumericValue('-Rp 5.000'), -5000, 'Format minus Rp');
  assertEqual(toNumber('', 0), 0, 'String kosong kembali ke fallback 0');

  assertEqual(normalizeBusinessDate('20/11/2026'), '2026-11-20', 'Tanggal DD/MM/YYYY');
  assertEqual(normalizeBusinessDate('16 Nov 2026'), '2026-11-16', 'Tanggal bulan teks');
  assertEqual(normalizeBusinessDate(46337), '2026-11-11', 'Serial tanggal Excel');

  const rawHeaders = ['Tanggal', 'Nama_Produk', 'Qty', 'Harga_Satuan', 'Total'];
  const mappings = suggestColumnMappings(rawHeaders, 'sales');
  const validationRun = normalizeAndValidateRows(
    {
      sheetName: 'Penjualan',
      headers: rawHeaders,
      rawRows: [
        {
          Tanggal: '15/11/2026',
          Nama_Produk: 'Beras 5kg',
          Qty: 2,
          Harga_Satuan: 70000,
          Total: 140000,
        },
        {
          Tanggal: '15/11/2026',
          Nama_Produk: 'Beras 5kg',
          Qty: 2,
          Harga_Satuan: 70000,
          Total: 140000,
        },
        { Tanggal: '', Nama_Produk: 'TOTAL', Qty: '', Harga_Satuan: '', Total: 280000 },
      ],
      skippedEmptyRows: 0,
      truncatedByRowLimit: false,
    },
    'sales',
    mappings,
    new Set()
  );
  assertEqual(validationRun.validation.skippedSummaryRows, 1, 'Baris TOTAL dilewati');
  assertEqual(validationRun.validation.duplicateInFileCount, 1, 'Duplikat dalam file terdeteksi');

  const datasets: StoredDataset[] = [
    {
      id: 'inv_1',
      fileName: 'Katalog.xlsx',
      name: 'Katalog.xlsx',
      category: 'inventory',
      columns: ['Nama_Produk', 'Stok_Saat_Ini', 'Stok_Minimum', 'Harga_Modal', 'Harga_Jual'],
      rows: [
        {
          Nama_Produk: 'Minyak 2L',
          Stok_Saat_Ini: 20,
          Stok_Minimum: 5,
          Harga_Modal: 32000,
          Harga_Jual: 36000,
        },
      ],
      uploadedAt: '2026-11-16T00:00:00Z',
    },
    {
      id: 'sal_1',
      fileName: 'Penjualan.xlsx',
      name: 'Penjualan.xlsx',
      category: 'sales',
      columns: ['Tanggal', 'Nama_Produk', 'Qty', 'Harga_Satuan', 'Harga_Modal', 'Total'],
      rows: [
        {
          Tanggal: '2026-11-16',
          Nama_Produk: 'Beras 5kg',
          Qty: 2,
          Harga_Satuan: 70000,
          Harga_Modal: 62000,
          Total: 140000,
        },
        {
          Tanggal: '2026-11-15',
          Nama_Produk: 'Minyak 2L',
          Qty: 3,
          Harga_Satuan: 36000,
          Harga_Modal: 0,
          Total: 108000,
        },
        {
          Tanggal: '2026-11-14',
          Nama_Produk: 'Kerupuk Kaleng',
          Qty: 1,
          Harga_Satuan: 10000,
          Harga_Modal: 0,
          Total: 10000,
        },
      ],
      uploadedAt: '2026-11-16T00:00:00Z',
    },
    {
      id: 'fin_1',
      fileName: 'Kas.xlsx',
      name: 'Kas.xlsx',
      category: 'finance',
      columns: ['Tanggal', 'Nama_Barang_Keperluan', 'Nominal', 'Jenis'],
      rows: [
        {
          Tanggal: '2026-11-16',
          Nama_Barang_Keperluan: 'Kulakan Gas',
          Nominal: 50000,
          Jenis: 'Pengeluaran',
        },
        {
          Tanggal: '2026-11-16',
          Nama_Barang_Keperluan: 'Komisi Agen',
          Nominal: 15000,
          Jenis: 'Pemasukan',
        },
      ],
      uploadedAt: '2026-11-16T00:00:00Z',
    },
  ];

  const snap = buildUnifiedBusinessSnapshot(datasets);
  assertEqual(snap.totalRevenue, 258000, 'Total omzet aktual = 140.000 + 108.000 + 10.000');
  assertEqual(snap.totalActualHpp, 220000, 'Total HPP aktual = 124.000 + 96.000');
  assertEqual(snap.totalGrossProfitActual, 28000, 'Laba kotor aktual = 16.000 + 12.000');
  assertEqual(snap.salesWithoutHppCount, 1, '1 transaksi terdeteksi belum punya data HPP');
  assertEqual(snap.totalExpense, 50000, 'Total pengeluaran kas = 50.000');
  assertEqual(snap.otherIncome, 15000, 'Pemasukan lain kas = 15.000');
  assertEqual(snap.dailyTrend[0].date, '2026-11-14', 'Tanggal paling awal terurut di indeks 0');
  assertEqual(snap.dailyTrend[2].date, '2026-11-16', 'Tanggal terbaru terurut di indeks akhir');

  return 'SELURUH UNIT TEST AKURASI KEUANGAN UMKM LULUS (100% PASS)';
}