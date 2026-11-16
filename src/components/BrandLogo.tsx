import { useState } from 'react';
import { useApp } from '../context/AppContext';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
}

export function BrandLogo({
  size = 'md',
  showText = true,
  subtitle = 'Kasir, Database & Asisten AI',
}: BrandLogoProps) {
  const { theme } = useApp();
  const [imgFailed, setImgFailed] = useState(false);

  const dimClass =
    size === 'sm' ? 'w-8 h-8 rounded-lg' : size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-10 h-10 rounded-xl';

  const logoSrc = theme === 'dark' ? '/logo-website.jpg' : '/logo-app.webp';

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        className={`${dimClass} overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center ${
          theme === 'dark' ? 'bg-[#09090B]' : 'bg-[#FAF8F5]'
        }`}
      >
        {!imgFailed ? (
          <img
            src={logoSrc}
            alt="Logo UMKM - API"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-extrabold text-xs text-emerald-600">UA</span>
        )}
      </div>

      {showText && (
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-sm sm:text-base">UMKM - API</span>
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}