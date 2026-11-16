import { CheckCircle2, Save, Store } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import type { BusinessType } from '../types/navigation';

const TYPES: { value: BusinessType; label: string }[] = [
  { value: 'retail', label: 'Toko Retail / Warung Sembako' },
  { value: 'cafe_restaurant', label: 'Kafe & Restoran' },
  { value: 'culinary', label: 'Bisnis Kuliner / Katering' },
  { value: 'service', label: 'Bisnis Jasa / Bengkel / Laundry' },
  { value: 'other', label: 'UMKM Lainnya' },
];

export function BusinessProfilePage() {
  const { businessProfile, updateBusinessProfile } = useApp();
  const [name, setName] = useState(businessProfile.name);
  const [businessType, setBusinessType] = useState<BusinessType>(businessProfile.businessType);
  const [currency, setCurrency] = useState<'IDR' | 'USD' | 'SGD' | 'MYR'>(businessProfile.currency);
  const [city, setCity] = useState(businessProfile.city);
  const [ownerName, setOwnerName] = useState(businessProfile.ownerName);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateBusinessProfile({
      name: name.trim() || 'Usaha UMKM Saya',
      businessType,
      currency,
      city: city.trim() || 'Indonesia',
      ownerName: ownerName.trim() || 'Pemilik Usaha',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Profil & Identitas Bisnis UMKM</h2>
          <p className="text-xs text-slate-500">Menyesuaikan konteks analisis AI dan mata uang dashboard.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Nama Usaha / Warung</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Nama Pemilik</label>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Kategori Usaha</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as BusinessType)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Kota / Lokasi</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Mata Uang</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'IDR' | 'USD' | 'SGD' | 'MYR')}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="IDR">IDR (Rp)</option>
              <option value="MYR">MYR (RM)</option>
              <option value="SGD">SGD ($)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Tersimpan!
            </span>
          ) : (
            <span className="text-xs text-slate-400">Tersimpan di perangkat lokal</span>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
          >
            <Save className="w-4 h-4" /> <span>Simpan Profil</span>
          </button>
        </div>
      </form>
    </div>
  );
}