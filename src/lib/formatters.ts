export function formatFullRupiah(amount: number, currency = 'IDR'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency || 'IDR',
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `Rp ${Math.round(safe).toLocaleString('id-ID')}`;
  }
}

export function formatCompactRupiah(amount: number, currency = 'IDR'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  const prefix = currency === 'USD' ? '$' : 'Rp ';

  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(2).replace(/\.00$/, '')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(2).replace(/\.00$/, '')} jt`;
  }
  if (abs >= 100_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(0)} rb`;
  }
  return formatFullRupiah(safe, currency);
}

export function formatCompactAxis(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}${abs}`;
}

export function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('id-ID');
}

export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1)}%`;
}

export const formatRupiah = formatFullRupiah;
export const formatCurrency = formatFullRupiah;