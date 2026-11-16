const ID_MONTH_MAP: Record<string, string> = {
  jan: '01',
  januari: '01',
  january: '01',
  feb: '02',
  februari: '02',
  february: '02',
  mar: '03',
  maret: '03',
  march: '03',
  apr: '04',
  april: '04',
  mei: '05',
  may: '05',
  jun: '06',
  juni: '06',
  june: '06',
  jul: '07',
  juli: '07',
  july: '07',
  agu: '08',
  agt: '08',
  agustus: '08',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  okt: '10',
  oktober: '10',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  des: '12',
  desember: '12',
  dec: '12',
  december: '12',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidYMD(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function normalizeBusinessDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value) && value >= 25000 && value <= 80000) {
    const utcDays = Math.floor(value - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  const raw = String(value).trim();
  if (!raw) return '';

  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial >= 25000 && serial <= 80000) {
      const utcDays = Math.floor(serial - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidYMD(y, m, d)) return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const dmyMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);

    if (first <= 12 && second > 12 && isValidYMD(y, first, second)) {
      return `${y}-${pad2(first)}-${pad2(second)}`;
    }
    if (isValidYMD(y, second, first)) {
      return `${y}-${pad2(second)}-${pad2(first)}`;
    }
  }

  const textMonthMatch = raw.match(/^(\d{1,2})[\s-]+([a-zA-Z]+)[\s,-]+(\d{4})/);
  if (textMonthMatch) {
    const d = Number(textMonthMatch[1]);
    const mStr = ID_MONTH_MAP[textMonthMatch[2].toLowerCase()];
    const y = Number(textMonthMatch[3]);
    if (mStr && isValidYMD(y, Number(mStr), d)) {
      return `${y}-${mStr}-${pad2(d)}`;
    }
  }

  return '';
}

export function compareIsoDates(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}