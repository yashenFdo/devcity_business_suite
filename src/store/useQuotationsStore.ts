import { create } from 'zustand';
import type { Quotation } from '../types';
import { generateId, generateQuotationNumber } from '../utils/documentNumber';
import { today, addDays } from '../utils/formatters';
import { assertCan } from '../security/sessionState';
import { logAudit } from './useAuditStore';
import { connectCollection, nowIso, resolveNumber } from './persistence';
import { deleteRecord, pushRecord } from '../cloud/sync';

type NewQuotation = Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt' | 'updatedAt'> & {
  quotationNumber?: string;
};

interface QuotationsStore {
  quotations: Quotation[];
  addQuotation: (data: NewQuotation) => Quotation;
  updateQuotation: (id: string, data: Partial<Quotation>) => void;
  deleteQuotation: (id: string) => void;
  duplicateQuotation: (id: string) => Quotation | undefined;
  getQuotationById: (id: string) => Quotation | undefined;
  markAsConverted: (id: string, invoiceId: string) => void;
}

const numbers = (list: Quotation[]) => list.map((q) => q.quotationNumber);

export const useQuotationsStore = create<QuotationsStore>()((set, get) => {
  const save = (id: string) => {
    const q = get().quotations.find((x) => x.id === id);
    if (!q) return;
    pushRecord('quotations', id, q.quotationNumber, q, () => {
      const current = get().quotations.find((x) => x.id === id)!;
      const next = generateQuotationNumber([...numbers(get().quotations), current.quotationNumber]);
      const renumbered = { ...current, quotationNumber: next };
      set((s) => ({ quotations: s.quotations.map((x) => (x.id === id ? renumbered : x)) }));
      return { number: next, data: renumbered };
    });
  };

  return {
    quotations: [],
    addQuotation: ({ quotationNumber, ...data }) => {
      assertCan('documents.create');
      const quotation: Quotation = {
        ...data,
        id: generateId(),
        quotationNumber: resolveNumber(quotationNumber, numbers(get().quotations), generateQuotationNumber),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ quotations: [quotation, ...state.quotations] }));
      save(quotation.id);
      logAudit('document', 'Created quotation', quotation.quotationNumber);
      return quotation;
    },
    updateQuotation: (id, data) => {
      assertCan('documents.edit');
      const existing = get().quotations.find((q) => q.id === id);
      set((state) => ({
        quotations: state.quotations.map((q) => (q.id === id ? { ...q, ...data, updatedAt: nowIso() } : q)),
      }));
      save(id);
      if (existing) logAudit('document', 'Updated quotation', existing.quotationNumber);
    },
    deleteQuotation: (id) => {
      assertCan('documents.delete');
      const existing = get().quotations.find((q) => q.id === id);
      set((state) => ({ quotations: state.quotations.filter((q) => q.id !== id) }));
      deleteRecord('quotations', id);
      if (existing) logAudit('document', 'Deleted quotation', existing.quotationNumber);
    },
    duplicateQuotation: (id) => {
      assertCan('documents.create');
      const original = get().quotations.find((q) => q.id === id);
      if (!original) return undefined;
      const clone: Quotation = {
        ...original,
        id: generateId(),
        quotationNumber: generateQuotationNumber(numbers(get().quotations)),
        date: today(),
        validUntil: addDays(today(), 30),
        status: 'draft',
        convertedToInvoiceId: undefined,
        acceptanceSignature: undefined,
        acceptedDate: undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ quotations: [clone, ...state.quotations] }));
      save(clone.id);
      logAudit('document', `Duplicated quotation ${original.quotationNumber} as`, clone.quotationNumber);
      return clone;
    },
    getQuotationById: (id) => get().quotations.find((q) => q.id === id),
    markAsConverted: (id, invoiceId) => {
      assertCan('documents.create');
      const existing = get().quotations.find((q) => q.id === id);
      set((state) => ({
        quotations: state.quotations.map((q) =>
          q.id === id ? { ...q, status: 'accepted', convertedToInvoiceId: invoiceId, updatedAt: nowIso() } : q
        ),
      }));
      save(id);
      if (existing) logAudit('document', 'Converted quotation to invoice', existing.quotationNumber);
    },
  };
});

connectCollection<QuotationsStore, Quotation>('quotations', useQuotationsStore, 'quotations');
