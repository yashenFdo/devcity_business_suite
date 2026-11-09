import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, Download, FileText, Mail, Pencil, Phone, Share2, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
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
import { DEFAULT_TEMPLATE, TEMPLATE_OPTIONS } from '../../components/documents/templateOptions';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { ShareDocumentModal } from '../../components/documents/ShareDocumentModal';
import { paymentMethodLabel } from '../../components/documents/paymentMethods';
import { toReceiptDocument } from './receiptDocument';
import type { Invoice, TemplateId } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { effectiveInvoiceStatus } from '../../utils/insights';

export const ReceiptView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const receipt = useReceiptsStore((s) => s.receipts.find((r) => r.id === id));
  const { deleteReceipt, duplicateReceipt, updateReceipt } = useReceiptsStore.getState();
  const invoice = useInvoicesStore((s) =>
    receipt?.linkedInvoiceId ? s.invoices.find((i) => i.id === receipt.linkedInvoiceId) : undefined
  );
  const company = useCompanyStore((s) => s.company);
  const auditEntries = useAuditStore((s) => s.entries);
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useDocumentPrint(printRef, receipt?.receiptNumber ?? 'Receipt');

  const activity = useMemo(
    () => (receipt ? auditEntries.filter((e) => e.target === receipt.receiptNumber).slice(0, 6) : []),
    [auditEntries, receipt]
  );

  if (!receipt) return <NotFoundState what="Receipt" backTo="/receipts" backLabel="Back to receipts" />;

  const cur = receipt.currencySymbol || '$';
  const docData = toReceiptDocument(receipt, company);
  const payer = receipt.customer.company || receipt.customer.name;
  const linked = !!receipt.linkedInvoiceId;
  const invoiceStatus = invoice ? effectiveInvoiceStatus(invoice) : undefined;
  const invoicePayable = !!invoice && canPay && invoice.balanceDue > 0 && invoiceStatus !== 'cancelled' && invoiceStatus !== 'draft';
  const paidPct = invoice && invoice.total > 0 ? Math.min(100, ((invoice.amountPaid || 0) / invoice.total) * 100) : 0;

  const changeTemplate = (t: TemplateId) => {
    if (canEdit) updateReceipt(receipt.id, { templateId: t });
  };

  const duplicate = () => {
    const dup = duplicateReceipt(receipt.id);
    if (dup) {
      toast.success(`Duplicated as ${dup.receiptNumber}`);
      navigate(canEdit ? `/receipts/${dup.id}/edit` : `/receipts/${dup.id}`);
    }
  };

  return (
    <div className="page max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/receipts" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-900">
            <ArrowLeft size={14} /> Receipts
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[22px] font-semibold tracking-tight text-slate-900">{receipt.receiptNumber}</h1>
            <StatusBadge status="paid" />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            {payer} · Received {formatDate(receipt.date)}
            {receipt.linkedInvoiceNumber && <> · For {receipt.linkedInvoiceNumber}</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => handlePrint()}>
            <Download size={15} /> Download PDF
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShareOpen(true)}>
            <Share2 size={15} /> Share
          </button>
          {canEdit && (
            <Link to={`/receipts/${receipt.id}/edit`} className="btn-secondary">
              <Pencil size={15} /> Edit
            </Link>
          )}
          <RowActions
            label="More actions"
            actions={[
              {
                label: 'View invoice',
                icon: FileText,
                hidden: !invoice,
                onClick: () => invoice && navigate(`/invoices/${invoice.id}`),
              },
              {
                label: 'Record another payment',
                icon: CheckCircle2,
                hidden: !invoicePayable,
                onClick: () => invoice && setPaying(invoice),
              },
              {
                // Duplicating a linked receipt would claim a payment the invoice never received.
                label: 'Duplicate',
                icon: Copy,
                hidden: !canPay || linked,
                onClick: duplicate,
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
                  aria-pressed={(receipt.templateId || DEFAULT_TEMPLATE) === t.id}
                  onClick={() => changeTemplate(t.id)}
                  disabled={!canEdit}
                  title={t.description}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <span className="hidden text-xs text-slate-400 sm:block">A4 · {receipt.currency}</span>
          </div>
          <div className="bg-slate-100/70 px-2 py-6 sm:px-6">
            <DocumentPreviewRenderer ref={printRef} data={docData} templateId={receipt.templateId} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SideCard title="Amount received">
            <p className="text-[28px] font-semibold tracking-tight text-emerald-700 tabular">{formatCurrency(receipt.amount, cur)}</p>
            <p className="text-xs text-slate-500">
              {paymentMethodLabel(receipt.paymentMethod)} · {formatDate(receipt.date)}
            </p>
            {linked && (
              <dl className="mt-3 border-t border-slate-100 pt-2">
                {receipt.invoiceTotal !== undefined && (
                  <DetailRow label="Invoice total">{formatCurrency(receipt.invoiceTotal, cur)}</DetailRow>
                )}
                <DetailRow label="Balance after payment">
                  {(receipt.remainingBalance ?? 0) > 0 ? (
                    <span className="text-amber-700">{formatCurrency(receipt.remainingBalance ?? 0, cur)}</span>
                  ) : (
                    <span className="text-emerald-700">Settled in full</span>
                  )}
                </DetailRow>
              </dl>
            )}
          </SideCard>

          <SideCard title={linked ? 'Linked invoice' : 'Payment for'}>
            {!linked ? (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Wallet size={16} />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Standalone payment</p>
                  <p className="text-xs text-slate-500">Not linked to an invoice.</p>
                </div>
              </div>
            ) : invoice ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-primary-700 hover:underline"
                  >
                    <FileText size={14} /> {invoice.invoiceNumber}
                  </Link>
                  {invoiceStatus && <StatusBadge status={invoiceStatus} />}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
                </div>
                <dl className="mt-2">
                  <DetailRow label="Total">{formatCurrency(invoice.total, invoice.currencySymbol)}</DetailRow>
                  <DetailRow label="Paid to date">
                    <span className="text-emerald-700">{formatCurrency(invoice.amountPaid || 0, invoice.currencySymbol)}</span>
                  </DetailRow>
                  <DetailRow label="Current balance">
                    {invoice.balanceDue > 0 ? formatCurrency(invoice.balanceDue, invoice.currencySymbol) : 'Paid in full'}
                  </DetailRow>
                </dl>
                {invoicePayable && (
                  <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setPaying(invoice)}>
                    <CheckCircle2 size={15} /> Record another payment
                  </button>
                )}
              </>
            ) : (
              <p className="text-[13px] text-slate-500">
                <span className="font-mono font-medium text-slate-700">{receipt.linkedInvoiceNumber}</span> has been deleted.
              </p>
            )}
          </SideCard>

          <SideCard title="Received from">
            <div className="flex items-center gap-3">
              <Avatar name={payer || '?'} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{payer}</p>
                {receipt.customer.company && <p className="truncate text-xs text-slate-500">{receipt.customer.name}</p>}
              </div>
            </div>
            {(receipt.customer.email || receipt.customer.phone) && (
              <div className="mt-3 space-y-1.5 text-[13px]">
                {receipt.customer.email && (
                  <a href={`mailto:${receipt.customer.email}`} className="flex items-center gap-2 text-slate-600 hover:text-primary-700">
                    <Mail size={14} className="text-slate-400" /> <span className="truncate">{receipt.customer.email}</span>
                  </a>
                )}
                {receipt.customer.phone && (
                  <p className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} className="text-slate-400" /> {receipt.customer.phone}
                  </p>
                )}
              </div>
            )}
          </SideCard>

          <SideCard title="Details">
            <dl>
              <DetailRow label="Payment date">{formatDate(receipt.date)}</DetailRow>
              <DetailRow label="Method">{paymentMethodLabel(receipt.paymentMethod)}</DetailRow>
              <DetailRow label="Reference">
                {receipt.referenceNumber ? <span className="break-all font-mono text-xs">{receipt.referenceNumber}</span> : '—'}
              </DetailRow>
              <DetailRow label="Currency">{receipt.currency}</DetailRow>
              <DetailRow label="Issued">{formatDate(receipt.createdAt)}</DetailRow>
            </dl>
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
      <ShareDocumentModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        collection="receipts"
        recordId={receipt.id}
        data={docData}
        templateId={receipt.templateId}
        contact={{ name: receipt.customer.name || receipt.customer.company, email: receipt.customer.email, phone: receipt.customer.phone }}
      />
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteReceipt(receipt.id);
          navigate('/receipts');
        }}
        title={`Delete ${receipt.receiptNumber}?`}
        message={
          linked
            ? `This permanently removes the receipt. The payment stays recorded on ${receipt.linkedInvoiceNumber} — edit the invoice to adjust its paid amount. This cannot be undone.`
            : 'This permanently removes the receipt. This cannot be undone.'
        }
        confirmLabel="Delete receipt"
      />
    </div>
  );
};
