import React from 'react';
import { ROLE_META, type Role } from '../../security/permissions';
import { EMPLOYMENT_STATUS_META, type EmploymentStatus } from '../../store/useAccessStore';

const STATUS_DOT: Record<EmploymentStatus, string> = {
  active: 'bg-emerald-500',
  on_leave: 'bg-amber-500',
  left: 'bg-slate-400',
};

export const EmploymentBadge: React.FC<{ status: EmploymentStatus; className?: string }> = ({ status, className = '' }) => (
  <span className={`badge ${EMPLOYMENT_STATUS_META[status].tone} ${className}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
    {EMPLOYMENT_STATUS_META[status].label}
  </span>
);

export const RoleBadge: React.FC<{ role: Role; className?: string }> = ({ role, className = '' }) => (
  <span className={`badge ${ROLE_META[role].tone} ${className}`} title={ROLE_META[role].description}>
    {ROLE_META[role].label}
  </span>
);

export const YouTag: React.FC = () => (
  <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-500">You</span>
);
