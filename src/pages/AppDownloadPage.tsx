import {
  CheckCircle2,
  Download,
  Globe,
  Laptop,
  Monitor,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { useApp } from '../context/AppContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PlatformTab = 'semua' | 'mobile' | 'pc' | 'website';

export function AppDownloadPage() {
  const { businessProfile, setActivePage } = useApp();
  const [platform, setPlatform] = useState<PlatformTab>('semua');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerPwaInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const res = await installPrompt.userChoice;
      if (res.outcome === 'accepted') {
        setInstallStatus('Aplikasi UMKM - API berhasil dipasang ke layar utama perangkat!');
      }
      setInstallPrompt(null);
    } else {
      setInstallStatus(
        'Cara pasang instan: Klik ikon "Install / Tambah ke Layar Utama" di pojok kanan atas browser Chrome/Edge.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Bersih Greeny White */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            Multi-Platform: Android • PC Desktop • Website
          </span>

          <div className="flex items-center gap-3.5 pt-1">
            <BrandLogo size="lg" showText={false} />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Aplikasi UMKM - API
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Kelola pembukuan <strong>{businessProfile.name}</strong> dari HP Android, Laptop, maupun browser web.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => void triggerPwaInstall()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Pasang ke Perangkat</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage('ringkasan')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors"
            >
              <span>Kembali ke Dashboard</span>
            </button>
          </div>
        </div>

        {/* Pratinjau Ikon Perangkat */}
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shrink-0">
          <div className="text-center">
            <img
              src="/logo-app.webp"
              alt="Ikon Mobile"
              className="w-14 h-14 rounded-2xl object-cover mx-auto border border-slate-200 dark:border-slate-700"
            />
            <p className="text-[11px] font-medium text-slate-500 mt-1.5">Ikon HP / APK</p>
          </div>
          <div className="h-12 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="text-center">
            <img
              src="/logo-website.jpg"
              alt="Ikon PC & Web"
              className="w-14 h-14 rounded-2xl object-cover mx-auto border border-slate-200 dark:border-slate-700"
            />
            <p className="text-[11px] font-medium text-slate-500 mt-1.5">Ikon PC & Web</p>
          </div>
        </div>
      </div>

      {installStatus && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{installStatus}</span>
        </div>
      )}

      {/* Filter Tab Platform */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-wrap gap-1.5">
        {[
          { id: 'semua', label: 'Semua Perangkat' },
          { id: 'mobile', label: 'Mobile Android (APK)' },
          { id: 'pc', label: 'PC & Laptop' },
          { id: 'website', label: 'Website Browser' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPlatform(t.id as PlatformTab)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              platform === t.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Kartu 3 Platform */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {(platform === 'semua' || platform === 'mobile') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-emerald-600">Android Mobile</span>
                <h3 className="text-base sm:text-lg font-bold mt-0.5">Aplikasi HP (APK)</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Praktis untuk kasir harian di warung atau toko. Ringan di HP dan tetap berjalan lancar meski tanpa kuota internet.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void triggerPwaInstall()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              <span>Pasang di HP Android</span>
            </button>
          </div>
        )}

        {(platform === 'semua' || platform === 'pc') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-teal-600 dark:text-teal-400">Windows & Linux</span>
                <h3 className="text-base sm:text-lg font-bold mt-0.5">Aplikasi PC / Laptop</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Tampilan layar lebar untuk admin gudang & komputer kasir. Memudahkan impor Excel serta cetak laporan PDF.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void triggerPwaInstall()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Laptop className="w-4 h-4" />
              <span>Pasang di PC / Laptop</span>
            </button>
          </div>
        )}

        {(platform === 'semua' || platform === 'website') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-sky-600 dark:text-sky-400">Browser Web</span>
                <h3 className="text-base sm:text-lg font-bold mt-0.5">Portal Website</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Langsung dibuka lewat Chrome, Edge, atau Safari tanpa instalasi tambahan. Responsif di semua ukuran layar.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActivePage('database')}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4" />
              <span>Buka Database Web</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <BrandLogo size="md" subtitle="Pembukuan Mandiri & Asisten AI" />
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <WifiOff className="w-4 h-4 text-emerald-600" /> Bekerja Tanpa Internet
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Privasi Data Lokal
          </span>
        </div>
      </div>
    </div>
  );
}