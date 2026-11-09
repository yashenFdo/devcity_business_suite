import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Eye, FilePlus2, FileSignature, Pencil, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCustomersStore } from '../../store/useCustomersStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { PermissionError, useCan } from '../../security/sessionState';
import { PageHeader } from '../../components/ui/PageHeader';
import { FilterTabs, MetricTile, SearchInput } from '../../components/ui/ListControls';
import { RowActions, type RowAction } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import { BulkBar } from '../../components/ui/table/BulkBar';
import { MobileList, MobileRow } from '../../components/ui/table/MobileRow';
import { MobileToolbar, type SortOption } from '../../components/ui/table/MobileToolbar';
import { SelectCell, SelectCheckbox } from '../../components/ui/table/SelectCheckbox';
import { SortHeader } from '../../components/ui/table/SortHeader';
import { csvMoney, exportCsv, type CsvColumn } from '../../components/ui/table/csv';
import { plural } from '../../components/ui/table/plural';
import { sortRows, useSortable, type SortAccessors, type SortState } from '../../components/ui/table/useSortable';
import { useSelection } from '../../components/ui/table/useSelection';
import type { Customer } from '../../types';
import { formatCurrency, formatDate, today } from '../../utils/formatters';
import { CustomerFormModal } from './CustomerFormModal';
import { ClientDrawer } from './ClientDrawer';
import { EMPTY_STATS, buildClientStats, clientDocuments, clientLabel, createClientResolver, type ClientStats } from './clientStats';

type Filter = 'all' | 'outstanding';
type Row = { c: Customer; label: string; stats: ClientStats };
type SortKey = 'name' | 'invoices' | 'billed' | 'outstanding' | 'activity';

const SORT_KEYS: readonly SortKey[] = ['name', 'invoices', 'billed', 'outstanding', 'activity'];

const ACCESSORS: SortAccessors<Row, SortKey> = {
  name: (r) => r.label,
  invoices: (r) => r.stats.invoiceCount,
  billed: (r) => r.stats.billed,
  outstanding: (r) => r.stats.outstanding,
  activity: (r) => r.stats.lastActivity ?? r.c.createdAt,
};
const byName = (a: Row, b: Row) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });

/** Quick presets (segmented control on desktop, select on phones). */
const PRESETS: readonly SortOption<SortKey>[] = [
  { key: 'name', dir: 'asc', label: 'Name' },
  { key: 'activity', dir: 'desc', label: 'Recent' },
  { key: 'outstanding', dir: 'desc', label: 'Balance' },
];
const MOBILE_SORTS: readonly SortOption<SortKey>[] = [
  { key: 'name', dir: 'asc', label: 'Name A–Z' },
  { key: 'activity', dir: 'desc', label: 'Recent activity' },
  { key: 'outstanding', dir: 'desc', label: 'Highest balance' },
  { key: 'billed', dir: 'desc', label: 'Most billed' },
];
const samePreset = (a: SortState<SortKey>, b: SortState<SortKey>) => a.key === b.key && a.dir === b.dir;

export const CustomersList: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const customers = useCustomersStore((s) => s.customers);
  const deleteCustomer = useCustomersStore((s) => s.deleteCustomer);
  const deleteCustomers = useCustomersStore((s) => s.deleteCustomers);
  const invoices = useInvoicesStore((s) => s.invoices);
  const quotations = useQuotationsStore((s) => s.quotations);
  const receipts = useReceiptsStore((s) => s.receipts);
  const cur = useCompanyStore((s) => s.company.currencySymbol);
  const currency = useCompanyStore((s) => s.company.currency);

  const canManage = useCan('customers.manage');
  const canDelete = useCan('customers.delete');
  const canCreateDocs = useCan('documents.create');

  const [filter, setFilter] = useState<Filter>('all');
  // undefined = closed, null = new client, Customer = editing
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  const { sort, setSort, toggle: toggleSort } = useSortable<SortKey>({
    storageKey: 'devcity:sort:customers',
    keys: SORT_KEYS,
    initial: { key: 'name', dir: 'asc' },
    descFirst: ['invoices', 'billed', 'outstanding', 'activity'],
  });

  // Search text and the open client live in the URL, so the command palette
  // (/customers?q=…) and the browser back button both work naturally.
  const search = params.get('q') ?? '';
  const selectedId = params.get('client');

  const setSearch = (v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set('q', v);
        else next.delete('q');
        return next;
      },
      { replace: true }
    );

  const openClient = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('client', id);
      return next;
    });

  const closeClient = useCallback(
    () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('client');
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  const resolve = useMemo(() => createClientResolver(customers), [customers]);
  const statsById = useMemo(
    () => buildClientStats(resolve, invoices, quotations, receipts),
    [resolve, invoices, quotations, receipts]
  );
  const statsFor = (id: string): ClientStats => statsById.get(id) ?? EMPTY_STATS;

  const rows = useMemo<Row[]>(
    () => customers.map((c) => ({ c, label: clientLabel(c), stats: statsById.get(c.id) ?? EMPTY_STATS })),
    [customers, statsById]
  );

  // KPIs
  const owing = rows.filter((r) => r.stats.outstanding > 0);
  const totalOutstanding = owing.reduce((s, r) => s + r.stats.outstanding, 0);
  const totalOverdue = owing.reduce((s, r) => s + r.stats.overdue, 0);
  const monthPrefix = today().slice(0, 7);
  const newThisMonth = customers.filter((c) => (c.createdAt || '').startsWith(monthPrefix)).length;

  // Filter + search + sort
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const filtered = sortRows(
    rows.filter(({ c, stats }) => {
      if (filter === 'outstanding' && stats.outstanding <= 0) return false;
      if (!q) return true;
      const hay = `${c.name} ${c.company} ${c.email} ${c.phone}`.toLowerCase();
      if (hay.includes(q)) return true;
      return qDigits.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(qDigits);
    }),
    sort,
    ACCESSORS,
    byName
  );

  const sel = useSelection(filtered.map((r) => r.c.id));
  const selectedRows = filtered.filter((r) => sel.isSelected(r.c.id));

  const csvColumns: CsvColumn<Row>[] = [
    { header: 'Client', value: (r) => r.c.name },
    { header: 'Company', value: (r) => r.c.company },
    { header: 'Email', value: (r) => r.c.email },
    { header: 'Phone', value: (r) => r.c.phone },
    { header: 'City', value: (r) => r.c.address?.city },
    { header: 'Country', value: (r) => r.c.address?.country },
    { header: 'Tax number', value: (r) => r.c.taxNumber },
    { header: 'Invoices', value: (r) => r.stats.invoiceCount },
    { header: 'Currency', value: () => currency },
    { header: 'Billed', value: (r) => csvMoney(r.stats.billed) },
    { header: 'Paid', value: (r) => csvMoney(r.stats.paid) },
    { header: 'Outstanding', value: (r) => csvMoney(r.stats.outstanding) },
    { header: 'Overdue', value: (r) => csvMoney(r.stats.overdue) },
    { header: 'Last activity', value: (r) => r.stats.lastActivity },
    { header: 'Added', value: (r) => (r.c.createdAt || '').slice(0, 10) },
  ];
  const exportRows = (list: Row[]) => exportCsv({ name: 'clients', noun: 'client', rows: list, columns: csvColumns });

  const selected = selectedId ? customers.find((c) => c.id === selectedId) : undefined;
  const selectedDocs = useMemo(
    () => (selected ? clientDocuments(selected.id, resolve, invoices, quotations, receipts) : []),
    [selected, resolve, invoices, quotations, receipts]
  );

  const newInvoice = (c: Customer) => navigate('/invoices/new', { state: { customerId: c.id } });
  const newQuotation = (c: Customer) => navigate('/quotations/new', { state: { customerId: c.id } });

  const actionsFor = (c: Customer): RowAction[] => [
    { label: 'View details', icon: Eye, onClick: () => openClient(c.id) },
    { label: 'New invoice', icon: FilePlus2, hidden: !canCreateDocs, onClick: () => newInvoice(c) },
    { label: 'New quotation', icon: FileSignature, hidden: !canCreateDocs, onClick: () => newQuotation(c) },
    { label: 'Edit', icon: Pencil, hidden: !canManage, onClick: () => setEditing(c) },
    { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteTarget(c) },
  ];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    try {
      deleteCustomer(deleteTarget.id);
      if (selectedId === deleteTarget.id) closeClient();
    } catch (err) {
      if (!(err instanceof PermissionError)) toast.error('Could not delete the client.');
    }
  };

  const confirmBulkDelete = () => {
    if (!bulkDeleteIds) return;
    try {
      deleteCustomers(bulkDeleteIds);
      if (selectedId && bulkDeleteIds.includes(selectedId)) closeClient();
      sel.clear();
    } catch (err) {
      if (!(err instanceof PermissionError)) toast.error('Could not delete the clients.');
    }
  };

  const deleteMessage = (() => {
    if (!deleteTarget) return '';
    const n = statsFor(deleteTarget.id).documentCount;
    const base = `${clientLabel(deleteTarget)} will be removed from your client directory.`;
    return n > 0
      ? `${base} Their ${plural(n, 'existing document')} keep${n === 1 ? 's' : ''} a copy of the client details and won't change.`
      : `${base} Any documents issued to them keep their own copy of the client details.`;
  })();

  const bulkDocCount = bulkDeleteIds ? bulkDeleteIds.reduce((s, id) => s + statsFor(id).documentCount, 0) : 0;
  const bulkDeleteMessage =
    `The selected clients will be removed from your client directory.` +
    (bulkDocCount > 0
      ? ` Their ${plural(bulkDocCount, 'existing document')} keep${bulkDocCount === 1 ? 's' : ''} a copy of the client details and won't change.`
      : '') +
    ' You can undo this for a few seconds afterwards.';

  const addButton = canManage && (
    <button type="button" className="btn-primary" onClick={() => setEditing(null)}>
      <Plus size={16} /> Add client
    </button>
  );

  return (
    <div className="page">
      <PageHeader
        title="Clients"
        description="Everyone you quote and invoice — contact details, balances and history in one place."
        actions={
          <>
            {customers.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => exportRows(filtered)} title="Export the current list to CSV">
                <Download size={16} /> Export
              </button>
            )}
            {addButton}
          </>
        }
      />

      {customers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Total clients"
            value={String(customers.length)}
            hint="In your directory"
            onClick={() => setFilter('all')}
          />
          <MetricTile
            label="With a balance"
            value={String(owing.length)}
            hint={owing.length ? 'Clients owing money' : 'Everyone is paid up'}
            tone={owing.length ? 'warning' : 'success'}
            onClick={() => setFilter('outstanding')}
            active={filter === 'outstanding'}
          />
          <MetricTile
            label="Total outstanding"
            value={formatCurrency(totalOutstanding, cur)}
            hint={totalOverdue > 0 ? `${formatCurrency(totalOverdue, cur)} overdue` : 'Nothing overdue'}
            tone={totalOverdue > 0 ? 'danger' : 'default'}
          />
          <MetricTile label="New this month" value={String(newThisMonth)} hint={format(new Date(), 'MMMM yyyy')} />
        </div>
      )}

      <div className="card md:overflow-hidden">
        {customers.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 pt-3 lg:flex-row lg:items-end lg:justify-between">
            <FilterTabs<Filter>
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: 'all', label: 'All clients', count: customers.length },
                { value: 'outstanding', label: 'With balance', count: owing.length },
              ]}
            />
            <div className="flex flex-col gap-2 pb-3 md:flex-row md:items-center">
              <div className="segmented hidden self-start md:inline-flex md:self-auto" role="group" aria-label="Sort clients">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button" aria-pressed={samePreset(sort, p)} onClick={() => setSort({ key: p.key, dir: p.dir })}>
                    {p.label}
                  </button>
                ))}
              </div>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search name, company, email or phone"
                className="md:w-72 [&_input]:h-10 md:[&_input]:h-9"
              />
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
        )}

        {customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Add your first client"
            description="Save client details once, then pick them in seconds on any invoice or quotation. Balances and history build up here automatically."
            action={addButton}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No matching clients"
            description={q ? `Nothing matches “${search.trim()}”. Try a name, company, email or phone number.` : 'No clients have an outstanding balance.'}
            action={
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <MobileList label="Clients">
              {filtered.map(({ c, label, stats }) => (
                <MobileRow
                  key={c.id}
                  onOpen={() => openClient(c.id)}
                  avatarName={label}
                  title={label}
                  subtitle={(c.company && c.name ? c.name : c.email || c.phone) || 'No contact details'}
                  amount={stats.outstanding > 0 ? formatCurrency(stats.outstanding, cur) : 'Paid up'}
                  amountClassName={stats.outstanding <= 0 ? 'font-medium text-slate-400' : stats.overdue > 0 ? 'text-rose-700' : 'text-amber-700'}
                  hint={
                    stats.overdue > 0 ? (
                      <span className="font-medium text-rose-600">{formatCurrency(stats.overdue, cur)} overdue</span>
                    ) : (
                      <span className="text-slate-400">{plural(stats.invoiceCount, 'invoice')}</span>
                    )
                  }
                  actions={<RowActions size="lg" label={`Actions for ${label}`} actions={actionsFor(c)} />}
                  selecting={sel.selecting}
                  selected={sel.isSelected(c.id)}
                  onToggle={() => sel.toggle(c.id)}
                  selectLabel={`Select ${label}`}
                />
              ))}
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
                        label={sel.allSelected ? 'Deselect all' : `Select all ${plural(filtered.length, 'client')}`}
                      />
                    </th>
                    <SortHeader label="Client" sortKey="name" sort={sort} onSort={toggleSort} />
                    <th scope="col" className="hidden lg:table-cell">Contact</th>
                    <SortHeader label="Invoices" sortKey="invoices" sort={sort} onSort={toggleSort} align="right" />
                    <SortHeader label="Billed" sortKey="billed" sort={sort} onSort={toggleSort} align="right" />
                    <SortHeader label="Outstanding" sortKey="outstanding" sort={sort} onSort={toggleSort} align="right" />
                    <SortHeader label="Last activity" sortKey="activity" sort={sort} onSort={toggleSort} className="hidden xl:table-cell" />
                    <th className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ c, label, stats }) => {
                    const isSel = sel.isSelected(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={`cursor-pointer ${isSel ? 'bg-primary-50/60 hover:bg-primary-50' : ''}`}
                        onClick={() => openClient(c.id)}
                      >
                        <SelectCell checked={isSel} label={`Select ${label}`} onToggle={(range) => sel.toggle(c.id, range)} />
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={label} size="sm" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openClient(c.id);
                                }}
                                className="block max-w-[260px] truncate text-left font-medium text-slate-900 hover:text-primary-700 focus-visible:text-primary-700 focus-visible:outline-none"
                              >
                                {label}
                              </button>
                              {c.company && c.name && <p className="max-w-[260px] truncate text-xs text-slate-500">{c.name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell">
                          {c.email || c.phone ? (
                            <div className="min-w-0">
                              {c.email && <p className="max-w-[240px] truncate text-slate-700">{c.email}</p>}
                              {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="text-right tabular">
                          <span className={stats.invoiceCount ? 'text-slate-700' : 'text-slate-400'}>{stats.invoiceCount}</span>
                        </td>
                        <td className="whitespace-nowrap text-right tabular">
                          <span className={stats.billed > 0 ? 'text-slate-700' : 'text-slate-400'}>{formatCurrency(stats.billed, cur)}</span>
                        </td>
                        <td className="whitespace-nowrap text-right tabular">
                          {stats.outstanding > 0 ? (
                            <>
                              <span
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold ${
                                  stats.overdue > 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {formatCurrency(stats.outstanding, cur)}
                              </span>
                              {stats.overdue > 0 && (
                                <p className="mt-0.5 text-xs font-medium text-rose-600">{formatCurrency(stats.overdue, cur)} overdue</p>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">{formatCurrency(0, cur)}</span>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap text-slate-600 xl:table-cell">
                          {stats.lastActivity ? formatDate(stats.lastActivity) : <span className="text-slate-400">No documents</span>}
                        </td>
                        <td className="text-right">
                          <RowActions label={`Actions for ${label}`} actions={actionsFor(c)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              {filtered.length === customers.length
                ? plural(customers.length, 'client')
                : `Showing ${filtered.length} of ${plural(customers.length, 'client')}`}
            </div>
          </>
        )}
      </div>

      {(sel.count > 0 || sel.selecting) && (
        <BulkBar
          count={sel.count}
          total={filtered.length}
          noun="client"
          onSelectAll={sel.selectAll}
          onClear={sel.clear}
          onExport={() => exportRows(sel.count > 0 ? selectedRows : filtered)}
          onDelete={canDelete ? () => setBulkDeleteIds(sel.selectedIds) : undefined}
        />
      )}

      {selected && (
        <ClientDrawer
          key={selected.id}
          client={selected}
          stats={statsFor(selected.id)}
          documents={selectedDocs}
          currencySymbol={cur}
          canManage={canManage}
          canDelete={canDelete}
          canCreateDocs={canCreateDocs}
          suspendEscape={editing !== undefined || deleteTarget !== null || bulkDeleteIds !== null}
          onClose={closeClient}
          onEdit={() => setEditing(selected)}
          onDelete={() => setDeleteTarget(selected)}
          onNewInvoice={() => newInvoice(selected)}
          onNewQuotation={() => newQuotation(selected)}
        />
      )}

      {editing !== undefined && (
        <CustomerFormModal
          key={editing ? editing.id : 'new'}
          client={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(c, created) => {
            setEditing(undefined);
            if (created) openClient(c.id);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteTarget ? clientLabel(deleteTarget) : 'client'}?`}
        message={deleteMessage}
        confirmLabel="Delete client"
      />
      <ConfirmModal
        isOpen={!!bulkDeleteIds}
        onClose={() => setBulkDeleteIds(null)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'client')}?`}
        message={bulkDeleteMessage}
        confirmLabel={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'client')}`}
      />
    </div>
  );
};
