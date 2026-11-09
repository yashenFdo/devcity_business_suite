import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, Copy, Download, Mail, MapPin, Pencil, Phone, Share2, ThumbsUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBillsStore } from '../../store/useBillsStore';
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
import { DEFAULT_TEMPLATE, TEMPLATE_OPTIONS } from '../../components/documents/templateOptions';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { ShareDocumentModal } from '../../components/documents/ShareDocumentModal';
import { paymentMethodLabel } from '../../components/documents/paymentMethods';
import type { Bill, TemplateId } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { dueLabel, effectiveBillStatus } from '../../utils/insights';
import { billTermsLabel, toBillDocument } from './billDocument';
import { BillPaymentModal } from './BillPaymentModal';

export const BillView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bill = useBillsStore((s) => s.bills.find((b) => b.id === id));
  const vendorBillCount = useBillsStore(
    (s) => s.bills.filter((b) => bill?.vendorName && b.vendorName.trim().toLowerCase() === bill.vendorName.trim().toLowerCase()).length
  );
  const { deleteBill, duplicateBill, updateBill } = useBillsStore.getState();
  const company = useCompanyStore((s) => s.company);
  const auditEntries = useAuditStore((s) => s.entries);
  const canEdit = useCan('documents.edit');
  const canCreate = useCan('documents.create');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paying, setPaying] = useState<Bill | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useDocumentPrint(printRef, bill?.billNumber ?? 'Bill');

  const activity = useMemo(
    () => (bill ? auditEntries.filter((e) => e.target === bill.billNumber).slice(0, 6) : []),
    [auditEntries, bill]
  );

  if (!bill) return <NotFoundState what="Bill" backTo="/bills" backLabel="Back to bills" />;

  const status = effectiveBillStatus(bill);
  const due = dueLabel(bill.dueDate);
  const cur = bill.currencySymbol || '$';
  const paid = bill.amountPaid || 0;
  const paidPct = bill.total > 0 ? Math.min(100, (paid / bill.total) * 100) : 0;
  const docData = toBillDocument(bill, company);
  const vendorName = bill.vendorName || 'Vendor';
  const open = status !== 'draft' && status !== 'cancelled' && bill.balanceDue > 0;
  // Payments are written with updateBill, which also requires edit rights.
  const payable = canPay && canEdit && bill.balanceDue > 0 && status !== 'cancelled';
  const payLabel = paid > 0 ? 'Record payment' : 'Mark as paid';

  const changeTemplate = (t: TemplateId) => {
    if (canEdit) updateBill(bill.id, { templateId: t });
  };

  return (
    <div className="page max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/bills" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-900">
            <ArrowLeft size={14} /> Bills
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[22px] font-semibold tracking-tight text-slate-900">{bill.billNumber}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            {vendorName} · Billed {formatDate(bill.date)}
            {open && (
              <>
                {' · '}
                <span className={due.tone === 'danger' ? 'font-medium text-rose-600' : due.tone === 'warning' ? 'text-amber-600' : ''}>
                  {due.text}
                </span>
              </>
            )}
            {status === 'paid' && bill.paymentDate && <> · Paid {formatDate(bill.paymentDate)}</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && bill.status === 'draft' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                updateBill(bill.id, { status: 'unpaid' });
                toast.success(`${bill.billNumber} approved for payment`);
              }}
            >
              <ThumbsUp size={15} /> Approve
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => handlePrint()}>
            <Download size={15} /> Download PDF
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShareOpen(true)}>
            <Share2 size={15} /> Share
          </button>
          {canEdit && (
            <Link to={`/bills/${bill.id}/edit`} className="btn-secondary">
              <Pencil size={15} /> Edit
            </Link>
          )}
          {payable && (
            <button type="button" className="btn-primary" onClick={() => setPaying(bill)}>
              <CheckCircle2 size={15} /> {payLabel}
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
                  const dup = duplicateBill(bill.id);
                  if (dup) {
                    toast.success(`Duplicated as ${dup.billNumber}`);
                    navigate(`/bills/${dup.id}/edit`);
                  }
                },
              },
              {
                label: 'Cancel bill',
                icon: Ban,
                hidden: !canEdit || status === 'cancelled' || status === 'paid',
                onClick: () => setCancelOpen(true),
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
                  aria-pressed={(bill.templateId || DEFAULT_TEMPLATE) === t.id}
                  onClick={() => changeTemplate(t.id)}
                  disabled={!canEdit}
                  title={t.description}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <span className="hidden text-xs text-slate-400 sm:block">A4 · {bill.currency}</span>
          </div>
          <div className="bg-slate-100/70 px-2 py-6 sm:px-6">
            <DocumentPreviewRenderer ref={printRef} data={docData} templateId={bill.templateId || DEFAULT_TEMPLATE} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SideCard title="Balance">
            <p className="text-[28px] font-semibold tracking-tight text-slate-900 tabular">{formatCurrency(bill.balanceDue, cur)}</p>
            <p className="text-xs text-slate-500">
              {status === 'cancelled'
                ? 'Bill cancelled — nothing to pay'
                : bill.balanceDue > 0
                  ? `outstanding of ${formatCurrency(bill.total, cur)}`
                  : 'Paid in full'}
            </p>
            <div
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="Amount paid"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(paidPct)}
            >
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
            </div>
            <dl className="mt-3">
              <DetailRow label="Bill total">{formatCurrency(bill.total, cur)}</DetailRow>
              <DetailRow label="Paid">
                <span className="text-emerald-700">{formatCurrency(paid, cur)}</span>
              </DetailRow>
              {paid > 0 && bill.paymentDate && (
                <DetailRow label="Last payment">
                  {formatDate(bill.paymentDate)}
                  <span className="block text-xs font-normal text-slate-500">{paymentMethodLabel(bill.paymentMethod)}</span>
                </DetailRow>
              )}
            </dl>
            {payable && (
              <button type="button" className="btn-success mt-3 w-full" onClick={() => setPaying(bill)}>
                <CheckCircle2 size={15} /> {payLabel}
              </button>
            )}
          </SideCard>

          <SideCard title="Vendor">
            <div className="flex items-center gap-3">
              <Avatar name={vendorName} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{vendorName}</p>
                <p className="truncate text-xs text-slate-500">
                  {vendorBillCount > 1 ? `${vendorBillCount} bills on record` : 'First bill from this vendor'}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-[13px]">
              {bill.vendorEmail && (
                <a href={`mailto:${bill.vendorEmail}`} className="flex items-center gap-2 text-slate-600 hover:text-primary-700">
                  <Mail size={14} className="flex-shrink-0 text-slate-400" /> <span className="truncate">{bill.vendorEmail}</span>
                </a>
              )}
              {bill.vendorPhone && (
                <p className="flex items-center gap-2 text-slate-600">
                  <Phone size={14} className="flex-shrink-0 text-slate-400" /> {bill.vendorPhone}
                </p>
              )}
              {bill.vendorAddress && (
                <p className="flex items-start gap-2 text-slate-600">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                  <span className="whitespace-pre-line">{bill.vendorAddress}</span>
                </p>
              )}
            </div>
            {bill.paymentDetails?.trim() && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500">Payment details</p>
                <p className="mt-1.5 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700">
                  {bill.paymentDetails}
                </p>
              </div>
            )}
          </SideCard>

          <SideCard title="Details">
            <dl>
              <DetailRow label="Bill date">{formatDate(bill.date)}</DetailRow>
              <DetailRow label="Due date">{formatDate(bill.dueDate)}</DetailRow>
              <DetailRow label="Terms">{billTermsLabel(bill.date, bill.dueDate) ?? '—'}</DetailRow>
              <DetailRow label="Method">{paymentMethodLabel(bill.paymentMethod)}</DetailRow>
              <DetailRow label="Currency">{bill.currency}</DetailRow>
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

      <BillPaymentModal bill={paying} onClose={() => setPaying(null)} />
      <ShareDocumentModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        collection="bills"
        recordId={bill.id}
        data={docData}
        templateId={bill.templateId || DEFAULT_TEMPLATE}
        contact={{ name: bill.vendorName, email: bill.vendorEmail, phone: bill.vendorPhone }}
      />
      <ConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          updateBill(bill.id, { status: 'cancelled' });
          toast.success('Bill cancelled');
        }}
        title="Cancel this bill?"
        message="The bill will be marked as cancelled and excluded from payables. You can still view and print it."
        confirmLabel="Cancel bill"
      />
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteBill(bill.id);
          navigate('/bills');
        }}
        title={`Delete ${bill.billNumber}?`}
        message="This permanently removes the bill and its payment record. This cannot be undone."
        confirmLabel="Delete bill"
      />
    </div>
  );
};
