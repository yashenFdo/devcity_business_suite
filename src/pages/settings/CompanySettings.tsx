import React, { useMemo, useState } from 'react';
import { Globe, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompanyStore } from '../../store/useCompanyStore';
import { Field } from '../../components/documents/editor/FormSection';
import { useSaveShortcut, useUnsavedChangesWarning } from '../../components/documents/editor/useEditorGuards';
import type { Company, CurrencyCode } from '../../types';
import { SUPPORTED_CURRENCIES } from '../../types';
import { SettingsCard, UnsavedBar } from './SettingsPrimitives';

const IconInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }> = ({
  icon: Icon,
  ...props
}) => (
  <div className="relative">
    <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input className="input pl-9" {...props} />
  </div>
);

export const CompanySettings: React.FC = () => {
  const company = useCompanyStore((s) => s.company);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const [form, setForm] = useState<Company>(company);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(company), [form, company]);
  useUnsavedChangesWarning(dirty);

  const set = <K extends keyof Company>(key: K, value: Company[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAddr = (patch: Partial<Company['address']>) => setForm((f) => ({ ...f, address: { ...f.address, ...patch } }));
  const setBank = (patch: Partial<Company['bankDetails']>) =>
    setForm((f) => ({ ...f, bankDetails: { ...f.bankDetails, ...patch } }));

  const nameError = !form.name.trim() ? 'Company name is required.' : '';

  const save = () => {
    if (!dirty) return;
    if (nameError) {
      toast.error(nameError);
      return;
    }
    setSaving(true);
    updateCompany(form);
    setSaving(false);
    toast.success('Company profile saved');
  };
  useSaveShortcut(save);

  return (
    <div className="space-y-6">
      <SettingsCard title="Company information" description="Shown in the header and footer of every document.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={nameError}>
            <input className={`input ${nameError ? 'input-error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Tagline">
            <input className="input" value={form.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
          <Field label="Email">
            <IconInput icon={Mail} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <IconInput icon={Phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <IconInput icon={Globe} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Business address">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Street address" className="sm:col-span-2">
            <input className="input" value={form.address.street} onChange={(e) => setAddr({ street: e.target.value })} />
          </Field>
          <Field label="City">
            <input className="input" value={form.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
          </Field>
          <Field label="State / Province">
            <input className="input" value={form.address.state} onChange={(e) => setAddr({ state: e.target.value })} />
          </Field>
          <Field label="Postal code">
            <input className="input" value={form.address.zipCode} onChange={(e) => setAddr({ zipCode: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className="input" value={form.address.country} onChange={(e) => setAddr({ country: e.target.value })} />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Legal & tax" description="Printed in the document footer.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tax ID" hint="e.g. EIN, VAT or GST number">
            <input className="input" value={form.taxNumber} onChange={(e) => set('taxNumber', e.target.value)} />
          </Field>
          <Field label="Company registration number">
            <input className="input" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} />
          </Field>
          <Field label="Default currency" hint="Used for new documents and dashboard totals.">
            <select
              className="select"
              value={form.currency}
              onChange={(e) => {
                const code = e.target.value as CurrencyCode;
                setForm((f) => ({ ...f, currency: code, currencySymbol: SUPPORTED_CURRENCIES[code].symbol }));
              }}
            >
              {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Bank details"
        description="Shown as payment instructions on invoices. Stored encrypted, like all workspace data."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bank name">
            <input className="input" value={form.bankDetails.bankName} onChange={(e) => setBank({ bankName: e.target.value })} />
          </Field>
          <Field label="Account name">
            <input className="input" value={form.bankDetails.accountName} onChange={(e) => setBank({ accountName: e.target.value })} />
          </Field>
          <Field label="Account number">
            <input
              className="input font-mono"
              value={form.bankDetails.accountNumber}
              onChange={(e) => setBank({ accountNumber: e.target.value })}
            />
          </Field>
          <Field label="SWIFT / BIC">
            <input
              className="input font-mono uppercase"
              value={form.bankDetails.swiftCode ?? ''}
              onChange={(e) => setBank({ swiftCode: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Routing number" hint="US ABA routing number">
            <input
              className="input font-mono"
              value={form.bankDetails.routingNumber ?? ''}
              onChange={(e) => setBank({ routingNumber: e.target.value })}
            />
          </Field>
          <Field label="Branch / IFSC code">
            <input
              className="input font-mono uppercase"
              value={form.bankDetails.ifscCode}
              onChange={(e) => setBank({ ifscCode: e.target.value.toUpperCase() })}
            />
          </Field>
        </div>
      </SettingsCard>

      <UnsavedBar visible={dirty} saving={saving} onSave={save} onDiscard={() => setForm(company)} />
    </div>
  );
};
