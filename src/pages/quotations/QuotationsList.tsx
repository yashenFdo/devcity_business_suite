import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Eye, FileSignature, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { useCan } from '../../security/sessionState';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { RowActions } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { FilterTabs, MetricTile, SearchInput } from '../../components/ui/ListControls';
import type { Quotation } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { effectiveQuotationStatus } from '../../utils/insights';
import { canConvert, convertQuotationToInvoice, validityLabel } from './quotationDocument';

type Filter = 'all' | 'draft' | 'sent' | 'accepted' | 'closed';

const matchesFilter = (status: Quotation['status'], f: Filter) => {
  switch (f) {
    case 'all':
      return true;
    case 'draft':
      return status === 'draft';
    case 'sent':
      return status === 'sent';
    case 'accepted':
      return status === 'accepted';
    case 'closed':
      return status === 'rejected' || status === 'expired';
  }
};

export const QuotationsList: React.FC = () => {
  const navigate = useNavigate();
  const quotations = useQuotationsStore((s) => s.quotations);
  const { deleteQuotation, duplicateQuotation } = useQuotationsStore.getState();
  const invoices = useInvoicesStore((s) => s.invoices);
  const company = useCompanyStore((s) => s.company);
  const canCreate = useCan('documents.create');
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [convertTarget, setConvertTarget] = useState<Quotation | null>(null);

  const rows = useMemo(
    () =>
      quotations
        .map((quo) => ({ quo, status: effectiveQuotationStatus(quo) }))
        .sort((a, b) => b.quo.date.localeCompare(a.quo.date) || b.quo.createdAt.localeCompare(a.quo.createdAt)),
    [quotations]
  );
  const invoiceNumbers = useMemo(() => new Map(invoices.map((i) => [i.id, i.invoiceNumber])), [invoices]);

  const cur = company.currencySymbol;
  const sum = (list: typeof rows) => list.reduce((s, r) => s + (r.quo.total || 0), 0);
  const sentRows = rows.filter((r) => r.status === 'sent');
  const acceptedRows = rows.filter((r) => r.status === 'accepted');
  const rejectedCount = rows.filter((r) => r.status === 'rejected').length;
  const decided = acceptedRows.length + rejectedCount;
  const winRate = decided > 0 ? Math.round((acceptedRows.length / decided) * 100) : null;

  const count = (f: Filter) => rows.filter((r) => matchesFilter(r.status, f)).length;
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    ({ quo, status }) =>
      matchesFilter(status, filter) &&
      (!q ||
        `${quo.quotationNumber} ${quo.customer.name} ${quo.customer.company} ${quo.projectDescription ?? ''}`
          .toLowerCase()
          .includes(q))
  );

  const convert = (quo: Quotation) => {
    try {
      const inv = convertQuotationToInvoice(quo, company);
      toast.success(`Invoice ${inv.invoiceNumber} created from ${quo.quotationNumber}`);
      navigate(`/invoices/${inv.id}/edit`);
    } catch {
      toast.error('Could not create the invoice.');
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Quotations"
        description="Price up work, send proposals and turn accepted quotes into invoices."
        actions={
          canCreate && (
            <Link to="/quotations/new" className="btn-primary">
              <Plus size={16} /> New quotation
            </Link>
          )
        }
      />

      {quotations.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Open pipeline"
            value={formatCurrency(sum(sentRows), cur)}
            hint={`${sentRows.length} awaiting response`}
            onClick={() => setFilter('sent')}
            active={filter === 'sent'}
          />
          <MetricTile
            label="Accepted"
            value={formatCurrency(sum(acceptedRows), cur)}
            hint={`${acceptedRows.length} won`}
            tone="success"
            onClick={() => setFilter('accepted')}
            active={filter === 'accepted'}
          />
          <MetricTile
            label="Win rate"
            value={winRate === null ? '—' : `${winRate}%`}
            hint={decided > 0 ? `${acceptedRows.length} of ${decided} decided` : 'No decisions yet'}
          />
          <MetricTile
            label="Drafts"
            value={String(count('draft'))}
            hint="Not yet sent"
            onClick={() => setFilter('draft')}
            active={filter === 'draft'}
          />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 pt-3 md:flex-row md:items-end md:justify-between">
          <FilterTabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'all', label: 'All', count: rows.length },
              { value: 'draft', label: 'Draft', count: count('draft') },
              { value: 'sent', label: 'Sent', count: count('sent') },
              { value: 'accepted', label: 'Accepted', count: count('accepted') },
              { value: 'closed', label: 'Declined & expired', count: count('closed') },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Search number, client or scope" className="pb-3 md:w-72" />
        </div>

        {filtered.length === 0 ? (
          quotations.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="Create your first quotation"
              description="Scope the work, price it line by line and send a polished proposal. Accepted quotes become invoices in one click."
              action={
                canCreate && (
                  <Link to="/quotations/new" className="btn-primary">
                    <Plus size={16} /> New quotation
                  </Link>
                )
              }
            />
          ) : (
            <EmptyState icon={FileSignature} title="No matching quotations" description="Try a different search term or filter." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Quotation</th>
                  <th>Client</th>
                  <th>Issued</th>
                  <th>Valid until</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ quo, status }) => {
                  const validity = validityLabel(quo.validUntil);
                  const showValidity = status === 'sent';
                  const sym = quo.currencySymbol || cur;
                  const invoiceNumber = quo.convertedToInvoiceId ? invoiceNumbers.get(quo.convertedToInvoiceId) : undefined;
                  return (
                    <tr key={quo.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${quo.id}`)}>
                      <td>
                        <Link
                          to={`/quotations/${quo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[13px] font-medium text-slate-900 hover:text-primary-700"
                        >
                          {quo.quotationNumber}
                        </Link>
                        {quo.projectDescription && (
                          <p className="max-w-[240px] truncate text-xs text-slate-500">{quo.projectDescription}</p>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={quo.customer.company || quo.customer.name || '?'} size="xs" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{quo.customer.company || quo.customer.name}</p>
                            {quo.customer.company && <p className="truncate text-xs text-slate-500">{quo.customer.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{formatDate(quo.date)}</td>
                      <td className="whitespace-nowrap">
                        <p className="text-slate-600">{formatDate(quo.validUntil)}</p>
                        {showValidity && (
                          <p
                            className={`text-xs ${
                              validity.tone === 'danger' ? 'font-medium text-rose-600' : validity.tone === 'warning' ? 'text-amber-600' : 'text-slate-400'
                            }`}
                          >
                            {validity.text}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-slate-900 tabular">{formatCurrency(quo.total, sym)}</td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={status} />
                          {quo.convertedToInvoiceId && (
                            <Link
                              to={`/invoices/${quo.convertedToInvoiceId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary-700"
                            >
                              <FileText size={12} /> {invoiceNumber ?? 'Invoiced'}
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <RowActions
                          actions={[
                            { label: 'View', icon: Eye, onClick: () => navigate(`/quotations/${quo.id}`) },
                            { label: 'Edit', icon: Pencil, hidden: !canEdit, onClick: () => navigate(`/quotations/${quo.id}/edit`) },
                            {
                              label: 'Convert to invoice',
                              icon: ArrowRight,
                              hidden: !canCreate || !canConvert(quo),
                              onClick: () => setConvertTarget(quo),
                            },
                            {
                              label: 'View invoice',
                              icon: FileText,
                              hidden: !quo.convertedToInvoiceId,
                              onClick: () => navigate(`/invoices/${quo.convertedToInvoiceId}`),
                            },
                            {
                              label: 'Duplicate',
                              icon: Copy,
                              hidden: !canCreate,
                              onClick: () => {
                                const dup = duplicateQuotation(quo.id);
                                if (dup) {
                                  toast.success(`Duplicated as ${dup.quotationNumber}`);
                                  navigate(`/quotations/${dup.id}/edit`);
                                }
                              },
                            },
                            { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteTarget(quo) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={() => convertTarget && convert(convertTarget)}
        title={`Convert ${convertTarget?.quotationNumber ?? 'quotation'} to invoice?`}
        message={`A draft invoice for ${formatCurrency(convertTarget?.total ?? 0, convertTarget?.currencySymbol || cur)} will be created with the same client and line items, due in 30 days. The quotation will be marked as accepted.`}
        confirmLabel="Create invoice"
        variant="primary"
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteQuotation(deleteTarget.id);
        }}
        title={`Delete ${deleteTarget?.quotationNumber ?? 'quotation'}?`}
        message="This permanently removes the quotation. Any invoice created from it is kept. This cannot be undone."
        confirmLabel="Delete quotation"
      />
    </div>
  );
};
