import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Loader2, Printer, Send } from 'lucide-react';
import toast from 'react-hot-toast';
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
import { PAYMENT_METHOD_OPTIONS, PAYMENT_TERMS } from '../../components/documents/paymentMethods';
import { DEFAULT_TEMPLATE } from '../../components/documents/templateOptions';
import type { DocumentData } from '../../components/documents/documentTypes';
import { StatusBadge } from '../../components/ui/Badge';
import { NotFoundState } from '../../components/ui/States';
import type { Company, Customer, CurrencyCode, DiscountType, Invoice, LineItem, PaymentMethod, SignOffOptions, TemplateId } from '../../types';
import { SUPPORTED_CURRENCIES } from '../../types';
import { generateId, generateInvoiceNumber } from '../../utils/documentNumber';
import { calculateDocumentTotals } from '../../utils/calculations';
import { addDays, formatDate, today } from '../../utils/formatters';

interface InvoiceForm {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: Invoice['status'];
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  projectDescription: string;
  customer: Customer;
  lineItems: LineItem[];
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
  amountPaid: number;
  paymentTerms: string;
  paymentMethod: PaymentMethod;
  paymentInstructions: string;
  notes: string;
  terms: string;
  signOff: SignOffOptions;
}

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

const fromInvoice = (inv: Invoice): InvoiceForm => ({
  invoiceNumber: inv.invoiceNumber,
  date: inv.date,
  dueDate: inv.dueDate,
  status: inv.status,
  currency: inv.currency || 'USD',
  currencySymbol: inv.currencySymbol || '$',
  templateId: inv.templateId || DEFAULT_TEMPLATE,
  projectDescription: inv.projectDescription || '',
  customer: inv.customer,
  lineItems: inv.lineItems?.length ? inv.lineItems : [blankItem()],
  discountType: inv.discountType || 'percent',
  discountValue: inv.discountValue || 0,
  taxPercent: inv.taxPercent || 0,
  amountPaid: inv.amountPaid || 0,
  paymentTerms: inv.paymentTerms || 'Net 30',
  paymentMethod: inv.paymentMethod || 'bank_transfer',
  paymentInstructions: inv.paymentInstructions || '',
  notes: inv.notes || '',
  terms: inv.terms || '',
  signOff: pickSignOff(inv),
});

const newInvoice = (company: Company, existingNumbers: string[]): InvoiceForm => ({
  invoiceNumber: generateInvoiceNumber(existingNumbers),
  date: today(),
  dueDate: addDays(today(), 30),
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
  amountPaid: 0,
  paymentTerms: 'Net 30',
  paymentMethod: 'bank_transfer',
  paymentInstructions: company.bankDetails?.bankName
    ? `Please transfer funds to ${company.bankDetails.bankName}, quoting the invoice number as the payment reference.`
    : '',
  notes: `Thank you for partnering with ${company.name}.`,
  terms: 'Payment is due by the date shown above. Late payments may incur a 1.5% monthly service charge.',
  signOff: defaultSignOff(company),
});

/** Route wrapper: remounts the editor when switching between documents. */
export const InvoiceCreate: React.FC<{ editMode?: boolean }> = ({ editMode = false }) => {
  const { id } = useParams<{ id: string }>();
  return <InvoiceEditor key={editMode ? id : 'new'} editId={editMode ? id : undefined} />;
};

const InvoiceEditor: React.FC<{ editId?: string }> = ({ editId }) => {
  const navigate = useNavigate();
  const invoices = useInvoicesStore((s) => s.invoices);
  const addInvoice = useInvoicesStore((s) => s.addInvoice);
  const updateInvoice = useInvoicesStore((s) => s.updateInvoice);
  const company = useCompanyStore((s) => s.company);
  const customers = useCustomersStore((s) => s.customers);
  const stamps = useStampsStore((s) => s.stamps);
  const location = useLocation();
  const existing = editId ? invoices.find((i) => i.id === editId) : undefined;

  const [initial] = useState<InvoiceForm>(() => {
    if (existing) return fromInvoice(existing);
    const form = newInvoice(company, invoices.map((i) => i.invoiceNumber));
    // Optional prefill: navigate('/invoices/new', { state: { customerId } })
    const preselect = customers.find((c) => c.id === (location.state as { customerId?: string } | null)?.customerId);
    return preselect ? { ...form, customer: { ...preselect, address: { ...preselect.address } } } : form;
  });
  const [form, setForm] = useState<InvoiceForm>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  useUnsavedChangesWarning(dirty && !saving);

  const totals = calculateDocumentTotals(form.lineItems, form.discountValue, form.taxPercent, form.discountType);
  const amountPaid = Math.min(form.amountPaid, totals.total);
  const balanceDue = Math.max(0, Math.round((totals.total - amountPaid) * 100) / 100);
  const derivedStatus: Invoice['status'] =
    form.status === 'draft' || form.status === 'cancelled'
      ? form.status
      : amountPaid > 0 && balanceDue === 0
        ? 'paid'
        : amountPaid > 0
          ? 'partially_paid'
          : form.status === 'paid' || form.status === 'partially_paid'
            ? 'sent'
            : form.status;

  const errors = {
    client: !form.customer.name.trim() ? 'Client name is required.' : '',
    items: !form.lineItems.some((i) => i.description.trim() && i.amount > 0)
      ? 'Add at least one item with a description and price.'
      : '',
    dates: form.dueDate < form.date ? 'Due date is before the issue date.' : '',
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const preview: DocumentData = {
    documentType: 'invoice',
    number: form.invoiceNumber,
    date: form.date,
    dueDateOrExpiry: form.dueDate,
    status: derivedStatus,
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
    amountPaid,
    balanceDue,
    paymentMethod: form.paymentMethod,
    paymentTerms: form.paymentTerms,
    paymentInstructions: form.paymentInstructions,
    notes: form.notes,
    terms: form.terms,
    company, // saving re-snapshots the current company profile, so preview it as-is
    templateId: form.templateId,
    ...resolveSignOff(form.signOff, company, stamps, derivedStatus === 'paid', form.date),
  };

  const handlePrint = useDocumentPrint(printRef, form.invoiceNumber || 'Invoice');

  const save = (issue = false) => {
    setSubmitted(true);
    if (hasErrors) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    const status: Invoice['status'] = issue && derivedStatus === 'draft' ? 'sent' : derivedStatus;
    const payload = {
      invoiceNumber: form.invoiceNumber,
      date: form.date,
      dueDate: form.dueDate,
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
      amountPaid,
      balanceDue,
      paymentTerms: form.paymentTerms,
      paymentMethod: form.paymentMethod,
      paymentInstructions: form.paymentInstructions,
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
        updateInvoice(existing.id, payload);
        toast.success(`${form.invoiceNumber} saved`);
        navigate(`/invoices/${existing.id}`);
      } else {
        const created = addInvoice(payload);
        toast.success(issue ? `${created.invoiceNumber} created and marked as sent` : `${created.invoiceNumber} saved as draft`);
        navigate(`/invoices/${created.id}`);
      }
    } catch {
      setSaving(false);
    }
  };

  useSaveShortcut(() => save(false));

  if (editId && !existing) return <div className="p-8"><NotFoundState what="Invoice" backTo="/invoices" backLabel="Back to invoices" /></div>;

  const applyTerms = (label: string) => {
    const days = PAYMENT_TERMS.find((t) => t.label === label)?.days;
    setForm((f) => ({ ...f, paymentTerms: label, dueDate: days === null || days === undefined ? f.dueDate : addDays(f.date, days) }));
  };

  return (
    <EditorShell
      backTo={existing ? `/invoices/${existing.id}` : '/invoices'}
      title={existing ? 'Edit invoice' : 'New invoice'}
      number={form.invoiceNumber}
      badge={<StatusBadge status={derivedStatus} />}
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
          <FormSection step={1} title="Client" description="Who is this invoice for?">
            <ClientFields
              value={form.customer}
              onChange={(c) => set('customer', c)}
              nameError={submitted ? errors.client : ''}
            />
          </FormSection>

          <FormSection step={2} title="Invoice details">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Field label="Invoice number">
                <input
                  className="input font-mono"
                  value={form.invoiceNumber}
                  onChange={(e) => set('invoiceNumber', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Issue date">
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={(e) => {
                    const date = e.target.value;
                    const days = PAYMENT_TERMS.find((t) => t.label === form.paymentTerms)?.days;
                    setForm((f) => ({ ...f, date, dueDate: typeof days === 'number' ? addDays(date, days) : f.dueDate }));
                  }}
                />
              </Field>
              <Field label="Due date" error={submitted ? errors.dates : ''}>
                <input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
              </Field>
              <Field label="Project / scope" className="sm:col-span-3" hint="Appears as a summary above the line items.">
                <textarea
                  rows={2}
                  className="textarea"
                  placeholder="e.g. Sprint 4 — payments microservice and admin dashboard"
                  value={form.projectDescription}
                  onChange={(e) => set('projectDescription', e.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection step={3} title="Line items" description="Services, sprints or milestones being billed.">
            <LineItemsTable
              items={form.lineItems}
              onChange={(items) => set('lineItems', items)}
              currencySymbol={form.currencySymbol}
              error={submitted ? errors.items : ''}
            />
          </FormSection>

          <FormSection step={4} title="Totals & payment">
            <TotalsSection
              subtotal={totals.subtotal}
              discountType={form.discountType}
              discountValue={form.discountValue}
              discountAmount={totals.discountAmount}
              discountPercent={totals.discountPercent}
              taxPercent={form.taxPercent}
              taxAmount={totals.taxAmount}
              total={totals.total}
              amountPaid={amountPaid}
              balanceDue={balanceDue}
              currencySymbol={form.currencySymbol}
              onDiscountTypeChange={(t) => set('discountType', t)}
              onDiscountValueChange={(v) => set('discountValue', v)}
              onTaxChange={(v) => set('taxPercent', v)}
            />
            <div className="mt-5 grid grid-cols-1 gap-3.5 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <Field label="Payment terms" hint="Updates the due date automatically.">
                <select className="select" value={form.paymentTerms} onChange={(e) => applyTerms(e.target.value)}>
                  {!PAYMENT_TERMS.some((t) => t.label === form.paymentTerms) && <option>{form.paymentTerms}</option>}
                  {PAYMENT_TERMS.map((t) => (
                    <option key={t.label}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred payment method">
                <select
                  className="select"
                  value={form.paymentMethod}
                  onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Payment instructions"
                className="sm:col-span-2"
                hint="Bank details from Company Settings are added automatically."
              >
                <textarea
                  rows={2}
                  className="textarea"
                  value={form.paymentInstructions}
                  onChange={(e) => set('paymentInstructions', e.target.value)}
                />
              </Field>
              {existing && (
                <Field
                  label={`Amount already paid (${form.currencySymbol})`}
                  className="sm:col-span-2"
                  hint="Tip: use “Record payment” on the invoice page instead — it also issues a receipt."
                >
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="input tabular sm:w-48"
                    value={form.amountPaid}
                    onChange={(e) => set('amountPaid', Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </Field>
              )}
            </div>
          </FormSection>

          <FormSection step={5} title="Notes & terms" description="Shown at the bottom of the invoice.">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Note to client">
                <textarea rows={4} className="textarea" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>
              <Field label="Terms & conditions">
                <textarea rows={4} className="textarea" value={form.terms} onChange={(e) => set('terms', e.target.value)} />
              </Field>
            </div>
            {existing && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs text-slate-600">Status</span>
                <select
                  className="select h-8 w-44 text-xs"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as Invoice['status'])}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="cancelled">Cancelled (void)</option>
                  {(form.status === 'paid' || form.status === 'partially_paid' || form.status === 'overdue') && (
                    <option value={form.status}>{form.status === 'partially_paid' ? 'Partially paid' : form.status === 'paid' ? 'Paid' : 'Overdue'}</option>
                  )}
                </select>
              </div>
            )}
          </FormSection>

          <SignOffSection
            step={6}
            value={form.signOff}
            onChange={(v) => set('signOff', v)}
            documentType="invoice"
            documentDate={form.date}
            isPaid={derivedStatus === 'paid'}
          />
        </>
      }
      preview={<DocumentPreviewRenderer ref={printRef} data={preview} templateId={form.templateId} />}
    />
  );
};
