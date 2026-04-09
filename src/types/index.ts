// ============================================================
// StyleFlow SaaS — Core TypeScript Types
// ============================================================

export type Role = 'admin' | 'manager' | 'cashier' | 'production';
export type CourierName = 'steadfast' | 'pathao' | 'redx';
export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'card' | 'due';
export type BarcodeType = 'CODE128' | 'EAN13' | 'CODE39';
export type StockMovementType = 'IN' | 'OUT' | 'DAMAGE' | 'TRANSFER' | 'ADJUSTMENT' | 'SALE' | 'RETURN';

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface Staff {
  id: string;
  tenant_id: string;
  auth_user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  pin?: string;
  joining_date?: string;
  salary: number;
  status: 'active' | 'inactive';
  permissions: Record<string, boolean>;
  created_at: string;
}

// ── Products ─────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  tenant_id: string;
  category_id?: string;
  name: string;
  name_bn?: string;
  sku: string;
  description?: string;
  base_price: number;
  purchase_price: number;
  tax_rate: number;
  unit: string;
  image_url?: string;
  woo_product_id?: number;
  status: 'active' | 'inactive';
  variations?: ProductVariation[];
  category?: Category;
}

export interface ProductVariation {
  id: string;
  product_id: string;
  sku: string;
  size?: string;
  color?: string;
  price: number;
  barcode?: string;
  barcode_type: BarcodeType;
  woo_variation_id?: number;
  stock?: number; // from inventory join
  product?: Product;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug?: string;
  parent_id?: string;
}

// ── Inventory ────────────────────────────────────────────────────────────────
export interface Inventory {
  id: string;
  variation_id: string;
  outlet_id: string;
  qty: number;
  low_alert_qty: number;
}

export interface StockMovement {
  id: number;
  variation_id: string;
  outlet_id: string;
  type: StockMovementType;
  qty: number;
  ref_type?: string;
  ref_id?: string;
  note?: string;
  staff_id?: string;
  created_at: string;
}

// ── POS / Sales ───────────────────────────────────────────────────────────────
export interface CartItem {
  variation_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  size?: string;
  color?: string;
  unit_price: number;
  qty: number;
  discount: number;
  total: number;
  stock_available?: number;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface SplitPayment {
  entries: PaymentEntry[];
  total_paid: number;
  due: number;
}

export interface Sale {
  id: string;
  sale_number: string;
  outlet_id: string;
  shift_id?: string;
  customer_id?: string;
  staff_id?: string;
  subtotal: number;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  paid: number;
  due: number;
  status: 'completed' | 'hold' | 'refunded' | 'partial';
  woo_order_id?: number;
  note?: string;
  created_at: string;
  items?: SaleItem[];
  payments?: PaymentRecord[];
}

export interface SaleItem {
  id: number;
  sale_id: string;
  variation_id: string;
  product_name: string;
  sku: string;
  size?: string;
  color?: string;
  qty: number;
  unit_price: number;
  discount: number;
  total: number;
}

export interface PaymentRecord {
  id: number;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  created_at: string;
}

// ── Shift ─────────────────────────────────────────────────────────────────────
export interface Shift {
  id: string;
  tenant_id: string;
  outlet_id: string;
  staff_id: string;
  opening_cash: number;
  closing_cash?: number;
  expected_cash?: number;
  cash_difference?: number;
  status: 'open' | 'closed';
  started_at: string;
  ended_at?: string;
  notes?: string;
}

// ── Courier ───────────────────────────────────────────────────────────────────
export interface Shipment {
  id: string;
  invoice: string;
  courier: CourierName;
  consignment_id?: string;
  tracking_code?: string;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  delivery_type: 0 | 1; // 0=home, 1=point
  total_lot?: number;
  contact_name?: string;
  contact_phone?: string;
  note?: string;
  label_printed: boolean;
  created_at: string;
}

// ── XLSX Import ───────────────────────────────────────────────────────────────
export interface ImportRow {
  _row: number;
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note: string;
  total_lot?: number;
  delivery_type?: 0 | 1;
  contact_name?: string;
  contact_phone?: string;
  // UI state
  _status?: 'valid' | 'error' | 'submitted' | 'failed';
  _errors?: string[];
  _edited?: boolean;
}

export interface ImportBatch {
  id: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  status: 'preview' | 'submitted' | 'partial';
  courier: CourierName;
  rows: ImportRow[];
  errors: { row: number; errors: string[] }[];
}

// ── Employees & Accounting ────────────────────────────────────────────────────
export interface Employee {
  id: string;
  name: string;
  phone?: string;
  role: string;
  joining_date?: string;
  salary_type: 'monthly' | 'piece_rate';
  salary: number;
  piece_rate: number;
  status: 'active' | 'inactive';
}

export interface ProductionLog {
  id: number;
  employee_id: string;
  log_date: string;
  product_name?: string;
  qty: number;
  unit: string;
  piece_rate: number;
  earned: number;
  note?: string;
  employee?: Employee;
}

export interface SalaryPayment {
  id: number;
  employee_id: string;
  month: string;
  amount: number;
  type: 'full' | 'partial' | 'advance';
  note?: string;
  paid_at: string;
  employee?: Employee;
}

export interface Expense {
  id: number;
  category: string;
  description?: string;
  amount: number;
  expense_date: string;
  outlet_id?: string;
  reference?: string;
}

// ── Reports ───────────────────────────────────────────────────────────────────
export interface PLSummary {
  revenue: number;
  cogs: number;
  gross_profit: number;
  salary_total: number;
  expense_total: number;
  purchase_total: number;
  net_profit: number;
  from: string;
  to: string;
}

// ── Barcode ───────────────────────────────────────────────────────────────────
export interface BarcodeLabel {
  variation_id: string;
  sku: string;
  product_name: string;
  size?: string;
  color?: string;
  price: number;
  barcode: string;
  barcode_type: BarcodeType;
  copies: number;
}
