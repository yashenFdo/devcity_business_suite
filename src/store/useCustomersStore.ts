import { create } from 'zustand';
import type { Customer } from '../types';
import { generateCustomerId } from '../utils/documentNumber';
import { today } from '../utils/formatters';
import { assertCan } from '../security/sessionState';
import { logAudit } from './useAuditStore';
import { connectCollection } from './persistence';
import { deleteRecord, pushRecord } from '../cloud/sync';

interface CustomersStore {
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Customer;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
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
    deleteCustomer: (id) => {
      assertCan('customers.delete');
      const existing = get().customers.find((c) => c.id === id);
      set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));
      deleteRecord('customers', id);
      if (existing) logAudit('customer', 'Deleted client', existing.company || existing.name);
    },
    getCustomerById: (id) => get().customers.find((c) => c.id === id),
  };
});

connectCollection<CustomersStore, Customer>('customers', useCustomersStore, 'customers');
