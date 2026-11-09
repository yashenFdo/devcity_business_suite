import type { LineItem, DiscountType } from '../types';

// ─── Line Item Calculations ───────────────────────────────────
export const calculateLineItemAmount = (item: Omit<LineItem, 'amount'>): number => {
  const gross = item.quantity * item.unitPrice;
  const discountedAmount = gross * (1 - (item.discount || 0) / 100);
  return Math.round(discountedAmount * 100) / 100;
};

export const calculateLineItemTotal = (item: LineItem): number => {
  const taxAmount = item.amount * ((item.tax || 0) / 100);
  return Math.round((item.amount + taxAmount) * 100) / 100;
};

// ─── Document Totals ─────────────────────────────────────────
export interface CalcResult {
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  total: number;
}

export const calculateDocumentTotals = (
  lineItems: LineItem[],
  discountInput: number = 0,
  globalTaxPercent: number = 0,
  discountType: DiscountType = 'percent'
): CalcResult => {
  // Sum of line items
  const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Per-item taxes
  const perItemTaxTotal = lineItems.reduce((sum, item) => {
    return sum + (item.amount || 0) * ((item.tax || 0) / 100);
  }, 0);

  let discountAmount: number;
  let discountPercent: number;

  if (discountType === 'percent') {
    discountPercent = Math.max(0, Math.min(100, discountInput));
    discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  } else {
    // Fixed amount discount
    discountAmount = Math.max(0, Math.min(subtotal, discountInput));
    discountPercent = subtotal > 0 ? Math.round((discountAmount / subtotal) * 10000) / 100 : 0;
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  // Global tax on discounted subtotal
  const globalTaxAmount = Math.round(afterDiscount * ((globalTaxPercent || 0) / 100) * 100) / 100;
  const taxAmount = Math.round((perItemTaxTotal + globalTaxAmount) * 100) / 100;
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountType,
    discountValue: discountInput,
    discountAmount,
    discountPercent,
    taxAmount,
    total,
  };
};
