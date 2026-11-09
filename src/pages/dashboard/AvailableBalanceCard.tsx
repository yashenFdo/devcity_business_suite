import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Info, Landmark, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompanyStore } from '../../store/useCompanyStore';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useBillsStore } from '../../store/useBillsStore';
import { useCan } from '../../security/sessionState';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/documents/editor/FormSection';
import { cashPosition } from '../../utils/cash';
import { formatCurrency, formatDate, today } from '../../utils/formatters';

const OpeningBalanceModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const company = useCompanyStore((s) => s.company);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const [amount, setAmount] = useState(String(company.openingBalance ?? ''));
  const [date, setDate] = useState(company.openingBalanceDate || today());
  const value = parseFloat(amount);
  const valid = amount.trim() !== '' && Number.isFinite(value) && !!date;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Opening balance"
      description="How much money the company had in the bank on a start date. Receipts and bill payments from that date onwards are added and subtracted automatically."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          updateCompany({ openingBalance: Math.round(value * 100) / 100, openingBalanceDate: date });
          toast.success('Opening balance saved');
          onClose();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Amount (${company.currency})`} required>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{company.currencySymbol}</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                autoFocus
                className="input h-10 pl-10 font-semibold tabular"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </Field>
          <Field label="As of date" required>
            <input type="date" className="input h-10" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <p className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
          Tip: use your bank statement balance at the end of a day, and pick that date. Anything recorded before it is ignored, so nothing
          is counted twice.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!valid}>
            Save opening balance
          </button>
        </div>
      </form>
    </Modal>
  );
};

/** Hero card: the company's current available money. */
export const AvailableBalanceCard: React.FC = () => {
  const company = useCompanyStore((s) => s.company);
  const receipts = useReceiptsStore((s) => s.receipts);
  const bills = useBillsStore((s) => s.bills);
  const isAdmin = useCan('settings.manage');
  const [editing, setEditing] = useState(false);

  const cash = useMemo(() => cashPosition(company, receipts, bills), [company, receipts, bills]);
  const sym = company.currencySymbol;
  const hasOpening = company.openingBalance !== undefined;
  const negative = cash.available < 0;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-ink text-white shadow-card">
      <div className="bg-grid absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-600/30 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-slate-300">
            <Landmark size={15} className="text-primary-300" /> Available balance
          </p>
          <p className={`mt-2 text-[34px] font-semibold leading-none tracking-tight tabular ${negative ? 'text-rose-300' : 'text-white'}`}>
            {negative ? '−' : ''}
            {formatCurrency(Math.abs(cash.available), sym)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {hasOpening && cash.since ? `Since ${formatDate(cash.since)} · ` : ''}
            Based on payments received and bills paid in DevCity
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-white/10">
            <p className="text-[11px] text-slate-400">Opening</p>
            <p className="mt-1 text-sm font-semibold tabular">{formatCurrency(cash.opening, sym)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-white/10">
            <p className="flex items-center gap-1 text-[11px] text-slate-400">
              <ArrowDownLeft size={12} className="text-emerald-300" /> Received
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-300 tabular">+{formatCurrency(cash.received, sym)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-white/10">
            <p className="flex items-center gap-1 text-[11px] text-slate-400">
              <ArrowUpRight size={12} className="text-orange-300" /> Paid out
            </p>
            <p className="mt-1 text-sm font-semibold text-orange-300 tabular">−{formatCurrency(cash.paidOut, sym)}</p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-sm self-start bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20 lg:self-center"
          >
            <Pencil size={14} /> {hasOpening ? 'Edit opening balance' : 'Set opening balance'}
          </button>
        )}
      </div>
      {!hasOpening && isAdmin && (
        <div className="relative border-t border-white/10 bg-white/[0.04] px-6 py-2.5 text-xs text-slate-300 lg:px-7">
          Set your opening bank balance once so this shows the real amount available.
        </div>
      )}
      {editing && <OpeningBalanceModal open onClose={() => setEditing(false)} />}
    </section>
  );
};
