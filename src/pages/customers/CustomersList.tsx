import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, FilePlus2, FileSignature, Pencil, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCustomersStore } from '../../store/useCustomersStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { PermissionError, useCan } from '../../security/sessionState';
import { PageHeader } from '../../components/ui/PageHeader';
import { FilterTabs, MetricTile, SearchInput } from '../../components/ui/ListControls';
import { RowActions } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import type { Customer } from '../../types';
import { formatCurrency, formatDate, today } from '../../utils/formatters';
import { CustomerFormModal } from './CustomerFormModal';
import { ClientDrawer } from './ClientDrawer';
import { EMPTY_STATS, buildClientStats, clientDocuments, clientLabel, createClientResolver, type ClientStats } from './clientStats';

type Filter = 'all' | 'outstanding';
type Sort = 'name' | 'recent' | 'balance';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'recent', label: 'Recent' },
  { value: 'balance', label: 'Balance' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const CustomersList: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const customers = useCustomersStore((s) => s.customers);
  const deleteCustomer = useCustomersStore((s) => s.deleteCustomer);
  const invoices = useInvoicesStore((s) => s.invoices);
  const quotations = useQuotationsStore((s) => s.quotations);
  const receipts = useReceiptsStore((s) => s.receipts);
  const cur = useCompanyStore((s) => s.company.currencySymbol);

  const canManage = useCan('customers.manage');
  const canDelete = useCan('customers.delete');
  const canCreateDocs = useCan('documents.create');

  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');
  // undefined = closed, null = new client, Customer = editing
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

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

  const rows = useMemo(
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
  const filtered = rows
    .filter(({ c, stats }) => {
      if (filter === 'outstanding' && stats.outstanding <= 0) return false;
      if (!q) return true;
      const hay = `${c.name} ${c.company} ${c.email} ${c.phone}`.toLowerCase();
      if (hay.includes(q)) return true;
      return qDigits.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(qDigits);
    })
    .sort((a, b) => {
      if (sort === 'recent') {
        const la = a.stats.lastActivity ?? a.c.createdAt ?? '';
        const lb = b.stats.lastActivity ?? b.c.createdAt ?? '';
        if (la !== lb) return lb.localeCompare(la);
      } else if (sort === 'balance' && a.stats.outstanding !== b.stats.outstanding) {
        return b.stats.outstanding - a.stats.outstanding;
      }
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });

  const selected = selectedId ? customers.find((c) => c.id === selectedId) : undefined;
  const selectedDocs = useMemo(
    () => (selected ? clientDocuments(selected.id, resolve, invoices, quotations, receipts) : []),
    [selected, resolve, invoices, quotations, receipts]
  );

  const newInvoice = (c: Customer) => navigate('/invoices/new', { state: { customerId: c.id } });
  const newQuotation = (c: Customer) => navigate('/quotations/new', { state: { customerId: c.id } });

  const confirmDelete = () => {
    if (!deleteTarget) return;
    try {
      deleteCustomer(deleteTarget.id);
      if (selectedId === deleteTarget.id) closeClient();
      toast.success(`${clientLabel(deleteTarget)} deleted`);
    } catch (err) {
      if (!(err instanceof PermissionError)) toast.error('Could not delete the client.');
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
        actions={addButton}
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

      <div className="card overflow-hidden">
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
            <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center">
              <div className="segmented self-start sm:self-auto" role="group" aria-label="Sort clients">
                {SORTS.map((s) => (
                  <button key={s.value} type="button" aria-pressed={sort === s.value} onClick={() => setSort(s.value)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Search name, company, email or phone" className="sm:w-72" />
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
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th className="hidden md:table-cell">Contact</th>
                    <th className="text-right">Invoices</th>
                    <th className="hidden text-right sm:table-cell">Billed</th>
                    <th className="text-right">Outstanding</th>
                    <th className="hidden xl:table-cell">Last activity</th>
                    <th className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ c, label, stats }) => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => openClient(c.id)}>
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
                      <td className="hidden md:table-cell">
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
                      <td className="hidden whitespace-nowrap text-right tabular sm:table-cell">
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
                        <RowActions
                          label={`Actions for ${label}`}
                          actions={[
                            { label: 'View details', icon: Eye, onClick: () => openClient(c.id) },
                            { label: 'New invoice', icon: FilePlus2, hidden: !canCreateDocs, onClick: () => newInvoice(c) },
                            { label: 'New quotation', icon: FileSignature, hidden: !canCreateDocs, onClick: () => newQuotation(c) },
                            { label: 'Edit', icon: Pencil, hidden: !canManage, onClick: () => setEditing(c) },
                            { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteTarget(c) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
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
          suspendEscape={editing !== undefined || deleteTarget !== null}
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
    </div>
  );
};
