import type { PaymentMethod } from '../../types';

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer / SWIFT' },
  { value: 'card', label: 'Card' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export const paymentMethodLabel = (m?: string) =>
  PAYMENT_METHOD_OPTIONS.find((o) => o.value === m)?.label ?? 'Bank transfer';

export const PAYMENT_TERMS: { label: string; days: number | null }[] = [
  { label: 'Due on receipt', days: 0 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
  { label: 'Net 60', days: 60 },
  { label: '50% advance / 50% on delivery', days: null },
  { label: 'Milestone-based', days: null },
];
