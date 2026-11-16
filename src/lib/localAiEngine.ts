import type { StoredDataset } from '../context/AppContext';
import type { BusinessProfile } from '../types/navigation';
import {
  calculateFinanceMetrics,
  calculateGenericMetrics,
  calculateInventoryMetrics,
  calculateSalesMetrics,
} from './analyticsEngine';
import { parseNumericValue } from './fileParser';
import { normalizeIndonesianQuery, searchUmkmDictionary } from './umkmDictionary';

export interface LocalAiContext {
  datasets: StoredDataset[];
  profile: BusinessProfile;
}

function rpFormat(amount: number, currency: string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function tryCalc(raw: string, currency: string): string | null {
  const q = raw.toLowerCase().trim();

  const margin = q.match(/modal\s*(\d+(?:[.,]\d+)?)\s*(?:jual|harga\s*jual)\s*(\d+(?:[.,]\d+)?)/);
  if (margin) {
    const m = Number(margin[1].replace(/\./g, '').replace(',', '.'));
    const j = Number(margin[2].replace(/\./g, '').replace(',', '.'));
    const untung = j - m;
    const pct = j > 0 ? ((untung / j) * 100).toFixed(1) : '0';
    return `Modal ${rpFormat(m, currency)} → Jual ${rpFormat(j, currency)} | Untung: **${rpFormat(untung, currency)}/unit** (Margin ${pct}%).`;
  }

  const pct = q.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:dari|x|\*)\s*(\d+(?:[.,]\d+)?)/);
  if (pct) {
    const p = Number(pct[1].replace(',', '.'));
    const base = Number(pct[2].replace(/\./g, '').replace(',', '.'));
    return `${p}% dari ${rpFormat(base, currency)} = **${rpFormat((p / 100) * base, currency)}**.`;
  }

  const expr = q
    .replace(/^(hitung|berapa|hasil|total)\s+/i, '')
    .replace(/x/g, '*')
    .replace(/:/g, '/')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const match = expr.match(/^(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const a = Number(match[1]);
  const b = Number(match[3]);
  if (match[2] === '/' && b === 0) return 'Tidak bisa dibagi 0.';
  const res =
    match[2] === '+' ? a + b : match[2] === '-' ? a - b : match[2] === '*' ? a * b : a / b;
  return `Hasil: **${res.toLocaleString('id-ID')}** (${rpFormat(res, currency)}).`;
}

export function generateSmartOfflineReply(rawQuestion: string, ctx: LocalAiContext): string {
  const qNorm = normalizeIndonesianQuery(rawQuestion);
  const { datasets, profile } = ctx;
  const rp = (n: number) => rpFormat(n, profile.currency);

  const salesDs = datasets.find((d) => d.category === 'sales' && d.rows.length > 0);
  const buyDs = datasets.find((d) => d.category === 'finance' && d.rows.length > 0);
  const invDs = datasets.find((d) => d.category === 'inventory' && d.rows.length > 0);
  const empDs = datasets.find((d) => d.category === 'employee' && d.rows.length > 0);

  // 1. Tanggal & Jam
  if (/(tanggal\s*berapa|hari\s*apa|jam\s*berapa|sekarang\s*tanggal)/.test(qNorm)) {
    const now = new Date();
    const tgl = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
    const jam = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(now);
    return `Sekarang **${tgl}**, pukul **${jam}**.`;
  }

  // 2. Sapaan
  if (/^(halo+|hai+|hei+|pagi|siang|sore|malam|assalamualaikum|tes|test|makasih|terima\s*kasih)[!.? ]*$/.test(qNorm)) {
    return `Halo ${profile.ownerName}! Mau cek untung-rugi, stok menipis, atau cari produk tertentu?`;
  }

  // 3. Kalkulator cepat
  const calc = tryCalc(rawQuestion, profile.currency);
  if (calc) return calc;

  // 4. Promosi WA
  if (/(promosi|iklan|whatsapp|broadcast|status)/.test(qNorm)) {
    const top = salesDs ? calculateSalesMetrics(salesDs).topProducts[0]?.name : 'produk pilihan';
    return `"Halo! Stok **${top ?? 'kebutuhan harian'}** di **${profile.name}** hari ini ready & siap antar. Balas pesan ini untuk order ya!"`;
  }

  // 5. Kamus UMKM
  const dict = searchUmkmDictionary(qNorm);
  if (dict) return dict.answer;

  // 6. Cari Produk Spesifik
  const stop = new Set(['berapa', 'stok', 'harga', 'jual', 'modal', 'produk', 'barang', 'sisa', 'cek', 'yang', 'ada', 'ini', 'apa']);
  const kws = qNorm.split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w));
  if (kws.length > 0 && invDs) {
    const found = invDs.rows.filter((r) =>
      kws.some((k) => String(r['Nama_Produk'] ?? '').toLowerCase().includes(k))
    );
    if (found.length > 0) {
      return found
        .slice(0, 4)
        .map((r) => {
          const nama = String(r['Nama_Produk'] ?? '-');
          const stok = parseNumericValue(r['Stok_Saat_Ini']) ?? 0;
          const modal = parseNumericValue(r['Harga_Modal']) ?? 0;
          const jual = parseNumericValue(r['Harga_Jual']) ?? 0;
          return `• **${nama}**: Sisa **${stok} unit** | Modal ${rp(modal)} | Jual **${rp(jual)}** (Untung ${rp(jual - modal)}/unit)`;
        })
        .join('\n');
    }
  }

  const salesM = salesDs ? calculateSalesMetrics(salesDs) : null;
  const buyM = buyDs ? calculateFinanceMetrics(buyDs) : null;
  const invM = invDs ? calculateInventoryMetrics(invDs) : null;
  const empM = empDs ? calculateGenericMetrics(empDs) : null;

  const omzet = salesM?.totalRevenue ?? 0;
  const keluar = buyM ? (buyM.totalExpense > 0 ? buyM.totalExpense : buyM.totalIncome) : 0;

  // 7. Stok Menipis
  if (/(stok|habis|menipis|kulakan|gudang)/.test(qNorm)) {
    if (!invM) return 'Data stok masih kosong.';
    if (invM.lowStockItems.length === 0) return `Semua stok aman (${invM.totalItems} produk, ${invM.totalStockUnits} unit).`;
    return (
      `⚠️ **Stok Menipis (Segera Kulakan):**\n` +
      invM.lowStockItems.map((i) => `• **${i.name}**: sisa ${i.current} unit (min ${i.min})`).join('\n')
    );
  }

  // 8. Produk Terlaris
  if (/(laris|laku|unggulan|favorit)/.test(qNorm)) {
    if (!salesM || salesM.topProducts.length === 0) return 'Belum ada data penjualan.';
    return (
      `🏆 **Produk Terlaris:**\n` +
      salesM.topProducts
        .slice(0, 5)
        .map((p, i) => `${i + 1}. **${p.name}** (${p.qty} unit — ${rp(p.revenue)})`)
        .join('\n')
    );
  }

  // 9. Karyawan
  if (/(karyawan|gaji)/.test(qNorm)) {
    if (!empM) return 'Data karyawan kosong.';
    return `👥 **${empM.totalRecords} Karyawan** — Total gaji **${rp(empM.totalNumericValue)}/bulan**.`;
  }

  // 10. Untung Rugi / Laporan
  if (/(untung|rugi|laba|omzet|keuangan|laporan|kas)/.test(qNorm)) {
    return (
      `📊 **Ringkasan Keuangan:**\n` +
      `• Omzet: **${rp(omzet)}** (${salesM?.totalTransactions ?? 0} transaksi)\n` +
      `• Laba Kotor Produk: **${salesM?.hasCostData ? rp(salesM.totalGrossProfit) : 'Belum ada data modal'}**\n` +
      `• Pembelian & Keluar: **${rp(keluar)}**\n` +
      `• Selisih Kas: **${rp(omzet - keluar)}**`
    );
  }

  return `Topik "${rawQuestion}" belum dipahami AI Offline. Coba: *"laporan untung rugi"*, *"stok menipis"*, *"produk laris"*, atau *"modal 10000 jual 12000"*.`;
}