import {
  computeDatasetRollup,
  type ProductRollupBucket,
  type SavedDataset,
} from './datasetStorage';

export interface TopProductMetric {
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  grossProfit: number;
  hasActualHpp: boolean;
}

export interface LowStockMetric {
  name: string;
  stock: number;
  minStock: number;
}

export interface BreakdownMetric {
  label: string;
  count: number;
  revenue: number;
  sharePercent: number;
}

export interface UnifiedBusinessSnapshot {
  totalTransactions: number;
  totalRevenue: number;
  otherIncome: number;
  totalActualHpp: number;
  totalGrossProfitActual: number;
  grossMarginPercent: number;
  totalExpense: number;
  monthlyPayroll: number;
  netOperatingCashflow: number;
  totalProductSku: number;
  totalStockUnits: number;
  inventoryAssetValue: number;
  averageOrderValue: number;
  activeDaysCount: number;
  averageDailyRevenue: number;
  topProducts: TopProductMetric[];
  lowStockItems: LowStockMetric[];
  paymentBreakdown: BreakdownMetric[];
  categoryBreakdown: BreakdownMetric[];
}

export function buildUnifiedBusinessSnapshot(
  datasets: SavedDataset[]
): UnifiedBusinessSnapshot {
  let totalTransactions = 0;
  let totalRevenue = 0;
  let otherIncome = 0;
  let totalActualHpp = 0;
  let totalExpense = 0;
  let monthlyPayroll = 0;
  let totalProductSku = 0;
  let totalStockUnits = 0;
  let inventoryAssetValue = 0;

  const activeDaysSet = new Set<string>();
  const mergedProducts = new Map<string, ProductRollupBucket>();
  const mergedPayments = new Map<string, { count: number; revenue: number }>();
  const mergedCategories = new Map<string, { count: number; revenue: number }>();
  const lowStockItems: LowStockMetric[] = [];

  for (const ds of datasets) {
    const rollup =
      ds.rollup ?? computeDatasetRollup(ds.category || 'penjualan', ds.rows || []);

    totalTransactions += rollup.transactions;
    totalRevenue += rollup.revenue;
    otherIncome += rollup.otherIncome;
    totalActualHpp += rollup.actualHpp;
    totalExpense += rollup.expense;
    monthlyPayroll += rollup.monthlyPayroll;
    totalProductSku += rollup.productSku;
    totalStockUnits += rollup.stockUnits;
    inventoryAssetValue += rollup.inventoryAssetValue;

    for (const dayKey of Object.keys(rollup.dailyStats)) {
      activeDaysSet.add(dayKey);
    }

    for (const p of Object.values(rollup.productSales)) {
      const prev = mergedProducts.get(p.name) || {
        name: p.name,
        category: p.category,
        qtySold: 0,
        revenue: 0,
        grossProfit: 0,
        hasActualHpp: p.hasActualHpp,
      };
      prev.qtySold += p.qtySold;
      prev.revenue += p.revenue;
      prev.grossProfit += p.grossProfit;
      if (p.hasActualHpp) prev.hasActualHpp = true;
      mergedProducts.set(p.name, prev);
    }

    for (const [payKey, st] of Object.entries(rollup.paymentBreakdown)) {
      const prev = mergedPayments.get(payKey) || { count: 0, revenue: 0 };
      prev.count += st.count;
      prev.revenue += st.revenue;
      mergedPayments.set(payKey, prev);
    }

    for (const [catKey, st] of Object.entries(rollup.categoryBreakdown)) {
      const prev = mergedCategories.get(catKey) || { count: 0, revenue: 0 };
      prev.count += st.count;
      prev.revenue += st.revenue;
      mergedCategories.set(catKey, prev);
    }

    for (const item of rollup.lowStockItems) {
      lowStockItems.push(item);
    }
  }

  const totalGrossProfitActual = totalRevenue - totalActualHpp;
  const grossMarginPercent =
    totalRevenue > 0 ? (totalGrossProfitActual / totalRevenue) * 100 : 0;
  const netOperatingCashflow = totalRevenue + otherIncome - totalExpense;
  const averageOrderValue =
    totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const activeDaysCount = activeDaysSet.size;
  const averageDailyRevenue =
    activeDaysCount > 0 ? totalRevenue / activeDaysCount : 0;

  const topProducts = Array.from(mergedProducts.values()).sort(
    (a, b) => b.revenue - a.revenue
  );

  const paymentBreakdown: BreakdownMetric[] = Array.from(mergedPayments.entries())
    .map(([label, st]) => ({
      label,
      count: st.count,
      revenue: st.revenue,
      sharePercent: totalRevenue > 0 ? (st.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const categoryBreakdown: BreakdownMetric[] = Array.from(mergedCategories.entries())
    .map(([label, st]) => ({
      label,
      count: st.count,
      revenue: st.revenue,
      sharePercent: totalRevenue > 0 ? (st.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalTransactions,
    totalRevenue,
    otherIncome,
    totalActualHpp,
    totalGrossProfitActual,
    grossMarginPercent,
    totalExpense,
    monthlyPayroll,
    netOperatingCashflow,
    totalProductSku,
    totalStockUnits,
    inventoryAssetValue,
    averageOrderValue,
    activeDaysCount,
    averageDailyRevenue,
    topProducts,
    lowStockItems,
    paymentBreakdown,
    categoryBreakdown,
  };
}