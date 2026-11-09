import React from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { LineItem } from '../../types';
import { generateId } from '../../utils/documentNumber';
import { calculateLineItemAmount } from '../../utils/calculations';
import { formatCurrency } from '../../utils/formatters';
import { DEVCITY_SERVICE_PRESETS, type ServicePreset } from './ServicePresets';
import { Dropdown } from '../ui/Dropdown';

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currencySymbol?: string;
  showTax?: boolean;
  readOnly?: boolean;
  error?: string;
  /** Show the DevCity service catalogue (off for vendor bills). */
  showPresets?: boolean;
}

const newItem = (): LineItem => ({
  id: generateId(),
  description: '',
  quantity: 1,
  unit: 'hrs',
  unitPrice: 0,
  discount: 0,
  tax: 0,
  amount: 0,
});

const autosize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
};

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const NumberCell: React.FC<{
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  className?: string;
}> = ({ label, value, onChange, prefix, suffix, min = 0, max, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
    <span className="relative block">
      {prefix && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix}</span>
      )}
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        max={max}
        className={`input h-8 text-right tabular ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-6' : ''}`}
        value={Number.isFinite(value) ? value : 0}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          let n = num(e.target.value);
          if (max !== undefined) n = Math.min(max, n);
          onChange(Math.max(min, n));
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>
      )}
    </span>
  </label>
);

export const LineItemsTable: React.FC<LineItemsTableProps> = ({
  items,
  onChange,
  currencySymbol = '$',
  showTax = true,
  readOnly = false,
  error,
  showPresets = true,
}) => {
  const update = (index: number, patch: Partial<LineItem>) => {
    onChange(
      items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        next.amount = calculateLineItemAmount(next);
        return next;
      })
    );
  };

  const remove = (index: number) => onChange(items.length <= 1 ? [newItem()] : items.filter((_, i) => i !== index));
  const duplicate = (index: number) => {
    const copy = { ...items[index], id: generateId() };
    onChange([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
  };
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addPreset = (preset: ServicePreset) => {
    const item: LineItem = {
      id: generateId(),
      description: preset.description,
      quantity: preset.defaultQty,
      unit: preset.unit,
      unitPrice: preset.defaultPriceUSD,
      discount: 0,
      tax: 0,
      amount: preset.defaultQty * preset.defaultPriceUSD,
    };
    const onlyBlank = items.length === 1 && !items[0].description && !items[0].unitPrice;
    onChange(onlyBlank ? [item] : [...items, item]);
  };

  if (readOnly) {
    return (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <td className="text-slate-400">{i + 1}</td>
                <td className="font-medium text-slate-800">{item.description}</td>
                <td className="text-right tabular">
                  {item.quantity} {item.unit}
                </td>
                <td className="text-right tabular">{formatCurrency(item.unitPrice, currencySymbol)}</td>
                <td className="text-right font-medium tabular">{formatCurrency(item.amount, currencySymbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="group rounded-xl border border-slate-200 bg-white p-3 transition-colors focus-within:border-primary-300 focus-within:shadow-focus hover:border-slate-300"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-2 w-5 flex-shrink-0 text-center font-mono text-[11px] text-slate-400">{index + 1}</span>
            <textarea
              rows={1}
              className="textarea min-h-[36px] flex-1 resize-none border-transparent bg-slate-50/60 font-medium shadow-none hover:border-slate-200 focus:bg-white"
              placeholder="Describe the service or deliverable…"
              value={item.description}
              ref={(el) => autosize(el)}
              onChange={(e) => update(index, { description: e.target.value })}
              aria-label={`Item ${index + 1} description`}
            />
            <div className="hidden flex-shrink-0 items-center opacity-100 transition-opacity sm:flex md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              <button type="button" className="btn-icon btn-ghost h-7 w-7" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost h-7 w-7"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
              >
                <ArrowDown size={14} />
              </button>
              <button type="button" className="btn-icon btn-ghost h-7 w-7" onClick={() => duplicate(index)} aria-label="Duplicate item">
                <Copy size={13} />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost h-7 w-7 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => remove(index)}
                aria-label="Remove item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className={`mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:pl-[30px] ${showTax ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
            <NumberCell label="Qty" value={item.quantity} onChange={(n) => update(index, { quantity: n })} />
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Unit</span>
              <input
                className="input h-8"
                list="unit-suggestions"
                placeholder="hrs"
                value={item.unit}
                onChange={(e) => update(index, { unit: e.target.value })}
              />
            </label>
            <NumberCell label="Rate" prefix={currencySymbol} value={item.unitPrice} onChange={(n) => update(index, { unitPrice: n })} />
            <NumberCell label="Discount" suffix="%" max={100} value={item.discount} onChange={(n) => update(index, { discount: n })} />
            {showTax && <NumberCell label="Tax" suffix="%" max={100} value={item.tax} onChange={(n) => update(index, { tax: n })} />}
            <div className="text-right">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Amount</span>
              <span className="block truncate py-1.5 text-[13px] font-semibold text-slate-900 tabular">
                {formatCurrency(item.amount, currencySymbol)}
              </span>
            </div>
          </div>
          {/* Phones: item actions get their own row so the description keeps the full width */}
          <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-slate-100 pt-2 sm:hidden">
              <button type="button" className="btn-icon btn-ghost h-9 w-9" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost h-9 w-9"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
              >
                <ArrowDown size={14} />
              </button>
              <button type="button" className="btn-icon btn-ghost h-9 w-9" onClick={() => duplicate(index)} aria-label="Duplicate item">
                <Copy size={13} />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost h-9 w-9 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => remove(index)}
                aria-label="Remove item"
              >
                <Trash2 size={14} />
              </button>
          </div>
        </div>
      ))}

      <datalist id="unit-suggestions">
        {['hrs', 'days', 'sprint', 'month', 'milestone', 'project', 'license', 'seat', 'unit'].map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="btn flex-1 border border-dashed border-slate-300 bg-white text-slate-600 hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-700"
        >
          <Plus size={15} /> Add line item
        </button>
        {showPresets && (
        <Dropdown
          side="top"
          panelClassName="w-[340px] max-h-80 overflow-y-auto"
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open} className="btn-secondary w-full sm:w-auto">
              <Sparkles size={15} className="text-primary-600" /> Add from service catalogue
            </button>
          )}
        >
          {(close) => (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">DevCity services</p>
              {DEVCITY_SERVICE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="menu-item items-start"
                  onClick={() => {
                    addPreset(p);
                    close();
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{p.label}</span>
                    <span className="block truncate text-xs text-slate-500">{p.description}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs font-medium text-slate-600 tabular">
                    {formatCurrency(p.defaultPriceUSD, currencySymbol)}
                    <span className="text-slate-400">/{p.unit}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </Dropdown>
        )}
      </div>
    </div>
  );
};
