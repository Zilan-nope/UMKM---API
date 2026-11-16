export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;

  let raw = value.replace(/\u00A0/g, ' ').trim();
  if (!raw) return null;

  let isNegative = false;
  if (/^\(.*\)$/.test(raw)) {
    isNegative = true;
    raw = raw.slice(1, -1).trim();
  }

  raw = raw.replace(/rp\.?|idr|\s/gi, '');
  if (!raw) return null;

  if (raw.startsWith('-')) {
    isNegative = true;
    raw = raw.slice(1);
  } else if (raw.startsWith('+')) {
    raw = raw.slice(1);
  }

  if (!raw || !/^\d[\d.,]*$/.test(raw)) {
    return null;
  }

  let normalized = raw;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    normalized = raw.replace(/,/g, '');
  } else if (/^\d+,\d+$/.test(raw)) {
    normalized = raw.replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+$/.test(raw)) {
    normalized = raw.replace(/,/g, '');
  } else if (/^\d+\.\d{1,2}$/.test(raw)) {
    normalized = raw;
  } else if ((raw.match(/\./g) ?? []).length > 1 && !raw.includes(',')) {
    normalized = raw.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  const result = isNegative ? -Math.abs(parsed) : parsed;
  return Object.is(result, -0) ? 0 : result;
}

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = parseNumericValue(value);
  return parsed !== null ? parsed : fallback;
}

export function isSummaryLabel(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return false;
  return /^(total|sub\s*total|grand\s*total|jumlah(\s+total|\s+keseluruhan)?|rekap(\s+total)?|saldo\s+akhir)$/.test(
    cleaned
  );
}