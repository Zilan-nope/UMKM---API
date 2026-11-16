export type BusinessType = 'retail' | 'cafe_restaurant' | 'culinary' | 'service' | 'other';

export type DatasetCategory =
  | 'sales'
  | 'finance'
  | 'inventory'
  | 'customer'
  | 'employee'
  | 'product'
  | 'unknown';

export type ColumnSemanticRole =
  | 'date'
  | 'amount'
  | 'quantity'
  | 'category'
  | 'product_name'
  | 'identifier'
  | 'transaction_type'
  | 'unit_price'
  | 'cost_price'
  | 'stock_current'
  | 'stock_min'
  | 'customer_name'
  | 'text'
  | 'ignore';

export type ColumnDataType = 'string' | 'number' | 'date' | 'boolean' | 'unknown';

export type ImportMode = 'replace' | 'append' | 'merge';

export interface ColumnProfile {
  originalName: string;
  normalizedName: string;
  detectedType: ColumnDataType;
  suggestedRole: ColumnSemanticRole;
  confirmedRole: ColumnSemanticRole;
  nullCount: number;
  sampleValues: unknown[];
  confidence: number;
}

export interface ValidationIssue {
  rowIndex: number;
  column: string;
  severity: 'warning' | 'error';
  message: string;
}

export interface ParsedDatasetDraft {
  id: string;
  fileName: string;
  fileSize: number;
  sheetName?: string;
  detectedCategory: DatasetCategory;
  confirmedCategory: DatasetCategory;
  totalRows: number;
  columns: ColumnProfile[];
  rows: Record<string, unknown>[];
  issues: ValidationIssue[];
  createdAt: string;
}

export interface SavedDatasetMeta {
  id: string;
  businessId: string;
  fileName: string;
  category: DatasetCategory;
  rowCount: number;
  importMode: ImportMode;
  columns: ColumnProfile[];
  lastUpdatedAt: string;
}
