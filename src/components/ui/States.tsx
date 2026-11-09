import React from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LoadingSpinner: React.FC<{ text?: string; className?: string }> = ({ text = 'Loading…', className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 text-slate-400 ${className}`}>
    <Loader2 className="animate-spin" size={24} />
    <span className="text-sm">{text}</span>
  </div>
);

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => (
  <div className="empty-state">
    <div className="relative mb-5">
      <div className="absolute inset-0 scale-150 rounded-full bg-primary-100/50 blur-xl" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-slate-200">
        <Icon size={24} className="text-primary-600" />
      </div>
    </div>
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <p className="mb-6 mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p>
    {action}
  </div>
);

export const ErrorState: React.FC<{ title?: string; message: string; action?: React.ReactNode }> = ({
  title = 'Something went wrong',
  message,
  action,
}) => (
  <div className="empty-state">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 ring-1 ring-rose-100">
      <AlertTriangle size={24} className="text-rose-500" />
    </div>
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <p className="mb-6 mt-1.5 max-w-sm text-[13px] text-slate-500">{message}</p>
    {action}
  </div>
);

export const NotFoundState: React.FC<{ what: string; backTo: string; backLabel: string }> = ({ what, backTo, backLabel }) => (
  <div className="card mx-auto max-w-lg">
    <ErrorState
      title={`${what} not found`}
      message={`This ${what.toLowerCase()} may have been deleted, or the link is incorrect.`}
      action={
        <Link to={backTo} className="btn-secondary">
          {backLabel}
        </Link>
      }
    />
  </div>
);

export const AccessDenied: React.FC = () => (
  <div className="card mx-auto mt-10 max-w-lg">
    <div className="empty-state">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
        <ShieldAlert size={24} className="text-amber-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">You don't have access to this page</h3>
      <p className="mb-6 mt-1.5 max-w-sm text-[13px] text-slate-500">
        Your role doesn't include this permission. Ask a workspace administrator if you need access.
      </p>
      <Link to="/" className="btn-secondary">
        Back to overview
      </Link>
    </div>
  </div>
);
