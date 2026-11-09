import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, Bell, CheckCircle2, Clock, Info, LogOut, Menu, Search } from 'lucide-react';
import { Dropdown } from '../ui/Dropdown';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useBillsStore } from '../../store/useBillsStore';
import { buildAlerts, joinRequestAlerts, type AlertTone } from '../../utils/insights';
import { useAccessStore } from '../../store/useAccessStore';
import { useCan } from '../../security/sessionState';
import { lockWorkspace } from '../../security/session';

const SECTIONS: { path: string; label: string }[] = [
  { path: '/quotations', label: 'Quotations' },
  { path: '/invoices', label: 'Invoices' },
  { path: '/receipts', label: 'Receipts' },
  { path: '/bills', label: 'Vendor bills' },
  { path: '/customers', label: 'Clients' },
  { path: '/people', label: 'People' },
  { path: '/settings', label: 'Settings' },
];

const SETTINGS_PAGES: Record<string, string> = {
  '/settings': 'Company profile',
  '/settings/branding': 'Branding & documents',
  '/settings/team': 'Team & access',
  '/settings/security': 'Account & security',
  '/settings/activity': 'Activity log',
};

const useBreadcrumbs = (pathname: string): { label: string; to?: string }[] => {
  if (pathname === '/') return [{ label: 'Overview' }];
  const section = SECTIONS.find((s) => pathname.startsWith(s.path));
  if (!section) return [{ label: 'Overview' }];
  if (section.path === '/settings') {
    return [{ label: 'Settings', to: '/settings' }, { label: SETTINGS_PAGES[pathname] ?? 'Settings' }];
  }
  const rest = pathname.slice(section.path.length);
  if (!rest || rest === '/') return [{ label: section.label }];
  const crumb = rest === '/new' ? 'New' : rest.endsWith('/edit') ? 'Edit' : 'Details';
  return [{ label: section.label, to: section.path }, { label: crumb }];
};

const TONE: Record<AlertTone, { icon: React.ElementType; cls: string }> = {
  danger: { icon: AlertCircle, cls: 'bg-rose-50 text-rose-600' },
  warning: { icon: Clock, cls: 'bg-amber-50 text-amber-600' },
  info: { icon: Info, cls: 'bg-primary-50 text-primary-600' },
};

const Notifications: React.FC = () => {
  const invoices = useInvoicesStore((s) => s.invoices);
  const quotations = useQuotationsStore((s) => s.quotations);
  const bills = useBillsStore((s) => s.bills);
  const joinRequests = useAccessStore((s) => s.joinRequests);
  const isAdmin = useCan('users.manage');
  const alerts = useMemo(
    () => [...(isAdmin ? joinRequestAlerts(joinRequests) : []), ...buildAlerts(invoices, quotations, bills)],
    [isAdmin, joinRequests, invoices, quotations, bills]
  );
  const urgent = alerts.filter((a) => a.tone !== 'info').length;

  return (
    <Dropdown
      panelClassName="w-[340px] p-0"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Notifications${alerts.length ? ` (${alerts.length})` : ''}`}
          className="btn-icon btn-ghost relative"
        >
          <Bell size={17} />
          {alerts.length > 0 && (
            <span
              className={`absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ring-2 ring-white ${
                urgent ? 'bg-rose-500' : 'bg-primary-500'
              }`}
            >
              {alerts.length > 9 ? '9+' : alerts.length}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Needs attention</p>
            {alerts.length > 0 && <span className="text-xs text-slate-500">{alerts.length} items</span>}
          </div>
          {alerts.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
              <p className="mt-3 text-sm font-medium text-slate-800">You're all caught up</p>
              <p className="mt-1 text-xs text-slate-500">No overdue invoices, due bills or expiring quotes.</p>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto p-1.5">
              {alerts.map((a) => {
                const t = TONE[a.tone];
                return (
                  <Link key={a.id} to={a.link} onClick={close} className="menu-item items-start">
                    <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${t.cls}`}>
                      <t.icon size={14} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{a.title}</span>
                      <span className="block truncate text-xs text-slate-500">{a.detail}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Dropdown>
  );
};

export const Header: React.FC<{ onMenuClick: () => void; onSearch: () => void }> = ({ onMenuClick, onSearch }) => {
  const { pathname } = useLocation();
  const crumbs = useBreadcrumbs(pathname);
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  return (
    <header className="no-print sticky top-0 z-40 flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md md:px-6">
      <button type="button" onClick={onMenuClick} className="btn-icon btn-ghost lg:hidden" aria-label="Open menu">
        <Menu size={18} />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300">/</span>}
            {c.to ? (
              <Link to={c.to} className="truncate text-slate-500 hover:text-slate-900">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-slate-900">{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onSearch}
        className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-400 transition-colors hover:border-slate-300 hover:bg-white md:flex"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Search or jump to…</span>
        <span className="kbd">{isMac ? '⌘' : 'Ctrl'}</span>
        <span className="kbd">K</span>
      </button>
      <button type="button" onClick={onSearch} className="btn-icon btn-ghost md:hidden" aria-label="Search">
        <Search size={17} />
      </button>

      <Notifications />

      <button
        type="button"
        className="btn-icon btn-ghost"
        onClick={() => void lockWorkspace('manual')}
        title="Sign out (Ctrl+Shift+L)"
        aria-label="Sign out"
      >
        <LogOut size={16} />
      </button>
    </header>
  );
};
