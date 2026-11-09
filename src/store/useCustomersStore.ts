import { create } from 'zustand';
import type { Customer } from '../types';
import { generateCustomerId } from '../utils/documentNumber';
import { today } from '../utils/formatters';
import { assertCan } from '../security/sessionState';
import { logAudit } from './useAuditStore';
import { connectCollection } from './persistence';
import { deleteRecord, pushRecord } from '../cloud/sync';
import { showUndoToast } from '../components/ui/undoToast';

interface CustomersStore {
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Customer;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  /** Delete several at once with a single Undo. */
  deleteCustomers: (ids: string[]) => void;
  getCustomerById: (id: string) => Customer | undefined;
}

export const useCustomersStore = create<CustomersStore>()((set, get) => {
  const save = (id: string) => {
    const c = get().customers.find((x) => x.id === id);
    if (c) pushRecord('customers', id, null, c);
  };

  return {
    customers: [],
    addCustomer: (data) => {
      assertCan('customers.manage');
      const customer: Customer = { ...data, id: generateCustomerId(), createdAt: today(), updatedAt: today() };
      set((state) => ({ customers: [customer, ...state.customers] }));
      save(customer.id);
      logAudit('customer', 'Added client', customer.company || customer.name);
      return customer;
    },
    updateCustomer: (id, data) => {
      assertCan('customers.manage');
      const existing = get().customers.find((c) => c.id === id);
      set((state) => ({
        customers: state.customers.map((c) => (c.id === id ? { ...c, ...data, updatedAt: today() } : c)),
      }));
      save(id);
      if (existing) logAudit('customer', 'Updated client', existing.company || existing.name);
    },
    deleteCustomers: (ids) => {
      assertCan('customers.delete');
      const removed = get().customers.filter((x) => ids.includes(x.id));
      if (!removed.length) return;
      set((state) => ({ customers: state.customers.filter((x) => !ids.includes(x.id)) }));
      removed.forEach((x) => {
        deleteRecord('customers', x.id);
        logAudit('customer', 'Deleted client', x.company || x.name);
      });
      const label = removed.length === 1 ? `${removed[0].company || removed[0].name} deleted` : `${removed.length} clients deleted`;
      showUndoToast(label, () => {
        set((state) => ({ customers: [...removed, ...state.customers.filter((x) => !ids.includes(x.id))] }));
        removed.forEach((x) => {
          save(x.id);
          logAudit('customer', 'Restored client', x.company || x.name);
        });
      });
    },
    deleteCustomer: (id) => {
      assertCan('customers.delete');
      const existing = get().customers.find((c) => c.id === id);
      set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));
      deleteRecord('customers', id);
      if (existing) {
        logAudit('customer', 'Deleted client', existing.company || existing.name);
        showUndoToast(`${existing.company || existing.name} deleted`, () => {
          set((state) => ({ customers: [existing, ...state.customers.filter((x) => x.id !== existing.id)] }));
          save(existing.id);
          logAudit('customer', 'Restored client', existing.company || existing.name);
        });
      }
    },
    getCustomerById: (id) => get().customers.find((c) => c.id === id),
  };
});

connectCollection<CustomersStore, Customer>('customers', useCustomersStore, 'customers');
