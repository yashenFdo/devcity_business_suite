import React from 'react';
import { History } from 'lucide-react';

interface DraftBannerProps {
  /** When the draft was last autosaved, e.g. "10:42". */
  savedAtLabel: string;
  /** Optional one-line hint at what's inside, e.g. "Acme Corp · $4,200.00". */
  detail?: string;
  onRestore: () => void;
  onDiscard: () => void;
}

/** Offers to restore an autosaved draft of a new document. */
export const DraftBanner: React.FC<DraftBannerProps> = ({ savedAtLabel, detail, onRestore, onDiscard }) => (
  <section
    aria-label="Unsaved draft"
    className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border border-primary-200/80 bg-primary-50/70 px-4 py-3 animate-slide-up"
  >
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-primary-600 shadow-xs ring-1 ring-primary-100">
      <History size={15} aria-hidden />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] text-slate-700">
        You have an unsaved draft from <span className="font-semibold text-slate-900 tabular">{savedAtLabel}</span>
      </p>
      {detail && <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>}
    </div>
    <div className="flex w-full items-center gap-1.5 sm:w-auto">
      <button type="button" className="btn-primary btn-sm h-10 flex-1 sm:h-8 sm:flex-none" onClick={onRestore}>
        Restore
      </button>
      <button type="button" className="btn-ghost btn-sm h-10 flex-1 sm:h-8 sm:flex-none" onClick={onDiscard}>
        Discard
      </button>
    </div>
  </section>
);
