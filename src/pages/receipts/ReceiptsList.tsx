import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, Eye, Pencil, Plus, Receipt as ReceiptIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { PermissionError, useCan } from '../../security/sessionState';
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
import { sortRows, useSortable, type SortAccessors } from '../../components/ui/table/useSortable';
import { useSelection } from '../../components/ui/table/useSelection';
import { paymentMethodLabel } from '../../components/documents/paymentMethods';
import type { Receipt } from '../../types';
import { formatCurrency, formatDate, today } from '../../utils/formatters';

type Filter = 'all' | 'month' | 'linked' | 'standalone';
type SortKey = 'number' | 'client' | 'invoice' | 'date' | 'method' | 'amount';

const SORT_KEYS: readonly SortKey[] = ['number', 'client', 'invoice', 'date', 'method', 'amount'];
const payerName = (r: Receipt) => r.customer.company || r.customer.name;

const ACCESSORS: SortAccessors<Receipt, SortKey> = {
  number: (r) => r.receiptNumber,
  client: (r) => payerName(r),
  invoice: (r) => r.linkedInvoiceNumber,
  date: (r) => r.date,
  method: (r) => paymentMethodLabel(r.paymentMethod),
  amount: (r) => r.amount,
};
const newestFirst = (a: Receipt, b: Receipt) => b.createdAt.localeCompare(a.createdAt);

const MOBILE_SORTS: readonly SortOption<SortKey>[] = [
  { key: 'date', dir: 'desc', label: 'Newest first' },
  { key: 'date', dir: 'asc', label: 'Oldest first' },
  { key: 'amount', dir: 'desc', label: 'Largest amount' },
  { key: 'client', dir: 'asc', label: 'Client A–Z' },
];

const CSV_COLUMNS: readonly CsvColumn<Receipt>[] = [
  { header: 'Receipt number', value: (r) => r.receiptNumber },
  { header: 'Received from', value: (r) => r.customer.name },
  { header: 'Company', value: (r) => r.customer.company },
  { header: 'Date', value: (r) => r.date },
  { header: 'Invoice', value: (r) => r.linkedInvoiceNumber },
  { header: 'Payment method', value: (r) => paymentMethodLabel(r.paymentMethod) },
  { header: 'Reference', value: (r) => r.referenceNumber },
  { header: 'Currency', value: (r) => r.currency },
  { header: 'Amount', value: (r) => csvMoney(r.amount) },
];

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
  const { deleteReceipt, deleteReceipts, duplicateReceipt } = useReceiptsStore.getState();
  const company = useCompanyStore((s) => s.company);
  const canEdit = useCan('documents.edit');
  const canDelete = useCan('documents.delete');
  const canPay = useCan('payments.record');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  const { sort, setSort, toggle: toggleSort } = useSortable<SortKey>({
    storageKey: 'devcity:sort:receipts',
    keys: SORT_KEYS,
    initial: { key: 'date', dir: 'desc' },
    descFirst: ['date', 'amount'],
  });

  const rows = receipts;
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
  const filtered = sortRows(
    rows.filter(
      (r) =>
        matchesFilter(r, filter, monthPrefix) &&
        (!q ||
          `${r.receiptNumber} ${r.customer.name} ${r.customer.company} ${r.linkedInvoiceNumber ?? ''} ${r.referenceNumber ?? ''}`
            .toLowerCase()
            .includes(q))
    ),
    sort,
    ACCESSORS,
    newestFirst
  );

  const sel = useSelection(filtered.map((r) => r.id));
  const selectedRows = filtered.filter((r) => sel.isSelected(r.id));

  const exportRows = (list: Receipt[]) => exportCsv({ name: 'receipts', noun: 'receipt', rows: list, columns: CSV_COLUMNS });

  const duplicate = (r: Receipt) => {
    const dup = duplicateReceipt(r.id);
    if (dup) {
      toast.success(`Duplicated as ${dup.receiptNumber}`);
      navigate(canEdit ? `/receipts/${dup.id}/edit` : `/receipts/${dup.id}`);
    }
  };

  const actionsFor = (r: Receipt): RowAction[] => [
    { label: 'View', icon: Eye, onClick: () => navigate(`/receipts/${r.id}`) },
    { label: 'Edit', icon: Pencil, hidden: !canEdit, onClick: () => navigate(`/receipts/${r.id}/edit`) },
    // Duplicating a linked receipt would claim a payment the invoice never received.
    { label: 'Duplicate', icon: Copy, hidden: !canPay || !!r.linkedInvoiceId, onClick: () => duplicate(r) },
    { label: 'Delete', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => setDeleteTarget(r) },
  ];

  const confirmBulkDelete = () => {
    if (!bulkDeleteIds) return;
    try {
      deleteReceipts(bulkDeleteIds);
      sel.clear();
    } catch (err) {
      if (!(err instanceof PermissionError)) toast.error('Could not delete the receipts.');
    }
  };

  const linkedInSelection = bulkDeleteIds ? receipts.filter((r) => bulkDeleteIds.includes(r.id) && r.linkedInvoiceId).length : 0;

  const newButton = canPay && (
    <Link to="/receipts/new" className="btn-primary">
      <Plus size={16} /> New receipt
    </Link>
  );

  return (
    <div className="page">
      <PageHeader
        title="Receipts"
        description="Payments received from clients, each with an official receipt."
        actions={
          <>
            {receipts.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => exportRows(filtered)} title="Export the current list to CSV">
                <Download size={16} /> Export
              </button>
            )}
            {newButton}
          </>
        }
      />

      {receipts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Received this month"
            value={formatCurrency(sum(thisMonth), cur)}
            hint={plural(thisMonth.length, 'payment')}
            tone="success"
            onClick={() => setFilter('month')}
            active={filter === 'month'}
          />
          <MetricTile label="Received this year" value={formatCurrency(sum(thisYear), cur)} hint={`${plural(thisYear.length, 'payment')} in ${yearPrefix}`} />
          <MetricTile label="Receipts issued" value={String(receipts.length)} hint={`${linkedCount} linked to invoices`} />
          <MetricTile label="Average payment" value={formatCurrency(average, cur)} hint={`In ${company.currency}`} />
        </div>
      )}

      <div className="card md:overflow-hidden">
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
          <div className="flex flex-col gap-2 pb-3 md:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search receipt, client, invoice or reference"
              className="[&_input]:h-10 md:[&_input]:h-9"
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
          <>
            <MobileList label="Receipts">
              {filtered.map((r) => (
                <MobileRow
                  key={r.id}
                  to={`/receipts/${r.id}`}
                  mono
                  title={r.receiptNumber}
                  badge={
                    r.linkedInvoiceNumber ? (
                      <span className="badge border-primary-100 bg-primary-50 font-mono text-primary-700">{r.linkedInvoiceNumber}</span>
                    ) : undefined
                  }
                  subtitle={payerName(r) || '—'}
                  amount={formatCurrency(r.amount, r.currencySymbol || cur)}
                  amountClassName="text-emerald-700"
                  hint={
                    <span className="text-slate-400">
                      {formatDate(r.date, 'dd MMM')} · {paymentMethodLabel(r.paymentMethod)}
                    </span>
                  }
                  actions={<RowActions size="lg" label={`Actions for ${r.receiptNumber}`} actions={actionsFor(r)} />}
                  selecting={sel.selecting}
                  selected={sel.isSelected(r.id)}
                  onToggle={() => sel.toggle(r.id)}
                  selectLabel={`Select ${r.receiptNumber}`}
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
                        label={sel.allSelected ? 'Deselect all' : `Select all ${plural(filtered.length, 'receipt')}`}
                      />
                    </th>
                    <SortHeader label="Receipt" sortKey="number" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Received from" sortKey="client" sort={sort} onSort={toggleSort} />
                    <SortHeader label="For invoice" sortKey="invoice" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Date" sortKey="date" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Method" sortKey="method" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Amount" sortKey="amount" sort={sort} onSort={toggleSort} align="right" />
                    <th className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const payer = payerName(r);
                    const selected = sel.isSelected(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={`cursor-pointer ${selected ? 'bg-primary-50/60 hover:bg-primary-50' : ''}`}
                        onClick={() => navigate(`/receipts/${r.id}`)}
                      >
                        <SelectCell checked={selected} label={`Select ${r.receiptNumber}`} onToggle={(range) => sel.toggle(r.id, range)} />
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
                          <RowActions label={`Actions for ${r.receiptNumber}`} actions={actionsFor(r)} />
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
          noun="receipt"
          onSelectAll={sel.selectAll}
          onClear={sel.clear}
          onExport={() => exportRows(sel.count > 0 ? selectedRows : filtered)}
          onDelete={canDelete ? () => setBulkDeleteIds(sel.selectedIds) : undefined}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteReceipt(deleteTarget.id);
        }}
        title={`Delete ${deleteTarget?.receiptNumber ?? 'receipt'}?`}
        message={
          deleteTarget?.linkedInvoiceNumber
            ? `This removes the receipt. The payment stays recorded on ${deleteTarget.linkedInvoiceNumber}. You can undo this for a few seconds afterwards.`
            : 'This removes the receipt. You can undo this for a few seconds afterwards.'
        }
        confirmLabel="Delete receipt"
      />
      <ConfirmModal
        isOpen={!!bulkDeleteIds}
        onClose={() => setBulkDeleteIds(null)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'receipt')}?`}
        message={`The selected receipts will be removed.${
          linkedInSelection > 0 ? ' Payments stay recorded on their linked invoices.' : ''
        } You can undo this for a few seconds afterwards.`}
        confirmLabel={`Delete ${plural(bulkDeleteIds?.length ?? 0, 'receipt')}`}
      />
    </div>
  );
};
