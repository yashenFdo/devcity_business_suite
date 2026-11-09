import type { Company, Customer, LineItem, DocumentType, Signatory, Stamp, TemplateId } from '../../types';

/** Normalised data every document template renders from. */
export interface DocumentData {
  documentType: DocumentType;
  number: string;
  date: string;
  dueDateOrExpiry?: string;
  status: string;
  currencySymbol: string;
  customer?: Customer;
  vendorName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  projectDescription?: string;
  lineItems: LineItem[];
  subtotal: number;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  discountPercent?: number;
  taxPercent?: number;
  taxAmount?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentMethod?: string;
  paymentTerms?: string;
  paymentInstructions?: string;
  bankDetails?: string;
  notes?: string;
  terms?: string;
  acceptanceSignature?: string;
  clientSignerName?: string;
  acceptedDate?: string;
  linkedInvoiceNumber?: string;
  referenceNumber?: string;
  company: Company;
  templateId?: TemplateId;
  /** Resolved sign-off (see resolveSignOff). */
  signatories?: Signatory[];
  stamps?: Stamp[];
  showPaidStamp?: boolean;
  stampDate?: string;
}
