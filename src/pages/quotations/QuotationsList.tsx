import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Download, Eye, FileSignature, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { PermissionError, useCan } from '../../security/sessionState';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { RowActions, type RowAction } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { FilterTabs, MetricTile, SearchInput } from '../../components/ui/ListControls';
import { BulkBar } from '../../components/ui/table/BulkBar';
import { MobileList, MobileRow } from '../../components/ui/table/MobileRow';
import { MobileToolbar, type SortOption } from '../../components/ui/table/MobileToolbar';
import { SelectCell, SelectCheckbox } from '../../components/ui/table/SelectCheckbox';
import { SortHeader } from '../../components/ui/table/SortHeader';
import { csvMoney, exportCsv, type CsvColumn } from '../../components/ui/table/csv';
import { plural } from '../../components/ui/table/plural';
import { STATUS_RANK, sortRows, useSortable, type SortAccessors } from '../../components/ui/table/useSortable';
import { useSelection } from '../../components/ui/table/useSelection';
import type { Quotation } from '../../types';
import { formatCurrency, formatDate, getStatusLabel } from '../../utils/formatters';
import { effectiveQuotationStatus } from '../../utils/insights';
import { canConvert, convertQuotationToInvoice, validityLabel } from './quotationDocument';

type Filter = 'all' | 'draft' | 'sent' | 'accepted' | 'closed';
type Row = { quo: Quotation; status: Quotation['status'] };
type SortKey = 'number' | 'client' | 'date' | 'valid' | 'total' | 'status';

const SORT_KEYS: readonly SortKey[] = ['number', 'client', 'date', 'valid', 'total', 'status'];
const clientName = (quo: Quotation) => quo.customer.company || quo.customer.name;

const ACCESSORS: SortAccessors<Row, SortKey> = {
  number: (r) => r.quo.quotationNumber,
  client: (r) => clientName(r.quo),
  date: (r) => r.quo.date,
  valid: (r) => r.quo.validUntil,
  total: (r) => r.quo.total,
  status: (r) => STATUS_RANK[r.status] ?? 99,
};
const newestFirst = (a: Row, b: Row) => b.quo.createdAt.localeCompare(a.quo.createdAt);

const MOBILE_SORTS: readonly SortOption<SortKey>[] = [
  { key: 'date', dir: 'desc', label: 'Newest first' },
  { key: 'date', dir: 'asc', label: 'Oldest first' },
  { key: 'valid', dir: 'asc', label: 'Expiring soonest' },
  { key: 'total', dir: 'desc', label: 'Highest total' },
  { key: 'client', dir: 'asc', label: 'Client A–Z' },
];

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

const toneClass = (tone: 'muted' | 'warning' | 'danger') =>
  tone === 'danger' ? 'font-medium text-rose-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-400';

export const QuotationsList: React.FC = () => {
  const navigate = useNavigate();
  const quotations = useQuotationsStore((s) => s.quotations);
  const { deleteQuotation, deleteQuotations, duplicateQuotation } = useQuotationsStore.getState();
  const invoices = useInvoicesStore((s) => s.invoices);
  const company = useCompanyStore((s) => s.company);
  const canCreate = useCan('documents.create');
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [convertTarget, setConvertTarget] = useState<Quotation | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  const { sort, setSort, toggle: toggleSort } = useSortable<SortKey>({
    storageKey: 'devcity:sort:quotations',
    keys: SORT_KEYS,
    initial: { key: 'date', dir: 'desc' },
    descFirst: ['date', 'total'],
  });

  const rows = useMemo<Row[]>(() => quotations.map((quo) => ({ quo, status: effectiveQuotationStatus(quo) })), [quotations]);
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
  const filtered = sortRows(
    rows.filter(
      ({ quo, status }) =>
        matchesFilter(status, filter) &&
        (!q ||
          `${quo.quotationNumber} ${quo.customer.name} ${quo.customer.company} ${quo.projectDescription ?? ''}`
            .toLowerCase()
            .includes(q))
    ),
    sort,
    ACCESSORS,
    newestFirst
  );

  const sel = useSelection(filtered.map((r) => r.quo.id));
  const selectedRows = filtered.filter((r) => sel.isSelected(r.quo.id));

  const csvColumns: CsvColumn<Row>[] = [
    { header: 'Quotation number', value: (r) => r.quo.quotationNumber },
    { header: 'Client', value: (r) => r.quo.customer.name },
    { header: 'Company', value: (r) => r.quo.customer.company },
    { header: 'Email', value: (r) => r.quo.customer.email },
    { header: 'Scope', value: (r) => r.quo.projectDescription },
    { header: 'Issue date', value: (r) => r.quo.date },
    { header: 'Valid until', value: (r) => r.quo.validUntil },
    { header: 'Status', value: (r) => getStatusLabel(r.status) },
    { header: 'Currency', value: (r) => r.quo.currency },
    { header: 'Total', value: (r) => csvMoney(r.quo.total) },
    {
      header: 'Invoice',
      value: (r) => (r.quo.convertedToInvoiceId ? (invoiceNumbers.get(r.quo.convertedToInvoiceId) ?? 'Invoiced') : ''),
    },
  ];
  const exportRows = (list: Row[]) => exportCsv({ name: 'quotations', noun: 'quotation', rows: list, columns: csvColumns });

  const convert = (quo: Quotation) => {
    try {
      const inv = convertQuotationToInvoice(quo, company);
      toast.success(`Invoice ${inv.invoiceNumber} created from ${quo.quotationNumber}`);
      navigate(`/invoices/${inv.id}/edit`);
    } catch {
      toast.error('Could not create the invoice.');
    }
  };

  const actionsFor = (quo: Quotation): RowAction[] => [
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
  ];

  const confirmBulkDelete = () => {
    if (!bulkDeleteIds) return;
    try {
      deleteQuotations(bulkDeleteIds);
      sel.clear();
    } catch (err) {
      if (!(err instanceof PermissionError)) toast.error('Could not delete the quotations.');
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Quotations"
        description="Price up work, send proposals and turn accepted quotes into invoices."
        actions={
          <>
            {quotations.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => exportRows(filtered)} title="Export the current list to CSV">
                <Download size={16} /> Export
              </button>
            )}
            {canCreate && (
              <Link to="/quotations/new" className="btn-primary">
                <Plus size={16} /> New quotation
              </Link>
            )}
          </>
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

      <div className="card md:overflow-hidden">
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
          <div className="flex flex-col gap-2 pb-3 md:w-72">
            <SearchInput value={search} onChange={setSearch} placeholder="Search number, client or scope" className="[&_input]:h-10 md:[&_input]:h-9" />
            {filtered.length > 0 && (
              <MobileToolbar
                sort={sort}
                onSort={setSort}
                options={MOBILE_SORTS}
                selecting={sel.selecting}
                onToggleSelecting={() => (sel.selecting ? sel.clear() : sel.setSelecting(true))}
              />
            )}
          </div>
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
          <>
            <MobileList label="Quotations">
              {filtered.map(({ quo, status }) => {
                const validity = validityLabel(quo.validUntil);
                return (
                  <MobileRow
                    key={quo.id}
                    to={`/quotations/${quo.id}`}
                    mono
                    title={quo.quotationNumber}
                    badge={<StatusBadge status={status} />}
                    subtitle={clientName(quo) || '—'}
                    amount={formatCurrency(quo.total, quo.currencySymbol || cur)}
                    hint={
                      status === 'sent' ? (
                        <span className={toneClass(validity.tone)}>{validity.text}</span>
                      ) : (
                        <span className="text-slate-400">{formatDate(quo.date)}</span>
                      )
                    }
                    actions={<RowActions size="lg" label={`Actions for ${quo.quotationNumber}`} actions={actionsFor(quo)} />}
                    selecting={sel.selecting}
                    selected={sel.isSelected(quo.id)}
                    onToggle={() => sel.toggle(quo.id)}
                    selectLabel={`Select ${quo.quotationNumber}`}
                  />
                );
              })}
            </MobileList>

            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" className="w-10 !pr-0">
                      <SelectCheckbox
                        checked={sel.allSelected}
                        indeterminate={sel.someSelected}
                        onToggle={sel.toggleAll}
                        label={sel.allSelected ? 'Deselect all' : `Select all ${plural(filtered.length, 'quotation')}`}
                      />
                    </th>
                    <SortHeader label="Quotation" sortKey="number" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Client" sortKey="client" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Issued" sortKey="date" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Valid until" sortKey="valid" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} align="right" />
                    <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                    <th className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ quo, status }) => {
                    const validity = validityLabel(quo.validUntil);
                    const showValidity = status === 'sent';
                    const sym = quo.currencySymbol || cur;
                    const invoiceNumber = quo.convertedToInvoiceId ? invoiceNumbers.get(quo.convertedToInvoiceId) : undefined;
                    const selected = sel.isSelected(quo.id);
                    return (
                      <tr
                        key={quo.id}
                        className={`cursor-pointer ${selected ? 'bg-primary-50/60 hover:bg-primary-50' : ''}`}
                        onClick={() => navigate(`/quotations/${quo.id}`)}
                      >
                        <SelectCell checked={selected} label={`Select ${quo.quotationNumber}`} onToggle={(range) => sel.toggle(quo.id, range)} />
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
                            <Avatar name={clientName(quo) || '?'} size="xs" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{clientName(quo)}</p>
                              {quo.customer.company && <p className="truncate text-xs text-slate-500">{quo.customer.name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-slate-600">{formatDate(quo.date)}</td>
                        <td className="whitespace-nowrap">
                          <p className="text-slate-600">{formatDate(quo.validUntil)}</p>
                          {showValidity && <p className={`text-xs ${toneClass(validity.tone)}`}>{validity.text}</p>}
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
                          <RowActions label={`Actions for ${quo.quotationNumber}`} actions={actionsFor(quo)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {(sel.count > 0 || sel.selecting) && (
        <BulkBar
          count={sel.count}
          total={filtered.length}
          noun="quotation"
          onSelectAll={sel.selectAll}
          onClear={sel.clear}
          onExport={() => exportRows(sel.count > 0 ? selectedRows : filtered)}
          onDelete={canDelete ? () => setBulkDeleteIds(sel.selectedIds) : undefined}
        />
      )}

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
        message="This removes the quotation. Any invoice created from it is kept. You can undo this for a few seconds afterwards."
        confirmLabel="Delete quotation"
      />
      <ConfirmModal
        isOpen={!!bulkDeleteIds}
        onClose={() => setBulkDeleteIds(null)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'quotation')}?`}
        message="The selected quotations will be removed. Invoices created from them are kept. You can undo this for a few seconds afterwards."
        confirmLabel={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'quotation')}`}
      />
    </div>
  );
};
