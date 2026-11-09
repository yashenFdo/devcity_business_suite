import { create } from 'zustand';
import type { Bill } from '../types';
import { generateId, generateBillNumber } from '../utils/documentNumber';
import { today, addDays } from '../utils/formatters';
import { assertCan } from '../security/sessionState';
import { logAudit } from './useAuditStore';
import { connectCollection, nowIso, resolveNumber } from './persistence';
import { deleteRecord, pushRecord } from '../cloud/sync';

type NewBill = Omit<Bill, 'id' | 'billNumber' | 'createdAt' | 'updatedAt'> & { billNumber?: string };

interface BillsStore {
  bills: Bill[];
  addBill: (data: NewBill) => Bill;
  updateBill: (id: string, data: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  duplicateBill: (id: string) => Bill | undefined;
  getBillById: (id: string) => Bill | undefined;
}

const numbers = (list: Bill[]) => list.map((b) => b.billNumber);

export const useBillsStore = create<BillsStore>()((set, get) => {
  const save = (id: string) => {
    const b = get().bills.find((x) => x.id === id);
    if (!b) return;
    pushRecord('bills', id, b.billNumber, b, () => {
      const current = get().bills.find((x) => x.id === id)!;
      const next = generateBillNumber([...numbers(get().bills), current.billNumber]);
      const renumbered = { ...current, billNumber: next };
      set((s) => ({ bills: s.bills.map((x) => (x.id === id ? renumbered : x)) }));
      return { number: next, data: renumbered };
    });
  };

  return {
    bills: [],
    addBill: ({ billNumber, ...data }) => {
      assertCan('documents.create');
      const bill: Bill = {
        ...data,
        id: generateId(),
        billNumber: resolveNumber(billNumber, numbers(get().bills), generateBillNumber),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ bills: [bill, ...state.bills] }));
      save(bill.id);
      logAudit('document', 'Recorded vendor bill', bill.billNumber);
      return bill;
    },
    updateBill: (id, data) => {
      assertCan('documents.edit');
      const existing = get().bills.find((b) => b.id === id);
      set((state) => ({
        bills: state.bills.map((b) => (b.id === id ? { ...b, ...data, updatedAt: nowIso() } : b)),
      }));
      save(id);
      if (existing) logAudit('document', 'Updated vendor bill', existing.billNumber);
    },
    deleteBill: (id) => {
      assertCan('documents.delete');
      const existing = get().bills.find((b) => b.id === id);
      set((state) => ({ bills: state.bills.filter((b) => b.id !== id) }));
      deleteRecord('bills', id);
      if (existing) logAudit('document', 'Deleted vendor bill', existing.billNumber);
    },
    duplicateBill: (id) => {
      assertCan('documents.create');
      const original = get().bills.find((b) => b.id === id);
      if (!original) return undefined;
      const clone: Bill = {
        ...original,
        id: generateId(),
        billNumber: generateBillNumber(numbers(get().bills)),
        date: today(),
        dueDate: addDays(today(), 30),
        status: 'draft',
        amountPaid: 0,
        balanceDue: original.total,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ bills: [clone, ...state.bills] }));
      save(clone.id);
      logAudit('document', `Duplicated vendor bill ${original.billNumber} as`, clone.billNumber);
      return clone;
    },
    getBillById: (id) => get().bills.find((b) => b.id === id),
  };
});

connectCollection<BillsStore, Bill>('bills', useBillsStore, 'bills');
