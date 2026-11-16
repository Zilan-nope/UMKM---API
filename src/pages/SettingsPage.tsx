import { CheckCircle2, Moon, Save, Sun, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';

export function SettingsPage() {
  const {
    businessProfile,
    updateBusinessProfile,
    theme,
    toggleTheme,
    savedDatasets,
    clearAllDatasets,
  } = useApp();

  const [name, setName] = useState(businessProfile.name);
  const [ownerName, setOwnerName] = useState(businessProfile.ownerName);
  const [city, setCity] = useState(businessProfile.city);
  const [businessType, setBusinessType] = useState(businessProfile.businessType);
  const [currency, setCurrency] = useState(businessProfile.currency || 'IDR');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateBusinessProfile({
      name: name.trim() || 'Usaha UMKM',
      ownerName: ownerName.trim() || 'Pemilik Usaha',
      city: city.trim(),
      businessType,
      currency,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleResetAll = () => {
    if (
      window.confirm(
        'Yakin ingin menghapus seluruh dataset dari penyimpanan lokal? Tindakan ini tidak dapat dibatalkan.'
      )
    ) {
      clearAllDatasets();
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Profil usaha berhasil disimpan.</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
      >
        <h2 className="font-bold text-sm sm:text-base">Profil Usaha</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Nama Usaha / Toko</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Nama Pemilik</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Kota / Lokasi</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Bidang Usaha</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="retail">Toko Kelontong / Retail</option>
              <option value="fnb">Kuliner / F&amp;B</option>
              <option value="jasa">Jasa &amp; Layanan</option>
              <option value="produksi">Produksi / Manufaktur Kecil</option>
              <option value="online">Toko Online / Reseller</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Mata Uang</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="IDR">IDR (Rupiah)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm">Tampilan Antarmuka</h3>
          <p className="text-xs text-slate-500">Pilih mode terang atau gelap sesuai kenyamanan mata.</p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-red-600">Reset Database Lokal</h3>
          <p className="text-xs text-slate-500">
            Saat ini tersimpan {savedDatasets.length} dataset di IndexedDB perangkat ini.
          </p>
        </div>
        <button
          type="button"
          disabled={savedDatasets.length === 0}
          onClick={handleResetAll}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold"
        >
          <Trash2 className="w-4 h-4" />
          <span>Hapus Semua Data</span>
        </button>
      </div>
    </div>
  );
}