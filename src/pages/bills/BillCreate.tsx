import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, FileText, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBillsStore } from '../../store/useBillsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { SignOffSection } from '../../components/documents/editor/SignOffSection';
import { defaultSignOff, pickSignOff, resolveSignOff } from '../../components/documents/signOff';
import { useStampsStore } from '../../store/useStampsStore';
import { LineItemsTable } from '../../components/documents/LineItemsTable';
import { TotalsSection } from '../../components/documents/TotalsSection';
import { DocumentPreviewRenderer } from '../../components/documents/DocumentPreviewRenderer';
import { EditorShell } from '../../components/documents/editor/EditorShell';
import { Field, FormSection } from '../../components/documents/editor/FormSection';
import { useSaveShortcut, useUnsavedChangesWarning } from '../../components/documents/editor/useEditorGuards';
import { useDraftAutosave, useDraftKey } from '../../components/documents/editor/useDraftAutosave';
import { useSaveFeedback } from '../../components/documents/editor/useSaveFeedback';
import { DraftBanner } from '../../components/documents/editor/DraftBanner';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { PAYMENT_METHOD_OPTIONS } from '../../components/documents/paymentMethods';
import { DEFAULT_TEMPLATE } from '../../components/documents/templateOptions';
import type { DocumentData } from '../../components/documents/documentTypes';
import { StatusBadge } from '../../components/ui/Badge';
import { NotFoundState } from '../../components/ui/States';
import type { Bill, Company, CurrencyCode, DiscountType, LineItem, PaymentMethod, SignOffOptions, TemplateId } from '../../types';
import { SUPPORTED_CURRENCIES } from '../../types';
import { generateBillNumber, generateId } from '../../utils/documentNumber';
import { calculateDocumentTotals } from '../../utils/calculations';
import { addDays, formatCurrency, today } from '../../utils/formatters';
import { BILL_TERMS, billTermsLabel, knownVendors, termDays } from './billDocument';

interface BillForm {
  billNumber: string;
  date: string;
  dueDate: string;
  status: Bill['status'];
  currency: CurrencyCode;
  currencySymbol: string;
  templateId: TemplateId;
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string;
  vendorAddress: string;
  lineItems: LineItem[];
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  paymentDetails: string;
  notes: string;
  signOff: SignOffOptions;
}

const blankItem = (): LineItem => ({
  id: generateId(),
  description: '',
  quantity: 1,
  unit: 'month',
  unitPrice: 0,
  discount: 0,
  tax: 0,
  amount: 0,
});

const fromBill = (b: Bill): BillForm => ({
  billNumber: b.billNumber,
  date: b.date,
  dueDate: b.dueDate,
  status: b.status,
  currency: b.currency || 'USD',
  currencySymbol: b.currencySymbol || '$',
  templateId: b.templateId || DEFAULT_TEMPLATE,
  vendorName: b.vendorName || '',
  vendorEmail: b.vendorEmail || '',
  vendorPhone: b.vendorPhone || '',
  vendorAddress: b.vendorAddress || '',
  lineItems: b.lineItems?.length ? b.lineItems : [blankItem()],
  discountType: b.discountType || 'percent',
  discountValue: b.discountValue || 0,
  taxPercent: b.taxPercent || 0,
  amountPaid: b.amountPaid || 0,
  paymentMethod: b.paymentMethod || 'bank_transfer',
  paymentDate: b.paymentDate || '',
  paymentDetails: b.paymentDetails || '',
  notes: b.notes || '',
  signOff: pickSignOff(b),
});

const newBill = (company: Company, existingNumbers: string[]): BillForm => ({
  billNumber: generateBillNumber(existingNumbers),
  date: today(),
  dueDate: addDays(today(), 30),
  status: 'draft',
  currency: company.currency || 'USD',
  currencySymbol: company.currencySymbol || '$',
  templateId: company.defaultTemplate || DEFAULT_TEMPLATE,
  vendorName: '',
  vendorEmail: '',
  vendorPhone: '',
  vendorAddress: '',
  lineItems: [blankItem()],
  discountType: 'percent',
  discountValue: 0,
  taxPercent: 0,
  amountPaid: 0,
  paymentMethod: 'bank_transfer',
  paymentDate: '',
  paymentDetails: '',
  notes: '',
  signOff: defaultSignOff(company),
});

/** One-line hint at what an autosaved draft contains, e.g. "AWS · $1,240.00". */
const draftDetail = (d: BillForm): string | undefined => {
  try {
    const { total } = calculateDocumentTotals(d.lineItems, d.discountValue, d.taxPercent, d.discountType);
    return [d.vendorName.trim(), total > 0 ? formatCurrency(total, d.currencySymbol) : ''].filter(Boolean).join(' · ') || undefined;
  } catch {
    return undefined;
  }
};

/** Route wrapper: remounts the editor when switching between documents. */
export const BillCreate: React.FC<{ editMode?: boolean }> = ({ editMode = false }) => {
  const { id } = useParams<{ id: string }>();
  return <BillEditor key={editMode ? id : 'new'} editId={editMode ? id : undefined} />;
};

const BillEditor: React.FC<{ editId?: string }> = ({ editId }) => {
  const navigate = useNavigate();
  const bills = useBillsStore((s) => s.bills);
  const addBill = useBillsStore((s) => s.addBill);
  const updateBill = useBillsStore((s) => s.updateBill);
  const company = useCompanyStore((s) => s.company);
  const stamps = useStampsStore((s) => s.stamps);
  const existing = editId ? bills.find((b) => b.id === editId) : undefined;

  const [initial] = useState<BillForm>(() =>
    existing ? fromBill(existing) : newBill(company, bills.map((b) => b.billNumber))
  );
  const [form, setForm] = useState<BillForm>(initial);
  const [submitted, setSubmitted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof BillForm>(key: K, value: BillForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const feedback = useSaveFeedback();
  const draft = useDraftAutosave(useDraftKey('bill', !editId), form, initial);
  useUnsavedChangesWarning(dirty && !feedback.busy);

  const restoreDraft = () => {
    const d = draft.takeDraft();
    if (!d) return;
    // Someone may have used the draft's number since — keep the fresh one then.
    const draftNumber = d.billNumber.trim().toLowerCase();
    const taken = bills.some((b) => b.billNumber.toLowerCase() === draftNumber);
    setForm(taken ? { ...d, billNumber: initial.billNumber } : d);
    toast.success(taken ? `Draft restored · renumbered to ${initial.billNumber}` : 'Draft restored');
  };

  const vendors = useMemo(() => knownVendors(bills), [bills]);
  const matchedVendor = existing
    ? undefined
    : vendors.find((v) => v.name.toLowerCase() === form.vendorName.trim().toLowerCase());

  const totals = calculateDocumentTotals(form.lineItems, form.discountValue, form.taxPercent, form.discountType);
  const amountPaid = Math.min(form.amountPaid, totals.total);
  const balanceDue = Math.max(0, Math.round((totals.total - amountPaid) * 100) / 100);
  const derivedStatus: Bill['status'] =
    form.status === 'draft' || form.status === 'cancelled'
      ? form.status
      : amountPaid > 0 && balanceDue === 0
        ? 'paid'
        : form.status === 'paid'
          ? 'unpaid'
          : form.status;
  const displayStatus: Bill['status'] = derivedStatus === 'unpaid' && form.dueDate < today() ? 'overdue' : derivedStatus;

  const number = form.billNumber.trim();
  const errors = {
    vendor: !form.vendorName.trim() ? 'Vendor name is required.' : '',
    number: !number
      ? 'Bill number is required.'
      : bills.some((b) => b.id !== existing?.id && b.billNumber.toLowerCase() === number.toLowerCase())
        ? 'Another bill already uses this number.'
        : '',
    items: !form.lineItems.some((i) => i.description.trim() && i.amount > 0)
      ? 'Add at least one item with a description and price.'
      : '',
    dates: form.dueDate < form.date ? 'Due date is before the bill date.' : '',
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const terms = billTermsLabel(form.date, form.dueDate);

  const preview: DocumentData = {
    documentType: 'bill',
    number: form.billNumber,
    date: form.date,
    dueDateOrExpiry: form.dueDate,
    status: displayStatus,
    currencySymbol: form.currencySymbol,
    vendorName: form.vendorName,
    vendorEmail: form.vendorEmail,
    vendorPhone: form.vendorPhone,
    vendorAddress: form.vendorAddress,
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
    paymentTerms: terms,
    paymentInstructions: form.paymentDetails,
    notes: form.notes,
    company, // saving re-snapshots the current company profile, so preview it as-is
    templateId: form.templateId,
    ...resolveSignOff(form.signOff, company, stamps, derivedStatus === 'paid', form.date),
  };

  const handlePrint = useDocumentPrint(printRef, form.billNumber || 'Bill');

  const save = (record = false) => {
    if (feedback.busy) return;
    setSubmitted(true);
    if (hasErrors) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    const status: Bill['status'] = record && derivedStatus === 'draft' ? 'unpaid' : derivedStatus;
    const payload = {
      billNumber: number,
      date: form.date,
      dueDate: form.dueDate,
      status,
      vendorName: form.vendorName.trim(),
      vendorEmail: form.vendorEmail.trim(),
      vendorPhone: form.vendorPhone.trim(),
      vendorAddress: form.vendorAddress.trim(),
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
      paymentMethod: form.paymentMethod,
      paymentDate: amountPaid > 0 ? form.paymentDate || today() : undefined,
      paymentDetails: form.paymentDetails,
      currency: form.currency,
      currencySymbol: form.currencySymbol,
      templateId: form.templateId,
      notes: form.notes,
      companySnapshot: company,
      ...pickSignOff(form.signOff),
    };
    try {
      if (existing) {
        updateBill(existing.id, payload);
        toast.success(`${payload.billNumber} saved`);
        feedback.succeed('save', () => navigate(`/bills/${existing.id}`));
      } else {
        const created = addBill(payload);
        draft.clear();
        toast.success(record ? `${created.billNumber} recorded` : `${created.billNumber} saved as draft`);
        feedback.succeed(record ? 'record' : 'draft', () => navigate(`/bills/${created.id}`));
      }
    } catch {
      // The store already explained the failure (e.g. missing permission).
    }
  };

  useSaveShortcut(() => save(false));

  if (editId && !existing) return <div className="p-8"><NotFoundState what="Bill" backTo="/bills" backLabel="Back to bills" /></div>;

  const changeVendorName = (name: string) => {
    const match = vendors.find((v) => v.name.toLowerCase() === name.trim().toLowerCase());
    setForm((f) =>
      match
        ? {
            ...f,
            vendorName: name,
            vendorEmail: f.vendorEmail || match.email,
            vendorPhone: f.vendorPhone || match.phone,
            vendorAddress: f.vendorAddress || match.address,
            paymentDetails: f.paymentDetails || match.paymentDetails,
            paymentMethod: f.paymentDetails ? f.paymentMethod : match.paymentMethod || f.paymentMethod,
          }
        : { ...f, vendorName: name }
    );
  };

  const changeDate = (date: string) => {
    const days = termDays(form.date, form.dueDate);
    setForm((f) => ({ ...f, date, dueDate: days !== null && days >= 0 && date ? addDays(date, days) : f.dueDate }));
  };

  const applyTerms = (label: string) => {
    const days = BILL_TERMS.find((t) => t.label === label)?.days;
    if (days !== undefined) set('dueDate', addDays(form.date, days));
  };

  return (
    <EditorShell
      backTo={existing ? `/bills/${existing.id}` : '/bills'}
      title={existing ? 'Edit bill' : 'New bill'}
      number={form.billNumber}
      badge={<StatusBadge status={displayStatus} />}
      templateId={form.templateId}
      onTemplateChange={(t) => set('templateId', t)}
      currency={form.currency}
      onCurrencyChange={(c) => setForm((f) => ({ ...f, currency: c, currencySymbol: SUPPORTED_CURRENCIES[c].symbol }))}
      actions={
        existing
          ? [{ id: 'save', label: 'Save changes', icon: Check, onClick: () => save(false), primary: true }]
          : [
              { id: 'draft', label: 'Save draft', icon: FileText, onClick: () => save(false) },
              { id: 'record', label: 'Record bill', shortLabel: 'Record', icon: Check, onClick: () => save(true), primary: true },
            ]
      }
      saved={feedback.saved}
      onPrint={() => handlePrint()}
      summary={{ label: 'Total', value: formatCurrency(totals.total, form.currencySymbol) }}
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
          <FormSection step={1} title="Vendor" description="Who sent this bill?">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field
                label="Vendor name"
                htmlFor="bill-vendor-name"
                required
                className="sm:col-span-2"
                error={submitted ? errors.vendor : ''}
                hint={
                  matchedVendor
                    ? undefined
                    : vendors.length > 0
                      ? 'Start typing to pick a vendor you have billed before.'
                      : 'e.g. Amazon Web Services, Atlassian, or a contractor.'
                }
              >
                <input
                  id="bill-vendor-name"
                  className={`input ${submitted && errors.vendor ? 'input-error' : ''}`}
                  list="bill-vendor-options"
                  autoComplete="off"
                  placeholder="Vendor or supplier name"
                  value={form.vendorName}
                  onChange={(e) => changeVendorName(e.target.value)}
                />
                <datalist id="bill-vendor-options">
                  {vendors.map((v) => (
                    <option key={v.name} value={v.name} />
                  ))}
                </datalist>
                {matchedVendor && !(submitted && errors.vendor) && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-primary-700">
                    <History size={12} /> Known vendor — details filled in from your last bill.
                  </p>
                )}
              </Field>
              <Field label="Email" htmlFor="bill-vendor-email">
                <input
                  id="bill-vendor-email"
                  type="email"
                  className="input"
                  placeholder="billing@vendor.com"
                  value={form.vendorEmail}
                  onChange={(e) => set('vendorEmail', e.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="bill-vendor-phone">
                <input
                  id="bill-vendor-phone"
                  type="tel"
                  className="input"
                  value={form.vendorPhone}
                  onChange={(e) => set('vendorPhone', e.target.value)}
                />
              </Field>
              <Field label="Address" htmlFor="bill-vendor-address" className="sm:col-span-2">
                <textarea
                  id="bill-vendor-address"
                  rows={2}
                  className="textarea"
                  placeholder="Street, city, country"
                  value={form.vendorAddress}
                  onChange={(e) => set('vendorAddress', e.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection step={2} title="Bill details">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field
                label="Bill / reference number"
                htmlFor="bill-number"
                required
                error={submitted ? errors.number : ''}
                hint="Use the vendor's invoice number, or keep the generated one."
              >
                <input
                  id="bill-number"
                  className={`input font-mono ${submitted && errors.number ? 'input-error' : ''}`}
                  value={form.billNumber}
                  onChange={(e) => set('billNumber', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Terms" htmlFor="bill-terms" hint="Updates the due date automatically.">
                <select id="bill-terms" className="select" value={terms ?? ''} onChange={(e) => applyTerms(e.target.value)}>
                  {!terms && <option value="">—</option>}
                  {terms && !BILL_TERMS.some((t) => t.label === terms) && <option value={terms}>{terms} (custom)</option>}
                  {BILL_TERMS.map((t) => (
                    <option key={t.label} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bill date" htmlFor="bill-date">
                <input id="bill-date" type="date" className="input" value={form.date} onChange={(e) => changeDate(e.target.value)} />
              </Field>
              <Field label="Due date" htmlFor="bill-due-date" error={submitted ? errors.dates : ''}>
                <input
                  id="bill-due-date"
                  type="date"
                  className={`input ${submitted && errors.dates ? 'input-error' : ''}`}
                  value={form.dueDate}
                  onChange={(e) => set('dueDate', e.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection step={3} title="Line items" description="Subscriptions, licences, hosting or contractor hours on this bill.">
            <LineItemsTable
              items={form.lineItems}
              onChange={(items) => set('lineItems', items)}
              currencySymbol={form.currencySymbol}
              error={submitted ? errors.items : ''}
              showPresets={false}
            />
          </FormSection>

          <FormSection step={4} title="Totals">
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
          </FormSection>

          <FormSection step={5} title="Payment & notes" description="How DevCity pays this vendor.">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Payment method" htmlFor="bill-payment-method">
                <select
                  id="bill-payment-method"
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
              <div className="hidden sm:block" />
              <Field
                label="Vendor payment details"
                htmlFor="bill-payment-details"
                className="sm:col-span-2"
                hint="Bank account, SWIFT/IBAN or payment link from the vendor's invoice."
              >
                <textarea
                  id="bill-payment-details"
                  rows={3}
                  className="textarea font-mono text-[13px]"
                  placeholder={'Bank: …\nAccount name: …\nAccount no. / IBAN: …   SWIFT: …'}
                  value={form.paymentDetails}
                  onChange={(e) => set('paymentDetails', e.target.value)}
                />
              </Field>
              {existing && (
                <>
                  <Field
                    label={`Amount already paid (${form.currencySymbol})`}
                    htmlFor="bill-amount-paid"
                    hint="Tip: use “Mark as paid” on the bill page instead."
                  >
                    <input
                      id="bill-amount-paid"
                      type="number"
                      min={0}
                      step="any"
                      className="input tabular"
                      value={form.amountPaid}
                      onChange={(e) => set('amountPaid', Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </Field>
                  <Field label="Payment date" htmlFor="bill-payment-date">
                    <input
                      id="bill-payment-date"
                      type="date"
                      className="input"
                      value={form.paymentDate}
                      disabled={amountPaid <= 0}
                      onChange={(e) => set('paymentDate', e.target.value)}
                    />
                  </Field>
                </>
              )}
              <Field
                label="Notes"
                htmlFor="bill-notes"
                className="sm:col-span-2"
                hint="Shown on the bill — e.g. PO number, cost centre or project."
              >
                <textarea
                  id="bill-notes"
                  rows={3}
                  className="textarea"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </div>
            {existing && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
                <label htmlFor="bill-status" className="text-xs text-slate-600">
                  Status
                </label>
                <select
                  id="bill-status"
                  className="select h-8 w-44 text-xs"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as Bill['status'])}
                >
                  <option value="draft">Draft</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="cancelled">Cancelled</option>
                  {(form.status === 'paid' || form.status === 'overdue') && (
                    <option value={form.status}>{form.status === 'paid' ? 'Paid' : 'Overdue'}</option>
                  )}
                </select>
              </div>
            )}
          </FormSection>

          <SignOffSection
            step={6}
            value={form.signOff}
            onChange={(v) => set('signOff', v)}
            documentType="bill"
            documentDate={form.date}
            isPaid={derivedStatus === 'paid'}
          />
        </>
      }
      preview={<DocumentPreviewRenderer ref={printRef} data={preview} templateId={form.templateId} />}
    />
  );
};
