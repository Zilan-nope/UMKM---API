export type BusinessType = 'retail' | 'cafe_restaurant' | 'culinary' | 'service' | 'other';

export type PageId =
  | 'overview'
  | 'data-import'
  | 'my-datasets'
  | 'auto-dashboard'
  | 'sales-analytics'
  | 'financial-analytics'
  | 'inventory-analytics'
  | 'customer-analytics'
  | 'employee-analytics'
  | 'ai-assistant'
  | 'reports'
  | 'dashboard-settings'
  | 'business-profile';

export interface NavItem {
  id: PageId;
  label: string;
  group: 'Utama' | 'Analitik UMKM' | 'AI & Pengaturan';
  phaseReady: number;
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
