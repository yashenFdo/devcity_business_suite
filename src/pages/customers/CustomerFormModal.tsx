import React, { useId, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/documents/editor/FormSection';
import { useCustomersStore } from '../../store/useCustomersStore';
import { PermissionError } from '../../security/sessionState';
import type { Customer } from '../../types';

type ClientDraft = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
type ValidatedField = 'name' | 'email' | 'phone';
type Errors = Partial<Record<ValidatedField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s().-]{6,}$/;

const emptyDraft = (): ClientDraft => ({
  name: '',
  company: '',
  email: '',
  phone: '',
  address: { street: '', city: '', state: '', zipCode: '', country: '' },
  taxNumber: '',
  notes: '',
});

const toDraft = (c: Customer): ClientDraft => ({
  name: c.name || '',
  company: c.company || '',
  email: c.email || '',
  phone: c.phone || '',
  address: {
    street: c.address?.street || '',
    city: c.address?.city || '',
    state: c.address?.state || '',
    zipCode: c.address?.zipCode || '',
    country: c.address?.country || '',
  },
  taxNumber: c.taxNumber || '',
  notes: c.notes || '',
});

const trimDraft = (d: ClientDraft): ClientDraft => ({
  name: d.name.trim(),
  company: d.company.trim(),
  email: d.email.trim(),
  phone: d.phone.trim(),
  address: {
    street: d.address.street.trim(),
    city: d.address.city.trim(),
    state: d.address.state.trim(),
    zipCode: d.address.zipCode.trim(),
    country: d.address.country.trim(),
  },
  taxNumber: (d.taxNumber || '').trim(),
  notes: (d.notes || '').trim(),
});

const validate = (d: ClientDraft): Errors => {
  const e: Errors = {};
  if (!d.name.trim()) e.name = 'Enter the contact name.';
  const email = d.email.trim();
  if (email && !EMAIL_RE.test(email)) e.email = 'Enter a valid email, e.g. billing@company.com.';
  const phone = d.phone.trim();
  if (phone && !PHONE_RE.test(phone)) e.phone = 'Use digits, spaces and + ( ) - only.';
  return e;
};

const FieldGroup: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <h3 id={id} className="text-[13px] font-semibold text-slate-900">
        {title}
      </h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">{children}</div>
    </div>
  );
};

interface CustomerFormModalProps {
  /** Client being edited, or null to create a new one. */
  client: Customer | null;
  onClose: () => void;
  onSaved: (client: Customer, created: boolean) => void;
}

/** Add / edit a client. Mount with a `key` per client so the form resets cleanly. */
export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ client, onClose, onSaved }) => {
  const customers = useCustomersStore((s) => s.customers);
  const addCustomer = useCustomersStore((s) => s.addCustomer);
  const updateCustomer = useCustomersStore((s) => s.updateCustomer);

  const uid = useId();
  const formId = `${uid}-form`;
  const fid = (name: string) => `${uid}-${name}`;

  const [initial] = useState<ClientDraft>(() => (client ? toDraft(client) : emptyDraft()));
  const [draft, setDraft] = useState<ClientDraft>(initial);
  const [touched, setTouched] = useState<Partial<Record<ValidatedField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(draft);
  const shown = (f: ValidatedField) => (submitted || touched[f] ? errors[f] : undefined);
  const touch = (f: ValidatedField) => () => setTouched((t) => (t[f] ? t : { ...t, [f]: true }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const set = (patch: Partial<ClientDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setAddr = (patch: Partial<ClientDraft['address']>) =>
    setDraft((d) => ({ ...d, address: { ...d.address, ...patch } }));

  const emailInUseBy = useMemo(() => {
    const e = draft.email.trim().toLowerCase();
    if (!e) return undefined;
    return customers.find((c) => c.id !== client?.id && (c.email || '').trim().toLowerCase() === e);
  }, [customers, draft.email, client?.id]);

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your unsaved changes to this client?')) return;
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const order: ValidatedField[] = ['name', 'email', 'phone'];
    const firstInvalid = order.find((f) => errors[f]);
    if (firstInvalid) {
      setSubmitted(true);
      document.getElementById(fid(firstInvalid))?.focus();
      return;
    }
    const data = trimDraft(draft);
    try {
      if (client) {
        updateCustomer(client.id, data);
        toast.success(`${data.company || data.name} updated`);
        onSaved({ ...client, ...data }, false);
      } else {
        const created = addCustomer(data);
        toast.success(`${created.company || created.name} added to clients`);
        onSaved(created, true);
      }
    } catch (err) {
      // assertCan already shows a toast for permission failures.
      if (!(err instanceof PermissionError)) toast.error('Could not save the client. Please try again.');
    }
  };

  const err = (f: ValidatedField) => shown(f);
  const inputCls = (f?: ValidatedField) => `input ${f && err(f) ? 'input-error' : ''}`;

  return (
    <Modal
      isOpen
      onClose={requestClose}
      size="2xl"
      title={client ? 'Edit client' : 'Add client'}
      description={
        client
          ? 'Changes apply to new documents. Existing documents keep the details they were issued with.'
          : 'Save a client once and pick them in seconds on any invoice or quotation.'
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn-primary">
            {client ? 'Save changes' : 'Add client'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <FieldGroup title="Contact" description="The person you deal with and how to reach them.">
          <Field label="Contact name" htmlFor={fid('name')} required error={err('name')}>
            <input
              id={fid('name')}
              autoFocus
              autoComplete="off"
              className={inputCls('name')}
              placeholder="e.g. Alex Morgan"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              onBlur={touch('name')}
              aria-invalid={!!err('name')}
            />
          </Field>
          <Field label="Company" htmlFor={fid('company')}>
            <input
              id={fid('company')}
              autoComplete="off"
              className="input"
              placeholder="e.g. NovaCloud Inc."
              value={draft.company}
              onChange={(e) => set({ company: e.target.value })}
            />
          </Field>
          <Field
            label="Email"
            htmlFor={fid('email')}
            error={err('email')}
            hint={emailInUseBy ? `Also used by ${emailInUseBy.company || emailInUseBy.name}.` : undefined}
          >
            <input
              id={fid('email')}
              type="email"
              inputMode="email"
              autoComplete="off"
              className={inputCls('email')}
              placeholder="billing@company.com"
              value={draft.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={touch('email')}
              aria-invalid={!!err('email')}
            />
          </Field>
          <Field label="Phone" htmlFor={fid('phone')} error={err('phone')}>
            <input
              id={fid('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className={inputCls('phone')}
              placeholder="+94 77 123 4567"
              value={draft.phone}
              onChange={(e) => set({ phone: e.target.value })}
              onBlur={touch('phone')}
              aria-invalid={!!err('phone')}
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="Billing address" description="Printed in the “Bill to” block of documents.">
          <Field label="Street address" htmlFor={fid('street')} className="sm:col-span-2">
            <input
              id={fid('street')}
              className="input"
              placeholder="Street, building, suite"
              value={draft.address.street}
              onChange={(e) => setAddr({ street: e.target.value })}
            />
          </Field>
          <Field label="City" htmlFor={fid('city')}>
            <input id={fid('city')} className="input" value={draft.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
          </Field>
          <Field label="State / Province" htmlFor={fid('state')}>
            <input id={fid('state')} className="input" value={draft.address.state} onChange={(e) => setAddr({ state: e.target.value })} />
          </Field>
          <Field label="Postal code" htmlFor={fid('zip')}>
            <input id={fid('zip')} className="input" value={draft.address.zipCode} onChange={(e) => setAddr({ zipCode: e.target.value })} />
          </Field>
          <Field label="Country" htmlFor={fid('country')}>
            <input
              id={fid('country')}
              className="input"
              placeholder="e.g. Sri Lanka"
              value={draft.address.country}
              onChange={(e) => setAddr({ country: e.target.value })}
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="Tax & notes">
          <Field label="Tax ID" htmlFor={fid('tax')} hint="VAT / GST / EIN, if it must appear on invoices." className="sm:col-span-2">
            <input
              id={fid('tax')}
              className="input"
              value={draft.taxNumber}
              onChange={(e) => set({ taxNumber: e.target.value })}
            />
          </Field>
          <Field label="Notes" htmlFor={fid('notes')} hint="Internal only — never printed on documents." className="sm:col-span-2">
            <textarea
              id={fid('notes')}
              className="textarea"
              rows={3}
              placeholder="Billing preferences, PO requirements, key contacts…"
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
        </FieldGroup>
      </form>
    </Modal>
  );
};
