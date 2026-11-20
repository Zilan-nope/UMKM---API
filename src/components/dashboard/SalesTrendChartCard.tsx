import {
  BarChart3,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SavedDataset } from '../../lib/datasetStorage';
import {
  formatCompactRupiah,
  formatFullRupiah,
} from '../../lib/formatters';
import {
  buildTimeAnalytics,
  formatMonthLabel,
  formatShortDateId,
} from '../../lib/timeAnalytics';

interface SalesTrendChartCardProps {
  savedDatasets: SavedDataset[];
  currency: string;
}

type ChartGranularity = 'harian' | 'mingguan' | 'bulanan';
type ChartType = 'bar' | 'line';
type ChartMetric = 'revenue' | 'grossProfit';

interface ChartPoint {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
  transactions: number;
}

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function SalesTrendChartCard({
  savedDatasets,
  currency,
}: SalesTrendChartCardProps) {
  const [granularity, setGranularity] = useState<ChartGranularity>('harian');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [metric, setMetric] = useState<ChartMetric>('revenue');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);
  const [calendarYm, setCalendarYm] = useState<string>('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const analytics = useMemo(
    () => buildTimeAnalytics(savedDatasets, dateFrom || undefined, dateTo || undefined),
    [savedDatasets, dateFrom, dateTo]
  );

  useEffect(() => {
    if (analytics.availableMonths.length > 0 && !calendarYm) {
      setCalendarYm(
        analytics.availableMonths[analytics.availableMonths.length - 1].ym
      );
    }
  }, [analytics.availableMonths, calendarYm]);

  const applyPreset = (preset: 'all' | '7d' | '30d' | 'month') => {
    setHoveredIdx(null);
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

  const handleSelectCalendarDay = (iso: string) => {
    setHoveredIdx(null);
    if (!dateFrom || (dateFrom && dateTo)) {
      setDateFrom(iso);
      setDateTo('');
    } else if (iso < dateFrom) {
      setDateTo(dateFrom);
      setDateFrom(iso);
    } else {
      setDateTo(iso);
    }
  };

  const points = useMemo<ChartPoint[]>(() => {
    if (granularity === 'harian') {
      return analytics.dailyList.slice(-60).map((d) => ({
        key: d.dateIso,
        label: `${d.dateIso.slice(8, 10)}/${d.dateIso.slice(5, 7)}`,
        fullLabel: formatShortDateId(d.dateIso),
        value: metric === 'revenue' ? d.revenue : d.grossProfit,
        transactions: d.transactions,
      }));
    }
    if (granularity === 'mingguan') {
      return analytics.weeklyList.slice(-26).map((w) => ({
        key: w.key,
        label: w.subLabel,
        fullLabel: w.label,
        value: metric === 'revenue' ? w.revenue : w.grossProfit,
        transactions: w.transactions,
      }));
    }
    return analytics.monthlyList.map((m) => ({
      key: m.key,
      label: `${m.label.slice(0, 3)} ${m.key.slice(2, 4)}`,
      fullLabel: m.label,
      value: metric === 'revenue' ? m.revenue : m.grossProfit,
      transactions: m.transactions,
    }));
  }, [analytics, granularity, metric]);

  const maxVal = useMemo(() => {
    let highest = 1;
    for (let i = 0; i < points.length; i++) {
      if (points[i].value > highest) highest = points[i].value;
    }
    return highest;
  }, [points]);

  const calendarCells = useMemo(() => {
    if (!calendarYm) return [];
    const [year, month] = calendarYm.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const cells: { iso: string | null; day: number | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ iso: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        iso: `${calendarYm}-${String(d).padStart(2, '0')}`,
        day: d,
      });
    }
    return cells;
  }, [calendarYm]);

  const shiftCalendarMonth = (delta: number) => {
    if (!calendarYm) return;
    const [y, m] = calendarYm.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setCalendarYm(dt.toISOString().slice(0, 7));
  };

  if (analytics.dailyList.length === 0 && !dateFrom && !dateTo) {
    return null;
  }

  const activePoint =
    hoveredIdx !== null && points[hoveredIdx]
      ? points[hoveredIdx]
      : points[points.length - 1] ?? null;

  const svgWidth = 860;
  const svgHeight = 220;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 28;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-sm sm:text-base">
              Tren {metric === 'revenue' ? 'Penjualan (Omzet)' : 'Laba Kotor'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Periode terpilih:{' '}
            <strong className="text-emerald-600">
              {formatFullRupiah(
                metric === 'revenue'
                  ? analytics.totals.revenue
                  : analytics.totals.grossProfit,
                currency
              )}
            </strong>{' '}
            ({analytics.totals.transactions.toLocaleString('id-ID')} transaksi)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`px-2.5 py-1 rounded-lg font-bold ${
                metric === 'revenue'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              Omzet
            </button>
            <button
              type="button"
              onClick={() => setMetric('grossProfit')}
              className={`px-2.5 py-1 rounded-lg font-bold ${
                metric === 'grossProfit'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              Laba Kotor
            </button>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {(
              [
                { id: 'harian', label: 'Harian' },
                { id: 'mingguan', label: 'Mingguan' },
                { id: 'bulanan', label: 'Bulanan' },
              ] as { id: ChartGranularity; label: string }[]
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGranularity(g.id);
                  setHoveredIdx(null);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  granularity === g.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg ${
                chartType === 'bar'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs'
                  : 'text-slate-500'
              }`}
              title="Diagram Batang"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-lg ${
                chartType === 'line'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs'
                  : 'text-slate-500'
              }`}
              title="Grafik Garis"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Kalender */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset('all')}
            className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
              !dateFrom && !dateTo
                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => applyPreset('7d')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => applyPreset('30d')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
          >
            30 Hari
          </button>
          <button
            type="button"
            onClick={() => applyPreset('month')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
          >
            Bulan Terakhir
          </button>
          <button
            type="button"
            onClick={() => setShowCalendarPicker((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-semibold ${
              showCalendarPicker
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Kalender</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />
        </div>
      </div>

      {showCalendarPicker && (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">
              {calendarYm ? formatMonthLabel(calendarYm) : 'Kalender'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftCalendarMonth(-1)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => shiftCalendarMonth(1)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
            {DAY_HEADERS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.iso || !cell.day) return <div key={`c_${idx}`} className="h-8" />;
              const isStart = dateFrom === cell.iso;
              const isEnd = dateTo === cell.iso;
              const isInRange =
                Boolean(dateFrom && dateTo) && cell.iso > dateFrom && cell.iso < dateTo;
              const hasTx = Boolean(analytics.dailyMap[cell.iso]);

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => handleSelectCalendarDay(cell.iso!)}
                  className={`h-8 rounded-lg text-xs font-semibold ${
                    isStart || isEnd
                      ? 'bg-emerald-600 text-white'
                      : isInRange
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                        : hasTx
                          ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                          : 'text-slate-400'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activePoint && (
        <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold">{activePoint.fullLabel}</span>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              {activePoint.transactions.toLocaleString('id-ID')} transaksi
            </span>
            <span className="font-extrabold text-emerald-600">
              {formatFullRupiah(activePoint.value, currency)}
            </span>
          </div>
        </div>
      )}

      {points.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-8">
          Tidak ada transaksi pada rentang kalender yang dipilih.
        </p>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-56 select-none overflow-visible"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padTop + plotHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    x2={svgWidth - padRight}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeDasharray={ratio === 0 ? undefined : '4 4'}
                    strokeWidth={1}
                  />
                  {ratio > 0 && (
                    <text x={padLeft} y={y - 4} fontSize="10" className="fill-slate-400">
                      {formatCompactRupiah(maxVal * ratio, currency)}
                    </text>
                  )}
                </g>
              );
            })}

            {chartType === 'bar' &&
              points.map((pt, idx) => {
                const slotW = plotWidth / points.length;
                const barW = Math.max(4, Math.min(38, slotW * 0.68));
                const barH = Math.max(2, (pt.value / maxVal) * plotHeight);
                const x = padLeft + idx * slotW + (slotW - barW) / 2;
                const y = padTop + plotHeight - barH;
                const labelStep = Math.max(1, Math.ceil(points.length / 12));

                return (
                  <g
                    key={pt.key}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onClick={() => setHoveredIdx(idx)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={4}
                      className={
                        hoveredIdx === idx
                          ? 'fill-emerald-500'
                          : 'fill-emerald-600/85 hover:fill-emerald-500'
                      }
                    />
                    {idx % labelStep === 0 && (
                      <text
                        x={x + barW / 2}
                        y={svgHeight - 8}
                        textAnchor="middle"
                        fontSize="10"
                        className="fill-slate-400 font-medium"
                      >
                        {pt.label}
                      </text>
                    )}
                  </g>
                );
              })}

            {chartType === 'line' &&
              (() => {
                const coords = points.map((pt, idx) => {
                  const stepX =
                    points.length > 1 ? plotWidth / (points.length - 1) : plotWidth / 2;
                  const x =
                    points.length > 1
                      ? padLeft + idx * stepX
                      : padLeft + plotWidth / 2;
                  const y = padTop + plotHeight - (pt.value / maxVal) * plotHeight;
                  return { x, y, pt, idx };
                });
                const polyPoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
                const areaPoints = `${coords[0].x},${padTop + plotHeight} ${polyPoints} ${coords[coords.length - 1].x},${padTop + plotHeight}`;
                const labelStep = Math.max(1, Math.ceil(points.length / 12));

                return (
                  <>
                    <polygon points={areaPoints} className="fill-emerald-500/15" />
                    <polyline
                      fill="none"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={polyPoints}
                      className="stroke-emerald-600"
                    />
                    {coords.map(({ x, y, pt, idx }) => (
                      <g
                        key={pt.key}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onClick={() => setHoveredIdx(idx)}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={hoveredIdx === idx ? 5.5 : 3.5}
                          className="fill-emerald-600 stroke-white dark:stroke-slate-900"
                          strokeWidth={1.5}
                        />
                        {idx % labelStep === 0 && (
                          <text
                            x={x}
                            y={svgHeight - 8}
                            textAnchor="middle"
                            fontSize="10"
                            className="fill-slate-400 font-medium"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    ))}
                  </>
                );
              })()}
          </svg>
        </div>
      )}
    </div>
  );
}