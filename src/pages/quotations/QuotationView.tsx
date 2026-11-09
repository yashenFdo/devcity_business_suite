import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Mail,
  Pencil,
  Phone,
  Send,
  Share2,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { useAuditStore } from '../../store/useAuditStore';
import { useCan } from '../../security/sessionState';
import { StatusBadge } from '../../components/ui/Badge';
import { ConfirmModal, Modal } from '../../components/ui/Modal';
import { NotFoundState } from '../../components/ui/States';
import { RowActions } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { DetailRow, SideCard } from '../../components/ui/SideCard';
import { Field } from '../../components/documents/editor/FormSection';
import { DocumentPreviewRenderer } from '../../components/documents/DocumentPreviewRenderer';
import { TEMPLATE_OPTIONS, templateName } from '../../components/documents/templateOptions';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { ShareDocumentModal } from '../../components/documents/ShareDocumentModal';
import type { Quotation, TemplateId } from '../../types';
import { addDays, formatCurrency, formatDate, today } from '../../utils/formatters';
import { effectiveQuotationStatus, effectiveInvoiceStatus } from '../../utils/insights';
import { canConvert, convertQuotationToInvoice, toQuotationDocument, validityLabel } from './quotationDocument';

const toneClass = (tone: 'muted' | 'warning' | 'danger') =>
  tone === 'danger' ? 'font-medium text-rose-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-500';

export const QuotationView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quotation = useQuotationsStore((s) => s.quotations.find((q) => q.id === id));
  const { deleteQuotation, duplicateQuotation, updateQuotation } = useQuotationsStore.getState();
  const invoice = useInvoicesStore((s) =>
    quotation?.convertedToInvoiceId ? s.invoices.find((i) => i.id === quotation.convertedToInvoiceId) : undefined
  );
  const company = useCompanyStore((s) => s.company);
  const auditEntries = useAuditStore((s) => s.entries);
  const canEdit = useCan('documents.edit');
  const canCreate = useCan('documents.create');
  const canDelete = useCan('documents.delete');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useDocumentPrint(printRef, quotation?.quotationNumber ?? 'Quotation');

  const activity = useMemo(
    () => (quotation ? auditEntries.filter((e) => e.target === quotation.quotationNumber).slice(0, 6) : []),
    [auditEntries, quotation]
  );

  if (!quotation) return <NotFoundState what="Quotation" backTo="/quotations" backLabel="Back to quotations" />;

  const status = effectiveQuotationStatus(quotation);
  const validity = validityLabel(quotation.validUntil);
  const awaitingReply = status === 'sent' || status === 'expired';
  const cur = quotation.currencySymbol || '$';
  const docData = toQuotationDocument(quotation, company);
  const clientName = quotation.customer.company || quotation.customer.name;
  const convertible = canCreate && canConvert(quotation);
  const convertedId = quotation.convertedToInvoiceId;

  const changeTemplate = (t: TemplateId) => {
    if (canEdit) updateQuotation(quotation.id, { templateId: t });
  };

  const setStatus = (next: Quotation['status'], message: string, extra: Partial<Quotation> = {}) => {
    updateQuotation(quotation.id, { status: next, ...extra });
    toast.success(message);
  };

  const convert = () => {
    try {
      const inv = convertQuotationToInvoice(quotation, company);
      toast.success(`Invoice ${inv.invoiceNumber} created from ${quotation.quotationNumber}`);
      navigate(`/invoices/${inv.id}/edit`);
    } catch {
      toast.error('Could not create the invoice.');
    }
  };

  return (
    <div className="page max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/quotations" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-900">
            <ArrowLeft size={14} /> Quotations
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[22px] font-semibold tracking-tight text-slate-900">{quotation.quotationNumber}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            {clientName} · Issued {formatDate(quotation.date)}
            {awaitingReply && (
              <>
                {' · '}
                <span className={toneClass(validity.tone)}>{validity.text}</span>
              </>
            )}
            {status === 'accepted' && quotation.acceptedDate && <> · Accepted {formatDate(quotation.acceptedDate)}</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && quotation.status === 'draft' && (
            <button type="button" className="btn-secondary" onClick={() => setStatus('sent', 'Marked as sent')}>
              <Send size={15} /> Mark as sent
            </button>
          )}
          {canEdit && awaitingReply && !convertedId && (
            <button type="button" className="btn-secondary" onClick={() => setAcceptOpen(true)}>
              <CheckCircle2 size={15} /> Mark accepted
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => handlePrint()}>
            <Download size={15} /> Download PDF
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShareOpen(true)}>
            <Share2 size={15} /> Share
          </button>
          {canEdit && (
            <Link to={`/quotations/${quotation.id}/edit`} className="btn-secondary">
              <Pencil size={15} /> Edit
            </Link>
          )}
          {convertedId ? (
            <Link to={`/invoices/${convertedId}`} className="btn-secondary">
              <FileText size={15} /> View invoice
            </Link>
          ) : (
            convertible && (
              <button type="button" className="btn-primary" onClick={() => setConvertOpen(true)}>
                <ArrowRight size={15} /> Convert to invoice
              </button>
            )
          )}
          <RowActions
            label="More actions"
            actions={[
              {
                label: 'Mark declined',
                icon: XCircle,
                hidden: !canEdit || !awaitingReply || !!convertedId,
                onClick: () => setStatus('rejected', 'Marked as declined'),
              },
              {
                label: 'Extend validity 30 days',
                icon: CalendarClock,
                hidden: !canEdit || status !== 'expired',
                onClick: () =>
                  setStatus('sent', `Valid until ${formatDate(addDays(today(), 30))}`, { validUntil: addDays(today(), 30) }),
              },
              {
                label: 'Duplicate',
                icon: Copy,
                hidden: !canCreate,
                onClick: () => {
                  const dup = duplicateQuotation(quotation.id);
                  if (dup) {
                    toast.success(`Duplicated as ${dup.quotationNumber}`);
                    navigate(`/quotations/${dup.id}/edit`);
                  }
                },
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
                  aria-pressed={(quotation.templateId || 'executive') === t.id}
                  onClick={() => changeTemplate(t.id)}
                  disabled={!canEdit}
                  title={t.description}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <span className="hidden text-xs text-slate-400 sm:block">A4 · {quotation.currency}</span>
          </div>
          <div className="bg-slate-100/70 px-2 py-6 sm:px-6">
            <DocumentPreviewRenderer ref={printRef} data={docData} templateId={quotation.templateId} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SideCard title="Quote value">
            <p className="text-[28px] font-semibold tracking-tight text-slate-900 tabular">{formatCurrency(quotation.total, cur)}</p>
            <p className="text-xs text-slate-500">
              {quotation.lineItems.length} line item{quotation.lineItems.length === 1 ? '' : 's'}
              {quotation.taxAmount > 0 ? ' · incl. tax' : ''}
            </p>
            <dl className="mt-3">
              <DetailRow label="Subtotal">{formatCurrency(quotation.subtotal, cur)}</DetailRow>
              {quotation.discountAmount > 0 && (
                <DetailRow label="Discount">
                  <span className="text-slate-600">−{formatCurrency(quotation.discountAmount, cur)}</span>
                </DetailRow>
              )}
              {quotation.taxAmount > 0 && <DetailRow label="Tax">{formatCurrency(quotation.taxAmount, cur)}</DetailRow>}
            </dl>
            {convertible && (
              <button type="button" className="btn-primary mt-3 w-full" onClick={() => setConvertOpen(true)}>
                <ArrowRight size={15} /> Convert to invoice
              </button>
            )}
          </SideCard>

          <SideCard title="Client">
            <div className="flex items-center gap-3">
              <Avatar name={clientName || '?'} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{clientName}</p>
                {quotation.customer.company && <p className="truncate text-xs text-slate-500">{quotation.customer.name}</p>}
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-[13px]">
              {quotation.customer.email && (
                <a href={`mailto:${quotation.customer.email}`} className="flex items-center gap-2 text-slate-600 hover:text-primary-700">
                  <Mail size={14} className="text-slate-400" /> <span className="truncate">{quotation.customer.email}</span>
                </a>
              )}
              {quotation.customer.phone && (
                <p className="flex items-center gap-2 text-slate-600">
                  <Phone size={14} className="text-slate-400" /> {quotation.customer.phone}
                </p>
              )}
            </div>
          </SideCard>

          <SideCard title="Details">
            <dl>
              <DetailRow label="Issued">{formatDate(quotation.date)}</DetailRow>
              <DetailRow label="Valid until">
                <span className="block">{formatDate(quotation.validUntil)}</span>
                {awaitingReply && <span className={`block text-xs font-normal ${toneClass(validity.tone)}`}>{validity.text}</span>}
              </DetailRow>
              {quotation.acceptedDate && <DetailRow label="Accepted">{formatDate(quotation.acceptedDate)}</DetailRow>}
              {quotation.clientSignerName && <DetailRow label="Signed by">{quotation.clientSignerName}</DetailRow>}
              <DetailRow label="Template">{templateName(quotation.templateId)}</DetailRow>
              <DetailRow label="Currency">{quotation.currency}</DetailRow>
            </dl>
          </SideCard>

          <SideCard title="Invoice">
            {convertedId ? (
              invoice ? (
                <Link
                  to={`/invoices/${invoice.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-xs font-medium text-slate-800">{invoice.invoiceNumber}</span>
                    <span className="block text-xs text-slate-500">
                      Issued {formatDate(invoice.date)} · {formatCurrency(invoice.total, invoice.currencySymbol || cur)}
                    </span>
                  </span>
                  <StatusBadge status={effectiveInvoiceStatus(invoice)} />
                </Link>
              ) : (
                <p className="text-[13px] text-slate-500">Converted to an invoice that has since been deleted.</p>
              )
            ) : (
              <p className="text-[13px] text-slate-500">
                {convertible
                  ? 'Not invoiced yet. Convert this quotation to bill the client with the same items.'
                  : status === 'draft'
                    ? 'Send the quotation to the client before invoicing.'
                    : 'Not invoiced.'}
              </p>
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

      {acceptOpen && (
        <AcceptModal
          quotation={quotation}
          onClose={() => setAcceptOpen(false)}
          onConfirm={(signer, date) =>
            setStatus('accepted', `${quotation.quotationNumber} marked as accepted`, {
              clientSignerName: signer || undefined,
              acceptedDate: date,
            })
          }
        />
      )}
      <ShareDocumentModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        collection="quotations"
        recordId={quotation.id}
        data={docData}
        templateId={quotation.templateId}
        contact={{ name: quotation.customer.name || quotation.customer.company, email: quotation.customer.email, phone: quotation.customer.phone }}
      />
      <ConfirmModal
        isOpen={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConfirm={convert}
        title="Convert to invoice?"
        message={`A draft invoice for ${formatCurrency(quotation.total, cur)} will be created with the same client and line items, due in 30 days. ${quotation.quotationNumber} will be marked as accepted.`}
        confirmLabel="Create invoice"
        variant="primary"
      />
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteQuotation(quotation.id);
          navigate('/quotations');
        }}
        title={`Delete ${quotation.quotationNumber}?`}
        message="This permanently removes the quotation. Any invoice created from it is kept. This cannot be undone."
        confirmLabel="Delete quotation"
      />
    </div>
  );
};

/** Records client acceptance. Mounted only while open, so its fields start fresh each time. */
const AcceptModal: React.FC<{
  quotation: Quotation;
  onClose: () => void;
  onConfirm: (signerName: string, acceptedDate: string) => void;
}> = ({ quotation, onClose, onConfirm }) => {
  const [signer, setSigner] = useState(quotation.clientSignerName || quotation.customer.name || '');
  const [date, setDate] = useState(quotation.acceptedDate || today());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(signer.trim(), date || today());
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title="Mark as accepted"
      description="Record who accepted the quotation. The details appear in the signature block."
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Accepted by" htmlFor="accept-signer">
          <input
            id="accept-signer"
            className="input"
            placeholder="Client signatory"
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Acceptance date" htmlFor="accept-date">
          <input id="accept-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <CheckCircle2 size={15} /> Mark accepted
          </button>
        </div>
      </form>
    </Modal>
  );
};
