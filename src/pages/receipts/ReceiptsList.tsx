import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, Receipt as ReceiptIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { useCan } from '../../security/sessionState';
import { EmptyState } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { RowActions } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { FilterTabs, MetricTile, SearchInput } from '../../components/ui/ListControls';
import { paymentMethodLabel } from '../../components/documents/paymentMethods';
import type { Receipt } from '../../types';
import { formatCurrency, formatDate, today } from '../../utils/formatters';

type Filter = 'all' | 'month' | 'linked' | 'standalone';

const matchesFilter = (r: Receipt, f: Filter, monthPrefix: string) => {
  switch (f) {
    case 'all':
      return true;
    case 'month':
      return r.date.startsWith(monthPrefix);
    case 'linked':
      return !!r.linkedInvoiceId;
    case 'standalone':
      return !r.linkedInvoiceId;
  }
};

export const ReceiptsList: React.FC = () => {
  const navigate = useNavigate();
  const receipts = useReceiptsStore((s) => s.receipts);
  const { deleteReceipt, duplicateReceipt } = useReceiptsStore.getState();
  const company = useCompanyStore((s) => s.company);
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);

  const rows = useMemo(
    () => [...receipts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [receipts]
  );

  const now = today();
  const monthPrefix = now.slice(0, 7);
  const yearPrefix = now.slice(0, 4);
  const cur = company.currencySymbol;

  // Totals are in the company currency; receipts in other currencies are left out rather than mixed in.
  const base = rows.filter((r) => !r.currency || r.currency === company.currency);
  const sum = (list: Receipt[]) => list.reduce((s, r) => s + (r.amount || 0), 0);
  const thisMonth = base.filter((r) => r.date.startsWith(monthPrefix));
  const thisYear = base.filter((r) => r.date.startsWith(yearPrefix));
  const average = base.length ? sum(base) / base.length : 0;
  const linkedCount = rows.filter((r) => r.linkedInvoiceId).length;

  const count = (f: Filter) => rows.filter((r) => matchesFilter(r, f, monthPrefix)).length;
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      matchesFilter(r, filter, monthPrefix) &&
      (!q ||
        `${r.receiptNumber} ${r.customer.name} ${r.customer.company} ${r.linkedInvoiceNumber ?? ''} ${r.referenceNumber ?? ''}`
          .toLowerCase()
          .includes(q))
  );

  const duplicate = (r: Receipt) => {
    const dup = duplicateReceipt(r.id);
    if (dup) {
      toast.success(`Duplicated as ${dup.receiptNumber}`);
      navigate(canEdit ? `/receipts/${dup.id}/edit` : `/receipts/${dup.id}`);
    }
  };

  const newButton = canPay && (
    <Link to="/receipts/new" className="btn-primary">
      <Plus size={16} /> New receipt
    </Link>
  );

  return (
    <div className="page">
      <PageHeader title="Receipts" description="Payments received from clients, each with an official receipt." actions={newButton} />

      {receipts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Received this month"
            value={formatCurrency(sum(thisMonth), cur)}
            hint={`${thisMonth.length} payment${thisMonth.length === 1 ? '' : 's'}`}
            tone="success"
            onClick={() => setFilter('month')}
            active={filter === 'month'}
          />
          <MetricTile label="Received this year" value={formatCurrency(sum(thisYear), cur)} hint={`${thisYear.length} payments in ${yearPrefix}`} />
          <MetricTile label="Receipts issued" value={String(receipts.length)} hint={`${linkedCount} linked to invoices`} />
          <MetricTile label="Average payment" value={formatCurrency(average, cur)} hint={`In ${company.currency}`} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 pt-3 md:flex-row md:items-end md:justify-between">
          <FilterTabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'all', label: 'All', count: rows.length },
              { value: 'month', label: 'This month', count: count('month') },
              { value: 'linked', label: 'Linked to invoice', count: count('linked') },
              { value: 'standalone', label: 'Standalone', count: count('standalone') },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Search receipt, client, invoice or reference" className="pb-3 md:w-80" />
        </div>

        {filtered.length === 0 ? (
          receipts.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="No receipts yet"
              description="Receipts are issued automatically when you record a payment on an invoice. You can also record a payment here, with or without an invoice."
              action={newButton || undefined}
            />
          ) : (
            <EmptyState icon={ReceiptIcon} title="No matching receipts" description="Try a different search term or filter." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Received from</th>
                  <th>For invoice</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const payer = r.customer.company || r.customer.name;
                  return (
                    <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/receipts/${r.id}`)}>
                      <td>
                        <Link
                          to={`/receipts/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[13px] font-medium text-slate-900 hover:text-primary-700"
                        >
                          {r.receiptNumber}
                        </Link>
                        {r.referenceNumber && <p className="max-w-[200px] truncate font-mono text-xs text-slate-400">{r.referenceNumber}</p>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={payer || '?'} size="xs" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{payer}</p>
                            {r.customer.company && <p className="truncate text-xs text-slate-500">{r.customer.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {r.linkedInvoiceId ? (
                          <Link
                            to={`/invoices/${r.linkedInvoiceId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[13px] text-primary-700 hover:underline"
                          >
                            {r.linkedInvoiceNumber}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Standalone</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{formatDate(r.date)}</td>
                      <td className="whitespace-nowrap text-slate-600">{paymentMethodLabel(r.paymentMethod)}</td>
                      <td className="whitespace-nowrap text-right font-semibold text-emerald-700 tabular">
                        {formatCurrency(r.amount, r.currencySymbol || cur)}
                      </td>
                      <td className="text-right">
                        <RowActions
                          actions={[
                            { label: 'View', icon: Eye, onClick: () => navigate(`/receipts/${r.id}`) },
                            { label: 'Edit', icon: Pencil, hidden: !canEdit, onClick: () => navigate(`/receipts/${r.id}/edit`) },
                            // Duplicating a linked receipt would claim a payment the invoice never received.
                            { label: 'Duplicate', icon: Copy, hidden: !canPay || !!r.linkedInvoiceId, onClick: () => duplicate(r) },
                            { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteTarget(r) },
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
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteReceipt(deleteTarget.id);
          toast.success(`${deleteTarget.receiptNumber} deleted`);
        }}
        title={`Delete ${deleteTarget?.receiptNumber ?? 'receipt'}?`}
        message={
          deleteTarget?.linkedInvoiceNumber
            ? `This permanently removes the receipt. The payment stays recorded on ${deleteTarget.linkedInvoiceNumber}. This cannot be undone.`
            : 'This permanently removes the receipt. This cannot be undone.'
        }
        confirmLabel="Delete receipt"
      />
    </div>
  );
};
