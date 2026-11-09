import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, LayoutTemplate, PencilLine } from 'lucide-react';
import type { CurrencyCode, TemplateId } from '../../../types';
import { SUPPORTED_CURRENCIES } from '../../../types';
import { TEMPLATE_OPTIONS } from '../templateOptions';

interface EditorShellProps {
  backTo: string;
  title: string;
  number: string;
  badge?: React.ReactNode;
  /** Right-aligned primary actions (Save, Print…) */
  actions: React.ReactNode;
  form: React.ReactNode;
  preview: React.ReactNode;
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  currency?: CurrencyCode;
  onCurrencyChange?: (code: CurrencyCode) => void;
  /** Shown under the form, e.g. last saved info */
  footer?: React.ReactNode;
}

/**
 * Two-pane document editor: form on the left, live A4 preview on the right.
 * On small screens the panes become "Edit" / "Preview" tabs.
 */
export const EditorShell: React.FC<EditorShellProps> = ({
  backTo,
  title,
  number,
  badge,
  actions,
  form,
  preview,
  templateId,
  onTemplateChange,
  currency,
  onCurrencyChange,
  footer,
}) => {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="no-print flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4 md:px-6">
        <Link to={backTo} className="btn-icon btn-ghost -ml-1.5" aria-label="Back">
          <ArrowLeft size={17} />
        </Link>
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[15px] font-semibold text-slate-900">{title}</h1>
          <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 sm:inline">
            {number}
          </span>
          {badge}
        </div>
        <div className="flex-1" />
        <div className="segmented xl:hidden" role="tablist">
          <button type="button" aria-pressed={tab === 'edit'} onClick={() => setTab('edit')} className="flex items-center gap-1.5">
            <PencilLine size={13} /> Edit
          </button>
          <button type="button" aria-pressed={tab === 'preview'} onClick={() => setTab('preview')} className="flex items-center gap-1.5">
            <Eye size={13} /> Preview
          </button>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Form pane */}
        <div
          className={`min-w-0 flex-1 overflow-y-auto bg-slate-50 xl:max-w-[720px] xl:flex-none xl:basis-[46%] ${
            tab === 'preview' ? 'hidden xl:block' : ''
          }`}
        >
          <div className="mx-auto max-w-[720px] space-y-4 px-4 py-6 md:px-6">
            {form}
            {footer}
            <div className="h-6" />
          </div>
        </div>

        {/* Preview pane */}
        <div
          className={`min-w-0 flex-1 flex-col overflow-y-auto border-l border-slate-200/80 bg-slate-100 ${
            tab === 'edit' ? 'hidden xl:flex' : 'flex'
          }`}
        >
          <div className="no-print sticky top-0 z-10 flex h-12 flex-shrink-0 items-center gap-3 border-b border-slate-200/80 bg-slate-100/90 px-4 backdrop-blur md:px-6">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live preview
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <LayoutTemplate size={14} />
              <select
                className="select h-8 w-36 py-0 text-xs"
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value as TemplateId)}
                aria-label="Template"
              >
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {currency && onCurrencyChange && (
              <select
                className="select h-8 w-28 py-0 font-mono text-xs"
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                aria-label="Currency"
              >
                {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.symbol}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 px-2 py-6 md:px-6">{preview}</div>
        </div>
      </div>
    </div>
  );
};
