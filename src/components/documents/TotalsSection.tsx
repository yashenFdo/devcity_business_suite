import React from 'react';
import type { DiscountType } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface TotalsSectionProps {
  subtotal: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount: number;
  discountPercent?: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  currencySymbol?: string;
  onDiscountTypeChange?: (type: DiscountType) => void;
  onDiscountValueChange?: (val: number) => void;
  onTaxChange?: (val: number) => void;
  readOnly?: boolean;
}

const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode; muted?: boolean }> = ({ label, value, muted }) => (
  <div className="flex min-h-[36px] items-center justify-between gap-4 text-[13px]">
    <div className="flex items-center gap-2 text-slate-600">{label}</div>
    <span className={`tabular ${muted ? 'text-slate-500' : 'font-medium text-slate-900'}`}>{value}</span>
  </div>
);

export const TotalsSection: React.FC<TotalsSectionProps> = ({
  subtotal,
  discountType = 'percent',
  discountValue = 0,
  discountAmount,
  taxPercent,
  taxAmount,
  total,
  amountPaid,
  balanceDue,
  currencySymbol = '$',
  onDiscountTypeChange,
  onDiscountValueChange,
  onTaxChange,
  readOnly = false,
}) => {
  const money = (n: number) => formatCurrency(n, currencySymbol);

  return (
    <div className="space-y-1">
      <Row label="Subtotal" value={money(subtotal)} />

      <Row
        label={
          <>
            <span>Discount</span>
            {!readOnly && (
              <>
                <div className="segmented p-0.5">
                  <button type="button" aria-pressed={discountType === 'percent'} onClick={() => onDiscountTypeChange?.('percent')} className="px-2 py-0.5">
                    %
                  </button>
                  <button type="button" aria-pressed={discountType === 'fixed'} onClick={() => onDiscountTypeChange?.('fixed')} className="px-2 py-0.5">
                    {currencySymbol}
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  aria-label="Discount value"
                  className="input h-8 w-24 text-right tabular"
                  value={discountValue}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => onDiscountValueChange?.(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </>
            )}
          </>
        }
        value={discountAmount > 0 ? `−${money(discountAmount)}` : money(0)}
        muted={discountAmount === 0}
      />

      <Row
        label={
          <>
            <span>Tax / VAT</span>
            {!readOnly && (
              <span className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="any"
                  aria-label="Tax percent"
                  className="input h-8 w-20 pr-6 text-right tabular"
                  value={taxPercent}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => onTaxChange?.(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </span>
            )}
          </>
        }
        value={money(taxAmount)}
        muted={taxAmount === 0}
      />
      <p className="text-[11px] text-slate-400">Includes per-item tax plus the document-level rate on the discounted subtotal.</p>

      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-sm font-semibold text-slate-900">Total</span>
        <span className="text-lg font-semibold text-slate-900 tabular">{money(total)}</span>
      </div>

      {amountPaid !== undefined && (
        <>
          <Row label="Paid to date" value={amountPaid > 0 ? `−${money(amountPaid)}` : money(0)} muted={amountPaid === 0} />
          <div
            className={`mt-1 flex items-center justify-between rounded-lg px-3.5 py-3 ${
              (balanceDue ?? 0) > 0 ? 'bg-primary-50 text-primary-800' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            <span className="text-[13px] font-semibold">{(balanceDue ?? 0) > 0 ? 'Balance due' : 'Fully paid'}</span>
            <span className="text-base font-semibold tabular">{money(balanceDue ?? 0)}</span>
          </div>
        </>
      )}
    </div>
  );
};
