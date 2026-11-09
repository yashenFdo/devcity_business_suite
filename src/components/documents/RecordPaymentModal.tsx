import React, { useState } from 'react';
import { Receipt as ReceiptIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { Invoice, PaymentMethod } from '../../types';
import { Modal } from '../ui/Modal';
import { Field } from './editor/FormSection';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { formatCurrency, today } from '../../utils/formatters';
import { PAYMENT_METHOD_OPTIONS } from './paymentMethods';

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
}

/** Records a payment against an invoice and issues a linked receipt. */
export const RecordPaymentModal: React.FC<Props> = ({ invoice, onClose }) => {
  if (!invoice) return null;
  return <PaymentForm key={invoice.id} invoice={invoice} onClose={onClose} />;
};

const PaymentForm: React.FC<{ invoice: Invoice; onClose: () => void }> = ({ invoice, onClose }) => {
  const navigate = useNavigate();
  const markAsPaid = useInvoicesStore((s) => s.markAsPaid);
  const addReceipt = useReceiptsStore((s) => s.addReceipt);
  const company = useCompanyStore((s) => s.company);
  const [amount, setAmount] = useState(String(invoice.balanceDue));
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>(invoice.paymentMethod || 'bank_transfer');
  const [reference, setReference] = useState('');

  const value = parseFloat(amount);
  const error =
    !Number.isFinite(value) || value <= 0
      ? 'Enter an amount greater than zero.'
      : value > invoice.balanceDue + 0.005
        ? `Amount exceeds the balance due (${formatCurrency(invoice.balanceDue, invoice.currencySymbol)}).`
        : '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    const paid = Math.round(value * 100) / 100;
    markAsPaid(invoice.id, paid);
    const receipt = addReceipt({
      date,
      customer: invoice.customer,
      linkedInvoiceId: invoice.id,
      linkedInvoiceNumber: invoice.invoiceNumber,
      amount: paid,
      invoiceTotal: invoice.total,
      remainingBalance: Math.max(0, Math.round((invoice.balanceDue - paid) * 100) / 100),
      paymentMethod: method,
      referenceNumber: reference.trim() || undefined,
      currency: invoice.currency,
      currencySymbol: invoice.currencySymbol,
      templateId: invoice.templateId,
      notes: `Payment received against invoice ${invoice.invoiceNumber}. Thank you.`,
      companySnapshot: company,
    });
    toast.success(
      (t) => (
        <span className="text-[13px]">
          Payment recorded · receipt <b className="font-mono">{receipt.receiptNumber}</b> issued.{' '}
          <button
            type="button"
            className="font-semibold text-primary-600 hover:underline"
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/receipts/${receipt.id}`);
            }}
          >
            View
          </button>
        </span>
      ),
      { duration: 6000 }
    );
    onClose();
  };

  const remaining = Math.max(0, invoice.balanceDue - (Number.isFinite(value) ? value : 0));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record payment"
      description={`${invoice.invoiceNumber} · ${invoice.customer.company || invoice.customer.name}`}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3.5 text-center ring-1 ring-slate-200/70">
          <div>
            <p className="text-[11px] text-slate-500">Invoice total</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular">{formatCurrency(invoice.total, invoice.currencySymbol)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Paid so far</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-700 tabular">
              {formatCurrency(invoice.amountPaid || 0, invoice.currencySymbol)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Balance due</p>
            <p className="mt-0.5 text-sm font-semibold text-primary-700 tabular">
              {formatCurrency(invoice.balanceDue, invoice.currencySymbol)}
            </p>
          </div>
        </div>

        <Field label="Amount received" required error={amount ? error : ''}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              {invoice.currencySymbol}
            </span>
            <input
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
                onClick={() => setAmount(String(Math.round(invoice.balanceDue * f * 100) / 100))}
              >
                {f === 1 ? 'Full balance' : '50%'}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Method">
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Transaction reference" hint="Bank reference, Stripe charge ID or cheque number (optional)">
          <input className="input font-mono" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>

        <p className="text-xs text-slate-500">
          {remaining > 0
            ? `${formatCurrency(remaining, invoice.currencySymbol)} will remain outstanding. The invoice will be marked as partially paid.`
            : 'The invoice will be marked as paid in full.'}
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-success" disabled={!!error}>
            <ReceiptIcon size={15} /> Record & issue receipt
          </button>
        </div>
      </form>
    </Modal>
  );
};
