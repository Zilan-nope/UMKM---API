import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  formatCompactRupiah,
  formatFullRupiah,
  formatPercent,
} from '../../lib/formatters';
import {
  buildTimeAnalytics,
  formatMonthLabel,
  formatShortDateId,
} from '../../lib/timeAnalytics';

interface TimeCalendarExplorerProps {
  savedDatasets: { category?: string; rows?: Record<string, unknown>[] }[];
  currency: string;
}

type ViewGranularity = 'kalender' | 'mingguan' | 'bulanan';

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function TimeCalendarExplorer({
  savedDatasets,
  currency,
}: TimeCalendarExplorerProps) {
  const [viewMode, setViewMode] = useState<ViewGranularity>('kalender');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const analytics = useMemo(
    () => buildTimeAnalytics(savedDatasets, dateFrom || undefined, dateTo || undefined),
    [savedDatasets, dateFrom, dateTo]
  );

  const [activeYm, setActiveYm] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (analytics.availableMonths.length > 0) {
      const latestYm =
        analytics.availableMonths[analytics.availableMonths.length - 1].ym;
      if (!activeYm || !analytics.availableMonths.some((m) => m.ym === activeYm)) {
        setActiveYm(latestYm);
      }
    }
    if (analytics.dailyList.length > 0) {
      const latestDate = analytics.dailyList[analytics.dailyList.length - 1].dateIso;
      if (!selectedDate || !analytics.dailyMap[selectedDate]) {
        setSelectedDate(latestDate);
      }
    }
  }, [analytics, activeYm, selectedDate]);

  const applyPreset = (preset: 'all' | '7d' | '30d' | 'month') => {
    if (preset === 'all' || !analytics.maxDate) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const maxIso = analytics.maxDate;
    const [y, m, d] = maxIso.split('-').map(Number);
    const endDt = new Date(Date.UTC(y, m - 1, d));

    if (preset === '7d') {
      endDt.setUTCDate(endDt.getUTCDate() - 6);
      setDateFrom(endDt.toISOString().slice(0, 10));
      setDateTo(maxIso);
    } else if (preset === '30d') {
      endDt.setUTCDate(endDt.getUTCDate() - 29);
      setDateFrom(endDt.toISOString().slice(0, 10));
      setDateTo(maxIso);
    } else if (preset === 'month') {
      setDateFrom(`${maxIso.slice(0, 7)}-01`);
      setDateTo(maxIso);
    }
  };

  // Hitung grid kalender untuk activeYm
  const calendarCells = useMemo(() => {
    if (!activeYm) return [];
    const [year, month] = activeYm.split('-').map(Number);
    const firstDayObj = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = (firstDayObj.getUTCDay() + 6) % 7; // Senin=0 .. Minggu=6
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const cells: { dateIso: string | null; dayNum: number | null }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ dateIso: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${activeYm}-${String(d).padStart(2, '0')}`;
      cells.push({ dateIso: iso, dayNum: d });
    }
    return cells;
  }, [activeYm]);

  const maxDailyRevenueInMonth = useMemo(() => {
    let maxVal = 0;
    for (const cell of calendarCells) {
      if (cell.dateIso && analytics.dailyMap[cell.dateIso]) {
        maxVal = Math.max(maxVal, analytics.dailyMap[cell.dateIso].revenue);
      }
    }
    return maxVal;
  }, [calendarCells, analytics.dailyMap]);

  const shiftMonth = (delta: number) => {
    if (!activeYm) return;
    const [y, m] = activeYm.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    const nextYm = dt.toISOString().slice(0, 7);
    setActiveYm(nextYm);
  };

  const selectedDayData = selectedDate ? analytics.dailyMap[selectedDate] : undefined;
  const maxWeeklyRev = Math.max(1, ...analytics.weeklyList.map((w) => w.revenue));
  const maxMonthlyRev = Math.max(1, ...analytics.monthlyList.map((m) => m.revenue));

  if (analytics.dailyList.length === 0 && !dateFrom && !dateTo) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
      {/* Bar Kontrol Filter Waktu & Mode Tampilan */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'kalender', label: 'Kalender Harian' },
              { id: 'mingguan', label: 'Per Minggu' },
              { id: 'bulanan', label: 'Per Bulan' },
            ] as { id: ViewGranularity; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                viewMode === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Cepat & Rentang Tanggal */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => applyPreset('all')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => applyPreset('7d')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => applyPreset('30d')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
          >
            30 Hari
          </button>
          <button
            type="button"
            onClick={() => applyPreset('month')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
          >
            Bulan Terakhir
          </button>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              aria-label="Dari tanggal"
            />
            <span className="text-slate-400">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              aria-label="Sampai tanggal"
            />
          </div>
        </div>
      </div>

      {/* Ringkasan Periode Terpilih */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
          <p className="text-[11px] text-slate-500">Omzet Periode Ini</p>
          <p className="text-sm sm:text-base font-extrabold text-emerald-600 mt-0.5">
            {formatFullRupiah(analytics.totals.revenue, currency)}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
          <p className="text-[11px] text-slate-500">Laba Kotor</p>
          <p className="text-sm sm:text-base font-extrabold mt-0.5">
            {formatFullRupiah(analytics.totals.grossProfit, currency)}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
          <p className="text-[11px] text-slate-500">Pengeluaran Kas</p>
          <p className="text-sm sm:text-base font-extrabold text-amber-600 mt-0.5">
            {formatFullRupiah(analytics.totals.expense, currency)}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
          <p className="text-[11px] text-slate-500">Total Transaksi</p>
          <p className="text-sm sm:text-base font-extrabold mt-0.5">
            {analytics.totals.transactions.toLocaleString('id-ID')} trx
          </p>
        </div>
      </div>

      {/* MODE 1: KALENDER HARIAN INTERAKTIF */}
      {viewMode === 'kalender' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            {/* Navigasi Bulan Kalender */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-sm">
                  {activeYm ? formatMonthLabel(activeYm) : 'Kalender'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {analytics.availableMonths.length > 0 && (
                  <select
                    value={activeYm}
                    onChange={(e) => setActiveYm(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    {analytics.availableMonths.map((m) => (
                      <option key={m.ym} value={m.ym}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Header Nama Hari */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-slate-400">
              {DAY_HEADERS.map((h) => (
                <div key={h} className="py-1">
                  {h}
                </div>
              ))}
            </div>

            {/* Kotak Tanggal */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, idx) => {
                if (!cell.dateIso || !cell.dayNum) {
                  return <div key={`empty_${idx}`} className="h-16 sm:h-20 rounded-xl" />;
                }

                const dayMetric = analytics.dailyMap[cell.dateIso];
                const isSelected = selectedDate === cell.dateIso;
                const intensity =
                  dayMetric && maxDailyRevenueInMonth > 0
                    ? dayMetric.revenue / maxDailyRevenueInMonth
                    : 0;

                return (
                  <button
                    key={cell.dateIso}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateIso!)}
                    className={`h-16 sm:h-20 p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/60'
                        : dayMetric
                          ? intensity > 0.65
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 hover:border-emerald-500'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400'
                          : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold">{cell.dayNum}</span>
                      {dayMetric && dayMetric.transactions > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 font-semibold">
                          {dayMetric.transactions}x
                        </span>
                      )}
                    </div>

                    {dayMetric ? (
                      <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 truncate w-full">
                        {formatCompactRupiah(dayMetric.revenue, currency)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 dark:text-slate-700">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail Tanggal Terpilih */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs text-slate-500">Detail Tanggal</p>
                <p className="font-bold text-sm">
                  {selectedDate ? formatShortDateId(selectedDate) : 'Pilih tanggal'}
                </p>
              </div>
            </div>

            {selectedDayData ? (
              <>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Omzet Penjualan</span>
                    <span className="font-bold text-emerald-600">
                      {formatFullRupiah(selectedDayData.revenue, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Laba Kotor</span>
                    <span className="font-bold">
                      {formatFullRupiah(selectedDayData.grossProfit, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pengeluaran Kas</span>
                    <span className="font-bold text-amber-600">
                      {formatFullRupiah(selectedDayData.expense, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="font-semibold">Arus Kas Bersih</span>
                    <span className="font-extrabold">
                      {formatFullRupiah(selectedDayData.netCashflow, currency)}
                    </span>
                  </div>
                </div>

                {selectedDayData.topProducts.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Produk Terlaris Hari Ini ({selectedDayData.transactions} transaksi):
                    </p>
                    <div className="space-y-1.5">
                      {selectedDayData.topProducts.map((p) => (
                        <div
                          key={p.name}
                          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                        >
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="font-bold text-emerald-600 shrink-0">
                            {p.qty}x • {formatCompactRupiah(p.revenue, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                Tidak ada transaksi tercatat pada tanggal ini.
              </p>
            )}
          </div>
        </div>
      )}

      {/* MODE 2 & 3: REKAP MINGGUAN & BULANAN */}
      {(viewMode === 'mingguan' || viewMode === 'bulanan') && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                <th className="py-2.5 pr-4 font-bold">
                  {viewMode === 'mingguan' ? 'Periode Minggu' : 'Bulan'}
                </th>
                <th className="py-2.5 px-3 font-bold text-right">Transaksi</th>
                <th className="py-2.5 px-3 font-bold text-right">Omzet</th>
                <th className="py-2.5 px-3 font-bold text-right">Laba Kotor</th>
                <th className="py-2.5 px-3 font-bold text-right">Pengeluaran</th>
                <th className="py-2.5 pl-3 font-bold text-right">Tren Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(viewMode === 'mingguan' ? analytics.weeklyList : analytics.monthlyList)
                .slice()
                .reverse()
                .map((row) => {
                  const maxRef =
                    viewMode === 'mingguan' ? maxWeeklyRev : maxMonthlyRev;
                  const barPct = Math.min(100, Math.round((row.revenue / maxRef) * 100));

                  return (
                    <tr
                      key={row.key}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-bold">{row.label}</div>
                        <div className="w-32 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {row.transactions.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        {formatFullRupiah(row.revenue, currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        {formatFullRupiah(row.grossProfit, currency)}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-600 font-medium">
                        {formatFullRupiah(row.expense, currency)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        {row.growthPercent === null ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : row.growthPercent >= 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            {formatPercent(row.growthPercent)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            {formatPercent(Math.abs(row.growthPercent))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}