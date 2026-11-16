export interface DictionaryEntry {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  answer: string;
}

// Kamus normalisasi singkatan & bahasa sehari-hari pemilik warung/UMKM
const SLANG_MAP: Record<string, string> = {
  brp: 'berapa',
  brapa: 'berapa',
  yg: 'yang',
  dgn: 'dengan',
  utk: 'untuk',
  bwt: 'buat',
  ga: 'tidak',
  gak: 'tidak',
  nggak: 'tidak',
  tdk: 'tidak',
  sdh: 'sudah',
  udh: 'sudah',
  blm: 'belum',
  skrg: 'sekarang',
  tgl: 'tanggal',
  kmrn: 'kemarin',
  bsk: 'besok',
  krn: 'karena',
  tp: 'tapi',
  jg: 'juga',
  aja: 'saja',
  bati: 'untung',
  cuan: 'untung',
  profit: 'untung',
  boncos: 'rugi',
  tekor: 'rugi',
  omset: 'omzet',
  kulak: 'kulakan',
  restok: 'kulakan',
  restock: 'kulakan',
  belanja: 'kulakan',
  pegawai: 'karyawan',
  staf: 'karyawan',
  staff: 'karyawan',
  upah: 'gaji',
  bon: 'kasbon',
  utang: 'kasbon',
  hutang: 'kasbon',
  piutang: 'kasbon',
  promo: 'promosi',
  wa: 'whatsapp',
};

export function normalizeIndonesianQuery(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[?!.,;:"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned
    .split(' ')
    .map((word) => SLANG_MAP[word] ?? word)
    .join(' ');
}

// Kamus Besar Pengetahuan Bisnis, Keuangan, Stok & Pemasaran UMKM
export const UMKM_DICTIONARY: DictionaryEntry[] = [
  {
    id: 'hpp',
    category: 'Keuangan & Harga',
    title: 'Cara Menghitung HPP (Harga Pokok Penjualan) & Harga Jual',
    keywords: ['hpp', 'harga pokok', 'menentukan harga', 'patok harga', 'harga jual', 'hitung modal'],
    answer:
      `📘 **Kamus UMKM — Cara Menentukan HPP & Harga Jual:**\n` +
      `1. **HPP (Modal Bersih)** = Harga beli barang dari supplier + ongkos kirim + biaya kemasan (plastik/cup/label).\n` +
      `2. **Rumus Harga Jual:**\n` +
      `   • Sembako / Barang Cepat Laku: HPP + **10% s/d 20%**\n` +
      `   • Makanan / Minuman / Kuliner: HPP + **40% s/d 100%** (karena ada risiko bahan basi & gas/listrik)\n` +
      `   • Aksesoris / Pakaian / Barang Non-Pangan: HPP + **30% s/d 60%**\n\n` +
      `💡 *Tips:* Kamu bisa langsung ketik di chat ini: **"modal 15000 jual 18500"** untuk menghitung margin keuntungannya otomatis.`,
  },
  {
    id: 'laba_kotor_bersih',
    category: 'Keuangan & Harga',
    title: 'Perbedaan Omzet, Laba Kotor, dan Laba Bersih',
    keywords: ['beda omzet', 'laba kotor', 'laba bersih', 'pendapatan bersih', 'pengertian omzet'],
    answer:
      `📘 **Kamus UMKM — Omzet vs Laba Kotor vs Laba Bersih:**\n` +
      `• **Omzet:** Seluruh uang masuk dari hasil penjualan sebelum dipotong apa pun.\n` +
      `• **Laba Kotor:** Omzet dikurangi harga modal barang yang terjual.\n` +
      `• **Laba Bersih:** Laba kotor dikurangi semua biaya operasional (listrik, plastik, bensin, sewa tempat, dan gaji karyawan).\n\n` +
      `⚠️ **Ingat:** Omzet besar belum tentu untung besar jika biaya operasional dan kebocoran stok tidak dicatat!`,
  },
  {
    id: 'pisahkan_uang',
    category: 'Keuangan & Harga',
    title: 'Cara Memisahkan Uang Pribadi & Uang Usaha',
    keywords: ['uang pribadi', 'uang dapur', 'tercampur', 'mengatur uang', 'kelola keuangan', 'manajemen kas'],
    answer:
      `📘 **Kamus UMKM — Aturan Emas Memisahkan Uang Usaha:**\n` +
      `1. **Gaji Diri Sendiri:** Tetapkan gaji tetap untuk pemilik (misal Rp 100.000/hari atau bulanan). Jangan ambil uang laci kasir sembarangan untuk belanja dapur.\n` +
      `2. **Dua Dompet / Dua Rekening:** Pisahkan tempat penyimpanan modal kulakan dengan uang belanja keluarga.\n` +
      `3. **Alokasi Laba:** Bagi keuntungan bersih bulanan menjadi **50% tambah modal stok**, **30% dana darurat toko**, dan **20% tabungan pemilik**.`,
  },
  {
    id: 'kasbon',
    category: 'Keuangan & Harga',
    title: 'Cara Mengelola Kasbon / Piutang Pelanggan Agar Tidak Macet',
    keywords: ['kasbon', 'ngutang', 'piutang', 'pelanggan hutang', 'tagih hutang', 'kredit'],
    answer:
      `📘 **Kamus UMKM — Strategi Aman Menghadapi Kasbon:**\n` +
      `1. **Batas Maksimal (Plafon):** Batasi kasbon maksimal Rp 100.000 – Rp 200.000 per pelanggan dan tidak boleh tambah kasbon sebelum yang lama lunas.\n` +
      `2. **Tanggal Jatuh Tempo Jelas:** Sepakati tanggal bayar (misal tiap tanggal gajian atau akhir pekan).\n` +
      `3. **Total Piutang Maksimal 10% Modal:** Jangan biarkan lebih dari 10% modal barang tertahan di kasbon agar warung tidak kehabisan uang untuk kulakan.`,
  },
  {
    id: 'bep',
    category: 'Keuangan & Harga',
    title: 'Cara Menghitung BEP (Balik Modal)',
    keywords: ['bep', 'balik modal', 'break even', 'kapan balik modal'],
    answer:
      `📘 **Kamus UMKM — Rumus BEP (Titik Balik Modal):**\n` +
      `• **BEP Rupiah** = Total Biaya Tetap (Sewa + Gaji + Listrik) ÷ Persentase Margin Laba.\n` +
      `• **Contoh:** Jika biaya tetap warung Rp 3.000.000/bulan dan rata-rata untung produk 20% (0,2), maka target omzet minimal agar tidak rugi adalah **Rp 3.000.000 ÷ 0,2 = Rp 15.000.000/bulan** (atau Rp 500.000/hari).`,
  },
  {
    id: 'dead_stock',
    category: 'Stok & Gudang',
    title: 'Cara Mengatasi Barang Macet / Tidak Laku (Dead Stock)',
    keywords: ['barang macet', 'tidak laku', 'stok mati', 'dead stock', 'kadaluarsa', 'expired', 'numpuk'],
    answer:
      `📘 **Kamus UMKM — Solusi Barang Numpuk / Lambat Laku:**\n` +
      `1. **Sistem FIFO (First In, First Out):** Barang yang datang lebih dulu wajib ditaruh di rak paling depan agar terjual lebih awal.\n` +
      `2. **Paket Bundling:** Gabungkan barang yang lambat laku dengan barang terlaris (contoh: beli Beras 5kg + Kecap manis harga paket hemat).\n` +
      `3. **Diskon Cuci Gudang:** Jika mendekati masa kadaluarsa, jual di harga modal daripada rugi 100% karena dibuang.`,
  },
  {
    id: 'stock_opname',
    category: 'Stok & Gudang',
    title: 'Cara Melakukan Stock Opname (Cek Fisik Barang)',
    keywords: ['opname', 'cek fisik', 'barang hilang', 'selisih stok', 'audit stok'],
    answer:
      `📘 **Kamus UMKM — Langkah Praktis Stock Opname:**\n` +
      `1. Lakukan penghitungan fisik seminggu sekali untuk 10 barang paling laris (rokok, beras, minyak, gas, gula).\n` +
      `2. Bandingkan jumlah fisik di rak dengan angka **Sisa Stok** di menu **Database Usaha -> Produk & Stok**.\n` +
      `3. Jika sering terjadi selisih minus, perketat pencatatan barang keluar dan periksa area kasir/gudang.`,
  },
  {
    id: 'kulakan_hemat',
    category: 'Stok & Gudang',
    title: 'Strategi Kulakan / Belanja Stok Hemat Modal',
    keywords: ['strategi kulakan', 'tips kulakan', 'supplier', 'agen grosir', 'belanja murah'],
    answer:
      `📘 **Kamus UMKM — Tips Kulakan Cerdas:**\n` +
      `1. **Bandingkan Minimal 3 Agen:** Selisih Rp 500 per barang akan terasa besar jika dikalikan ratusan transaksi.\n` +
      `2. **Fokus 80/20 (Hukum Pareto):** 80% modal belanja sebaiknya dialokasikan untuk 20% jenis barang yang perputarannya paling cepat.\n` +
      `3. **Jangan Terpancing Bonus Barang Sepi:** Hindari beli partai besar hanya demi hadiah jika barangnya butuh berbulan-bulan untuk habis.`,
  },
  {
    id: 'perang_harga',
    category: 'Pemasaran & Pelanggan',
    title: 'Cara Menghadapi Persaingan & Perang Harga Toko Sebelah',
    keywords: ['saingan', 'kompetitor', 'perang harga', 'toko sebelah', 'minimarket', 'lebih murah', 'sepi pembeli'],
    answer:
      `📘 **Kamus UMKM — Menang Tanpa Ikut Perang Harga:**\n` +
      `1. **Jual Eceran / Ketengan:** Minimarket tidak menjual eceran kecil (bumbu dapur satuan, rokok ketengan, gula 1/4 kg). Ini keunggulan utama warung.\n` +
      `2. **Layanan Antar Gratis via WhatsApp:** Terima pesanan lewat WA dan antar gratis untuk tetangga sekitar.\n` +
      `3. **Kecepatan & Keramahan:** Hafalkan nama pelanggan dan produk langganannya—hubungan personal tidak bisa ditiru toko modern.`,
  },
  {
    id: 'jam_ramai',
    category: 'Operasional Toko',
    title: 'Tips Mengatur Jam Buka & Operasional Warung',
    keywords: ['jam buka', 'jam ramai', 'operasional', 'tutup toko', 'shift'],
    answer:
      `📘 **Kamus UMKM — Optimalisasi Jam Operasional:**\n` +
      `• **Pagi (06.00 – 09.00):** Waktu puncak ibu rumah tangga belanja kebutuhan masak, sarapan, gas, dan galon.\n` +
      `• **Sore – Malam (16.30 – 21.00):** Waktu puncak pekerja pulang kantor belanja minuman dingin, camilan, pulsa/token, dan kebutuhan mendadak.\n` +
      `• Pastikan stok barang utama sudah terisi sebelum dua jam sibuk tersebut.`,
  },
  {
    id: 'kelola_karyawan',
    category: 'SDM & Karyawan',
    title: 'Tips Mengatur Karyawan & Sistem Bonus Penjualan',
    keywords: ['atur karyawan', 'bonus karyawan', 'insentif', 'karyawan jujur', 'sistem gaji'],
    answer:
      `📘 **Kamus UMKM — Manajemen Karyawan UMKM:**\n` +
      `1. **Pisahkan Tanggung Jawab Kasir & Stok:** Biasakan serah terima uang laci dan catatan transaksi setiap pergantian shift.\n` +
      `2. **Gaji Pokok + Bonus Target:** Berikan gaji pokok yang layak ditambah bonus harian/bulanan jika omzet toko melewati target tertentu.\n` +
      `3. **Catat Semua Data Karyawan:** Simpan kontak, jabatan, dan nominal gaji di menu **Database Usaha -> Karyawan** agar beban gaji terhitung otomatis.`,
  },
  {
    id: 'pajak_umkm',
    category: 'Legalitas & Pajak',
    title: 'Info Pajak UMKM (PPh Final 0,5%) & NIB',
    keywords: ['pajak', 'pph', 'nib', 'izin usaha', 'legalitas', 'npwp'],
    answer:
      `📘 **Kamus UMKM — Pajak & Legalitas Dasar:**\n` +
      `• **Bebas Pajak Omzet s/d Rp 500 Juta/Tahun:** Untuk UMKM perorangan dengan omzet di bawah Rp 500 juta setahun, tarif PPh Final adalah **0% (Gratis)**.\n` +
      `• **Di Atas Rp 500 Juta/Tahun:** Dikenakan PPh Final UMKM sebesar **0,5%** dari kelebihan omzet.\n` +
      `• **NIB (Nomor Induk Berusaha):** Bisa dibuat gratis secara online di **oss.go.id** sebagai syarat pengajuan KUR bank maupun pendaftaran QRIS usaha.`,
  },
];

export function searchUmkmDictionary(normalizedQuery: string): DictionaryEntry | null {
  let bestMatch: DictionaryEntry | null = null;
  let bestScore = 0;

  for (const entry of UMKM_DICTIONARY) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (normalizedQuery.includes(kw)) {
        score += kw.split(' ').length * 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}