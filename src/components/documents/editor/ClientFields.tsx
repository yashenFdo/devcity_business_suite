import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Link2, Search, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Customer } from '../../../types';
import { useCustomersStore } from '../../../store/useCustomersStore';
import { useCan } from '../../../security/sessionState';
import { Avatar } from '../../ui/Avatar';
import { Field } from './FormSection';
import { emptyCustomer } from './clientUtils';


interface ClientFieldsProps {
  value: Customer;
  onChange: (c: Customer) => void;
  nameError?: string;
}

/** Pick a saved client (searchable) and/or edit the client details for this document. */
export const ClientFields: React.FC<ClientFieldsProps> = ({ value, onChange, nameError }) => {
  const customers = useCustomersStore((s) => s.customers);
  const addCustomer = useCustomersStore((s) => s.addCustomer);
  const canSave = useCan('customers.manage');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) => !q || `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const select = (c: Customer) => {
    onChange({ ...c, address: { ...c.address } });
    setOpen(false);
    setQuery('');
  };

  const set = (patch: Partial<Customer>) => onChange({ ...value, ...patch });
  const setAddr = (patch: Partial<Customer['address']>) => onChange({ ...value, address: { ...value.address, ...patch } });

  const saveAsClient = () => {
    const created = addCustomer({
      name: value.name,
      company: value.company,
      email: value.email,
      phone: value.phone,
      address: { ...value.address },
      taxNumber: value.taxNumber,
      notes: value.notes,
    });
    onChange(created);
    toast.success(`${created.company || created.name} saved to clients`);
  };

  const linked = value.id ? customers.find((c) => c.id === value.id) : undefined;

  return (
    <div className="space-y-4">
      {customers.length > 0 && (
        <div ref={boxRef} className="relative">
          {linked ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-2.5">
              <Avatar name={linked.company || linked.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-900">{linked.company || linked.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                  <Link2 size={11} /> Saved client{linked.company ? ` · ${linked.name}` : ''}
                </p>
              </div>
              <button type="button" className="btn-sm btn-secondary" onClick={() => setOpen(true)}>
                Change
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost h-7 w-7"
                aria-label="Unlink client"
                title="Clear client"
                onClick={() => onChange(emptyCustomer())}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex h-10 w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-left text-[13px] text-slate-500 transition-colors hover:border-primary-400 hover:text-primary-700"
            >
              <Search size={15} />
              <span className="flex-1">Choose from {customers.length} saved client{customers.length > 1 ? 's' : ''}…</span>
              <ChevronDown size={15} />
            </button>
          )}

          {open && (
            <div className="popover absolute left-0 right-0 top-full z-30 mt-1.5">
              <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 pb-2 pt-1.5">
                <Search size={14} className="text-slate-400" />
                <input
                  autoFocus
                  className="h-7 flex-1 bg-transparent text-[13px] focus:outline-none"
                  placeholder="Search by name, company or email"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActive((a) => Math.min(a + 1, results.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActive((a) => Math.max(a - 1, 0));
                    } else if (e.key === 'Enter' && results[active]) {
                      e.preventDefault();
                      select(results[active]);
                    } else if (e.key === 'Escape') setOpen(false);
                  }}
                />
              </div>
              <div className="max-h-64 overflow-y-auto pt-1">
                {results.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500">No matching clients</p>}
                {results.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseMove={() => setActive(i)}
                    onClick={() => select(c)}
                    className={`menu-item ${i === active ? 'bg-slate-100' : ''}`}
                  >
                    <Avatar name={c.company || c.name} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{c.company || c.name}</span>
                      <span className="block truncate text-xs text-slate-500">{[c.company && c.name, c.email].filter(Boolean).join(' · ')}</span>
                    </span>
                    {value.id === c.id && <Check size={14} className="text-primary-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Contact name" required error={nameError}>
          <input
            className={`input ${nameError ? 'input-error' : ''}`}
            placeholder="e.g. Alex Morgan"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field label="Company">
          <input className="input" placeholder="e.g. NovaCloud Inc." value={value.company} onChange={(e) => set({ company: e.target.value })} />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className="input"
            placeholder="billing@company.com"
            value={value.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input className="input" placeholder="+1 415 555 0134" value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Street address" className="sm:col-span-2">
          <input className="input" placeholder="Street, suite" value={value.address.street} onChange={(e) => setAddr({ street: e.target.value })} />
        </Field>
        <Field label="City">
          <input className="input" placeholder="San Francisco" value={value.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
        </Field>
        <Field label="State / Province">
          <input className="input" placeholder="CA" value={value.address.state} onChange={(e) => setAddr({ state: e.target.value })} />
        </Field>
        <Field label="Postal code">
          <input className="input" placeholder="94107" value={value.address.zipCode} onChange={(e) => setAddr({ zipCode: e.target.value })} />
        </Field>
        <Field label="Country">
          <input className="input" placeholder="United States" value={value.address.country} onChange={(e) => setAddr({ country: e.target.value })} />
        </Field>
        <Field label="Client tax ID" hint="VAT / GST / EIN, if required on invoices" className="sm:col-span-2">
          <input className="input" value={value.taxNumber ?? ''} onChange={(e) => set({ taxNumber: e.target.value })} />
        </Field>
      </div>

      {!value.id && canSave && value.name.trim() && (
        <button type="button" onClick={saveAsClient} className="btn-sm btn-ghost -ml-2 text-primary-700 hover:bg-primary-50">
          <UserPlus size={14} /> Save {value.company || value.name} as a client
        </button>
      )}
    </div>
  );
};
