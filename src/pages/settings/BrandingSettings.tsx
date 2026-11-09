import React, { useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, PenLine, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompanyStore } from '../../store/useCompanyStore';
import { DocumentPreviewRenderer } from '../../components/documents/DocumentPreviewRenderer';
import { TEMPLATE_OPTIONS, DEFAULT_TEMPLATE } from '../../components/documents/templateOptions';
import type { DocumentData } from '../../components/documents/documentTypes';
import { Field } from '../../components/documents/editor/FormSection';
import { useSaveShortcut, useUnsavedChangesWarning } from '../../components/documents/editor/useEditorGuards';
import type { Company } from '../../types';
import { addDays, today } from '../../utils/formatters';
import { SettingsCard, UnsavedBar } from './SettingsPrimitives';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 512 * 1024;
const HEX = /^#[0-9a-f]{6}$/i;

const COLOR_PRESETS = [
  { name: 'DevCity blue', value: '#1f5bff' },
  { name: 'DevCity navy', value: '#0b1b3f' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Crimson', value: '#be123c' },
  { name: 'Bronze', value: '#b45309' },
];

/** Validates type, size and that the file really decodes as an image. */
const readImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.includes(file.type)) return reject(new Error('Use a PNG, JPG or WebP image.'));
    if (file.size > MAX_BYTES) return reject(new Error('Image must be 512 KB or smaller.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('This file is not a valid image.'));
      img.src = url;
    };
    reader.readAsDataURL(file);
  });

const ImageSlot: React.FC<{
  label: string;
  hint: string;
  icon: React.ElementType;
  value?: string;
  onChange: (v: string | undefined) => void;
}> = ({ label, hint, icon: Icon, value, onChange }) => {
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await readImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  };
  return (
    <div>
      <p className="label">{label}</p>
      <input
        ref={input}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
          <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] p-2 ring-1 ring-slate-200">
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex-1" />
          <button type="button" className="btn-sm btn-secondary" onClick={() => input.current?.click()}>
            Replace
          </button>
          <button
            type="button"
            className="btn-icon btn-ghost hover:bg-rose-50 hover:text-rose-600"
            onClick={() => onChange(undefined)}
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center transition-colors hover:border-primary-300 hover:bg-primary-50/30"
        >
          <Icon size={22} className="text-slate-400" />
          <span className="text-[13px] font-medium text-slate-700">Click or drop an image</span>
          <span className="text-xs text-slate-500">{hint}</span>
        </button>
      )}
    </div>
  );
};

const sampleDocument = (company: Company): DocumentData => ({
  documentType: 'invoice',
  number: 'DEV-INV-2026-042',
  date: today(),
  dueDateOrExpiry: addDays(today(), 30),
  status: 'sent',
  currencySymbol: company.currencySymbol || '$',
  customer: {
    id: 'sample',
    name: 'Alex Morgan',
    company: 'NovaCloud Systems Inc.',
    email: 'accounts@novacloud.io',
    phone: '+1 415 555 0134',
    address: { street: '500 Howard St', city: 'San Francisco', state: 'CA', zipCode: '94105', country: 'United States' },
    createdAt: today(),
    updatedAt: today(),
  },
  projectDescription: 'Sprint 6 — payments microservice, admin dashboard and CI/CD hardening.',
  lineItems: [
    { id: '1', description: 'Dedicated engineering squad (Lead + 2 full-stack engineers)', quantity: 1, unit: 'month', unitPrice: 16000, discount: 0, tax: 0, amount: 16000 },
    { id: '2', description: 'Cloud infrastructure & DevOps setup (Terraform, Kubernetes)', quantity: 1, unit: 'project', unitPrice: 5000, discount: 0, tax: 0, amount: 5000 },
    { id: '3', description: 'Principal architecture consultation', quantity: 12, unit: 'hrs', unitPrice: 125, discount: 0, tax: 0, amount: 1500 },
  ],
  subtotal: 22500,
  discountAmount: 0,
  taxPercent: 0,
  taxAmount: 0,
  total: 22500,
  amountPaid: 0,
  balanceDue: 22500,
  paymentTerms: 'Net 30',
  paymentInstructions: 'Please quote the invoice number as the payment reference.',
  notes: `Thank you for partnering with ${company.name}.`,
  terms: 'Payment is due by the date shown above.',
  company,
});

export const BrandingSettings: React.FC = () => {
  const company = useCompanyStore((s) => s.company);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const [form, setForm] = useState<Company>(company);
  const [hexDraft, setHexDraft] = useState(company.brandColor || '#1f5bff');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(company), [form, company]);
  useUnsavedChangesWarning(dirty);
  const set = <K extends keyof Company>(key: K, value: Company[K]) => setForm((f) => ({ ...f, [key]: value }));
  const color = form.brandColor || '#1f5bff';
  const template = form.defaultTemplate || DEFAULT_TEMPLATE;

  const setColor = (c: string) => {
    setHexDraft(c);
    if (HEX.test(c)) set('brandColor', c.toLowerCase());
  };

  const applyOfficialLogo = async () => {
    try {
      const blob = await (await fetch('/brand/devcity-logo-document.png')).blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(blob);
      });
      set('logo', dataUrl);
      setColor('#1f5bff');
    } catch {
      toast.error('Could not load the DevCity logo.');
    }
  };

  const save = () => {
    if (!dirty) return;
    try {
      updateCompany(form);
      toast.success('Branding saved');
    } catch (e) {
      if (e instanceof DOMException) toast.error('Images are too large for browser storage.');
    }
  };
  useSaveShortcut(save);

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <div className="space-y-6">
        <SettingsCard title="Logo & signature" description="PNG, JPG or WebP up to 512 KB. Transparent backgrounds look best.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <ImageSlot label="Company logo" hint="Recommended 600 × 160 px" icon={ImagePlus} value={form.logo} onChange={(v) => set('logo', v)} />
              <button type="button" className="btn-ghost btn-sm -ml-2 mt-2 text-primary-700 hover:bg-primary-50" onClick={() => void applyOfficialLogo()}>
                <Sparkles size={14} /> Use the official DevCity logo &amp; colour
              </button>
            </div>
            <ImageSlot
              label="Authorised signature"
              hint="Shown on invoices, receipts & quotes"
              icon={PenLine}
              value={form.signature}
              onChange={(v) => set('signature', v)}
            />
          </div>
        </SettingsCard>

        <SettingsCard title="Brand colour" description="Used for accents, totals and headings on your documents.">
          <div className="flex flex-wrap gap-2.5">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={color === p.value}
                onClick={() => setColor(p.value)}
                className="flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-slate-900"
                style={{ background: p.value }}
              >
                {color === p.value && <Check size={15} className="text-white" />}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              aria-label="Custom colour"
            />
            <input
              className={`input w-32 font-mono uppercase ${HEX.test(hexDraft) ? '' : 'input-error'}`}
              value={hexDraft}
              maxLength={7}
              onChange={(e) => setColor(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
              aria-label="Hex colour"
            />
            <span className="text-xs text-slate-500">Custom hex colour</span>
          </div>
        </SettingsCard>

        <SettingsCard title="Default template" description="Pre-selected for new documents. You can still switch per document.">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {TEMPLATE_OPTIONS.map((t) => {
              const active = template === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set('defaultTemplate', t.id)}
                  aria-pressed={active}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                    active ? 'border-primary-400 bg-primary-50/40 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                      active ? 'border-primary-600 bg-primary-600' : 'border-slate-300'
                    }`}
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-slate-900">{t.name}</span>
                    <span className="block text-xs text-slate-500">{t.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard title="Document footer" description="A short closing line printed at the bottom of every document.">
          <Field label="Footer text">
            <textarea
              rows={2}
              className="textarea"
              maxLength={240}
              value={form.footer ?? ''}
              placeholder="e.g. Thank you for your business."
              onChange={(e) => set('footer', e.target.value)}
            />
          </Field>
        </SettingsCard>
      </div>

      <div className="2xl:sticky 2xl:top-6 2xl:self-start">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-[13px] font-semibold text-slate-900">Live preview</p>
            <span className="text-xs text-slate-500">Sample invoice</span>
          </div>
          <div className="bg-slate-100/70 px-2 py-5">
            <DocumentPreviewRenderer data={sampleDocument(form)} templateId={template} gutter={24} />
          </div>
        </div>
      </div>

      <UnsavedBar
        visible={dirty}
        onSave={save}
        onDiscard={() => {
          setForm(company);
          setHexDraft(company.brandColor || '#1f5bff');
        }}
      />
    </div>
  );
};
