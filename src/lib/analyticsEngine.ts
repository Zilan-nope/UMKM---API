type DataRow = Record<string, unknown>;

type DatasetLike = {
  rows?: DataRow[];
  category?: string;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getRows = (dataset: DatasetLike | null | undefined): DataRow[] => {
  const rows = dataset?.rows ?? [];
  return Array.isArray(rows) ? rows : [];
};

const findKey = (row: DataRow, patterns: RegExp[]): string | undefined => {
  const lowerRow = Object.keys(row).find((key) =>
    patterns.some((pattern) => pattern.test(key.toLowerCase()))
  );
  return lowerRow;
};

const getValue = (row: DataRow, patterns: RegExp[]): unknown => {
  const key = findKey(row, patterns);
  if (!key) return undefined;
  return row[key];
};

const getStringValue = (row: DataRow, patterns: RegExp[], fallback = 'Unknown'): string => {
  const value = getValue(row, patterns);
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
};

const getDateKey = (row: DataRow): string => {
  const value = getValue(row, [/tgl|tanggal|date|day|waktu|created/]);
  if (value === undefined || value === null || value === '') return 'Tanggal Tidak Diketahui';

  const raw = String(value).trim();
  if (!raw) return 'Tanggal Tidak Diketahui';

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
  }

  return raw;
};

export function calculateSalesMetrics(dataset: DatasetLike | null | undefined) {
  const rows = getRows(dataset);
  const products = new Map<string, { name: string; qty: number; revenue: number }>();
  const dailyTrend = new Map<string, { date: string; omzet: number; laba: number }>();
  const categoryBreakdown = new Map<string, number>();

  let totalRevenue = 0;
  let totalUnits = 0;
  let totalGrossProfit = 0;
  let hasCostData = false;

  rows.forEach((row) => {
    const name = getStringValue(row, [/produk|barang|item|nama|product/], 'Produk');
    const qtyValue = getValue(row, [/qty|jumlah|kuantitas|unit|pcs|qty_/,]);
    const qty = toNumber(qtyValue) || 1;

    const revenueValue = getValue(row, [/omzet|revenue|total|penjualan|sales|amount|nilai/]);
    const priceValue = getValue(row, [/harga|price|unit_price|selling|jual/]);
    const revenue = toNumber(revenueValue) || toNumber(priceValue) * qty;

    const costValue = getValue(row, [/modal|hpp|cost|biaya|cogs/]);
    const cost = toNumber(costValue);

    if (costValue !== undefined && costValue !== null && costValue !== '') {
      hasCostData = true;
      totalGrossProfit += revenue - cost;
    }

    totalRevenue += revenue;
    totalUnits += qty;

    const product = products.get(name) ?? { name, qty: 0, revenue: 0 };
    product.qty += qty;
    product.revenue += revenue;
    products.set(name, product);

    const dateKey = getDateKey(row);
    const daily = dailyTrend.get(dateKey) ?? { date: dateKey, omzet: 0, laba: 0 };
    daily.omzet += revenue;
    if (hasCostData && costValue !== undefined && costValue !== null && costValue !== '') {
      daily.laba += revenue - cost;
    }
    dailyTrend.set(dateKey, daily);

    const categoryName = getStringValue(row, [/kategori|group|jenis|cluster|brand/], 'Umum');
    categoryBreakdown.set(categoryName, (categoryBreakdown.get(categoryName) ?? 0) + revenue);
  });

  const sortedProducts = [...products.values()].sort((a, b) => b.revenue - a.revenue);
  const dailyTrendList = [...dailyTrend.values()].sort((a, b) => a.date.localeCompare(b.date));
  const categoryBreakdownList = [...categoryBreakdown.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalTransactions: rows.length,
    totalRevenue,
    totalUnits,
    averageOrderValue: rows.length ? totalRevenue / rows.length : 0,
    hasCostData,
    totalGrossProfit,
    grossMarginPercent: totalRevenue ? (totalGrossProfit / totalRevenue) * 100 : 0,
    topProducts: sortedProducts,
    dailyTrend: dailyTrendList,
    categoryBreakdown: categoryBreakdownList,
  };
}

export function calculateFinanceMetrics(dataset: DatasetLike | null | undefined) {
  const rows = getRows(dataset);
  const dailyCashflow = new Map<string, { date: string; masuk: number; keluar: number }>();

  let totalIncome = 0;
  let totalExpense = 0;

  rows.forEach((row) => {
    const amount = toNumber(getValue(row, [/jumlah|nominal|amount|total|nilai|income|pemasukan|penjualan/]));
    const label = String(getValue(row, [/jenis|tipe|kategori|type|group|status/]) ?? '').toLowerCase();
    const isExpense = /keluar|expense|pengeluaran|biaya|cost|outflow/.test(label) || amount < 0;
    const value = Math.abs(amount);

    if (isExpense) {
      totalExpense += value;
    } else {
      totalIncome += value;
    }

    const dateKey = getDateKey(row);
    const daily = dailyCashflow.get(dateKey) ?? { date: dateKey, masuk: 0, keluar: 0 };
    if (isExpense) {
      daily.keluar += value;
    } else {
      daily.masuk += value;
    }
    dailyCashflow.set(dateKey, daily);
  });

  return {
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    dailyCashflow: [...dailyCashflow.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function calculateInventoryMetrics(dataset: DatasetLike | null | undefined) {
  const rows = getRows(dataset);
  const items = rows.map((row) => {
    const name = getStringValue(row, [/produk|barang|item|nama|sku|product/], 'Barang');
    const current = toNumber(getValue(row, [/stok|stock|jumlah|sisa|qty|available|onhand/]));
    const minimum = toNumber(getValue(row, [/min|minimum|batas|restock|reorder/])) || 5;
    return { name, current, minimum };
  });

  const lowStockItems = items.filter((item) => item.current <= item.minimum);
  const stockChart = [...items]
    .sort((a, b) => a.current - b.current)
    .map((item) => ({ name: item.name, stok: item.current, min: item.minimum }));

  return {
    totalItems: items.length,
    totalStockUnits: items.reduce((sum, item) => sum + item.current, 0),
    lowStockItems: lowStockItems.map((item) => ({
      name: item.name,
      current: item.current,
      min: item.minimum,
    })),
    stockChart,
  };
}

export function calculateGenericMetrics(dataset: DatasetLike | null | undefined) {
  const rows = getRows(dataset);
  const numericValues: number[] = [];
  const grouped = new Map<string, number>();

  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      const numeric = toNumber(value);
      if (numeric !== 0 || value === 0 || value === '0') {
        numericValues.push(numeric);
      }

      const categoryKey = /kategori|group|jenis|label|segment/.test(key.toLowerCase())
        ? String(value ?? 'Uncategorized')
        : undefined;
      if (categoryKey) {
        grouped.set(categoryKey, (grouped.get(categoryKey) ?? 0) + numeric);
      }
    });
  });

  const groupedChart = [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalRecords: rows.length,
    numericLabel: 'nilai numerik',
    totalNumericValue: numericValues.reduce((sum, value) => sum + value, 0),
    groupedChart,
  };
}
