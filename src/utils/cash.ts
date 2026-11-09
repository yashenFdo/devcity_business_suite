import type { Bill, Company, Receipt } from '../types';

export interface CashPosition {
  available: number;
  opening: number;
  received: number;
  paidOut: number;
  /** Start date of the calculation (opening balance date), if set. */
  since?: string;
}

/**
 * Available balance = opening balance + payments received (receipts)
 *                     − bills paid, counting only activity on/after the opening date.
 * Only documents in the company's default currency are included.
 */
export const cashPosition = (company: Company, receipts: Receipt[], bills: Bill[]): CashPosition => {
  const since = company.openingBalanceDate || undefined;
  const home = company.currency || 'USD';
  const inRange = (date?: string) => !!date && (!since || date >= since);
  const received = receipts
    .filter((r) => (r.currency || 'USD') === home && inRange(r.date))
    .reduce((t, r) => t + (r.amount || 0), 0);
  const paidOut = bills
    .filter((b) => (b.currency || 'USD') === home && b.status !== 'cancelled' && (b.amountPaid || 0) > 0)
    .filter((b) => inRange(b.paymentDate || b.date))
    .reduce((t, b) => t + (b.amountPaid || 0), 0);
  const opening = company.openingBalance ?? 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { available: round(opening + received - paidOut), opening, received: round(received), paidOut: round(paidOut), since };
};
