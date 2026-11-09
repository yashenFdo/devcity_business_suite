import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Banknote,
  ChevronsUpDown,
  FileSignature,
  FileText,
  LayoutDashboard,
  Check,
  Contact,
  UserPlus,
  LogOut,
  Plus,
  Receipt,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { LogoMark } from '../brand/Logo';
import { Avatar } from '../ui/Avatar';
import { Dropdown } from '../ui/Dropdown';
import { useSession, useCan } from '../../security/sessionState';
import { ROLE_META } from '../../security/permissions';
import { openOnboarding, signOut, switchWorkspace } from '../../security/session';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useAccessStore } from '../../store/useAccessStore';
import { effectiveInvoiceStatus } from '../../utils/insights';
import { CREATE_ACTIONS } from './navigation';


interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  end?: boolean;
  badge?: number;
}

const NavGroup: React.FC<{ title?: string; items: NavItem[]; onNavigate: () => void }> = ({ title, items, onNavigate }) => (
  <div>
    {title && <div className="sidebar-section">{title}</div>}
    <div className="space-y-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <item.icon size={16} className="flex-shrink-0 text-slate-400" />
          <span className="flex-1 truncate">{item.label}</span>
          {!!item.badge && (
            <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-semibold leading-4 text-rose-700">
              {item.badge}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  </div>
);

/** Top of the sidebar: current workspace with a switcher. */
const WorkspaceSwitcher: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const workspace = useSession((s) => s.workspace);
  const workspaces = useSession((s) => s.workspaces);
  const isAdmin = useCan('users.manage');
  if (!workspace) return null;
  return (
    <Dropdown
      align="left"
      className="w-full"
      panelClassName="w-[240px]"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-slate-100"
        >
          <LogoMark size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold tracking-tight text-slate-900">{workspace.name}</span>
            <span className="block text-[11px] text-slate-500">Business Suite</span>
          </span>
          <ChevronsUpDown size={14} className="flex-shrink-0 text-slate-400" />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspaces</p>
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              className="menu-item"
              onClick={() => {
                close();
                onNavigate();
                if (w.id !== workspace.id) {
                  navigate('/');
                  void switchWorkspace(w.id);
                }
              }}
            >
              <Avatar name={w.name} size="xs" className="rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{w.name}</span>
                <span className="block text-[11px] text-slate-500">{ROLE_META[w.role].label}</span>
              </span>
              {w.id === workspace.id && <Check size={14} className="text-primary-600" />}
            </button>
          ))}
          <div className="my-1 h-px bg-slate-100" />
          {isAdmin && (
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                close();
                onNavigate();
                navigate('/settings/team');
              }}
            >
              <UserPlus size={15} className="text-slate-400" /> Invite people
            </button>
          )}
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              close();
              void openOnboarding();
            }}
          >
            <Plus size={15} className="text-slate-400" /> Create or join a workspace
          </button>
        </>
      )}
    </Dropdown>
  );
};

const SidebarContent: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const canCreate = useCan('documents.create');
  const canRecordPayments = useCan('payments.record');
  const autoLock = useAccessStore((s) => s.policy.autoLockMinutes);
  const overdue = useInvoicesStore((s) => s.invoices.filter((i) => effectiveInvoiceStatus(i) === 'overdue').length);

  const createActions = CREATE_ACTIONS.filter((a) => (a.label === 'Receipt' ? canRecordPayments : canCreate));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-2.5">
        <WorkspaceSwitcher onNavigate={onNavigate} />
      </div>

      {createActions.length > 0 && (
        <div className="px-3 pb-2 pt-1">
          <Dropdown
            align="left"
            panelClassName="w-[232px]"
            trigger={({ toggle, open }) => (
              <button type="button" onClick={toggle} aria-expanded={open} className="btn-primary w-full justify-start">
                <Plus size={16} /> <span className="flex-1 text-left">New document</span>
              </button>
            )}
          >
            {(close) =>
              createActions.map((a) => (
                <button
                  key={a.to}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    close();
                    onNavigate();
                    navigate(a.to);
                  }}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md ${a.tone}`}>
                    <a.icon size={15} />
                  </span>
                  <span>
                    <span className="block font-medium text-slate-900">{a.label}</span>
                    <span className="block text-xs text-slate-500">{a.hint}</span>
                  </span>
                </button>
              ))
            }
          </Dropdown>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        <NavGroup onNavigate={onNavigate} items={[{ label: 'Overview', icon: LayoutDashboard, to: '/', end: true }]} />
        <NavGroup
          title="Sales"
          onNavigate={onNavigate}
          items={[
            { label: 'Quotations', icon: FileSignature, to: '/quotations' },
            { label: 'Invoices', icon: FileText, to: '/invoices', badge: overdue },
            { label: 'Receipts', icon: Receipt, to: '/receipts' },
          ]}
        />
        <NavGroup
          title="Purchases"
          onNavigate={onNavigate}
          items={[{ label: 'Vendor bills', icon: Banknote, to: '/bills' }]}
        />
        <NavGroup
          title="Directory"
          onNavigate={onNavigate}
          items={[
            { label: 'Clients', icon: Users, to: '/customers' },
            { label: 'People', icon: Contact, to: '/people' },
          ]}
        />
        <NavGroup
          title="Workspace"
          onNavigate={onNavigate}
          items={[{ label: 'Settings', icon: Settings, to: '/settings' }]}
        />
      </nav>

      <div className="space-y-2 border-t border-slate-200/80 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 px-2.5 py-2 text-[11px] text-emerald-800 ring-1 ring-emerald-100">
          <ShieldCheck size={14} className="flex-shrink-0 text-emerald-600" />
          <span className="leading-tight">
            <span className="font-semibold">Secured</span> · signs out after {autoLock} min idle
          </span>
        </div>

        {user && (
          <Dropdown
            align="left"
            side="top"
            panelClassName="w-[232px]"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-slate-100"
              >
                <Avatar name={user.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900">{user.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{ROLE_META[user.role].label}</span>
                </span>
                <ChevronsUpDown size={14} className="text-slate-400" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 py-2">
                  <p className="truncate text-[13px] font-medium text-slate-900">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-slate-100" />
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    close();
                    onNavigate();
                    navigate('/settings/security');
                  }}
                >
                  <UserCog size={15} className="text-slate-400" /> Account & security
                </button>
                <div className="my-1 h-px bg-slate-100" />
                <button
                  type="button"
                  className="menu-item text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => {
                    close();
                    void signOut();
                  }}
                >
                  <LogOut size={15} />
                  <span className="flex-1">Sign out</span>
                  <span className="text-[10px] text-rose-400">Ctrl ⇧ L</span>
                </button>
              </>
            )}
          </Dropdown>
        )}
      </div>
    </div>
  );
};

export const Sidebar: React.FC<{ mobileOpen: boolean; onClose: () => void }> = ({ mobileOpen, onClose }) => (
  <>
    <aside className="no-print hidden w-[248px] flex-shrink-0 border-r border-slate-200/80 bg-slate-50 lg:block">
      <SidebarContent onNavigate={() => undefined} />
    </aside>

    {mobileOpen && (
      <div className="no-print fixed inset-0 z-50 flex lg:hidden">
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
        <aside className="relative z-10 h-full w-[272px] bg-slate-50 shadow-modal animate-slide-in">
          <button
            type="button"
            onClick={onClose}
            className="btn-icon btn-ghost absolute right-3 top-3"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
          <SidebarContent onNavigate={onClose} />
        </aside>
      </div>
    )}
  </>
);
