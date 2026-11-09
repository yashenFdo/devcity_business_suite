import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, CheckCircle2, Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBillsStore } from '../../store/useBillsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { useCan } from '../../security/sessionState';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { RowActions } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { FilterTabs, MetricTile, SearchInput } from '../../components/ui/ListControls';
import type { Bill } from '../../types';
import { formatCurrency, formatDate, today } from '../../utils/formatters';
import { dueLabel, effectiveBillStatus } from '../../utils/insights';
import { BillPaymentModal } from './BillPaymentModal';

type Filter = 'all' | 'draft' | 'unpaid' | 'overdue' | 'paid';

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

export const BillsList: React.FC = () => {
  const navigate = useNavigate();
  const bills = useBillsStore((s) => s.bills);
  const { deleteBill, duplicateBill } = useBillsStore.getState();
  const company = useCompanyStore((s) => s.company);
  const canCreate = useCan('documents.create');
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);

  const rows = useMemo(
    () =>
      bills
        .map((bill) => ({ bill, status: effectiveBillStatus(bill) }))
        .sort((a, b) => b.bill.date.localeCompare(a.bill.date) || b.bill.createdAt.localeCompare(a.bill.createdAt)),
    [bills]
  );

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
  const filtered = rows.filter(
    ({ bill, status }) =>
      matchesFilter(status, filter) &&
      (!q ||
        `${bill.billNumber} ${bill.vendorName} ${bill.vendorEmail} ${bill.notes ?? ''} ${bill.lineItems
          .map((i) => i.description)
          .join(' ')}`
          .toLowerCase()
          .includes(q))
  );

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
        actions={newBillLink}
      />

      {bills.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Unpaid"
            value={formatCurrency(unpaid, cur)}
            hint={`${unpaidRows.length} ${unpaidRows.length === 1 ? 'bill' : 'bills'} to pay`}
            tone={unpaid > 0 ? 'warning' : 'default'}
            onClick={() => setFilter('unpaid')}
            active={filter === 'unpaid'}
          />
          <MetricTile
            label="Overdue"
            value={formatCurrency(overdue, cur)}
            hint={`${overdueRows.length} ${overdueRows.length === 1 ? 'bill' : 'bills'}`}
            tone={overdue > 0 ? 'danger' : 'default'}
            onClick={() => setFilter('overdue')}
            active={filter === 'overdue'}
          />
          <MetricTile
            label="Paid this month"
            value={formatCurrency(paidThisMonth, cur)}
            hint={`${paidThisMonthRows.length} ${paidThisMonthRows.length === 1 ? 'payment' : 'payments'}`}
            tone="success"
            onClick={() => setFilter('paid')}
            active={filter === 'paid'}
          />
          <MetricTile
            label="Total this year"
            value={formatCurrency(totalYear, cur)}
            hint={`${yearRows.length} ${yearRows.length === 1 ? 'bill' : 'bills'} in ${year}`}
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
              { value: 'unpaid', label: 'Unpaid', count: count('unpaid') },
              { value: 'overdue', label: 'Overdue', count: count('overdue') },
              { value: 'paid', label: 'Paid', count: count('paid') },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Search number, vendor or item" className="pb-3 md:w-72" />
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Vendor</th>
                  <th>Bill date</th>
                  <th>Due</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
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
                  const payable = canPay && canEdit && bill.balanceDue > 0 && status !== 'cancelled';
                  return (
                    <tr key={bill.id} className="cursor-pointer" onClick={() => navigate(`/bills/${bill.id}`)}>
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
                          <p
                            className={`text-xs ${
                              due.tone === 'danger' ? 'font-medium text-rose-600' : due.tone === 'warning' ? 'text-amber-600' : 'text-slate-400'
                            }`}
                          >
                            {due.text}
                          </p>
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
                        <RowActions
                          actions={[
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

      <BillPaymentModal bill={paying} onClose={() => setPaying(null)} />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteBill(deleteTarget.id);
        }}
        title={`Delete ${deleteTarget?.billNumber ?? 'bill'}?`}
        message="This permanently removes the bill and its payment record. This cannot be undone."
        confirmLabel="Delete bill"
      />
    </div>
  );
};
