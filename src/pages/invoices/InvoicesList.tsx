import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Eye, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
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
import { RecordPaymentModal } from '../../components/documents/RecordPaymentModal';
import type { Invoice } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { dueLabel, effectiveInvoiceStatus } from '../../utils/insights';

type Filter = 'all' | 'draft' | 'outstanding' | 'overdue' | 'paid';

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

export const InvoicesList: React.FC = () => {
  const navigate = useNavigate();
  const invoices = useInvoicesStore((s) => s.invoices);
  const { deleteInvoice, duplicateInvoice } = useInvoicesStore.getState();
  const company = useCompanyStore((s) => s.company);
  const canCreate = useCan('documents.create');
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const rows = useMemo(
    () =>
      invoices
        .map((inv) => ({ inv, status: effectiveInvoiceStatus(inv) }))
        .sort((a, b) => b.inv.date.localeCompare(a.inv.date) || b.inv.createdAt.localeCompare(a.inv.createdAt)),
    [invoices]
  );

  const cur = company.currencySymbol;
  const live = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'draft');
  const outstanding = live.reduce((s, r) => s + (r.inv.balanceDue || 0), 0);
  const overdueRows = rows.filter((r) => r.status === 'overdue');
  const overdue = overdueRows.reduce((s, r) => s + (r.inv.balanceDue || 0), 0);
  const collected = live.reduce((s, r) => s + (r.inv.amountPaid || 0), 0);

  const count = (f: Filter) => rows.filter((r) => matchesFilter(r.status, f)).length;
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    ({ inv, status }) =>
      matchesFilter(status, filter) &&
      (!q ||
        `${inv.invoiceNumber} ${inv.customer.name} ${inv.customer.company} ${inv.projectDescription ?? ''}`
          .toLowerCase()
          .includes(q))
  );

  return (
    <div className="page">
      <PageHeader
        title="Invoices"
        description="Bill clients, track what's owed and record payments."
        actions={
          canCreate && (
            <Link to="/invoices/new" className="btn-primary">
              <Plus size={16} /> New invoice
            </Link>
          )
        }
      />

      {invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="Outstanding" value={formatCurrency(outstanding, cur)} hint={`${count('outstanding')} open invoices`} onClick={() => setFilter('outstanding')} active={filter === 'outstanding'} />
          <MetricTile label="Overdue" value={formatCurrency(overdue, cur)} hint={`${overdueRows.length} invoices`} tone={overdue > 0 ? 'danger' : 'default'} onClick={() => setFilter('overdue')} active={filter === 'overdue'} />
          <MetricTile label="Collected" value={formatCurrency(collected, cur)} hint="Across all invoices" tone="success" onClick={() => setFilter('paid')} active={filter === 'paid'} />
          <MetricTile label="Drafts" value={String(count('draft'))} hint="Not yet sent" onClick={() => setFilter('draft')} active={filter === 'draft'} />
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
              { value: 'outstanding', label: 'Outstanding', count: count('outstanding') },
              { value: 'overdue', label: 'Overdue', count: count('overdue') },
              { value: 'paid', label: 'Paid', count: count('paid') },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Search number, client or project" className="pb-3 md:w-72" />
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ inv, status }) => {
                  const due = dueLabel(inv.dueDate);
                  const showDue = inv.balanceDue > 0 && status !== 'draft' && status !== 'cancelled';
                  const sym = inv.currencySymbol || cur;
                  return (
                    <tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
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
                          <Avatar name={inv.customer.company || inv.customer.name || '?'} size="xs" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{inv.customer.company || inv.customer.name}</p>
                            {inv.customer.company && <p className="truncate text-xs text-slate-500">{inv.customer.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{formatDate(inv.date)}</td>
                      <td className="whitespace-nowrap">
                        <p className="text-slate-600">{formatDate(inv.dueDate)}</p>
                        {showDue && (
                          <p className={`text-xs ${due.tone === 'danger' ? 'font-medium text-rose-600' : due.tone === 'warning' ? 'text-amber-600' : 'text-slate-400'}`}>
                            {due.text}
                          </p>
                        )}
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
                        <RowActions
                          actions={[
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

      <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteInvoice(deleteTarget.id);
          toast.success(`${deleteTarget.invoiceNumber} deleted`);
        }}
        title={`Delete ${deleteTarget?.invoiceNumber ?? 'invoice'}?`}
        message="This permanently removes the invoice. Linked receipts are kept. This cannot be undone."
        confirmLabel="Delete invoice"
      />
    </div>
  );
};
