export interface DailyMetrics {
  dateIso: string; // YYYY-MM-DD
  transactions: number;
  revenue: number;
  actualHpp: number;
  grossProfit: number;
  expense: number;
  otherIncome: number;
  netCashflow: number;
  topProducts: { name: string; qty: number; revenue: number }[];
}

export interface PeriodSummaryRow {
  key: string;
  label: string;
  subLabel: string;
  transactions: number;
  revenue: number;
  grossProfit: number;
  expense: number;
  otherIncome: number;
  netCashflow: number;
  growthPercent: number | null;
}

export interface TimeAnalyticsResult {
  dailyMap: Record<string, DailyMetrics>;
  dailyList: DailyMetrics[];
  weeklyList: PeriodSummaryRow[];
  monthlyList: PeriodSummaryRow[];
  availableMonths: { ym: string; label: string }[];
  minDate: string;
  maxDate: string;
  totals: {
    transactions: number;
    revenue: number;
    grossProfit: number;
    expense: number;
    otherIncome: number;
    netCashflow: number;
  };
}

interface DatasetLike {
  category?: string;
  rows?: Record<string, unknown>[];
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const SHORT_MONTH_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function toNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getField(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    lowerMap.set(k.toLowerCase().trim(), v);
  }
  for (const key of candidates) {
    const found = lowerMap.get(key.toLowerCase());
    if (found !== undefined && found !== null && found !== '') {
      return found;
    }
  }
  return undefined;
}

export function parseFlexibleDateIso(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  if (typeof raw === 'number' && raw > 20000 && raw < 90000) {
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  const str = String(raw).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES_ID[idx] || m} ${y}`;
}

export function formatShortDateId(dateIso: string): string {
  const [y, m, d] = dateIso.split('-');
  const idx = Number(m) - 1;
  return `${Number(d)} ${SHORT_MONTH_ID[idx] || m} ${y}`;
}

function getMondayWeekStart(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0=Min .. 6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}

function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function buildTimeAnalytics(
  datasets: DatasetLike[],
  dateFrom?: string,
  dateTo?: string
): TimeAnalyticsResult {
  const dayBuckets = new Map<
    string,
    {
      transactions: number;
      revenue: number;
      actualHpp: number;
      expense: number;
      otherIncome: number;
      products: Map<string, { qty: number; revenue: number }>;
    }
  >();

  const ensureDay = (iso: string) => {
    let bucket = dayBuckets.get(iso);
    if (!bucket) {
      bucket = {
        transactions: 0,
        revenue: 0,
        actualHpp: 0,
        expense: 0,
        otherIncome: 0,
        products: new Map(),
      };
      dayBuckets.set(iso, bucket);
    }
    return bucket;
  };

  let globalMin = '';
  let globalMax = '';

  for (const ds of datasets) {
    const rows = Array.isArray(ds.rows) ? ds.rows : [];
    const cat = (ds.category || '').toLowerCase();

    for (const row of rows) {
      const dateIso = parseFlexibleDateIso(
        getField(row, ['Tanggal', 'tanggal', 'Date', 'date', 'tgl'])
      );
      if (!dateIso) continue;

      if (!globalMin || dateIso < globalMin) globalMin = dateIso;
      if (!globalMax || dateIso > globalMax) globalMax = dateIso;

      if (dateFrom && dateIso < dateFrom) continue;
      if (dateTo && dateIso > dateTo) continue;

      const isSales =
        cat.includes('penjualan') ||
        cat.includes('sales') ||
        getField(row, ['Harga_Satuan', 'harga_satuan', 'Qty', 'qty']) !== undefined;

      const isFinance =
        cat.includes('keuangan') ||
        cat.includes('pembelian') ||
        cat.includes('kas') ||
        getField(row, ['Nominal', 'nominal', 'Jenis', 'jenis']) !== undefined;

      if (isSales && !cat.includes('keuangan') && !cat.includes('pembelian')) {
        const qty = Math.max(1, toNumber(getField(row, ['Qty', 'qty', 'jumlah'])) || 1);
        const sellPrice = toNumber(
          getField(row, ['Harga_Satuan', 'harga_satuan', 'Harga_Jual', 'harga'])
        );
        const total =
          toNumber(getField(row, ['Total', 'total', 'omzet'])) || qty * sellPrice;
        const unitCost = toNumber(
          getField(row, ['Harga_Modal', 'harga_modal', 'modal', 'hpp'])
        );
        const prodName = String(
          getField(row, ['Nama_Produk', 'nama_produk', 'produk', 'nama']) || 'Produk'
        ).trim();

        const b = ensureDay(dateIso);
        b.transactions += 1;
        b.revenue += total;
        b.actualHpp += unitCost > 0 ? unitCost * qty : 0;

        const prevProd = b.products.get(prodName) || { qty: 0, revenue: 0 };
        prevProd.qty += qty;
        prevProd.revenue += total;
        b.products.set(prodName, prevProd);
      } else if (isFinance) {
        const nominal = toNumber(
          getField(row, ['Nominal', 'nominal', 'Total', 'total', 'jumlah'])
        );
        const jenis = String(
          getField(row, ['Jenis', 'jenis', 'tipe', 'type']) || 'Pengeluaran'
        ).toLowerCase();

        const b = ensureDay(dateIso);
        if (jenis.includes('masuk') || jenis.includes('income')) {
          b.otherIncome += nominal;
        } else {
          b.expense += nominal;
        }
      }
    }
  }

  const sortedDates = Array.from(dayBuckets.keys()).sort();
  const dailyMap: Record<string, DailyMetrics> = {};
  const dailyList: DailyMetrics[] = [];

  for (const iso of sortedDates) {
    const b = dayBuckets.get(iso)!;
    const grossProfit = b.revenue - b.actualHpp;
    const netCashflow = b.revenue + b.otherIncome - b.expense;
    const topProducts = Array.from(b.products.entries())
      .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }))
      .sort((a, bItem) => bItem.revenue - a.revenue)
      .slice(0, 5);

    const metric: DailyMetrics = {
      dateIso: iso,
      transactions: b.transactions,
      revenue: b.revenue,
      actualHpp: b.actualHpp,
      grossProfit,
      expense: b.expense,
      otherIncome: b.otherIncome,
      netCashflow,
      topProducts,
    };
    dailyMap[iso] = metric;
    dailyList.push(metric);
  }

  // Agregasi Mingguan
  const weekBuckets = new Map<
    string,
    {
      transactions: number;
      revenue: number;
      grossProfit: number;
      expense: number;
      otherIncome: number;
      netCashflow: number;
    }
  >();

  for (const d of dailyList) {
    const wk = getMondayWeekStart(d.dateIso);
    const curr = weekBuckets.get(wk) || {
      transactions: 0,
      revenue: 0,
      grossProfit: 0,
      expense: 0,
      otherIncome: 0,
      netCashflow: 0,
    };
    curr.transactions += d.transactions;
    curr.revenue += d.revenue;
    curr.grossProfit += d.grossProfit;
    curr.expense += d.expense;
    curr.otherIncome += d.otherIncome;
    curr.netCashflow += d.netCashflow;
    weekBuckets.set(wk, curr);
  }

  const sortedWeeks = Array.from(weekBuckets.keys()).sort();
  const weeklyList: PeriodSummaryRow[] = sortedWeeks.map((wkStart, idx) => {
    const w = weekBuckets.get(wkStart)!;
    const wkEnd = addDaysIso(wkStart, 6);
    const prevRev = idx > 0 ? weekBuckets.get(sortedWeeks[idx - 1])!.revenue : 0;
    const growthPercent =
      idx > 0 && prevRev > 0 ? ((w.revenue - prevRev) / prevRev) * 100 : null;

    return {
      key: wkStart,
      label: `${formatShortDateId(wkStart).slice(0, 6)} – ${formatShortDateId(wkEnd)}`,
      subLabel: `Minggu #${idx + 1}`,
      transactions: w.transactions,
      revenue: w.revenue,
      grossProfit: w.grossProfit,
      expense: w.expense,
      otherIncome: w.otherIncome,
      netCashflow: w.netCashflow,
      growthPercent,
    };
  });

  // Agregasi Bulanan
  const monthBuckets = new Map<
    string,
    {
      transactions: number;
      revenue: number;
      grossProfit: number;
      expense: number;
      otherIncome: number;
      netCashflow: number;
    }
  >();

  for (const d of dailyList) {
    const ym = d.dateIso.slice(0, 7);
    const curr = monthBuckets.get(ym) || {
      transactions: 0,
      revenue: 0,
      grossProfit: 0,
      expense: 0,
      otherIncome: 0,
      netCashflow: 0,
    };
    curr.transactions += d.transactions;
    curr.revenue += d.revenue;
    curr.grossProfit += d.grossProfit;
    curr.expense += d.expense;
    curr.otherIncome += d.otherIncome;
    curr.netCashflow += d.netCashflow;
    monthBuckets.set(ym, curr);
  }

  const sortedMonths = Array.from(monthBuckets.keys()).sort();
  const monthlyList: PeriodSummaryRow[] = sortedMonths.map((ym, idx) => {
    const m = monthBuckets.get(ym)!;
    const prevRev = idx > 0 ? monthBuckets.get(sortedMonths[idx - 1])!.revenue : 0;
    const growthPercent =
      idx > 0 && prevRev > 0 ? ((m.revenue - prevRev) / prevRev) * 100 : null;

    return {
      key: ym,
      label: formatMonthLabel(ym),
      subLabel: ym,
      transactions: m.transactions,
      revenue: m.revenue,
      grossProfit: m.grossProfit,
      expense: m.expense,
      otherIncome: m.otherIncome,
      netCashflow: m.netCashflow,
      growthPercent,
    };
  });

  const totals = dailyList.reduce(
    (acc, d) => ({
      transactions: acc.transactions + d.transactions,
      revenue: acc.revenue + d.revenue,
      grossProfit: acc.grossProfit + d.grossProfit,
      expense: acc.expense + d.expense,
      otherIncome: acc.otherIncome + d.otherIncome,
      netCashflow: acc.netCashflow + d.netCashflow,
    }),
    { transactions: 0, revenue: 0, grossProfit: 0, expense: 0, otherIncome: 0, netCashflow: 0 }
  );

  return {
    dailyMap,
    dailyList,
    weeklyList,
    monthlyList,
    availableMonths: sortedMonths.map((ym) => ({ ym, label: formatMonthLabel(ym) })),
    minDate: globalMin,
    maxDate: globalMax,
    totals,
  };
}