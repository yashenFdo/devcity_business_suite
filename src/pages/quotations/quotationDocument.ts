import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import type { Company, Invoice, Quotation } from '../../types';
import type { DocumentData } from '../../components/documents/documentTypes';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { generateId } from '../../utils/documentNumber';
import { addDays, today } from '../../utils/formatters';
import { effectiveQuotationStatus } from '../../utils/insights';

/**
 * Map a saved quotation to template data. Company details come from the
 * snapshot taken when the quotation was saved; branding (logo, signature,
 * colour) always follows the current company settings.
 */
export const toQuotationDocument = (q: Quotation, company: Company): DocumentData => {
  const snapshot = q.companySnapshot ?? company;
  return {
    documentType: 'quotation',
    number: q.quotationNumber,
    date: q.date,
    dueDateOrExpiry: q.validUntil,
    status: effectiveQuotationStatus(q),
    currencySymbol: q.currencySymbol || '$',
    customer: q.customer,
    projectDescription: q.projectDescription,
    lineItems: q.lineItems,
    subtotal: q.subtotal,
    discountType: q.discountType,
    discountValue: q.discountValue,
    discountAmount: q.discountAmount,
    discountPercent: q.discountPercent,
    taxPercent: q.taxPercent,
    taxAmount: q.taxAmount,
    total: q.total,
    notes: q.notes,
    terms: q.terms,
    acceptanceSignature: q.acceptanceSignature,
    clientSignerName: q.clientSignerName,
    acceptedDate: q.acceptedDate,
    company: {
      ...snapshot,
      logo: company.logo,
      signature: company.signature,
      brandColor: company.brandColor,
    },
    templateId: q.templateId,
  };
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Days from `from` to `to` (calendar days); null when either date is invalid. */
export const daysBetween = (from: string, to: string): number | null => {
  const a = parseISO(from);
  const b = parseISO(to);
  return isValid(a) && isValid(b) ? differenceInCalendarDays(b, a) : null;
};

/** Human-friendly validity phrase, e.g. "Expires in 5 days", "Expired 3 days ago". */
export const validityLabel = (validUntil?: string): { text: string; tone: 'muted' | 'warning' | 'danger' } => {
  const d = validUntil ? daysBetween(today(), validUntil) : null;
  if (d === null) return { text: '—', tone: 'muted' };
  if (d < 0) return { text: `Expired ${plural(-d, 'day')} ago`, tone: 'danger' };
  if (d === 0) return { text: 'Expires today', tone: 'warning' };
  if (d <= 7) return { text: `Expires in ${plural(d, 'day')}`, tone: 'warning' };
  return { text: `Expires in ${plural(d, 'day')}`, tone: 'muted' };
};

/** A quotation can be turned into an invoice once it's been sent or accepted, and only once. */
export const canConvert = (q: Quotation) => {
  const status = effectiveQuotationStatus(q);
  return !q.convertedToInvoiceId && (status === 'sent' || status === 'accepted');
};

/**
 * Create a draft invoice from a quotation (same client, items and totals, due
 * in 30 days) and mark the quotation as accepted + converted. Permission checks
 * and audit logging happen in the store actions.
 */
export const convertQuotationToInvoice = (q: Quotation, company: Company): Invoice => {
  const invoice = useInvoicesStore.getState().addInvoice({
    date: today(),
    dueDate: addDays(today(), 30),
    status: 'draft',
    customer: q.customer,
    projectDescription: q.projectDescription,
    lineItems: q.lineItems.map((i) => ({ ...i, id: generateId() })),
    subtotal: q.subtotal,
    discountType: q.discountType || 'percent',
    discountValue: q.discountValue || 0,
    discountPercent: q.discountPercent,
    discountAmount: q.discountAmount,
    taxPercent: q.taxPercent,
    taxAmount: q.taxAmount,
    total: q.total,
    amountPaid: 0,
    balanceDue: q.total,
    paymentTerms: 'Net 30',
    paymentMethod: 'bank_transfer',
    currency: q.currency,
    currencySymbol: q.currencySymbol,
    templateId: q.templateId,
    notes: q.notes,
    terms: 'Payment is due by the date shown above. Late payments may incur a 1.5% monthly service charge.',
    companySnapshot: company,
    fromQuotationId: q.id,
  });
  useQuotationsStore.getState().markAsConverted(q.id, invoice.id);
  return invoice;
};
