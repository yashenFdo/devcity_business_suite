import React from 'react';
import { Download, Trash2, X } from 'lucide-react';
import { plural } from './plural';

const barBtn =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-40 md:h-8';

/**
 * Sticky action bar shown while rows are selected. Place it as the last child
 * of the page so it sticks to the bottom of the scrolling area.
 */
export const BulkBar: React.FC<{
  count: number;
  total: number;
  /** e.g. "invoice" — used for "Select all 12 invoices". */
  noun: string;
  onSelectAll: () => void;
  onClear: () => void;
  onExport: () => void;
  /** Omit when the user may not delete. */
  onDelete?: () => void;
}> = ({ count, total, noun, onSelectAll, onClear, onExport, onDelete }) => (
  <div
    role="region"
    aria-label="Bulk actions"
    className="no-print sticky bottom-3 z-30 mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl bg-slate-900 py-1.5 pl-4 pr-1.5 text-white shadow-pop ring-1 ring-slate-900/10 animate-slide-up md:bottom-6"
  >
    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span className="whitespace-nowrap text-[13px] font-semibold tabular" aria-live="polite">
        {count} selected
      </span>
      {count < total && (
        <button
          type="button"
          onClick={onSelectAll}
          className="whitespace-nowrap rounded text-[13px] font-medium text-primary-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Select all {plural(total, noun)}
        </button>
      )}
    </div>
    <div className="flex flex-shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onExport}
        className={`${barBtn} bg-white/10 hover:bg-white/20`}
        aria-label={count > 0 ? `Export ${plural(count, noun)} to CSV` : `Export all ${noun}s to CSV`}
        title="Export to CSV"
      >
        <Download size={15} aria-hidden="true" />
        <span className="hidden sm:inline">Export CSV</span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={count === 0}
          className={`${barBtn} bg-rose-600 hover:bg-rose-500`}
          aria-label={`Delete ${plural(count, noun)}`}
          title="Delete selected"
        >
          <Trash2 size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      )}
      <button
        type="button"
        onClick={onClear}
        className={`${barBtn} w-10 px-0 text-slate-300 hover:bg-white/10 hover:text-white md:w-auto md:px-2`}
        aria-label="Clear selection"
        title="Clear selection (Esc)"
      >
        <X size={16} aria-hidden="true" />
        <kbd className="hidden rounded border border-white/20 px-1 font-sans text-[10px] leading-4 text-slate-400 md:inline">Esc</kbd>
      </button>
    </div>
  </div>
);
