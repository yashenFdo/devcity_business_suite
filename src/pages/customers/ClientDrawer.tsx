import React, { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  FilePlus2,
  FileSignature,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import type { Customer } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { clientLabel, formatAddress, type ClientDocKind, type ClientDocument, type ClientStats } from './clientStats';

const KIND: Record<ClientDocKind, { label: string; icon: React.ElementType; tone: string }> = {
  invoice: { label: 'Invoice', icon: FileText, tone: 'bg-primary-50 text-primary-600' },
  quotation: { label: 'Quotation', icon: FileSignature, tone: 'bg-violet-50 text-violet-600' },
  receipt: { label: 'Receipt', icon: ReceiptText, tone: 'bg-emerald-50 text-emerald-600' },
};

const RECENT_LIMIT = 8;

interface ClientDrawerProps {
  client: Customer;
  stats: ClientStats;
  documents: ClientDocument[];
  currencySymbol: string;
  canManage: boolean;
  canDelete: boolean;
  canCreateDocs: boolean;
  /** True while a modal is stacked on top, so Escape closes that instead. */
  suspendEscape: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewInvoice: () => void;
  onNewQuotation: () => void;
}

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="px-6 py-5">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-900' }) => (
  <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
    <p className="text-[11px] font-medium text-slate-500">{label}</p>
    <p className={`mt-0.5 truncate text-sm font-semibold tabular ${tone}`}>{value}</p>
  </div>
);

/** Right-hand slide-over with a client's details, balances and recent documents. */
export const ClientDrawer: React.FC<ClientDrawerProps> = ({
  client,
  stats,
  documents,
  currencySymbol: cur,
  canManage,
  canDelete,
  canCreateDocs,
  suspendEscape,
  onClose,
  onEdit,
  onDelete,
  onNewInvoice,
  onNewQuotation,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (suspendEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [suspendEscape, onClose]);

  // Slide in from the right on mount (Tailwind config only ships a left-hand slide).
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [
        { transform: 'translateX(24px)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
  }, []);

  const label = clientLabel(client);
  const address = formatAddress(client.address);
  const recent = documents.slice(0, RECENT_LIMIT);
  const hasContact = Boolean(client.email || client.phone || address.length);

  return (
    <div className="no-print fixed inset-0 z-[45] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] animate-fade-in" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col bg-slate-50 shadow-modal ring-1 ring-slate-900/5"
      >
        {/* Header */}
        <div className="border-b border-slate-200/80 bg-white px-6 pb-5 pt-5">
          <div className="flex items-start gap-3.5">
            <Avatar name={label} size="lg" />
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={titleId} className="truncate text-base font-semibold text-slate-900">
                {label}
              </h2>
              {client.company && client.name && <p className="truncate text-[13px] text-slate-600">{client.name}</p>}
              <p className="mt-0.5 text-xs text-slate-400">Client since {formatDate(client.createdAt)}</p>
            </div>
            <button type="button" autoFocus onClick={onClose} className="btn-icon btn-ghost -mr-2 -mt-1" aria-label="Close client details">
              <X size={17} />
            </button>
          </div>

          {(canCreateDocs || canManage) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {canCreateDocs && (
                <>
                  <button type="button" className="btn-primary btn-sm" onClick={onNewInvoice}>
                    <FilePlus2 size={14} /> New invoice
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={onNewQuotation}>
                    <FileSignature size={14} /> New quotation
                  </button>
                </>
              )}
              {canManage && (
                <button type="button" className="btn-secondary btn-sm" onClick={onEdit}>
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 divide-y divide-slate-200/70 overflow-y-auto">
          {/* Balances */}
          <Section title="Billing">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Billed" value={formatCurrency(stats.billed, cur)} />
              <Stat label="Paid" value={formatCurrency(stats.paid, cur)} tone={stats.paid > 0 ? 'text-emerald-700' : 'text-slate-900'} />
              <Stat
                label="Outstanding"
                value={formatCurrency(stats.outstanding, cur)}
                tone={stats.overdue > 0 ? 'text-rose-600' : stats.outstanding > 0 ? 'text-amber-700' : 'text-slate-900'}
              />
            </div>
            {stats.overdue > 0 && (
              <p className="mt-2.5 text-xs font-medium text-rose-600">{formatCurrency(stats.overdue, cur)} is past due.</p>
            )}
          </Section>

          {/* Contact */}
          <Section title="Contact">
            {hasContact ? (
              <ul className="space-y-2.5 text-[13px]">
                {client.email && (
                  <li className="flex items-start gap-2.5">
                    <Mail size={15} className="mt-0.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                    <a href={`mailto:${client.email}`} className="min-w-0 break-all text-slate-800 hover:text-primary-700 hover:underline">
                      {client.email}
                    </a>
                  </li>
                )}
                {client.phone && (
                  <li className="flex items-start gap-2.5">
                    <Phone size={15} className="mt-0.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                    <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className="text-slate-800 hover:text-primary-700 hover:underline">
                      {client.phone}
                    </a>
                  </li>
                )}
                {address.length > 0 && (
                  <li className="flex items-start gap-2.5">
                    <MapPin size={15} className="mt-0.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                    <address className="not-italic leading-relaxed text-slate-700">
                      {address.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-[13px] text-slate-500">
                No contact details yet.
                {canManage && (
                  <>
                    {' '}
                    <button type="button" onClick={onEdit} className="font-medium text-primary-700 hover:underline">
                      Add them
                    </button>
                  </>
                )}
              </p>
            )}
            {client.taxNumber && (
              <dl className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2 text-[13px] ring-1 ring-slate-200/80">
                <dt className="text-slate-500">Tax ID</dt>
                <dd className="font-mono text-[12px] font-medium text-slate-800">{client.taxNumber}</dd>
              </dl>
            )}
          </Section>

          {client.notes && (
            <Section title="Notes">
              <p className="whitespace-pre-line rounded-lg bg-amber-50/60 px-3 py-2.5 text-[13px] leading-relaxed text-slate-700 ring-1 ring-amber-100">
                {client.notes}
              </p>
            </Section>
          )}

          {/* Documents */}
          <Section
            title="Recent documents"
            action={documents.length > 0 && <span className="text-xs text-slate-400 tabular">{documents.length} total</span>}
          >
            {recent.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
                <p className="text-[13px] font-medium text-slate-700">No documents yet</p>
                <p className="mt-0.5 text-xs text-slate-500">Invoices, quotations and receipts for this client will appear here.</p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200/80">
                {recent.map((d) => {
                  const k = KIND[d.kind];
                  return (
                    <li key={`${d.kind}-${d.id}`} className="border-b border-slate-100 last:border-b-0">
                      <Link to={d.to} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50">
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${k.tone}`} aria-hidden="true">
                          <k.icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[12.5px] font-medium text-slate-900">{d.number}</span>
                          <span className="block text-xs text-slate-500">
                            {k.label} · {formatDate(d.date)}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="text-[13px] font-medium text-slate-900 tabular">{formatCurrency(d.amount, d.currencySymbol || cur)}</span>
                          {d.status && <StatusBadge status={d.status} />}
                        </span>
                        <ChevronRight size={15} className="flex-shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {documents.length > RECENT_LIMIT && (
              <p className="mt-2 text-xs text-slate-500">Showing the {RECENT_LIMIT} most recent of {documents.length}.</p>
            )}
          </Section>
        </div>

        {canDelete && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 bg-white px-6 py-3">
            <p className="text-xs text-slate-400">Last updated {formatDate(client.updatedAt)}</p>
            <button type="button" className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={onDelete}>
              <Trash2 size={14} /> Delete client
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
