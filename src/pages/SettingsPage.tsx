import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Key,
  Moon,
  Save,
  Sun,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import type { BusinessType } from '../types/navigation';

type SettingsTab = 'profil_tema' | 'ai_config' | 'backup';

export function SettingsPage() {
  const { businessProfile, updateBusinessProfile, theme, setThemeMode, savedDatasets } = useApp();
  const [tab, setTab] = useState<SettingsTab>('profil_tema');
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  // --- Tab 1: Profil & Tema ---
  const [name, setName] = useState(businessProfile.name);
  const [ownerName, setOwnerName] = useState(businessProfile.ownerName);
  const [businessType, setBusinessType] = useState<BusinessType>(businessProfile.businessType);
  const [city, setCity] = useState(businessProfile.city);
  const [currency, setCurrency] = useState<'IDR' | 'USD' | 'SGD' | 'MYR'>(businessProfile.currency);

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    updateBusinessProfile({
      name: name.trim() || 'Usaha UMKM Saya',
      ownerName: ownerName.trim() || 'Pemilik Usaha',
      businessType,
      city: city.trim() || 'Indonesia',
      currency,
    });
    showNotice('Profil usaha berhasil disimpan!');
  };

  // --- Tab 2: Pengaturan AI ---
  const [aiMode, setAiMode] = useState<'offline' | 'hybrid'>(() =>
    localStorage.getItem('smart_umkm_ai_mode') === 'hybrid' ? 'hybrid' : 'offline'
  );
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('smart_umkm_gemini_key') ?? '');
  const [showKey, setShowKey] = useState(false);

  const saveAiSettings = (nextMode: 'offline' | 'hybrid', nextKey: string) => {
    setAiMode(nextMode);
    setApiKey(nextKey);
    localStorage.setItem('smart_umkm_ai_mode', nextMode);
    localStorage.setItem('smart_umkm_gemini_key', nextKey.trim());
    showNotice('Pengaturan Asisten AI berhasil disimpan!');
  };

  // --- Tab 3: Backup & Restore ---
  const restoreRef = useRef<HTMLInputElement | null>(null);

  const handleBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      businessProfile,
      savedDatasets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup-UMKM-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('File cadangan berhasil diunduh!');
  };

  const handleRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        savedDatasets?: unknown;
        businessProfile?: unknown;
      };
      if (Array.isArray(parsed.savedDatasets)) {
        localStorage.setItem('smart_umkm_saved_datasets_v1', JSON.stringify(parsed.savedDatasets));
      }
      if (parsed.businessProfile && typeof parsed.businessProfile === 'object') {
        localStorage.setItem('smart_umkm_business_profile', JSON.stringify(parsed.businessProfile));
      }
      showNotice('Backup berhasil dipulihkan! Memuat ulang...');
      setTimeout(() => window.location.reload(), 900);
    } catch {
      showNotice('File backup tidak valid.');
    }
  };

  const handleReset = () => {
    localStorage.removeItem('smart_umkm_saved_datasets_v1');
    localStorage.removeItem('smart_umkm_import_histories_v1');
    showNotice('Semua data berhasil dibersihkan. Memuat ulang...');
    setTimeout(() => window.location.reload(), 900);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Mini-Tab Pengaturan Bahasa Indonesia */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTab('profil_tema')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold ${
            tab === 'profil_tema'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Profil & Tampilan
        </button>
        <button
          type="button"
          onClick={() => setTab('ai_config')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold ${
            tab === 'ai_config'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Pengaturan Asisten AI
        </button>
        <button
          type="button"
          onClick={() => setTab('backup')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold ${
            tab === 'backup'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Cadangan Data
        </button>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* TAB 1: PROFIL USAHA & TEMA TERANG/GELAP */}
      {tab === 'profil_tema' && (
        <div className="space-y-5">
          {/* Pilihan Tema Terang / Gelap (Dipindah ke sini agar halaman utama bersih) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
            <h3 className="font-bold text-sm sm:text-base">Tema Tampilan Aplikasi</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`p-3.5 rounded-xl border-2 flex items-center gap-2.5 text-xs sm:text-sm font-semibold ${
                  theme === 'light'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-800'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Mode Terang</span>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`p-3.5 rounded-xl border-2 flex items-center gap-2.5 text-xs sm:text-sm font-semibold ${
                  theme === 'dark'
                    ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <Moon className="w-4 h-4 text-blue-400" />
                <span>Mode Gelap</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={saveProfile}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <h3 className="font-bold text-sm sm:text-base">Identitas Usaha UMKM</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nama Usaha / Warung
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nama Pemilik
                </label>
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Jenis Usaha
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  <option value="retail">Toko Retail / Warung Sembako</option>
                  <option value="cafe_restaurant">Kafe & Restoran</option>
                  <option value="culinary">Kuliner / Katering</option>
                  <option value="service">Jasa / Bengkel / Laundry</option>
                  <option value="other">UMKM Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Kota / Lokasi
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mata Uang</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'IDR' | 'USD' | 'SGD' | 'MYR')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  <option value="IDR">IDR (Rupiah)</option>
                  <option value="MYR">MYR (Ringgit)</option>
                  <option value="SGD">SGD (Dolar Singapura)</option>
                  <option value="USD">USD (Dolar AS)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Profil</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: PENGATURAN ASISTEN AI */}
      {tab === 'ai_config' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="font-bold text-base">Mode Kerja Asisten AI Usaha</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih mode offline tanpa kuota atau masukkan API Key Google Gemini untuk tanya jawab bebas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => saveAiSettings('offline', apiKey)}
              className={`p-4 rounded-2xl border-2 text-left ${
                aiMode === 'offline'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <WifiOff className="w-4 h-4 text-emerald-600" />
                <span>Mode Offline Lokal</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                100% gratis tanpa internet & tanpa API Key. Langsung membaca omzet, stok menipis, dan laba.
              </p>
            </button>

            <button
              type="button"
              onClick={() => saveAiSettings('hybrid', apiKey)}
              className={`p-4 rounded-2xl border-2 text-left ${
                aiMode === 'hybrid'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <Wifi className="w-4 h-4 text-blue-600" />
                <span>Mode Online (Gemini API)</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Menggunakan kecerdasan Google Gemini saat online, otomatis pindah ke offline jika sinyal mati.
              </p>
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500">
              API Key Google Gemini (Opsional — dapatkan gratis di aistudio.google.com)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Tempel AIzaSy..."
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => saveAiSettings(aiMode, apiKey)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
              >
                Simpan Pengaturan AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BACKUP & RESTORE */}
      {tab === 'backup' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="font-bold text-base">Cadangan & Pemulihan Database Offline</h3>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm">Unduh Cadangan Data (.JSON)</p>
              <p className="text-xs text-slate-500">
                Simpan semua data penjualan, pembelian, produk & karyawan ke satu file.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBackup}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Backup</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm">Pulihkan Data dari File Backup</p>
              <p className="text-xs text-slate-500">Pindahkan data dari perangkat lain.</p>
            </div>
            <div>
              <input
                ref={restoreRef}
                type="file"
                accept=".json"
                onChange={(e) => void handleRestore(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => restoreRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                <Upload className="w-4 h-4" />
                <span>Pilih File Backup</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm text-rose-600">Hapus Semua Data</p>
              <p className="text-xs text-slate-500">Kosongkan seluruh database di perangkat ini.</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}