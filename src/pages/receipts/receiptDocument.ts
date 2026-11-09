import type { Company, Receipt, SignOffOptions, Stamp } from '../../types';
import type { DocumentData } from '../../components/documents/documentTypes';
import { resolveSignOff } from '../../components/documents/signOff';
import { useStampsStore } from '../../store/useStampsStore';

/** The receipt fields a template needs — a saved receipt or the editor's live form. */
export type ReceiptDocumentSource = Pick<
  Receipt,
  | 'receiptNumber'
  | 'date'
  | 'customer'
  | 'linkedInvoiceNumber'
  | 'amount'
  | 'invoiceTotal'
  | 'remainingBalance'
  | 'paymentMethod'
  | 'referenceNumber'
  | 'currencySymbol'
  | 'templateId'
  | 'notes'
> &
  SignOffOptions & { companySnapshot?: Company };

/**
 * Map a receipt to template data. Company details come from the snapshot
 * taken when the receipt was saved; branding (logo, signature, colour)
 * always follows the current company settings.
 */
export const toReceiptDocument = (
  r: ReceiptDocumentSource,
  company: Company,
  stamps: Stamp[] = useStampsStore.getState().stamps
): DocumentData => {
  const snapshot = r.companySnapshot ?? company;
  return {
    documentType: 'receipt',
    number: r.receiptNumber,
    date: r.date,
    status: 'paid',
    currencySymbol: r.currencySymbol || '$',
    customer: r.customer,
    lineItems: [],
    subtotal: r.amount,
    total: r.invoiceTotal ?? r.amount,
    amountPaid: r.amount,
    balanceDue: r.linkedInvoiceNumber ? r.remainingBalance : undefined,
    linkedInvoiceNumber: r.linkedInvoiceNumber || undefined,
    paymentMethod: r.paymentMethod,
    referenceNumber: r.referenceNumber,
    notes: r.notes,
    company: {
      ...snapshot,
      logo: company.logo,
      signature: company.signature,
      brandColor: company.brandColor,
    },
    templateId: r.templateId,
    ...resolveSignOff(r, company, stamps, true, r.date),
  };
};
