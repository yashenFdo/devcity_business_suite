import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, CheckCircle2, Copy, Download, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBillsStore } from '../../store/useBillsStore';
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
import { paymentMethodLabel } from '../../components/documents/paymentMethods';
import type { Bill } from '../../types';
import { formatCurrency, formatDate, getStatusLabel, today } from '../../utils/formatters';
import { dueLabel, effectiveBillStatus } from '../../utils/insights';
import { BillPaymentModal } from './BillPaymentModal';

type Filter = 'all' | 'draft' | 'unpaid' | 'overdue' | 'paid';
type Row = { bill: Bill; status: Bill['status'] };
type SortKey = 'number' | 'vendor' | 'date' | 'due' | 'total' | 'balance' | 'status';

const SORT_KEYS: readonly SortKey[] = ['number', 'vendor', 'date', 'due', 'total', 'balance', 'status'];

const ACCESSORS: SortAccessors<Row, SortKey> = {
  number: (r) => r.bill.billNumber,
  vendor: (r) => r.bill.vendorName,
  date: (r) => r.bill.date,
  due: (r) => r.bill.dueDate,
  total: (r) => r.bill.total,
  balance: (r) => r.bill.balanceDue,
  status: (r) => STATUS_RANK[r.status] ?? 99,
};
const newestFirst = (a: Row, b: Row) => b.bill.createdAt.localeCompare(a.bill.createdAt);

const MOBILE_SORTS: readonly SortOption<SortKey>[] = [
  { key: 'date', dir: 'desc', label: 'Newest first' },
  { key: 'date', dir: 'asc', label: 'Oldest first' },
  { key: 'due', dir: 'asc', label: 'Due soonest' },
  { key: 'balance', dir: 'desc', label: 'Highest balance' },
  { key: 'total', dir: 'desc', label: 'Highest total' },
  { key: 'vendor', dir: 'asc', label: 'Vendor A–Z' },
];

const CSV_COLUMNS: readonly CsvColumn<Row>[] = [
  { header: 'Bill number', value: (r) => r.bill.billNumber },
  { header: 'Vendor', value: (r) => r.bill.vendorName },
  { header: 'Vendor email', value: (r) => r.bill.vendorEmail },
  { header: 'Bill date', value: (r) => r.bill.date },
  { header: 'Due date', value: (r) => r.bill.dueDate },
  { header: 'Status', value: (r) => getStatusLabel(r.status) },
  { header: 'Currency', value: (r) => r.bill.currency },
  { header: 'Total', value: (r) => csvMoney(r.bill.total) },
  { header: 'Paid', value: (r) => csvMoney(r.bill.amountPaid) },
  { header: 'Balance', value: (r) => csvMoney(r.bill.balanceDue) },
  { header: 'Payment date', value: (r) => r.bill.paymentDate },
  { header: 'Payment method', value: (r) => (r.bill.paymentMethod ? paymentMethodLabel(r.bill.paymentMethod) : '') },
];

const matchesFilter = (status: Bill['status'], f: Filter) => {
  switch (f) {
    case 'all':
      return true;
    case 'draft':
      return status === 'draft';
    case 'unpaid':
      return status === 'unpaid' || status === 'overdue';
    case 'overdue':
      return status === 'overdue';
    case 'paid':
      return status === 'paid';
  }
};

const toneClass = (tone: 'muted' | 'warning' | 'danger') =>
  tone === 'danger' ? 'font-medium text-rose-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-400';

export const BillsList: React.FC = () => {
  const navigate = useNavigate();
  const bills = useBillsStore((s) => s.bills);
  const { deleteBill, deleteBills, duplicateBill } = useBillsStore.getState();
  const company = useCompanyStore((s) => s.company);
  const canCreate = useCan('documents.create');
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);

  const { sort, setSort, toggle: toggleSort } = useSortable<SortKey>({
    storageKey: 'devcity:sort:bills',
    keys: SORT_KEYS,
    initial: { key: 'date', dir: 'desc' },
    descFirst: ['date', 'total', 'balance'],
  });

  const rows = useMemo<Row[]>(() => bills.map((bill) => ({ bill, status: effectiveBillStatus(bill) })), [bills]);

  const cur = company.currencySymbol;
  const now = today();
  const month = now.slice(0, 7);
  const year = now.slice(0, 4);
  const unpaidRows = rows.filter((r) => matchesFilter(r.status, 'unpaid'));
  const unpaid = unpaidRows.reduce((s, r) => s + (r.bill.balanceDue || 0), 0);
  const overdueRows = rows.filter((r) => r.status === 'overdue');
  const overdue = overdueRows.reduce((s, r) => s + (r.bill.balanceDue || 0), 0);
  const paidThisMonthRows = rows.filter(
    (r) => r.status !== 'cancelled' && (r.bill.amountPaid || 0) > 0 && r.bill.paymentDate?.startsWith(month)
  );
  const paidThisMonth = paidThisMonthRows.reduce((s, r) => s + (r.bill.amountPaid || 0), 0);
  const yearRows = rows.filter((r) => r.status !== 'draft' && r.status !== 'cancelled' && r.bill.date.startsWith(year));
  const totalYear = yearRows.reduce((s, r) => s + (r.bill.total || 0), 0);

  const count = (f: Filter) => rows.filter((r) => matchesFilter(r.status, f)).length;
  const q = search.trim().toLowerCase();
  const filtered = sortRows(
    rows.filter(
      ({ bill, status }) =>
        matchesFilter(status, filter) &&
        (!q ||
          `${bill.billNumber} ${bill.vendorName} ${bill.vendorEmail} ${bill.notes ?? ''} ${bill.lineItems
            .map((i) => i.description)
            .join(' ')}`
            .toLowerCase()
            .includes(q))
    ),
    sort,
    ACCESSORS,
    newestFirst
  );

  const sel = useSelection(filtered.map((r) => r.bill.id));
  const selectedRows = filtered.filter((r) => sel.isSelected(r.bill.id));

  const exportRows = (list: Row[]) => exportCsv({ name: 'bills', noun: 'bill', rows: list, columns: CSV_COLUMNS });

  const actionsFor = (bill: Bill, status: Bill['status']): RowAction[] => {
    const payable = canPay && canEdit && bill.balanceDue > 0 && status !== 'cancelled';
    return [
      { label: 'View', icon: Eye, onClick: () => navigate(`/bills/${bill.id}`) },
      { label: 'Edit', icon: Pencil, hidden: !canEdit, onClick: () => navigate(`/bills/${bill.id}/edit`) },
      {
        label: bill.amountPaid > 0 ? 'Record payment' : 'Mark as paid',
        icon: CheckCircle2,
        hidden: !payable,
        onClick: () => setPaying(bill),
      },
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
      { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteTarget(bill) },
    ];
  };

  const confirmBulkDelete = () => {
    if (!bulkDeleteIds) return;
    try {
      deleteBills(bulkDeleteIds);
      sel.clear();
    } catch (err) {
      if (!(err instanceof PermissionError)) toast.error('Could not delete the bills.');
    }
  };

  const newBillLink = canCreate && (
    <Link to="/bills/new" className="btn-primary">
      <Plus size={16} /> New bill
    </Link>
  );

  return (
    <div className="page">
      <PageHeader
        title="Bills"
        description="Track what DevCity owes vendors — hosting, licences and contractors."
        actions={
          <>
            {bills.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => exportRows(filtered)} title="Export the current list to CSV">
                <Download size={16} /> Export
              </button>
            )}
            {newBillLink}
          </>
        }
      />

      {bills.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Unpaid"
            value={formatCurrency(unpaid, cur)}
            hint={`${plural(unpaidRows.length, 'bill')} to pay`}
            tone={unpaid > 0 ? 'warning' : 'default'}
            onClick={() => setFilter('unpaid')}
            active={filter === 'unpaid'}
          />
          <MetricTile
            label="Overdue"
            value={formatCurrency(overdue, cur)}
            hint={plural(overdueRows.length, 'bill')}
            tone={overdue > 0 ? 'danger' : 'default'}
            onClick={() => setFilter('overdue')}
            active={filter === 'overdue'}
          />
          <MetricTile
            label="Paid this month"
            value={formatCurrency(paidThisMonth, cur)}
            hint={plural(paidThisMonthRows.length, 'payment')}
            tone="success"
            onClick={() => setFilter('paid')}
            active={filter === 'paid'}
          />
          <MetricTile label="Total this year" value={formatCurrency(totalYear, cur)} hint={`${plural(yearRows.length, 'bill')} in ${year}`} />
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
              { value: 'unpaid', label: 'Unpaid', count: count('unpaid') },
              { value: 'overdue', label: 'Overdue', count: count('overdue') },
              { value: 'paid', label: 'Paid', count: count('paid') },
            ]}
          />
          <div className="flex flex-col gap-2 pb-3 md:w-72">
            <SearchInput value={search} onChange={setSearch} placeholder="Search number, vendor or item" className="[&_input]:h-10 md:[&_input]:h-9" />
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
          bills.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Record your first vendor bill"
              description="Keep cloud hosting, SaaS licences and contractor invoices in one place, see what's due and mark them paid."
              action={newBillLink}
            />
          ) : (
            <EmptyState icon={Banknote} title="No matching bills" description="Try a different search term or filter." />
          )
        ) : (
          <>
            <MobileList label="Bills">
              {filtered.map(({ bill, status }) => {
                const due = dueLabel(bill.dueDate);
                const showDue = bill.balanceDue > 0 && status !== 'draft' && status !== 'cancelled';
                return (
                  <MobileRow
                    key={bill.id}
                    to={`/bills/${bill.id}`}
                    mono
                    title={bill.billNumber}
                    badge={<StatusBadge status={status} />}
                    subtitle={bill.vendorName || '—'}
                    amount={formatCurrency(showDue ? bill.balanceDue : bill.total, bill.currencySymbol || cur)}
                    hint={
                      showDue ? (
                        <span className={toneClass(due.tone)}>{due.text}</span>
                      ) : status === 'paid' && bill.paymentDate ? (
                        <span className="text-slate-400">Paid {formatDate(bill.paymentDate, 'dd MMM')}</span>
                      ) : (
                        <span className="text-slate-400">{formatDate(bill.date)}</span>
                      )
                    }
                    actions={<RowActions size="lg" label={`Actions for ${bill.billNumber}`} actions={actionsFor(bill, status)} />}
                    selecting={sel.selecting}
                    selected={sel.isSelected(bill.id)}
                    onToggle={() => sel.toggle(bill.id)}
                    selectLabel={`Select ${bill.billNumber}`}
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
                        label={sel.allSelected ? 'Deselect all' : `Select all ${plural(filtered.length, 'bill')}`}
                      />
                    </th>
                    <SortHeader label="Bill" sortKey="number" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Vendor" sortKey="vendor" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Bill date" sortKey="date" sort={sort} onSort={toggleSort} />
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
                  {filtered.map(({ bill, status }) => {
                    const due = dueLabel(bill.dueDate);
                    const showDue = bill.balanceDue > 0 && status !== 'draft' && status !== 'cancelled';
                    const sym = bill.currencySymbol || cur;
                    const summary = bill.lineItems.find((i) => i.description.trim())?.description;
                    const selected = sel.isSelected(bill.id);
                    return (
                      <tr
                        key={bill.id}
                        className={`cursor-pointer ${selected ? 'bg-primary-50/60 hover:bg-primary-50' : ''}`}
                        onClick={() => navigate(`/bills/${bill.id}`)}
                      >
                        <SelectCell checked={selected} label={`Select ${bill.billNumber}`} onToggle={(range) => sel.toggle(bill.id, range)} />
                        <td>
                          <Link
                            to={`/bills/${bill.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[13px] font-medium text-slate-900 hover:text-primary-700"
                          >
                            {bill.billNumber}
                          </Link>
                          {summary && <p className="max-w-[240px] truncate text-xs text-slate-500">{summary}</p>}
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={bill.vendorName || '?'} size="xs" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{bill.vendorName || '—'}</p>
                              {bill.vendorEmail && <p className="max-w-[200px] truncate text-xs text-slate-500">{bill.vendorEmail}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-slate-600">{formatDate(bill.date)}</td>
                        <td className="whitespace-nowrap">
                          <p className="text-slate-600">{formatDate(bill.dueDate)}</p>
                          {showDue ? (
                            <p className={`text-xs ${toneClass(due.tone)}`}>{due.text}</p>
                          ) : (
                            status === 'paid' &&
                            bill.paymentDate && <p className="text-xs text-slate-400">Paid {formatDate(bill.paymentDate, 'dd MMM')}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-slate-900 tabular">{formatCurrency(bill.total, sym)}</td>
                        <td className="whitespace-nowrap text-right tabular">
                          <span className={bill.balanceDue > 0 && status !== 'cancelled' ? 'font-medium text-slate-900' : 'text-slate-400'}>
                            {formatCurrency(bill.balanceDue, sym)}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={status} />
                        </td>
                        <td className="text-right">
                          <RowActions label={`Actions for ${bill.billNumber}`} actions={actionsFor(bill, status)} />
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
          noun="bill"
          onSelectAll={sel.selectAll}
          onClear={sel.clear}
          onExport={() => exportRows(sel.count > 0 ? selectedRows : filtered)}
          onDelete={canDelete ? () => setBulkDeleteIds(sel.selectedIds) : undefined}
        />
      )}

      <BillPaymentModal bill={paying} onClose={() => setPaying(null)} />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteBill(deleteTarget.id);
        }}
        title={`Delete ${deleteTarget?.billNumber ?? 'bill'}?`}
        message="This removes the bill and its payment record. You can undo this for a few seconds afterwards."
        confirmLabel="Delete bill"
      />
      <ConfirmModal
        isOpen={!!bulkDeleteIds}
        onClose={() => setBulkDeleteIds(null)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'bill')}?`}
        message="The selected bills and their payment records will be removed. You can undo this for a few seconds afterwards."
        confirmLabel={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'bill')}`}
      />
    </div>
  );
};
