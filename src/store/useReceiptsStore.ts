import { create } from 'zustand';
import type { Receipt } from '../types';
import { generateId, generateReceiptNumber } from '../utils/documentNumber';
import { today } from '../utils/formatters';
import { assertCan } from '../security/sessionState';
import { logAudit } from './useAuditStore';
import { connectCollection, nowIso, resolveNumber } from './persistence';
import { deleteRecord, pushRecord } from '../cloud/sync';
import { showUndoToast } from '../components/ui/undoToast';

type NewReceipt = Omit<Receipt, 'id' | 'receiptNumber' | 'createdAt' | 'updatedAt'> & { receiptNumber?: string };

interface ReceiptsStore {
  receipts: Receipt[];
  addReceipt: (data: NewReceipt) => Receipt;
  updateReceipt: (id: string, data: Partial<Receipt>) => void;
  deleteReceipt: (id: string) => void;
  /** Delete several at once with a single Undo. */
  deleteReceipts: (ids: string[]) => void;
  duplicateReceipt: (id: string) => Receipt | undefined;
  getReceiptById: (id: string) => Receipt | undefined;
}

const numbers = (list: Receipt[]) => list.map((r) => r.receiptNumber);

export const useReceiptsStore = create<ReceiptsStore>()((set, get) => {
  const save = (id: string) => {
    const r = get().receipts.find((x) => x.id === id);
    if (!r) return;
    pushRecord('receipts', id, r.receiptNumber, r, () => {
      const current = get().receipts.find((x) => x.id === id)!;
      const next = generateReceiptNumber([...numbers(get().receipts), current.receiptNumber]);
      const renumbered = { ...current, receiptNumber: next };
      set((s) => ({ receipts: s.receipts.map((x) => (x.id === id ? renumbered : x)) }));
      return { number: next, data: renumbered };
    });
  };

  return {
    receipts: [],
    addReceipt: ({ receiptNumber, ...data }) => {
      assertCan('payments.record');
      const receipt: Receipt = {
        ...data,
        id: generateId(),
        receiptNumber: resolveNumber(receiptNumber, numbers(get().receipts), generateReceiptNumber),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ receipts: [receipt, ...state.receipts] }));
      save(receipt.id);
      logAudit('document', 'Issued receipt', receipt.receiptNumber);
      return receipt;
    },
    updateReceipt: (id, data) => {
      assertCan('documents.edit');
      const existing = get().receipts.find((r) => r.id === id);
      set((state) => ({
        receipts: state.receipts.map((r) => (r.id === id ? { ...r, ...data, updatedAt: nowIso() } : r)),
      }));
      save(id);
      if (existing) logAudit('document', 'Updated receipt', existing.receiptNumber);
    },
    deleteReceipts: (ids) => {
      assertCan('documents.delete');
      const removed = get().receipts.filter((x) => ids.includes(x.id));
      if (!removed.length) return;
      set((state) => ({ receipts: state.receipts.filter((x) => !ids.includes(x.id)) }));
      removed.forEach((x) => {
        deleteRecord('receipts', x.id);
        logAudit('document', 'Deleted receipt', x.receiptNumber);
      });
      const label = removed.length === 1 ? `${removed[0].receiptNumber} deleted` : `${removed.length} receipts deleted`;
      showUndoToast(label, () => {
        set((state) => ({ receipts: [...removed, ...state.receipts.filter((x) => !ids.includes(x.id))] }));
        removed.forEach((x) => {
          save(x.id);
          logAudit('document', 'Restored receipt', x.receiptNumber);
        });
      });
    },
    deleteReceipt: (id) => {
      assertCan('documents.delete');
      const existing = get().receipts.find((r) => r.id === id);
      set((state) => ({ receipts: state.receipts.filter((r) => r.id !== id) }));
      deleteRecord('receipts', id);
      if (existing) {
        logAudit('document', 'Deleted receipt', existing.receiptNumber);
        showUndoToast(`${existing.receiptNumber} deleted`, () => {
          set((state) => ({ receipts: [existing, ...state.receipts.filter((x) => x.id !== existing.id)] }));
          save(existing.id);
          logAudit('document', 'Restored receipt', existing.receiptNumber);
        });
      }
    },
    duplicateReceipt: (id) => {
      assertCan('payments.record');
      const original = get().receipts.find((r) => r.id === id);
      if (!original) return undefined;
      const clone: Receipt = {
        ...original,
        id: generateId(),
        receiptNumber: generateReceiptNumber(numbers(get().receipts)),
        date: today(),
        // A copy is a new standalone payment — it must not claim to settle the original invoice.
        linkedInvoiceId: undefined,
        linkedInvoiceNumber: undefined,
        invoiceTotal: undefined,
        remainingBalance: undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((state) => ({ receipts: [clone, ...state.receipts] }));
      save(clone.id);
      logAudit('document', `Duplicated receipt ${original.receiptNumber} as`, clone.receiptNumber);
      return clone;
    },
    getReceiptById: (id) => get().receipts.find((r) => r.id === id),
  };
});

connectCollection<ReceiptsStore, Receipt>('receipts', useReceiptsStore, 'receipts');
