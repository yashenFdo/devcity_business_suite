import React from 'react';
import { getStatusColor, getStatusLabel } from '../../utils/formatters';

const DOT: Record<string, string> = {
  draft: 'bg-slate-400',
  sent: 'bg-primary-500',
  accepted: 'bg-emerald-500',
  paid: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  cancelled: 'bg-slate-400',
  expired: 'bg-amber-500',
  overdue: 'bg-rose-500',
  partially_paid: 'bg-amber-500',
  unpaid: 'bg-amber-500',
};

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => (
  <span className={`badge ${getStatusColor(status)} ${className}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${DOT[status] ?? 'bg-slate-400'}`} />
    {getStatusLabel(status)}
  </span>
);

export const Badge: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <span className={`badge ${className}`}>{label}</span>
);
