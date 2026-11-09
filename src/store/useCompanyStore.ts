import { create } from 'zustand';
import toast from 'react-hot-toast';
import type { Company } from '../types';
import { assertCan, currentWorkspaceId } from '../security/sessionState';
import { logAudit } from './useAuditStore';
import { friendlyError, supabase } from '../cloud/supabase';

/** A fresh workspace's company profile: only the name is known. */
export const blankCompany = (name = ''): Company => ({
  name,
  tagline: '',
  email: '',
  phone: '',
  website: '',
  address: { street: '', city: '', state: '', zipCode: '', country: '' },
  taxNumber: '',
  registrationNumber: '',
  bankDetails: { bankName: '', accountName: '', accountNumber: '', ifscCode: '', swiftCode: '', routingNumber: '' },
  currency: 'USD',
  currencySymbol: '$',
  brandColor: '#2549eb',
  footer: '',
});

/** Merge the stored profile over safe defaults so older/partial data never breaks templates. */
export const companyFromWorkspace = (workspaceName: string, stored: unknown): Company => {
  const s = (stored ?? {}) as Partial<Company>;
  const base = blankCompany(workspaceName);
  return {
    ...base,
    ...s,
    name: s.name || workspaceName,
    address: { ...base.address, ...(s.address ?? {}) },
    bankDetails: { ...base.bankDetails, ...(s.bankDetails ?? {}) },
  };
};

interface CompanyStore {
  company: Company;
  updateCompany: (data: Partial<Company>) => void;
}

export const useCompanyStore = create<CompanyStore>()((set, get) => ({
  company: blankCompany(),
  updateCompany: (data) => {
    assertCan('settings.manage');
    const previous = get().company;
    const company = { ...previous, ...data };
    set({ company });
    const ws = currentWorkspaceId();
    if (!ws) return;
    void supabase
      .from('workspaces')
      .update({ company })
      .eq('id', ws)
      .then(({ error }) => {
        if (error) {
          set({ company: previous });
          toast.error(friendlyError(error, 'Could not save company settings.'));
        }
      });
    logAudit('settings', 'Updated company profile');
  },
}));
