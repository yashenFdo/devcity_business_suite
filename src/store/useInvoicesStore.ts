import { create } from 'zustand';
import type { Invoice } from '../types';
import { generateId, generateInvoiceNumber } from '../utils/documentNumber';
import { today, addDays } from '../utils/formatters';
import { assertCan } from '../security/sessionState';
import { logAudit } from './useAuditStore';
import { connectCollection, nowIso, resolveNumber } from './persistence';
import { deleteRecord, pushRecord } from '../cloud/sync';

type NewInvoice = Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'> & { invoiceNumber?: string };

interface InvoicesStore {
  invoices: Invoice[];
  addInvoice: (data: NewInvoice) => Invoice;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  duplicateInvoice: (id: string) => Invoice | undefined;
  getInvoiceById: (id: string) => Invoice | undefined;
  markAsPaid: (id: string, amountPaid: number) => void;
}

const numbers = (list: Invoice[]) => list.map((i) => i.invoiceNumber);

export const useInvoicesStore = create<InvoicesStore>()((set, get) => {
  /** Save to the cloud; if a colleague took the number meanwhile, take the next one. */
  const save = (id: string) => {
    const inv = get().invoices.find((i) => i.id === id);
    if (!inv) return;
    pushRecord('invoices', id, inv.invoiceNumber, inv, () => {
      const current = get().invoices.find((i) => i.id === id)!;
      const next = generateInvoiceNumber([...numbers(get().invoices), current.invoiceNumber]);
      const renumbered = { ...current, invoiceNumber: next };
      set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? renumbered : i)) }));
      return { number: next, data: renumbered };
    });
  };

  return {
    invoices: [],
    addInvoice: ({ invoiceNumber, ...data }) => {
      assertCan('documents.create');
      const invoice: Invoice = {
        ...data,
        id: generateId(),
        invoiceNumber: resolveNumber(invoiceNumber, numbers(get().invoices), generateInvoiceNumber),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ invoices: [invoice, ...state.invoices] }));
      save(invoice.id);
      logAudit('document', 'Created invoice', invoice.invoiceNumber);
      return invoice;
    },
    updateInvoice: (id, data) => {
      assertCan('documents.edit');
      const existing = get().invoices.find((i) => i.id === id);
      set((state) => ({
        invoices: state.invoices.map((inv) => (inv.id === id ? { ...inv, ...data, updatedAt: nowIso() } : inv)),
      }));
      save(id);
      if (existing) logAudit('document', 'Updated invoice', existing.invoiceNumber);
    },
    deleteInvoice: (id) => {
      assertCan('documents.delete');
      const existing = get().invoices.find((i) => i.id === id);
      set((state) => ({ invoices: state.invoices.filter((inv) => inv.id !== id) }));
      deleteRecord('invoices', id);
      if (existing) logAudit('document', 'Deleted invoice', existing.invoiceNumber);
    },
    duplicateInvoice: (id) => {
      assertCan('documents.create');
      const original = get().invoices.find((i) => i.id === id);
      if (!original) return undefined;
      const clone: Invoice = {
        ...original,
        id: generateId(),
        invoiceNumber: generateInvoiceNumber(numbers(get().invoices)),
        date: today(),
        dueDate: addDays(today(), 30),
        status: 'draft',
        amountPaid: 0,
        balanceDue: original.total,
        fromQuotationId: undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ invoices: [clone, ...state.invoices] }));
      save(clone.id);
      logAudit('document', `Duplicated invoice ${original.invoiceNumber} as`, clone.invoiceNumber);
      return clone;
    },
    getInvoiceById: (id) => get().invoices.find((inv) => inv.id === id),
    markAsPaid: (id, amountPaid) => {
      assertCan('payments.record');
      const existing = get().invoices.find((i) => i.id === id);
      set((state) => ({
        invoices: state.invoices.map((inv) => {
          if (inv.id !== id) return inv;
          const newAmountPaid = Math.min(inv.total, (inv.amountPaid || 0) + amountPaid);
          const balanceDue = Math.max(0, Math.round((inv.total - newAmountPaid) * 100) / 100);
          return {
            ...inv,
            amountPaid: newAmountPaid,
            balanceDue,
            status: balanceDue === 0 ? 'paid' : 'partially_paid',
            updatedAt: nowIso(),
          };
        }),
      }));
      save(id);
      if (existing) logAudit('document', 'Recorded payment on invoice', existing.invoiceNumber);
    },
  };
});

connectCollection<InvoicesStore, Invoice>('invoices', useInvoicesStore, 'invoices');
