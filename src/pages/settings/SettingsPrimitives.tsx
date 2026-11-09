import React from 'react';
import { Loader2 } from 'lucide-react';

/** A settings group: title/description on top, content in a card. */
export const SettingsCard: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: 'default' | 'danger';
}> = ({ title, description, actions, children, footer, tone = 'default' }) => (
  <section className={`card overflow-hidden ${tone === 'danger' ? 'border-rose-200' : ''}`}>
    <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 gap-2">{actions}</div>}
    </div>
    <div className="px-6 py-5">{children}</div>
    {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">{footer}</div>}
  </section>
);

/** Floating bar that appears while a settings form has unsaved changes. */
export const UnsavedBar: React.FC<{ visible: boolean; saving?: boolean; onSave: () => void; onDiscard: () => void }> = ({
  visible,
  saving,
  onSave,
  onDiscard,
}) =>
  visible ? (
    <div className="no-print fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 lg:pl-[248px]">
      <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl bg-slate-900 py-2.5 pl-5 pr-2.5 text-white shadow-modal animate-slide-up">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <p className="flex-1 text-[13px]">You have unsaved changes</p>
        <button type="button" className="btn-sm btn text-slate-300 hover:bg-white/10 hover:text-white" onClick={onDiscard}>
          Discard
        </button>
        <button type="button" className="btn-sm btn bg-white text-slate-900 hover:bg-slate-100" onClick={onSave} disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />} Save changes
        </button>
      </div>
    </div>
  ) : null;
