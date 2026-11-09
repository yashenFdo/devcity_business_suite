import type { Customer } from '../../../types';
import { today } from '../../../utils/formatters';

export const emptyCustomer = (): Customer => ({
  id: '',
  name: '',
  email: '',
  phone: '',
  company: '',
  address: { street: '', city: '', state: '', zipCode: '', country: '' },
  taxNumber: '',
  createdAt: today(),
  updatedAt: today(),
});
