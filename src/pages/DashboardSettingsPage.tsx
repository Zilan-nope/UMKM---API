import {
  Bot,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Key,
  Settings,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useApp } from '../context/AppContext';

export type AiExecutionMode = 'offline' | 'hybrid';
export type AiProviderType = 'gemini' | 'openai_compatible';

interface GeminiApiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export function DashboardSettingsPage() {
  const { savedDatasets, businessProfile } = useApp();
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [aiMode, setAiMode] = useState<AiExecutionMode>(() =>
    localStorage.getItem('smart_umkm_ai_mode') === 'hybrid' ? 'hybrid' : 'offline'
  );
  const [aiProvider, setAiProvider] = useState<AiProviderType>(() =>
    localStorage.getItem('smart_umkm_ai_provider') === 'openai_compatible'
      ? 'openai_compatible'
      : 'gemini'
  );
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('smart_umkm_gemini_key') ?? '');
  const [customEndpoint, setCustomEndpoint] = useState(
    () =>
      localStorage.getItem('smart_umkm_ai_endpoint') ??
      'https://api.openai.com/v1/chat/completions'
  );
  const [customModel, setCustomModel] = useState(
    () => localStorage.getItem('smart_umkm_ai_model') ?? 'gpt-4o-mini'
  );
  const [showKey, setShowKey] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const saveAiConfig = (
    nextMode: AiExecutionMode,
    nextProvider: AiProviderType,
    nextKey: string,
    nextEndpoint: string,
    nextModel: string
  ) => {
    localStorage.setItem('smart_umkm_ai_mode', nextMode);
    localStorage.setItem('smart_umkm_ai_provider', nextProvider);
    localStorage.setItem('smart_umkm_gemini_key', nextKey.trim());
    localStorage.setItem('smart_umkm_ai_endpoint', nextEndpoint.trim());
    localStorage.setItem('smart_umkm_ai_model', nextModel.trim());
    setNotice('Pengaturan Mode AI & API Key berhasil disimpan!');
  };

  const handleTestApiConnection = async () => {
    if (!apiKey.trim()) {
      setApiTestResult({ ok: false, text: 'Masukkan API Key terlebih dahulu sebelum menguji.' });
      return;
    }
    setTestingApi(true);
    setApiTestResult(null);

    try {
      if (aiProvider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Balas dengan satu kata: SIAP' }] }],
            }),
          }
        );
        const data = (await res.json()) as GeminiApiResponse;
        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          setApiTestResult({
            ok: true,
            text: 'Koneksi Gemini API berhasil! AI Business Assistant siap digunakan.',
          });
        } else {
          setApiTestResult({
            ok: false,
            text: `Gagal terhubung: ${data.error?.message ?? `HTTP ${res.status}`}`,
          });
        }
      } else {
        const res = await fetch(customEndpoint.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: customModel.trim() || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Balas satu kata: SIAP' }],
            max_tokens: 10,
          }),
        });
        if (res.ok) {
          setApiTestResult({
            ok: true,
            text: 'Koneksi API berhasil! Model siap membantu analisis bisnis.',
          });
        } else {
          setApiTestResult({
            ok: false,
            text: `Endpoint merespons dengan status HTTP ${res.status}. Periksa URL/API Key.`,
          });
        }
      }
    } catch {
      setApiTestResult({
        ok: false,
        text: 'Tidak ada koneksi internet atau server API tidak dapat dijangkau.',
      });
    } finally {
      setTestingApi(false);
    }
  };

  const handleBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Smart UMKM Dashboard AI',
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
    setNotice('File cadangan (backup) berhasil diunduh!');
  };

  const handleRestoreJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        savedDatasets?: unknown;
        businessProfile?: unknown;
      };
      if (Array.isArray(parsed.savedDatasets)) {
        localStorage.setItem('smart_umkm_saved_datasets_v1', JSON.stringify(parsed.savedDatasets));
      }
      if (parsed.businessProfile && typeof parsed.businessProfile === 'object') {
        localStorage.setItem('smart_umkm_business_profile', JSON.stringify(parsed.businessProfile));
      }
      setNotice('Data berhasil dipulihkan! Memuat ulang aplikasi...');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setNotice('File backup tidak valid.');
    }
  };

  const handleResetAll = () => {
    localStorage.removeItem('smart_umkm_saved_datasets_v1');
    localStorage.removeItem('smart_umkm_import_histories_v1');
    setNotice('Seluruh dataset lokal telah dibersihkan. Memuat ulang...');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Bagian 1: Pengaturan Mode AI (Offline vs API Key Online) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Mode AI Assistant & Konfigurasi API Key</h2>
            <p className="text-xs text-slate-500">
              Pilih antara mode 100% offline tanpa kuota internet atau sambungkan API Key untuk analisis AI mendalam.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setAiMode('offline');
              saveAiConfig('offline', aiProvider, apiKey, customEndpoint, customModel);
            }}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              aiMode === 'offline'
                ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <WifiOff className="w-4 h-4 text-emerald-600" />
              <span>Mode Offline (Lokal)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              100% tanpa internet & tanpa API Key. Menganalisis omzet, produk terlaris, stok, dan laba langsung dari mesin lokal.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setAiMode('hybrid');
              saveAiConfig('hybrid', aiProvider, apiKey, customEndpoint, customModel);
            }}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              aiMode === 'hybrid'
                ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <Wifi className="w-4 h-4 text-blue-600" />
              <span>Mode Online AI + Auto-Offline</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Menggunakan API Key (Gemini / OpenAI / DeepSeek) saat online, dan otomatis beralih ke offline jika internet mati.
            </p>
          </button>
        </div>

        {/* Form Pengisian API Key */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Penyedia AI (Provider)
              </label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as AiProviderType)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="gemini">Google Gemini (Gratis di Google AI Studio)</option>
                <option value="openai_compatible">OpenAI / DeepSeek / Ollama Lokal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                API Key (Tersimpan Lokal di Perangkat)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={aiProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {aiProvider === 'openai_compatible' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Nama Model
                </label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm"
                />
              </div>
            </div>
          )}

          {apiTestResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                apiTestResult.ok
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
              }`}
            >
              {apiTestResult.text}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={testingApi}
              onClick={() => void handleTestApiConnection()}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold hover:bg-white dark:hover:bg-slate-800"
            >
              {testingApi ? 'Menguji Koneksi...' : 'Tes Koneksi API'}
            </button>
            <button
              type="button"
              onClick={() => saveAiConfig(aiMode, aiProvider, apiKey, customEndpoint, customModel)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold"
            >
              Simpan Pengaturan AI
            </button>
          </div>
        </div>
      </div>

      {/* Bagian 2: Cadangan & Pemulihan Data Offline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-800 text-white">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Cadangan & Pemulihan Data Offline</h2>
            <p className="text-xs text-slate-500">
              Pindahkan data usaha antar-laptop Windows/Linux atau HP Android menggunakan file JSON.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm">1. Unduh Cadangan Data (Backup)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simpan profil dan {savedDatasets.length} dataset aktif ke satu file JSON.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBackupJson}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Backup (.JSON)</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm">2. Pulihkan Data dari File Backup</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Muat ulang dataset dari file backup perangkat lain.
              </p>
            </div>
            <div>
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json"
                onChange={handleRestoreJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Pulihkan Backup</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-rose-700 dark:text-rose-300">
                3. Bersihkan Semua Dataset Lokal
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Menghapus seluruh dataset yang tersimpan di perangkat ini.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Dataset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}