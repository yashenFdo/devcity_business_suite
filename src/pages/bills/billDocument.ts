import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import type { Bill, Company, Stamp } from '../../types';
import type { DocumentData } from '../../components/documents/documentTypes';
import { resolveSignOff } from '../../components/documents/signOff';
import { useStampsStore } from '../../store/useStampsStore';
import { effectiveBillStatus } from '../../utils/insights';

/** Standard terms offered in the bill editor (all of them map to a fixed number of days). */
export const BILL_TERMS: { label: string; days: number }[] = [
  { label: 'Due on receipt', days: 0 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
  { label: 'Net 60', days: 60 },
];

/** Days between the bill date and the due date (null if either date is missing or invalid). */
export const termDays = (date: string, dueDate: string): number | null => {
  const from = parseISO(date);
  const to = parseISO(dueDate);
  return isValid(from) && isValid(to) ? differenceInCalendarDays(to, from) : null;
};

/** Bills don't store payment terms; derive a label from the bill and due dates. */
export const billTermsLabel = (date: string, dueDate: string): string | undefined => {
  const days = termDays(date, dueDate);
  if (days === null || days < 0) return undefined;
  return days === 0 ? 'Due on receipt' : `Net ${days}`;
};

/**
 * Map a saved bill to template data. Company details come from the snapshot
 * taken when the bill was saved; branding (logo, signature, colour) always
 * follows the current company settings.
 */
export const toBillDocument = (
  bill: Bill,
  company: Company,
  stamps: Stamp[] = useStampsStore.getState().stamps
): DocumentData => {
  const snapshot = bill.companySnapshot ?? company;
  return {
    documentType: 'bill',
    number: bill.billNumber,
    date: bill.date,
    dueDateOrExpiry: bill.dueDate,
    status: effectiveBillStatus(bill),
    currencySymbol: bill.currencySymbol || '$',
    vendorName: bill.vendorName,
    vendorEmail: bill.vendorEmail,
    vendorPhone: bill.vendorPhone,
    vendorAddress: bill.vendorAddress,
    lineItems: bill.lineItems,
    subtotal: bill.subtotal,
    discountType: bill.discountType,
    discountValue: bill.discountValue,
    discountAmount: bill.discountAmount,
    discountPercent: bill.discountPercent,
    taxPercent: bill.taxPercent,
    taxAmount: bill.taxAmount,
    total: bill.total,
    amountPaid: bill.amountPaid,
    balanceDue: bill.balanceDue,
    paymentMethod: bill.paymentMethod,
    paymentTerms: billTermsLabel(bill.date, bill.dueDate),
    paymentInstructions: bill.paymentDetails,
    notes: bill.notes,
    company: {
      ...snapshot,
      logo: company.logo,
      signature: company.signature,
      brandColor: company.brandColor,
    },
    templateId: bill.templateId,
    ...resolveSignOff(bill, company, stamps, effectiveBillStatus(bill) === 'paid', bill.date),
  };
};

export interface KnownVendor {
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentDetails: string;
  paymentMethod?: Bill['paymentMethod'];
}

/** Unique vendors from existing bills, using the most recently updated bill for each name. */
export const knownVendors = (bills: Bill[]): KnownVendor[] => {
  const byName = new Map<string, Bill>();
  for (const b of bills) {
    const key = b.vendorName?.trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || b.updatedAt > prev.updatedAt) byName.set(key, b);
  }
  return [...byName.values()]
    .map((b) => ({
      name: b.vendorName.trim(),
      email: b.vendorEmail || '',
      phone: b.vendorPhone || '',
      address: b.vendorAddress || '',
      paymentDetails: b.paymentDetails || '',
      paymentMethod: b.paymentMethod,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
