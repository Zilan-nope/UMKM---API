export type BusinessType = 'retail' | 'cafe_restaurant' | 'culinary' | 'service' | 'other';

export type PageId =
  | 'ringkasan'
  | 'database'
  | 'analisis'
  | 'asisten-ai'
  | 'laporan'
  | 'pengaturan';

export interface NavItem {
  id: PageId;
  label: string;
  description: string;
}

export interface BusinessProfile {
  name: string;
  businessType: BusinessType;
  currency: 'IDR' | 'USD' | 'SGD' | 'MYR';
  city: string;
  ownerName: string;
  notes: string;
  updatedAt: string;
}