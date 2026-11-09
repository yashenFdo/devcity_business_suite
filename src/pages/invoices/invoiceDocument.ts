import type { Company, Invoice, Stamp } from '../../types';
import type { DocumentData } from '../../components/documents/documentTypes';
import { resolveSignOff } from '../../components/documents/signOff';
import { useStampsStore } from '../../store/useStampsStore';
import { effectiveInvoiceStatus } from '../../utils/insights';

/**
 * Map a saved invoice to template data. Company details come from the
 * snapshot taken when the invoice was saved; branding (logo, signature,
 * colour) always follows the current company settings.
 */
export const toInvoiceDocument = (
  inv: Invoice,
  company: Company,
  stamps: Stamp[] = useStampsStore.getState().stamps
): DocumentData => {
  const snapshot = inv.companySnapshot ?? company;
  return {
    documentType: 'invoice',
    number: inv.invoiceNumber,
    date: inv.date,
    dueDateOrExpiry: inv.dueDate,
    status: effectiveInvoiceStatus(inv),
    currencySymbol: inv.currencySymbol || '$',
    customer: inv.customer,
    projectDescription: inv.projectDescription,
    lineItems: inv.lineItems,
    subtotal: inv.subtotal,
    discountType: inv.discountType,
    discountValue: inv.discountValue,
    discountAmount: inv.discountAmount,
    discountPercent: inv.discountPercent,
    taxPercent: inv.taxPercent,
    taxAmount: inv.taxAmount,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balanceDue: inv.balanceDue,
    paymentMethod: inv.paymentMethod,
    paymentTerms: inv.paymentTerms,
    paymentInstructions: inv.paymentInstructions,
    notes: inv.notes,
    terms: inv.terms,
    company: {
      ...snapshot,
      logo: company.logo,
      signature: company.signature,
      brandColor: company.brandColor,
    },
    templateId: inv.templateId,
    ...resolveSignOff(inv, company, stamps, effectiveInvoiceStatus(inv) === 'paid', inv.date),
  };
};
