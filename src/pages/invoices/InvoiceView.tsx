import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  FileSignature,
  Mail,
  Pencil,
  Phone,
  Receipt as ReceiptIcon,
  Send,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { useAuditStore } from '../../store/useAuditStore';
import { useCan } from '../../security/sessionState';
import { StatusBadge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/Modal';
import { NotFoundState } from '../../components/ui/States';
import { RowActions } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { DetailRow, SideCard } from '../../components/ui/SideCard';
import { DocumentPreviewRenderer } from '../../components/documents/DocumentPreviewRenderer';
import { RecordPaymentModal } from '../../components/documents/RecordPaymentModal';
import { TEMPLATE_OPTIONS } from '../../components/documents/templateOptions';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { paymentMethodLabel } from '../../components/documents/paymentMethods';
import { toInvoiceDocument } from './invoiceDocument';
import type { Invoice, TemplateId } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { dueLabel, effectiveInvoiceStatus } from '../../utils/insights';

export const InvoiceView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoice = useInvoicesStore((s) => s.invoices.find((i) => i.id === id));
  const { deleteInvoice, duplicateInvoice, updateInvoice } = useInvoicesStore.getState();
  const allReceipts = useReceiptsStore((s) => s.receipts);
  const quotation = useQuotationsStore((s) => (invoice?.fromQuotationId ? s.quotations.find((q) => q.id === invoice.fromQuotationId) : undefined));
  const company = useCompanyStore((s) => s.company);
  const auditEntries = useAuditStore((s) => s.entries);
  const canEdit = useCan('documents.edit');
  const canCreate = useCan('documents.create');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useDocumentPrint(printRef, invoice?.invoiceNumber ?? 'Invoice');

  const payments = useMemo(() => allReceipts.filter((r) => r.linkedInvoiceId === id), [allReceipts, id]);
  const activity = useMemo(
    () => (invoice ? auditEntries.filter((e) => e.target === invoice.invoiceNumber).slice(0, 6) : []),
    [auditEntries, invoice]
  );

  if (!invoice) return <NotFoundState what="Invoice" backTo="/invoices" backLabel="Back to invoices" />;

  const status = effectiveInvoiceStatus(invoice);
  const due = dueLabel(invoice.dueDate);
  const cur = invoice.currencySymbol || '$';
  const paidPct = invoice.total > 0 ? Math.min(100, ((invoice.amountPaid || 0) / invoice.total) * 100) : 0;
  const docData = toInvoiceDocument(invoice, company);
  const clientName = invoice.customer.company || invoice.customer.name;
  const payable = canPay && invoice.balanceDue > 0 && status !== 'cancelled';

  const changeTemplate = (t: TemplateId) => {
    if (canEdit) updateInvoice(invoice.id, { templateId: t });
  };

  return (
    <div className="page max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/invoices" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-900">
            <ArrowLeft size={14} /> Invoices
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[22px] font-semibold tracking-tight text-slate-900">{invoice.invoiceNumber}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            {clientName} · Issued {formatDate(invoice.date)}
            {invoice.balanceDue > 0 && status !== 'draft' && status !== 'cancelled' && (
              <>
                {' · '}
                <span className={due.tone === 'danger' ? 'font-medium text-rose-600' : due.tone === 'warning' ? 'text-amber-600' : ''}>
                  {due.text}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && invoice.status === 'draft' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                updateInvoice(invoice.id, { status: 'sent' });
                toast.success('Marked as sent');
              }}
            >
              <Send size={15} /> Mark as sent
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => handlePrint()}>
            <Download size={15} /> Download PDF
          </button>
          {canEdit && (
            <Link to={`/invoices/${invoice.id}/edit`} className="btn-secondary">
              <Pencil size={15} /> Edit
            </Link>
          )}
          {payable && (
            <button type="button" className="btn-primary" onClick={() => setPaying(invoice)}>
              <CheckCircle2 size={15} /> Record payment
            </button>
          )}
          <RowActions
            label="More actions"
            actions={[
              {
                label: 'Duplicate',
                icon: Copy,
                hidden: !canCreate,
                onClick: () => {
                  const dup = duplicateInvoice(invoice.id);
                  if (dup) {
                    toast.success(`Duplicated as ${dup.invoiceNumber}`);
                    navigate(`/invoices/${dup.id}/edit`);
                  }
                },
              },
              {
                label: 'Void invoice',
                icon: Ban,
                hidden: !canEdit || status === 'cancelled' || status === 'paid',
                onClick: () => setVoidOpen(true),
              },
              { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteOpen(true) },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Document */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <div className="segmented overflow-x-auto scrollbar-none">
              {TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={(invoice.templateId || 'executive') === t.id}
                  onClick={() => changeTemplate(t.id)}
                  disabled={!canEdit}
                  title={t.description}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <span className="hidden text-xs text-slate-400 sm:block">A4 · {invoice.currency}</span>
          </div>
          <div className="bg-slate-100/70 px-2 py-6 sm:px-6">
            <DocumentPreviewRenderer ref={printRef} data={docData} templateId={invoice.templateId} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SideCard title="Balance">
            <p className="text-[28px] font-semibold tracking-tight text-slate-900 tabular">{formatCurrency(invoice.balanceDue, cur)}</p>
            <p className="text-xs text-slate-500">
              {invoice.balanceDue > 0 ? `outstanding of ${formatCurrency(invoice.total, cur)}` : 'Paid in full'}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
            </div>
            <dl className="mt-3">
              <DetailRow label="Invoice total">{formatCurrency(invoice.total, cur)}</DetailRow>
              <DetailRow label="Paid">
                <span className="text-emerald-700">{formatCurrency(invoice.amountPaid || 0, cur)}</span>
              </DetailRow>
            </dl>
            {payable && (
              <button type="button" className="btn-success mt-3 w-full" onClick={() => setPaying(invoice)}>
                <ReceiptIcon size={15} /> Record payment
              </button>
            )}
          </SideCard>

          <SideCard title="Client">
            <div className="flex items-center gap-3">
              <Avatar name={clientName} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{clientName}</p>
                {invoice.customer.company && <p className="truncate text-xs text-slate-500">{invoice.customer.name}</p>}
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-[13px]">
              {invoice.customer.email && (
                <a href={`mailto:${invoice.customer.email}`} className="flex items-center gap-2 text-slate-600 hover:text-primary-700">
                  <Mail size={14} className="text-slate-400" /> <span className="truncate">{invoice.customer.email}</span>
                </a>
              )}
              {invoice.customer.phone && (
                <p className="flex items-center gap-2 text-slate-600">
                  <Phone size={14} className="text-slate-400" /> {invoice.customer.phone}
                </p>
              )}
            </div>
          </SideCard>

          <SideCard title="Details">
            <dl>
              <DetailRow label="Issue date">{formatDate(invoice.date)}</DetailRow>
              <DetailRow label="Due date">{formatDate(invoice.dueDate)}</DetailRow>
              <DetailRow label="Terms">{invoice.paymentTerms || '—'}</DetailRow>
              <DetailRow label="Method">{paymentMethodLabel(invoice.paymentMethod)}</DetailRow>
              <DetailRow label="Currency">{invoice.currency}</DetailRow>
              {quotation && (
                <DetailRow label="From quotation">
                  <Link to={`/quotations/${quotation.id}`} className="inline-flex items-center gap-1 font-mono text-primary-700 hover:underline">
                    <FileSignature size={13} /> {quotation.quotationNumber}
                  </Link>
                </DetailRow>
              )}
            </dl>
          </SideCard>

          <SideCard title={`Payments${payments.length ? ` (${payments.length})` : ''}`}>
            {payments.length === 0 ? (
              <p className="text-[13px] text-slate-500">No payments recorded yet.</p>
            ) : (
              <ul className="-mx-2">
                {payments.map((r) => (
                  <li key={r.id}>
                    <Link to={`/receipts/${r.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50">
                      <span>
                        <span className="block font-mono text-xs font-medium text-slate-800">{r.receiptNumber}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDate(r.date)} · {paymentMethodLabel(r.paymentMethod)}
                        </span>
                      </span>
                      <span className="text-[13px] font-semibold text-emerald-700 tabular">{formatCurrency(r.amount, r.currencySymbol)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SideCard>

          {activity.length > 0 && (
            <SideCard title="Activity">
              <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                {activity.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                    <p className="text-[13px] text-slate-800">{e.action}</p>
                    <p className="text-xs text-slate-500">
                      {e.actorName} · {formatDate(e.at, 'dd MMM yyyy, HH:mm')}
                    </p>
                  </li>
                ))}
              </ol>
            </SideCard>
          )}
        </div>
      </div>

      <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} />
      <ConfirmModal
        isOpen={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={() => {
          updateInvoice(invoice.id, { status: 'cancelled' });
          toast.success('Invoice voided');
        }}
        title="Void this invoice?"
        message="The invoice will be marked as cancelled and excluded from receivables. You can still view and print it."
        confirmLabel="Void invoice"
      />
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteInvoice(invoice.id);
          toast.success(`${invoice.invoiceNumber} deleted`);
          navigate('/invoices');
        }}
        title={`Delete ${invoice.invoiceNumber}?`}
        message="This permanently removes the invoice. Linked receipts are kept. This cannot be undone."
        confirmLabel="Delete invoice"
      />
    </div>
  );
};
