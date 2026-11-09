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
  /** Cash in the bank on `openingBalanceDate` (start point for the Available balance). */
  openingBalance?: number;
  openingBalanceDate?: string;
  /** Template pre-selected for new documents. */
  defaultTemplate?: TemplateId;
  footer?: string;
  /** People who can sign documents (managed by admins). */
  signatories?: Signatory[];
  /** Signatories pre-selected on new documents (max 5). */
  defaultSignatoryIds?: string[];
}

// ─── Signatures & stamps ─────────────────────────────────────
export interface Signatory {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  /** Signature image (data URL). */
  signature?: string;
}

/** Ink colour is fixed by kind: company = blue, personal/role = black, paid = green. */
export type StampKind = 'company' | 'personal';
export type StampShape = 'round' | 'rect';

export interface Stamp {
  id: string;
  kind: StampKind;
  /** Owner of a personal stamp (auth user id). Company stamps have none. */
  ownerId?: string;
  shape: StampShape;
  /** Main text: company name, or e.g. "APPROVED". */
  title: string;
  /** Second line: registration number, or the person's role. */
  subtitle?: string;
  /** Small lines: contact details, a name, etc. */
  lines?: string[];
  /** Print the date the stamp is applied. */
  showDate?: boolean;
}

/** Sign-off choices stored on each document. */
export interface SignOffOptions {
  /** Up to 5 signatories, in display order. */
  signatoryIds?: string[];
  /** Stamps applied to the document. */
  stampIds?: string[];
  /** Show the green PAID stamp. Undefined = automatic when fully paid. */
  paidStamp?: boolean;
  /** Date printed in stamps (defaults to the document date). */
  stampDate?: string;
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
export interface Quotation extends SignOffOptions {
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
export interface Invoice extends SignOffOptions {
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
export interface Bill extends SignOffOptions {
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
export interface Receipt extends SignOffOptions {
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
