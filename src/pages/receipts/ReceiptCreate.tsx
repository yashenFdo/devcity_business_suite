import React, { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, FileText, Info, Mail, Pencil, Receipt as ReceiptIcon, Search, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { SignOffSection } from '../../components/documents/editor/SignOffSection';
import { defaultSignOff, pickSignOff } from '../../components/documents/signOff';
import { useStampsStore } from '../../store/useStampsStore';
import { DocumentPreviewRenderer } from '../../components/documents/DocumentPreviewRenderer';
import { EditorShell } from '../../components/documents/editor/EditorShell';
import { Field, FormSection } from '../../components/documents/editor/FormSection';
import { ClientFields } from '../../components/documents/editor/ClientFields';
import { emptyCustomer } from '../../components/documents/editor/clientUtils';
import { useSaveShortcut, useUnsavedChangesWarning } from '../../components/documents/editor/useEditorGuards';
import { useDraftAutosave, useDraftKey } from '../../components/documents/editor/useDraftAutosave';
import { useSaveFeedback } from '../../components/documents/editor/useSaveFeedback';
import { DraftBanner } from '../../components/documents/editor/DraftBanner';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { PAYMENT_METHOD_OPTIONS } from '../../components/documents/paymentMethods';
import { DEFAULT_TEMPLATE } from '../../components/documents/templateOptions';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { NotFoundState } from '../../components/ui/States';
import type { Company, CurrencyCode, Customer, Invoice, PaymentMethod, Receipt, SignOffOptions, TemplateId } from '../../types';
import { SUPPORTED_CURRENCIES } from '../../types';
import { generateReceiptNumber } from '../../utils/documentNumber';
import { formatCurrency, formatDate, today } from '../../utils/formatters';
import { effectiveInvoiceStatus } from '../../utils/insights';
import { toReceiptDocument } from './receiptDocument';

type PaymentSource = 'invoice' | 'standalone';

interface ReceiptForm {
  source: PaymentSource;
  receiptNumber: string;
  date: string;
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  linkedInvoiceId: string;
  linkedInvoiceNumber: string;
  /** Kept as text so the field can be empty while typing. */
  amount: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  customer: Customer;
  notes: string;
  signOff: SignOffOptions;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const defaultNote = (source: PaymentSource, invoiceNumber: string, company: Company) =>
  source === 'invoice' && invoiceNumber
    ? `Payment received against invoice ${invoiceNumber}. Thank you.`
    : `Thank you for your payment to ${company.name}.`;

/** Replace the note only if the user hasn't written their own. */
const nextNote = (f: ReceiptForm, source: PaymentSource, invoiceNumber: string, company: Company) =>
  !f.notes.trim() || f.notes === defaultNote(f.source, f.linkedInvoiceNumber, company)
    ? defaultNote(source, invoiceNumber, company)
    : f.notes;

const isOpenInvoice = (inv: Invoice) => inv.balanceDue > 0 && inv.status !== 'draft' && inv.status !== 'cancelled';

const clientLabel = (c: Customer) => c.company || c.name;

/** Link the form to an invoice: payer, currency and amount all come from it (same as "Record payment"). */
const applyInvoice = (f: ReceiptForm, inv: Invoice, company: Company): ReceiptForm => ({
  ...f,
  source: 'invoice',
  linkedInvoiceId: inv.id,
  linkedInvoiceNumber: inv.invoiceNumber,
  customer: { ...inv.customer, address: { ...inv.customer.address } },
  currency: inv.currency || f.currency,
  currencySymbol: inv.currencySymbol || f.currencySymbol,
  templateId: inv.templateId || f.templateId,
  amount: String(inv.balanceDue),
  paymentMethod: inv.paymentMethod || f.paymentMethod,
  notes: nextNote(f, 'invoice', inv.invoiceNumber, company),
});

const fromReceipt = (r: Receipt): ReceiptForm => ({
  source: r.linkedInvoiceId ? 'invoice' : 'standalone',
  receiptNumber: r.receiptNumber,
  date: r.date,
  currency: r.currency || 'USD',
  currencySymbol: r.currencySymbol || '$',
  templateId: r.templateId || DEFAULT_TEMPLATE,
  linkedInvoiceId: r.linkedInvoiceId || '',
  linkedInvoiceNumber: r.linkedInvoiceNumber || '',
  amount: String(r.amount),
  paymentMethod: r.paymentMethod || 'bank_transfer',
  referenceNumber: r.referenceNumber || '',
  customer: r.customer,
  notes: r.notes || '',
  signOff: pickSignOff(r),
});

const newReceipt = (company: Company, existingNumbers: string[]): ReceiptForm => ({
  source: 'invoice',
  receiptNumber: generateReceiptNumber(existingNumbers),
  date: today(),
  currency: company.currency || 'USD',
  currencySymbol: company.currencySymbol || '$',
  templateId: company.defaultTemplate || DEFAULT_TEMPLATE,
  linkedInvoiceId: '',
  linkedInvoiceNumber: '',
  amount: '',
  paymentMethod: 'bank_transfer',
  referenceNumber: '',
  customer: emptyCustomer(),
  notes: defaultNote('standalone', '', company),
  signOff: defaultSignOff(company),
});

/** One-line hint at what an autosaved draft contains, e.g. "Acme Corp · $4,200.00". */
const draftDetail = (d: ReceiptForm): string | undefined => {
  try {
    const amount = parseFloat(d.amount);
    const payer = clientLabel(d.customer);
    return [payer, amount > 0 ? formatCurrency(amount, d.currencySymbol) : ''].filter(Boolean).join(' · ') || undefined;
  } catch {
    return undefined;
  }
};

/** Route wrapper: remounts the editor when switching between documents. */
export const ReceiptCreate: React.FC<{ editMode?: boolean }> = ({ editMode = false }) => {
  const { id } = useParams<{ id: string }>();
  return <ReceiptEditor key={editMode ? id : 'new'} editId={editMode ? id : undefined} />;
};

const ReceiptEditor: React.FC<{ editId?: string }> = ({ editId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const receipts = useReceiptsStore((s) => s.receipts);
  const addReceipt = useReceiptsStore((s) => s.addReceipt);
  const updateReceipt = useReceiptsStore((s) => s.updateReceipt);
  const invoices = useInvoicesStore((s) => s.invoices);
  const markAsPaid = useInvoicesStore((s) => s.markAsPaid);
  const company = useCompanyStore((s) => s.company);
  const stamps = useStampsStore((s) => s.stamps);
  const existing = editId ? receipts.find((r) => r.id === editId) : undefined;

  const openInvoices = useMemo(
    () => invoices.filter(isOpenInvoice).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [invoices]
  );

  const [initial] = useState<ReceiptForm>(() => {
    if (existing) return fromReceipt(existing);
    const form = newReceipt(company, receipts.map((r) => r.receiptNumber));
    // Optional prefill: navigate('/receipts/new', { state: { invoiceId } })
    const invoiceId = (location.state as { invoiceId?: string } | null)?.invoiceId;
    const preselect = invoiceId ? invoices.find((i) => i.id === invoiceId && isOpenInvoice(i)) : undefined;
    if (preselect) return applyInvoice(form, preselect, company);
    // Nothing to pay against? Start with a standalone payment.
    return invoices.some(isOpenInvoice) ? form : { ...form, source: 'standalone' };
  });
  const [form, setForm] = useState<ReceiptForm>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [editPayer, setEditPayer] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof ReceiptForm>(key: K, value: ReceiptForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const feedback = useSaveFeedback();
  const draft = useDraftAutosave(useDraftKey('receipt', !editId), form, initial);
  useUnsavedChangesWarning(dirty && !feedback.busy);

  const restoreDraft = () => {
    const restored = draft.takeDraft();
    if (!restored) return;
    let d = restored;
    // The linked invoice may have been paid or voided since the draft was written.
    const linkedInvoice = d.linkedInvoiceId ? invoices.find((i) => i.id === d.linkedInvoiceId) : undefined;
    const unlinked = !!d.linkedInvoiceId && !(linkedInvoice && isOpenInvoice(linkedInvoice));
    if (unlinked) d = { ...d, linkedInvoiceId: '', linkedInvoiceNumber: '', amount: '' };
    // Someone may have used the draft's number since — keep the fresh one then.
    const taken = receipts.some((r) => r.receiptNumber === d.receiptNumber.trim());
    if (taken) d = { ...d, receiptNumber: initial.receiptNumber };
    setForm(d);
    if (unlinked) toast(`Draft restored — ${restored.linkedInvoiceNumber || 'its invoice'} is no longer open, so choose the invoice again.`);
    else toast.success(taken ? `Draft restored · renumbered to ${initial.receiptNumber}` : 'Draft restored');
  };

  // ── Derived values ────────────────────────────────────────
  const linked = form.source === 'invoice' && !!form.linkedInvoiceId;
  const invoice = form.linkedInvoiceId ? invoices.find((i) => i.id === form.linkedInvoiceId) : undefined;
  const sym = form.currencySymbol;
  const parsed = parseFloat(form.amount);
  const amount = Number.isFinite(parsed) ? round2(parsed) : 0;
  // In edit mode the payment is already applied to the invoice, so work from
  // the balance as it was just before this receipt.
  const balanceBefore = existing
    ? round2((existing.remainingBalance ?? 0) + existing.amount)
    : (invoice?.balanceDue ?? 0);
  const invoiceTotal = existing ? existing.invoiceTotal : invoice?.total;
  const remainingBalance = linked ? Math.max(0, round2(balanceBefore - amount)) : undefined;
  const invoiceLabel = form.linkedInvoiceNumber || 'the invoice';

  const errors = {
    invoice:
      form.source === 'invoice' && !form.linkedInvoiceId
        ? 'Choose the invoice this payment is for, or switch to a standalone payment.'
        : '',
    amount:
      !Number.isFinite(parsed) || parsed <= 0
        ? 'Enter an amount greater than zero.'
        : linked && parsed > balanceBefore + 0.005
          ? `Amount exceeds the balance due (${formatCurrency(balanceBefore, sym)}).`
          : '',
    number: !form.receiptNumber.trim()
      ? 'Receipt number is required.'
      : receipts.some((r) => r.id !== existing?.id && r.receiptNumber === form.receiptNumber.trim())
        ? 'Another receipt already uses this number.'
        : '',
    client: !form.customer.name.trim() ? 'Payer name is required.' : '',
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const amountError = submitted || form.amount !== '' ? errors.amount : '';

  const preview = toReceiptDocument(
    {
      receiptNumber: form.receiptNumber,
      date: form.date,
      customer: form.customer,
      linkedInvoiceNumber: linked ? form.linkedInvoiceNumber : undefined,
      amount,
      invoiceTotal: linked ? invoiceTotal : undefined,
      remainingBalance,
      paymentMethod: form.paymentMethod,
      referenceNumber: form.referenceNumber,
      currencySymbol: sym,
      templateId: form.templateId,
      notes: form.notes,
      ...form.signOff,
    },
    company, // saving re-snapshots the current company profile, so preview it as-is
    stamps
  );

  const handlePrint = useDocumentPrint(printRef, form.receiptNumber || 'Receipt');

  const save = () => {
    if (feedback.busy) return;
    setSubmitted(true);
    if (hasErrors) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    const payload = {
      receiptNumber: form.receiptNumber.trim(),
      date: form.date,
      customer: form.customer,
      linkedInvoiceId: linked ? form.linkedInvoiceId : undefined,
      linkedInvoiceNumber: linked ? form.linkedInvoiceNumber : undefined,
      amount,
      invoiceTotal: linked ? invoiceTotal : undefined,
      remainingBalance,
      paymentMethod: form.paymentMethod,
      referenceNumber: form.referenceNumber.trim() || undefined,
      currency: form.currency,
      currencySymbol: form.currencySymbol,
      templateId: form.templateId,
      notes: form.notes,
      companySnapshot: company,
      ...pickSignOff(form.signOff),
    };
    try {
      if (existing) {
        // The payment was applied to the invoice when the receipt was issued —
        // editing only updates the receipt, so it's never counted twice.
        updateReceipt(existing.id, payload);
        toast.success(`${payload.receiptNumber} saved`);
        feedback.succeed('save', () => navigate(`/receipts/${existing.id}`));
      } else {
        if (linked && invoice) markAsPaid(invoice.id, amount);
        const created = addReceipt(payload);
        draft.clear();
        toast.success(
          linked ? `Payment recorded on ${form.linkedInvoiceNumber} · ${created.receiptNumber} issued` : `${created.receiptNumber} issued`
        );
        feedback.succeed('issue', () => navigate(`/receipts/${created.id}`));
      }
    } catch {
      // The store already explained the failure (e.g. missing permission).
    }
  };

  useSaveShortcut(save);

  if (editId && !existing) return <div className="p-8"><NotFoundState what="Receipt" backTo="/receipts" backLabel="Back to receipts" /></div>;

  const chooseSource = (source: PaymentSource) =>
    setForm((f) => {
      if (f.source === source) return f;
      return {
        ...f,
        source,
        linkedInvoiceId: '',
        linkedInvoiceNumber: '',
        amount: source === 'standalone' && f.linkedInvoiceId ? '' : f.amount,
        notes: nextNote(f, source, '', company),
      };
    });

  const chooseInvoice = (inv: Invoice) => {
    setForm((f) => applyInvoice(f, inv, company));
    setEditPayer(false);
  };

  const clearInvoice = () =>
    setForm((f) => ({ ...f, linkedInvoiceId: '', linkedInvoiceNumber: '', amount: '', notes: nextNote(f, 'invoice', '', company) }));

  const showPayerFields = !linked || editPayer || (submitted && !!errors.client);
  const address = [
    form.customer.address.street,
    form.customer.address.city,
    form.customer.address.state,
    form.customer.address.zipCode,
    form.customer.address.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <EditorShell
      backTo={existing ? `/receipts/${existing.id}` : '/receipts'}
      title={existing ? 'Edit receipt' : 'New receipt'}
      number={form.receiptNumber}
      templateId={form.templateId}
      onTemplateChange={(t) => set('templateId', t)}
      currency={form.currency}
      onCurrencyChange={
        linked ? undefined : (c) => setForm((f) => ({ ...f, currency: c, currencySymbol: SUPPORTED_CURRENCIES[c].symbol }))
      }
      actions={[
        existing
          ? { id: 'save', label: 'Save changes', icon: Check, onClick: save, primary: true }
          : { id: 'issue', label: 'Issue receipt', icon: ReceiptIcon, onClick: save, primary: true },
      ]}
      saved={feedback.saved}
      onPrint={() => handlePrint()}
      summary={{ label: 'Amount', value: formatCurrency(amount, sym) }}
      dirty={dirty}
      onDiscard={draft.clear}
      lastSavedAt={existing?.updatedAt}
      autosaves={!existing}
      banner={
        draft.draft && (
          <DraftBanner
            savedAtLabel={draft.draft.savedAtLabel}
            detail={draftDetail(draft.draft.form)}
            onRestore={restoreDraft}
            onDiscard={draft.discardDraft}
          />
        )
      }
      form={
        <>
          {/* Step 1 — what the payment is for */}
          <FormSection
            step={1}
            title="What is this payment for?"
            description={existing ? undefined : 'Link it to an invoice to update the invoice balance automatically.'}
          >
            {existing ? (
              linked ? (
                <LinkedInvoiceCard
                  number={form.linkedInvoiceNumber}
                  subtitle={clientLabel(form.customer)}
                  to={invoice ? `/invoices/${invoice.id}` : undefined}
                  badge={invoice ? <StatusBadge status={effectiveInvoiceStatus(invoice)} /> : undefined}
                  stats={[
                    { label: 'Invoice total', value: invoiceTotal !== undefined ? formatCurrency(invoiceTotal, sym) : '—' },
                    { label: 'Balance before', value: formatCurrency(balanceBefore, sym) },
                    { label: 'Balance after', value: formatCurrency(remainingBalance ?? 0, sym), tone: 'primary' },
                  ]}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200">
                    <Wallet size={17} />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-slate-900">Standalone payment</p>
                    <p className="text-xs text-slate-500">Not linked to an invoice.</p>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div role="radiogroup" aria-label="Payment type" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <SourceOption
                    checked={form.source === 'invoice'}
                    onSelect={() => chooseSource('invoice')}
                    icon={FileText}
                    title="An invoice"
                    description={
                      openInvoices.length > 0
                        ? `${openInvoices.length} open invoice${openInvoices.length === 1 ? '' : 's'} awaiting payment`
                        : 'No open invoices right now'
                    }
                  />
                  <SourceOption
                    checked={form.source === 'standalone'}
                    onSelect={() => chooseSource('standalone')}
                    icon={Wallet}
                    title="No invoice — standalone"
                    description="Deposit, retainer or ad-hoc payment"
                  />
                </div>

                {form.source === 'invoice' &&
                  (invoice && linked ? (
                    <LinkedInvoiceCard
                      number={invoice.invoiceNumber}
                      subtitle={`${clientLabel(invoice.customer)} · Due ${formatDate(invoice.dueDate)}`}
                      badge={<StatusBadge status={effectiveInvoiceStatus(invoice)} />}
                      action={
                        <button type="button" className="btn-sm btn-secondary" onClick={clearInvoice}>
                          Change
                        </button>
                      }
                      stats={[
                        { label: 'Invoice total', value: formatCurrency(invoice.total, sym) },
                        { label: 'Paid so far', value: formatCurrency(invoice.amountPaid || 0, sym), tone: 'success' },
                        { label: 'Balance due', value: formatCurrency(invoice.balanceDue, sym), tone: 'primary' },
                      ]}
                    />
                  ) : openInvoices.length > 0 ? (
                    <div>
                      <InvoicePicker invoices={openInvoices} onSelect={chooseInvoice} invalid={submitted && !!errors.invoice} />
                      {submitted && errors.invoice && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.invoice}</p>}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
                      <p className="text-[13px] font-medium text-slate-700">Every invoice is settled</p>
                      <p className="mt-1 text-xs text-slate-500">
                        There are no sent invoices with a balance due.{' '}
                        <button type="button" className="font-medium text-primary-700 hover:underline" onClick={() => chooseSource('standalone')}>
                          Record a standalone payment
                        </button>{' '}
                        instead.
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </FormSection>

          {/* Step 2 — payment */}
          <FormSection step={2} title="Payment" description="How much was received, when and how.">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label={`Amount received (${form.currency})`} htmlFor="receipt-amount" required error={amountError} className="sm:col-span-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{sym}</span>
                  <input
                    id="receipt-amount"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    placeholder="0.00"
                    className={`input h-11 pl-10 text-base font-semibold tabular ${amountError ? 'input-error' : ''}`}
                    value={form.amount}
                    onChange={(e) => set('amount', e.target.value)}
                    aria-invalid={!!amountError}
                  />
                </div>
                {linked && balanceBefore > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {[1, 0.5].map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="btn-sm btn-secondary h-7"
                        onClick={() => set('amount', String(round2(balanceBefore * f)))}
                      >
                        {f === 1 ? 'Full balance' : '50%'}
                      </button>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Payment date" htmlFor="receipt-date">
                <input id="receipt-date" type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
              <Field label="Receipt number" htmlFor="receipt-number" error={submitted ? errors.number : ''}>
                <input
                  id="receipt-number"
                  className={`input font-mono ${submitted && errors.number ? 'input-error' : ''}`}
                  value={form.receiptNumber}
                  onChange={(e) => set('receiptNumber', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Payment method" htmlFor="receipt-method">
                <select
                  id="receipt-method"
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
              <Field label="Transaction reference" htmlFor="receipt-ref" hint="Bank reference, Stripe charge ID or cheque no.">
                <input
                  id="receipt-ref"
                  className="input font-mono"
                  placeholder="Optional"
                  value={form.referenceNumber}
                  onChange={(e) => set('referenceNumber', e.target.value)}
                />
              </Field>
            </div>

            {linked && !errors.amount && (
              <div
                className={`mt-4 flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-xs ${
                  existing && amount !== existing.amount ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'
                }`}
              >
                <Info size={14} className="mt-px flex-shrink-0" />
                {existing ? (
                  <p>
                    Saving updates this receipt only — {invoiceLabel} isn't changed, so the payment is never counted twice.
                    {amount !== existing.amount &&
                      ` The amount differs from the original ${formatCurrency(existing.amount, sym)}; adjust the paid amount on ${invoiceLabel} too if needed.`}
                  </p>
                ) : (
                  <p>
                    {remainingBalance && remainingBalance > 0
                      ? `${formatCurrency(remainingBalance, sym)} will remain outstanding. ${invoiceLabel} will be marked as partially paid.`
                      : `${invoiceLabel} will be marked as paid in full.`}
                  </p>
                )}
              </div>
            )}
          </FormSection>

          {/* Step 3 — payer */}
          <FormSection
            step={3}
            title="Received from"
            description={linked && !showPayerFields ? `Taken from ${invoiceLabel}.` : 'Who made this payment?'}
            actions={
              linked && !showPayerFields ? (
                <button type="button" className="btn-sm btn-ghost text-primary-700 hover:bg-primary-50" onClick={() => setEditPayer(true)}>
                  <Pencil size={13} /> Edit details
                </button>
              ) : undefined
            }
          >
            {showPayerFields ? (
              <ClientFields value={form.customer} onChange={(c) => set('customer', c)} nameError={submitted ? errors.client : ''} />
            ) : (
              <div className="flex items-start gap-3 rounded-lg bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/70">
                <Avatar name={clientLabel(form.customer) || '?'} />
                <div className="min-w-0 text-[13px]">
                  <p className="truncate font-medium text-slate-900">{clientLabel(form.customer)}</p>
                  {form.customer.company && <p className="truncate text-xs text-slate-500">{form.customer.name}</p>}
                  {form.customer.email && (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                      <Mail size={12} /> {form.customer.email}
                    </p>
                  )}
                  {address && <p className="mt-0.5 truncate text-xs text-slate-500">{address}</p>}
                </div>
              </div>
            )}
          </FormSection>

          {/* Step 4 — notes */}
          <FormSection step={4} title="Notes" description="Shown at the bottom of the receipt.">
            <Field label="Note to payer" htmlFor="receipt-notes">
              <textarea id="receipt-notes" rows={3} className="textarea" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </FormSection>

          {/* Step 5 — sign-off */}
          <SignOffSection
            step={5}
            value={form.signOff}
            onChange={(v) => set('signOff', v)}
            documentType="receipt"
            documentDate={form.date}
            isPaid
          />
        </>
      }
      preview={<DocumentPreviewRenderer ref={printRef} data={preview} templateId={form.templateId} />}
    />
  );
};

// ── Pieces ──────────────────────────────────────────────────

const SourceOption: React.FC<{
  checked: boolean;
  onSelect: () => void;
  icon: React.ElementType;
  title: string;
  description: string;
}> = ({ checked, onSelect, icon: Icon, title, description }) => (
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    onClick={onSelect}
    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 ${
      checked ? 'border-primary-400 bg-primary-50/50 ring-1 ring-primary-400' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}
  >
    <span
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
        checked ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <Icon size={16} />
    </span>
    <span className="min-w-0">
      <span className="block text-[13px] font-medium text-slate-900">{title}</span>
      <span className="block text-xs text-slate-500">{description}</span>
    </span>
  </button>
);

const STAT_TONE = { default: 'text-slate-900', success: 'text-emerald-700', primary: 'text-primary-700' } as const;

const LinkedInvoiceCard: React.FC<{
  number: string;
  subtitle: string;
  to?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  stats: { label: string; value: string; tone?: keyof typeof STAT_TONE }[];
}> = ({ number, subtitle, to, badge, action, stats }) => (
  <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 ring-1 ring-primary-100">
        <FileText size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {to ? (
            <Link to={to} className="font-mono text-sm font-semibold text-slate-900 hover:text-primary-700 hover:underline">
              {number}
            </Link>
          ) : (
            <span className="font-mono text-sm font-semibold text-slate-900">{number}</span>
          )}
          {badge}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
      </div>
      {action}
    </div>
    <dl className="mt-3.5 grid grid-cols-3 gap-3 border-t border-primary-100 pt-3">
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="text-[11px] text-slate-500">{s.label}</dt>
          <dd className={`mt-0.5 text-[13px] font-semibold tabular ${STAT_TONE[s.tone ?? 'default']}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const InvoicePicker: React.FC<{ invoices: Invoice[]; onSelect: (inv: Invoice) => void; invalid?: boolean }> = ({
  invoices,
  onSelect,
  invalid,
}) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = q
    ? invoices.filter((inv) =>
        `${inv.invoiceNumber} ${inv.customer.name} ${inv.customer.company} ${inv.projectDescription ?? ''}`.toLowerCase().includes(q)
      )
    : invoices;

  return (
    <div className={`overflow-hidden rounded-lg border bg-white ${invalid ? 'border-rose-300' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3">
        <Search size={15} className="text-slate-400" />
        <input
          type="search"
          className="h-10 flex-1 bg-transparent text-[13px] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          placeholder="Search invoice number, client or project"
          aria-label="Search open invoices"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {results.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-slate-500">No open invoices match “{query}”.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto" aria-label="Open invoices">
          {results.map((inv) => {
            const status = effectiveInvoiceStatus(inv);
            return (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => onSelect(inv)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-primary-50/60 focus-visible:outline-none"
                >
                  <Avatar name={clientLabel(inv.customer) || '?'} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-medium text-slate-900">{inv.invoiceNumber}</span>
                      {status === 'overdue' || status === 'partially_paid' ? <StatusBadge status={status} /> : null}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {clientLabel(inv.customer)} · Due {formatDate(inv.dueDate)}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-right">
                    <span className="block text-[13px] font-semibold text-slate-900 tabular">
                      {formatCurrency(inv.balanceDue, inv.currencySymbol)}
                    </span>
                    <span className="block text-[11px] text-slate-400 tabular">of {formatCurrency(inv.total, inv.currencySymbol)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
