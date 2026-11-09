import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, LayoutTemplate, PencilLine, Printer, type LucideIcon } from 'lucide-react';
import type { CurrencyCode, TemplateId } from '../../../types';
import { SUPPORTED_CURRENCIES } from '../../../types';
import { TEMPLATE_OPTIONS } from '../templateOptions';
import { ConfirmModal } from '../../ui/Modal';
import { formatDate } from '../../../utils/formatters';

export interface EditorAction {
  /** Stable id, matched against `saved` to show the success state. */
  id: string;
  label: string;
  /** Shorter label for the mobile action bar, e.g. "Issue" for "Save & issue". */
  shortLabel?: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** The main call to action (filled button). */
  primary?: boolean;
}

interface EditorShellProps {
  backTo: string;
  title: string;
  number: string;
  badge?: React.ReactNode;
  /** Save actions, in visual order (secondary first, primary last). */
  actions: EditorAction[];
  /** Id of the action that just saved successfully — shows "Saved ✓" and locks the buttons. */
  saved?: string | null;
  /** Opens the print / PDF dialog. */
  onPrint?: () => void;
  /** Money summary for the mobile action bar, e.g. { label: 'Total', value: '$21,000.00' }. */
  summary?: { label: string; value: string };
  /** Unsaved changes — the back button asks before discarding them. */
  dirty?: boolean;
  /** Called when the user confirms leaving with unsaved changes (e.g. drop the autosaved draft). */
  onDiscard?: () => void;
  /** Last saved timestamp of an existing document. */
  lastSavedAt?: string;
  /** New documents autosave a draft in this tab. */
  autosaves?: boolean;
  /** Rendered above the form, e.g. the draft-restore banner. */
  banner?: React.ReactNode;
  form: React.ReactNode;
  preview: React.ReactNode;
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  currency?: CurrencyCode;
  onCurrencyChange?: (code: CurrencyCode) => void;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

const ActionButton: React.FC<{ action: EditorAction; saved: string | null; size: 'sm' | 'lg' }> = ({ action, saved, size }) => {
  const isSaved = saved === action.id;
  const locked = saved !== null;
  const Icon = isSaved ? Check : action.icon;
  const tone = action.primary ? (isSaved ? 'btn-success' : 'btn-primary') : 'btn-secondary';
  const sizing = size === 'sm' ? 'btn-sm' : 'h-11 min-w-0 flex-1 px-3 text-sm';
  return (
    <button
      type="button"
      className={`${tone} ${sizing} ${isSaved && !action.primary ? 'text-emerald-700' : ''}`}
      onClick={() => !locked && action.onClick()}
      // Keep the successful button fully opaque; dim the others.
      disabled={locked && !isSaved}
      aria-disabled={locked || undefined}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} aria-hidden className={isSaved ? 'animate-scale-in' : undefined} />}
      <span className="truncate">{isSaved ? 'Saved' : size === 'lg' ? action.shortLabel || action.label : action.label}</span>
    </button>
  );
};

/**
 * Two-pane document editor: form on the left, live A4 preview on the right.
 *
 * Below `xl` the panes become "Edit" / "Preview" tabs, the top bar stays minimal
 * and the save actions move to a bottom action bar (with the document total).
 */
export const EditorShell: React.FC<EditorShellProps> = ({
  backTo,
  title,
  number,
  badge,
  actions,
  saved = null,
  onPrint,
  summary,
  dirty = false,
  onDiscard,
  lastSavedAt,
  autosaves = false,
  banner,
  form,
  preview,
  templateId,
  onTemplateChange,
  currency,
  onCurrencyChange,
}) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const status = saved
    ? 'Saved'
    : dirty
      ? autosaves
        ? 'Unsaved changes · draft kept in this tab'
        : 'Unsaved changes'
      : lastSavedAt
        ? `Last saved ${formatDate(lastSavedAt, 'dd MMM yyyy, HH:mm')}`
        : 'Not saved yet';

  // Bottom padding so the last section can scroll clear of the fixed mobile action bar.
  const barClearance = 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6';

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="no-print flex h-14 flex-shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-2 sm:gap-3 sm:px-4 md:px-6">
        <Link
          to={backTo}
          className="btn-icon btn-ghost h-10 w-10 xl:-ml-1.5 xl:h-8 xl:w-8"
          aria-label="Back"
          onClick={(e) => {
            if (!dirty || saved || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            setConfirmLeave(true);
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2.5">
          <h1 className="truncate text-[15px] font-semibold leading-5 text-slate-900">{title}</h1>
          <span className="truncate font-mono text-[11px] font-medium leading-4 text-slate-500 sm:rounded-md sm:bg-slate-100 sm:px-2 sm:py-0.5 sm:text-slate-600">
            {number}
          </span>
          {badge && <span className="hidden sm:inline-flex">{badge}</span>}
        </div>
        <div className="flex-1" />
        <div className="segmented flex-shrink-0 xl:hidden" role="group" aria-label="Editor view">
          <button
            type="button"
            aria-pressed={tab === 'edit'}
            onClick={() => setTab('edit')}
            className="flex items-center gap-1.5 !py-1.5"
          >
            <PencilLine size={13} aria-hidden /> Edit
          </button>
          <button
            type="button"
            aria-pressed={tab === 'preview'}
            onClick={() => setTab('preview')}
            className="flex items-center gap-1.5 !py-1.5"
          >
            <Eye size={13} aria-hidden /> Preview
          </button>
        </div>
        {/* Desktop actions */}
        <div className="hidden items-center gap-2 xl:flex">
          {onPrint && (
            <button type="button" className="btn-ghost btn-sm" onClick={onPrint}>
              <Printer size={15} aria-hidden /> Preview PDF
            </button>
          )}
          {actions.map((a) => (
            <ActionButton key={a.id} action={a} saved={saved} size="sm" />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Form pane */}
        <div
          className={`min-w-0 flex-1 overflow-y-auto bg-slate-50 xl:max-w-[720px] xl:flex-none xl:basis-[46%] ${
            tab === 'preview' ? 'hidden xl:block' : ''
          }`}
        >
          <div className={`mx-auto max-w-[720px] space-y-4 px-4 pt-6 md:px-6 ${barClearance}`}>
            {banner}
            {form}
            <p className="px-1 pt-2 text-center text-xs text-slate-400" aria-live="polite">
              {status}
              <span className="hidden xl:inline">
                {' '}
                · Press <kbd className="kbd">{IS_MAC ? '⌘' : 'Ctrl'}</kbd> <kbd className="kbd">S</kbd> to save
              </span>
            </p>
          </div>
        </div>

        {/* Preview pane */}
        <div
          className={`min-w-0 flex-1 flex-col overflow-y-auto border-l border-slate-200/80 bg-slate-100 ${
            tab === 'edit' ? 'hidden xl:flex' : 'flex'
          }`}
        >
          <div className="no-print sticky top-0 z-10 flex h-12 flex-shrink-0 items-center gap-2 border-b border-slate-200/80 bg-slate-100/90 px-3 backdrop-blur sm:gap-3 md:px-6">
            <span className="hidden items-center gap-1.5 text-xs font-medium text-slate-500 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live preview
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <LayoutTemplate size={14} aria-hidden className="hidden sm:block" />
              <select
                className="select h-8 w-32 py-0 text-xs sm:w-36"
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
                className="select h-8 w-24 py-0 font-mono text-xs sm:w-28"
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
            {onPrint && (
              <button type="button" className="btn-icon btn-ghost flex-shrink-0 xl:hidden" onClick={onPrint} aria-label="Preview PDF" title="Preview PDF">
                <Printer size={16} aria-hidden />
              </button>
            )}
          </div>
          <div className={`flex-1 px-2 pt-6 md:px-6 ${barClearance}`}>{preview}</div>
        </div>
      </div>

      {/* Mobile / tablet action bar: fixed to the viewport on phones (robust to mobile
          browser chrome), part of the layout from `lg` where the sidebar is visible. */}
      <div
        className="no-print fixed inset-x-0 bottom-0 z-30 flex-shrink-0 border-t border-slate-200/80 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.18)] backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:z-auto lg:pb-3 lg:shadow-none xl:hidden"
        role="region"
        aria-label="Document actions"
      >
        <div className="mx-auto flex max-w-[720px] items-center gap-3">
          {summary && (
            <div className="min-w-0 flex-shrink-0 pr-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{summary.label}</p>
              <p className="truncate text-[15px] font-semibold text-slate-900 tabular">{summary.value}</p>
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {actions.map((a) => (
              <ActionButton key={a.id} action={a} saved={saved} size="lg" />
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          onDiscard?.();
          navigate(backTo);
        }}
        title="Discard unsaved changes?"
        message="You've made changes that haven't been saved. If you leave now, they'll be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
      />
    </div>
  );
};
