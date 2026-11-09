import React from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, History, Palette, ShieldCheck, Stamp, Users } from 'lucide-react';
import { useSession } from '../../security/sessionState';
import { roleCan, type Permission } from '../../security/permissions';
import { useAccessStore } from '../../store/useAccessStore';

const ITEMS: { to: string; label: string; icon: React.ElementType; end?: boolean; permission?: Permission; hint: string }[] = [
  { to: '/settings', end: true, label: 'Company profile', icon: Building2, permission: 'settings.manage', hint: 'Legal details, address & bank' },
  { to: '/settings/branding', label: 'Branding & documents', icon: Palette, permission: 'settings.manage', hint: 'Logo, colours, templates' },
  { to: '/settings/signatures', label: 'Signatures & stamps', icon: Stamp, hint: 'Signatories, company & personal stamps' },
  { to: '/settings/team', label: 'Team & access', icon: Users, permission: 'users.manage', hint: 'Invites, codes & roles' },
  { to: '/settings/security', label: 'Account & security', icon: ShieldCheck, hint: 'Profile, password, sessions' },
  { to: '/settings/activity', label: 'Activity log', icon: History, permission: 'audit.view', hint: 'Who did what, and when' },
];

export const SettingsLayout: React.FC = () => {
  const role = useSession((s) => s.user?.role);
  const { pathname } = useLocation();
  const items = ITEMS.filter((i) => !i.permission || roleCan(role, i.permission));
  const waiting = useAccessStore((s) => s.joinRequests.length);

  // Non-admins land on the first page they can access.
  if (pathname === '/settings' && !roleCan(role, 'settings.manage')) {
    return <Navigate to="/settings/security" replace />;
  }

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your company, documents, team and security.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:sticky lg:top-6 lg:flex-col">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-start gap-3 whitespace-nowrap rounded-lg px-3 py-2 transition-colors lg:whitespace-normal ${
                      isActive ? 'bg-white shadow-xs ring-1 ring-slate-200' : 'hover:bg-slate-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={16} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
                      <span>
                        <span className={`block text-[13px] font-medium ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                          {item.label}
                          {item.to === '/settings/team' && waiting > 0 && (
                            <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold leading-4 text-amber-800">
                              {waiting} waiting
                            </span>
                          )}
                        </span>
                        <span className="hidden text-xs text-slate-400 lg:block">{item.hint}</span>
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 pb-20">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
