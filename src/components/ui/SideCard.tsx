import React from 'react';

/** Compact card used in document detail sidebars. */
export const SideCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  children,
  action,
}) => (
  <section className="card">
    <div className="flex items-center justify-between px-5 pb-2 pt-4">
      <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
      {action}
    </div>
    <div className="px-5 pb-5">{children}</div>
  </section>
);

export const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 text-[13px]">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right font-medium text-slate-800">{children}</dd>
  </div>
);
