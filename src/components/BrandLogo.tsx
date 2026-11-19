import { Store, TrendingUp } from 'lucide-react';

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-sm shrink-0">
        <Store className="w-5 h-5" />
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md bg-amber-400 text-slate-900 flex items-center justify-center shadow-xs">
          <TrendingUp className="w-2.5 h-2.5 stroke-[2.5]" />
        </span>
      </div>

      {!compact && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              Smart<span className="text-emerald-600">UMKM</span>
            </span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              BI
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Asisten Pembukuan & Analisis
          </p>
        </div>
      )}
    </div>
  );
}

export default BrandLogo;