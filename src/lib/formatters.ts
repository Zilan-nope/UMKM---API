export function formatFullRupiah(amount: number, currency = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactRupiah(amount: number, currency = 'IDR'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const prefix = currency === 'IDR' ? 'Rp ' : `${currency} `;

  if (abs >= 1_000_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000_000).toFixed(2).replace('.', ',')} T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(2).replace('.', ',')} Jt`;
  }
  return formatFullRupiah(amount, currency);
}

export function formatCompactAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)} Rb`;
  }
  return `${value}`;
}