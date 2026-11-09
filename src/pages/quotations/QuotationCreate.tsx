import React, { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, FileText, Loader2, Printer, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { useCustomersStore } from '../../store/useCustomersStore';
import { SignOffSection } from '../../components/documents/editor/SignOffSection';
import { defaultSignOff, pickSignOff, resolveSignOff } from '../../components/documents/signOff';
import { useStampsStore } from '../../store/useStampsStore';
import { LineItemsTable } from '../../components/documents/LineItemsTable';
import { TotalsSection } from '../../components/documents/TotalsSection';
import { DocumentPreviewRenderer } from '../../components/documents/DocumentPreviewRenderer';
import { EditorShell } from '../../components/documents/editor/EditorShell';
import { Field, FormSection } from '../../components/documents/editor/FormSection';
import { ClientFields } from '../../components/documents/editor/ClientFields';
import { emptyCustomer } from '../../components/documents/editor/clientUtils';
import { useSaveShortcut, useUnsavedChangesWarning } from '../../components/documents/editor/useEditorGuards';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { DEFAULT_TEMPLATE } from '../../components/documents/templateOptions';
import type { DocumentData } from '../../components/documents/documentTypes';
import { StatusBadge } from '../../components/ui/Badge';
import { NotFoundState } from '../../components/ui/States';
import type { Company, Customer, CurrencyCode, DiscountType, LineItem, Quotation, SignOffOptions, TemplateId } from '../../types';
import { SUPPORTED_CURRENCIES } from '../../types';
import { generateId, generateQuotationNumber } from '../../utils/documentNumber';
import { calculateDocumentTotals } from '../../utils/calculations';
import { addDays, formatDate, today } from '../../utils/formatters';
import { daysBetween } from './quotationDocument';

interface QuotationForm {
  quotationNumber: string;
  date: string;
  validUntil: string;
  status: Quotation['status'];
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  projectDescription: string;
  customer: Customer;
  lineItems: LineItem[];
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
  notes: string;
  terms: string;
  signOff: SignOffOptions;
}

const VALIDITY_PRESETS = [15, 30, 60, 90];

const STATUS_OPTIONS: { value: Quotation['status']; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

const blankItem = (): LineItem => ({
  id: generateId(),
  description: '',
  quantity: 1,
  unit: 'hrs',
  unitPrice: 0,
  discount: 0,
  tax: 0,
  amount: 0,
});

const fromQuotation = (q: Quotation): QuotationForm => ({
  quotationNumber: q.quotationNumber,
  date: q.date,
  validUntil: q.validUntil,
  status: q.status,
  currency: q.currency || 'USD',
  currencySymbol: q.currencySymbol || '$',
  templateId: q.templateId || DEFAULT_TEMPLATE,
  projectDescription: q.projectDescription || '',
  customer: q.customer,
  lineItems: q.lineItems?.length ? q.lineItems : [blankItem()],
  discountType: q.discountType || 'percent',
  discountValue: q.discountValue || 0,
  taxPercent: q.taxPercent || 0,
  notes: q.notes || '',
  terms: q.terms || '',
  signOff: pickSignOff(q),
});

const newQuotation = (company: Company, existingNumbers: string[]): QuotationForm => ({
  quotationNumber: generateQuotationNumber(existingNumbers),
  date: today(),
  validUntil: addDays(today(), 30),
  status: 'draft',
  currency: company.currency || 'USD',
  currencySymbol: company.currencySymbol || '$',
  templateId: company.defaultTemplate || DEFAULT_TEMPLATE,
  projectDescription: '',
  customer: emptyCustomer(),
  lineItems: [blankItem()],
  discountType: 'percent',
  discountValue: 0,
  taxPercent: 0,
  notes: `Thank you for considering ${company.name}. We look forward to working with you.`,
  terms:
    'This quotation is valid until the date shown above. A 50% mobilisation fee is due on acceptance, with the balance invoiced on delivery. Work outside the agreed scope is quoted separately.',
  signOff: defaultSignOff(company),
});

/** Route wrapper: remounts the editor when switching between documents. */
export const QuotationCreate: React.FC<{ editMode?: boolean }> = ({ editMode = false }) => {
  const { id } = useParams<{ id: string }>();
  return <QuotationEditor key={editMode ? id : 'new'} editId={editMode ? id : undefined} />;
};

const QuotationEditor: React.FC<{ editId?: string }> = ({ editId }) => {
  const navigate = useNavigate();
  const quotations = useQuotationsStore((s) => s.quotations);
  const addQuotation = useQuotationsStore((s) => s.addQuotation);
  const updateQuotation = useQuotationsStore((s) => s.updateQuotation);
  const company = useCompanyStore((s) => s.company);
  const customers = useCustomersStore((s) => s.customers);
  const stamps = useStampsStore((s) => s.stamps);
  const location = useLocation();
  const existing = editId ? quotations.find((q) => q.id === editId) : undefined;
  const linkedInvoice = useInvoicesStore((s) =>
    existing?.convertedToInvoiceId ? s.invoices.find((i) => i.id === existing.convertedToInvoiceId) : undefined
  );

  const [initial] = useState<QuotationForm>(() => {
    if (existing) return fromQuotation(existing);
    const form = newQuotation(company, quotations.map((q) => q.quotationNumber));
    // Optional prefill: navigate('/quotations/new', { state: { customerId } })
    const preselect = customers.find((c) => c.id === (location.state as { customerId?: string } | null)?.customerId);
    return preselect ? { ...form, customer: { ...preselect, address: { ...preselect.address } } } : form;
  });
  const [form, setForm] = useState<QuotationForm>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof QuotationForm>(key: K, value: QuotationForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  useUnsavedChangesWarning(dirty && !saving);

  const totals = calculateDocumentTotals(form.lineItems, form.discountValue, form.taxPercent, form.discountType);
  const validDays = daysBetween(form.date, form.validUntil);

  const errors = {
    client: !form.customer.name.trim() ? 'Client name is required.' : '',
    items: !form.lineItems.some((i) => i.description.trim() && i.amount > 0)
      ? 'Add at least one item with a description and price.'
      : '',
    dates: form.validUntil < form.date ? 'Valid-until date is before the issue date.' : '',
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const preview: DocumentData = {
    documentType: 'quotation',
    number: form.quotationNumber,
    date: form.date,
    dueDateOrExpiry: form.validUntil,
    status: form.status,
    currencySymbol: form.currencySymbol,
    customer: form.customer,
    projectDescription: form.projectDescription,
    lineItems: form.lineItems,
    subtotal: totals.subtotal,
    discountType: form.discountType,
    discountValue: form.discountValue,
    discountAmount: totals.discountAmount,
    discountPercent: totals.discountPercent,
    taxPercent: form.taxPercent,
    taxAmount: totals.taxAmount,
    total: totals.total,
    notes: form.notes,
    terms: form.terms,
    acceptanceSignature: existing?.acceptanceSignature,
    clientSignerName: existing?.clientSignerName,
    acceptedDate: existing?.acceptedDate,
    company, // saving re-snapshots the current company profile, so preview it as-is
    templateId: form.templateId,
    ...resolveSignOff(form.signOff, company, stamps, false, form.date),
  };

  const handlePrint = useDocumentPrint(printRef, form.quotationNumber || 'Quotation');

  const save = (issue = false) => {
    setSubmitted(true);
    if (hasErrors) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    const status: Quotation['status'] = issue && form.status === 'draft' ? 'sent' : form.status;
    const payload = {
      quotationNumber: form.quotationNumber,
      date: form.date,
      validUntil: form.validUntil,
      status,
      customer: form.customer,
      projectDescription: form.projectDescription,
      lineItems: form.lineItems.filter((i) => i.description.trim() || i.amount > 0),
      subtotal: totals.subtotal,
      discountType: form.discountType,
      discountValue: form.discountValue,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      taxPercent: form.taxPercent,
      taxAmount: totals.taxAmount,
      total: totals.total,
      currency: form.currency,
      currencySymbol: form.currencySymbol,
      templateId: form.templateId,
      notes: form.notes,
      terms: form.terms,
      companySnapshot: company,
      ...pickSignOff(form.signOff),
    };
    try {
      if (existing) {
        updateQuotation(existing.id, payload);
        toast.success(`${form.quotationNumber} saved`);
        navigate(`/quotations/${existing.id}`);
      } else {
        const created = addQuotation(payload);
        toast.success(issue ? `${created.quotationNumber} created and marked as sent` : `${created.quotationNumber} saved as draft`);
        navigate(`/quotations/${created.id}`);
      }
    } catch {
      setSaving(false);
    }
  };

  useSaveShortcut(() => save(false));

  if (editId && !existing) {
    return (
      <div className="p-8">
        <NotFoundState what="Quotation" backTo="/quotations" backLabel="Back to quotations" />
      </div>
    );
  }

  return (
    <EditorShell
      backTo={existing ? `/quotations/${existing.id}` : '/quotations'}
      title={existing ? 'Edit quotation' : 'New quotation'}
      number={form.quotationNumber}
      badge={<StatusBadge status={form.status} />}
      templateId={form.templateId}
      onTemplateChange={(t) => set('templateId', t)}
      currency={form.currency}
      onCurrencyChange={(c) => setForm((f) => ({ ...f, currency: c, currencySymbol: SUPPORTED_CURRENCIES[c].symbol }))}
      actions={
        <>
          <button type="button" className="btn-ghost btn-sm hidden md:inline-flex" onClick={() => handlePrint()}>
            <Printer size={15} /> Preview PDF
          </button>
          {existing ? (
            <button type="button" className="btn-primary btn-sm" onClick={() => save(false)} disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save changes
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary btn-sm" onClick={() => save(false)} disabled={saving}>
                Save draft
              </button>
              <button type="button" className="btn-primary btn-sm" onClick={() => save(true)} disabled={saving}>
                <Send size={14} /> <span className="hidden sm:inline">Save &</span> issue
              </button>
            </>
          )}
        </>
      }
      footer={
        <p className="px-1 text-center text-xs text-slate-400">
          {dirty ? 'Unsaved changes' : existing ? `Last saved ${formatDate(existing.updatedAt, 'dd MMM yyyy, HH:mm')}` : 'Not saved yet'} ·
          Press <span className="kbd">Ctrl</span> <span className="kbd">S</span> to save
        </p>
      }
      form={
        <>
          {existing?.convertedToInvoiceId && (
            <div className="flex items-start gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-[13px] text-primary-900">
              <FileText size={16} className="mt-0.5 flex-shrink-0 text-primary-600" />
              <p>
                This quotation was converted to{' '}
                {linkedInvoice ? (
                  <Link to={`/invoices/${linkedInvoice.id}`} className="font-mono font-medium underline-offset-2 hover:underline">
                    {linkedInvoice.invoiceNumber}
                  </Link>
                ) : (
                  'an invoice'
                )}
                . Changes made here won't update the invoice.
              </p>
            </div>
          )}

          <FormSection step={1} title="Client" description="Who is this quotation for?">
            <ClientFields
              value={form.customer}
              onChange={(c) => set('customer', c)}
              nameError={submitted ? errors.client : ''}
            />
          </FormSection>

          <FormSection step={2} title="Quotation details">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Field label="Quotation number">
                <input
                  className="input font-mono"
                  aria-label="Quotation number"
                  value={form.quotationNumber}
                  onChange={(e) => set('quotationNumber', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Issue date">
                <input
                  type="date"
                  className="input"
                  aria-label="Issue date"
                  value={form.date}
                  onChange={(e) => {
                    const date = e.target.value;
                    // Keep the same validity period when the issue date moves.
                    setForm((f) => {
                      const period = daysBetween(f.date, f.validUntil);
                      return { ...f, date, validUntil: date && period !== null && period >= 0 ? addDays(date, period) : f.validUntil };
                    });
                  }}
                />
              </Field>
              <Field label="Valid until" error={submitted ? errors.dates : ''}>
                <input
                  type="date"
                  className="input"
                  aria-label="Valid until"
                  value={form.validUntil}
                  onChange={(e) => set('validUntil', e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                <span className="text-xs text-slate-500">Valid for</span>
                <div className="segmented" role="group" aria-label="Validity period">
                  {VALIDITY_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={validDays === d}
                      onClick={() => setForm((f) => ({ ...f, validUntil: addDays(f.date, d) }))}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
                {validDays !== null && validDays >= 0 && !VALIDITY_PRESETS.includes(validDays) && (
                  <span className="text-xs text-slate-400">Custom · {validDays} days</span>
                )}
              </div>
              <Field label="Scope of work" className="sm:col-span-3" hint="Summarise the engagement. Appears above the line items.">
                <textarea
                  rows={3}
                  className="textarea"
                  placeholder="e.g. Design and build of a customer self-service portal, including SSO, billing integration and admin dashboard."
                  value={form.projectDescription}
                  onChange={(e) => set('projectDescription', e.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection step={3} title="Line items" description="Phases, milestones or services being quoted.">
            <LineItemsTable
              items={form.lineItems}
              onChange={(items) => set('lineItems', items)}
              currencySymbol={form.currencySymbol}
              error={submitted ? errors.items : ''}
            />
          </FormSection>

          <FormSection step={4} title="Pricing">
            <TotalsSection
              subtotal={totals.subtotal}
              discountType={form.discountType}
              discountValue={form.discountValue}
              discountAmount={totals.discountAmount}
              discountPercent={totals.discountPercent}
              taxPercent={form.taxPercent}
              taxAmount={totals.taxAmount}
              total={totals.total}
              currencySymbol={form.currencySymbol}
              onDiscountTypeChange={(t) => set('discountType', t)}
              onDiscountValueChange={(v) => set('discountValue', v)}
              onTaxChange={(v) => set('taxPercent', v)}
            />
          </FormSection>

          <FormSection step={5} title="Notes & terms" description="Shown at the bottom of the quotation.">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Note to client">
                <textarea
                  rows={4}
                  className="textarea"
                  aria-label="Note to client"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
              <Field label="Terms & conditions">
                <textarea
                  rows={4}
                  className="textarea"
                  aria-label="Terms and conditions"
                  value={form.terms}
                  onChange={(e) => set('terms', e.target.value)}
                />
              </Field>
            </div>
            {existing && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
                <label htmlFor="quotation-status" className="text-xs text-slate-600">
                  Status
                </label>
                <select
                  id="quotation-status"
                  className="select h-8 w-44 text-xs"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as Quotation['status'])}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </FormSection>

          <SignOffSection
            step={6}
            value={form.signOff}
            onChange={(v) => set('signOff', v)}
            documentType="quotation"
            documentDate={form.date}
            isPaid={false}
          />
        </>
      }
      preview={<DocumentPreviewRenderer ref={printRef} data={preview} templateId={form.templateId} />}
    />
  );
};
