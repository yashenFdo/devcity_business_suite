import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Bill, PaymentMethod } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/documents/editor/FormSection';
import { PAYMENT_METHOD_OPTIONS } from '../../components/documents/paymentMethods';
import { useBillsStore } from '../../store/useBillsStore';
import { formatCurrency, today } from '../../utils/formatters';

interface Props {
  bill: Bill | null;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Records a full or partial payment made to a vendor against a bill. */
export const BillPaymentModal: React.FC<Props> = ({ bill, onClose }) => {
  if (!bill) return null;
  return <PaymentForm key={bill.id} bill={bill} onClose={onClose} />;
};

const PaymentForm: React.FC<{ bill: Bill; onClose: () => void }> = ({ bill, onClose }) => {
  const updateBill = useBillsStore((s) => s.updateBill);
  const cur = bill.currencySymbol || '$';
  const [amount, setAmount] = useState(String(bill.balanceDue));
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>(bill.paymentMethod || 'bank_transfer');

  const value = parseFloat(amount);
  const error =
    !Number.isFinite(value) || value <= 0
      ? 'Enter an amount greater than zero.'
      : value > bill.balanceDue + 0.005
        ? `Amount exceeds the balance due (${formatCurrency(bill.balanceDue, cur)}).`
        : '';
  const dateError = !date ? 'Choose the payment date.' : '';
  const remaining = Math.max(0, round2(bill.balanceDue - (Number.isFinite(value) ? value : 0)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error || dateError) return;
    const amountPaid = round2((bill.amountPaid || 0) + value);
    const balanceDue = Math.max(0, round2(bill.total - amountPaid));
    try {
      updateBill(bill.id, {
        amountPaid,
        balanceDue,
        status: balanceDue === 0 ? 'paid' : 'unpaid',
        paymentDate: date,
        paymentMethod: method,
      });
      toast.success(
        balanceDue === 0
          ? `${bill.billNumber} marked as paid`
          : `Payment recorded · ${formatCurrency(balanceDue, cur)} still owed`
      );
      onClose();
    } catch {
      // Store actions surface permission errors themselves.
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={bill.amountPaid > 0 ? 'Record payment' : 'Mark as paid'}
      description={`${bill.billNumber} · ${bill.vendorName || 'Vendor'}`}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3.5 text-center ring-1 ring-slate-200/70">
          <div>
            <p className="text-[11px] text-slate-500">Bill total</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular">{formatCurrency(bill.total, cur)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Paid so far</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-700 tabular">{formatCurrency(bill.amountPaid || 0, cur)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Balance due</p>
            <p className="mt-0.5 text-sm font-semibold text-primary-700 tabular">{formatCurrency(bill.balanceDue, cur)}</p>
          </div>
        </div>

        <Field label="Amount paid" htmlFor="bill-pay-amount" required error={amount ? error : ''}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{cur}</span>
            <input
              id="bill-pay-amount"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              autoFocus
              className={`input h-11 pl-10 text-base font-semibold tabular ${amount && error ? 'input-error' : ''}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            {[1, 0.5].map((f) => (
              <button
                key={f}
                type="button"
                className="btn-sm btn-secondary h-7"
                onClick={() => setAmount(String(round2(bill.balanceDue * f)))}
              >
                {f === 1 ? 'Full balance' : '50%'}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment date" htmlFor="bill-pay-date" error={dateError}>
            <input id="bill-pay-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Paid via" htmlFor="bill-pay-method">
            <select
              id="bill-pay-method"
              className="select"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-xs text-slate-500">
          {remaining > 0
            ? `${formatCurrency(remaining, cur)} will remain owed to ${bill.vendorName || 'the vendor'}. The bill stays unpaid.`
            : 'The bill will be marked as paid in full.'}
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-success" disabled={!!error || !!dateError}>
            <CheckCircle2 size={15} /> {remaining > 0 ? 'Record payment' : 'Mark as paid'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
