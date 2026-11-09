// ============================================================
// CORE TYPES & INTERFACES FOR DEVCITY DOCUMENT SUITE
// ============================================================

export type DocumentType = 'quotation' | 'invoice' | 'bill' | 'receipt';

export type TemplateId = 'executive' | 'modern-minimal' | 'corporate-pro' | 'elegant-business' | 'tech-modern';

export type CurrencyCode = 'USD' | 'LKR' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  LKR: { code: 'LKR', symbol: 'Rs.', name: 'Sri Lankan Rupee', locale: 'en-LK' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
};

export type DocumentStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'paid'
  | 'unpaid'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled';

export type PaymentMethod =
  | 'bank_transfer'
  | 'card'
  | 'stripe'
  | 'paypal'
  | 'cash'
  | 'cheque'
  | 'other';

export type DiscountType = 'percent' | 'fixed';

// ─── Line Item ───────────────────────────────────────────────
export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number; // percentage
  tax: number;      // percentage
  amount: number;   // calculated: qty * unitPrice * (1 - discount/100)
}

// ─── Address ─────────────────────────────────────────────────
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// ─── Customer ────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: Address;
  taxNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Company ─────────────────────────────────────────────────
export interface Company {
  name: string;
  tagline?: string;
  email: string;
  phone: string;
  website: string;
  address: Address;
  taxNumber: string;
  registrationNumber: string;
  logo?: string; // base64 or URL
  signature?: string; // base64 or URL
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    swiftCode?: string;
    routingNumber?: string;
  };
  currency: CurrencyCode;
  currencySymbol: string;
  /** Accent colour used on generated documents (hex). */
  brandColor?: string;
  /** Template pre-selected for new documents. */
  defaultTemplate?: TemplateId;
  footer?: string;
}

// ─── Document Totals ─────────────────────────────────────────
export interface DocumentTotals {
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  discountPercent: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

// ─── Quotation ───────────────────────────────────────────────
export interface Quotation {
  id: string;
  quotationNumber: string;
  date: string;
  validUntil: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  customer: Customer;
  projectDescription?: string;
  lineItems: LineItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  notes: string;
  terms: string;
  acceptanceSignature?: string;
  clientSignerName?: string;
  acceptedDate?: string;
  companySnapshot: Company;
  convertedToInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoice ─────────────────────────────────────────────────
export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  customer: Customer;
  projectDescription?: string;
  lineItems: LineItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentTerms: string;
  paymentMethod?: PaymentMethod;
  paymentInstructions?: string;
  bankDetails?: string;
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  notes: string;
  terms: string;
  companySnapshot: Company;
  fromQuotationId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Bill ────────────────────────────────────────────────────
export interface Bill {
  id: string;
  billNumber: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string;
  vendorAddress: string;
  lineItems: LineItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  paymentDetails?: string;
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  notes: string;
  companySnapshot: Company;
  createdAt: string;
  updatedAt: string;
}

// ─── Receipt ─────────────────────────────────────────────────
export interface Receipt {
  id: string;
  receiptNumber: string;
  date: string;
  customer: Customer;
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  amount: number;
  invoiceTotal?: number;
  remainingBalance?: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  notes: string;
  companySnapshot: Company;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard Stats ──────────────────────────────────────────
export interface DashboardStats {
  totalQuotations: number;
  totalInvoices: number;
  totalBills: number;
  totalReceipts: number;
  totalRevenue: number;
  pendingPayments: number;
  overdueInvoices: number;
  paidThisMonth: number;
}
