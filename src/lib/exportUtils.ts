import * as XLSX from 'xlsx';
import type { StoredDataset } from '../context/AppContext';
import type { UnifiedBusinessSnapshot } from './analyticsEngine';
import { formatFullRupiah } from './formatters';

function sanitizeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'usaha_umkm'
  );
}

function triggerCsvDownload(fileName: string, headers: string[], rows: (string | number)[][]): void {
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      r
        .map((cell) => {
          const str = String(cell ?? '');
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(',')
    ),
  ];

  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSampleSalesCsv(): void {
  triggerCsvDownload(
    'Contoh_Penjualan_UMKM.csv',
    ['Tanggal', 'Nama_Barang', 'Kategori', 'Jumlah', 'Harga_Jual', 'Harga_Modal', 'Total'],
    [
      ['2026-11-15', 'Beras Pandan Wangi 5kg', 'Sembako', 3, 75000, 66000, 225000],
      ['2026-11-15', 'Minyak Goreng 2L', 'Sembako', 5, 36000, 32000, 180000],
      ['2026-11-16', 'Gula Pasir 1kg', 'Sembako', 6, 17500, 15000, 105000],
      ['2026-11-16', 'Telur Ayam 1kg', 'Bahan Pokok', 4, 28000, 24500, 112000],
      ['2026-11-17', 'Kopi Sachet Renteng', 'Minuman', 8, 15000, 12500, 120000],
    ]
  );
}

export function downloadSampleInventoryCsv(): void {
  triggerCsvDownload(
    'Contoh_Stok_Barang_UMKM.csv',
    ['Nama_Barang', 'Kategori', 'Stok_Tersisa', 'Batas_Minimum', 'Harga_Modal', 'Harga_Jual'],
    [
      ['Beras Pandan Wangi 5kg', 'Sembako', 20, 5, 66000, 75000],
      ['Minyak Goreng 2L', 'Sembako', 4, 6, 32000, 36000],
      ['Gula Pasir 1kg', 'Sembako', 18, 5, 15000, 17500],
      ['Telur Ayam 1kg', 'Bahan Pokok', 3, 5, 24500, 28000],
      ['Kopi Sachet Renteng', 'Minuman', 15, 4, 12500, 15000],
    ]
  );
}

export function downloadSampleFinanceCsv(): void {
  triggerCsvDownload(
    'Contoh_Pengeluaran_Kas_UMKM.csv',
    ['Tanggal', 'Keterangan', 'Jenis', 'Supplier', 'Nominal'],
    [
      ['2026-11-14', 'Kulakan Minyak Goreng 1 Dus', 'Pengeluaran', 'Agen Sembako Jaya', 384000],
      ['2026-11-15', 'Bayar Listrik & Air Toko', 'Pengeluaran', 'PLN / PDAM', 250000],
      ['2026-11-16', 'Kulakan Beras 10 Karung', 'Pengeluaran', 'UD Sumber Pangan', 3300000],
      ['2026-11-17', 'Bonus Cashback Distributor', 'Pemasukan', 'PT Pangan Makmur', 75000],
    ]
  );
}

export function downloadUmkmTemplateXlsx(): void {
  const wb = XLSX.utils.book_new();

  const salesTemplate = [
    {
      Tanggal: '2026-11-16',
      Nama_Barang: 'Beras Pandan Wangi 5kg',
      Kategori: 'Sembako',
      Jumlah: 2,
      Harga_Jual: 75000,
      Harga_Modal: 66000,
      Total: 150000,
    },
    {
      Tanggal: '2026-11-16',
      Nama_Barang: 'Minyak Goreng 2L',
      Kategori: 'Sembako',
      Jumlah: 3,
      Harga_Jual: 36000,
      Harga_Modal: 32000,
      Total: 108000,
    },
  ];

  const inventoryTemplate = [
    {
      Nama_Barang: 'Beras Pandan Wangi 5kg',
      Kategori: 'Sembako',
      Stok_Tersisa: 25,
      Batas_Minimum: 5,
      Harga_Modal: 66000,
      Harga_Jual: 75000,
    },
    {
      Nama_Barang: 'Minyak Goreng 2L',
      Kategori: 'Sembako',
      Stok_Tersisa: 4,
      Batas_Minimum: 6,
      Harga_Modal: 32000,
      Harga_Jual: 36000,
    },
  ];

  const financeTemplate = [
    {
      Tanggal: '2026-11-16',
      Keterangan: 'Kulakan Minyak Goreng 1 Dus',
      Jenis: 'Pengeluaran',
      Supplier: 'Agen Sembako Jaya',
      Nominal: 384000,
    },
    {
      Tanggal: '2026-11-16',
      Keterangan: 'Bonus Penjualan Distributor',
      Jenis: 'Pemasukan',
      Supplier: 'PT Pangan Makmur',
      Nominal: 50000,
    },
  ];

  const employeeTemplate = [
    {
      Nama_Karyawan: 'Siti Aminah',
      Jabatan: 'Kasir & Admin Toko',
      Gaji_Bulanan: 2200000,
    },
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesTemplate), 'Penjualan');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventoryTemplate), 'Produk_Stok');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(financeTemplate), 'Pembelian_Kas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employeeTemplate), 'Karyawan');

  XLSX.writeFile(wb, 'Template_Pembukuan_UMKM.xlsx');
}

export function exportFinancialReportXlsx(
  businessName: string,
  periodLabel: string,
  snapshot: UnifiedBusinessSnapshot,
  datasets: StoredDataset[]
): void {
  const wb = XLSX.utils.book_new();
  const todayIso = new Date().toISOString().slice(0, 10);

  const summaryRows = [
    { Komponen: 'Nama Usaha', Nilai: businessName },
    { Komponen: 'Periode Laporan', Nilai: periodLabel },
    { Komponen: 'Tanggal Cetak', Nilai: todayIso },
    { Komponen: '', Nilai: '' },
    { Komponen: 'Total Omzet Penjualan', Nilai: snapshot.totalRevenue },
    { Komponen: 'Pemasukan Lainnya', Nilai: snapshot.otherIncome },
    { Komponen: 'HPP Aktual (Modal Terjual)', Nilai: snapshot.totalActualHpp },
    { Komponen: 'Laba Kotor Aktual', Nilai: snapshot.totalGrossProfitActual },
    {
      Komponen: 'Margin Laba Kotor (%)',
      Nilai: Number(snapshot.grossMarginPercent.toFixed(2)),
    },
    { Komponen: 'Total Pengeluaran Kas', Nilai: snapshot.totalExpense },
    { Komponen: 'Estimasi Gaji Karyawan / Bulan', Nilai: snapshot.monthlyPayroll },
    { Komponen: 'Arus Kas Operasional Bersih', Nilai: snapshot.netOperatingCashflow },
    { Komponen: '', Nilai: '' },
    { Komponen: 'Jumlah SKU Produk', Nilai: snapshot.totalProductSku },
    { Komponen: 'Total Unit Stok', Nilai: snapshot.totalStockUnits },
    { Komponen: 'Nilai Aset Stok (Modal)', Nilai: snapshot.inventoryAssetValue },
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan_Keuangan');

  if (snapshot.topProducts.length > 0) {
    const productRows = snapshot.topProducts.map((p, idx) => ({
      Peringkat: idx + 1,
      Nama_Produk: p.name,
      Kategori: p.category,
      Qty_Terjual: p.qtySold,
      Omzet: p.revenue,
      HPP_Aktual: p.hpp,
      Laba_Kotor: p.grossProfit,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Performa_Produk');
  }

  if (snapshot.dailyTrend.length > 0) {
    const trendRows = snapshot.dailyTrend.map((d) => ({
      Tanggal: d.date,
      Jumlah_Transaksi: d.transactions,
      Pemasukan: d.revenue,
      Pengeluaran: d.expense,
      Laba_Kotor_Aktual: d.grossProfit,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendRows), 'Tren_Harian');
  }

  const salesRows = datasets.filter((d) => d.category === 'sales').flatMap((d) => d.rows);
  if (salesRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'Detail_Penjualan');
  }

  const financeRows = datasets.filter((d) => d.category === 'finance').flatMap((d) => d.rows);
  if (financeRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(financeRows), 'Detail_Kas');
  }

  const fileName = `Laporan_Keuangan_${sanitizeFileName(businessName)}_${todayIso}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportFinancialReportCsv(
  businessName: string,
  periodLabel: string,
  currency: string,
  snapshot: UnifiedBusinessSnapshot
): void {
  const todayIso = new Date().toISOString().slice(0, 10);
  const rp = (n: number) => formatFullRupiah(n, currency);

  const lines = [
    ['Komponen Keuangan', 'Nominal Angka', 'Format Rupiah'],
    ['Nama Usaha', businessName, businessName],
    ['Periode Laporan', periodLabel, periodLabel],
    ['Tanggal Cetak', todayIso, todayIso],
    ['Total Omzet Penjualan', String(snapshot.totalRevenue), rp(snapshot.totalRevenue)],
    ['Pemasukan Lainnya', String(snapshot.otherIncome), rp(snapshot.otherIncome)],
    ['HPP Aktual', String(snapshot.totalActualHpp), rp(snapshot.totalActualHpp)],
    [
      'Laba Kotor Aktual',
      String(snapshot.totalGrossProfitActual),
      rp(snapshot.totalGrossProfitActual),
    ],
    [
      'Margin Laba Kotor (%)',
      snapshot.grossMarginPercent.toFixed(2),
      `${snapshot.grossMarginPercent.toFixed(1)}%`,
    ],
    ['Total Pengeluaran Kas', String(snapshot.totalExpense), rp(snapshot.totalExpense)],
    ['Gaji Karyawan Bulanan', String(snapshot.monthlyPayroll), rp(snapshot.monthlyPayroll)],
    [
      'Arus Kas Operasional Bersih',
      String(snapshot.netOperatingCashflow),
      rp(snapshot.netOperatingCashflow),
    ],
    ['Nilai Aset Stok', String(snapshot.inventoryAssetValue), rp(snapshot.inventoryAssetValue)],
  ];

  const csvContent =
    '\uFEFF' +
    lines
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Laporan_Ringkas_${sanitizeFileName(businessName)}_${todayIso}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}