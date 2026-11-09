import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  CornerDownLeft,
  FileSignature,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  User,
  Users,
  Contact,
} from 'lucide-react';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useBillsStore } from '../../store/useBillsStore';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useCustomersStore } from '../../store/useCustomersStore';
import { lockWorkspace } from '../../security/session';
import { can } from '../../security/sessionState';
import { formatCurrency } from '../../utils/formatters';
import { CREATE_ACTIONS } from './navigation';

interface PaletteItem {
  id: string;
  group: 'Actions' | 'Go to' | 'Documents' | 'Clients';
  label: string;
  hint?: string;
  icon: React.ElementType;
  keywords: string;
  run: () => void;
}

export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;
  return <PaletteDialog onClose={onClose} />;
};

const PaletteDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const quotations = useQuotationsStore((s) => s.quotations);
  const invoices = useInvoicesStore((s) => s.invoices);
  const bills = useBillsStore((s) => s.bills);
  const receipts = useReceiptsStore((s) => s.receipts);
  const customers = useCustomersStore((s) => s.customers);

  useEffect(() => inputRef.current?.focus(), []);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (to: string) => () => navigate(to);
    const actions: PaletteItem[] = CREATE_ACTIONS.filter((a) =>
      a.label === 'Receipt' ? can('payments.record') : can('documents.create')
    ).map((a) => ({
      id: `new-${a.to}`,
      group: 'Actions',
      label: `New ${a.label.toLowerCase()}`,
      hint: a.hint,
      icon: a.icon,
      keywords: `create new add ${a.label}`,
      run: go(a.to),
    }));
    actions.push({
      id: 'lock',
      group: 'Actions',
      label: 'Sign out',
      hint: 'Ctrl + Shift + L',
      icon: LogOut,
      keywords: 'lock secure sign out log out away',
      run: () => void lockWorkspace('manual'),
    });

    const pages: PaletteItem[] = [
      { label: 'Overview', to: '/', icon: LayoutDashboard },
      { label: 'Quotations', to: '/quotations', icon: FileSignature },
      { label: 'Invoices', to: '/invoices', icon: FileText },
      { label: 'Receipts', to: '/receipts', icon: Receipt },
      { label: 'Vendor bills', to: '/bills', icon: Banknote },
      { label: 'Clients', to: '/customers', icon: Users },
      { label: 'People', to: '/people', icon: Contact },
      { label: 'Company settings', to: '/settings', icon: Settings },
      { label: 'Account & security', to: '/settings/security', icon: ShieldCheck },
    ].map((p) => ({ id: `go-${p.to}`, group: 'Go to' as const, label: p.label, icon: p.icon, keywords: p.label, run: go(p.to) }));

    const docs: PaletteItem[] = [
      ...quotations.map((q) => ({
        id: `q-${q.id}`,
        group: 'Documents' as const,
        label: q.quotationNumber,
        hint: `Quotation · ${q.customer?.company || q.customer?.name || ''} · ${formatCurrency(q.total, q.currencySymbol)}`,
        icon: FileSignature,
        keywords: `${q.quotationNumber} ${q.customer?.name} ${q.customer?.company} ${q.projectDescription ?? ''} quotation`,
        run: go(`/quotations/${q.id}`),
      })),
      ...invoices.map((i) => ({
        id: `i-${i.id}`,
        group: 'Documents' as const,
        label: i.invoiceNumber,
        hint: `Invoice · ${i.customer?.company || i.customer?.name || ''} · ${formatCurrency(i.total, i.currencySymbol)}`,
        icon: FileText,
        keywords: `${i.invoiceNumber} ${i.customer?.name} ${i.customer?.company} ${i.projectDescription ?? ''} invoice`,
        run: go(`/invoices/${i.id}`),
      })),
      ...receipts.map((r) => ({
        id: `r-${r.id}`,
        group: 'Documents' as const,
        label: r.receiptNumber,
        hint: `Receipt · ${r.customer?.company || r.customer?.name || ''} · ${formatCurrency(r.amount, r.currencySymbol)}`,
        icon: Receipt,
        keywords: `${r.receiptNumber} ${r.customer?.name} ${r.customer?.company} ${r.linkedInvoiceNumber ?? ''} receipt`,
        run: go(`/receipts/${r.id}`),
      })),
      ...bills.map((b) => ({
        id: `b-${b.id}`,
        group: 'Documents' as const,
        label: b.billNumber,
        hint: `Vendor bill · ${b.vendorName} · ${formatCurrency(b.total, b.currencySymbol)}`,
        icon: Banknote,
        keywords: `${b.billNumber} ${b.vendorName} bill vendor`,
        run: go(`/bills/${b.id}`),
      })),
    ];

    const clients: PaletteItem[] = customers.map((c) => ({
      id: `c-${c.id}`,
      group: 'Clients',
      label: c.company || c.name,
      hint: c.company ? `${c.name} · ${c.email}` : c.email,
      icon: User,
      keywords: `${c.name} ${c.company} ${c.email}`,
      run: go(`/customers?q=${encodeURIComponent(c.company || c.name)}`),
    }));

    const q = query.trim().toLowerCase();
    if (!q) return [...actions, ...pages, ...docs.slice(0, 5)];
    const terms = q.split(/\s+/);
    const match = (it: PaletteItem) => {
      const hay = `${it.label} ${it.keywords} ${it.hint ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    };
    return [...actions, ...pages, ...docs, ...clients].filter(match).slice(0, 40);
  }, [query, quotations, invoices, receipts, bills, customers, navigate]);

  const safeActive = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [safeActive]);

  const execute = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(items[safeActive]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="modal-overlay items-start pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-xl overflow-hidden" role="dialog" aria-label="Command palette" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder="Search documents, clients, or type a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            aria-label="Search"
          />
          <span className="kbd">Esc</span>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No results for “{query}”</p>
              <p className="mt-1 text-xs text-slate-500">Try a document number, client name or company.</p>
            </div>
          )}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const isActive = index === safeActive;
            return (
              <React.Fragment key={item.id}>
                {header && (
                  <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 first:pt-1">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={() => execute(item)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isActive ? 'bg-primary-50 text-primary-900' : 'text-slate-700'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${
                      isActive ? 'bg-white text-primary-600 shadow-xs ring-1 ring-primary-100' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <item.icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] font-medium ${item.group === 'Documents' ? 'font-mono' : ''}`}>
                      {item.label}
                    </span>
                    {item.hint && <span className="block truncate text-xs text-slate-500">{item.hint}</span>}
                  </span>
                  {isActive &&
                    (item.group === 'Actions' ? (
                      <CornerDownLeft size={14} className="text-primary-500" />
                    ) : (
                      <ArrowRight size={14} className="text-primary-500" />
                    ))}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-600" /> Searches only this encrypted workspace
          </span>
        </div>
      </div>
    </div>
  );
};
