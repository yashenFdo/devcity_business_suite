import type { Customer, Invoice, Quotation, Receipt } from '../../types';
import { effectiveInvoiceStatus, effectiveQuotationStatus } from '../../utils/insights';

export interface ClientStats {
  /** All invoices issued to the client (any status). */
  invoiceCount: number;
  /** Total of invoices that are not draft/cancelled. */
  billed: number;
  /** Amount received against those invoices. */
  paid: number;
  /** Sum of balanceDue on invoices that are not draft/cancelled. */
  outstanding: number;
  /** Portion of `outstanding` that is past due. */
  overdue: number;
  /** Invoices, quotations and receipts combined. */
  documentCount: number;
  /** Most recent document date (yyyy-MM-dd). */
  lastActivity?: string;
}

export type ClientDocKind = 'invoice' | 'quotation' | 'receipt';

export interface ClientDocument {
  kind: ClientDocKind;
  id: string;
  number: string;
  date: string;
  createdAt: string;
  amount: number;
  currencySymbol: string;
  status?: string;
  to: string;
}

export const EMPTY_STATS: ClientStats = {
  invoiceCount: 0,
  billed: 0,
  paid: 0,
  outstanding: 0,
  overdue: 0,
  documentCount: 0,
};

type DocCustomer = Partial<Pick<Customer, 'id' | 'email'>> | undefined;
export type ClientResolver = (docCustomer: DocCustomer) => string | undefined;

const normEmail = (email?: string) => (email || '').trim().toLowerCase();

/**
 * Documents embed a copy of the client. Match them back to a saved client by id,
 * falling back to email when the embedded copy has no id (typed-in client).
 */
export const createClientResolver = (customers: Customer[]): ClientResolver => {
  const ids = new Set(customers.map((c) => c.id));
  const byEmail = new Map<string, string>();
  for (const c of customers) {
    const e = normEmail(c.email);
    if (e && !byEmail.has(e)) byEmail.set(e, c.id);
  }
  return (dc) => {
    if (!dc) return undefined;
    if (dc.id) return ids.has(dc.id) ? dc.id : undefined;
    const e = normEmail(dc.email);
    return e ? byEmail.get(e) : undefined;
  };
};

const later = (a: string | undefined, b: string) => (!a || b > a ? b : a);

export const buildClientStats = (
  resolve: ClientResolver,
  invoices: Invoice[],
  quotations: Quotation[],
  receipts: Receipt[]
): Map<string, ClientStats> => {
  const map = new Map<string, ClientStats>();
  const get = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = { ...EMPTY_STATS };
      map.set(id, s);
    }
    return s;
  };

  for (const inv of invoices) {
    const id = resolve(inv.customer);
    if (!id) continue;
    const s = get(id);
    const status = effectiveInvoiceStatus(inv);
    s.invoiceCount += 1;
    s.documentCount += 1;
    s.lastActivity = later(s.lastActivity, inv.date);
    if (status === 'draft' || status === 'cancelled') continue;
    s.billed += inv.total || 0;
    s.paid += inv.amountPaid || 0;
    s.outstanding += inv.balanceDue || 0;
    if (status === 'overdue') s.overdue += inv.balanceDue || 0;
  }
  for (const q of quotations) {
    const id = resolve(q.customer);
    if (!id) continue;
    const s = get(id);
    s.documentCount += 1;
    s.lastActivity = later(s.lastActivity, q.date);
  }
  for (const r of receipts) {
    const id = resolve(r.customer);
    if (!id) continue;
    const s = get(id);
    s.documentCount += 1;
    s.lastActivity = later(s.lastActivity, r.date);
  }
  return map;
};

export const clientDocuments = (
  clientId: string,
  resolve: ClientResolver,
  invoices: Invoice[],
  quotations: Quotation[],
  receipts: Receipt[]
): ClientDocument[] => {
  const docs: ClientDocument[] = [];
  for (const inv of invoices) {
    if (resolve(inv.customer) !== clientId) continue;
    docs.push({
      kind: 'invoice',
      id: inv.id,
      number: inv.invoiceNumber,
      date: inv.date,
      createdAt: inv.createdAt,
      amount: inv.total,
      currencySymbol: inv.currencySymbol,
      status: effectiveInvoiceStatus(inv),
      to: `/invoices/${inv.id}`,
    });
  }
  for (const q of quotations) {
    if (resolve(q.customer) !== clientId) continue;
    docs.push({
      kind: 'quotation',
      id: q.id,
      number: q.quotationNumber,
      date: q.date,
      createdAt: q.createdAt,
      amount: q.total,
      currencySymbol: q.currencySymbol,
      status: effectiveQuotationStatus(q),
      to: `/quotations/${q.id}`,
    });
  }
  for (const r of receipts) {
    if (resolve(r.customer) !== clientId) continue;
    docs.push({
      kind: 'receipt',
      id: r.id,
      number: r.receiptNumber,
      date: r.date,
      createdAt: r.createdAt,
      amount: r.amount,
      currencySymbol: r.currencySymbol,
      to: `/receipts/${r.id}`,
    });
  }
  return docs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
};

/** Name shown as the primary label: company first, then contact. */
export const clientLabel = (c: Pick<Customer, 'company' | 'name'>) => c.company || c.name || 'Unnamed client';

export const formatAddress = (a?: Customer['address']): string[] => {
  if (!a) return [];
  const line2 = [a.city, a.state, a.zipCode].filter(Boolean).join(', ');
  return [a.street, line2, a.country].filter(Boolean);
};
