import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FileText, LayoutDashboard, Menu, Plus, Users } from 'lucide-react';
import { useCan } from '../../security/sessionState';
import { Modal } from '../ui/Modal';
import { CREATE_ACTIONS } from './navigation';

const Tab: React.FC<{ to: string; label: string; icon: React.ElementType; end?: boolean }> = ({ to, label, icon: Icon, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
        isActive ? 'text-primary-600' : 'text-slate-500 active:text-slate-800'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
        {label}
      </>
    )}
  </NavLink>
);

/** App-style bottom navigation on phones and tablets (hidden on desktop). */
export const MobileTabBar: React.FC<{ onMore: () => void; onCreate: () => void }> = ({ onMore, onCreate }) => {
  const canCreate = useCan('documents.create');
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        <Tab to="/" end label="Overview" icon={LayoutDashboard} />
        <Tab to="/invoices" label="Invoices" icon={FileText} />
        {canCreate ? (
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={onCreate}
              aria-label="New document"
              className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30 ring-4 ring-white transition-transform active:scale-95"
            >
              <Plus size={24} strokeWidth={2.4} />
            </button>
          </div>
        ) : null}
        <Tab to="/customers" label="Clients" icon={Users} />
        <button
          type="button"
          onClick={onMore}
          className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500 active:text-slate-800"
        >
          <Menu size={21} strokeWidth={1.9} />
          More
        </button>
      </div>
    </nav>
  );
};

/** "New document" picker: a sheet on phones, a dialog on desktop. */
export const CreateSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const canCreate = useCan('documents.create');
  const canPay = useCan('payments.record');
  const actions = CREATE_ACTIONS.filter((a) => (a.label === 'Receipt' ? canPay : canCreate));
  return (
    <Modal isOpen={open} onClose={onClose} title="Create new" size="sm">
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            onClick={() => {
              onClose();
              navigate(a.to);
            }}
            className="flex flex-col items-start gap-2.5 rounded-xl border border-slate-200 p-3.5 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40 active:scale-[0.98]"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.tone}`}>
              <a.icon size={18} />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-slate-900">{a.label}</span>
              <span className="block text-xs text-slate-500">{a.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
};
