export type PageId =
  | 'ringkasan'
  | 'analitik'
  | 'database'
  | 'ai'
  | 'laporan'
  | 'pengaturan';

export type BusinessType =
  | 'retail'
  | 'fnb'
  | 'jasa'
  | 'produksi'
  | 'online'
  | 'lainnya';

export interface BusinessProfile {
  name: string;
  businessType: string;
  currency: string;
  city: string;
  ownerName: string;
  notes: string;
  updatedAt: string;
}