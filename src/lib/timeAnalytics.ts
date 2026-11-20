import type { SavedDataset } from './datasetStorage';

export interface DailyMetrics {
  dateIso: string;
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

export function parseFlexibleDateIso(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && raw > 20000 && raw < 90000) {
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
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
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
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
  const day = dt.getUTCDay();
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
  datasets: Partial<SavedDataset>[],
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

  let globalMin = '';
  let globalMax = '';

  for (const ds of datasets) {
    const dailyStats = ds.rollup?.dailyStats;
    if (!dailyStats) continue;

    for (const [iso, st] of Object.entries(dailyStats)) {
      if (!globalMin || iso < globalMin) globalMin = iso;
      if (!globalMax || iso > globalMax) globalMax = iso;

      if (dateFrom && iso < dateFrom) continue;
      if (dateTo && iso > dateTo) continue;

      let b = dayBuckets.get(iso);
      if (!b) {
        b = {
          transactions: 0,
          revenue: 0,
          actualHpp: 0,
          expense: 0,
          otherIncome: 0,
          products: new Map(),
        };
        dayBuckets.set(iso, b);
      }

      b.transactions += st.transactions;
      b.revenue += st.revenue;
      b.actualHpp += st.actualHpp;
      b.expense += st.expense;
      b.otherIncome += st.otherIncome;

      for (const p of st.topProducts || []) {
        const prev = b.products.get(p.name) || { qty: 0, revenue: 0 };
        prev.qty += p.qty;
        prev.revenue += p.revenue;
        b.products.set(p.name, prev);
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
      .map(([name, st]) => ({ name, qty: st.qty, revenue: st.revenue }))
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