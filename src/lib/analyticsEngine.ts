import type { StoredDataset } from '../context/AppContext';
import { compareIsoDates, normalizeBusinessDate } from './dateUtils';
import { buildRowSignature } from './fileParser';
import { isSummaryLabel, toNumber } from './numberUtils';

export interface DailyTrendPoint {
  date: string;
  revenue: number;
  expense: number;
  grossProfit: number;
  transactions: number;
}

export interface ProductPerformance {
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  hpp: number;
  grossProfit: number;
  hasActualHpp: boolean;
}

export interface LowStockAlert {
  name: string;
  category: string;
  stock: number;
  minStock: number;
}

export interface UnifiedBusinessSnapshot {
  totalRevenue: number;
  totalActualHpp: number;
  totalGrossProfitActual: number;
  grossMarginPercent: number;
  totalTransactions: number;
  salesWithHppCount: number;
  salesWithoutHppCount: number;
  revenueWithoutHpp: number;

  otherIncome: number;
  totalExpense: number;
  monthlyPayroll: number;
  netOperatingCashflow: number;

  totalProductSku: number;
  totalStockUnits: number;
  inventoryAssetValue: number;
  lowStockItems: LowStockAlert[];

  dailyTrend: DailyTrendPoint[];
  categoryBreakdown: { name: string; value: number }[];
  topProducts: ProductPerformance[];
  dateRange: { start: string; end: string };
  datasetCount: number;
}

export function buildUnifiedBusinessSnapshot(
  datasets: StoredDataset[]
): UnifiedBusinessSnapshot {
  const catalogHppMap = new Map<string, number>();
  const inventoryItemMap = new Map<
    string,
    { name: string; category: string; stock: number; minStock: number; modal: number; jual: number }
  >();

  for (const ds of datasets) {
    if (ds.category !== 'inventory') continue;
    for (const r of ds.rows) {
      const name = String(r['Nama_Produk'] ?? r['Produk'] ?? '').trim();
      if (!name || isSummaryLabel(name)) continue;

      const key = name.toLowerCase();
      const stock = toNumber(r['Stok_Saat_Ini'] ?? r['Stok'], 0);
      const minStock = toNumber(r['Stok_Minimum'], 5);
      const modal = toNumber(r['Harga_Modal'] ?? r['HPP'], 0);
      const jual = toNumber(r['Harga_Jual'] ?? r['Harga'], 0);
      const category = String(r['Kategori'] ?? 'Umum').trim() || 'Umum';

      if (modal > 0) {
        catalogHppMap.set(key, modal);
      }
      inventoryItemMap.set(key, { name, category, stock, minStock, modal, jual });
    }
  }

  let totalProductSku = 0;
  let totalStockUnits = 0;
  let inventoryAssetValue = 0;
  const lowStockItems: LowStockAlert[] = [];

  inventoryItemMap.forEach((item) => {
    totalProductSku += 1;
    totalStockUnits += item.stock;
    inventoryAssetValue += item.stock * (item.modal > 0 ? item.modal : item.jual);
    if (item.stock <= item.minStock) {
      lowStockItems.push({
        name: item.name,
        category: item.category,
        stock: item.stock,
        minStock: item.minStock,
      });
    }
  });
  lowStockItems.sort((a, b) => a.stock - b.stock);

  let totalRevenue = 0;
  let totalActualHpp = 0;
  let totalGrossProfitActual = 0;
  let totalTransactions = 0;
  let salesWithHppCount = 0;
  let salesWithoutHppCount = 0;
  let revenueWithoutHpp = 0;

  const seenSalesSignatures = new Set<string>();
  const dailyMap = new Map<string, DailyTrendPoint>();
  const categoryMap = new Map<string, number>();
  const productPerfMap = new Map<string, ProductPerformance>();

  const ensureDay = (isoDate: string): DailyTrendPoint => {
    const key = isoDate || 'Tanpa Tanggal';
    let entry = dailyMap.get(key);
    if (!entry) {
      entry = { date: key, revenue: 0, expense: 0, grossProfit: 0, transactions: 0 };
      dailyMap.set(key, entry);
    }
    return entry;
  };

  for (const ds of datasets) {
    if (ds.category !== 'sales') continue;
    for (const r of ds.rows) {
      const name = String(r['Nama_Produk'] ?? r['Produk'] ?? '').trim();
      if (!name || isSummaryLabel(name)) continue;

      const isoDate = normalizeBusinessDate(r['Tanggal']);
      const qty = Math.max(1, toNumber(r['Qty'], 1));
      const unitPrice = toNumber(r['Harga_Satuan'] ?? r['Harga'], 0);
      const rawTotal = toNumber(r['Total'], 0);
      const revenue = rawTotal > 0 ? rawTotal : qty * unitPrice;

      const sig = buildRowSignature('sales', {
        Tanggal: isoDate,
        Nama_Produk: name,
        Qty: qty,
        Total: revenue,
      });
      if (seenSalesSignatures.has(sig)) continue;
      seenSalesSignatures.add(sig);

      const category = String(r['Kategori'] ?? 'Umum').trim() || 'Umum';
      const rowUnitModal = toNumber(r['Harga_Modal'] ?? r['HPP'], 0);
      const lookupUnitModal = catalogHppMap.get(name.toLowerCase()) ?? 0;
      const effectiveUnitModal = rowUnitModal > 0 ? rowUnitModal : lookupUnitModal;

      const hasHpp = effectiveUnitModal > 0;
      const rowHpp = hasHpp ? effectiveUnitModal * qty : 0;
      const rowGrossProfit = hasHpp ? revenue - rowHpp : 0;

      totalRevenue += revenue;
      totalTransactions += 1;

      if (hasHpp) {
        totalActualHpp += rowHpp;
        totalGrossProfitActual += rowGrossProfit;
        salesWithHppCount += 1;
      } else {
        salesWithoutHppCount += 1;
        revenueWithoutHpp += revenue;
      }

      const day = ensureDay(isoDate);
      day.revenue += revenue;
      day.grossProfit += rowGrossProfit;
      day.transactions += 1;

      categoryMap.set(category, (categoryMap.get(category) ?? 0) + revenue);

      const prodKey = name.toLowerCase();
      const existingProd = productPerfMap.get(prodKey) ?? {
        name,
        category,
        qtySold: 0,
        revenue: 0,
        hpp: 0,
        grossProfit: 0,
        hasActualHpp: false,
      };
      existingProd.qtySold += qty;
      existingProd.revenue += revenue;
      existingProd.hpp += rowHpp;
      existingProd.grossProfit += rowGrossProfit;
      existingProd.hasActualHpp = existingProd.hasActualHpp || hasHpp;
      productPerfMap.set(prodKey, existingProd);
    }
  }

  let otherIncome = 0;
  let totalExpense = 0;
  let monthlyPayroll = 0;
  const seenFinanceSignatures = new Set<string>();

  for (const ds of datasets) {
    if (ds.category === 'finance') {
      for (const r of ds.rows) {
        const desc = String(r['Nama_Barang_Keperluan'] ?? r['Keterangan'] ?? '').trim();
        if (!desc || isSummaryLabel(desc)) continue;

        const isoDate = normalizeBusinessDate(r['Tanggal']);
        const jenisRaw = String(r['Jenis'] ?? 'Pengeluaran').trim();
        const isIncome = /(masuk|pemasukan|income|debit)/i.test(jenisRaw);
        const nominal = Math.abs(toNumber(r['Nominal'] ?? r['Total'], 0));

        const sig = buildRowSignature('finance', {
          Tanggal: isoDate,
          Nama_Barang_Keperluan: desc,
          Jenis: isIncome ? 'Pemasukan' : 'Pengeluaran',
          Nominal: nominal,
        });
        if (seenFinanceSignatures.has(sig)) continue;
        seenFinanceSignatures.add(sig);

        const day = ensureDay(isoDate);
        if (isIncome) {
          otherIncome += nominal;
          day.revenue += nominal;
        } else {
          totalExpense += nominal;
          day.expense += nominal;
        }
      }
    } else if (ds.category === 'employee') {
      for (const r of ds.rows) {
        const empName = String(r['Nama_Karyawan'] ?? '').trim();
        if (!empName || isSummaryLabel(empName)) continue;
        monthlyPayroll += Math.abs(toNumber(r['Gaji_Bulanan'] ?? r['Gaji'], 0));
      }
    }
  }

  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) =>
    compareIsoDates(
      a.date === 'Tanpa Tanggal' ? '' : a.date,
      b.date === 'Tanpa Tanggal' ? '' : b.date
    )
  );

  const datedPoints = dailyTrend.filter((d) => d.date !== 'Tanpa Tanggal');
  const dateRange = {
    start: datedPoints.length > 0 ? datedPoints[0].date : '',
    end: datedPoints.length > 0 ? datedPoints[datedPoints.length - 1].date : '',
  };

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topProducts = Array.from(productPerfMap.values()).sort((a, b) => b.revenue - a.revenue);

  const knownRevenueWithHpp = totalRevenue - revenueWithoutHpp;
  const grossMarginPercent =
    knownRevenueWithHpp > 0 ? (totalGrossProfitActual / knownRevenueWithHpp) * 100 : 0;

  const netOperatingCashflow = totalRevenue + otherIncome - totalActualHpp - totalExpense;

  return {
    totalRevenue,
    totalActualHpp,
    totalGrossProfitActual,
    grossMarginPercent,
    totalTransactions,
    salesWithHppCount,
    salesWithoutHppCount,
    revenueWithoutHpp,
    otherIncome,
    totalExpense,
    monthlyPayroll,
    netOperatingCashflow,
    totalProductSku,
    totalStockUnits,
    inventoryAssetValue,
    lowStockItems,
    dailyTrend,
    categoryBreakdown,
    topProducts,
    dateRange,
    datasetCount: datasets.length,
  };
}

export function calculateSalesMetrics(dataset: StoredDataset) {
  const snap = buildUnifiedBusinessSnapshot([dataset]);
  return {
    totalRevenue: snap.totalRevenue,
    totalProfit: snap.totalGrossProfitActual,
    totalTransactions: snap.totalTransactions,
    topProducts: snap.topProducts.map((p) => ({
      name: p.name,
      qty: p.qtySold,
      revenue: p.revenue,
    })),
  };
}