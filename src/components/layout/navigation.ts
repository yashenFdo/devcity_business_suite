import { Banknote, FileSignature, FileText, Receipt } from 'lucide-react';

export const CREATE_ACTIONS = [
  { label: 'Quotation', hint: 'Scope & pricing proposal', icon: FileSignature, to: '/quotations/new', tone: 'text-violet-600 bg-violet-50' },
  { label: 'Invoice', hint: 'Bill a client', icon: FileText, to: '/invoices/new', tone: 'text-primary-600 bg-primary-50' },
  { label: 'Receipt', hint: 'Confirm a payment', icon: Receipt, to: '/receipts/new', tone: 'text-emerald-600 bg-emerald-50' },
  { label: 'Vendor bill', hint: 'Record an expense', icon: Banknote, to: '/bills/new', tone: 'text-amber-600 bg-amber-50' },
] as const;
