import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Moon,
  Save,
  Store,
  Sun,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import {
  askSmartAi,
  getProviderLabel,
  loadSavedApiKey,
  saveApiKeyToStorage,
} from '../lib/aiProviders';

export function SettingsPage() {
  const app = useApp() as ReturnType<typeof useApp> & {
    updateBusinessProfile?: (patch: Record<string, unknown>) => void;
    setBusinessProfile?: (next: Record<string, unknown>) => void;
    darkMode?: boolean;
    setDarkMode?: (val: boolean) => void;
    toggleDarkMode?: () => void;
    resetAllData?: () => Promise<void> | void;
  };

  const { businessProfile, savedDatasets } = app;

  const [name, setName] = useState(businessProfile.name || '');
  const [ownerName, setOwnerName] = useState(businessProfile.ownerName || '');
  const [city, setCity] = useState(businessProfile.city || '');
  const [businessType, setBusinessType] = useState(
    businessProfile.businessType || 'Toko Kelontong / Retail'
  );
  const [currency, setCurrency] = useState(businessProfile.currency || 'IDR');
  const [profileSaved, setProfileSaved] = useState(false);

  // Pengaturan API Key AI (terhubung langsung ke halaman Asisten AI)
  const [apiKey, setApiKey] = useState(() => loadSavedApiKey());
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [apiFeedback, setApiFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const detectedProvider = getProviderLabel(apiKey);

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    const updated = {
      ...businessProfile,
      name: name.trim() || 'Usaha UMKM',
      ownerName: ownerName.trim(),
      city: city.trim(),
      businessType,
      currency,
    };
    if (app.updateBusinessProfile) {
      app.updateBusinessProfile(updated);
    } else if (app.setBusinessProfile) {
      app.setBusinessProfile(updated);
    }
    try {
      localStorage.setItem('smart_umkm_business_profile', JSON.stringify(updated));
    } catch {
      // Abaikan
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleSaveApiKey = (e: FormEvent) => {
    e.preventDefault();
    saveApiKeyToStorage(apiKey);
    setApiFeedback({
      ok: true,
      text: apiKey.trim()
        ? `API Key ${detectedProvider} tersimpan dan langsung aktif di halaman Asisten AI.`
        : 'API Key dikosongkan. Asisten AI berjalan dalam mode offline.',
    });
  };

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      setApiFeedback({ ok: false, text: 'Tempel kode API Key terlebih dahulu.' });
      return;
    }
    setIsTestingKey(true);
    setApiFeedback(null);
    try {
      const res = await askSmartAi({
        apiKey: apiKey.trim(),
        systemPrompt: 'Balas singkat maksimal 6 kata.',
        history: [],
        userQuestion: 'Balas: Koneksi AI berhasil!',
      });
      saveApiKeyToStorage(apiKey.trim());
      setApiFeedback({
        ok: true,
        text: `Terhubung ke ${res.providerLabel} & otomatis tersimpan!`,
      });
    } catch (err) {
      setApiFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Gagal terhubung ke server AI.',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleToggleTheme = () => {
    if (app.toggleDarkMode) {
      app.toggleDarkMode();
    } else if (app.setDarkMode) {
      app.setDarkMode(!app.darkMode);
    } else {
      document.documentElement.classList.toggle('dark');
    }
  };

  const handleResetDatabase = async () => {
    const confirmed = window.confirm(
      'Hapus seluruh data transaksi & produk yang tersimpan di perangkat ini?'
    );
    if (!confirmed) return;

    if (app.resetAllData) {
      await app.resetAllData();
    } else if (window.indexedDB && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 1. PROFIL TOKO / USAHA UMKM */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Store className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="font-bold text-sm sm:text-base">Profil Usaha UMKM</h2>
            <p className="text-xs text-slate-500">
              Identitas toko yang tampil di dashboard, laporan & konteks AI
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">Nama Toko / Usaha</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Amanda Mart / Warung Pak Bombom"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Nama Pemilik</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Nama pemilik usaha"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Kota / Kabupaten</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Contoh: Kabupaten Bandung"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Jenis Usaha</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="Toko Kelontong / Retail">Toko Kelontong / Retail</option>
              <option value="Minimarket / Midimarket">Minimarket / Midimarket</option>
              <option value="Kuliner / Warung Makan">Kuliner / Warung Makan</option>
              <option value="Grosir & Agen Sembako">Grosir & Agen Sembako</option>
              <option value="Jasa & Lainnya">Jasa & Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Mata Uang</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="IDR">IDR (Rupiah)</option>
              <option value="USD">USD ($)</option>
              <option value="MYR">MYR (RM)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {profileSaved ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Perubahan profil tersimpan!
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Profil Usaha</span>
          </button>
        </div>
      </form>

      {/* 2. PENGATURAN API KEY ASISTEN AI */}
      <form
        onSubmit={handleSaveApiKey}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-bold text-sm sm:text-base">API Key Asisten AI</h2>
              <p className="text-xs text-slate-500">
                Tempel API Key (Groq, OpenRouter, Cerebras, Hugging Face, atau Gemini) —
                otomatis aktif di menu Asisten AI
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            Terdeteksi: {detectedProvider}
          </span>
        </div>

        <div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setApiFeedback(null);
            }}
            placeholder="Tempel kode API Key Anda di sini (contoh: gsk_... atau sk-or-...)..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          />
        </div>

        {apiFeedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              apiFeedback.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {apiFeedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{apiFeedback.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={isTestingKey || !apiKey.trim()}
            onClick={() => void handleTestApiKey()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold"
          >
            {isTestingKey ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>Tes Koneksi</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan API Key</span>
          </button>
        </div>
      </form>

      {/* 3. TAMPILAN & DATABASE LOKAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm">Tampilan Antarmuka</h3>
            <p className="text-xs text-slate-500 mt-0.5">Mode terang atau gelap</p>
          </div>
          <button
            type="button"
            onClick={handleToggleTheme}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            {app.darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-600" />
                <span>Mode Gelap</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-rose-600">Reset Database Lokal</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tersimpan {savedDatasets.length} dataset di perangkat
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleResetDatabase()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 text-xs font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}