import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Download, Eye, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
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
import { RecordPaymentModal } from '../../components/documents/RecordPaymentModal';
import type { Invoice } from '../../types';
import { formatCurrency, formatDate, getStatusLabel } from '../../utils/formatters';
import { dueLabel, effectiveInvoiceStatus } from '../../utils/insights';

type Filter = 'all' | 'draft' | 'outstanding' | 'overdue' | 'paid';
type Row = { inv: Invoice; status: Invoice['status'] };
type SortKey = 'number' | 'client' | 'date' | 'due' | 'total' | 'balance' | 'status';

const SORT_KEYS: readonly SortKey[] = ['number', 'client', 'date', 'due', 'total', 'balance', 'status'];
const clientName = (inv: Invoice) => inv.customer.company || inv.customer.name;

const ACCESSORS: SortAccessors<Row, SortKey> = {
  number: (r) => r.inv.invoiceNumber,
  client: (r) => clientName(r.inv),
  date: (r) => r.inv.date,
  due: (r) => r.inv.dueDate,
  total: (r) => r.inv.total,
  balance: (r) => r.inv.balanceDue,
  status: (r) => STATUS_RANK[r.status] ?? 99,
};
const newestFirst = (a: Row, b: Row) => b.inv.createdAt.localeCompare(a.inv.createdAt);

const MOBILE_SORTS: readonly SortOption<SortKey>[] = [
  { key: 'date', dir: 'desc', label: 'Newest first' },
  { key: 'date', dir: 'asc', label: 'Oldest first' },
  { key: 'due', dir: 'asc', label: 'Due soonest' },
  { key: 'balance', dir: 'desc', label: 'Highest balance' },
  { key: 'total', dir: 'desc', label: 'Highest total' },
  { key: 'client', dir: 'asc', label: 'Client A–Z' },
];

const CSV_COLUMNS: readonly CsvColumn<Row>[] = [
  { header: 'Invoice number', value: (r) => r.inv.invoiceNumber },
  { header: 'Client', value: (r) => r.inv.customer.name },
  { header: 'Company', value: (r) => r.inv.customer.company },
  { header: 'Email', value: (r) => r.inv.customer.email },
  { header: 'Project', value: (r) => r.inv.projectDescription },
  { header: 'Issue date', value: (r) => r.inv.date },
  { header: 'Due date', value: (r) => r.inv.dueDate },
  { header: 'Status', value: (r) => getStatusLabel(r.status) },
  { header: 'Currency', value: (r) => r.inv.currency },
  { header: 'Total', value: (r) => csvMoney(r.inv.total) },
  { header: 'Paid', value: (r) => csvMoney(r.inv.amountPaid) },
  { header: 'Balance', value: (r) => csvMoney(r.inv.balanceDue) },
];

const matchesFilter = (status: Invoice['status'], f: Filter) => {
  switch (f) {
    case 'all':
      return true;
    case 'draft':
      return status === 'draft';
    case 'outstanding':
      return status === 'sent' || status === 'partially_paid' || status === 'overdue';
    case 'overdue':
      return status === 'overdue';
    case 'paid':
      return status === 'paid';
  }
};

const toneClass = (tone: 'muted' | 'warning' | 'danger') =>
  tone === 'danger' ? 'font-medium text-rose-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-400';

export const InvoicesList: React.FC = () => {
  const navigate = useNavigate();
  const invoices = useInvoicesStore((s) => s.invoices);
  const { deleteInvoice, deleteInvoices, duplicateInvoice } = useInvoicesStore.getState();
  const company = useCompanyStore((s) => s.company);
  const canCreate = useCan('documents.create');
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const { sort, setSort, toggle: toggleSort } = useSortable<SortKey>({
    storageKey: 'devcity:sort:invoices',
    keys: SORT_KEYS,
    initial: { key: 'date', dir: 'desc' },
    descFirst: ['date', 'total', 'balance'],
  });

  const rows = useMemo<Row[]>(() => invoices.map((inv) => ({ inv, status: effectiveInvoiceStatus(inv) })), [invoices]);

  const cur = company.currencySymbol;
  const live = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'draft');
  const outstanding = live.reduce((s, r) => s + (r.inv.balanceDue || 0), 0);
  const overdueRows = rows.filter((r) => r.status === 'overdue');
  const overdue = overdueRows.reduce((s, r) => s + (r.inv.balanceDue || 0), 0);
  const collected = live.reduce((s, r) => s + (r.inv.amountPaid || 0), 0);

  const count = (f: Filter) => rows.filter((r) => matchesFilter(r.status, f)).length;
  const q = search.trim().toLowerCase();
  const filtered = sortRows(
    rows.filter(
      ({ inv, status }) =>
        matchesFilter(status, filter) &&
        (!q ||
          `${inv.invoiceNumber} ${inv.customer.name} ${inv.customer.company} ${inv.projectDescription ?? ''}`
            .toLowerCase()
            .includes(q))
    ),
    sort,
    ACCESSORS,
    newestFirst
  );

  const sel = useSelection(filtered.map((r) => r.inv.id));
  const selectedRows = filtered.filter((r) => sel.isSelected(r.inv.id));

  const exportRows = (list: Row[]) => exportCsv({ name: 'invoices', noun: 'invoice', rows: list, columns: CSV_COLUMNS });

  const actionsFor = (inv: Invoice, status: Invoice['status']): RowAction[] => [
    { label: 'View', icon: Eye, onClick: () => navigate(`/invoices/${inv.id}`) },
    { label: 'Edit', icon: Pencil, hidden: !canEdit, onClick: () => navigate(`/invoices/${inv.id}/edit`) },
    {
      label: 'Record payment',
      icon: CheckCircle2,
      hidden: !canPay || inv.balanceDue <= 0 || status === 'cancelled',
      onClick: () => setPaying(inv),
    },
    {
      label: 'Duplicate',
      icon: Copy,
      hidden: !canCreate,
      onClick: () => {
        const dup = duplicateInvoice(inv.id);
        if (dup) {
          toast.success(`Duplicated as ${dup.invoiceNumber}`);
          navigate(`/invoices/${dup.id}/edit`);
        }
      },
    },
    { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteTarget(inv) },
  ];

  const confirmBulkDelete = () => {
    if (!bulkDeleteIds) return;
    try {
      deleteInvoices(bulkDeleteIds);
      sel.clear();
    } catch (err) {
      if (!(err instanceof PermissionError)) toast.error('Could not delete the invoices.');
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Invoices"
        description="Bill clients, track what's owed and record payments."
        actions={
          <>
            {invoices.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => exportRows(filtered)} title="Export the current list to CSV">
                <Download size={16} /> Export
              </button>
            )}
            {canCreate && (
              <Link to="/invoices/new" className="btn-primary">
                <Plus size={16} /> New invoice
              </Link>
            )}
          </>
        }
      />

      {invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="Outstanding" value={formatCurrency(outstanding, cur)} hint={plural(count('outstanding'), 'open invoice')} onClick={() => setFilter('outstanding')} active={filter === 'outstanding'} />
          <MetricTile label="Overdue" value={formatCurrency(overdue, cur)} hint={plural(overdueRows.length, 'invoice')} tone={overdue > 0 ? 'danger' : 'default'} onClick={() => setFilter('overdue')} active={filter === 'overdue'} />
          <MetricTile label="Collected" value={formatCurrency(collected, cur)} hint="Across all invoices" tone="success" onClick={() => setFilter('paid')} active={filter === 'paid'} />
          <MetricTile label="Drafts" value={String(count('draft'))} hint="Not yet sent" onClick={() => setFilter('draft')} active={filter === 'draft'} />
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
              { value: 'outstanding', label: 'Outstanding', count: count('outstanding') },
              { value: 'overdue', label: 'Overdue', count: count('overdue') },
              { value: 'paid', label: 'Paid', count: count('paid') },
            ]}
          />
          <div className="flex flex-col gap-2 pb-3 md:w-72">
            <SearchInput value={search} onChange={setSearch} placeholder="Search number, client or project" className="[&_input]:h-10 md:[&_input]:h-9" />
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
          invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Create your first invoice"
              description="Professional invoices with live preview, automatic numbering, bank details and one-click payment receipts."
              action={
                canCreate && (
                  <Link to="/invoices/new" className="btn-primary">
                    <Plus size={16} /> New invoice
                  </Link>
                )
              }
            />
          ) : (
            <EmptyState icon={FileText} title="No matching invoices" description="Try a different search term or filter." />
          )
        ) : (
          <>
            <MobileList label="Invoices">
              {filtered.map(({ inv, status }) => {
                const due = dueLabel(inv.dueDate);
                const showDue = inv.balanceDue > 0 && status !== 'draft' && status !== 'cancelled';
                return (
                  <MobileRow
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    mono
                    title={inv.invoiceNumber}
                    badge={<StatusBadge status={status} />}
                    subtitle={clientName(inv) || '—'}
                    amount={formatCurrency(showDue ? inv.balanceDue : inv.total, inv.currencySymbol || cur)}
                    hint={
                      showDue ? (
                        <span className={toneClass(due.tone)}>{due.text}</span>
                      ) : (
                        <span className="text-slate-400">{formatDate(inv.date)}</span>
                      )
                    }
                    actions={<RowActions size="lg" label={`Actions for ${inv.invoiceNumber}`} actions={actionsFor(inv, status)} />}
                    selecting={sel.selecting}
                    selected={sel.isSelected(inv.id)}
                    onToggle={() => sel.toggle(inv.id)}
                    selectLabel={`Select ${inv.invoiceNumber}`}
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
                        label={sel.allSelected ? 'Deselect all' : `Select all ${plural(filtered.length, 'invoice')}`}
                      />
                    </th>
                    <SortHeader label="Invoice" sortKey="number" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Client" sortKey="client" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Issued" sortKey="date" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Due" sortKey="due" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} align="right" />
                    <SortHeader label="Balance" sortKey="balance" sort={sort} onSort={toggleSort} align="right" />
                    <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                    <th className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ inv, status }) => {
                    const due = dueLabel(inv.dueDate);
                    const showDue = inv.balanceDue > 0 && status !== 'draft' && status !== 'cancelled';
                    const sym = inv.currencySymbol || cur;
                    const selected = sel.isSelected(inv.id);
                    return (
                      <tr
                        key={inv.id}
                        className={`cursor-pointer ${selected ? 'bg-primary-50/60 hover:bg-primary-50' : ''}`}
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        <SelectCell checked={selected} label={`Select ${inv.invoiceNumber}`} onToggle={(range) => sel.toggle(inv.id, range)} />
                        <td>
                          <Link
                            to={`/invoices/${inv.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[13px] font-medium text-slate-900 hover:text-primary-700"
                          >
                            {inv.invoiceNumber}
                          </Link>
                          {inv.projectDescription && (
                            <p className="max-w-[240px] truncate text-xs text-slate-500">{inv.projectDescription}</p>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={clientName(inv) || '?'} size="xs" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{clientName(inv)}</p>
                              {inv.customer.company && <p className="truncate text-xs text-slate-500">{inv.customer.name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-slate-600">{formatDate(inv.date)}</td>
                        <td className="whitespace-nowrap">
                          <p className="text-slate-600">{formatDate(inv.dueDate)}</p>
                          {showDue && <p className={`text-xs ${toneClass(due.tone)}`}>{due.text}</p>}
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-slate-900 tabular">{formatCurrency(inv.total, sym)}</td>
                        <td className="whitespace-nowrap text-right tabular">
                          <span className={inv.balanceDue > 0 && status !== 'cancelled' ? 'font-medium text-slate-900' : 'text-slate-400'}>
                            {formatCurrency(inv.balanceDue, sym)}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={status} />
                        </td>
                        <td className="text-right">
                          <RowActions label={`Actions for ${inv.invoiceNumber}`} actions={actionsFor(inv, status)} />
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
          noun="invoice"
          onSelectAll={sel.selectAll}
          onClear={sel.clear}
          onExport={() => exportRows(sel.count > 0 ? selectedRows : filtered)}
          onDelete={canDelete ? () => setBulkDeleteIds(sel.selectedIds) : undefined}
        />
      )}

      <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteInvoice(deleteTarget.id);
        }}
        title={`Delete ${deleteTarget?.invoiceNumber ?? 'invoice'}?`}
        message="This removes the invoice. Linked receipts are kept. You can undo this for a few seconds afterwards."
        confirmLabel="Delete invoice"
      />
      <ConfirmModal
        isOpen={!!bulkDeleteIds}
        onClose={() => setBulkDeleteIds(null)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'invoice')}?`}
        message="The selected invoices will be removed. Linked receipts are kept. You can undo this for a few seconds afterwards."
        confirmLabel={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'invoice')}`}
      />
    </div>
  );
};
