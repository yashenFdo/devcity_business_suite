import React from 'react';
import { Search, X } from 'lucide-react';

export const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = 'Search…', className = '' }) => (
  <div className={`relative ${className}`}>
    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      type="search"
      className="input pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Clear search"
      >
        <X size={14} />
      </button>
    )}
  </div>
);

export interface FilterTab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: FilterTab<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="-mb-px flex gap-1 overflow-x-auto scrollbar-none" role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-[13px] font-medium transition-colors ${
              active ? 'border-primary-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-[11px] leading-[18px] tabular ${
                  active ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Small KPI tile used at the top of list pages. */
export const MetricTile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'danger' | 'success' | 'warning';
  onClick?: () => void;
  active?: boolean;
}> = ({ label, value, hint, tone = 'default', onClick, active }) => {
  const toneCls = {
    default: 'text-slate-900',
    danger: 'text-rose-600',
    success: 'text-emerald-700',
    warning: 'text-amber-600',
  }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card p-4 text-left ${onClick ? 'transition-all hover:border-slate-300 hover:shadow-card-hover' : ''} ${
        active ? 'border-primary-300 ring-2 ring-primary-100' : ''
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight tabular ${toneCls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </Comp>
  );
};
